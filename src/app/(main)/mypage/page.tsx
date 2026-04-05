"use client";

import { useEffect, useState, useCallback, useRef, ComponentType } from "react";
import Link from "next/link";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  Timestamp,
} from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import { useAuth } from "@/contexts/auth-context";
import { loadGoals } from "@/lib/goals";
import { loadProfile, type UserProfile } from "@/lib/user-profile";
import {
  getUserProfile,
  type FirestoreUserProfile,
} from "@/lib/user-profile-firestore";
import { formatDate, getPreview } from "@/lib/journal";
import { calculateUnivDay } from "@/lib/university-life";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Settings,
  Target,
  Flag,
  Calendar,
  Sparkles,
  Mic,
  ImageIcon,
  BookOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  型定義                                                               */
/* ------------------------------------------------------------------ */

type PostEntry = {
  id: string;
  title?: string;
  content: string;
  createdAt: string;
  isPublic: boolean;
  type?: string;
  audioUrl?: string;
  audioDurationSec?: number;
  imageUrls?: string[];
};

type GoalsSlide = {
  key: string;
  title: string;
  icon: ComponentType<{ className?: string }>;
  content: string;
  empty: string;
};

type Tab = "journal" | "snap" | "tweet";

/* ------------------------------------------------------------------ */
/*  目標カルーセル（ホームと同じ無限ループ方式）                        */
/* ------------------------------------------------------------------ */

function GoalsCarousel({ slides }: { slides: GoalsSlide[] }) {
  const trackRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    if (prefersReduced) return;

    const totalItems = slides.length + 1;
    const id = window.setInterval(() => {
      const itemWidth = el.scrollWidth / totalItems;
      if (!itemWidth) return;
      const idx = Math.round(el.scrollLeft / itemWidth);
      const next = idx + 1;
      el.scrollTo({ left: next * itemWidth, behavior: "smooth" });
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

  const allSlides = slides[0] ? [...slides, slides[0]] : slides;

  return (
    <div
      ref={trackRef}
      className="flex overflow-x-auto snap-x snap-mandatory [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {allSlides.map((s, i) => {
        const Icon = s.icon;
        const text = s.content.length > 0 ? s.content : s.empty;
        const isEmpty = s.content.length === 0;
        const pointerStartX = { current: 0 };
        return (
          <div
            key={i === slides.length ? `${s.key}-clone` : s.key}
            className="w-full shrink-0 snap-center cursor-pointer"
            onPointerDown={(e) => { pointerStartX.current = e.clientX; }}
            onPointerUp={(e) => {
              if (Math.abs(e.clientX - pointerStartX.current) < 8) {
                window.location.href = "/mypage/goals";
              }
            }}
          >
            <Card className="h-full gap-1 py-2 transition-shadow hover:shadow-md border-sky-100 dark:border-sky-900/40">
              <CardHeader className="flex flex-row items-center gap-1.5 space-y-0 p-2 pb-1">
                <div className="shrink-0 rounded-md bg-sky-100 p-1 dark:bg-sky-900/40">
                  <Icon className="size-3.5 text-sky-600 dark:text-sky-400" />
                </div>
                <CardTitle className="truncate text-[10px] font-medium">
                  {s.title}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-2 pt-0">
                <p className={cn(
                  "line-clamp-3 text-xs font-semibold leading-relaxed",
                  isEmpty && "text-muted-foreground font-normal"
                )}>
                  {text}
                </p>
              </CardContent>
            </Card>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  MyPage                                                              */
/* ------------------------------------------------------------------ */

export default function MyPage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(() => {
    if (typeof window === "undefined") return null;
    try { return loadProfile(); } catch { return null; }
  });
  const [firestoreProfile, setFirestoreProfile] = useState<FirestoreUserProfile | null>(null);
  const [goals, setGoals] = useState(() => {
    if (typeof window === "undefined") return null;
    try { return loadGoals(); } catch { return null; }
  });
  const [enrollmentDate, setEnrollmentDate] = useState<string | null>(null);
  const [isStudent, setIsStudent] = useState(true);

  const [entries, setEntries] = useState<PostEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("journal");

  /* プロフィール読み込み */
  useEffect(() => {
    setGoals(loadGoals());
    const p = loadProfile();
    setProfile(p);
    if (!user?.uid) return;
    let cancelled = false;
    getUserProfile(getDb(), user.uid)
      .then((fp) => {
        if (cancelled) return;
        if (fp) {
          setFirestoreProfile({ ...fp, isStudent: fp.isStudent !== undefined ? fp.isStudent : p.isStudent ?? true });
        }
      })
      .catch(() => {});
    getDoc(doc(getDb(), "users", user.uid))
      .then((snap) => {
        if (cancelled) return;
        const d = snap.data() as Record<string, unknown> | undefined;
        setIsStudent(d?.isStudent !== undefined ? Boolean(d.isStudent) : true);
        const raw = typeof d?.enrollmentDate === "string" ? d.enrollmentDate : "";
        setEnrollmentDate(/^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [user?.uid]);

  /* 自分の投稿を全件取得 */
  const loadEntries = useCallback(async () => {
    if (!user?.uid) { setLoading(false); return; }
    setLoading(true);
    try {
      const db = getDb();
      const q = query(collection(db, "journals"), where("userId", "==", user.uid));
      const snap = await getDocs(q);
      const list: PostEntry[] = [];
      snap.forEach((d) => {
        const data = d.data();
        const createdAt = data.createdAt instanceof Timestamp
          ? data.createdAt.toDate().toISOString()
          : String(data.createdAt ?? "");
        list.push({
          id: d.id,
          title: data.title != null ? String(data.title) : undefined,
          content: String(data.content ?? ""),
          createdAt,
          isPublic: data.isPublic === true,
          type: typeof data.type === "string" ? data.type : undefined,
          audioUrl: typeof data.audioUrl === "string" && data.audioUrl ? data.audioUrl : undefined,
          audioDurationSec: typeof data.audioDurationSec === "number" ? data.audioDurationSec : undefined,
          imageUrls: Array.isArray(data.imageUrls) ? (data.imageUrls as string[]) : undefined,
        });
      });
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setEntries(list);
    } catch (e) {
      console.error("[mypage] failed to load entries:", e);
    } finally {
      setLoading(false);
    }
  }, [user?.uid]);

  useEffect(() => {
    loadEntries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  /* タブ別フィルタ */
  const journalEntries = entries.filter((e) => e.type !== "snap" && e.type !== "tweet");
  const snapEntries = entries.filter((e) => e.type === "snap");
  const tweetEntries = entries.filter((e) => e.type === "tweet");

  const activeEntries =
    activeTab === "snap" ? snapEntries :
    activeTab === "tweet" ? tweetEntries :
    journalEntries;

  const displayName = firestoreProfile?.displayName ?? profile?.name ?? "ユーザー名を設定";
  const avatarUrl = firestoreProfile?.avatarUrl ?? profile?.avatarUrl;
  const initials = displayName.slice(0, 2).toUpperCase();

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

  const tabConfig: { key: Tab; label: string; count: number }[] = [
    { key: "journal", label: "Journal", count: journalEntries.length },
    { key: "snap", label: "Snap", count: snapEntries.length },
    { key: "tweet", label: "つぶやき", count: tweetEntries.length },
  ];

  return (
    <div className="flex flex-1 flex-col">
      {/* ヘッダー */}
      <header className="flex h-[52px] shrink-0 items-center justify-between border-b border-border bg-background px-4">
        <h1 className="text-base font-semibold">My Page</h1>
        <Link
          href="/settings"
          className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="設定"
        >
          <Settings className="size-4 sm:size-5" />
        </Link>
      </header>

      <div className="flex flex-1 flex-col overflow-auto">
        {/* プロフィール + 目標カード */}
        <div className="flex items-start gap-3 border-b border-border bg-background px-4 py-4 sm:gap-4 sm:px-6 sm:py-5">
          {/* 左：アバター + 名前 + 大学情報 */}
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <div className="flex items-center gap-3">
              <Avatar className="size-14 shrink-0 border-2 border-sky-100 dark:border-sky-900/50 sm:size-16">
                <AvatarImage src={avatarUrl} alt={displayName} />
                <AvatarFallback className="bg-sky-100 text-sm font-semibold text-sky-700 dark:bg-sky-900/50 dark:text-sky-300">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-base font-bold text-foreground sm:text-xl">
                  {displayName}
                </h2>
                {(firestoreProfile?.isStudent ?? isStudent) && (
                  <p className="mt-0.5 truncate text-xs text-muted-foreground sm:text-sm">
                    {[
                      firestoreProfile?.university ?? profile?.university,
                      firestoreProfile?.grade ? `${firestoreProfile.grade}年生` : profile?.status,
                    ]
                      .filter(Boolean)
                      .join("　") || "大学名・学年を設定"}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* 右：目標カルーセル */}
          <div className="w-[44%] shrink-0 sm:w-[40%]">
            <GoalsCarousel slides={goalsSlides} />
          </div>
        </div>

        {/* タブ */}
        <div className="sticky top-0 z-10 flex shrink-0 border-b border-border bg-background">
          {tabConfig.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 border-b-2 px-2 py-2.5 text-sm font-medium transition-colors",
                activeTab === tab.key
                  ? tab.key === "snap"
                    ? "border-amber-500 text-amber-600 dark:text-amber-400"
                    : "border-sky-500 text-sky-600 dark:text-sky-400"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {tab.key === "snap" && <Sparkles className="size-3.5" aria-hidden />}
              {tab.label}
              {tab.count > 0 && (
                <span className={cn(
                  "rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                  activeTab === tab.key && tab.key === "snap"
                    ? "bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400"
                    : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                )}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* コンテンツ */}
        <main className="flex-1 bg-gray-50 px-4 py-4 dark:bg-slate-950/40 sm:px-6 sm:py-6">
          <div className="mx-auto flex w-full max-w-2xl flex-col gap-3">
            {loading ? (
              <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
                読み込み中…
              </div>
            ) : !user ? (
              <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
                <p className="text-sm">ログインするとここに記録が表示されます</p>
              </div>
            ) : activeEntries.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-background py-16 text-center">
                {activeTab === "snap" ? (
                  <>
                    <Sparkles className="mb-3 size-10 text-muted-foreground/40" />
                    <p className="text-sm font-medium text-muted-foreground">まだ Snap がありません</p>
                    <p className="mt-1 text-xs text-muted-foreground">ジャーナルを書いた後に抽出できます</p>
                  </>
                ) : activeTab === "tweet" ? (
                  <>
                    <BookOpen className="mb-3 size-10 text-muted-foreground/40" />
                    <p className="text-sm font-medium text-muted-foreground">まだつぶやきがありません</p>
                    <p className="mt-1 text-xs text-muted-foreground">フィードのボタンから投稿できます</p>
                  </>
                ) : (
                  <>
                    <BookOpen className="mb-3 size-10 text-muted-foreground/40" />
                    <p className="text-sm font-medium text-muted-foreground">まだ記録がありません</p>
                    <Link
                      href="/journal"
                      className="mt-3 text-sm font-medium text-primary underline-offset-4 hover:underline"
                    >
                      ジャーナルを書く →
                    </Link>
                  </>
                )}
              </div>
            ) : activeTab === "journal" ? (
              /* ジャーナル一覧 */
              activeEntries.map((entry) => {
                const preview = getPreview(entry.content, 60);
                const univDay =
                  isStudent && enrollmentDate != null
                    ? calculateUnivDay(new Date(entry.createdAt), enrollmentDate)
                    : null;
                return (
                  <Link
                    key={entry.id}
                    href={`/journal/${entry.id}`}
                    className="block rounded-2xl border border-border bg-white px-5 py-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md dark:bg-slate-900/80"
                  >
                    <div className="flex flex-col gap-1">
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                        <p className="truncate text-sm font-semibold text-foreground sm:text-base">
                          {entry.title?.trim() || preview}
                        </p>
                        <span className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <span>{formatDate(entry.createdAt)}</span>
                          {typeof univDay === "number" && (
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                              大学生活 {univDay}日目
                            </span>
                          )}
                        </span>
                      </div>
                      <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground sm:text-sm">
                        {preview}
                      </p>
                      {(entry.audioUrl || (entry.imageUrls && entry.imageUrls.length > 0)) && (
                        <div className="mt-1.5 flex items-center gap-2">
                          {entry.audioUrl && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-medium text-sky-600 dark:bg-sky-900/30 dark:text-sky-400">
                              <Mic className="size-2.5" aria-hidden />
                              音声
                            </span>
                          )}
                          {entry.imageUrls && entry.imageUrls.length > 0 && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-medium text-violet-600 dark:bg-violet-900/30 dark:text-violet-400">
                              <ImageIcon className="size-2.5" aria-hidden />
                              画像 {entry.imageUrls.length}枚
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </Link>
                );
              })
            ) : (
              /* Snap / つぶやき一覧 */
              activeEntries.map((entry) => (
                <div
                  key={entry.id}
                  className={cn(
                    "rounded-2xl border bg-white px-5 py-4 shadow-sm dark:bg-slate-900/80",
                    activeTab === "snap"
                      ? "border-amber-100 dark:border-amber-900/40"
                      : "border-sky-100 dark:border-sky-900/40"
                  )}
                >
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-medium",
                        activeTab === "snap"
                          ? "bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400"
                          : "bg-sky-50 text-sky-500 dark:bg-sky-900/30 dark:text-sky-400"
                      )}>
                        {activeTab === "snap" ? "Snap" : "つぶやき"}
                      </span>
                      <span className="text-xs text-muted-foreground">{formatDate(entry.createdAt)}</span>
                    </div>
                    <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground">
                      {entry.content}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
