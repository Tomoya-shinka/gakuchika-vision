"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, CheckCircle2, Mail, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/contexts/auth-context";
import { getDb } from "@/lib/firebase";
import { getUserProfile, saveUserProfile, toPermissionLevel, type PermissionLevel } from "@/lib/user-profile-firestore";

const NOTIF_STORAGE_KEY = "notification_settings";

type NotifSettings = {
  dmEnabled: PermissionLevel;
  dmNotificationsEnabled: PermissionLevel;
};

const DEFAULT_SETTINGS: NotifSettings = {
  dmEnabled: "all",
  dmNotificationsEnabled: "all",
};

const PERMISSION_OPTIONS: { value: PermissionLevel; label: string; description: string }[] = [
  { value: "all", label: "全員", description: "すべてのユーザーに許可" },
  { value: "followers", label: "フォロワーのみ", description: "フォロワーだけに許可" },
  { value: "off", label: "OFF", description: "誰にも許可しない" },
];

function labelOf(v: PermissionLevel): string {
  return PERMISSION_OPTIONS.find((o) => o.value === v)?.label ?? v;
}

function loadLocalSettings(): NotifSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(NOTIF_STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const p = JSON.parse(raw) as Record<string, unknown>;
    return {
      dmEnabled: toPermissionLevel(p.dmEnabled),
      dmNotificationsEnabled: toPermissionLevel(p.dmNotificationsEnabled),
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function saveLocalSettings(settings: NotifSettings) {
  if (typeof window === "undefined") return;
  localStorage.setItem(NOTIF_STORAGE_KEY, JSON.stringify(settings));
}

type ModalState = {
  key: keyof NotifSettings;
  label: string;
} | null;

export default function NotificationsSettingsPage() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<NotifSettings>(DEFAULT_SETTINGS);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [modal, setModal] = useState<ModalState>(null);

  const set = (key: keyof NotifSettings, value: PermissionLevel) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setModal(null);
  };

  const load = useCallback(async () => {
    const local = loadLocalSettings();
    setSettings(local);
    if (user?.uid) {
      try {
        const fp = await getUserProfile(getDb(), user.uid);
        if (fp) {
          setSettings({
            dmEnabled: fp.dmEnabled ?? "all",
            dmNotificationsEnabled: fp.dmNotificationsEnabled ?? "all",
          });
        }
      } catch { /* localの値をそのまま使用 */ }
    }
  }, [user?.uid]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    setSaving(true);
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
            dmEnabled: settings.dmEnabled,
            dmNotificationsEnabled: settings.dmNotificationsEnabled,
          });
        }
      } catch { /* Firestore失敗時はlocalStorageが有効 */ }
    }
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const sections = [
    {
      key: "dm",
      icon: Mail,
      title: "ダイレクトメッセージ",
      items: [
        {
          key: "dmEnabled" as keyof NotifSettings,
          label: "DMを受け取る",
          description: "DMを送信できるユーザーを設定",
        },
        {
          key: "dmNotificationsEnabled" as keyof NotifSettings,
          label: "DM通知",
          description: "DMを受け取ったときに通知する対象",
        },
      ],
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
        <h1 className="text-sm font-semibold sm:text-base">DM設定</h1>
      </header>

      <main className="flex-1 overflow-auto p-4 sm:p-6">
        <div className="mx-auto max-w-2xl space-y-4">
          {sections.map((section) => {
            const SectionIcon = section.icon;
            return (
              <div key={section.key}>
                <div className="mb-1.5 flex items-center gap-2 px-1">
                  <SectionIcon className="size-3.5 text-muted-foreground" />
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {section.title}
                  </p>
                </div>
                <Card>
                  <CardContent className="divide-y divide-border pt-0">
                    {section.items.map((item) => (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => setModal({ key: item.key, label: item.label })}
                        className="flex w-full items-center gap-4 py-4 text-left transition-colors hover:bg-muted/40"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{item.label}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
                        </div>
                        <div className="flex shrink-0 items-center gap-1 text-sm text-muted-foreground">
                          <span>{labelOf(settings[item.key])}</span>
                          <ChevronRight className="size-4" />
                        </div>
                      </button>
                    ))}
                  </CardContent>
                </Card>
              </div>
            );
          })}

          <div className="flex items-center gap-3 pt-2">
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

      {/* 選択モーダル */}
      {modal && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
          onClick={() => setModal(null)}
        >
          {/* オーバーレイ */}
          <div className="absolute inset-0 bg-black/40" />

          {/* モーダル本体 */}
          <div
            className="relative z-10 w-full max-w-sm rounded-t-2xl bg-background pb-safe sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* ヘッダー */}
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h2 className="text-sm font-semibold">{modal.label}</h2>
              <button
                type="button"
                onClick={() => setModal(null)}
                className="flex size-7 items-center justify-center rounded-full bg-muted text-muted-foreground hover:bg-muted/80"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* 選択肢 */}
            <div className="divide-y divide-border">
              {PERMISSION_OPTIONS.map((opt) => {
                const isSelected = settings[modal.key] === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => set(modal.key, opt.value)}
                    className="flex w-full items-center gap-3 px-4 py-4 text-left transition-colors hover:bg-muted/40"
                  >
                    <div className="flex-1">
                      <p className={`text-sm font-medium ${isSelected ? "text-sky-600 dark:text-sky-400" : ""}`}>
                        {opt.label}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">{opt.description}</p>
                    </div>
                    {isSelected && (
                      <CheckCircle2 className="size-5 shrink-0 text-sky-500" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* 下部の余白（iOS safe area対応） */}
            <div className="h-4" />
          </div>
        </div>
      )}
    </div>
  );
}
