"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Camera, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { loadProfile, saveProfile, type UserProfile } from "@/lib/user-profile";
import { useAuth } from "@/contexts/auth-context";
import { getDb } from "@/lib/firebase";
import {
  getUserProfile,
  saveUserProfile,
  type FirestoreUserProfile,
} from "@/lib/user-profile-firestore";

export default function AccountSettingsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [firestoreProfile, setFirestoreProfile] = useState<FirestoreUserProfile | null>(null);
  const [editForm, setEditForm] = useState<UserProfile>(() => {
    if (typeof window === "undefined")
      return { name: "", university: "", status: "", graduationDate: "", enrollmentDate: "", birthDate: "", isStudent: true };
    try {
      const p = loadProfile();
      return { ...p, status: (p.status || "").replace(/年生$/, "") };
    } catch {
      return { name: "", university: "", status: "", graduationDate: "", enrollmentDate: "", birthDate: "", isStudent: true };
    }
  });
  const [saving, setSaving] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadProfileData = useCallback(async () => {
    const p = loadProfile();
    setEditForm({ ...p, status: (p.status || "").replace(/年生$/, "") });
    if (user?.uid) {
      try {
        const fp = await getUserProfile(getDb(), user.uid);
        if (fp) {
          const resolvedIsStudent = fp.isStudent !== undefined ? fp.isStudent : (p.isStudent ?? true);
          setFirestoreProfile({ ...fp, isStudent: resolvedIsStudent });
          setEditForm({
            name: fp.displayName || p.name,
            university: fp.university || p.university,
            status: (fp.grade || p.status || "").replace(/年生$/, ""),
            graduationDate: fp.graduationDate || p.graduationDate,
            enrollmentDate: fp.enrollmentDate || p.enrollmentDate || "",
            birthDate: fp.birthDate || p.birthDate || "",
            isStudent: resolvedIsStudent,
            avatarUrl: fp.avatarUrl || p.avatarUrl,
          });
        } else {
          setFirestoreProfile(null);
        }
      } catch {
        setFirestoreProfile(null);
      }
    }
  }, [user?.uid]);

  useEffect(() => {
    loadProfileData();
  }, [loadProfileData]);

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user?.uid) return;
    setAvatarError(null);
    setAvatarUploading(true);
    try {
      const formData = new FormData();
      formData.append("image", file);
      formData.append("uid", user.uid);
      const res = await fetch("/api/upload-avatar", { method: "POST", body: formData });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "upload failed");
      const { avatarUrl } = json as { avatarUrl: string };
      // localStorageとFirestoreの両方に即時保存
      const current = loadProfile();
      saveProfile({ ...current, avatarUrl });
      setEditForm((prev) => ({ ...prev, avatarUrl }));
      if (user?.uid) {
        const fp = firestoreProfile;
        await saveUserProfile(getDb(), user.uid, {
          displayName: fp?.displayName ?? current.name,
          university: fp?.university ?? current.university,
          grade: fp?.grade ?? current.status,
          isProfileCompleted: true,
          graduationDate: fp?.graduationDate ?? current.graduationDate,
          enrollmentDate: fp?.enrollmentDate,
          birthDate: fp?.birthDate,
          isStudent: fp?.isStudent ?? current.isStudent ?? true,
          avatarUrl,
        });
        setFirestoreProfile((prev) => prev ? { ...prev, avatarUrl } : null);
      }
    } catch (err) {
      setAvatarError(err instanceof Error ? err.message : "アップロードに失敗しました");
    } finally {
      setAvatarUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSave = async () => {
    setSaving(true);
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
      avatarUrl: editForm.avatarUrl,
    };
    saveProfile(profileToSave);
    setFirestoreProfile(newFirestoreProfile);
    if (user?.uid) {
      try {
        await saveUserProfile(getDb(), user.uid, newFirestoreProfile);
      } catch {
        // Firestore 保存失敗時も localStorage は更新済み
      }
    }
    setSaving(false);
    router.push("/settings");
  };

  const displayName = editForm.name || "?";
  const avatarUrl = editForm.avatarUrl;

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex h-[52px] shrink-0 items-center gap-2 border-b border-border bg-background px-4">
        <Link
          href="/settings"
          className="flex items-center gap-1 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ChevronLeft className="size-4" />
          設定
        </Link>
        <span className="text-muted-foreground">/</span>
        <h1 className="text-sm font-semibold sm:text-base">アカウント設定</h1>
      </header>
      <main className="flex-1 overflow-auto p-4 sm:p-6">
        <div className="mx-auto max-w-2xl">
          <Card>
            <CardContent className="space-y-4 pt-6">

              {/* アバター */}
              <div className="flex flex-col items-center gap-2 pb-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={avatarUploading || !user}
                  className="group relative"
                  aria-label="アイコンを変更"
                >
                  <Avatar className="size-20 border-2 border-border">
                    <AvatarImage src={avatarUrl} alt={displayName} />
                    <AvatarFallback className="bg-sky-100 text-xl font-semibold text-sky-700 dark:bg-sky-900/50 dark:text-sky-300">
                      {displayName[0]?.toUpperCase() ?? "?"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 transition-opacity group-hover:opacity-100 group-disabled:hidden">
                    {avatarUploading
                      ? <Loader2 className="size-6 animate-spin text-white" />
                      : <Camera className="size-6 text-white" />
                    }
                  </div>
                  {avatarUploading && (
                    <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40">
                      <Loader2 className="size-6 animate-spin text-white" />
                    </div>
                  )}
                </button>
                <p className="text-xs text-muted-foreground">タップしてアイコンを変更</p>
                {avatarError && (
                  <p className="text-xs text-destructive">{avatarError}</p>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={handleAvatarChange}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="profile-name">名前</Label>
                <Input
                  id="profile-name"
                  value={editForm.name}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="TOMOYA"
                />
              </div>

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
                        onChange={(e) => setEditForm((prev) => ({ ...prev, status: e.target.value }))}
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
                      onChange={(e) => setEditForm((prev) => ({ ...prev, enrollmentDate: e.target.value }))}
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
                  onChange={(e) => setEditForm((prev) => ({ ...prev, birthDate: e.target.value }))}
                />
                <p className="text-[11px] text-muted-foreground">
                  生年月日を設定すると「人生の残り時間」カウントダウンが表示されます。
                </p>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? "保存中…" : "保存する"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
