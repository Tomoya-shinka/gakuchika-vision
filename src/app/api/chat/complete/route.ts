import { generateText, convertToModelMessages, type UIMessage } from "ai";
import { openai } from "@ai-sdk/openai";
import type { SectionId } from "@/lib/self-analysis";

export const maxDuration = 30;

type ChatPurpose =
  | { kind: "self-analysis"; sectionId: SectionId };

const START_MARKERS = new Set(["__GOAL_COACH_START__", "__COACH_START__"]);

function getMessageText(m: {
  role: string;
  content?: string;
  parts?: Array<{ type: string; text?: string }>;
}): string {
  if (typeof m.content === "string") return m.content;
  return (
    m.parts
      ?.filter((p): p is { type: string; text: string } => p.type === "text")
      .map((p) => p.text)
      .join("") ?? ""
  );
}

function buildSystemPrompt(purpose: ChatPurpose): string {
  const grounding = `【重要：参照ルール】
- あなたが参照してよい事実は、この後に渡される「ユーザー発言（role=user）」の本文に書かれている内容のみです。
- ユーザーが明示していない事実（例：専攻、経験、性格、実績、希望業界、家庭環境など）を推測して書かないでください。
- 不明・未回答の項目は、推測で埋めずに「不明（ユーザー未記載）」と明記してください。
- 断定口調で作り話をしないでください。`;

  // self-analysis: シートに貼れる「1段落（100〜500文字）」へ統一
  const sectionLabel =
    purpose.sectionId === "strength"
      ? "得意なこと（強み）"
      : purpose.sectionId === "small-wins"
        ? "成功体験"
        : purpose.sectionId === "dream"
          ? "長期ビジョン"
          : "楽しかったこと";

  return `あなたは自己分析のコーチです。ユーザー発言を要約し、「${sectionLabel}」として自己分析シートに貼れる文章を作成してください。
${grounding}

【出力ルール（厳守）】
- 日本語で100〜500文字（この範囲に必ず収める）
- 1段落のみ（改行しない）
- 箇条書き・見出し・番号・記号による列挙をしない
- 出力は文章のみ（余計な前置き・注釈・囲み・引用符は禁止）

【内容の指針】
- ユーザーが実際に書いた事実/経験/気づきだけを文章化する
- 不明な点は推測で埋めず「不明（ユーザー未記載）」を文中に入れてよい`;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { messages, purpose } = body as {
      messages: UIMessage[];
      purpose: ChatPurpose;
    };

    if (!process.env.OPENAI_API_KEY) {
      console.error("[chat/complete] OPENAI_API_KEY is not set");
      return Response.json(
        { error: "OpenAI API key is not configured" },
        { status: 503 }
      );
    }

    if (!messages?.length) {
      return Response.json({ error: "No messages" }, { status: 400 });
    }
    if (!purpose || purpose.kind !== "self-analysis") {
      return Response.json({ error: "Invalid purpose" }, { status: 400 });
    }

    const rawMessages = (messages ?? []) as Array<{
      role: string;
      content?: string;
      parts?: Array<{ type: string; text?: string }>;
    }>;

    // ユーザーが会話で書き出した内容のみを参照させる（assistant の発言は除外）
    const filtered = rawMessages.filter((m) => {
      const t = getMessageText(m).trim();
      if (!t || START_MARKERS.has(t)) return false;
      return m.role === "user";
    });

    const model = openai("gpt-4o-mini");
    const modelMessages = await convertToModelMessages(filtered as UIMessage[]);

    const normalizeSingleParagraph = (raw: string) =>
      raw.replace(/\r?\n+/g, " ").replace(/\s+/g, " ").trim();

    const generateOnce = async (system: string) => {
      const { text } = await generateText({
        model,
        system,
        messages: modelMessages,
      });
      return text?.trim() ?? "";
    };

    const system = buildSystemPrompt(purpose);
    let proposal = await generateOnce(system);

    // 生成時点で 100〜500 へ寄せる（ただし条件外でもそのまま返す）
    proposal = normalizeSingleParagraph(proposal);
    const len = proposal.length;
    if (len < 100 || len > 500) {
      const retrySystem = `${system}

【追加ルール】
- 直前の出力は文字数条件を満たしていません（現在 ${len} 文字）。必ず100〜500文字に収めて、同じ内容の範囲で言い換えて出力してください。
- 改行なし・箇条書きなしは維持。文章のみを出力。`;
      proposal = await generateOnce(retrySystem);
      proposal = normalizeSingleParagraph(proposal);
    }
    return Response.json({ proposal });
  } catch (err) {
    console.error("[chat/complete] API error:", err);
    return Response.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}

