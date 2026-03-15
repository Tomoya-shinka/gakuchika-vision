import { generateText, convertToModelMessages, type UIMessage } from "ai";
import { openai } from "@ai-sdk/openai";

export const maxDuration = 30;

export async function POST(req: Request) {
  const body = await req.json();
  const { messages } = body as { messages: UIMessage[] };

  if (!messages?.length) {
    return Response.json({ error: "No messages" }, { status: 400 });
  }

  const model = openai("gpt-4o-mini");

  const { text } = await generateText({
    model,
    system: `あなたは自己分析のコーチです。ユーザーとの対話内容を、自己分析シートに保存するための1〜2文の要約にまとめてください。
要約は、ユーザーが共有した具体的なエピソードや気づきを簡潔に表現し、後から読み返して思い出せるような形にしてください。
要約のみを出力し、余計な説明は不要です。`,
    messages: await convertToModelMessages(messages),
  });

  return Response.json({ summary: text?.trim() ?? "" });
}
