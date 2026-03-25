"use client";

import { useEffect, useRef, useState, type ComponentType } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { loadEntries, computeJournalStats } from "@/lib/journal";
import { loadGoals, type GoalsData } from "@/lib/goals";
import { loadProfile, getGraduationTargetISO } from "@/lib/user-profile";
import { cn } from "@/lib/utils";
import {
  collection,
  query,
  where,
  onSnapshot,
} from "firebase/firestore";
import { useAuth } from "@/contexts/auth-context";
import { getDb } from "@/lib/firebase";
import {
  BookOpen,
  CalendarDays,
  Flame,
  FileText,
  Target,
  Flag,
  Calendar,
  ArrowLeftRight,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

const DEFAULT_GRADUATION_DATE = "2028-03-31";
const DEFAULT_ENROLLMENT_DATE = "2024-04-01"; // プロフィール未設定時のフォールバック
const AVERAGE_LIFESPAN_YEARS = 84; // 日本人の平均寿命（男女平均）

interface CountdownParts {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

function getCountdownParts(graduationDate: string): CountdownParts {
  const targetISO = getGraduationTargetISO(graduationDate);
  const target = new Date(targetISO).getTime();
  const now = Date.now();
  const diff = Math.max(0, target - now);
  const days = Math.floor(diff / 86_400_000);
  const hours = Math.floor((diff % 86_400_000) / 3_600_000);
  const minutes = Math.floor((diff % 3_600_000) / 60_000);
  const seconds = Math.floor((diff % 60_000) / 1_000);
  return { days, hours, minutes, seconds };
}

function getLifeCountdownParts(birthDate: string): CountdownParts {
  if (!birthDate) return { days: 0, hours: 0, minutes: 0, seconds: 0 };
  const target = new Date(birthDate);
  target.setFullYear(target.getFullYear() + AVERAGE_LIFESPAN_YEARS);
  const diff = Math.max(0, target.getTime() - Date.now());
  return {
    days: Math.floor(diff / 86_400_000),
    hours: Math.floor((diff % 86_400_000) / 3_600_000),
    minutes: Math.floor((diff % 3_600_000) / 60_000),
    seconds: Math.floor((diff % 60_000) / 1_000),
  };
}

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

function getProgressPercent(graduationDate: string, enrollmentDate: string): number {
  const start = new Date(enrollmentDate || DEFAULT_ENROLLMENT_DATE).getTime();
  const end = new Date(graduationDate).getTime();
  const now = Date.now();
  const total = end - start;
  const elapsed = now - start;
  return Math.min(100, Math.max(0, (elapsed / total) * 100));
}

function getLifeProgressPercent(birthDate: string): number {
  if (!birthDate) return 0;
  const birth = new Date(birthDate).getTime();
  const death = new Date(birthDate);
  death.setFullYear(death.getFullYear() + AVERAGE_LIFESPAN_YEARS);
  const total = death.getTime() - birth;
  return Math.min(100, Math.max(0, ((Date.now() - birth) / total) * 100));
}

type GoalsSlide = {
  key: string;
  title: string;
  icon: ComponentType<{ className?: string }>;
  content: string;
  empty: string;
};

/** 目標カルーセル（無限ループ：末尾に先頭クローンを追加し常に右スクロール） */
function GoalsCarousel({ slides, compact }: { slides: GoalsSlide[]; compact?: boolean }) {
  const trackRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    if (prefersReduced) return;

    // 実スライド数 + 先頭クローン1枚 = totalItems
    const totalItems = slides.length + 1;

    const id = window.setInterval(() => {
      const itemWidth = el.scrollWidth / totalItems;
      if (!itemWidth) return;
      const idx = Math.round(el.scrollLeft / itemWidth);
      const next = idx + 1;

      el.scrollTo({ left: next * itemWidth, behavior: "smooth" });

      // クローン（最後）まで来たらアニメーション完了後に先頭へ瞬時ジャンプ
      // snap-mandatory が scrollLeft 代入を再アニメーションするのを防ぐため
      // ジャンプ前後で scrollSnapType を一時無効にする
      if (next === slides.length) {
        setTimeout(() => {
          el.style.scrollSnapType = "none";
          el.scrollLeft = 0;
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              el.style.scrollSnapType = "";
            });
          });
        }, 550);
      }
    }, 4500);

    return () => window.clearInterval(id);
  }, [slides.length]);

  // 実スライド + 先頭スライドのクローン
  const allSlides = slides[0] ? [...slides, slides[0]] : slides;

  function SlideCard({ s, keyStr }: { s: GoalsSlide; keyStr: string }) {
    const Icon = s.icon;
    const text = s.content.length > 0 ? s.content : s.empty;
    const isEmpty = s.content.length === 0;
    return (
      <div key={keyStr} className="w-full shrink-0 snap-center">
        <Card className={cn("h-full gap-1 py-2 transition-shadow hover:shadow-md", compact ? "" : "sm:gap-3 sm:py-4")}>
          <CardHeader className={cn("flex flex-row items-center gap-1.5 space-y-0 p-2 pb-1", compact ? "" : "sm:gap-2 sm:pb-2 sm:pr-4")}>
            <div className="shrink-0 rounded-md bg-sky-100 p-1 dark:bg-sky-900/40 sm:rounded-lg sm:p-2">
              <Icon className="size-4 text-sky-600 dark:text-sky-400 sm:size-5" />
            </div>
            <CardTitle className={cn("truncate font-medium", compact ? "text-[10px]" : "text-[10px] sm:text-sm")}>
              {s.title}
            </CardTitle>
          </CardHeader>
          <CardContent className={cn("p-2 pt-0", compact ? "" : "sm:p-4 sm:pt-0")}>
            <p className={cn("line-clamp-3 font-semibold leading-relaxed", compact ? "text-sm" : "text-sm sm:text-base", isEmpty && "text-muted-foreground font-normal")}>
              {text}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className={compact ? "mb-2" : "mb-3"}>
      <div
        ref={trackRef}
        className="flex overflow-x-auto snap-x snap-mandatory [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {allSlides.map((s, i) => (
          <SlideCard key={i === slides.length ? `${s.key}-clone` : s.key} s={s} keyStr={i === slides.length ? `${s.key}-clone` : s.key} />
        ))}
      </div>
    </div>
  );
}

export default function HomePage() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ totalCount: 0, totalChars: 0, streakDays: 0 });
  const [monthlyJournalCount, setMonthlyJournalCount] = useState(0);
  const [journalDayCounts, setJournalDayCounts] = useState<Record<number, number>>({});
  const [graduationDate, setGraduationDate] = useState(DEFAULT_GRADUATION_DATE);
  const [enrollmentDate, setEnrollmentDate] = useState(DEFAULT_ENROLLMENT_DATE);
  const [birthDate, setBirthDate] = useState("");
  const [isStudent, setIsStudent] = useState(true);
  const [countdown, setCountdown] = useState<CountdownParts>({
    days: 0, hours: 0, minutes: 0, seconds: 0,
  });
  const [progressPercent, setProgressPercent] = useState(0);
  const [lifeCountdown, setLifeCountdown] = useState<CountdownParts>({
    days: 0, hours: 0, minutes: 0, seconds: 0,
  });
  const [lifeProgress, setLifeProgress] = useState(0);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [goals, setGoals] = useState<GoalsData | null>(null);
  const [monthOffset, setMonthOffset] = useState(0); // 0=今月, -1=先月, +1=来月…

  // プロフィールから卒業予定日・入学日・生年月日・大学生フラグを取得
  useEffect(() => {
    const profile = loadProfile();
    setGraduationDate(profile.graduationDate || DEFAULT_GRADUATION_DATE);
    setEnrollmentDate(profile.enrollmentDate || DEFAULT_ENROLLMENT_DATE);
    setBirthDate(profile.birthDate || "");
    setIsStudent(profile.isStudent ?? true);
  }, []);

  // ゴールはローカルストレージから
  useEffect(() => {
    setGoals(loadGoals());
  }, []);

  // ジャーナル統計：ログイン済みは Firestore、未ログインは localStorage
  useEffect(() => {
    if (!user?.uid) {
      const entries = loadEntries();
      setStats(computeJournalStats(entries));
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0, 0);

      let monthly = 0;
      const dayCounts: Record<number, number> = {};
      entries.forEach((e) => {
        const date = new Date(e.createdAt);
        if (Number.isNaN(date.getTime())) return;
        const day = new Date(date);
        day.setHours(0, 0, 0, 0);
        const t = day.getTime();
        dayCounts[t] = (dayCounts[t] ?? 0) + 1; // 全月分を記録
        if (date >= startOfMonth && date < endOfMonth) monthly++; // 今月カウントのみ分離
      });

      setJournalDayCounts(dayCounts);
      setMonthlyJournalCount(monthly);
      return;
    }
    const q = query(
      collection(getDb(), "journals"),
      where("userId", "==", user.uid)
    );
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const totalCount = snapshot.size;
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0, 0);
        let monthly = 0;
        const dayCounts: Record<number, number> = {};
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const dateSet = new Set<number>();
        snapshot.docs.forEach((d) => {
          const raw = d.data().createdAt;
          let date: Date;
          if (raw && typeof raw === "object" && "toDate" in raw) {
            date = (raw as { toDate: () => Date }).toDate();
          } else if (typeof raw === "string") {
            date = new Date(raw);
          } else {
            return;
          }
          const day = new Date(date);
          day.setHours(0, 0, 0, 0);
          dateSet.add(day.getTime());

          const t = day.getTime();
          dayCounts[t] = (dayCounts[t] ?? 0) + 1; // 全月分を記録
          if (date >= startOfMonth && date < endOfMonth) monthly++; // 今月カウントのみ分離
        });
        let streak = 0;
        const cursor = new Date(today);
        while (dateSet.has(cursor.getTime())) {
          streak++;
          cursor.setDate(cursor.getDate() - 1);
        }
        setStats((prev) => ({ ...prev, totalCount, streakDays: streak }));
        setJournalDayCounts(dayCounts);
        setMonthlyJournalCount(monthly);
      },
      () => {
        setMonthlyJournalCount(0);
        setJournalDayCounts({});
      }
    );
    return () => unsubscribe();
  }, [user?.uid]);

  useEffect(() => {
    setProgressPercent(Math.round(getProgressPercent(graduationDate, enrollmentDate) * 100) / 100);
  }, [graduationDate, enrollmentDate]);

  useEffect(() => {
    setCountdown(getCountdownParts(graduationDate));
    const id = setInterval(() => {
      setCountdown(getCountdownParts(graduationDate));
    }, 1000);
    return () => clearInterval(id);
  }, [graduationDate]);

  useEffect(() => {
    if (!birthDate) return;
    setLifeCountdown(getLifeCountdownParts(birthDate));
    setLifeProgress(Math.round(getLifeProgressPercent(birthDate) * 100) / 100);
    const id = setInterval(() => {
      setLifeCountdown(getLifeCountdownParts(birthDate));
    }, 1000);
    return () => clearInterval(id);
  }, [birthDate]);

  const monthCursor = new Date();
  monthCursor.setDate(1); // 月末オーバーフロー防止
  monthCursor.setMonth(monthCursor.getMonth() + monthOffset);
  const monthYear = monthCursor.getFullYear();
  const monthIndex = monthCursor.getMonth();
  const firstDayOfMonth = new Date(monthYear, monthIndex, 1);
  const daysInMonth = new Date(monthYear, monthIndex + 1, 0).getDate();
  const startWeekday = firstDayOfMonth.getDay(); // 0:日〜6:土
  const totalCalendarCells =
    Math.ceil((startWeekday + daysInMonth) / 7) * 7;

  const todayKey = (() => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return t.getTime();
  })();

  const weekdayLabels = ["日", "月", "火", "水", "木", "金", "土"];
  const monthLabel = `${monthYear}年${monthIndex + 1}月`;

  function getJournalCellStyle(count: number, isPastNoJournal: boolean) {
    if (count <= 0) {
      if (isPastNoJournal) {
        return {
          cellBg: "bg-slate-100/80 dark:bg-slate-800/40",
          cellBorder: "border-slate-200/80 dark:border-slate-700/50",
          dotBg: "bg-transparent",
          numText: "text-slate-500 dark:text-slate-400",
        };
      }
      return {
        cellBg: "bg-transparent",
        cellBorder: "border-transparent",
        dotBg: "bg-transparent",
        numText: "text-muted-foreground",
      };
    }
    if (count === 1) {
      return {
        cellBg: "bg-sky-100/80 dark:bg-sky-900/40",
        cellBorder: "border-sky-200/80 dark:border-sky-800/50",
        dotBg: "bg-sky-500 dark:bg-sky-400",
        numText: "text-sky-900 dark:text-sky-100",
      };
    }
    if (count === 2) {
      return {
        cellBg: "bg-violet-100/80 dark:bg-violet-900/40",
        cellBorder: "border-violet-200/80 dark:border-violet-800/50",
        dotBg: "bg-violet-500 dark:bg-violet-400",
        numText: "text-violet-900 dark:text-violet-100",
      };
    }
    return {
      cellBg: "bg-amber-100/80 dark:bg-amber-900/40",
      cellBorder: "border-amber-200/80 dark:border-amber-800/50",
      dotBg: "bg-amber-500 dark:bg-amber-400",
      numText: "text-amber-900 dark:text-amber-100",
    };
  }

  const goalsSlides: GoalsSlide[] = [
    {
      key: "long",
      title: "長期ビジョン",
      icon: Target,
      content: (goals?.longTermVision?.content ?? "").trim(),
      empty: "目標を設定しましょう",
    },
    {
      key: "year",
      title: "1年後の目標",
      icon: Flag,
      content: (goals?.oneYearGoal?.content ?? "").trim(),
      empty: "目標を設定しましょう",
    },
    {
      key: "month",
      title: "1ヶ月後の目標",
      icon: Calendar,
      content: (goals?.oneMonthGoal?.content ?? "").trim(),
      empty: "目標を設定しましょう",
    },
  ];

  /** カレンダーグリッド（モバイル・PC共通） */
  function CalendarGrid() {
    return (
      <>
        <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-medium text-muted-foreground sm:text-xs">
          {weekdayLabels.map((label) => (
            <div key={label}>{label}</div>
          ))}
        </div>
        <div className="mt-2 grid grid-cols-7 gap-1">
          {Array.from({ length: totalCalendarCells }).map((_, idx) => {
            const dayNum = idx - startWeekday + 1;
            if (dayNum < 1 || dayNum > daysInMonth) {
              return (
                <div
                  key={`empty-${idx}`}
                  className="aspect-square rounded-md border border-transparent bg-transparent"
                />
              );
            }
            const d = new Date(monthYear, monthIndex, dayNum);
            d.setHours(0, 0, 0, 0);
            const t = d.getTime();
            const count = journalDayCounts[t] ?? 0;
            const isPastNoJournal = t < todayKey && count === 0;
            const style = getJournalCellStyle(count, isPastNoJournal);
            const isToday = t === todayKey;
            return (
              <div
                key={t}
                className={`flex aspect-square flex-col items-center justify-center rounded-md border text-[10px] transition-colors ${style.cellBg} ${style.cellBorder} ${isToday ? "ring-2 ring-sky-500/40 dark:ring-sky-400/30" : ""}`}
                title={count > 0 ? `${dayNum}日（${count}件）` : undefined}
              >
                <span className={`text-xs font-semibold ${style.numText}`}>{dayNum}</span>
                {count > 0 ? (
                  <span className={`mt-1 h-1.5 w-1.5 rounded-full ${style.dotBg}`} />
                ) : (
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-transparent" />
                )}
              </div>
            );
          })}
        </div>
      </>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex h-12 shrink-0 items-center border-b border-border bg-background px-4 sm:h-14">
        <h1 className="text-base font-semibold sm:text-lg">ホーム</h1>
      </header>
      <main className="flex flex-1 overflow-auto">
        <div className="relative min-h-full w-full bg-gradient-to-b from-slate-50/80 via-white to-sky-50/30 dark:from-slate-950/50 dark:via-background dark:to-sky-950/20">
          <div className="mx-auto max-w-4xl space-y-3 px-3 pt-4 pb-32 sm:space-y-5 sm:px-6 sm:py-6">
            {/* カウントダウン */}
            <section className="relative overflow-hidden rounded-2xl border border-border bg-card/80 shadow-sm backdrop-blur-sm">
              {isStudent ? (
                <>
                  {/* 切り替えボタン（大学生のみ） */}
                  <button
                    onClick={() => setCurrentSlide((prev) => (prev === 0 ? 1 : 0))}
                    className="absolute right-3 top-3 z-10 flex items-center gap-1 rounded-full border border-border bg-background/80 px-2.5 py-1 text-[10px] text-muted-foreground backdrop-blur-sm transition-colors hover:bg-muted hover:text-foreground sm:right-4 sm:top-4 sm:text-xs"
                    title={currentSlide === 0 ? "人生の残り時間を見る" : "卒業カウントダウンを見る"}
                  >
                    <ArrowLeftRight className="size-3" />
                    {currentSlide === 0 ? "人生" : "卒業"}
                  </button>
                  <div className="relative">
                    {/* スライド1: 卒業まで */}
                    <div className={`flex flex-col items-center p-4 text-center sm:p-6 transition-opacity duration-500 ${currentSlide === 0 ? "opacity-100" : "opacity-0 absolute inset-0 pointer-events-none"}`}>
                      <p className="mb-2 text-sm text-muted-foreground sm:text-base">
                        卒業まで、あと
                      </p>
                      <div className="mb-4 flex flex-wrap items-baseline justify-center gap-x-2 gap-y-1 sm:gap-x-3">
                        <span className="tabular-nums font-mono text-3xl font-bold text-sky-600 dark:text-sky-400 sm:text-5xl md:text-6xl">
                          {countdown.days}
                        </span>
                        <span className="text-lg text-muted-foreground sm:text-2xl">日</span>
                        <span className="tabular-nums font-mono text-3xl font-bold text-sky-600 dark:text-sky-400 sm:text-5xl md:text-6xl">
                          {pad2(countdown.hours)}
                        </span>
                        <span className="text-lg text-muted-foreground sm:text-2xl">時間</span>
                        <span className="tabular-nums font-mono text-3xl font-bold text-sky-600 dark:text-sky-400 sm:text-5xl md:text-6xl">
                          {pad2(countdown.minutes)}
                        </span>
                        <span className="text-lg text-muted-foreground sm:text-2xl">分</span>
                        <span className="tabular-nums font-mono text-3xl font-bold text-sky-600 dark:text-sky-400 sm:text-5xl md:text-6xl">
                          {pad2(countdown.seconds)}
                        </span>
                        <span className="text-lg text-muted-foreground sm:text-2xl">秒</span>
                      </div>
                      <div className="w-full max-w-md space-y-1.5">
                        <div className="flex justify-between text-[10px] text-muted-foreground sm:text-xs">
                          <span>大学生活の進捗</span>
                          <span>{Math.round(progressPercent)}%</span>
                        </div>
                        <Progress value={progressPercent} className="h-2 sm:h-3" />
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">
                        卒業予定：{(graduationDate || DEFAULT_GRADUATION_DATE).replace(/-/g, "/")}
                      </p>
                    </div>

                    {/* スライド2: 人生の残り時間 */}
                    <div className={`flex flex-col items-center p-4 text-center sm:p-6 transition-opacity duration-500 ${currentSlide === 1 ? "opacity-100" : "opacity-0 absolute inset-0 pointer-events-none"}`}>
                      <p className="mb-2 text-sm text-muted-foreground sm:text-base">
                        人生の残り時間（平均寿命{AVERAGE_LIFESPAN_YEARS}歳換算）
                      </p>
                      {birthDate ? (
                        <>
                          <div className="mb-4 flex flex-wrap items-baseline justify-center gap-x-2 gap-y-1 sm:gap-x-3">
                            <span className="tabular-nums font-mono text-3xl font-bold text-amber-500 dark:text-amber-400 sm:text-5xl md:text-6xl">
                              {lifeCountdown.days}
                            </span>
                            <span className="text-lg text-muted-foreground sm:text-2xl">日</span>
                            <span className="tabular-nums font-mono text-3xl font-bold text-amber-500 dark:text-amber-400 sm:text-5xl md:text-6xl">
                              {pad2(lifeCountdown.hours)}
                            </span>
                            <span className="text-lg text-muted-foreground sm:text-2xl">時間</span>
                            <span className="tabular-nums font-mono text-3xl font-bold text-amber-500 dark:text-amber-400 sm:text-5xl md:text-6xl">
                              {pad2(lifeCountdown.minutes)}
                            </span>
                            <span className="text-lg text-muted-foreground sm:text-2xl">分</span>
                            <span className="tabular-nums font-mono text-3xl font-bold text-amber-500 dark:text-amber-400 sm:text-5xl md:text-6xl">
                              {pad2(lifeCountdown.seconds)}
                            </span>
                            <span className="text-lg text-muted-foreground sm:text-2xl">秒</span>
                          </div>
                          <div className="w-full max-w-md space-y-1.5">
                            <div className="flex justify-between text-[10px] text-muted-foreground sm:text-xs">
                              <span>人生の進捗</span>
                              <span>{Math.round(lifeProgress)}%</span>
                            </div>
                            <Progress value={lifeProgress} className="h-2 sm:h-3 [&>div]:bg-amber-500" />
                          </div>
                          <p className="mt-2 text-xs text-muted-foreground">
                            生年月日：{birthDate.replace(/-/g, "/")}
                          </p>
                        </>
                      ) : (
                        <div className="flex flex-col items-center gap-3 py-4">
                          <p className="text-sm text-muted-foreground">
                            生年月日を設定すると表示されます
                          </p>
                          <a
                            href="/mypage"
                            className="text-xs text-sky-600 underline underline-offset-2 hover:text-sky-700 dark:text-sky-400"
                          >
                            My Page で設定する →
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                /* 大学生でない場合：人生カウントダウンのみ表示 */
                <div className="flex flex-col items-center p-4 text-center sm:p-6">
                  <p className="mb-2 text-sm text-muted-foreground sm:text-base">
                    人生の残り時間（平均寿命{AVERAGE_LIFESPAN_YEARS}歳換算）
                  </p>
                  {birthDate ? (
                    <>
                      <div className="mb-4 flex flex-wrap items-baseline justify-center gap-x-2 gap-y-1 sm:gap-x-3">
                        <span className="tabular-nums font-mono text-3xl font-bold text-amber-500 dark:text-amber-400 sm:text-5xl md:text-6xl">
                          {lifeCountdown.days}
                        </span>
                        <span className="text-lg text-muted-foreground sm:text-2xl">日</span>
                        <span className="tabular-nums font-mono text-3xl font-bold text-amber-500 dark:text-amber-400 sm:text-5xl md:text-6xl">
                          {pad2(lifeCountdown.hours)}
                        </span>
                        <span className="text-lg text-muted-foreground sm:text-2xl">時間</span>
                        <span className="tabular-nums font-mono text-3xl font-bold text-amber-500 dark:text-amber-400 sm:text-5xl md:text-6xl">
                          {pad2(lifeCountdown.minutes)}
                        </span>
                        <span className="text-lg text-muted-foreground sm:text-2xl">分</span>
                        <span className="tabular-nums font-mono text-3xl font-bold text-amber-500 dark:text-amber-400 sm:text-5xl md:text-6xl">
                          {pad2(lifeCountdown.seconds)}
                        </span>
                        <span className="text-lg text-muted-foreground sm:text-2xl">秒</span>
                      </div>
                      <div className="w-full max-w-md space-y-1.5">
                        <div className="flex justify-between text-[10px] text-muted-foreground sm:text-xs">
                          <span>人生の進捗</span>
                          <span>{Math.round(lifeProgress)}%</span>
                        </div>
                        <Progress value={lifeProgress} className="h-2 sm:h-3 [&>div]:bg-amber-500" />
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">
                        生年月日：{birthDate.replace(/-/g, "/")}
                      </p>
                    </>
                  ) : (
                    <div className="flex flex-col items-center gap-3 py-4">
                      <p className="text-sm text-muted-foreground">
                        生年月日を設定すると表示されます
                      </p>
                      <a
                        href="/mypage"
                        className="text-xs text-sky-600 underline underline-offset-2 hover:text-sky-700 dark:text-sky-400"
                      >
                        My Page で設定する →
                      </a>
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* 今日のジャーナルを書く */}
            <section className="w-full">
              <Button
                size="lg"
                className="h-12 w-full min-w-0 gap-2 px-6 text-sm sm:h-16 sm:px-10 sm:text-base"
                asChild
              >
                <Link href="/journal">
                  <BookOpen className="size-4" />
                  今日のジャーナルを書く
                </Link>
              </Button>
            </section>

            {/* スマホ時レイアウト（参考画像） */}
            <section className="sm:hidden space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Card className="gap-1 py-2 transition-shadow hover:shadow-md sm:gap-6 sm:py-4">
                  <CardHeader className="flex flex-row items-center gap-1.5 space-y-0 p-2 pb-1 sm:gap-3 sm:pb-2 sm:pr-6">
                    <div className="shrink-0 rounded-md bg-sky-100 p-1 dark:bg-sky-900/40 sm:rounded-lg sm:p-2">
                      <FileText className="size-4 text-sky-600 dark:text-sky-400 sm:size-5" />
                    </div>
                    <CardTitle className="truncate text-[10px] font-medium sm:text-base">
                      総ジャーナル数
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-2 pt-0 sm:p-6 sm:pt-0">
                    <p className="text-base font-bold sm:text-2xl">{stats.totalCount}</p>
                    <CardDescription className="hidden text-xs sm:block">
                      これまで書いた日記の合計
                    </CardDescription>
                  </CardContent>
                </Card>

                <Card className="gap-1 py-2 transition-shadow hover:shadow-md sm:gap-6 sm:py-4">
                  <CardHeader className="flex flex-row items-center gap-1.5 space-y-0 p-2 pb-1 sm:gap-3 sm:pb-2 sm:pr-6">
                    <div className="shrink-0 rounded-md bg-amber-100 p-1 dark:bg-amber-900/40 sm:rounded-lg sm:p-2">
                      <Flame className="size-4 text-amber-600 dark:text-amber-400 sm:size-5" />
                    </div>
                    <CardTitle className="truncate text-[10px] font-medium sm:text-base">
                      継続日数
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-2 pt-0 sm:p-6 sm:pt-0">
                    <p className="text-base font-bold sm:text-2xl">{stats.streakDays}</p>
                    <CardDescription className="hidden text-xs sm:block">
                      連続で書いている日数
                    </CardDescription>
                  </CardContent>
                </Card>
              </div>

              <Card className="overflow-hidden border-slate-200/80 bg-slate-50/80 dark:border-slate-700/60 dark:bg-slate-900/30">
                <CardContent className="p-3">
                  <GoalsCarousel slides={goalsSlides} compact />
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <button
                      onClick={() => setMonthOffset((o) => o - 1)}
                      className="rounded p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      aria-label="前の月"
                    >
                      <ChevronLeft className="size-4" />
                    </button>
                    <p className="text-xs font-semibold text-foreground">{monthLabel}</p>
                    <button
                      onClick={() => setMonthOffset((o) => o + 1)}
                      className="rounded p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      aria-label="次の月"
                    >
                      <ChevronRight className="size-4" />
                    </button>
                  </div>

                  <CalendarGrid />
                </CardContent>
              </Card>
            </section>

            {/* sm以上（PC/タブレット）レイアウト */}
            <section className="hidden sm:grid grid-cols-1 gap-3 sm:grid-cols-[240px_1fr] sm:items-stretch sm:gap-4">
              <div className="flex h-full flex-col gap-2 sm:gap-3">
                {/* 積み上げ統計カード */}
                <Card className="flex-1 gap-1 py-2 transition-shadow hover:shadow-md sm:gap-6 sm:py-4">
                  <CardHeader className="flex flex-row items-center gap-1.5 space-y-0 p-2 pb-1 sm:gap-3 sm:pb-2 sm:pr-6">
                    <div className="shrink-0 rounded-md bg-sky-100 p-1 dark:bg-sky-900/40 sm:rounded-lg sm:p-2">
                      <FileText className="size-4 text-sky-600 dark:text-sky-400 sm:size-5" />
                    </div>
                    <CardTitle className="truncate text-[10px] font-medium sm:text-base">
                      総ジャーナル数
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-2 pt-0 sm:p-6 sm:pt-0">
                    <p className="text-base font-bold sm:text-2xl">
                      {stats.totalCount}
                    </p>
                    <CardDescription className="hidden text-xs sm:block">
                      これまで書いた日記の合計
                    </CardDescription>
                  </CardContent>
                </Card>
                <Card className="flex-1 gap-1 py-2 transition-shadow hover:shadow-md sm:gap-6 sm:py-4">
                  <CardHeader className="flex flex-row items-center gap-1.5 space-y-0 p-2 pb-1 sm:gap-3 sm:pb-2 sm:pr-6">
                    <div className="shrink-0 rounded-md bg-violet-100 p-1 dark:bg-violet-900/40 sm:rounded-lg sm:p-2">
                      <CalendarDays className="size-4 text-violet-600 dark:text-violet-400 sm:size-5" />
                    </div>
                    <CardTitle className="truncate text-[10px] font-medium sm:text-base">
                      今月のジャーナル数
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-2 pt-0 sm:p-6 sm:pt-0">
                    <p className="text-base font-bold sm:text-2xl">
                      {monthlyJournalCount}
                    </p>
                    <CardDescription className="hidden text-xs sm:block">
                      今月書いた日記の合計
                    </CardDescription>
                  </CardContent>
                </Card>
                <Card className="flex-1 gap-1 py-2 transition-shadow hover:shadow-md sm:gap-6 sm:py-4">
                  <CardHeader className="flex flex-row items-center gap-1.5 space-y-0 p-2 pb-1 sm:gap-3 sm:pb-2 sm:pr-6">
                    <div className="shrink-0 rounded-md bg-amber-100 p-1 dark:bg-amber-900/40 sm:rounded-lg sm:p-2">
                      <Flame className="size-4 text-amber-600 dark:text-amber-400 sm:size-5" />
                    </div>
                    <CardTitle className="truncate text-[10px] font-medium sm:text-base">
                      継続日数
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-2 pt-0 sm:p-6 sm:pt-0">
                    <p className="text-base font-bold sm:text-2xl">
                      {stats.streakDays}
                    </p>
                    <CardDescription className="hidden text-xs sm:block">
                      連続で書いている日数
                    </CardDescription>
                  </CardContent>
                </Card>
              </div>

              {/* 月間カレンダー */}
              <div className="flex w-full flex-col sm:max-w-[640px] sm:justify-self-end">
                <Card className="flex-1 overflow-hidden border-slate-200/80 bg-slate-50/80 dark:border-slate-700/60 dark:bg-slate-900/30">
                  <CardContent className="p-3 sm:p-4">
                    <GoalsCarousel slides={goalsSlides} />
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <button
                        onClick={() => setMonthOffset((o) => o - 1)}
                        className="rounded p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        aria-label="前の月"
                      >
                        <ChevronLeft className="size-4" />
                      </button>
                      <p className="text-xs font-semibold text-foreground sm:text-sm">
                        {monthLabel}
                      </p>
                      <button
                        onClick={() => setMonthOffset((o) => o + 1)}
                        className="rounded p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        aria-label="次の月"
                      >
                        <ChevronRight className="size-4" />
                      </button>
                    </div>

                    <CalendarGrid />
                  </CardContent>
                </Card>
              </div>
            </section>

          </div>
        </div>
      </main>
    </div>
  );
}
