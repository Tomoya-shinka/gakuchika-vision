"use client";

import { useEffect, useRef, useState, type ComponentType } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { useSidebar } from "@/components/ui/sidebar";
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
import {
  loadCountdownSettings,
  getCountdownPartsFromDeadline,
  getProgressFromDeadline,
  COLOR_OPTIONS,
  type CountdownSettings,
  type CountdownParts as CustomCountdownParts,
} from "@/lib/countdown-cards";
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
    // スクロールドラッグとクリックを区別するため pointerdown 位置を記録
    const pointerStartX = useRef(0);
    return (
      <div
        key={keyStr}
        className="w-full shrink-0 snap-center cursor-pointer"
        onPointerDown={(e) => { pointerStartX.current = e.clientX; }}
        onPointerUp={(e) => {
          if (Math.abs(e.clientX - pointerStartX.current) < 8) {
            window.location.href = "/mypage/goals";
          }
        }}
      >
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
  const { open: sidebarOpen } = useSidebar();
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
  const [countdownSettings, setCountdownSettings] = useState<CountdownSettings>(() => loadCountdownSettings());
  const [customCardParts, setCustomCardParts] = useState<Record<string, CustomCountdownParts>>({});
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

  // カウントダウン設定の再読み込み（ページフォーカス時に最新を反映）
  useEffect(() => {
    const refresh = () => setCountdownSettings(loadCountdownSettings());
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, []);

  // カスタムカードのカウントダウンを1秒ごとに更新
  useEffect(() => {
    const cards = countdownSettings.customCards;
    if (!cards.length) { setCustomCardParts({}); return; }
    const update = () => {
      const parts: Record<string, CustomCountdownParts> = {};
      for (const c of cards) parts[c.id] = getCountdownPartsFromDeadline(c.deadline);
      setCustomCardParts(parts);
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [countdownSettings.customCards]);

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
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0, 0);
        let totalCount = 0;
        let monthly = 0;
        const dayCounts: Record<number, number> = {};
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const dateSet = new Set<number>();
        snapshot.docs.forEach((d) => {
          const data = d.data();
          // snap・つぶやきはジャーナル統計・カレンダーから除外
          if (data.type === "snap" || data.type === "tweet") return;
          totalCount++;
          const raw = data.createdAt;
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
          cellBg: "bg-slate-200/90 dark:bg-slate-700/60",
          cellBorder: "border-slate-300/80 dark:border-slate-600/60",
          dotBg: "bg-transparent",
          numText: "text-slate-500 dark:text-slate-400",
        };
      }
      return {
        cellBg: "bg-slate-100/60 dark:bg-slate-800/30",
        cellBorder: "border-slate-200/60 dark:border-slate-700/30",
        dotBg: "bg-transparent",
        numText: "text-muted-foreground",
      };
    }
    if (count === 1) {
      return {
        cellBg: "bg-sky-100/80 dark:bg-sky-900/40",
        cellBorder: "border-sky-200/80 dark:border-sky-800/50",
        dotBg: "bg-sky-400 dark:bg-sky-400",
        numText: "text-sky-800 dark:text-sky-100",
      };
    }
    if (count === 2) {
      return {
        cellBg: "bg-sky-200/80 dark:bg-sky-800/50",
        cellBorder: "border-sky-300/80 dark:border-sky-700/60",
        dotBg: "bg-sky-500 dark:bg-sky-400",
        numText: "text-sky-900 dark:text-sky-100",
      };
    }
    return {
      cellBg: "bg-sky-400/60 dark:bg-sky-600/50",
      cellBorder: "border-sky-500/60 dark:border-sky-500/50",
      dotBg: "bg-sky-600 dark:bg-sky-300",
      numText: "text-sky-950 dark:text-white",
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
                className={`flex aspect-square flex-col items-center justify-center rounded-md border text-[10px] transition-colors ${style.cellBg} ${style.cellBorder} ${isToday ? "ring-2 ring-inset ring-sky-500/60 dark:ring-sky-400/40" : ""}`}
                title={count > 0 ? `${dayNum}日（${count}件）` : undefined}
              >
                <span className={`text-xs font-semibold ${style.numText}`}>{dayNum}</span>
                <span className="mt-1 flex gap-0.5">
                  {count > 0
                    ? Array.from({ length: Math.min(count, 3) }).map((_, i) => (
                        <span key={i} className={`h-1.5 w-1.5 rounded-full ${style.dotBg}`} />
                      ))
                    : <span className="h-1.5 w-1.5 rounded-full bg-transparent" />
                  }
                </span>
              </div>
            );
          })}
        </div>
      </>
    );
  }

  /** カウントダウンカード（横スクロール式・複数カード対応） */
  function CountdownContent({ className }: { className?: string }) {
    const scrollRef = useRef<HTMLDivElement>(null);
    const [activeIdx, setActiveIdx] = useState(0);

    // 表示するカードを順番に組み立てる
    type CardEntry = { key: string; node: React.ReactNode };
    const cards: CardEntry[] = [];

    // 1) 卒業カウントダウン（大学生のみ・削除不可）
    if (isStudent) {
      cards.push({
        key: "graduation",
        node: (
          <div className="flex flex-col items-center p-3 text-center sm:p-4">
            <p className="mb-2 text-sm text-muted-foreground sm:text-base">
              卒業まで、あと
            </p>
            <div className="mb-4 flex flex-wrap items-baseline justify-center gap-x-1.5 gap-y-1 sm:flex-nowrap">
              <span className="tabular-nums font-mono text-3xl font-bold text-sky-600 dark:text-sky-400">{countdown.days}</span>
              <span className="text-lg text-muted-foreground">日</span>
              <span className="tabular-nums font-mono text-3xl font-bold text-sky-600 dark:text-sky-400">{pad2(countdown.hours)}</span>
              <span className="text-lg text-muted-foreground">時間</span>
              <span className="tabular-nums font-mono text-3xl font-bold text-sky-600 dark:text-sky-400">{pad2(countdown.minutes)}</span>
              <span className="text-lg text-muted-foreground">分</span>
              <span className="tabular-nums font-mono text-3xl font-bold text-sky-600 dark:text-sky-400">{pad2(countdown.seconds)}</span>
              <span className="text-lg text-muted-foreground">秒</span>
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
        ),
      });
    }

    // 2) 人生の残り時間（設定でオフにできる）
    if (countdownSettings.showLifeCountdown) {
      cards.push({
        key: "life",
        node: (
          <div className="flex flex-col items-center p-3 text-center sm:p-4">
            <p className="mb-2 text-sm text-muted-foreground sm:text-base">
              人生の残り時間（平均寿命{AVERAGE_LIFESPAN_YEARS}歳換算）
            </p>
            {birthDate ? (
              <>
                <div className="mb-4 flex flex-wrap items-baseline justify-center gap-x-1.5 gap-y-1 sm:flex-nowrap">
                  <span className="tabular-nums font-mono text-3xl font-bold text-amber-500 dark:text-amber-400">{lifeCountdown.days}</span>
                  <span className="text-lg text-muted-foreground">日</span>
                  <span className="tabular-nums font-mono text-3xl font-bold text-amber-500 dark:text-amber-400">{pad2(lifeCountdown.hours)}</span>
                  <span className="text-lg text-muted-foreground">時間</span>
                  <span className="tabular-nums font-mono text-3xl font-bold text-amber-500 dark:text-amber-400">{pad2(lifeCountdown.minutes)}</span>
                  <span className="text-lg text-muted-foreground">分</span>
                  <span className="tabular-nums font-mono text-3xl font-bold text-amber-500 dark:text-amber-400">{pad2(lifeCountdown.seconds)}</span>
                  <span className="text-lg text-muted-foreground">秒</span>
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
        ),
      });
    }

    // 3) カスタムカード
    for (const card of countdownSettings.customCards) {
      const parts = customCardParts[card.id] ?? { days: 0, hours: 0, minutes: 0, seconds: 0 };
      const colorOpt = COLOR_OPTIONS.find((c) => c.value === card.color) ?? COLOR_OPTIONS[0]!;
      const progress = getProgressFromDeadline(card.deadline, card.startDate, card.createdAt);
      cards.push({
        key: card.id,
        node: (
          <div className="flex flex-col items-center p-3 text-center sm:p-4">
            <p className="mb-2 text-sm text-muted-foreground sm:text-base">
              {card.label}まで、あと
            </p>
            <div className="mb-4 flex flex-wrap items-baseline justify-center gap-x-1.5 gap-y-1 sm:flex-nowrap">
              <span className={cn("tabular-nums font-mono text-3xl font-bold", colorOpt.numberClass)}>{parts.days}</span>
              <span className="text-lg text-muted-foreground">日</span>
              <span className={cn("tabular-nums font-mono text-3xl font-bold", colorOpt.numberClass)}>{pad2(parts.hours)}</span>
              <span className="text-lg text-muted-foreground">時間</span>
              <span className={cn("tabular-nums font-mono text-3xl font-bold", colorOpt.numberClass)}>{pad2(parts.minutes)}</span>
              <span className="text-lg text-muted-foreground">分</span>
              <span className={cn("tabular-nums font-mono text-3xl font-bold", colorOpt.numberClass)}>{pad2(parts.seconds)}</span>
              <span className="text-lg text-muted-foreground">秒</span>
            </div>
            <div className="w-full max-w-md space-y-1.5">
              <div className="flex justify-between text-[10px] text-muted-foreground sm:text-xs">
                <span>経過</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className={cn("h-2 sm:h-3", colorOpt.progressClass)} />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              期限：{card.deadline.replace(/-/g, "/")}
            </p>
          </div>
        ),
      });
    }

    if (cards.length === 0) return null;

    const handleScroll = () => {
      const el = scrollRef.current;
      if (!el || !el.clientWidth) return;
      setActiveIdx(Math.round(el.scrollLeft / el.clientWidth));
    };

    return (
      <section
        className={cn(
          "relative overflow-hidden rounded-2xl border border-border bg-card/80 shadow-sm backdrop-blur-sm",
          className
        )}
      >
        {/* 横スクロール式カードエリア */}
        <div
          ref={scrollRef}
          className="flex snap-x snap-mandatory overflow-x-auto scroll-smooth"
          style={{ scrollbarWidth: "none" }}
          onScroll={handleScroll}
        >
          {cards.map((c) => (
            <div key={c.key} className="min-w-full shrink-0 snap-start">
              {c.node}
            </div>
          ))}
        </div>

        {/* ドットインジケーター（2枚以上のとき表示） */}
        {cards.length > 1 && (
          <div className="flex justify-center gap-1.5 pb-2.5">
            {cards.map((c, i) => (
              <button
                key={c.key}
                type="button"
                aria-label={`カード ${i + 1}`}
                onClick={() =>
                  scrollRef.current?.scrollTo({
                    left: i * scrollRef.current.clientWidth,
                    behavior: "smooth",
                  })
                }
                className={cn(
                  "size-1.5 rounded-full transition-colors",
                  i === activeIdx ? "bg-primary" : "bg-muted-foreground/30"
                )}
              />
            ))}
          </div>
        )}
      </section>
    );
  }

  /** 月ナビ付きカレンダーパネル */
  function CalendarPanel() {
    return (
      <>
        <GoalsCarousel slides={goalsSlides} />
        <div className="mb-2 flex items-center justify-between gap-2">
          <button onClick={() => setMonthOffset((o) => o - 1)} className="rounded p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" aria-label="前の月">
            <ChevronLeft className="size-4" />
          </button>
          <p className="text-xs font-semibold text-foreground sm:text-sm">{monthLabel}</p>
          <button onClick={() => setMonthOffset((o) => o + 1)} className="rounded p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" aria-label="次の月">
            <ChevronRight className="size-4" />
          </button>
        </div>
        <CalendarGrid />
      </>
    );
  }

  const bgGradient = "bg-gradient-to-b from-slate-50/80 via-white to-sky-50/30 dark:from-slate-950/50 dark:via-background dark:to-sky-950/20";

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <header className="flex h-[52px] shrink-0 items-center border-b border-border bg-background px-4">
        <h1 className="text-base font-semibold">ホーム</h1>
      </header>

      {/* ===== PC レイアウト（スクロールなし、高さを埋める）===== */}
      <div className={cn("hidden sm:flex sm:flex-1 sm:overflow-hidden", bgGradient)}>
        <div className="flex flex-1 gap-2 overflow-hidden p-2">
          {/* 左列: ボタン（上）→ カウントダウン（中）→ 統計3列（下）／カレンダー高さに引っ張られない */}
          <div className={cn("flex w-full shrink-0 flex-col gap-2 self-start transition-[max-width] duration-200 ease-linear", sidebarOpen ? "max-w-[380px]" : "max-w-[560px]")}>
            <div className="h-20 w-full shrink-0">
              <Button size="lg" className="h-full w-full gap-2 px-6 text-sm" asChild>
                <Link href="/journal"><BookOpen className="size-4" />今日のジャーナルを書く</Link>
              </Button>
            </div>
            <CountdownContent className="flex flex-col justify-center" />
            {/* 統計 3-col */}
            <div className="grid shrink-0 grid-cols-3 gap-2">
              <Card className="gap-1 py-2 transition-shadow hover:shadow-md">
                <CardHeader className="flex flex-row items-center gap-1.5 space-y-0 p-2 pb-1">
                  <div className="shrink-0 rounded-md bg-sky-100 p-1 dark:bg-sky-900/40">
                    <FileText className="size-3.5 text-sky-600 dark:text-sky-400" />
                  </div>
                  <CardTitle className="truncate text-[10px] font-medium">総ジャーナル数</CardTitle>
                </CardHeader>
                <CardContent className="p-2 pt-0">
                  <p className="text-lg font-bold">{stats.totalCount}</p>
                  <CardDescription className="text-[10px]">合計</CardDescription>
                </CardContent>
              </Card>
              <Card className="gap-1 py-2 transition-shadow hover:shadow-md">
                <CardHeader className="flex flex-row items-center gap-1.5 space-y-0 p-2 pb-1">
                  <div className="shrink-0 rounded-md bg-violet-100 p-1 dark:bg-violet-900/40">
                    <CalendarDays className="size-3.5 text-violet-600 dark:text-violet-400" />
                  </div>
                  <CardTitle className="truncate text-[10px] font-medium">今月のジャーナル</CardTitle>
                </CardHeader>
                <CardContent className="p-2 pt-0">
                  <p className="text-lg font-bold">{monthlyJournalCount}</p>
                  <CardDescription className="text-[10px]">今月</CardDescription>
                </CardContent>
              </Card>
              <Card className="gap-1 py-2 transition-shadow hover:shadow-md">
                <CardHeader className="flex flex-row items-center gap-1.5 space-y-0 p-2 pb-1">
                  <div className="shrink-0 rounded-md bg-amber-100 p-1 dark:bg-amber-900/40">
                    <Flame className="size-3.5 text-amber-600 dark:text-amber-400" />
                  </div>
                  <CardTitle className="truncate text-[10px] font-medium">継続日数</CardTitle>
                </CardHeader>
                <CardContent className="p-2 pt-0">
                  <p className="text-lg font-bold">{stats.streakDays}</p>
                  <CardDescription className="text-[10px]">連続</CardDescription>
                </CardContent>
              </Card>
            </div>
            {/* 目標カルーセル（統計カード下） */}
            <GoalsCarousel slides={goalsSlides} />
          </div>
          {/* 右列: カレンダーのみ */}
          <div className="flex flex-1 min-w-0 flex-col min-h-0">
            <Card className="flex flex-1 min-h-0 flex-col overflow-hidden border-slate-200/80 bg-slate-50/80 dark:border-slate-700/60 dark:bg-slate-900/30">
              <CardContent className="flex flex-1 min-h-0 flex-col px-3 py-3">
                <div className="mb-2 flex shrink-0 items-center justify-between gap-2">
                  <button onClick={() => setMonthOffset((o) => o - 1)} className="rounded p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" aria-label="前の月">
                    <ChevronLeft className="size-4" />
                  </button>
                  <p className="text-xs font-semibold text-foreground">{monthLabel}</p>
                  <button onClick={() => setMonthOffset((o) => o + 1)} className="rounded p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" aria-label="次の月">
                    <ChevronRight className="size-4" />
                  </button>
                </div>
                <div className="flex-1 min-h-0 overflow-auto">
                  <CalendarGrid />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* ===== モバイルレイアウト（スクロールあり）===== */}
      <main className={cn("flex flex-1 overflow-auto sm:hidden", bgGradient)}>
        <div className="w-full">
          <div className="space-y-3 px-3 pt-4 pb-32">
            {/* カウントダウン */}
            <CountdownContent />

            {/* 今日のジャーナルを書く */}
            <Button size="lg" className="h-20 w-full gap-2 px-6 text-base" asChild>
              <Link href="/journal">
                <BookOpen className="size-5" />
                今日のジャーナルを書く
              </Link>
            </Button>

            {/* 統計 2-col */}
            <div className="grid grid-cols-2 gap-3">
              <Card className="gap-1 py-2 transition-shadow hover:shadow-md">
                <CardHeader className="flex flex-row items-center gap-1.5 space-y-0 p-2 pb-1">
                  <div className="shrink-0 rounded-md bg-sky-100 p-1 dark:bg-sky-900/40">
                    <FileText className="size-4 text-sky-600 dark:text-sky-400" />
                  </div>
                  <CardTitle className="truncate text-[10px] font-medium">総ジャーナル数</CardTitle>
                </CardHeader>
                <CardContent className="p-2 pt-0">
                  <p className="text-base font-bold">{stats.totalCount}</p>
                </CardContent>
              </Card>
              <Card className="gap-1 py-2 transition-shadow hover:shadow-md">
                <CardHeader className="flex flex-row items-center gap-1.5 space-y-0 p-2 pb-1">
                  <div className="shrink-0 rounded-md bg-amber-100 p-1 dark:bg-amber-900/40">
                    <Flame className="size-4 text-amber-600 dark:text-amber-400" />
                  </div>
                  <CardTitle className="truncate text-[10px] font-medium">継続日数</CardTitle>
                </CardHeader>
                <CardContent className="p-2 pt-0">
                  <p className="text-base font-bold">{stats.streakDays}</p>
                </CardContent>
              </Card>
            </div>

            {/* 目標カルーセル */}
            <GoalsCarousel slides={goalsSlides} />

            {/* カレンダー */}
            <Card className="overflow-hidden border-slate-200/80 bg-slate-50/80 dark:border-slate-700/60 dark:bg-slate-900/30">
              <CardContent className="p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <button onClick={() => setMonthOffset((o) => o - 1)} className="rounded p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" aria-label="前の月">
                    <ChevronLeft className="size-4" />
                  </button>
                  <p className="text-xs font-semibold text-foreground sm:text-sm">{monthLabel}</p>
                  <button onClick={() => setMonthOffset((o) => o + 1)} className="rounded p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" aria-label="次の月">
                    <ChevronRight className="size-4" />
                  </button>
                </div>
                <CalendarGrid />
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
