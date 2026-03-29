"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, CheckCircle2, MessageCircle, Mail } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/contexts/auth-context";
import { getDb } from "@/lib/firebase";
import { getUserProfile, saveUserProfile } from "@/lib/user-profile-firestore";

const NOTIF_STORAGE_KEY = "notification_settings";

function loadLocalSettings(): { commentNotifications: boolean; dmEnabled: boolean } {
  if (typeof window === "undefined") return { commentNotifications: true, dmEnabled: true };
  try {
    const raw = localStorage.getItem(NOTIF_STORAGE_KEY);
    if (!raw) return { commentNotifications: true, dmEnabled: true };
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return {
      commentNotifications: parsed.commentNotifications !== false,
      dmEnabled: parsed.dmEnabled !== false,
    };
  } catch {
    return { commentNotifications: true, dmEnabled: true };
  }
}

function saveLocalSettings(settings: { commentNotifications: boolean; dmEnabled: boolean }) {
  if (typeof window === "undefined") return;
  localStorage.setItem(NOTIF_STORAGE_KEY, JSON.stringify(settings));
}

export default function NotificationsSettingsPage() {
  const { user } = useAuth();
  const [commentNotifications, setCommentNotifications] = useState(true);
  const [dmEnabled, setDmEnabled] = useState(true);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const local = loadLocalSettings();
    setCommentNotifications(local.commentNotifications);
    setDmEnabled(local.dmEnabled);
    if (user?.uid) {
      try {
        const fp = await getUserProfile(getDb(), user.uid);
        if (fp) {
          setCommentNotifications(fp.commentNotificationsEnabled !== false);
          setDmEnabled(fp.dmEnabled !== false);
        }
      } catch { /* localの値をそのまま使用 */ }
    }
  }, [user?.uid]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    setSaving(true);
    const settings = { commentNotifications, dmEnabled };
    saveLocalSettings(settings);
    if (user?.uid) {
      try {
        const fp = await getUserProfile(getDb(), user.uid);
        if (fp) {
          await saveUserProfile(getDb(), user.uid, {
            displayName: fp.displayName,
            university: fp.university,
            grade: fp.grade,
            isProfileCompleted: fp.isProfileCompleted,
            graduationDate: fp.graduationDate,
            enrollmentDate: fp.enrollmentDate,
            birthDate: fp.birthDate,
            isStudent: fp.isStudent,
            avatarUrl: fp.avatarUrl,
            commentNotificationsEnabled: commentNotifications,
            dmEnabled,
          });
        }
      } catch { /* Firestore失敗時はlocalStorageが有効 */ }
    }
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const items = [
    {
      key: "comment" as const,
      icon: MessageCircle,
      label: "投稿へのコメント",
      description: "自分の投稿にコメントがついたとき通知を受け取る",
      value: commentNotifications,
      onChange: setCommentNotifications,
    },
    {
      key: "dm" as const,
      icon: Mail,
      label: "ダイレクトメッセージ",
      description: "他のユーザーからのDMを受け取る",
      value: dmEnabled,
      onChange: setDmEnabled,
    },
  ];

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
        <h1 className="text-sm font-semibold sm:text-base">通知・プライバシー設定</h1>
      </header>
      <main className="flex-1 overflow-auto p-4 sm:p-6">
        <div className="mx-auto max-w-2xl">
          <Card>
            <CardContent className="divide-y divide-border pt-0">
              {items.map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.key} className="flex items-center gap-4 py-4">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                      <Icon className="size-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{item.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
                    </div>
                    {/* トグルスイッチ */}
                    <button
                      type="button"
                      role="switch"
                      aria-checked={item.value}
                      onClick={() => item.onChange(!item.value)}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                        item.value ? "bg-sky-500" : "bg-muted-foreground/30"
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block size-5 rounded-full bg-white shadow-lg transition-transform ${
                          item.value ? "translate-x-5" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <div className="mt-4 flex items-center gap-3">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {saving ? "保存中…" : "保存する"}
            </button>
            {saved && (
              <p className="flex items-center gap-1.5 text-xs text-sky-600 dark:text-sky-400">
                <CheckCircle2 className="size-3.5" />
                保存しました
              </p>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
