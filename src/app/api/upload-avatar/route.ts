import { NextRequest, NextResponse } from "next/server";
import { getAdminStorage, hasAdminConfig } from "@/lib/firebase-admin";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const image = formData.get("image") as Blob | null;
    const uid = formData.get("uid") as string | null;

    if (!image || !uid) {
      return NextResponse.json({ error: "image and uid are required" }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(image.type)) {
      return NextResponse.json({ error: "JPEG / PNG / WebP / GIF のみアップロードできます" }, { status: 400 });
    }

    if (image.size > MAX_SIZE) {
      return NextResponse.json({ error: "ファイルサイズは5MB以下にしてください" }, { status: 400 });
    }

    if (!hasAdminConfig()) {
      return NextResponse.json({ error: "Firebase Admin が設定されていません" }, { status: 500 });
    }

    const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
    if (!bucketName) {
      return NextResponse.json({ error: "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET が未設定です" }, { status: 500 });
    }

    const ext = image.type.split("/")[1].replace("jpeg", "jpg");
    const fileName = `avatars/${uid}/avatar.${ext}`;
    const storage = getAdminStorage();
    const bucket = storage.bucket(bucketName);
    const file = bucket.file(fileName);

    const buffer = Buffer.from(await image.arrayBuffer());
    const downloadToken = crypto.randomUUID();

    await file.save(buffer, {
      metadata: {
        contentType: image.type,
        metadata: { firebaseStorageDownloadTokens: downloadToken },
      },
    });

    const encodedPath = encodeURIComponent(fileName);
    const avatarUrl = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodedPath}?alt=media&token=${downloadToken}`;

    return NextResponse.json({ avatarUrl });
  } catch (err) {
    console.error("[upload-avatar]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "upload failed" },
      { status: 500 }
    );
  }
}
