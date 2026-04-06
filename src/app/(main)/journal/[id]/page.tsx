"use client";

import { useMemo, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { addDoc, collection, doc, getDoc, updateDoc, Timestamp } from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import { addSnapToSelfAnalysis } from "@/lib/snap-to-self-analysis";
import { ArrowLeft, Loader2, Pause, Play, Sparkles } from "lucide-react";
import { loadEntries, formatDate, stripHtml } from "@/lib/journal";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type SnapItem = { text: string; checked: boolean };
type SavedSnapItem = { text: string; checked: boolean; docId: string };
type SnapDialogStep = "select-save" | "select-post" | "done";

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
  const [snapItems, setSnapItems] = useState<SnapItem[]>([]);
  const [savedSnapItems, setSavedSnapItems] = useState<SavedSnapItem[]>([]);
  const [snapDialogStep, setSnapDialogStep] = useState<SnapDialogStep>("select-save");
  const [isExtracting, setIsExtracting] = useState(false);
  const [isSavingSnap, setIsSavingSnap] = useState(false);
  const [isPostingSnap, setIsPostingSnap] = useState(false);
  const [snapSavedCount, setSnapSavedCount] = useState(0);
  const [snapPostedCount, setSnapPostedCount] = useState(0);

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
    setSnapItems([]);
    setSavedSnapItems([]);
    setSnapDialogStep("select-save");
    setSnapSavedCount(0);
    setSnapPostedCount(0);
    setExtractOpen(true);
    try {
      const res = await fetch("/api/extract-insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: plain }),
      });
      const data = await res.json() as { snaps?: string[]; text?: string; error?: string };
      const texts = data.snaps ?? (data.text ? [data.text] : []);
      setSnapItems(texts.map((t) => ({ text: t, checked: true })));
    } catch {
      setSnapItems([]);
    } finally {
      setIsExtracting(false);
    }
  };

  const handleSnapSave = async () => {
    const selected = snapItems.filter((s) => s.checked && s.text.trim());
    if (!user?.uid || selected.length === 0) return;
    setIsSavingSnap(true);
    try {
      const db = getDb();
      const defaultCommentsEnabled = (() => {
        try { return localStorage.getItem("commentsEnabled") !== "off"; } catch { return true; }
      })();
      const results = await Promise.all(
        selected.map((s) =>
          addDoc(collection(db, "journals"), {
            userId: user.uid,
            content: s.text.trim(),
            isPublic: false,
            type: "snap",
            likes: [],
            commentsEnabled: defaultCommentsEnabled,
            createdAt: Timestamp.now(),
          })
        )
      );
      setSavedSnapItems(selected.map((s, i) => ({ text: s.text.trim(), checked: true, docId: results[i].id })));
      setSnapSavedCount(selected.length);
      setSnapDialogStep("select-post");
      // バックグラウンドで自己分析シートに追加
      if (user?.uid) {
        void Promise.all(selected.map((s) => addSnapToSelfAnalysis(user.uid, s.text.trim())));
      }
    } catch {
      alert("保存に失敗しました。");
    } finally {
      setIsSavingSnap(false);
    }
  };

  const handleSnapPost = async () => {
    const targets = savedSnapItems.filter((s) => s.checked);
    setIsPostingSnap(true);
    try {
      if (targets.length > 0 && user?.uid) {
        const db = getDb();
        await Promise.all(targets.map((s) => updateDoc(doc(db, "journals", s.docId), { isPublic: true })));
      }
      setSnapPostedCount(targets.length);
      setSnapDialogStep("done");
    } catch {
      alert("フィードへの投稿に失敗しました。");
    } finally {
      setIsPostingSnap(false);
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
              href="/mypage"
              className="mt-4 inline-flex text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              My Pageに戻る
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
          href="/mypage"
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

          {entry.content && (
            <p className="mt-3 text-right text-xs text-muted-foreground">
              {stripHtml(entry.content).length.toLocaleString()} 文字
            </p>
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
      <Dialog open={extractOpen} onOpenChange={(open) => { if (!open && !isSavingSnap && !isPostingSnap) { setExtractOpen(false); setSnapItems([]); setSavedSnapItems([]); setSnapDialogStep("select-save"); } }}>
        <DialogContent className="flex max-h-[85vh] flex-col sm:max-w-xl">
          <DialogHeader className="shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="size-4 text-amber-500" />
              {snapDialogStep === "select-save" && "Snapとして保存しますか？"}
              {snapDialogStep === "select-post" && "フィードに投稿しますか？"}
              {snapDialogStep === "done" && "完了"}
            </DialogTitle>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          <div className="space-y-3 py-1">
            {isExtracting ? (
              <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                抽出中…
              </div>
            ) : snapDialogStep === "done" ? (
              <div className="space-y-1 py-6 text-center text-sm">
                <p className="text-emerald-600 dark:text-emerald-400">
                  {snapSavedCount}件のSnapをMyPageに保存しました。
                </p>
                {snapPostedCount > 0 && (
                  <p className="text-muted-foreground">うち{snapPostedCount}件をフィードに投稿しました。</p>
                )}
              </div>
            ) : snapDialogStep === "select-save" ? (
              snapItems.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">抽出に失敗しました。</p>
              ) : (
                <>
                  <p className="text-xs text-muted-foreground">保存するSnapを選択・編集してください。</p>
                  {snapItems.map((item, idx) => (
                    <div key={idx} className="flex gap-3 rounded-lg border border-amber-100 bg-amber-50/40 p-3 dark:border-amber-900/40 dark:bg-amber-950/20">
                      <Checkbox
                        id={`snap-save-${idx}`}
                        checked={item.checked}
                        onCheckedChange={(v) =>
                          setSnapItems((prev) => prev.map((s, i) => i === idx ? { ...s, checked: !!v } : s))
                        }
                        className="mt-1 shrink-0"
                      />
                      <div className="flex-1 space-y-1">
                        <Textarea
                          value={item.text}
                          onChange={(e) =>
                            setSnapItems((prev) => prev.map((s, i) => i === idx ? { ...s, text: e.target.value } : s))
                          }
                          className="min-h-[72px] resize-none border-0 bg-transparent p-0 text-sm shadow-none focus-visible:ring-0"
                          placeholder="気づきを編集…"
                        />
                        <p className={`text-right text-[10px] ${item.text.length >= 480 ? "text-rose-500" : "text-muted-foreground"}`}>
                          {item.text.length} / 500
                        </p>
                      </div>
                    </div>
                  ))}
                </>
              )
            ) : (
              <>
                <p className="text-xs text-muted-foreground">{snapSavedCount}件のSnapを保存しました。フィードに投稿するものを選んでください。</p>
                {savedSnapItems.map((item, idx) => (
                  <div key={idx} className="flex gap-3 rounded-lg border border-sky-100 bg-sky-50/40 p-3 dark:border-sky-900/40 dark:bg-sky-950/20">
                    <Checkbox
                      id={`snap-post-${idx}`}
                      checked={item.checked}
                      onCheckedChange={(v) =>
                        setSavedSnapItems((prev) => prev.map((s, i) => i === idx ? { ...s, checked: !!v } : s))
                      }
                      className="mt-1 shrink-0"
                    />
                    <p className="flex-1 text-sm leading-relaxed">{item.text}</p>
                  </div>
                ))}
              </>
            )}
          </div>
          </div>
          <DialogFooter className="shrink-0">
            {snapDialogStep === "done" ? (
              <Button onClick={() => { setExtractOpen(false); setSnapItems([]); setSavedSnapItems([]); setSnapDialogStep("select-save"); }}>
                閉じる
              </Button>
            ) : snapDialogStep === "select-save" ? (
              <>
                <Button variant="outline" onClick={() => setExtractOpen(false)} disabled={isSavingSnap || isExtracting}>
                  スキップ
                </Button>
                <Button
                  onClick={handleSnapSave}
                  disabled={isSavingSnap || isExtracting || snapItems.every((s) => !s.checked || !s.text.trim())}
                >
                  {(() => { if (isSavingSnap) return "保存中…"; const n = snapItems.filter((s) => s.checked && s.text.trim()).length; return n > 1 ? `保存する（${n}件）` : "保存する"; })()}
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => { setSnapPostedCount(0); setSnapDialogStep("done"); }} disabled={isPostingSnap}>
                  スキップ
                </Button>
                <Button
                  onClick={handleSnapPost}
                  disabled={isPostingSnap || savedSnapItems.every((s) => !s.checked)}
                >
                  {(() => { if (isPostingSnap) return "投稿中…"; const n = savedSnapItems.filter((s) => s.checked).length; return n > 1 ? `フィードに投稿（${n}件）` : "フィードに投稿"; })()}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
