import { NextRequest, NextResponse } from "next/server";
import OpenAI, { toFile } from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const audioBlob = formData.get("audio") as Blob | null;
    if (!audioBlob) {
      return NextResponse.json({ error: "audio field is required" }, { status: 400 });
    }

    const file = await toFile(audioBlob, "audio.webm", { type: audioBlob.type });
    const result = await openai.audio.transcriptions.create({
      file,
      model: "whisper-1",
      language: "ja",
      prompt: "今日は良い天気でした。朝から散歩をして、気分がすっきりしました。",
    });

    return NextResponse.json({ text: result.text });
  } catch (err) {
    console.error("[transcribe] error:", err);
    return NextResponse.json({ error: "transcription failed" }, { status: 500 });
  }
}
