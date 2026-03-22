"use client";

import { useCallback, useEffect, useState } from "react";
import {
  collection,
  doc,
  deleteDoc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  addDoc,
  updateDoc,
  arrayUnion,
  arrayRemove,
  Timestamp,
  where,
} from "firebase/firestore";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
import { getDb } from "@/lib/firebase";
import { formatDate, stripHtml } from "@/lib/journal";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/auth-context";
import {
  Heart,
  MessageCircle,
  RotateCcw,
  MoreHorizontal,
  Trash2,
  Send,
} from "lucide-react";
import { useCommentNotifications } from "@/hooks/useCommentNotifications";

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
};

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
  const [expandedCommentId, setExpandedCommentId] = useState<string | null>(null);
  const [comments, setComments] = useState<Record<string, Comment[]>>({});
  const [showAllCommentsId, setShowAllCommentsId] = useState<string | null>(null);
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
  const [likingIds, setLikingIds] = useState<Set<string>>(new Set());
  const [submittingCommentId, setSubmittingCommentId] = useState<string | null>(null);

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
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

  const loadComments = useCallback(async (journalId: string) => {
    try {
      const db = getDb();
      const commentsRef = collection(db, "journals", journalId, "comments");
      const snap = await getDocs(
        query(commentsRef, orderBy("createdAt", "desc"), limit(50))
      );
      const list: Comment[] = snap.docs.map((d) => {
        const data = d.data() as Record<string, unknown>;
        return {
          id: d.id,
          userId: String(data.userId ?? ""),
          userName: String(data.userName ?? "ユーザー"),
          text: String(data.text ?? ""),
          createdAt: toIso(data.createdAt),
        };
      });
      setComments((prev) => ({ ...prev, [journalId]: list }));
    } catch (e) {
      console.error("[feed] failed to load comments:", e);
    }
  }, []);

  const handleCommentClick = (journalId: string) => {
    if (expandedCommentId === journalId) {
      setExpandedCommentId(null);
      return;
    }
    setExpandedCommentId(journalId);
    if (!comments[journalId]) loadComments(journalId);
  };

  const handleCommentInputChange = (journalId: string, value: string) => {
    setCommentInputs((prev) => ({ ...prev, [journalId]: value }));
  };

  const handleSubmitComment = async (journalId: string) => {
    if (!user?.uid) return;
    const text = (commentInputs[journalId] ?? "").trim();
    if (!text) return;
    const displayName =
      (await fetchAuthorProfile(user.uid))?.displayName?.trim() || "ユーザー";
    setSubmittingCommentId(journalId);
    setCommentInputs((prev) => ({ ...prev, [journalId]: "" }));
    try {
      const db = getDb();
      const commentsRef = collection(db, "journals", journalId, "comments");
      const newComment = {
        userId: user.uid,
        userName: displayName,
        text,
        createdAt: Timestamp.now(),
      };
      const ref = await addDoc(commentsRef, newComment);
      const added: Comment = {
        id: ref.id,
        userId: user.uid,
        userName: displayName,
        text,
        createdAt: new Date().toISOString(),
      };
      setComments((prev) => {
        const list = prev[journalId] ?? [];
        return { ...prev, [journalId]: [added, ...list] };
      });
      // 他のユーザーの投稿へのコメントは通知を書き込む
      const journalItem = items.find((i) => i.id === journalId);
      if (journalItem && journalItem.userId !== user.uid) {
        try {
          await addDoc(collection(db, "notifications"), {
            toUserId: journalItem.userId,
            fromUserId: user.uid,
            journalId,
            type: "comment",
            read: false,
            createdAt: Timestamp.now(),
          });
        } catch {
          // 通知書き込み失敗は非クリティカル
        }
      }
    } catch (e) {
      console.error("[feed] failed to post comment:", e);
      setCommentInputs((prev) => ({ ...prev, [journalId]: text }));
    } finally {
      setSubmittingCommentId(null);
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

  // フィードを開いたら通知を既読化
  useEffect(() => {
    markAllRead();
  }, [markAllRead]);

  useEffect(() => {
    if (expandedCommentId && !comments[expandedCommentId]) {
      loadComments(expandedCommentId);
    }
  }, [expandedCommentId, comments, loadComments]);

  const empty = !loading && !error && items.length === 0;

  const COMMENTS_PREVIEW = 3;

  return (
    <div className="flex flex-1 flex-col">
      <header className="sticky top-0 z-20 flex h-12 shrink-0 items-center border-b border-border bg-background/90 px-3 backdrop-blur-sm sm:h-14 sm:px-4">
        <h1 className="text-base font-semibold sm:text-lg">
          みんなのジャーナル
        </h1>
      </header>

      <main className="flex flex-1 overflow-auto bg-gray-50 dark:bg-slate-950/60">
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
                {/missing or insufficient permissions/i.test(error) && (
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
                  className="border border-slate-100 bg-white p-0 shadow-sm dark:border-slate-800 dark:bg-slate-900"
                >
                  <CardHeader className="relative px-6 pb-0 pt-5 sm:pt-6">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                          {initial}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                            <p className="max-w-[50%] truncate text-sm font-semibold text-slate-900 dark:text-slate-50">
                              {name}
                            </p>
                            <span className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                              {subtitle || "プロフィール未設定"}
                            </span>
                          </div>
                          <p className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-slate-400 dark:text-slate-500">
                            <span>{formatDate(item.createdAt)}</span>
                            {typeof item.universityDay === "number" && (
                              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                                大学生活 {item.universityDay}日目
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                      {user?.uid && item.userId === user.uid && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8 shrink-0 rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-300"
                              aria-label="メニューを開く"
                            >
                              <MoreHorizontal className="size-5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              variant="destructive"
                              onClick={() => handleDeleteClick(item.id)}
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
                        onClick={() => toggleExpanded(item.id)}
                        className="text-xs font-medium text-sky-600 hover:underline dark:text-sky-400"
                      >
                        {isExpanded ? "閉じる" : "もっと見る"}
                      </button>
                    )}

                    <div className="mt-4 flex items-center gap-6 text-xs text-slate-500 dark:text-slate-400">
                      <button
                        type="button"
                        onClick={() => handleLike(item.id)}
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
                        onClick={() => handleCommentClick(item.id)}
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full px-1 py-1 hover:text-sky-500",
                          expandedCommentId === item.id && "text-sky-500"
                        )}
                        aria-label="コメント"
                      >
                        <MessageCircle className="size-4" aria-hidden />
                        <span className="min-w-[1ch] text-[11px] sm:inline">
                          {comments[item.id] !== undefined
                            ? comments[item.id].length
                            : (item.commentCount ?? 0)}
                        </span>
                      </button>
                    </div>

                    {expandedCommentId === item.id && (
                      <div className="mt-4 space-y-3 border-t border-slate-100 pt-4 dark:border-slate-800">
                        <div className="flex gap-2">
                          <Input
                            placeholder="コメントを追加..."
                            value={commentInputs[item.id] ?? ""}
                            onChange={(e) =>
                              handleCommentInputChange(item.id, e.target.value)
                            }
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                handleSubmitComment(item.id);
                              }
                            }}
                            className="flex-1"
                          />
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleSubmitComment(item.id)}
                            disabled={
                              !(commentInputs[item.id] ?? "").trim() ||
                              !!submittingCommentId
                            }
                          >
                            <Send className="size-4 text-sky-500" />
                          </Button>
                        </div>
                        <div className="space-y-2">
                          {(comments[item.id] ?? []).length === 0 && (
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              まだコメントがありません
                            </p>
                          )}
                          {(showAllCommentsId === item.id
                            ? comments[item.id] ?? []
                            : (comments[item.id] ?? []).slice(0, COMMENTS_PREVIEW)
                          ).map((c) => (
                            <div
                              key={c.id}
                              className="rounded-md bg-slate-50 px-3 py-2 text-xs dark:bg-slate-800/60"
                            >
                              <p className="font-medium text-slate-700 dark:text-slate-200">
                                {c.userName}
                              </p>
                              <p className="mt-0.5 text-slate-600 dark:text-slate-300">
                                {c.text}
                              </p>
                              <p className="mt-1 text-[10px] text-slate-400 dark:text-slate-500">
                                {formatDate(c.createdAt)}
                              </p>
                            </div>
                          ))}
                          {(comments[item.id] ?? []).length > COMMENTS_PREVIEW &&
                            showAllCommentsId !== item.id && (
                              <button
                                type="button"
                                onClick={() => setShowAllCommentsId(item.id)}
                                className="text-xs font-medium text-sky-600 hover:underline dark:text-sky-400"
                              >
                                すべて見る (
                                {(comments[item.id] ?? []).length}件)
                              </button>
                            )}
                          {showAllCommentsId === item.id &&
                            (comments[item.id] ?? []).length > COMMENTS_PREVIEW && (
                              <button
                                type="button"
                                onClick={() => setShowAllCommentsId(null)}
                                className="text-xs font-medium text-slate-500 hover:underline dark:text-slate-400"
                              >
                                閉じる
                              </button>
                            )}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </main>

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

