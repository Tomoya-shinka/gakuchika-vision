import OpenAI from "openai";

export const maxDuration = 30;

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Playgroundに保存したプロンプトがない場合のフォールバック用インラインシステムプロンプト
function buildInlineSystem(maxCount: number): string {
  return `ジャーナルから気づき・価値観・経験を抽出し、Snapとして出力してください。

【抽出ルール】
1. 文章を約500文字ずつのブロックに分けて読む
2. 各ブロックから「最も印象的な気づき・体験・価値観」を1つ候補として挙げる
3. その候補が、すでに挙げた候補と**同じテーマ・同じ結論**なら新しいSnapにせず統合（既存Snapの内容で十分とみなす）
4. 明らかに異なる観点・体験・気づきであれば新しいSnapとして追加する
5. 最終的に出力するSnapは最大${maxCount}件。文章が長く異なる気づきが複数ある場合は積極的に${maxCount}件まで出力してよい。ただし似た内容は1件にまとめること

【各Snapの書き方】
- 1〜2文、60〜150文字程度
- その人の経験・感情・価値観の本質を捉えた、深みのある文章
- 表面的なまとめではなく、読んだ人に「なるほど」と思わせる具体性を持たせる
- 自然な日本語、箇条書き・記号なし

必ず以下のJSON配列形式のみで出力（前置き・説明・コードブロック不要）:
["Snap1", "Snap2"]`;
}

export async function POST(req: Request) {
  try {
    const { content } = (await req.json()) as { content: string };

    if (!content?.trim()) {
      return Response.json({ error: "No content provided" }, { status: 400 });
    }

    if (!process.env.OPENAI_API_KEY) {
      return Response.json({ error: "API key not configured" }, { status: 503 });
    }

    const len = content.trim().length;
    const maxCount = Math.max(1, Math.min(3, Math.floor(len / 500)));

    const promptId = process.env.OPENAI_PROMPT_EXTRACT_INSIGHTS;

    const response = await client.responses.create(
      promptId
        ? {
            model: "gpt-4o-mini",
            prompt: {
              id: promptId,
              variables: {
                content,
                max_count: String(maxCount),
              },
            },
            max_output_tokens: 600,
          }
        : {
            model: "gpt-4o-mini",
            instructions: buildInlineSystem(maxCount),
            input: `以下のジャーナルを分析してSnapを抽出してください:\n\n${content}`,
            max_output_tokens: 600,
          }
    );

    const text = response.output_text ?? "";

    // JSONパース
    try {
      const raw = text.trim().replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
      const snaps = JSON.parse(raw) as string[];
      const filtered = snaps
        .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
        .map((s) => s.trim())
        .slice(0, 3);
      if (filtered.length > 0) {
        return Response.json({ snaps: filtered });
      }
    } catch {
      // フォールバック: 単一テキストとして扱う
    }

    return Response.json({ snaps: [text.trim()] });
  } catch (err) {
    console.error("[extract-insights] error:", err);
    return Response.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
