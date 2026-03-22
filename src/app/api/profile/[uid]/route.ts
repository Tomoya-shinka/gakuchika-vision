import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, getAdminConfigDebug } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";

function toIso(v: unknown): string {
  if (v == null) return "1970-01-01T00:00:00.000Z";
  if (typeof v === "string") return v;
  if (typeof v === "number") return new Date(v).toISOString();
  if (v && typeof v === "object" && "toDate" in v && typeof (v as { toDate: () => Date }).toDate === "function") {
    return (v as { toDate: () => Date }).toDate().toISOString();
  }
  return new Date().toISOString();
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ uid: string }> }
) {
  const { uid } = await params;
  if (!uid) return NextResponse.json({ error: "uid が必要です" }, { status: 400 });

  const configDebug = getAdminConfigDebug();
  if (!configDebug.configured) {
    return NextResponse.json({ error: "Firebase Admin 未設定" }, { status: 503 });
  }

  try {
    const db = getAdminDb();

    // ユーザープロフィール取得
    const userSnap = await db.collection("users").doc(uid).get();
    const userData = userSnap.data() as Record<string, unknown> | undefined;
    const profile = userData
      ? {
          displayName: String(userData.displayName ?? "ユーザー"),
          university: String(userData.university ?? ""),
          grade: String(userData.grade ?? ""),
          enrollmentDate: userData.enrollmentDate
            ? String(userData.enrollmentDate)
            : undefined,
          graduationDate: userData.graduationDate
            ? String(userData.graduationDate)
            : undefined,
        }
      : null;

    // 公開ジャーナル取得（最大20件）
    let journals: {
      id: string;
      title?: string;
      content: string;
      createdAt: string;
      likes: string[];
      commentCount: number;
    }[] = [];
    try {
      const jSnap = await db
        .collection("journals")
        .where("userId", "==", uid)
        .where("isPublic", "==", true)
        .orderBy("createdAt", "desc")
        .limit(20)
        .get();
      journals = await Promise.all(
        jSnap.docs.map(async (d) => {
          const data = d.data() as Record<string, unknown>;
          const rawLikes = data.likes;
          const likes = Array.isArray(rawLikes)
            ? (rawLikes as string[]).filter((x) => typeof x === "string")
            : [];
          let commentCount = 0;
          try {
            const cSnap = await db
              .collection("journals")
              .doc(d.id)
              .collection("comments")
              .count()
              .get();
            commentCount = cSnap.data().count ?? 0;
          } catch {
            commentCount = 0;
          }
          return {
            id: d.id,
            title:
              typeof data.title === "string" && data.title.trim()
                ? data.title.trim()
                : undefined,
            content: String(data.content ?? ""),
            createdAt: toIso(data.createdAt),
            likes,
            commentCount,
          };
        })
      );
    } catch {
      journals = [];
    }

    // フォロワー数（自分をフォローしている人）
    let followersCount = 0;
    let followingCount = 0;
    try {
      const followersSnap = await db
        .collection("follows")
        .where("followedId", "==", uid)
        .count()
        .get();
      followersCount = followersSnap.data().count ?? 0;

      const followingSnap = await db
        .collection("follows")
        .where("followerId", "==", uid)
        .count()
        .get();
      followingCount = followingSnap.data().count ?? 0;
    } catch {
      followersCount = 0;
      followingCount = 0;
    }

    return NextResponse.json({
      profile,
      journals,
      followersCount,
      followingCount,
    });
  } catch (e) {
    console.error("[api/profile]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "取得に失敗しました" },
      { status: 500 }
    );
  }
}
