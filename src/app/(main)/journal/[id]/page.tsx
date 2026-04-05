"use client";

import { useMemo, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { addDoc, collection, doc, getDoc, Timestamp } from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import { ArrowLeft, Loader2, Pause, Play, Sparkles } from "lucide-react";
import { loadEntries, formatDate, stripHtml } from "@/lib/journal";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type FirestoreEntry = {
  id: string;
  title?: string;
  content: string;
  createdAt: string;
  isPublic: boolean;
  audioUrl?: string;
  audioDurationSec?: number;
  imageUrls?: string[];
};

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
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
          if (isFinite(dur) && dur > 0) setTotalSec(dur);
          else if (durationSec) setTotalSec(durationSec);
        }}
        onTimeUpdate={() => setCurrentSec(audioRef.current?.currentTime ?? 0)}
        onEnded={() => { setIsPlaying(false); setCurrentSec(0); if (audioRef.current) audioRef.current.currentTime = 0; }}
      />
      <button
        type="button"
        onClick={() => {
          const a = audioRef.current;
          if (!a) return;
          if (isPlaying) { a.pause(); setIsPlaying(false); }
          else { void a.play(); setIsPlaying(true); }
        }}
        className="flex size-10 shrink-0 items-center justify-center rounded-full bg-sky-500 text-white transition-colors hover:bg-sky-600"
        aria-label={isPlaying ? "一時停止" : "再生"}
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
            if (audioRef.current) audioRef.current.currentTime = t;
            setCurrentSec(t);
          }}
          className="h-1.5 w-full cursor-pointer accent-sky-500"
        />
        <div className="flex justify-between text-[11px] text-slate-500">
          <span>{formatDuration(Math.floor(currentSec))}</span>
          <span>{formatDuration(Math.floor(totalSec))}</span>
        </div>
      </div>
    </div>
  );
}

export default function JournalDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const id = String(params.id ?? "");
  const [firestoreEntry, setFirestoreEntry] = useState<FirestoreEntry | null | undefined>(undefined);

  // AI抽出＆フィード投稿
  const [extractOpen, setExtractOpen] = useState(false);
  const [extractedText, setExtractedText] = useState("");
  const [isExtracting, setIsExtracting] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [postDone, setPostDone] = useState(false);

  const localEntry = useMemo(
    () => loadEntries().find((e) => e.id === id),
    [id]
  );

  useEffect(() => {
    if (!id) {
      setFirestoreEntry(null);
      return;
    }
    let cancelled = false;
    getDoc(doc(getDb(), "journals", id))
      .then((snap) => {
        if (cancelled) return;
        if (!snap.exists()) {
          setFirestoreEntry(null);
          return;
        }
        const data = snap.data();
        const createdAt = data.createdAt instanceof Timestamp
          ? data.createdAt.toDate().toISOString()
          : String(data.createdAt ?? "");
        setFirestoreEntry({
          id: snap.id,
          title: data.title != null ? String(data.title) : undefined,
          content: String(data.content ?? ""),
          createdAt,
          isPublic: data.isPublic === true,
          audioUrl: typeof data.audioUrl === "string" && data.audioUrl ? data.audioUrl : undefined,
          audioDurationSec: typeof data.audioDurationSec === "number" ? data.audioDurationSec : undefined,
          imageUrls: Array.isArray(data.imageUrls) ? (data.imageUrls as string[]).filter((u) => typeof u === "string") : undefined,
        });
      })
      .catch(() => {
        if (!cancelled) setFirestoreEntry(null);
      });
    return () => { cancelled = true; };
  }, [id]);

  const entry = useMemo(() => {
    // Firestore データを優先（audioUrl / imageUrls は Firestore が正）
    const base = firestoreEntry ?? (localEntry ? {
      id: localEntry.id,
      title: localEntry.title,
      content: localEntry.content,
      createdAt: localEntry.createdAt,
      isPublic: localEntry.visibility === "public",
      audioUrl: localEntry.audioUrl,
      audioDurationSec: localEntry.audioDurationSec,
      imageUrls: localEntry.imageUrls,
    } as FirestoreEntry : null);

    if (!base) return null;

    return {
      id: base.id,
      title: base.title,
      content: base.content,
      createdAt: base.createdAt,
      visibility: base.isPublic ? "public" : "private",
      isPublic: base.isPublic,
      audioUrl: base.audioUrl,
      audioDurationSec: base.audioDurationSec,
      imageUrls: base.imageUrls,
    };
  }, [localEntry, firestoreEntry]);

  const loading = firestoreEntry === undefined && !localEntry && id.length > 0;
  const notFound = !loading && !entry;

  const handleExtract = async () => {
    if (!entry) return;
    const plain = stripHtml(entry.content);
    setIsExtracting(true);
    setExtractedText("");
    setPostDone(false);
    setExtractOpen(true);
    try {
      const res = await fetch("/api/extract-insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: plain }),
      });
      const data = await res.json() as { text?: string; error?: string };
      setExtractedText(data.text ?? "");
    } catch {
      setExtractedText("抽出に失敗しました。");
    } finally {
      setIsExtracting(false);
    }
  };

  const handlePostToFeed = async () => {
    if (!user?.uid || !extractedText.trim()) return;
    setIsPosting(true);
    try {
      const db = getDb();
      const defaultCommentsEnabled = (() => {
        try {
          const v = localStorage.getItem("commentsEnabled");
          return v !== "off";
        } catch { return true; }
      })();
      await addDoc(collection(db, "journals"), {
        userId: user.uid,
        content: extractedText.trim(),
        isPublic: true,
        type: "snap",
        likes: [],
        commentsEnabled: defaultCommentsEnabled,
        createdAt: Timestamp.now(),
      });
      setPostDone(true);
    } catch {
      alert("投稿に失敗しました。");
    } finally {
      setIsPosting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-1 flex-col">
        <header className="flex h-[52px] shrink-0 items-center gap-2 border-b border-border bg-background px-4">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" aria-hidden />
            戻る
          </button>
          <h1 className="flex-1 text-center text-lg font-semibold">
            ジャーナル詳細
          </h1>
          <span className="w-14" aria-hidden />
        </header>
        <main className="flex flex-1 items-center justify-center px-4 py-10">
          <p className="text-sm text-muted-foreground">読み込み中…</p>
        </main>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="flex flex-1 flex-col">
        <header className="flex h-[52px] shrink-0 items-center gap-2 border-b border-border bg-background px-4">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" aria-hidden />
            戻る
          </button>
          <h1 className="flex-1 text-center text-lg font-semibold">
            ジャーナル詳細
          </h1>
          <span className="w-14" aria-hidden />
        </header>
        <main className="flex flex-1 items-center justify-center px-4 py-10">
          <div className="max-w-md rounded-2xl border border-border bg-card px-6 py-8 text-center shadow-sm">
            <p className="text-sm text-muted-foreground">
              指定されたジャーナルが見つかりませんでした。
            </p>
            <Link
              href="/mypage/records"
              className="mt-4 inline-flex text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              ジャーナルの記録一覧に戻る
            </Link>
          </div>
        </main>
      </div>
    );
  }

  if (!entry) return null;

  const badgeLabel = entry.isPublic ? "公開" : "非公開";
  const badgeEmoji = entry.isPublic ? "🌏" : "🔒";
  const isHtml = entry.content.trim().startsWith("<");

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex h-[52px] shrink-0 items-center gap-2 border-b border-border bg-background px-4">
        <Link
          href="/mypage/records"
          className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden />
          一覧に戻る
        </Link>
        <h1 className="flex-1 text-center text-lg font-semibold">
          ジャーナル詳細
        </h1>
        <span className="w-14" aria-hidden />
      </header>

      <main className="flex flex-1 overflow-auto bg-[#fafafa] px-4 py-6 dark:bg-slate-950/40 sm:px-6">
        <article className="mx-auto w-full max-w-2xl rounded-2xl border border-border bg-white px-5 py-6 shadow-sm dark:bg-slate-900/80 sm:px-8 sm:py-8">
          <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-semibold leading-snug text-foreground sm:text-xl">
                {entry.title?.trim() || "タイトル未設定のジャーナル"}
              </h2>
              <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
                {formatDate(entry.createdAt)}
              </p>
            </div>
            <span className="inline-flex shrink-0 items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
              <span className="mr-1" aria-hidden>
                {badgeEmoji}
              </span>
              {badgeLabel}
            </span>
          </header>

          {entry.audioUrl && (
            <div className="mb-5">
              <VoicePlayer src={entry.audioUrl} durationSec={entry.audioDurationSec} />
            </div>
          )}

          {entry.content && (
            <div className="prose-journal text-sm leading-relaxed text-foreground/90 dark:prose-invert [&_ul]:list-disc [&_ol]:list-decimal">
              {isHtml ? (
                <div dangerouslySetInnerHTML={{ __html: entry.content }} />
              ) : (
                <p className="whitespace-pre-wrap">{entry.content}</p>
              )}
            </div>
          )}

          {entry.imageUrls && entry.imageUrls.length > 0 && (
            <div className={`mt-5 grid gap-2 overflow-hidden rounded-xl ${entry.imageUrls.length === 1 ? "grid-cols-1" : entry.imageUrls.length === 2 ? "grid-cols-2" : "grid-cols-3"}`}>
              {entry.imageUrls.map((url, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={i} src={url} alt={`画像 ${i + 1}`} className="aspect-square w-full rounded-lg object-cover" />
              ))}
            </div>
          )}

          {/* AI抽出ボタン（ログイン済み・長文のみ表示） */}
          {user && stripHtml(entry.content).length > 150 && (
            <div className="mt-6 border-t border-slate-100 pt-5 dark:border-slate-800">
              <Button
                variant="outline"
                size="sm"
                className="gap-2 text-xs"
                onClick={handleExtract}
              >
                <Sparkles className="size-3.5 text-amber-500" />
                AIで気づきを抽出してフィードに投稿
              </Button>
            </div>
          )}
        </article>
      </main>

      {/* 抽出＆投稿ダイアログ */}
      <Dialog open={extractOpen} onOpenChange={(open) => { if (!isPosting) { setExtractOpen(open); if (!open) setPostDone(false); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="size-4 text-amber-500" />
              AIで抽出した気づき
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-1">
            {isExtracting ? (
              <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                抽出中…
              </div>
            ) : postDone ? (
              <p className="py-6 text-center text-sm text-emerald-600 dark:text-emerald-400">
                フィードに投稿しました！
              </p>
            ) : (
              <>
                <p className="text-xs text-muted-foreground">
                  抽出した内容を確認・編集してからフィードに投稿できます。
                </p>
                <Textarea
                  value={extractedText}
                  onChange={(e) => setExtractedText(e.target.value)}
                  className="min-h-[100px] resize-none text-sm"
                  placeholder="抽出中…"
                />
                <div className={`text-right text-xs ${extractedText.length >= 480 ? "text-rose-500" : "text-muted-foreground"}`}>
                  {extractedText.length} / 500
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            {postDone ? (
              <Button onClick={() => { setExtractOpen(false); setPostDone(false); }}>
                閉じる
              </Button>
            ) : (
              <>
                <Button variant="outline" onClick={() => setExtractOpen(false)} disabled={isPosting || isExtracting}>
                  キャンセル
                </Button>
                <Button
                  onClick={handlePostToFeed}
                  disabled={isPosting || isExtracting || !extractedText.trim()}
                >
                  {isPosting ? "投稿中…" : "フィードに投稿"}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
