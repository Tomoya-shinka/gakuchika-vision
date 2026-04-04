"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  doc,
  updateDoc,
  arrayUnion,
  arrayRemove,
} from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import { useAuth } from "@/contexts/auth-context";
import { stripHtml, formatDate } from "@/lib/journal";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  Heart,
  Loader2,
  Pause,
  Play,
} from "lucide-react";

type JournalDetail = {
  id: string;
  userId: string;
  title?: string;
  content: string;
  createdAt: string;
  likes: string[];
  universityDay?: number;
  audioUrl?: string;
  audioDurationSec?: number;
  imageUrls?: string[];
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

export default function FeedDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const [journal, setJournal] = useState<JournalDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [liking, setLiking] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/feed/journals/${id}`, { cache: "no-store" });
      if (!res.ok) { setError("投稿が見つかりません"); return; }
      const data = await res.json() as { journal: JournalDetail };
      setJournal(data.journal);
    } catch {
      setError("読み込みに失敗しました");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

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
      await updateDoc(ref, { likes: isLiked ? arrayRemove(user.uid) : arrayUnion(user.uid) });
    } catch {
      setJournal((prev) => prev ? { ...prev, likes: journal.likes } : prev);
    } finally {
      setLiking(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-1 flex-col">
        <header className="flex h-12 shrink-0 items-center border-b border-border bg-background px-4 sm:h-14">
          <button type="button" onClick={() => router.back()} className="mr-3 flex size-8 items-center justify-center rounded-full hover:bg-muted">
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

  if (error || !journal) {
    return (
      <div className="flex flex-1 flex-col">
        <header className="flex h-12 shrink-0 items-center border-b border-border bg-background px-4 sm:h-14">
          <button type="button" onClick={() => router.back()} className="mr-3 flex size-8 items-center justify-center rounded-full hover:bg-muted">
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

  const plain = stripHtml(journal.content);
  const isLiked = journal.likes.includes(user?.uid ?? "");

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex h-12 shrink-0 items-center border-b border-border bg-background px-4 sm:h-14">
        <button type="button" onClick={() => router.back()} className="mr-3 flex size-8 items-center justify-center rounded-full hover:bg-muted">
          <ArrowLeft className="size-4" />
        </button>
        <h1 className="text-base font-semibold">投稿</h1>
      </header>

      <main className="flex flex-1 flex-col overflow-auto bg-gray-50 dark:bg-slate-950/60">
        <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6">

          {/* 投稿日・大学生活X日目 */}
          <p className="mb-3 text-xs text-slate-400 dark:text-slate-500">
            {formatDate(journal.createdAt)}
            {typeof journal.universityDay === "number" && (
              <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                大学生活 {journal.universityDay}日目
              </span>
            )}
          </p>

          {/* 本文 */}
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

          {/* いいね */}
          <div className="flex items-center gap-6 text-sm text-slate-500 dark:text-slate-400">
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
          </div>
        </div>
      </main>
    </div>
  );
}
