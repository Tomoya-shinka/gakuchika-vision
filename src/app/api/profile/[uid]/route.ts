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
          avatarUrl: typeof userData.avatarUrl === "string" && userData.avatarUrl
            ? userData.avatarUrl
            : undefined,
          dmEnabled: userData.dmEnabled === false ? "off"
            : (typeof userData.dmEnabled === "string" ? userData.dmEnabled : "all") as string,
        }
      : null;

    // 全ジャーナル取得（公開判定 & 統計計算に使用）
    let journals: {
      id: string;
      title?: string;
      content: string;
      createdAt: string;
      likes: string[];
      commentCount: number;
    }[] = [];
    let totalJournalCount = 0;
    let streakDays = 0;

    try {
      const allSnap = await db
        .collection("journals")
        .where("userId", "==", uid)
        .get();

      totalJournalCount = allSnap.size;

      // 継続日数計算（日付の重複を除いた連続日数）
      const dateSet = new Set<string>();
      for (const d of allSnap.docs) {
        const data = d.data() as Record<string, unknown>;
        const iso = toIso(data.createdAt);
        // JST（UTC+9）で日付文字列に変換
        const jstDate = new Date(new Date(iso).getTime() + 9 * 60 * 60 * 1000);
        dateSet.add(jstDate.toISOString().slice(0, 10));
      }
      const today = new Date(new Date().getTime() + 9 * 60 * 60 * 1000);
      let cursor = today.toISOString().slice(0, 10);
      while (dateSet.has(cursor)) {
        streakDays++;
        const prev = new Date(cursor);
        prev.setDate(prev.getDate() - 1);
        cursor = prev.toISOString().slice(0, 10);
      }

      // createdAt 降順でソート後、公開ジャーナルのみ抽出（最大20件）
      const sortedDocs = [...allSnap.docs].sort((a, b) => {
        const aTime = new Date(toIso((a.data() as Record<string, unknown>).createdAt)).getTime();
        const bTime = new Date(toIso((b.data() as Record<string, unknown>).createdAt)).getTime();
        return bTime - aTime;
      });
      const publicDocs = sortedDocs.filter(
        (d) => (d.data() as Record<string, unknown>).isPublic === true
      ).slice(0, 20);

      journals = await Promise.all(
        publicDocs.map(async (d) => {
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
    } catch (e) {
      console.error("[api/profile] journals fetch error:", e);
      journals = [];
    }

    // フォロワー数・フォロー中数
    let followersCount = 0;
    let followingCount = 0;
    try {
      const [fwSnap, fgSnap] = await Promise.all([
        db.collection("follows").where("followedId", "==", uid).count().get(),
        db.collection("follows").where("followerId", "==", uid).count().get(),
      ]);
      followersCount = fwSnap.data().count ?? 0;
      followingCount = fgSnap.data().count ?? 0;
    } catch { /* silent */ }

    return NextResponse.json({
      profile,
      journals,
      totalJournalCount,
      streakDays,
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
