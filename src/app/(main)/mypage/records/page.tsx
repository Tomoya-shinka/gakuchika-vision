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
      <main className="flex flex-1 overflow-auto p-6">
        <div className="mx-auto w-full max-w-3xl space-y-6">
          <div className="flex min-h-[52px] flex-col gap-2 rounded-lg border border-dashed border-border bg-muted/20 px-4 py-3">
            <p className="text-xs text-muted-foreground">
              検索バーや日付フィルタを配置するエリア（将来実装）
            </p>
          </div>

          <section>
            <h2 className="mb-4 text-sm font-medium text-muted-foreground">
              保存された記録（新しい順）
            </h2>

            {entries.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-20 text-center">
                <BookOpen className="mb-4 size-12 text-muted-foreground/40" />
                <p className="text-muted-foreground">まだ記録がありません</p>
                <p className="mt-1 text-sm text-muted-foreground">
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
              <ul className="space-y-3">
                {entries.map((entry) => (
                  <li
                    key={entry.id}
                    className="rounded-xl border border-border bg-card px-5 py-4 shadow-sm transition-colors hover:border-border/80 hover:bg-muted/20 hover:shadow-md"
                  >
                    <p className="line-clamp-2 text-base font-medium text-foreground">
                      {getPreview(entry.content, 80)}
                    </p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {formatDate(entry.createdAt)}
                    </p>
                    <details className="mt-3">
                      <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
                        本文を表示
                      </summary>
                      <p className="mt-3 whitespace-pre-wrap border-t border-border pt-3 text-sm leading-relaxed text-foreground/90">
                        {entry.content}
                      </p>
                    </details>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
