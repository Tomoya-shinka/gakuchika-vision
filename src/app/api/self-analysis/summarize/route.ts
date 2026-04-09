import OpenAI from "openai";
import type { UIMessage } from "ai";

export const maxDuration = 30;

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const INLINE_SYSTEM = `あなたは自己分析のコーチです。ユーザーとの対話内容を、自己分析シートに保存するための1〜2文の要約にまとめてください。
要約は、ユーザーが共有した具体的なエピソードや気づきを簡潔に表現し、後から読み返して思い出せるような形にしてください。
要約のみを出力し、余計な説明は不要です。`;

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

export async function POST(req: Request) {
  const body = await req.json();
  const { messages } = body as { messages: UIMessage[] };

  if (!messages?.length) {
    return Response.json({ error: "No messages" }, { status: 400 });
  }

  const promptId = process.env.OPENAI_PROMPT_SELF_ANALYSIS_SUMMARIZE;

  const input = (messages as Array<{ role: string; content?: string; parts?: Array<{ type: string; text?: string }> }>)
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content: getMessageText(m),
    }))
    .filter((m) => m.content.trim());

  const response = await client.responses.create(
    promptId
      ? {
          model: "gpt-4o-mini",
          prompt: { id: promptId },
          input,
        }
      : {
          model: "gpt-4o-mini",
          instructions: INLINE_SYSTEM,
          input,
        }
  );

  return Response.json({ summary: (response.output_text ?? "").trim() });
}
