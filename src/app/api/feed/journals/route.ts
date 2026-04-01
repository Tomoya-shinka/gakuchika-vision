import { NextResponse } from "next/server";
import type admin from "firebase-admin";
import { getAdminDb, getAdminConfigDebug, hasAdminConfig } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";

type FeedJournalItem = {
  id: string;
  userId: string;
  title?: string;
  content: string;
  createdAt: string;
  isPublic: boolean;
  likes: string[];
  commentCount: number;
  universityDay?: number;
  audioUrl?: string;
  audioDurationSec?: number;
  imageUrls?: string[];
  commentsEnabled?: boolean;
  postType?: "journal" | "tweet";
};

type AuthorProfile = {
  displayName: string;
  university: string;
  grade: string;
  avatarUrl?: string;
};

function calcUniversityDayAdmin(enrollment: unknown, createdAt: string): number | undefined {
  try {
    if (!createdAt) return undefined;
    if (enrollment == null) return undefined;
    if (typeof enrollment === "string" && enrollment.trim().length === 0) return undefined;
    const created = new Date(createdAt);
    if (Number.isNaN(created.getTime())) return undefined;
    let enrollDate: Date;
    if (typeof enrollment === "string" && /^\d{4}-\d{2}-\d{2}$/.test(enrollment)) {
      enrollDate = new Date(`${enrollment}T00:00:00`);
    } else if (
      enrollment &&
      typeof enrollment === "object" &&
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
    const diffMs = target.getTime() - enrollDate.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;
    return diffDays < 1 ? 1 : diffDays;
  } catch {
    return undefined;
  }
}

function toIso(v: unknown): string {
  if (v == null) return "1970-01-01T00:00:00.000Z";
  if (typeof v === "string") return v;
  if (typeof v === "number") return new Date(v).toISOString();
  if (v && typeof v === "object" && "toDate" in v && typeof (v as { toDate: () => Date }).toDate === "function") {
    return (v as { toDate: () => Date }).toDate().toISOString();
  }
  return new Date().toISOString();
}

export async function GET() {
  const configDebug = getAdminConfigDebug();
  if (!configDebug.configured) {
    return NextResponse.json(
      {
        error:
          "サーバーで Firebase Admin が未設定です。ダウンロードした鍵 JSON を次のパスに置くか、.env.local の FIREBASE_SERVICE_ACCOUNT_KEY_PATH をそのパスに合わせてください。",
        debug:
          configDebug.resolvedPath != null
            ? `サーバーが参照したパス: ${configDebug.resolvedPath}（この場所に firebase-service-account.json を置くか、正しい相対パスを指定してください）`
            : configDebug.reason,
        cwd: configDebug.cwd,
      },
      { status: 503 }
    );
  }

  try {
    const db = getAdminDb();
    const col = db.collection("journals");

    let snapPublic: admin.firestore.QuerySnapshot;
    try {
      snapPublic = await col.where("isPublic", "==", true).orderBy("createdAt", "desc").limit(50).get();
    } catch {
      snapPublic = await col.where("isPublic", "==", true).limit(200).get();
    }

    const seen = new Set<string>();
    const rows: FeedJournalItem[] = [];

    const push = (id: string, data: Record<string, unknown>) => {
      if (seen.has(id)) return;
      // isPublic を優先。非公開に切り替えた記録が visibility の不一致で表示されないようにする
      if (data.isPublic !== true) return;
      seen.add(id);
      const isPublic = true;
      const rawLikes = data.likes;
      const likes = Array.isArray(rawLikes) ? (rawLikes as string[]).filter((x) => typeof x === "string") : [];
      const userId = String(data.userId ?? "");
      const content = String(data.content ?? "");
      const audioUrl = typeof data.audioUrl === "string" && data.audioUrl ? data.audioUrl : undefined;
      if (!userId || (!content && !audioUrl)) return;
      rows.push({
        id,
        userId,
        title:
          typeof data.title === "string" && data.title.trim() ? data.title.trim() : undefined,
        content,
        createdAt: toIso(data.createdAt),
        isPublic,
        likes,
        commentCount: 0,
        audioUrl,
        audioDurationSec: typeof data.audioDurationSec === "number" ? data.audioDurationSec : undefined,
        imageUrls: Array.isArray(data.imageUrls) ? (data.imageUrls as string[]).filter((u) => typeof u === "string") : undefined,
        commentsEnabled: data.commentsEnabled !== false,
        postType: data.type === "tweet" ? "tweet" : "journal",
      });
    };

    snapPublic.docs.forEach((d) => push(d.id, d.data()));

    rows.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const items = rows.slice(0, 50);

    // 各投稿のコメント数を取得（リロード時も正しい件数を表示するため）
    await Promise.all(
      items.map(async (item) => {
        try {
          const commentsRef = db.collection("journals").doc(item.id).collection("comments");
          const countSnap = await commentsRef.count().get();
          item.commentCount = countSnap.data().count ?? 0;
        } catch {
          item.commentCount = 0;
        }
      })
    );

    // 著者情報をサーバーで取得（クライアントで users を読むと permission-denied になるため）
    const uniqueUids = Array.from(new Set(items.map((r) => r.userId))).filter(Boolean);
    const authors: Record<string, AuthorProfile> = {};
    const usersCol = db.collection("users");
    await Promise.all(
      uniqueUids.map(async (uid) => {
        const snap = await usersCol.doc(uid).get();
        const d = snap.data() as Record<string, unknown> | undefined;
        authors[uid] = {
          displayName: typeof d?.displayName === "string" ? (d.displayName as string) : "ユーザー",
          university: typeof d?.university === "string" ? (d.university as string) : "",
          grade: typeof d?.grade === "string" ? (d.grade as string) : "",
          avatarUrl: typeof d?.avatarUrl === "string" && d.avatarUrl ? (d.avatarUrl as string) : undefined,
        };
        const enrollment = d?.enrollmentDate;
        items
          .filter((it) => it.userId === uid)
          .forEach((it) => {
            const day = calcUniversityDayAdmin(enrollment, it.createdAt);
            if (day !== undefined) it.universityDay = day;
          });
      })
    );

    return NextResponse.json({ items, authors });
  } catch (e) {
    console.error("[api/feed/journals]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "取得に失敗しました" },
      { status: 500 }
    );
  }
}
