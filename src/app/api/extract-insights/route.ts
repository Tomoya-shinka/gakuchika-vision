import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";

export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const { content } = (await req.json()) as { content: string };

    if (!content?.trim()) {
      return Response.json({ error: "No content provided" }, { status: 400 });
    }

    if (!process.env.OPENAI_API_KEY) {
      return Response.json({ error: "API key not configured" }, { status: 503 });
    }

    const { text } = await generateText({
      model: openai("gpt-4o-mini"),
      system: `ジャーナルの内容から、ユーザーの価値観・気づき・経験のキーとなる内容を2〜3文の短い文章として抽出してください。
- 各文は20〜60文字程度
- 体験談・感情・価値観・気づきを優先して抽出する
- 箇条書きや記号なし、自然な日本語で
- フィードに投稿する「つぶやき」として使えるよう、端的でシンプルに
- 余計な前置き・説明は不要。抽出した文のみ出力する`,
      prompt: `以下のジャーナルから重要な気づき・価値観・経験を抽出してください:\n\n${content}`,
      maxOutputTokens: 200,
    });

    return Response.json({ text: text.trim() });
  } catch (err) {
    console.error("[extract-insights] error:", err);
    return Response.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
