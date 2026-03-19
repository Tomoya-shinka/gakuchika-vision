"use client";

import { useMemo, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { doc, getDoc, Timestamp } from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import { ArrowLeft } from "lucide-react";
import { loadEntries, formatDate } from "@/lib/journal";

type FirestoreEntry = {
  id: string;
  title?: string;
  content: string;
  createdAt: string;
  isPublic: boolean;
};

export default function JournalDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = String(params.id ?? "");
  const [firestoreEntry, setFirestoreEntry] = useState<FirestoreEntry | null | undefined>(undefined);

  const localEntry = useMemo(
    () => loadEntries().find((e) => e.id === id),
    [id]
  );

  useEffect(() => {
    if (localEntry || !id) {
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
        });
      })
      .catch(() => {
        if (!cancelled) setFirestoreEntry(null);
      });
    return () => { cancelled = true; };
  }, [id, localEntry]);

  const entry = useMemo(() => {
    if (localEntry) {
      return {
        id: localEntry.id,
        title: localEntry.title,
        content: localEntry.content,
        createdAt: localEntry.createdAt,
        visibility: localEntry.visibility,
        isPublic: localEntry.visibility === "public",
      };
    }
    if (firestoreEntry) {
      return {
        id: firestoreEntry.id,
        title: firestoreEntry.title,
        content: firestoreEntry.content,
        createdAt: firestoreEntry.createdAt,
        visibility: firestoreEntry.isPublic ? "public" : "private",
        isPublic: firestoreEntry.isPublic,
      };
    }
    return null;
  }, [localEntry, firestoreEntry]);

  const loading = localEntry === undefined && firestoreEntry === undefined && id.length > 0;
  const notFound = !loading && !entry;

  if (loading) {
    return (
      <div className="flex flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border bg-background px-4">
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
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border bg-background px-4">
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
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border bg-background px-4">
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

          <div className="prose-journal text-sm leading-relaxed text-foreground/90 dark:prose-invert [&_ul]:list-disc [&_ol]:list-decimal">
            {isHtml ? (
              <div
                dangerouslySetInnerHTML={{ __html: entry.content }}
              />
            ) : (
              <p className="whitespace-pre-wrap">{entry.content}</p>
            )}
          </div>
        </article>
      </main>
    </div>
  );
}
