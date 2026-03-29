"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { History, Target, Settings } from "lucide-react";
import { loadGoals } from "@/lib/goals";
import { loadProfile, type UserProfile } from "@/lib/user-profile";
import { useAuth } from "@/contexts/auth-context";
import { getDb } from "@/lib/firebase";
import {
  getUserProfile,
  type FirestoreUserProfile,
} from "@/lib/user-profile-firestore";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

const menuItems = [
  {
    title: "ジャーナルの記録を見る",
    description: "これまでの歩みを振り返る",
    url: "/mypage/records",
    icon: History,
    iconBg: "bg-slate-100 dark:bg-slate-800/60",
    iconColor: "text-slate-600 dark:text-slate-400",
  },
  {
    title: "あなたのゴール",
    description: "卒業までのロードマップを確認する",
    url: "/mypage/goals",
    icon: Target,
    iconBg: "bg-sky-100 dark:bg-sky-900/40",
    iconColor: "text-sky-600 dark:text-sky-400",
  },
];

export default function MyPage() {
  const { user } = useAuth();
  const [vision, setVision] = useState<string | null>(null);
  // localStorageから即座に読み込み（初期レンダリングでisStudentが正しく反映されるよう遅延初期化）
  const [profile, setProfile] = useState<UserProfile | null>(() => {
    if (typeof window === "undefined") return null;
    try { return loadProfile(); } catch { return null; }
  });
  const [firestoreProfile, setFirestoreProfile] =
    useState<FirestoreUserProfile | null>(null);

  const loadProfileData = useCallback(async () => {
    const p = loadProfile();
    setProfile(p);
    if (user?.uid) {
      try {
        const fp = await getUserProfile(getDb(), user.uid);
        if (fp) {
          const resolvedIsStudent = fp.isStudent !== undefined ? fp.isStudent : p.isStudent ?? true;
          setFirestoreProfile({ ...fp, isStudent: resolvedIsStudent });
        } else {
          setFirestoreProfile(null);
        }
      } catch {
        setFirestoreProfile(null);
      }
    } else {
      setFirestoreProfile(null);
    }
  }, [user?.uid]);

  useEffect(() => {
    const goals = loadGoals();
    setVision(goals.longTermVision.content.trim() || null);
  }, []);

  useEffect(() => {
    loadProfileData();
  }, [loadProfileData]);

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-border bg-background px-4 sm:h-14">
        <h1 className="text-base font-semibold sm:text-lg">My Page</h1>
        <Link
          href="/settings"
          className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="設定"
        >
          <Settings className="size-4 sm:size-5" />
        </Link>
      </header>
      <main className="flex flex-1 flex-col overflow-auto">
        <div className="relative min-h-full w-full bg-gradient-to-b from-slate-50/60 via-white to-sky-50/20 dark:from-slate-950/30 dark:via-background dark:to-sky-950/10">
          <div className="mx-auto flex max-w-4xl flex-1 flex-col gap-4 px-4 pt-4 pb-32 sm:gap-6 sm:px-6 sm:py-6 md:gap-8 md:py-10">
            {/* プロフィールカード */}
            <Card
              className={cn(
                "relative overflow-hidden gap-0 border-sky-200/50 py-0 bg-gradient-to-br from-sky-50/80 via-white to-indigo-50/40 shadow-xl dark:border-sky-800/30 dark:from-sky-950/20 dark:via-background dark:to-indigo-950/10",
                "flex flex-col md:flex-row md:items-stretch"
              )}
            >
              <CardHeader className="relative flex-shrink-0 p-4 pb-0 sm:p-6 md:w-auto md:flex-1 md:flex-row md:items-center md:gap-10 md:pb-10 md:pr-12 md:pt-10 sm:pb-0 sm:pt-6">
                <div className="flex flex-row items-center gap-3 sm:flex-col sm:gap-6 md:flex-row md:gap-10">
                  <Avatar className="size-16 shrink-0 border-2 border-sky-100 dark:border-sky-900/50 sm:size-28 md:size-32">
                    <AvatarImage
                      src={firestoreProfile?.avatarUrl ?? profile?.avatarUrl}
                      alt={firestoreProfile?.displayName ?? profile?.name ?? ""}
                    />
                    <AvatarFallback className="bg-sky-100 text-lg font-semibold text-sky-700 sm:text-3xl dark:bg-sky-900/50 dark:text-sky-300">
                      {(firestoreProfile?.displayName ??
                        profile?.name ??
                        "?")[0]?.toUpperCase() ?? "?"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex min-w-0 flex-1 flex-col items-start text-left">
                    <h2 className="text-lg font-bold tracking-tight text-foreground sm:text-3xl md:text-[2.25rem]">
                      {firestoreProfile?.displayName ??
                        profile?.name ??
                        "ユーザー名を設定"}
                    </h2>
                    {(firestoreProfile?.isStudent ?? profile?.isStudent ?? true) && (
                      <Badge
                        variant="secondary"
                        className="mt-1 px-2 py-0.5 text-xs font-medium bg-sky-100 text-sky-800 sm:mt-4 sm:px-4 sm:py-1.5 sm:text-base dark:bg-sky-900/50 dark:text-sky-200"
                      >
                        {[firestoreProfile?.university, firestoreProfile?.grade]
                          .filter(Boolean).length > 0
                          ? [firestoreProfile?.university, firestoreProfile?.grade]
                              .filter(Boolean)
                              .join(" ・ ")
                          : [profile?.university, profile?.status].filter(Boolean)
                              .length > 0
                            ? [profile?.university, profile?.status]
                                .filter(Boolean)
                                .join(" ・ ")
                            : "大学名・学年を設定"}
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col justify-center border-t border-sky-100/80 p-4 pt-3 dark:border-sky-800/20 sm:p-6 sm:pt-5 md:border-l md:border-t-0 md:py-10 md:pl-10">
                <p className="mb-1.5 text-xs font-medium text-muted-foreground sm:mb-3 sm:text-sm">
                  卒業後の目標
                </p>
                <p className="line-clamp-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground sm:line-clamp-none md:text-[1.0625rem]">
                  {vision ? (
                    vision
                  ) : (
                    <Link
                      href="/mypage/goals"
                      className="italic text-muted-foreground underline-offset-2 hover:underline hover:text-foreground"
                    >
                      目標ページで将来のビジョンを設定しましょう
                    </Link>
                  )}
                </p>
              </CardContent>
            </Card>

            <div className="space-y-1 sm:space-y-2">
              <p className="text-center text-xs text-muted-foreground sm:text-sm">
                あなたの成長の記録と目標を管理する
              </p>
              <div className="grid grid-cols-1 gap-2 pt-2 sm:gap-4 sm:pt-4 md:grid-cols-2 md:gap-4">
                {menuItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.url}
                      href={item.url}
                      className={cn(
                        "group flex flex-row items-center gap-3 rounded-xl border border-border bg-card/95 p-3 shadow-sm transition-all active:scale-[0.99] sm:flex-col sm:gap-3 sm:p-4 md:gap-2",
                        "hover:border-primary/25 hover:bg-card hover:shadow-md hover:ring-2 hover:ring-primary/5",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      )}
                    >
                      <div
                        className={cn(
                          "flex size-9 shrink-0 items-center justify-center rounded-lg transition-transform group-hover:scale-110 sm:size-11 md:size-10",
                          item.iconBg,
                          item.iconColor
                        )}
                      >
                        <Icon className="size-4 sm:size-5 md:size-[1.25rem]" aria-hidden />
                      </div>
                      <div className="min-w-0 flex-1 text-left sm:text-center">
                        <h2 className="text-sm font-semibold text-foreground group-hover:text-primary md:text-[0.8125rem]">
                          {item.title}
                        </h2>
                        <p className="mt-0 hidden text-[10px] text-muted-foreground leading-relaxed sm:block md:text-[10px]">
                          {item.description}
                        </p>
                      </div>
                      <span
                        className="shrink-0 text-[10px] font-medium text-primary/70 transition-colors group-hover:text-primary"
                        aria-hidden
                      >
                        開く →
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </main>

    </div>
  );
}
