import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { openai } from "@ai-sdk/openai";

export const maxDuration = 60;

const START_MARKER = "__GOAL_COACH_START__";

/** 目標提案時のシグナル（フロントで検知して「これにする」カード表示） */
export const GOAL_PROPOSAL_SIGNAL = "[GOAL_PROPOSAL]";

const GOAL_TYPE_LABELS: Record<string, string> = {
  long: "長期ビジョン（卒業後の姿）",
  year: "1年後の目標",
  month: "1ヶ月後の目標",
};

function getMessageText(
  m: { role: string; content?: string; parts?: Array<{ type: string; text?: string }> }
): string {
  if (typeof m.content === "string") return m.content;
  return (
    m.parts
      ?.filter((p): p is { type: string; text: string } => p.type === "text")
      .map((p) => p.text)
      .join("") ?? ""
  );
}

function buildSystemPrompt(
  goalType: string,
  selfAnalysisContext: string
): string {
  const label = GOAL_TYPE_LABELS[goalType] ?? "目標";
  return `【あなたの役割】
あなたは、ユーザーが「納得感のある目標」を自分で気づき、自覚できるようサポートする「伴走型メンター」です。
押し付けるのではなく、対話を通じてユーザー自身の言葉で目標を形にしていくことを大切にしてください。

【目標の種類】
今回のテーマ：${label}

【自己分析データ（重要）】
以下の情報は、ユーザーが過去に記録した自己分析シートの内容です。これらを踏まえた具体的な提案をしてください。

${selfAnalysisContext || "（まだ自己分析データがありません。まずはユーザーの考えや経験を丁寧に聞き出してください）"}

【活用の例】
・「あなたは以前、〇〇という成功体験を記録していましたね。それを活かすなら、こんな目標はどうでしょう？」
・「得意なこととして△△が挙がっていました。それを伸ばす方向で目標を考えてみませんか？」
・「夢・人生の目標に□□と書いてありました。それに向けた第一歩として、この目標はどうでしょうか？」

【対話フロー】
1. まず、ユーザーが今ぼんやり考えている目標や希望を聞き出す
2. それを「具体的」「期限付き」「ワクワクするもの」へブラッシュアップする手伝いをする
3. 自己分析データ（小さな成功体験・得意なこと・夢など）を参照しながら、ユーザーに刺さる提案をする

【口調】
20歳の大学生に親しみやすく、信頼できる、押し付けがましくない優しいトーンで話してください。
一度に複数の質問をせず、1つずつ丁寧に聞いてください。

【目標提案の出力】
ユーザーが目標を決めた、または十分に対話が深まったタイミングで、まとまった目標案を1つ提案する。
提案時は、提案文の直後に「${GOAL_PROPOSAL_SIGNAL}」を必ず出力し、続けて「---SUMMARY---」を書き、
次の行に提案する目標の内容を『』で囲んで1行で出力する。

【出力フォーマット（提案時）】
〇〇という目標、とても良いと思います！目標入力フォームに反映する場合は「これにする」を押してください。
${GOAL_PROPOSAL_SIGNAL}
---SUMMARY---
『（ここに目標の内容を1行で）』

ユーザーが「これにする」「決まった」「これでいく」などと同意した場合も、既に提案済みであれば同様の形式で確定版を出力する。`;
}

function getInitialGreeting(goalType: string): string {
  const label = GOAL_TYPE_LABELS[goalType] ?? "目標";
  return `こんにちは！${label}について、一緒に考えていきましょう。
今、ぼんやりとでも「こんなことをしたい」「こうなりたい」と感じていることはありますか？
まずは思いつくことを、なんでも教えてください。`;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      messages,
      goalType = "long",
      selfAnalysisContext = "",
    } = body as {
      messages: UIMessage[];
      goalType?: string;
      selfAnalysisContext?: string;
    };

    if (!process.env.OPENAI_API_KEY) {
      console.error("[goals/chat] OPENAI_API_KEY is not set");
      return Response.json(
        { error: "OpenAI API key is not configured" },
        { status: 503 }
      );
    }

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
      const greeting = getInitialGreeting(goalType);
      const result = streamText({
        model,
        system: `あなたは目標設定の伴走型メンターです。以下の挨拶をそのまま1〜2行で出力してください。追加の説明は不要です。\n\n${greeting}`,
        messages: [{ role: "user" as const, content: "開始" }],
      });
      return result.toUIMessageStreamResponse();
    }

    const filteredMessages = rawMessages.filter(
      (m) => getMessageText(m).trim() !== START_MARKER
    );

    const systemPrompt = buildSystemPrompt(goalType, selfAnalysisContext);

    const result = streamText({
      model,
      system: systemPrompt,
      messages: await convertToModelMessages(
        filteredMessages as UIMessage[]
      ),
    });

    return result.toUIMessageStreamResponse();
  } catch (err) {
    console.error("[goals/chat] API error:", err);
    return Response.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
