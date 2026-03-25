"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { History, Target, UserPen } from "lucide-react";
import { loadGoals } from "@/lib/goals";
import { loadProfile, saveProfile, type UserProfile } from "@/lib/user-profile";
import { useAuth } from "@/contexts/auth-context";
import { getDb } from "@/lib/firebase";
import {
  getUserProfile,
  saveUserProfile,
  type FirestoreUserProfile,
} from "@/lib/user-profile-firestore";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  const [profileEditOpen, setProfileEditOpen] = useState(false);
  const [editForm, setEditForm] = useState<UserProfile>(() => {
    if (typeof window === "undefined") return { name: "TOMOYA", university: "〇〇大学", status: "3年生", graduationDate: "2028-03-31", enrollmentDate: "", birthDate: "", isStudent: true };
    try {
      const p = loadProfile();
      return { ...p, status: (p.status || "").replace(/年生$/, "") };
    } catch {
      return { name: "TOMOYA", university: "〇〇大学", status: "3年生", graduationDate: "2028-03-31", enrollmentDate: "", birthDate: "", isStudent: true };
    }
  });

  const loadProfileData = useCallback(async () => {
    const p = loadProfile();
    setProfile(p);
    setEditForm({ ...p, status: (p.status || "").replace(/年生$/, "") });
    if (user?.uid) {
      try {
        const fp = await getUserProfile(getDb(), user.uid);
        if (fp) {
          // isStudent は localStorage を優先（Firestoreにフィールドがない古いデータ対策）
          const resolvedIsStudent = fp.isStudent !== undefined ? fp.isStudent : p.isStudent ?? true;
          // Firestoreの値でFirestoreプロフィールを上書き（isStudentはlocalStorage優先）
          const mergedFp = { ...fp, isStudent: resolvedIsStudent };
          setFirestoreProfile(mergedFp);
          setEditForm({
            name: fp.displayName || p.name,
            university: fp.university || p.university,
            status: (fp.grade || p.status || "").replace(/年生$/, ""),
            graduationDate: fp.graduationDate || p.graduationDate,
            enrollmentDate: fp.enrollmentDate || p.enrollmentDate || "",
            birthDate: fp.birthDate || p.birthDate || "",
            isStudent: resolvedIsStudent,
          });
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

  // 編集モーダルを開いたときにフォームを現在のプロフィールで初期化
  useEffect(() => {
    if (profileEditOpen) {
      const name =
        firestoreProfile?.displayName ?? profile?.name ?? "TOMOYA";
      const university =
        firestoreProfile?.university ?? profile?.university ?? "〇〇大学";
      const status =
        (firestoreProfile?.grade ?? profile?.status ?? "").replace(/年生$/, "");
      const graduationDate =
        firestoreProfile?.graduationDate ??
        profile?.graduationDate ??
        "2028-03-31";
      const enrollmentDate =
        firestoreProfile?.enrollmentDate ?? profile?.enrollmentDate ?? "";
      const birthDate =
        firestoreProfile?.birthDate ?? profile?.birthDate ?? "";
      const isStudent =
        firestoreProfile?.isStudent !== undefined
          ? firestoreProfile.isStudent
          : (profile?.isStudent ?? true);
      setEditForm({ name, university, status, graduationDate, enrollmentDate, birthDate, isStudent });
    }
  }, [profileEditOpen, profile, firestoreProfile]);

  const handleProfileSave = async () => {
    const gradeWithSuffix = editForm.isStudent && editForm.status ? `${editForm.status}年生` : "";
    const profileToSave = { ...editForm, status: gradeWithSuffix };
    const newFirestoreProfile = {
      displayName: editForm.name,
      university: editForm.isStudent ? editForm.university : "",
      grade: gradeWithSuffix,
      isProfileCompleted: true,
      graduationDate: editForm.isStudent ? editForm.graduationDate : undefined,
      enrollmentDate: editForm.isStudent && editForm.enrollmentDate?.trim() ? editForm.enrollmentDate.trim() : undefined,
      birthDate: editForm.birthDate?.trim() ? editForm.birthDate.trim() : undefined,
      isStudent: editForm.isStudent ?? true,
    };
    // stateを同期的に更新してからモーダルを閉じる（再オープン時に最新値を参照するため）
    saveProfile(profileToSave);
    setProfile(profileToSave);
    setFirestoreProfile(newFirestoreProfile);
    setProfileEditOpen(false);
    if (user?.uid) {
      try {
        await saveUserProfile(getDb(), user.uid, newFirestoreProfile);
      } catch {
        // Firestore 保存失敗時も localStorage は更新済み
      }
    }
  };

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex h-12 shrink-0 items-center border-b border-border bg-background px-4 sm:h-14">
        <h1 className="text-base font-semibold sm:text-lg">My Page</h1>
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
              <button
                type="button"
                onClick={() => setProfileEditOpen(true)}
                className="absolute right-2 top-2 z-10 flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:right-4 sm:top-4 sm:size-9 sm:rounded-lg"
                aria-label="プロフィールを編集"
              >
                <UserPen className="size-3.5 sm:size-5" />
              </button>
              <CardHeader className="relative flex-shrink-0 p-4 pb-0 sm:p-6 md:w-auto md:flex-1 md:flex-row md:items-center md:gap-10 md:pb-10 md:pr-12 md:pt-10 sm:pb-0 sm:pt-6">
                <div className="flex flex-row items-center gap-3 sm:flex-col sm:gap-6 md:flex-row md:gap-10">
                  <Avatar className="size-16 shrink-0 border-2 border-sky-100 dark:border-sky-900/50 sm:size-28 md:size-32">
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

      {/* プロフィール編集モーダル */}
      <Dialog open={profileEditOpen} onOpenChange={setProfileEditOpen}>
        <DialogContent className="sm:max-w-lg md:max-w-2xl max-h-[90vh] overflow-y-auto" showCloseButton>
          <DialogHeader>
            <DialogTitle>プロフィールを編集</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="profile-name">名前</Label>
              <Input
                id="profile-name"
                value={editForm.name}
                onChange={(e) => setEditForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="TOMOYA"
              />
            </div>
            {/* 大学生チェックボックス */}
            <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2.5">
              <Checkbox
                id="profile-is-student"
                checked={editForm.isStudent ?? true}
                onCheckedChange={(checked) =>
                  setEditForm((prev) => ({ ...prev, isStudent: Boolean(checked) }))
                }
              />
              <Label htmlFor="profile-is-student" className="cursor-pointer font-medium">
                大学生
              </Label>
            </div>
            {/* 大学生のみ表示するフィールド */}
            {(editForm.isStudent ?? true) && (
              <>
                <div className="grid gap-2">
                  <Label htmlFor="profile-university">所属大学</Label>
                  <Input
                    id="profile-university"
                    value={editForm.university}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, university: e.target.value }))}
                    placeholder="〇〇大学"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="profile-status">学年</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="profile-status"
                      type="number"
                      min={1}
                      max={9}
                      value={editForm.status}
                      onChange={(e) =>
                        setEditForm((prev) => ({ ...prev, status: e.target.value }))
                      }
                      placeholder="3"
                      className="w-24"
                    />
                    <span className="text-sm text-muted-foreground">年生</span>
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="profile-enrollment">入学年月日</Label>
                  <Input
                    id="profile-enrollment"
                    type="date"
                    value={editForm.enrollmentDate ?? ""}
                    onChange={(e) =>
                      setEditForm((prev) => ({ ...prev, enrollmentDate: e.target.value }))
                    }
                  />
                  <p className="text-[11px] text-muted-foreground">
                    入学年月日を設定すると「大学生活 ○日目」が各画面に表示されます。
                  </p>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="profile-graduation">卒業予定日</Label>
                  <Input
                    id="profile-graduation"
                    type="date"
                    value={editForm.graduationDate}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, graduationDate: e.target.value }))}
                  />
                </div>
              </>
            )}
            <div className="grid gap-2">
              <Label htmlFor="profile-birth">生年月日</Label>
              <Input
                id="profile-birth"
                type="date"
                value={editForm.birthDate ?? ""}
                onChange={(e) =>
                  setEditForm((prev) => ({ ...prev, birthDate: e.target.value }))
                }
              />
              <p className="text-[11px] text-muted-foreground">
                生年月日を設定すると「人生の残り時間」カウントダウンが表示されます。
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setProfileEditOpen(false)}>
              キャンセル
            </Button>
            <Button onClick={handleProfileSave}>保存する</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
