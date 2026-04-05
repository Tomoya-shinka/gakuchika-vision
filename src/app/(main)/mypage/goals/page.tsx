"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  loadGoals,
  formatUpdatedAt,
  formatDeadlineShort,
  type GoalsData,
} from "@/lib/goals";
import { Target, Flag, Calendar, Pencil, ArrowLeft } from "lucide-react";

export default function MyPageGoals() {
  const [data, setData] = useState<GoalsData | null>(null);

  const load = useCallback(() => {
    setData(loadGoals());
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (data == null) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <header className="flex h-[52px] shrink-0 items-center gap-2 border-b border-border bg-background px-4">
          <Link
            href="/mypage"
            className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" aria-hidden />
            戻る
          </Link>
          <h1 className="flex-1 text-center text-lg font-semibold">
            あなたのゴール
          </h1>
          <span className="w-14" aria-hidden />
        </header>
        <main className="flex flex-1 items-center justify-center overflow-hidden p-4">
          <p className="text-sm text-muted-foreground">読み込み中...</p>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex h-[52px] shrink-0 items-center justify-between gap-2 border-b border-border bg-background px-4">
        <Link
          href="/mypage"
          className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden />
          戻る
        </Link>
        <h1 className="flex-1 text-center text-base font-semibold">
          あなたのゴール
        </h1>
        <div className="flex w-14 justify-end" />
      </header>
      <main className="flex min-h-0 flex-1 flex-col overflow-auto bg-background px-4 pt-6 pb-32 sm:px-6 sm:pb-6">
        <div className="mx-auto flex w-full max-w-2xl flex-col items-stretch space-y-8">
          {/* 長期ビジョン（卒業後の姿） */}
          {(() => {
            const item = data.longTermVision;
            const isEmpty = !item.content.trim();
            return (
              <Link href="/mypage/goals/edit/long" className="block">
                <Card
                  className={`overflow-hidden transition-colors ${
                    isEmpty
                      ? "cursor-pointer border-dashed border-slate-300 bg-transparent opacity-70 hover:border-primary hover:bg-sky-50/50 dark:border-slate-600 dark:hover:border-primary dark:hover:bg-sky-950/20"
                      : "cursor-pointer border-border/60 bg-card shadow-sm hover:border-primary/30"
                  }`}
                >
                  <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 px-8 pb-2 pt-8">
                    <div className="flex min-w-0 items-center gap-2">
                      <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-sky-100 dark:bg-sky-900/40">
                        <Target className="size-3.5 text-sky-600 dark:text-sky-400" />
                      </div>
                      <CardTitle className="truncate text-base font-medium">
                        長期ビジョン（卒業後の姿）
                      </CardTitle>
                    </div>
                    {!isEmpty && (
                      <Pencil className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                    )}
                  </CardHeader>
                  <CardContent className="space-y-2 px-8 pb-8 pt-0">
                    <p className="line-clamp-3 whitespace-pre-wrap font-semibold leading-relaxed text-foreground">
                      {item.content || (
                        <span className="font-normal text-muted-foreground">
                          クリックして目標を入力してください
                        </span>
                      )}
                    </p>
                    {!isEmpty && item.image.trim() && (
                      <p className="line-clamp-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                        {item.image}
                      </p>
                    )}
                    <div className="flex min-w-0 items-end justify-between gap-2 pt-1">
                      <span className="min-w-0 flex-1">
                        {item.updatedAt && !item.deadline && (
                          <p className="text-xs text-muted-foreground">
                            {formatUpdatedAt(item.updatedAt)}
                          </p>
                        )}
                      </span>
                      {item.deadline && (
                        <p className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                          <Calendar className="size-3.5" aria-hidden />
                          期限：{formatDeadlineShort(item.deadline)}
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })()}

          {/* 1年後の目標 */}
          {(() => {
            const item = data.oneYearGoal;
            const isEmpty = !item.content.trim();
            return (
              <Link href="/mypage/goals/edit/year" className="block">
                <Card
                  className={`overflow-hidden transition-colors ${
                    isEmpty
                      ? "cursor-pointer border-dashed border-slate-300 bg-transparent opacity-70 hover:border-primary hover:bg-sky-50/50 dark:border-slate-600 dark:hover:border-primary dark:hover:bg-sky-950/20"
                      : "cursor-pointer border-border/60 bg-card shadow-sm hover:border-primary/30"
                  }`}
                >
                  <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 px-8 pb-2 pt-8">
                    <div className="flex min-w-0 items-center gap-2">
                      <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-sky-100 dark:bg-sky-900/40">
                        <Flag className="size-3.5 text-sky-600 dark:text-sky-400" />
                      </div>
                      <CardTitle className="truncate text-base font-medium">1年後の目標</CardTitle>
                    </div>
                    {!isEmpty && (
                      <Pencil className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                    )}
                  </CardHeader>
                  <CardContent className="space-y-2 px-8 pb-8 pt-0">
                    <p className="line-clamp-3 whitespace-pre-wrap font-semibold leading-relaxed text-foreground">
                      {item.content || (
                        <span className="font-normal text-muted-foreground">
                          クリックして目標を入力してください
                        </span>
                      )}
                    </p>
                    {!isEmpty && item.image.trim() && (
                      <p className="line-clamp-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                        {item.image}
                      </p>
                    )}
                    <div className="flex min-w-0 items-end justify-between gap-2 pt-1">
                      <span className="min-w-0 flex-1">
                        {item.updatedAt && !item.deadline && (
                          <p className="text-xs text-muted-foreground">
                            {formatUpdatedAt(item.updatedAt)}
                          </p>
                        )}
                      </span>
                      {item.deadline && (
                        <p className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                          <Calendar className="size-3.5" aria-hidden />
                          期限：{formatDeadlineShort(item.deadline)}
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })()}

          {/* 1ヶ月後の目標 */}
          {(() => {
            const item = data.oneMonthGoal;
            const isEmpty = !item.content.trim();
            return (
              <Link href="/mypage/goals/edit/month" className="block">
                <Card
                  className={`overflow-hidden transition-colors ${
                    isEmpty
                      ? "cursor-pointer border-dashed border-slate-300 bg-transparent opacity-70 hover:border-primary hover:bg-sky-50/50 dark:border-slate-600 dark:hover:border-primary dark:hover:bg-sky-950/20"
                      : "cursor-pointer border-border/60 bg-card shadow-sm hover:border-primary/30"
                  }`}
                >
                  <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 px-8 pb-2 pt-8">
                    <div className="flex min-w-0 items-center gap-2">
                      <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-sky-100 dark:bg-sky-900/40">
                        <Calendar className="size-3.5 text-sky-600 dark:text-sky-400" />
                      </div>
                      <CardTitle className="truncate text-base font-medium">1ヶ月後の目標</CardTitle>
                    </div>
                    {!isEmpty && (
                      <Pencil className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                    )}
                  </CardHeader>
                  <CardContent className="space-y-2 px-8 pb-8 pt-0">
                    <p className="line-clamp-3 whitespace-pre-wrap font-semibold leading-relaxed text-foreground">
                      {item.content || (
                        <span className="font-normal text-muted-foreground">
                          クリックして目標を入力してください
                        </span>
                      )}
                    </p>
                    {!isEmpty && item.image.trim() && (
                      <p className="line-clamp-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                        {item.image}
                      </p>
                    )}
                    <div className="flex min-w-0 items-end justify-between gap-2 pt-1">
                      <span className="min-w-0 flex-1">
                        {item.updatedAt && !item.deadline && (
                          <p className="text-xs text-muted-foreground">
                            {formatUpdatedAt(item.updatedAt)}
                          </p>
                        )}
                      </span>
                      {item.deadline && (
                        <p className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                          <Calendar className="size-3.5" aria-hidden />
                          期限：{formatDeadlineShort(item.deadline)}
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })()}
        </div>
      </main>
    </div>
  );
}
