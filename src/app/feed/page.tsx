"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  collection,
  doc,
  addDoc,
  deleteDoc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  arrayUnion,
  arrayRemove,
  Timestamp,
  where,
} from "firebase/firestore";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getDb } from "@/lib/firebase";
import { formatDate, stripHtml } from "@/lib/journal";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/auth-context";
import {
  Heart,
  MessageCircle,
  MessageCircleOff,
  RotateCcw,
  MoreHorizontal,
  Pencil,
  Feather,
  Trash2,
  Mail,
  Play,
  Pause,
} from "lucide-react";
import { useCommentNotifications } from "@/hooks/useCommentNotifications";

type Conversation = {
  id: string;
  participants: string[];
  participantNames: Record<string, string>;
  lastMessage: string;
  lastMessageAt: string;
};

type FeedJournal = {
  id: string;
  userId: string;
  title?: string;
  content: string;
  createdAt: string;
  isPublic: boolean;
  likes: string[];
  commentCount?: number;
  universityDay?: number;
  audioUrl?: string;
  audioDurationSec?: number;
  imageUrls?: string[];
  commentsEnabled?: boolean;
  postType?: "journal" | "tweet";
};

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function VoiceMessagePlayer({ src, durationSec }: { src: string; durationSec?: number }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentSec, setCurrentSec] = useState(0);
  const [totalSec, setTotalSec] = useState(durationSec ?? 0);

  return (
    <div className="flex items-center gap-3 rounded-2xl bg-sky-50 px-4 py-3 dark:bg-sky-900/20">
      <audio
        ref={audioRef}
        src={src}
        onLoadedMetadata={() => {
          const dur = audioRef.current?.duration ?? 0;
          if (isFinite(dur)) setTotalSec(dur);
        }}
        onTimeUpdate={() => setCurrentSec(audioRef.current?.currentTime ?? 0)}
        onEnded={() => {
          setIsPlaying(false);
          setCurrentSec(0);
          if (audioRef.current) audioRef.current.currentTime = 0;
        }}
      />
      <button
        type="button"
        onClick={() => {
          const audio = audioRef.current;
          if (!audio) return;
          if (isPlaying) {
            audio.pause();
            setIsPlaying(false);
          } else {
            void audio.play();
            setIsPlaying(true);
          }
        }}
        className="flex size-9 shrink-0 items-center justify-center rounded-full bg-sky-500 text-white transition-colors hover:bg-sky-600 active:scale-95"
      >
        {isPlaying ? <Pause className="size-4" /> : <Play className="size-4 translate-x-0.5" />}
      </button>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <input
          type="range"
          min={0}
          max={totalSec || 1}
          step={0.1}
          value={currentSec}
          onChange={(e) => {
            const t = Number(e.target.value);
            setCurrentSec(t);
            if (audioRef.current) audioRef.current.currentTime = t;
          }}
          className="h-1.5 w-full cursor-pointer accent-sky-500"
        />
        <div className="flex justify-between text-[10px] text-slate-500 dark:text-slate-400">
          <span>{formatDuration(Math.floor(currentSec))}</span>
          <span>{formatDuration(Math.floor(totalSec))}</span>
        </div>
      </div>
    </div>
  );
}

type Comment = {
  id: string;
  userId: string;
  userName: string;
  text: string;
  createdAt: string;
};

type AuthorProfile = {
  displayName: string;
  university: string;
  grade: string;
  avatarUrl?: string;
};

const DEMO_AUTHORS: Record<string, AuthorProfile> = {
  demo_tomoya: {
    displayName: "TOMOYA",
    university: "〇〇大学",
    grade: "3",
  },
  demo_yuko: {
    displayName: "YUKO",
    university: "△△大学",
    grade: "2",
  },
};

const DEMO_ITEMS: FeedJournal[] = [
  {
    id: "demo-1",
    userId: "demo_tomoya",
    title: "インターンの振り返り",
    content:
      "今日は初めてのインターンで、チームのMTGに参加した。最初は緊張したけど、質問を1つ準備していたおかげで会話に入れた。\n\n次は、事前に議題を読んで自分の意見を1つ持っていく。",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(),
    isPublic: true,
    likes: [],
  },
  {
    id: "demo-2",
    userId: "demo_yuko",
    title: "今日の学び",
    content:
      "レポートをまとめるとき、結論→根拠→具体例の順にすると読みやすい。友達に見てもらったら反応が良かった。\n\n明日は参考文献の整理も一緒にやる。",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 28).toISOString(),
    isPublic: true,
    likes: [],
  },
];

function toIso(value: unknown): string {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (typeof value === "string") return value;
  return new Date().toISOString();
}

async function fetchAuthorProfile(uid: string): Promise<AuthorProfile | null> {
  const snap = await getDoc(doc(getDb(), "users", uid));
  if (!snap.exists()) return null;
  const d = snap.data() as Record<string, unknown>;
  return {
    displayName: String(d.displayName ?? ""),
    university: String(d.university ?? ""),
    grade: String(d.grade ?? ""),
  };
}

function buildSubtitle(p: AuthorProfile | null): string {
  const uni = (p?.university ?? "").trim();
  const grade = (p?.grade ?? "").trim().replace(/年生$/, "");
  const parts = [uni, grade ? `${grade}年生` : ""].filter(Boolean);
  return parts.join(" ");
}

export default function FeedPage() {
  const { user } = useAuth();
  const { markAllRead } = useCommentNotifications();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"journal" | "dm">("journal");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [dmLoading, setDmLoading] = useState(true);
  const [items, setItems] = useState<FeedJournal[]>([]);
  const [authors, setAuthors] = useState<Record<string, AuthorProfile | null>>(
    {}
  );
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorDetail, setErrorDetail] = useState<{
    code: string;
    projectId: string;
  } | null>(null);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [likingIds, setLikingIds] = useState<Set<string>>(new Set());
  const [editTargetId, setEditTargetId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ title: "", content: "" });
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [tweetOpen, setTweetOpen] = useState(false);
  const [tweetContent, setTweetContent] = useState("");
  const [isTweeting, setIsTweeting] = useState(false);

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleTweetSubmit = async () => {
    if (!user?.uid || !tweetContent.trim()) return;
    setIsTweeting(true);
    try {
      const db = getDb();
      const defaultCommentsEnabled = (() => {
        try {
          const raw = localStorage.getItem("notification_settings");
          if (!raw) return true;
          const p = JSON.parse(raw) as Record<string, unknown>;
          return p.commentsEnabled !== "off";
        } catch { return true; }
      })();
      const ref = await addDoc(collection(db, "journals"), {
        userId: user.uid,
        content: tweetContent.trim(),
        isPublic: true,
        type: "tweet",
        likes: [],
        commentsEnabled: defaultCommentsEnabled,
        createdAt: Timestamp.now(),
      });
      const newItem: FeedJournal = {
        id: ref.id,
        userId: user.uid,
        content: tweetContent.trim(),
        createdAt: new Date().toISOString(),
        isPublic: true,
        likes: [],
        commentsEnabled: defaultCommentsEnabled,
        postType: "tweet",
      };
      setItems((prev) => [newItem, ...prev]);
      setTweetContent("");
      setTweetOpen(false);
    } catch (e) {
      console.error("[feed] failed to post tweet:", e);
    } finally {
      setIsTweeting(false);
    }
  };

  const handleEditClick = (item: FeedJournal) => {
    setEditForm({ title: item.title ?? "", content: item.content });
    setEditTargetId(item.id);
  };

  const handleEditSave = async () => {
    if (!editTargetId) return;
    setIsSavingEdit(true);
    try {
      const db = getDb();
      await updateDoc(doc(db, "journals", editTargetId), {
        title: editForm.title.trim() || null,
        content: editForm.content,
      });
      setItems((prev) =>
        prev.map((i) =>
          i.id === editTargetId
            ? { ...i, title: editForm.title.trim() || undefined, content: editForm.content }
            : i
        )
      );
      setEditTargetId(null);
    } catch (e) {
      console.error("[feed] failed to edit journal:", e);
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleToggleComments = async (item: FeedJournal) => {
    const nextEnabled = item.commentsEnabled === false ? true : false;
    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, commentsEnabled: nextEnabled } : i))
    );
    try {
      const db = getDb();
      await updateDoc(doc(db, "journals", item.id), { commentsEnabled: nextEnabled });
    } catch (e) {
      console.error("[feed] failed to toggle comments:", e);
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, commentsEnabled: item.commentsEnabled } : i))
      );
    }
  };

  const handleDeleteClick = (id: string) => {
    setDeleteTargetId(id);
  };

  const handleDeleteCancel = () => {
    if (!isDeleting) setDeleteTargetId(null);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTargetId) return;
    setIsDeleting(true);
    try {
      const db = getDb();
      await deleteDoc(doc(db, "journals", deleteTargetId));
      setItems((prev) => prev.filter((item) => item.id !== deleteTargetId));
      setDeleteTargetId(null);
    } catch (e) {
      console.error("[feed] failed to delete journal:", e);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleLike = async (journalId: string) => {
    if (!user?.uid) return;
    const item = items.find((i) => i.id === journalId);
    if (!item) return;
    setLikingIds((prev) => new Set(prev).add(journalId));
    const isLiked = item.likes.includes(user.uid);
    const nextLikes = isLiked
      ? item.likes.filter((id) => id !== user.uid)
      : [...item.likes, user.uid];
    setItems((prev) =>
      prev.map((i) =>
        i.id === journalId ? { ...i, likes: nextLikes } : i
      )
    );
    try {
      const db = getDb();
      const ref = doc(db, "journals", journalId);
      if (isLiked) {
        await updateDoc(ref, { likes: arrayRemove(user.uid) });
      } else {
        await updateDoc(ref, { likes: arrayUnion(user.uid) });
      }
    } catch (e) {
      console.error("[feed] failed to toggle like:", e);
      setItems((prev) =>
        prev.map((i) =>
          i.id === journalId ? { ...i, likes: item.likes } : i
        )
      );
    } finally {
      setLikingIds((prev) => {
        const next = new Set(prev);
        next.delete(journalId);
        return next;
      });
    }
  };


  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setErrorDetail(null);
    setIsDemoMode(false);
    try {
      // まずサーバーAPIで取得（クライアントの Firestore ルールに依存しない）
      const res = await fetch("/api/feed/journals", { cache: "no-store" });
      if (res.ok) {
        const data = (await res.json()) as
          | { items?: FeedJournal[]; authors?: Record<string, AuthorProfile> }
          | FeedJournal[];
        const rows = Array.isArray(data) ? data : data.items ?? [];
        const apiAuthors = Array.isArray(data) ? null : data.authors ?? null;
        const filtered = (rows as FeedJournal[]).filter(
          (r) => r && r.userId && r.content
        );
        filtered.sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        setItems(filtered.slice(0, 50));
        // 著者情報は API の authors のみ使用（クライアントで users を読むと permission-denied になるため絶対に呼ばない）
        const nextAuthors: Record<string, AuthorProfile | null> = { ...authors };
        const uids = Array.from(new Set(filtered.map((r) => r.userId))).filter(Boolean);
        for (const uid of uids) {
          if (apiAuthors?.[uid]) {
            nextAuthors[uid] = apiAuthors[uid];
          } else {
            nextAuthors[uid] = { displayName: "ユーザー", university: "", grade: "" };
          }
        }
        setAuthors(nextAuthors);
        return;
      }

      if (res.status === 503) {
        const body = await res.json().catch(() => ({}));
        let msg = typeof body?.error === "string" ? body.error : "サーバーで Firebase Admin が未設定です。";
        if (typeof body?.debug === "string") msg += " " + body.debug;
        setError(msg);
        setErrorDetail({
          code: "service_unavailable",
          projectId:
            typeof process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID === "string"
              ? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
              : "(未設定)",
        });
        if (process.env.NODE_ENV !== "production") {
          setIsDemoMode(true);
          setItems(DEMO_ITEMS);
          setAuthors(
            Object.fromEntries(
              Object.entries(DEMO_AUTHORS).map(([k, v]) => [k, v])
            ) as Record<string, AuthorProfile>
          );
        }
        return;
      }

      // API が 500 などで失敗した場合はクライアントにフォールバックしない（permission-denied を防ぐ）
      const body = await res.json().catch(() => ({}));
      const apiMsg = typeof body?.error === "string" ? body.error : `サーバーエラー (${res.status})`;
      setError(apiMsg);
      setErrorDetail({
        code: "api_error",
        projectId:
          typeof process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID === "string"
            ? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
            : "(未設定)",
      });
      if (process.env.NODE_ENV !== "production") {
        setIsDemoMode(true);
        setItems(DEMO_ITEMS);
        setAuthors(
          Object.fromEntries(
            Object.entries(DEMO_AUTHORS).map(([k, v]) => [k, v])
          ) as Record<string, AuthorProfile>
        );
      }
      return;
    } catch (e) {
      const msg =
        e instanceof Error && typeof e.message === "string"
          ? e.message
          : "読み込みに失敗しました";
      const code =
        e && typeof e === "object" && "code" in e
          ? String((e as { code: unknown }).code)
          : "";
      const projectId =
        typeof process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID === "string"
          ? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
          : "(未設定)";

      console.error("[feed] failed to load public journals:", e);
      console.error(
        "[feed] projectId:",
        projectId,
        "error.code:",
        code || "(なし)"
      );

      if (msg.includes("The query requires an index")) {
        console.warn(
          "[feed] Firestore に複合インデックスが必要です。ブラウザコンソールに表示されている URL を開き、提案されたインデックスを作成してから再読み込みしてください。"
        );
      }

      setError(msg);
      setErrorDetail({ code, projectId });

      // 開発時のUI確認用: Firestoreが落ちたらデモデータで表示
      if (process.env.NODE_ENV !== "production") {
        setIsDemoMode(true);
        setItems(DEMO_ITEMS);
        setAuthors(
          Object.fromEntries(
            Object.entries(DEMO_AUTHORS).map(([k, v]) => [k, v])
          ) as Record<string, AuthorProfile>
        );
      }
    } finally {
      setLoading(false);
    }
  }, [authors]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // フィードを開いたら通知を既読化（Firestoreの初期化完了後に実行するため遅延）
  useEffect(() => {
    const t = setTimeout(() => { void markAllRead(); }, 500);
    return () => clearTimeout(t);
  }, [markAllRead]);

  // DMの会話一覧をリアルタイムで取得
  useEffect(() => {
    if (!user?.uid) {
      setDmLoading(false);
      return;
    }
    let isActive = true;
    const db = getDb();
    const q = query(
      collection(db, "conversations"),
      where("participants", "array-contains", user.uid),
      orderBy("lastMessageAt", "desc")
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        if (!isActive) return;
        const list: Conversation[] = snap.docs.map((d) => {
          const data = d.data() as Record<string, unknown>;
          return {
            id: d.id,
            participants: (data.participants as string[]) ?? [],
            participantNames: (data.participantNames as Record<string, string>) ?? {},
            lastMessage: String(data.lastMessage ?? ""),
            lastMessageAt: toIso(data.lastMessageAt),
          };
        });
        setConversations(list);
        setDmLoading(false);
      },
      () => { if (isActive) setDmLoading(false); }
    );
    return () => {
      isActive = false;
      unsub();
    };
  }, [user?.uid]);


  const empty = !loading && !error && items.length === 0;
  const hasPermissionError = !!error && /missing or insufficient permissions/i.test(error);


  return (
    <div className="flex flex-1 flex-col">
      <header className="sticky top-0 z-20 flex shrink-0 flex-col border-b border-border bg-background/90 backdrop-blur-sm">
        <div className="flex h-12 items-center px-3 sm:h-14 sm:px-4">
          <h1 className="text-base font-semibold sm:text-lg">フィード</h1>
        </div>
        <div className="flex">
          <button
            onClick={() => setActiveTab("journal")}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
              activeTab === "journal"
                ? "border-sky-500 text-sky-600 dark:text-sky-400"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <MessageCircle className="size-4" />
            みんなのジャーナル
          </button>
          <button
            onClick={() => setActiveTab("dm")}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
              activeTab === "dm"
                ? "border-sky-500 text-sky-600 dark:text-sky-400"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <Mail className="size-4" />
            ダイレクトメッセージ
          </button>
        </div>
      </header>

      <main className="flex flex-1 overflow-auto bg-gray-50 dark:bg-slate-950/60">
        {/* DMタブ */}
        {activeTab === "dm" && (
          <div className="mx-auto w-full max-w-2xl">
            {dmLoading && (
              <div className="flex items-center justify-center py-12">
                <div className="text-sm text-muted-foreground">読み込み中...</div>
              </div>
            )}
            {!dmLoading && !user && (
              <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
                <Mail className="size-10 opacity-30" />
                <p className="text-sm">ログインするとDMが確認できます</p>
              </div>
            )}
            {!dmLoading && user && conversations.length === 0 && (
              <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
                <Mail className="size-10 opacity-30" />
                <p className="text-sm">まだメッセージがありません</p>
                <p className="text-xs">ユーザーのプロフィールを開いてDMを送りましょう</p>
              </div>
            )}
            {conversations.map((conv) => {
              const otherId = conv.participants.find((p) => p !== user?.uid) ?? "";
              const otherName = conv.participantNames[otherId] ?? "ユーザー";
              const initial = otherName.charAt(0).toUpperCase();
              return (
                <Link
                  key={conv.id}
                  href={`/messages/${conv.id}`}
                  className="flex items-center gap-3 border-b border-border bg-background px-4 py-4 transition-colors hover:bg-muted/50 sm:px-6"
                >
                  <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-slate-200 text-base font-semibold text-slate-600 dark:bg-slate-700 dark:text-slate-200">
                    {initial}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="truncate text-sm font-semibold text-foreground">{otherName}</p>
                      <span className="shrink-0 text-[11px] text-muted-foreground">
                        {formatDate(conv.lastMessageAt)}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {conv.lastMessage || "メッセージを開始しましょう"}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {/* ジャーナルタブ */}
        {activeTab === "journal" && (
        <div className="min-h-full w-full px-0 py-4 sm:px-0 sm:py-6">
          <div className="mx-auto flex w-full max-w-[600px] flex-col gap-4 px-4 sm:px-0">
            {loading && (
              <div className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
                読み込み中...
              </div>
            )}

            {error && (
              <div className="flex flex-col gap-3 rounded-2xl border border-destructive/40 bg-destructive/10 p-5">
                <p className="text-sm text-destructive">
                  公開ジャーナルの取得に失敗しました。
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {error}
                </p>
                {errorDetail && errorDetail.code !== "service_unavailable" && (
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    プロジェクトID: <code className="rounded bg-muted px-1">{errorDetail.projectId}</code>
                    {errorDetail.code ? (
                      <> ・ エラーコード: <code className="rounded bg-muted px-1">{errorDetail.code}</code></>
                    ) : null}
                    {" — "}
                    Firebase Console でこのプロジェクトを開き、Firestore のルールを公開したか確認してください。
                  </p>
                )}
                {errorDetail?.code === "service_unavailable" && (
                  <div className="flex flex-col gap-2 text-xs text-slate-600 dark:text-slate-300">
                    <p>
                      プロジェクト: <code className="rounded bg-muted px-1">{errorDetail.projectId}</code>
                    </p>
                    <ol className="list-inside list-decimal space-y-1">
                      <li>
                        <a
                          href={
                            errorDetail.projectId && errorDetail.projectId !== "(未設定)"
                              ? `https://console.firebase.google.com/project/${errorDetail.projectId}/settings/serviceaccounts/adminsdk`
                              : "https://console.firebase.google.com/"
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium text-primary underline"
                        >
                          サービスアカウントの鍵を取得
                        </a>
                        →「新しい秘密鍵の生成」で JSON をダウンロード
                      </li>
                      <li>
                        ダウンロードした JSON をプロジェクトのフォルダに置き、<code className="rounded bg-muted px-1">firebase-service-account.json</code> にリネーム（またはそのままのファイル名でも可）
                      </li>
                      <li>
                        <code className="rounded bg-muted px-1">.env.local</code> に 1 行追加:{" "}
                        <code className="rounded bg-muted px-1">FIREBASE_SERVICE_ACCOUNT_KEY_PATH=./firebase-service-account.json</code>
                        （ファイル名を変えた場合はそれに合わせる）
                      </li>
                      <li>開発サーバーを止めて <code className="rounded bg-muted px-1">npm run dev</code> で再起動 → このページで「再読み込み」</li>
                    </ol>
                    <Button variant="secondary" size="sm" className="w-fit gap-2" asChild>
                      <a
                        href={
                          errorDetail.projectId && errorDetail.projectId !== "(未設定)"
                            ? `https://console.firebase.google.com/project/${errorDetail.projectId}/settings/serviceaccounts/adminsdk`
                            : "https://console.firebase.google.com/"
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        サービスアカウント設定を開く
                      </a>
                    </Button>
                  </div>
                )}
                {hasPermissionError && (
                  <div className="flex flex-col gap-2 text-xs text-slate-600 dark:text-slate-300">
                    <p>Firestore のルールが未反映の可能性があります。</p>
                    <ol className="list-inside list-decimal space-y-1">
                      <li>プロジェクトの <code className="rounded bg-muted px-1">firestore.rules</code> を開き、「ここから」～「ここまで」をコピー</li>
                      <li>下のボタンで Firebase のルール画面を開く</li>
                      <li>エディタに貼り付けて「公開」をクリック</li>
                      <li>このページで「再読み込み」を押す</li>
                    </ol>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="w-fit gap-2"
                      asChild
                    >
                      <a
                        href={
                          process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
                            ? `https://console.firebase.google.com/project/${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}/firestore/rules`
                            : "https://console.firebase.google.com/"
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Firebase のルール画面を開く
                      </a>
                    </Button>
                  </div>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={load}
                  className="w-fit gap-2 border-destructive/40 text-destructive hover:bg-destructive/15"
                >
                  <RotateCcw className="size-4" aria-hidden />
                  再読み込み
                </Button>
              </div>
            )}

            {isDemoMode && (
              <div className="rounded-2xl border border-sky-200/70 bg-sky-50/60 p-4 text-xs text-sky-800 dark:border-sky-800/60 dark:bg-sky-950/30 dark:text-sky-200">
                Firestore の取得に失敗したため、現在はデモデータで表示しています（開発環境のみ）。
              </div>
            )}

            {empty && (
              <div className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
                まだ公開ジャーナルがありません。最初の投稿を公開してみましょう。
              </div>
            )}

            {items.map((item) => {
              const author = authors[item.userId] ?? null;
              const name = (author?.displayName ?? "").trim() || "ユーザー";
              const subtitle = buildSubtitle(author);
              const plain = stripHtml(item.content);
              const isExpanded = expandedIds.has(item.id);
              const showToggle = plain.length > 140;
              const initial = name.charAt(0).toUpperCase();
              return (
                <Card
                  key={item.id}
                  onClick={() => router.push(`/feed/${item.id}`)}
                  className="cursor-pointer border border-slate-100 bg-white p-0 shadow-sm transition-shadow hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
                >
                  <CardHeader className="relative px-6 pb-0 pt-5 sm:pt-6">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex min-w-0 flex-1 items-start gap-3">
                        {/* アバター + 名前 → プロフィールへのリンク（デモモード時は無効） */}
                        {isDemoMode ? (
                          <div className="flex min-w-0 flex-1 items-start gap-3">
                            <Avatar className="size-9 shrink-0">
                              <AvatarImage src={author?.avatarUrl} alt={name} />
                              <AvatarFallback className="bg-slate-200 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                                {initial}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-baseline gap-x-2">
                                <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-50">
                                  {name}
                                </p>
                                {subtitle && (
                                  <span className="shrink-0 text-[11px] text-slate-500 dark:text-slate-400">
                                    {subtitle}
                                  </span>
                                )}
                              </div>
                              <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-400 dark:text-slate-500">
                                <span>{formatDate(item.createdAt)}</span>
                                <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${item.postType === "tweet" ? "bg-sky-50 text-sky-500 dark:bg-sky-900/30 dark:text-sky-400" : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"}`}>
                                  {item.postType === "tweet" ? "つぶやき" : "ジャーナル"}
                                </span>
                              </p>
                            </div>
                          </div>
                        ) : (
                          <Link
                            href={`/profile/${item.userId}`}
                            onClick={(e) => e.stopPropagation()}
                            className="flex min-w-0 flex-1 items-start gap-3 hover:opacity-80 transition-opacity"
                          >
                            <Avatar className="size-9 shrink-0">
                              <AvatarImage src={author?.avatarUrl} alt={name} />
                              <AvatarFallback className="bg-slate-200 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                                {initial}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-baseline gap-x-2">
                                <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-50">
                                  {name}
                                </p>
                                {subtitle && (
                                  <span className="shrink-0 text-[11px] text-slate-500 dark:text-slate-400">
                                    {subtitle}
                                  </span>
                                )}
                              </div>
                              <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-400 dark:text-slate-500">
                                <span>{formatDate(item.createdAt)}</span>
                                <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${item.postType === "tweet" ? "bg-sky-50 text-sky-500 dark:bg-sky-900/30 dark:text-sky-400" : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"}`}>
                                  {item.postType === "tweet" ? "つぶやき" : "ジャーナル"}
                                </span>
                              </p>
                            </div>
                          </Link>
                        )}
                      </div>
                      {user?.uid && item.userId === user.uid && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => e.stopPropagation()}
                              className="size-8 shrink-0 rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-300"
                              aria-label="メニューを開く"
                            >
                              <MoreHorizontal className="size-5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={(e) => { e.stopPropagation(); handleEditClick(item); }}
                              className="gap-2"
                            >
                              <Pencil className="size-4" aria-hidden />
                              編集する
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={(e) => { e.stopPropagation(); void handleToggleComments(item); }}
                              className="gap-2"
                            >
                              {item.commentsEnabled === false
                                ? <><MessageCircle className="size-4" aria-hidden />コメントを許可する</>
                                : <><MessageCircleOff className="size-4" aria-hidden />コメントを禁止する</>
                              }
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              variant="destructive"
                              onClick={(e) => { e.stopPropagation(); handleDeleteClick(item.id); }}
                              className="gap-2"
                            >
                              <Trash2 className="size-4" aria-hidden />
                              この記事を削除する
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4 border-t border-slate-100 px-6 pb-5 pt-4 dark:border-slate-800/70">
                    {item.title && (
                      <p className="mb-1 text-sm font-semibold text-slate-900 dark:text-slate-50">
                        {item.title}
                      </p>
                    )}

                    {item.audioUrl ? (
                      <VoiceMessagePlayer src={item.audioUrl} durationSec={item.audioDurationSec} />
                    ) : (
                      <>
                        <p
                          className={cn(
                            "whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-800 dark:text-slate-200",
                            !isExpanded && "line-clamp-4"
                          )}
                        >
                          {plain}
                        </p>

                        {showToggle && (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); toggleExpanded(item.id); }}
                            className="text-xs font-medium text-sky-600 hover:underline dark:text-sky-400"
                          >
                            {isExpanded ? "閉じる" : "もっと見る"}
                          </button>
                        )}
                      </>
                    )}

                    {item.imageUrls && item.imageUrls.length > 0 && (
                      item.imageUrls.length === 1 ? (
                        // 単枚：元の比率を保ちつつ最大サイズを制限
                        <div className="flex justify-center">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={item.imageUrls[0]}
                            alt="画像 1"
                            className="max-h-64 w-auto max-w-full rounded-xl sm:max-h-72"
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>
                      ) : (
                        // 複数枚：グリッド表示（アスペクト比固定）
                        <div className={cn("grid gap-1.5 overflow-hidden rounded-xl", item.imageUrls.length === 2 ? "grid-cols-2" : "grid-cols-3")}>
                          {item.imageUrls.map((url, i) => (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              key={i}
                              src={url}
                              alt={`画像 ${i + 1}`}
                              className="aspect-square w-full rounded-lg object-cover"
                              onClick={(e) => e.stopPropagation()}
                            />
                          ))}
                        </div>
                      )
                    )}

                    <div className="mt-4 flex items-center gap-6 text-xs text-slate-500 dark:text-slate-400">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); void handleLike(item.id); }}
                        disabled={!user || likingIds.has(item.id)}
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full px-1 py-1 transition-colors hover:text-rose-500 disabled:opacity-50",
                          item.likes.includes(user?.uid ?? "")
                            ? "text-rose-500"
                            : "group hover:text-rose-500"
                        )}
                        aria-label={item.likes.includes(user?.uid ?? "") ? "いいねを解除" : "いいね"}
                      >
                        <Heart
                          className={cn(
                            "size-4",
                            item.likes.includes(user?.uid ?? "") && "fill-rose-500"
                          )}
                          aria-hidden
                        />
                        <span className="min-w-[1ch] text-[11px] sm:inline">
                          {item.likes.length}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); router.push(`/feed/${item.id}`); }}
                        className="inline-flex items-center gap-1 rounded-full px-1 py-1 hover:text-sky-500"
                        aria-label="コメント"
                      >
                        <MessageCircle className="size-4" aria-hidden />
                        <span className="min-w-[1ch] text-[11px] sm:inline">
                          {item.commentCount ?? 0}
                        </span>
                      </button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
        )}
      </main>

      {/* つぶやき FAB */}
      {user && activeTab === "journal" && (
        <button
          type="button"
          onClick={() => setTweetOpen(true)}
          className="fixed bottom-24 right-4 z-40 flex size-14 items-center justify-center rounded-full bg-sky-500 text-white shadow-lg transition-transform hover:bg-sky-600 hover:scale-105 active:scale-95 md:bottom-6 md:right-6"
          aria-label="気づきや学びを投稿"
        >
          <Feather className="size-6" />
        </button>
      )}

      {/* つぶやき Dialog */}
      <Dialog open={tweetOpen} onOpenChange={(open) => { if (!isTweeting) { setTweetOpen(open); if (!open) setTweetContent(""); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>気づきや学びを投稿</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-1">
            <Textarea
              placeholder="共有したい学びを書いてみよう！"
              value={tweetContent}
              onChange={(e) => {
                if (e.target.value.length <= 500) setTweetContent(e.target.value);
              }}
              rows={5}
              className="resize-none"
              autoFocus
            />
            <div className={`text-right text-xs ${tweetContent.length >= 480 ? "text-rose-500" : "text-muted-foreground"}`}>
              {tweetContent.length} / 500
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setTweetOpen(false); setTweetContent(""); }} disabled={isTweeting}>
              キャンセル
            </Button>
            <Button onClick={handleTweetSubmit} disabled={isTweeting || !tweetContent.trim()}>
              {isTweeting ? "投稿中…" : "投稿する"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editTargetId} onOpenChange={(open) => !open && !isSavingEdit && setEditTargetId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>投稿を編集</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="edit-title">タイトル（任意）</Label>
              <Input
                id="edit-title"
                value={editForm.title}
                onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="タイトルを入力"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-content">本文</Label>
              <Textarea
                id="edit-content"
                value={editForm.content}
                onChange={(e) => setEditForm((f) => ({ ...f, content: e.target.value }))}
                rows={6}
                placeholder="本文を入力"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTargetId(null)} disabled={isSavingEdit}>
              キャンセル
            </Button>
            <Button onClick={handleEditSave} disabled={isSavingEdit || !editForm.content.trim()}>
              {isSavingEdit ? "保存中…" : "保存する"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!deleteTargetId}
        onOpenChange={(open) => !open && handleDeleteCancel()}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>この投稿を削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              この操作は取り消せません。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>キャンセル</AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
            >
              {isDeleting ? "削除中..." : "削除"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

