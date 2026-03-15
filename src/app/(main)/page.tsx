"use client";

import { useEffect, useState } from "react";
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
import {
  collection,
  query,
  where,
  onSnapshot,
  Timestamp,
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
} from "lucide-react";

const DEFAULT_GRADUATION_DATE = "2028-03-31";
const ENROLLMENT_DATE = "2024-04-01"; // 入学日（4年制想定）

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

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

function getProgressPercent(graduationDate: string): number {
  const start = new Date(ENROLLMENT_DATE).getTime();
  const end = new Date(graduationDate).getTime();
  const now = Date.now();
  const total = end - start;
  const elapsed = now - start;
  return Math.min(100, Math.max(0, (elapsed / total) * 100));
}

const quotes: { text: string; author: string }[] = [
  { text: "努力できるということも実力のうちだ。", author: "野村克也" },
  { text: "小さいことを積み重ねるのが、とんでもないところへ行くただひとつの道。", author: "イチロー" },
  { text: "明日死ぬかのように生きよ。永遠に生きるかのように学べ。", author: "ガンジー" },
  { text: "成功とは、失敗を重ねてもやる気を失わない能力のことだ。", author: "ウィンストン・チャーチル" },
  { text: "あなたの時間は限られている。だから他人の人生を生きることで時間を無駄にしてはいけない。", author: "スティーブ・ジョブズ" },
];

const TYPING_SPEED_MS = 100;
const DELETING_SPEED_MS = 50;
const WAIT_AFTER_FULL_MS = 3000;

export default function HomePage() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ totalCount: 0, totalChars: 0, streakDays: 0 });
  const [monthlyJournalCount, setMonthlyJournalCount] = useState(0);
  const [graduationDate, setGraduationDate] = useState(DEFAULT_GRADUATION_DATE);
  const [countdown, setCountdown] = useState<CountdownParts>({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  });
  const [progressPercent, setProgressPercent] = useState(0);
  const [goals, setGoals] = useState<GoalsData | null>(null);
  const [quoteIndex, setQuoteIndex] = useState(0);
  const [displayedText, setDisplayedText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  // プロフィールから卒業予定日を取得（カウントダウン連動）
  useEffect(() => {
    const profile = loadProfile();
    setGraduationDate(profile.graduationDate || DEFAULT_GRADUATION_DATE);
  }, []);

  useEffect(() => {
    const entries = loadEntries();
    setStats(computeJournalStats(entries));
    setGoals(loadGoals());
  }, []);

  useEffect(() => {
    if (!user?.uid) {
      setMonthlyJournalCount(0);
      return;
    }
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const q = query(
      collection(getDb(), "journals"),
      where("userId", "==", user.uid),
      where("createdAt", ">=", Timestamp.fromDate(startOfMonth))
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setMonthlyJournalCount(snapshot.size);
    });
    return () => unsubscribe();
  }, [user?.uid]);

  useEffect(() => {
    setProgressPercent(Math.round(getProgressPercent(graduationDate) * 100) / 100);
  }, [graduationDate]);

  useEffect(() => {
    setCountdown(getCountdownParts(graduationDate));
    const id = setInterval(() => {
      setCountdown(getCountdownParts(graduationDate));
    }, 1000);
    return () => clearInterval(id);
  }, [graduationDate]);

  useEffect(() => {
    const quote = quotes[quoteIndex];
    if (!quote) return;

    const full = quote.text;
    let timer: ReturnType<typeof setTimeout>;

    if (!isDeleting && displayedText.length < full.length) {
      timer = setTimeout(() => {
        setDisplayedText(full.slice(0, displayedText.length + 1));
      }, TYPING_SPEED_MS);
      return () => clearTimeout(timer);
    }

    if (!isDeleting && displayedText.length === full.length) {
      timer = setTimeout(() => setIsDeleting(true), WAIT_AFTER_FULL_MS);
      return () => clearTimeout(timer);
    }

    if (isDeleting && displayedText.length > 0) {
      timer = setTimeout(() => {
        setDisplayedText((prev) => prev.slice(0, -1));
      }, DELETING_SPEED_MS);
      return () => clearTimeout(timer);
    }

    if (isDeleting && displayedText.length === 0) {
      setIsDeleting(false);
      setQuoteIndex((i) => (i + 1) % quotes.length);
    }
  }, [quoteIndex, displayedText, isDeleting]);

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex h-12 shrink-0 items-center border-b border-border bg-background px-4 sm:h-14">
        <h1 className="text-base font-semibold sm:text-lg">ホーム</h1>
      </header>
      <main className="flex flex-1 overflow-auto">
        <div className="relative min-h-full w-full bg-gradient-to-b from-slate-50/80 via-white to-sky-50/30 dark:from-slate-950/50 dark:via-background dark:to-sky-950/20">
          <div className="mx-auto max-w-4xl space-y-3 px-3 py-4 sm:space-y-5 sm:px-6 sm:py-6">
            {/* 卒業カウントダウン */}
            <section className="flex flex-col items-center rounded-2xl border border-border bg-card/80 p-4 text-center shadow-sm backdrop-blur-sm sm:p-6">
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
            </section>

            {/* 名言 */}
            <section className="min-h-[60px] py-1 sm:min-h-[100px] sm:py-2">
              <p className="text-left font-serif text-xs leading-relaxed text-slate-600 dark:text-slate-400 sm:text-sm">
                「{displayedText}
                <span className="animate-pulse text-slate-600 dark:text-slate-400">|</span>」
              </p>
              <p
                className={`mt-0.5 text-[10px] text-slate-500 transition-opacity duration-500 dark:text-slate-500 sm:mt-1 sm:text-xs ${
                  displayedText.length > 0 ? "opacity-100" : "opacity-0"
                }`}
              >
                （{quotes[quoteIndex]?.author}）
              </p>
            </section>

            {/* 今日のジャーナルを書く */}
            <section>
              <Button
                size="lg"
                className="h-10 min-w-0 gap-2 px-6 text-sm sm:h-12 sm:min-w-[280px] sm:px-8 sm:text-base"
                asChild
              >
                <Link href="/journal">
                  <BookOpen className="size-4" />
                  今日のジャーナルを書く
                </Link>
              </Button>
            </section>

            {/* 積み上げ統計カード */}
            <section className="grid grid-cols-3 gap-2 sm:gap-3">
              <Card className="gap-1 py-2 transition-shadow hover:shadow-md sm:gap-6 sm:py-6">
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
              <Card className="gap-1 py-2 transition-shadow hover:shadow-md sm:gap-6 sm:py-6">
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
              <Card className="gap-1 py-2 transition-shadow hover:shadow-md sm:gap-6 sm:py-6">
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
            </section>

            {/* 現在の目標 */}
            <section>
              <h2 className="mb-2 text-sm font-semibold text-foreground sm:mb-3 sm:text-base">
                現在の目標
              </h2>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-3">
                <Link href="/mypage/goals" className="block">
                  <Card className="h-full gap-1 py-2 transition-shadow hover:shadow-md sm:gap-3 sm:py-4">
                    <CardHeader className="flex flex-row items-center gap-1.5 space-y-0 p-2 pb-1 sm:gap-2 sm:pb-2 sm:pr-4">
                      <div className="shrink-0 rounded-md bg-sky-100 p-1 dark:bg-sky-900/40 sm:rounded-lg sm:p-2">
                        <Target className="size-4 text-sky-600 dark:text-sky-400 sm:size-5" />
                      </div>
                      <CardTitle className="truncate text-[10px] font-medium sm:text-sm">
                        長期ビジョン
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-2 pt-0 sm:p-4 sm:pt-0">
                      <p className="line-clamp-3 text-sm font-semibold leading-relaxed text-foreground sm:text-base">
                        {(goals?.longTermVision?.content ?? "").trim()
                          ? goals!.longTermVision.content
                          : "目標を設定しましょう"}
                      </p>
                    </CardContent>
                  </Card>
                </Link>
                <Link href="/mypage/goals" className="block">
                  <Card className="h-full gap-1 py-2 transition-shadow hover:shadow-md sm:gap-3 sm:py-4">
                    <CardHeader className="flex flex-row items-center gap-1.5 space-y-0 p-2 pb-1 sm:gap-2 sm:pb-2 sm:pr-4">
                      <div className="shrink-0 rounded-md bg-sky-100 p-1 dark:bg-sky-900/40 sm:rounded-lg sm:p-2">
                        <Flag className="size-4 text-sky-600 dark:text-sky-400 sm:size-5" />
                      </div>
                      <CardTitle className="truncate text-[10px] font-medium sm:text-sm">
                        1年後の目標
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-2 pt-0 sm:p-4 sm:pt-0">
                      <p className="line-clamp-3 text-sm font-semibold leading-relaxed text-foreground sm:text-base">
                        {(goals?.oneYearGoal?.content ?? "").trim()
                          ? goals!.oneYearGoal.content
                          : "目標を設定しましょう"}
                      </p>
                    </CardContent>
                  </Card>
                </Link>
                <Link href="/mypage/goals" className="block">
                  <Card className="h-full gap-1 py-2 transition-shadow hover:shadow-md sm:gap-3 sm:py-4">
                    <CardHeader className="flex flex-row items-center gap-1.5 space-y-0 p-2 pb-1 sm:gap-2 sm:pb-2 sm:pr-4">
                      <div className="shrink-0 rounded-md bg-sky-100 p-1 dark:bg-sky-900/40 sm:rounded-lg sm:p-2">
                        <Calendar className="size-4 text-sky-600 dark:text-sky-400 sm:size-5" />
                      </div>
                      <CardTitle className="truncate text-[10px] font-medium sm:text-sm">
                        1ヶ月後の目標
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-2 pt-0 sm:p-4 sm:pt-0">
                      <p className="line-clamp-3 text-sm font-semibold leading-relaxed text-foreground sm:text-base">
                        {(goals?.oneMonthGoal?.content ?? "").trim()
                          ? goals!.oneMonthGoal.content
                          : "目標を設定しましょう"}
                      </p>
                    </CardContent>
                  </Card>
                </Link>
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
