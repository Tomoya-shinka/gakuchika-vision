import { NextRequest, NextResponse } from "next/server";
import { getAdminStorage, hasAdminConfig } from "@/lib/firebase-admin";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const image = formData.get("image") as Blob | null;
    const uid = formData.get("uid") as string | null;
    const ext = (formData.get("ext") as string | null) ?? "jpg";

    if (!image || !uid) {
      return NextResponse.json({ error: "image and uid are required" }, { status: 400 });
    }

    if (!hasAdminConfig()) {
      return NextResponse.json(
        { error: "Firebase Admin が設定されていません。" },
        { status: 500 }
      );
    }

    const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
    if (!bucketName) {
      return NextResponse.json({ error: "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET が未設定です" }, { status: 500 });
    }

    const storage = getAdminStorage();
    const bucket = storage.bucket(bucketName);

    const fileName = `journal-images/${uid}/${Date.now()}.${ext}`;
    const file = bucket.file(fileName);
    const imageBuffer = Buffer.from(await image.arrayBuffer());
    const downloadToken = crypto.randomUUID();

    await file.save(imageBuffer, {
      metadata: {
        contentType: image.type || `image/${ext}`,
        metadata: { firebaseStorageDownloadTokens: downloadToken },
      },
    });

    const encodedPath = encodeURIComponent(fileName);
    const imageUrl = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodedPath}?alt=media&token=${downloadToken}`;

    return NextResponse.json({ imageUrl });
  } catch (err) {
    console.error("[upload-image]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "upload failed" },
      { status: 500 }
    );
  }
}
