import { NextResponse } from "next/server";
import { getAdminDb, hasAdminConfig } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";

function toIso(v: unknown): string {
  if (v == null) return new Date().toISOString();
  if (typeof v === "string") return v;
  if (typeof v === "number") return new Date(v).toISOString();
  if (v && typeof v === "object" && "toDate" in v && typeof (v as { toDate: () => Date }).toDate === "function") {
    return (v as { toDate: () => Date }).toDate().toISOString();
  }
  return new Date().toISOString();
}

function calcUniversityDay(enrollment: unknown, createdAt: string): number | undefined {
  try {
    if (!enrollment || !createdAt) return undefined;
    const created = new Date(createdAt);
    if (Number.isNaN(created.getTime())) return undefined;
    let enrollDate: Date;
    if (typeof enrollment === "string" && /^\d{4}-\d{2}-\d{2}$/.test(enrollment)) {
      enrollDate = new Date(`${enrollment}T00:00:00`);
    } else if (
      enrollment && typeof enrollment === "object" &&
      "toDate" in enrollment &&
      typeof (enrollment as { toDate: () => Date }).toDate === "function"
    ) {
      enrollDate = (enrollment as { toDate: () => Date }).toDate();
    } else {
      return undefined;
    }
    enrollDate.setHours(0, 0, 0, 0);
    const target = new Date(created);
    target.setHours(0, 0, 0, 0);
    const diff = Math.floor((target.getTime() - enrollDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    return diff < 1 ? 1 : diff;
  } catch {
    return undefined;
  }
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!hasAdminConfig()) {
    return NextResponse.json({ error: "Firebase Admin 未設定" }, { status: 503 });
  }

  const { id } = await params;

  try {
    const db = getAdminDb();

    // 1. ジャーナル本文取得
    const journalSnap = await db.collection("journals").doc(id).get();
    if (!journalSnap.exists) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const data = journalSnap.data() as Record<string, unknown>;
    if (data.isPublic !== true) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const userId = String(data.userId ?? "");
    const rawLikes = data.likes;
    const likes = Array.isArray(rawLikes) ? (rawLikes as string[]).filter((x) => typeof x === "string") : [];
    const createdAt = toIso(data.createdAt);

    // 2. 著者情報取得
    const authorSnap = await db.collection("users").doc(userId).get();
    const authorData = authorSnap.data() as Record<string, unknown> | undefined;
    const author = {
      displayName: typeof authorData?.displayName === "string" ? authorData.displayName : "ユーザー",
      university: typeof authorData?.university === "string" ? authorData.university : "",
      grade: typeof authorData?.grade === "string" ? authorData.grade : "",
      avatarUrl: typeof authorData?.avatarUrl === "string" && authorData.avatarUrl ? authorData.avatarUrl : undefined,
    };
    const universityDay = calcUniversityDay(authorData?.enrollmentDate, createdAt);

    // 3. コメント全件取得（新しい順）
    let commentsSnap;
    try {
      commentsSnap = await db
        .collection("journals").doc(id)
        .collection("comments")
        .orderBy("createdAt", "desc")
        .get();
    } catch {
      commentsSnap = await db
        .collection("journals").doc(id)
        .collection("comments")
        .get();
    }

    const comments = commentsSnap.docs.map((d) => {
      const c = d.data() as Record<string, unknown>;
      return {
        id: d.id,
        userId: String(c.userId ?? ""),
        userName: String(c.userName ?? "ユーザー"),
        text: String(c.text ?? ""),
        createdAt: toIso(c.createdAt),
      };
    });

    const journal = {
      id,
      userId,
      title: typeof data.title === "string" && data.title.trim() ? data.title.trim() : undefined,
      content: String(data.content ?? ""),
      createdAt,
      likes,
      commentCount: comments.length,
      universityDay,
      audioUrl: typeof data.audioUrl === "string" && data.audioUrl ? data.audioUrl : undefined,
      audioDurationSec: typeof data.audioDurationSec === "number" ? data.audioDurationSec : undefined,
      imageUrls: Array.isArray(data.imageUrls) ? (data.imageUrls as string[]).filter((u) => typeof u === "string") : undefined,
      commentsEnabled: data.commentsEnabled !== false,
    };

    return NextResponse.json({ journal, author, comments });
  } catch (e) {
    console.error("[api/feed/journals/[id]]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "取得に失敗しました" },
      { status: 500 }
    );
  }
}
