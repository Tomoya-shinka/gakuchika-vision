import { NextRequest, NextResponse } from "next/server";
import { getAdminStorage, hasAdminConfig } from "@/lib/firebase-admin";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const audio = formData.get("audio") as Blob | null;
    const uid = formData.get("uid") as string | null;

    if (!audio || !uid) {
      return NextResponse.json({ error: "audio and uid are required" }, { status: 400 });
    }

    if (!hasAdminConfig()) {
      return NextResponse.json(
        { error: "Firebase Admin が設定されていません。FIREBASE_SERVICE_ACCOUNT_KEY_PATH を .env.local に設定してください。" },
        { status: 500 }
      );
    }

    const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
    if (!bucketName) {
      return NextResponse.json({ error: "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET が未設定です" }, { status: 500 });
    }

    const storage = getAdminStorage();
    const bucket = storage.bucket(bucketName);

    const fileName = `voice-journals/${uid}/${Date.now()}.webm`;
    const file = bucket.file(fileName);

    const audioBuffer = Buffer.from(await audio.arrayBuffer());

    // Firebase Storage ダウンロードトークンを生成
    const downloadToken = crypto.randomUUID();

    await file.save(audioBuffer, {
      metadata: {
        contentType: "audio/webm",
        metadata: {
          firebaseStorageDownloadTokens: downloadToken,
        },
      },
    });

    const encodedPath = encodeURIComponent(fileName);
    const audioUrl = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodedPath}?alt=media&token=${downloadToken}`;

    return NextResponse.json({ audioUrl });
  } catch (err) {
    console.error("[upload-audio]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "upload failed" },
      { status: 500 }
    );
  }
}
