"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, CheckCircle2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { loadProfile, saveProfile, type UserProfile } from "@/lib/user-profile";
import { useAuth } from "@/contexts/auth-context";
import { getDb } from "@/lib/firebase";
import {
  getUserProfile,
  saveUserProfile,
  type FirestoreUserProfile,
} from "@/lib/user-profile-firestore";

export default function AccountSettingsPage() {
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
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

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
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border bg-background px-2 sm:h-14 sm:px-4">
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
                {saved && (
                  <p className="flex items-center gap-1.5 text-xs text-sky-600 dark:text-sky-400">
                    <CheckCircle2 className="size-3.5" />
                    保存しました
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
