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
  Share2,
  RotateCcw,
  MoreHorizontal,
  Trash2,
  Send,
} from "lucide-react";

type FeedJournal = {
  id: string;
  userId: string;
  title?: string;
  content: string;
  createdAt: string;
  isPublic: boolean;
  likes: string[];
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
  const grade = (p?.grade ?? "").trim();
  const parts = [uni, grade ? `${grade}年生` : ""].filter(Boolean);
  return parts.join(" ");
}

export default function FeedPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<FeedJournal[]>([]);
  const [authors, setAuthors] = useState<Record<string, AuthorProfile | null>>(
    {}
  );
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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
    setIsDemoMode(false);
    try {
      console.log(
        "[feed] query:",
        'collection("journals"), where("isPublic","==",true), orderBy("createdAt","desc")'
      );

      const db = getDb();
      const base = collection(db, "journals");

      // 要件: isPublic == true のデータを最新順に取得
      // NOTE: Firestore の複合インデックスが未作成/反映待ちでも動くように、
      // インデックス必須のクエリが落ちたら orderBy なしで取得し、クライアント側でソートする。
      let snap1: Awaited<ReturnType<typeof getDocs>>;
      try {
        snap1 = await getDocs(
          query(
            base,
            where("isPublic", "==", true),
            orderBy("createdAt", "desc"),
            limit(50)
          )
        );
      } catch {
        snap1 = await getDocs(
          query(base, where("isPublic", "==", true), limit(200))
        );
      }

      // 既存データ互換: visibility == "public" しか無い場合のフォールバック
      let snap = snap1;
      if (snap1.size === 0) {
        try {
          snap = await getDocs(
            query(
              base,
              where("visibility", "==", "public"),
              orderBy("createdAt", "desc"),
              limit(50)
            )
          );
        } catch {
          snap = await getDocs(
            query(base, where("visibility", "==", "public"), limit(200))
          );
        }
      }

      const rows: FeedJournal[] = snap.docs.map((d) => {
        const data = d.data() as Record<string, unknown>;
        const isPublic =
          data.isPublic === true || String(data.visibility ?? "") === "public";
        const rawLikes = data.likes;
        const likes = Array.isArray(rawLikes)
          ? (rawLikes as string[]).filter((x) => typeof x === "string")
          : [];
        return {
          id: d.id,
          userId: String(data.userId ?? ""),
          title:
            typeof data.title === "string" && data.title.trim()
              ? data.title.trim()
              : undefined,
          content: String(data.content ?? ""),
          createdAt: toIso(data.createdAt),
          isPublic,
          likes,
        };
      });

      const filtered = rows.filter((r) => r.isPublic && r.userId && r.content);
      filtered.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      setItems(filtered.slice(0, 50));

      console.log(
        "[feed] loaded journals:",
        `raw=${rows.length}, publicFiltered=${filtered.length}`
      );

      // 著者プロフィールをまとめて取得（簡易キャッシュ）
      const uniqueUids = Array.from(new Set(rows.map((r) => r.userId))).filter(
        Boolean
      );
      const nextAuthors: Record<string, AuthorProfile | null> = { ...authors };
      await Promise.all(
        uniqueUids.map(async (uid) => {
          if (uid in nextAuthors) return;
          nextAuthors[uid] = await fetchAuthorProfile(uid);
        })
      );
      setAuthors(nextAuthors);
    } catch (e) {
      const msg =
        e instanceof Error && typeof e.message === "string"
          ? e.message
          : "読み込みに失敗しました";

      console.error("[feed] failed to load public journals:", e);

      if (msg.includes("The query requires an index")) {
        console.warn(
          "[feed] Firestore に複合インデックスが必要です。ブラウザコンソールに表示されている URL を開き、提案されたインデックスを作成してから再読み込みしてください。"
        );
      }

      setError(msg);

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
                          <p className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500">
                            {formatDate(item.createdAt)}
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
                          {(comments[item.id] ?? []).length}
                        </span>
                      </button>
                      <button
                        type="button"
                        className="group inline-flex items-center gap-1 rounded-full px-1 py-1 hover:text-emerald-500"
                        aria-label="シェア（準備中）"
                      >
                        <Share2 className="size-4 group-hover:fill-emerald-500/20" aria-hidden />
                        <span className="hidden text-[11px] sm:inline">0</span>
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

