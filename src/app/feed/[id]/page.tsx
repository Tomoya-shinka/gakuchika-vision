"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  collection,
  doc,
  getDoc,
  addDoc,
  updateDoc,
  arrayUnion,
  arrayRemove,
  Timestamp,
} from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import { useAuth } from "@/contexts/auth-context";
import { stripHtml, formatDate } from "@/lib/journal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  Heart,
  Loader2,
  MessageCircle,
  Pause,
  Play,
  Send,
} from "lucide-react";

type JournalDetail = {
  id: string;
  userId: string;
  title?: string;
  content: string;
  createdAt: string;
  likes: string[];
  commentCount: number;
  universityDay?: number;
  audioUrl?: string;
  audioDurationSec?: number;
  imageUrls?: string[];
};

type AuthorProfile = {
  displayName: string;
  university: string;
  grade: string;
  avatarUrl?: string;
  commentsEnabled?: boolean;
};

type Comment = {
  id: string;
  userId: string;
  userName: string;
  text: string;
  createdAt: string;
};

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function VoicePlayer({ src, durationSec }: { src: string; durationSec?: number }) {
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
          if (isPlaying) { audio.pause(); setIsPlaying(false); }
          else { void audio.play(); setIsPlaying(true); }
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
        <div className="flex justify-between text-[10px] text-slate-400">
          <span>{formatDuration(Math.floor(currentSec))}</span>
          <span>{formatDuration(Math.floor(totalSec))}</span>
        </div>
      </div>
    </div>
  );
}

function buildSubtitle(author: AuthorProfile | null): string {
  const uni = (author?.university ?? "").trim();
  const grade = (author?.grade ?? "").trim().replace(/年生$/, "");
  return [uni, grade ? `${grade}年生` : ""].filter(Boolean).join(" ");
}

export default function FeedDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const [journal, setJournal] = useState<JournalDetail | null>(null);
  const [author, setAuthor] = useState<AuthorProfile | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [commentInput, setCommentInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [liking, setLiking] = useState(false);

  // データ取得
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/feed/journals/${id}`, { cache: "no-store" });
      if (!res.ok) {
        setError("投稿が見つかりません");
        return;
      }
      const data = await res.json() as {
        journal: JournalDetail;
        author: AuthorProfile;
        comments: Comment[];
      };
      setJournal(data.journal);
      setAuthor(data.author);
      setComments(data.comments);
    } catch {
      setError("読み込みに失敗しました");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // いいね（楽観的更新）
  const handleLike = async () => {
    if (!user?.uid || !journal || liking) return;
    setLiking(true);
    const isLiked = journal.likes.includes(user.uid);
    const nextLikes = isLiked
      ? journal.likes.filter((uid) => uid !== user.uid)
      : [...journal.likes, user.uid];
    setJournal((prev) => prev ? { ...prev, likes: nextLikes } : prev);
    try {
      const db = getDb();
      const ref = doc(db, "journals", journal.id);
      if (isLiked) {
        await updateDoc(ref, { likes: arrayRemove(user.uid) });
      } else {
        await updateDoc(ref, { likes: arrayUnion(user.uid) });
      }
    } catch {
      // ロールバック
      setJournal((prev) => prev ? { ...prev, likes: journal.likes } : prev);
    } finally {
      setLiking(false);
    }
  };

  // コメント投稿
  const handleSubmitComment = async () => {
    if (!user?.uid || !journal) return;
    const text = commentInput.trim();
    if (!text || submitting) return;
    setSubmitting(true);
    setCommentInput("");

    // 投稿者名取得（Firestoreのusersドキュメントから）
    let displayName = "ユーザー";
    try {
      const snap = await getDoc(doc(getDb(), "users", user.uid));
      const d = snap.data() as Record<string, unknown> | undefined;
      displayName = typeof d?.displayName === "string" ? d.displayName : "ユーザー";
    } catch {
      // silent
    }

    try {
      const db = getDb();
      const commentsRef = collection(db, "journals", journal.id, "comments");
      const ref = await addDoc(commentsRef, {
        userId: user.uid,
        userName: displayName,
        text,
        createdAt: Timestamp.now(),
      });
      const added: Comment = {
        id: ref.id,
        userId: user.uid,
        userName: displayName,
        text,
        createdAt: new Date().toISOString(),
      };
      setComments((prev) => [added, ...prev]);

      // 通知（自分以外の投稿）
      if (journal.userId !== user.uid) {
        try {
          await addDoc(collection(db, "notifications"), {
            toUserId: journal.userId,
            fromUserId: user.uid,
            journalId: journal.id,
            type: "comment",
            read: false,
            createdAt: Timestamp.now(),
          });
        } catch {
          // silent
        }
      }
    } catch {
      setCommentInput(text); // 失敗時は入力欄を復元
    } finally {
      setSubmitting(false);
    }
  };

  // ローディング
  if (loading) {
    return (
      <div className="flex flex-1 flex-col">
        <header className="flex h-12 shrink-0 items-center border-b border-border bg-background px-4 sm:h-14">
          <button
            type="button"
            onClick={() => router.back()}
            className="mr-3 flex size-8 items-center justify-center rounded-full hover:bg-muted"
          >
            <ArrowLeft className="size-4" />
          </button>
          <h1 className="text-base font-semibold">投稿</h1>
        </header>
        <main className="flex flex-1 items-center justify-center">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </main>
      </div>
    );
  }

  // エラー
  if (error || !journal) {
    return (
      <div className="flex flex-1 flex-col">
        <header className="flex h-12 shrink-0 items-center border-b border-border bg-background px-4 sm:h-14">
          <button
            type="button"
            onClick={() => router.back()}
            className="mr-3 flex size-8 items-center justify-center rounded-full hover:bg-muted"
          >
            <ArrowLeft className="size-4" />
          </button>
          <h1 className="text-base font-semibold">投稿</h1>
        </header>
        <main className="flex flex-1 items-center justify-center">
          <p className="text-sm text-muted-foreground">{error ?? "投稿が見つかりません"}</p>
        </main>
      </div>
    );
  }

  const name = author?.displayName || "ユーザー";
  const initial = name.charAt(0).toUpperCase();
  const subtitle = buildSubtitle(author);
  const plain = stripHtml(journal.content);
  const isLiked = journal.likes.includes(user?.uid ?? "");

  return (
    <div className="flex flex-1 flex-col">
      {/* ヘッダー */}
      <header className="flex h-12 shrink-0 items-center border-b border-border bg-background px-4 sm:h-14">
        <button
          type="button"
          onClick={() => router.back()}
          className="mr-3 flex size-8 items-center justify-center rounded-full hover:bg-muted"
        >
          <ArrowLeft className="size-4" />
        </button>
        <h1 className="text-base font-semibold">投稿</h1>
      </header>

      <main className="flex flex-1 flex-col overflow-auto bg-gray-50 dark:bg-slate-950/60">
        <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6">

          {/* 著者セクション */}
          <div className="mb-4 flex items-start gap-3">
            <Link
              href={`/profile/${journal.userId}`}
              className="transition-opacity hover:opacity-80"
            >
              <Avatar className="size-10 shrink-0">
                <AvatarImage src={author?.avatarUrl} alt={name} />
                <AvatarFallback className="bg-slate-200 text-sm font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                  {initial}
                </AvatarFallback>
              </Avatar>
            </Link>
            <div className="min-w-0 flex-1">
              <Link
                href={`/profile/${journal.userId}`}
                className="text-sm font-semibold text-slate-900 hover:underline dark:text-slate-50"
              >
                {name}
              </Link>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                {subtitle && <span>{subtitle}</span>}
                <span>{formatDate(journal.createdAt)}</span>
                {typeof journal.universityDay === "number" && (
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                    大学生活 {journal.universityDay}日目
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* ジャーナル本文 */}
          <div className="mb-4 rounded-xl bg-white px-5 py-4 shadow-sm dark:bg-slate-900">
            {journal.title && (
              <p className="mb-2 text-base font-semibold text-slate-900 dark:text-slate-50">
                {journal.title}
              </p>
            )}
            {journal.audioUrl ? (
              <VoicePlayer src={journal.audioUrl} durationSec={journal.audioDurationSec} />
            ) : (
              <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-800 dark:text-slate-200">
                {plain}
              </p>
            )}
            {journal.imageUrls && journal.imageUrls.length > 0 && (
              <div className={`mt-3 grid gap-1.5 overflow-hidden rounded-xl ${journal.imageUrls.length === 1 ? "grid-cols-1" : journal.imageUrls.length === 2 ? "grid-cols-2" : "grid-cols-3"}`}>
                {journal.imageUrls.map((url, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={i} src={url} alt={`画像 ${i + 1}`} className="aspect-square w-full rounded-lg object-cover" />
                ))}
              </div>
            )}
          </div>

          {/* アクションバー（いいね・コメント数） */}
          <div className="mb-4 flex items-center gap-6 border-b border-slate-100 pb-4 text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400">
            <button
              type="button"
              onClick={handleLike}
              disabled={!user || liking}
              className={cn(
                "inline-flex items-center gap-1.5 transition-colors hover:text-rose-500 disabled:opacity-50",
                isLiked && "text-rose-500"
              )}
              aria-label={isLiked ? "いいねを解除" : "いいね"}
            >
              <Heart className={cn("size-5", isLiked && "fill-rose-500")} aria-hidden />
              <span>{journal.likes.length}</span>
            </button>
            <span className="inline-flex items-center gap-1.5">
              <MessageCircle className="size-5" aria-hidden />
              <span>{comments.length}</span>
            </span>
          </div>

          {/* コメント入力欄 */}
          {user && (
            author?.commentsEnabled === false ? (
              <p className="mb-5 rounded-lg bg-muted/60 px-4 py-3 text-center text-sm text-muted-foreground">
                この投稿へのコメントは受け付けていません
              </p>
            ) : (
              <div className="mb-5 flex gap-2">
                <Input
                  placeholder="コメントを追加..."
                  value={commentInput}
                  onChange={(e) => setCommentInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void handleSubmitComment();
                    }
                  }}
                  className="flex-1 text-sm"
                />
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => void handleSubmitComment()}
                  disabled={!commentInput.trim() || submitting}
                >
                  {submitting
                    ? <Loader2 className="size-4 animate-spin" />
                    : <Send className="size-4 text-sky-500" />}
                </Button>
              </div>
            )
          )}

          {/* コメント一覧 */}
          <div className="space-y-3">
            {comments.length === 0 ? (
              <p className="py-4 text-center text-sm text-slate-400 dark:text-slate-500">
                まだコメントがありません
              </p>
            ) : (
              comments.map((c) => (
                <div
                  key={c.id}
                  className="flex gap-3 rounded-xl bg-white px-4 py-3 shadow-sm dark:bg-slate-900"
                >
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                    {c.userName.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                      <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                        {c.userName}
                      </p>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500">
                        {formatDate(c.createdAt)}
                      </p>
                    </div>
                    <p className="mt-0.5 break-words text-sm text-slate-600 dark:text-slate-300">
                      {c.text}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
