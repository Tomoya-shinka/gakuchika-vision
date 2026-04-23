"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, Plus, Pencil, Trash2, Timer } from "lucide-react";
import {
  loadCountdownSettings,
  saveCountdownSettings,
  COLOR_OPTIONS,
  type CountdownCardColor,
  type CustomCountdownCard,
  type CountdownSettings,
} from "@/lib/countdown-cards";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

const TODAY = new Date().toISOString().slice(0, 10);

export default function CountdownSettingsPage() {
  const [settings, setSettings] = useState<CountdownSettings>(() =>
    loadCountdownSettings()
  );

  // ダイアログ状態
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<CustomCountdownCard | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  // フォーム状態
  const [formLabel, setFormLabel] = useState("");
  const [formDeadline, setFormDeadline] = useState("");
  const [formColor, setFormColor] = useState<CountdownCardColor>("sky");

  // 設定を保存してステートに反映
  const persist = (next: CountdownSettings) => {
    setSettings(next);
    saveCountdownSettings(next);
  };

  // 人生カウントダウン トグル
  const toggleLifeCountdown = () => {
    persist({ ...settings, showLifeCountdown: !settings.showLifeCountdown });
  };

  // 追加ダイアログを開く
  const openAddDialog = () => {
    setEditingCard(null);
    setFormLabel("");
    setFormDeadline("");
    setFormColor("sky");
    setDialogOpen(true);
  };

  // 編集ダイアログを開く
  const openEditDialog = (card: CustomCountdownCard) => {
    setEditingCard(card);
    setFormLabel(card.label);
    setFormDeadline(card.deadline);
    setFormColor(card.color);
    setDialogOpen(true);
  };

  // 追加 / 更新を保存
  const handleDialogSave = () => {
    if (!formLabel.trim() || !formDeadline) return;
    if (editingCard) {
      persist({
        ...settings,
        customCards: settings.customCards.map((c) =>
          c.id === editingCard.id
            ? { ...c, label: formLabel.trim(), deadline: formDeadline, color: formColor }
            : c
        ),
      });
    } else {
      persist({
        ...settings,
        customCards: [
          ...settings.customCards,
          {
            id: crypto.randomUUID(),
            label: formLabel.trim(),
            deadline: formDeadline,
            color: formColor,
            createdAt: new Date().toISOString(),
          },
        ],
      });
    }
    setDialogOpen(false);
  };

  // 削除
  const handleDelete = (id: string) => {
    persist({
      ...settings,
      customCards: settings.customCards.filter((c) => c.id !== id),
    });
    setDeleteTargetId(null);
  };

  return (
    <div className="flex flex-1 flex-col">
      {/* ヘッダー */}
      <header className="flex h-[52px] shrink-0 items-center gap-3 border-b border-border bg-background px-4">
        <Link
          href="/settings"
          className="flex items-center gap-1 rounded-md px-2 py-1 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ChevronLeft className="size-4" />
          設定
        </Link>
        <h1 className="text-base font-semibold text-foreground">
          カウントダウン設定
        </h1>
      </header>

      <main className="flex-1 overflow-auto px-4 py-5 sm:px-6">
        <div className="mx-auto max-w-2xl space-y-6">

          {/* ── デフォルトカード ── */}
          <section>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              デフォルトカード
            </h2>
            <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
              {/* 卒業まで（削除不可） */}
              <div className="flex items-center gap-3 px-4 py-3.5">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-sky-100 dark:bg-sky-900/40">
                  <Timer className="size-4 text-sky-600 dark:text-sky-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    卒業まで
                  </p>
                  <p className="text-xs text-muted-foreground">
                    大学生に自動表示・削除不可
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                  固定
                </span>
              </div>

              {/* 人生の残り時間 */}
              <div className="flex items-center gap-3 px-4 py-3.5">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/40">
                  <Timer className="size-4 text-amber-500 dark:text-amber-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    人生の残り時間
                  </p>
                  <p className="text-xs text-muted-foreground">
                    生年月日が設定されている場合に表示
                  </p>
                </div>
                {/* トグルボタン */}
                <button
                  type="button"
                  role="switch"
                  aria-checked={settings.showLifeCountdown}
                  onClick={toggleLifeCountdown}
                  className={cn(
                    "relative shrink-0 inline-flex h-6 w-11 items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    settings.showLifeCountdown
                      ? "bg-primary"
                      : "bg-input"
                  )}
                >
                  <span
                    className={cn(
                      "pointer-events-none block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform",
                      settings.showLifeCountdown
                        ? "translate-x-5"
                        : "translate-x-0"
                    )}
                  />
                </button>
              </div>
            </div>
          </section>

          {/* ── カスタムカード ── */}
          <section>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                カスタムカード
              </h2>
              <Button size="sm" onClick={openAddDialog} className="gap-1.5">
                <Plus className="size-3.5" />
                追加
              </Button>
            </div>

            {settings.customCards.length === 0 ? (
              <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border py-10 text-center">
                <Timer className="size-8 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">
                  カスタムカードはまだありません
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={openAddDialog}
                  className="mt-1 gap-1.5"
                >
                  <Plus className="size-3.5" />
                  最初のカードを追加
                </Button>
              </div>
            ) : (
              <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
                {settings.customCards.map((card) => {
                  const colorOpt =
                    COLOR_OPTIONS.find((c) => c.value === card.color) ??
                    COLOR_OPTIONS[0]!;
                  return (
                    <div
                      key={card.id}
                      className="flex items-center gap-3 px-4 py-3.5"
                    >
                      <div
                        className={cn(
                          "size-3 shrink-0 rounded-full",
                          colorOpt.swatchClass
                        )}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">
                          {card.label}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {card.deadline.replace(/-/g, "/")} まで
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => openEditDialog(card)}
                        className="shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        aria-label="編集"
                      >
                        <Pencil className="size-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTargetId(card.id)}
                        className="shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                        aria-label="削除"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </main>

      {/* ── 追加 / 編集ダイアログ ── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingCard ? "カードを編集" : "カードを追加"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* タイトル */}
            <div className="space-y-1.5">
              <Label htmlFor="cd-label">タイトル</Label>
              <Input
                id="cd-label"
                value={formLabel}
                onChange={(e) => setFormLabel(e.target.value)}
                placeholder="例: 就活解禁まで、試験まで…"
                maxLength={30}
              />
            </div>
            {/* 期限 */}
            <div className="space-y-1.5">
              <Label htmlFor="cd-deadline">期限日</Label>
              <Input
                id="cd-deadline"
                type="date"
                value={formDeadline}
                min={TODAY}
                onChange={(e) => setFormDeadline(e.target.value)}
              />
            </div>
            {/* 色選択 */}
            <div className="space-y-1.5">
              <Label>色</Label>
              <div className="flex gap-3">
                {COLOR_OPTIONS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setFormColor(c.value)}
                    title={c.label}
                    className={cn(
                      "size-8 rounded-full transition-transform hover:scale-110",
                      c.swatchClass,
                      formColor === c.value
                        ? "ring-2 ring-foreground ring-offset-2"
                        : ""
                    )}
                    aria-label={c.label}
                    aria-pressed={formColor === c.value}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
            >
              キャンセル
            </Button>
            <Button
              onClick={handleDialogSave}
              disabled={!formLabel.trim() || !formDeadline}
            >
              {editingCard ? "更新" : "追加"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── 削除確認ダイアログ ── */}
      <AlertDialog
        open={!!deleteTargetId}
        onOpenChange={(open) => { if (!open) setDeleteTargetId(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>カードを削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              このカウントダウンカードをホーム画面から削除します。
              この操作は取り消せません。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTargetId && handleDelete(deleteTargetId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              削除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
