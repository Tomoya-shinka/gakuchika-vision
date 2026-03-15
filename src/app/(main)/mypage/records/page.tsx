"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  loadEntries,
  formatDate,
  getPreview,
  type JournalEntry,
} from "@/lib/journal";
import { ArrowLeft, BookOpen } from "lucide-react";

export default function MyPageRecords() {
  const [entries, setEntries] = useState<JournalEntry[]>([]);

  useEffect(() => {
    // ローカルに保存されたジャーナルを新しい順で取得
    setEntries(loadEntries());
  }, []);

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border bg-background px-4">
        <Link
          href="/mypage"
          className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden />
          戻る
        </Link>
        <h1 className="flex-1 text-center text-lg font-semibold">
          ジャーナルの記録
        </h1>
        <span className="w-14" aria-hidden />
      </header>

      <main className="flex flex-1 overflow-auto bg-[#fafafa] px-4 py-6 dark:bg-slate-950/40 sm:px-6">
        <div className="mx-auto w-full max-w-3xl space-y-6">
          <div className="flex min-h-[52px] flex-col gap-2 rounded-lg border border-dashed border-border bg-muted/20 px-4 py-3">
            <p className="text-xs text-muted-foreground">
              これまで書いたジャーナルを振り返り、自己分析やガクチカ作成に活かしましょう。
            </p>
          </div>

          <section>
            <h2 className="mb-4 text-sm font-medium text-muted-foreground">
              保存された記録（新しい順）
            </h2>

            {entries.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-background py-16 text-center shadow-sm">
                <BookOpen className="mb-4 size-12 text-muted-foreground/40" />
                <p className="text-sm font-medium text-muted-foreground">
                  まだ記録がありません
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  ジャーナルページで書き溜めた記録がここに表示されます
                </p>
                <Link
                  href="/journal"
                  className="mt-4 text-sm font-medium text-primary underline-offset-4 hover:underline"
                >
                  ジャーナルを書く →
                </Link>
              </div>
            ) : (
              <ul className="flex flex-col gap-4">
                {entries.map((entry) => {
                  const preview = getPreview(entry.content, 60);
                  const visibility =
                    entry.visibility === "public" ? "public" : "private";
                  const badgeLabel =
                    visibility === "public" ? "公開" : "非公開";
                  const badgeEmoji =
                    visibility === "public" ? "🌏" : "🔒";

                  return (
                    <li key={entry.id}>
                      <Link
                        href={`/journal/${entry.id}`}
                        className="block rounded-2xl border border-border bg-white px-5 py-4 shadow-sm transition-transform transition-shadow hover:-translate-y-0.5 hover:shadow-md dark:bg-slate-900/80"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                              <p className="truncate text-sm font-semibold text-foreground sm:text-base">
                                {entry.title || preview}
                              </p>
                              <span className="text-xs text-muted-foreground">
                                {formatDate(entry.createdAt)}
                              </span>
                            </div>
                            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground sm:text-sm">
                              {preview}
                            </p>
                          </div>
                          <span
                            className="inline-flex shrink-0 items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[10px] font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                            aria-label={`この記録は${badgeLabel}です`}
                          >
                            <span className="mr-1" aria-hidden>
                              {badgeEmoji}
                            </span>
                            {badgeLabel}
                          </span>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
