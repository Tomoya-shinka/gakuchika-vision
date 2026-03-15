import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { openai } from "@ai-sdk/openai";
import {
  SECTION_COACH_PROMPTS,
  INITIAL_COACH_GREETINGS,
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

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { messages, sectionId } = body as {
      messages: UIMessage[];
      sectionId?: SectionId;
    };

    if (!process.env.OPENAI_API_KEY) {
      console.error("[chat] OPENAI_API_KEY is not set. Add it to .env.local");
      return Response.json(
        { error: "OpenAI API key is not configured" },
        { status: 503 }
      );
    }

    const section = (sectionId ?? "small-wins") as SectionId;
    const rawMessages = (messages ?? []) as Array<{
      role: string;
      content?: string;
      parts?: Array<{ type: string; text?: string }>;
    }>;
    const lastUser = rawMessages.filter((m) => m.role === "user").pop();
    const lastText = lastUser ? getMessageText(lastUser) : "";

    const systemPrompt =
      SECTION_COACH_PROMPTS[section] ?? SECTION_COACH_PROMPTS["small-wins"];
    const model = openai("gpt-4o-mini");

    if (
      lastText.trim() === START_MARKER ||
      (rawMessages.length === 1 && lastText.trim() === "")
    ) {
    const greeting =
      INITIAL_COACH_GREETINGS[section] ??
      INITIAL_COACH_GREETINGS["small-wins"];
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
