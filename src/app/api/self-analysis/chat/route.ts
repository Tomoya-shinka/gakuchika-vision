import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { openai } from "@ai-sdk/openai";
import {
  SECTION_COACH_PROMPTS,
  INITIAL_COACH_GREETINGS,
  INSIGHT_SIGNAL,
} from "@/lib/self-analysis-sections";
import type { SectionId } from "@/lib/self-analysis";

export const maxDuration = 60;

const START_MARKER = "__COACH_START__";

function getMessageText(m: { role: string; content?: string; parts?: Array<{ type: string; text?: string }> }): string {
  if (typeof m.content === "string") return m.content;
  return (
    m.parts
      ?.filter((p): p is { type: string; text: string } => p.type === "text")
      .map((p) => p.text)
      .join("") ?? ""
  );
}

// デフォルト4セクションのID一覧
const DEFAULT_SECTION_IDS = ["small-wins", "fun", "strength", "dream"];

/**
 * カスタムフォルダ用の汎用コーチシステムプロンプトを生成する
 */
function buildGenericCoachPrompt(folderName: string): string {
  const BASE_COACH_IDENTITY = `【あなたの役割とスタンス】
あなたは「夢や目標がまだ見つかっていない若者」に並走する、自己分析の専門コーチです。
ユーザーが「自分一人では絶対に気づけない自分の価値」を言語化することを、徹底的にサポートしてください。

【口調】
20歳の大学生にとって親しみやすく、かつ信頼できる、押し付けがましくない優しいトーンで話してください。`;

  const BASE_DIALOGUE_RULES = `【対話ルール】
・一度に複数の質問をせず、必ず1つだけ質問する
・ユーザーの回答に対して「なるほど！」「それは素敵ですね」など共感を示してから次の質問へ

【時間軸】
・「今日」や「最近」に限定しない。「子供の頃」「中高生時代」「最近の数ヶ月」など、人生のどのタイミングのエピソードでも良いことを伝える`;

  const NOTHING_RESPONSE_GUIDE = `【「何もない」と答えたとき】
諦めず、「小さな違和感」や「当たり前にできていること」からヒアリングする。
例：「特別なことじゃなくていいんです。例えば、つい夢中になって時間を忘れてしまったことや、人から『丁寧だね』と言われたことなどはありますか？」`;

  const DEEP_DIVE_GUIDE = `【1つのエピソードの深掘り】
・具体的な行動（何をしたか）
・その時の感情（どう感じたか）
・その理由（なぜそう感じたか）
この3点を丁寧に聞き出してください。`;

  const SUMMARY_OUTPUT_GUIDE = `【シートに登録するフレーズの質】
単なる事実ではなく、ユーザーの価値観が凝縮された言葉にする。
例：「テストで満点」→「目標に向かって戦略的に努力し、結果を出すことに喜びを感じる力」
例：「遅刻しなかった」→「約束やルールを守ることで、人との信頼関係を大切にしている」`;

  const SUMMARY_FLOW = `
【2段階のフェーズ】

■ 探索フェーズ（最初の3〜4往復）
・徹底的にヒアリングに徹する。エピソードの背景、行動、感情を深く掘り下げる
・この間は絶対に提案を行わない。シート登録の話は一切しない

■ 洞察フェーズ
・ユーザーの強みや価値観が明確になったと感じたタイミングでのみ、次の手順を実行する
・対話を一度まとめ、「本質を突いた短いフレーズ」を1つだけ生成する
・提案文の直後に「${INSIGHT_SIGNAL}」を必ず出力し、続けて「---SUMMARY---」を書き、次の行に『』で囲んだフレーズだけを1行で出力する

【厳格な禁止事項】
・ユーザーが「何もない」「特にない」「思いつかない」などと答えている段階では、絶対に提案を出さない
・ユーザーの言葉から「夢の原石」が見つかった時だけ、そっと差し出すような演出にする

【出力フォーマット（提案時のみ）】
ここまでの話をまとめると、あなたの強み（価値観）は『〇〇』と言えそうですね。シートに追加しますか？
${INSIGHT_SIGNAL}
---SUMMARY---
『〇〇』

ユーザーが「終わり」「完了」と言った場合も、洞察が十分に見つかっている場合のみ同様に出力する。まだ洞察が不十分な場合は、もう少し聞き返してから提案する。`;

  return `${BASE_COACH_IDENTITY}
「${folderName}」について、一問一答で深掘りします。
${BASE_DIALOGUE_RULES}
${NOTHING_RESPONSE_GUIDE}
${DEEP_DIVE_GUIDE}
${SUMMARY_OUTPUT_GUIDE}
${SUMMARY_FLOW}`;
}

/**
 * カスタムフォルダ用の汎用挨拶メッセージを生成する
 */
function buildGenericGreeting(folderName: string): string {
  return `こんにちは！「${folderName}」に関連するエピソードや思いを一緒に言語化していきましょう。どんな小さなことでも大丈夫です。何か思い当たることはありますか？`;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { messages, sectionId, folderName } = body as {
      messages: UIMessage[];
      sectionId?: SectionId;
      folderName?: string;
    };

    if (!process.env.OPENAI_API_KEY) {
      console.error("[chat] OPENAI_API_KEY is not set. Add it to .env.local");
      return Response.json(
        { error: "OpenAI API key is not configured" },
        { status: 503 }
      );
    }

    const section = (sectionId ?? "small-wins") as SectionId;
    const isDefaultSection = DEFAULT_SECTION_IDS.includes(section);

    // カスタムフォルダの場合は汎用プロンプト/挨拶を使用
    const systemPrompt = isDefaultSection
      ? (SECTION_COACH_PROMPTS[section] ?? SECTION_COACH_PROMPTS["small-wins"])
      : buildGenericCoachPrompt(folderName ?? section);

    const rawMessages = (messages ?? []) as Array<{
      role: string;
      content?: string;
      parts?: Array<{ type: string; text?: string }>;
    }>;
    const lastUser = rawMessages.filter((m) => m.role === "user").pop();
    const lastText = lastUser ? getMessageText(lastUser) : "";

    const model = openai("gpt-4o-mini");

    if (
      lastText.trim() === START_MARKER ||
      (rawMessages.length === 1 && lastText.trim() === "")
    ) {
      const greeting = isDefaultSection
        ? (INITIAL_COACH_GREETINGS[section] ?? INITIAL_COACH_GREETINGS["small-wins"])
        : buildGenericGreeting(folderName ?? section);
      const result = streamText({
        model,
        system: `あなたはコーチです。以下の挨拶をそのまま1行で出力してください。追加の説明は不要です。\n\n${greeting}`,
        messages: [{ role: "user" as const, content: "開始" }],
      });
      return result.toUIMessageStreamResponse();
    }

    const filteredMessages = rawMessages.filter(
      (m) => getMessageText(m).trim() !== START_MARKER
    );

    const result = streamText({
      model,
      system: systemPrompt,
      messages: await convertToModelMessages(
        filteredMessages as UIMessage[]
      ),
    });

    return result.toUIMessageStreamResponse();
  } catch (err) {
    console.error("[chat] API error:", err);
    return Response.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
