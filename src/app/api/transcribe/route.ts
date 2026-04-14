import { NextRequest, NextResponse } from "next/server";
import OpenAI, { toFile } from "openai";

export const maxDuration = 60; // Vercel Hobby 上限。Pro プランなら 300 まで設定可能

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const audioBlob = formData.get("audio") as Blob | null;
    if (!audioBlob) {
      return NextResponse.json({ error: "audio field is required" }, { status: 400 });
    }

    const mime = audioBlob.type || "audio/webm";
    const ext = mime.includes("mp4") ? "mp4" : "webm";
    const file = await toFile(audioBlob, `audio.${ext}`, { type: mime });
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
