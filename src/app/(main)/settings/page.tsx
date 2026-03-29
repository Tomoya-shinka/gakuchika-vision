"use client";

import { useCallback, useEffect, useState } from "react";
import { Mic, CheckCircle2, User } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { loadProfile, saveProfile, type UserProfile } from "@/lib/user-profile";
import { useAuth } from "@/contexts/auth-context";
import { getDb } from "@/lib/firebase";
import {
  getUserProfile,
  saveUserProfile,
  type FirestoreUserProfile,
} from "@/lib/user-profile-firestore";

const STORAGE_KEY = "preferred_mic_device_id";

type Tab = "account" | "mic";

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("account");

  // ── アカウント設定 ──
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
  const [accountSaved, setAccountSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadProfileData = useCallback(async () => {
    const p = loadProfile();
    setEditForm({ ...p, status: (p.status || "").replace(/年生$/, "") });
    if (user?.uid) {
      try {
        const fp = await getUserProfile(getDb(), user.uid);
        if (fp) {
          const resolvedIsStudent = fp.isStudent !== undefined ? fp.isStudent : (p.isStudent ?? true);
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
    }
  }, [user?.uid]);

  useEffect(() => {
    loadProfileData();
  }, [loadProfileData]);

  const handleProfileSave = async () => {
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
    setAccountSaved(true);
    setTimeout(() => setAccountSaved(false), 2000);
  };

  // ── マイク設定 ──
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [micSaved, setMicSaved] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) ?? "";
    const loadDevices = async () => {
      let all = await navigator.mediaDevices.enumerateDevices();
      const mics = all.filter((d) => d.kind === "audioinput");
      if (mics.length > 0 && !mics[0].label) {
        const s = await navigator.mediaDevices.getUserMedia({ audio: true });
        s.getTracks().forEach((t) => t.stop());
        all = await navigator.mediaDevices.enumerateDevices();
      }
      const finalMics = all.filter((d) => d.kind === "audioinput");
      setDevices(finalMics);
      const validId = finalMics.find((d) => d.deviceId === stored)?.deviceId;
      if (validId) {
        setSelectedId(validId);
      } else if (finalMics.length > 0) {
        const firstId = finalMics[0].deviceId;
        setSelectedId(firstId);
        localStorage.setItem(STORAGE_KEY, firstId);
      }
    };
    loadDevices().catch(() => {});
  }, []);

  const handleMicSelect = (deviceId: string) => {
    setSelectedId(deviceId);
    localStorage.setItem(STORAGE_KEY, deviceId);
    setMicSaved(true);
    setTimeout(() => setMicSaved(false), 2000);
  };

  // ── タブ定義 ──
  const tabs: { id: Tab; label: string; icon: typeof User }[] = [
    { id: "account", label: "アカウント設定", icon: User },
    { id: "mic", label: "マイク設定", icon: Mic },
  ];

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex h-12 shrink-0 items-center border-b border-border bg-background px-4 sm:h-14">
        <h1 className="text-base font-semibold sm:text-lg">設定</h1>
      </header>
      <main className="flex-1 overflow-auto p-4 sm:p-6">
        <div className="mx-auto max-w-2xl space-y-4">

          {/* タブバー */}
          <div className="flex gap-1 rounded-lg border border-border bg-muted/40 p-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    activeTab === tab.id
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Icon className="size-3.5" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* アカウント設定タブ */}
          {activeTab === "account" && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <User className="size-4 text-sky-500" />
                  アカウント設定
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
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
                  <Button onClick={handleProfileSave} disabled={saving}>
                    {saving ? "保存中…" : "保存する"}
                  </Button>
                  {accountSaved && (
                    <p className="flex items-center gap-1.5 text-xs text-sky-600 dark:text-sky-400">
                      <CheckCircle2 className="size-3.5" />
                      保存しました
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* マイク設定タブ */}
          {activeTab === "mic" && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Mic className="size-4 text-sky-500" />
                  マイク入力
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  音声録音時に使用するマイクを選択してください。
                </p>

                {devices.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    マイクが見つかりません。ブラウザのマイク権限を確認してください。
                  </p>
                ) : (
                  <div className="space-y-2">
                    {devices.map((device) => (
                      <label
                        key={device.deviceId}
                        className="flex cursor-pointer items-center gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-muted/50"
                      >
                        <input
                          type="radio"
                          name="mic"
                          value={device.deviceId}
                          checked={selectedId === device.deviceId}
                          onChange={() => handleMicSelect(device.deviceId)}
                          className="accent-sky-500"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {device.label || `マイク ${devices.indexOf(device) + 1}`}
                          </p>
                        </div>
                        {selectedId === device.deviceId && <CheckCircle2 className="size-4 shrink-0 text-sky-500" />}
                      </label>
                    ))}
                  </div>
                )}

                {micSaved && (
                  <p className="flex items-center gap-1.5 text-xs text-sky-600 dark:text-sky-400">
                    <CheckCircle2 className="size-3.5" />
                    保存しました
                  </p>
                )}
              </CardContent>
            </Card>
          )}

        </div>
      </main>
    </div>
  );
}
