"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { Info, Plus, MessageCircle, ChevronRight, MoreVertical, Pencil, Trash2, FolderPlus } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  loadSelfAnalysisItems,
  saveSelfAnalysisItems,
  getCountBySection,
  type SelfAnalysisItem,
} from "@/lib/self-analysis";
import {
  getSelfAnalysisFromFirestore,
} from "@/lib/self-analysis-firestore";
import {
  loadFolders,
  saveFolders,
  getFolderAccent,
  FOLDER_COLOR_OPTIONS,
  EMOJI_OPTIONS,
  type SelfAnalysisFolder,
} from "@/lib/self-analysis-folders";
import { useAuth } from "@/contexts/auth-context";
import { getDb } from "@/lib/firebase";
import { cn } from "@/lib/utils";

// ─── フォルダ作成/編集フォーム ────────────────────────────────────────────
interface FolderFormProps {
  folderName: string; setFolderName: (v: string) => void;
  folderEmoji: string; setFolderEmoji: (v: string) => void;
  folderColor: string; setFolderColor: (v: string) => void;
  folderDescription: string; setFolderDescription: (v: string) => void;
  onKeyDownName?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  autoFocus?: boolean;
}

function FolderForm({
  folderName, setFolderName,
  folderEmoji, setFolderEmoji,
  folderColor, setFolderColor,
  folderDescription, setFolderDescription,
  onKeyDownName, autoFocus,
}: FolderFormProps) {
  return (
    <div className="space-y-4">
      {/* フォルダ名 */}
      <div>
        <p className="mb-1.5 text-xs font-medium text-slate-500">フォルダ名</p>
        <Input
          placeholder="例：感謝したこと"
          value={folderName}
          onChange={(e) => setFolderName(e.target.value)}
          autoFocus={autoFocus}
          onKeyDown={onKeyDownName}
        />
      </div>

      {/* 絵文字ピッカー */}
      <div>
        <p className="mb-1.5 text-xs font-medium text-slate-500">
          絵文字 <span className="ml-1 text-base">{folderEmoji}</span>
        </p>
        <div className="grid max-h-40 grid-cols-10 gap-0.5 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-1.5 dark:border-slate-700 dark:bg-slate-900/50">
          {EMOJI_OPTIONS.map((emoji, i) => (
            <button
              key={`${emoji}-${i}`}
              type="button"
              onClick={() => setFolderEmoji(emoji)}
              className={cn(
                "flex size-8 items-center justify-center rounded text-lg transition-colors hover:bg-slate-200 dark:hover:bg-slate-700",
                folderEmoji === emoji && "bg-sky-100 ring-2 ring-sky-400 dark:bg-sky-900/50"
              )}
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>

      {/* カラーパレット */}
      <div>
        <p className="mb-1.5 text-xs font-medium text-slate-500">カラー</p>
        <div className="flex flex-wrap gap-2">
          {FOLDER_COLOR_OPTIONS.map((color) => (
            <button
              key={color.id}
              type="button"
              onClick={() => setFolderColor(color.id)}
              title={color.label}
              className={cn(
                "flex size-8 items-center justify-center rounded-full transition-all",
                color.swatch,
                folderColor === color.id
                  ? "ring-2 ring-offset-2 ring-slate-500 scale-110"
                  : "opacity-70 hover:opacity-100"
              )}
            />
          ))}
        </div>
      </div>

      {/* 説明（任意） */}
      <div>
        <p className="mb-1.5 text-xs font-medium text-slate-500">説明（任意）</p>
        <Input
          placeholder="例：毎日の小さな気づきを記録"
          value={folderDescription}
          onChange={(e) => setFolderDescription(e.target.value)}
        />
      </div>
    </div>
  );
}

export default function SelfAnalysisPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<SelfAnalysisItem[]>([]);
  const [folders, setFolders] = useState<SelfAnalysisFolder[]>([]);
  const [addSection, setAddSection] = useState<string | null>(null);
  const [addText, setAddText] = useState("");

  // フォルダ作成/編集ダイアログ
  const [showAddFolder, setShowAddFolder] = useState(false);
  const [editingFolder, setEditingFolder] = useState<SelfAnalysisFolder | null>(null);
  const [folderName, setFolderName] = useState("");
  const [folderEmoji, setFolderEmoji] = useState("📁");
  const [folderColor, setFolderColor] = useState("sky");
  const [folderDescription, setFolderDescription] = useState("");

  // フォルダ削除確認ダイアログ
  const [deleteTargetFolder, setDeleteTargetFolder] = useState<SelfAnalysisFolder | null>(null);

  const load = useCallback(async () => {
    const localItems = loadSelfAnalysisItems();
    if (user?.uid) {
      try {
        const firestoreItems = await getSelfAnalysisFromFirestore(
          getDb(),
          user.uid
        );
        const merged = [
          ...localItems,
          ...firestoreItems.map((f) => ({
            id: f.id,
            sectionId: f.sectionId,
            text: f.content,
            createdAt: f.createdAt,
          })),
        ];
        const seen = new Set<string>();
        const unique = merged.filter((i) => {
          const key = `${i.sectionId}:${i.text}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        unique.sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        setItems(unique);
      } catch {
        setItems(localItems);
      }
    } else {
      setItems(localItems);
    }
  }, [user?.uid]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const loaded = loadFolders();
    setFolders(loaded);
  }, []);

  const counts = getCountBySection(items);

  const handleAdd = (folderId: string) => {
    setAddSection(folderId);
    setAddText("");
  };

  const handleSaveAdd = () => {
    if (!addSection || !addText.trim()) return;
    const newItem: SelfAnalysisItem = {
      id: crypto.randomUUID(),
      sectionId: addSection,
      text: addText.trim(),
      createdAt: new Date().toISOString(),
    };
    const next = [newItem, ...items];
    setItems(next);
    saveSelfAnalysisItems(next);
    setAddSection(null);
    setAddText("");
  };

  const handleDelete = (id: string) => {
    const next = items.filter((i) => i.id !== id);
    setItems(next);
    saveSelfAnalysisItems(next);
  };

  const handleEdit = (id: string, newText: string) => {
    const next = items.map((i) => i.id === id ? { ...i, text: newText } : i);
    setItems(next);
    saveSelfAnalysisItems(next);
  };

  // ─── フォルダ操作 ───────────────────────────────────────────────────────

  const resetFolderForm = () => {
    setFolderName("");
    setFolderEmoji("📁");
    setFolderColor("sky");
    setFolderDescription("");
  };

  const handleOpenAddFolder = () => {
    resetFolderForm();
    setShowAddFolder(true);
  };

  const handleCreateFolder = () => {
    const newFolder: SelfAnalysisFolder = {
      id: crypto.randomUUID(),
      name: folderName.trim(),
      emoji: folderEmoji || "📁",
      color: folderColor,
      description: folderDescription.trim() || undefined,
      order: folders.length,
      createdAt: new Date().toISOString(),
      isDefault: false,
    };
    const next = [...folders, newFolder];
    setFolders(next);
    saveFolders(next);
    setShowAddFolder(false);
    resetFolderForm();
  };

  const handleOpenEditFolder = (folder: SelfAnalysisFolder) => {
    setEditingFolder(folder);
    setFolderName(folder.name);
    setFolderEmoji(folder.emoji);
    setFolderColor(folder.color ?? "sky");
    setFolderDescription(folder.description ?? "");
  };

  const handleSaveEditFolder = () => {
    if (!editingFolder || !folderName.trim()) return;
    const updated: SelfAnalysisFolder = {
      ...editingFolder,
      name: folderName.trim(),
      emoji: folderEmoji || "📁",
      color: folderColor,
      description: folderDescription.trim() || undefined,
    };
    const next = folders.map((f) => f.id === editingFolder.id ? updated : f);
    setFolders(next);
    saveFolders(next);
    setEditingFolder(null);
    resetFolderForm();
  };

  const handleDeleteFolder = (folder: SelfAnalysisFolder) => {
    const hasItems = items.some((i) => i.sectionId === folder.id);
    if (hasItems) {
      setDeleteTargetFolder(folder);
    } else {
      doDeleteFolder(folder.id);
    }
  };

  const doDeleteFolder = (folderId: string) => {
    const nextFolders = folders.filter((f) => f.id !== folderId);
    setFolders(nextFolders);
    saveFolders(nextFolders);
    const nextItems = items.filter((i) => i.sectionId !== folderId);
    setItems(nextItems);
    saveSelfAnalysisItems(nextItems);
    setDeleteTargetFolder(null);
  };

  return (
    <TooltipProvider>
      <div className="flex min-h-0 flex-1 flex-col bg-[#fafafa] px-4 pb-20 pt-6 dark:bg-slate-950/50 sm:px-6">
        <header className="mx-auto mb-4 flex w-full max-w-4xl flex-col gap-2">
          <p className="text-xs font-medium uppercase tracking-wide text-sky-600 dark:text-sky-400">
            Self Discovery
          </p>
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-50 sm:text-3xl">
              自己分析シート
            </h1>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="shrink-0 gap-1.5 text-xs"
              onClick={handleOpenAddFolder}
            >
              <FolderPlus className="size-3.5" />
              フォルダを追加
            </Button>
          </div>

          {/* Stats Row */}
          <div className="flex flex-wrap gap-2">
            {folders.map((folder, index) => {
              const { accent, bgAccent, borderAccent } = getFolderAccent(folder.color, index);
              return (
                <span
                  key={folder.id}
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${bgAccent} ${accent} ${borderAccent} border`}
                >
                  {folder.emoji} {folder.name} {counts[folder.id] ?? 0}件
                </span>
              );
            })}
          </div>
        </header>

        <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 pb-8">
          {folders.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white/60 py-16 text-center dark:border-slate-700 dark:bg-slate-900/40">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                フォルダがまだありません
              </p>
              <Button
                type="button"
                variant="link"
                className="mt-2 gap-1.5 text-sm text-sky-600"
                onClick={handleOpenAddFolder}
              >
                <FolderPlus className="size-4" />
                最初のフォルダを作成する
              </Button>
            </div>
          ) : (
            folders.map((folder, index) => {
              const { accent, bgAccent, borderAccent } = getFolderAccent(folder.color, index);
              const sectionItems = items.filter((i) => i.sectionId === folder.id);

              return (
                <Card
                  key={folder.id}
                  className={`flex flex-col overflow-hidden border bg-white/95 shadow-sm transition-colors dark:bg-slate-900/80 ${borderAccent} border`}
                >
                  <CardHeader className="flex flex-row items-start justify-between gap-3 pb-2">
                    <div className="flex min-w-0 flex-1 items-start gap-3">
                      <div
                        className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${bgAccent} ${accent}`}
                      >
                        <span className="text-xl" aria-hidden>
                          {folder.emoji}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <CardTitle className="truncate text-base font-semibold leading-tight">
                            {folder.name}
                          </CardTitle>
                          {folder.description && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  type="button"
                                  className="shrink-0 rounded-full p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
                                  aria-label="このフォルダの説明"
                                >
                                  <Info className="size-3.5" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent
                                side="right"
                                className="max-w-[280px] text-xs"
                              >
                                {folder.description}
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                        {folder.description && (
                          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                            {folder.description}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-8 gap-1 px-2 text-xs text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                        onClick={() => handleAdd(folder.id)}
                      >
                        <Plus className="size-3.5" />
                        追加
                      </Button>
                      <Button
                        asChild
                        type="button"
                        size="sm"
                        variant="outline"
                        className={`h-8 gap-1 border px-2.5 text-xs ${borderAccent} ${accent} hover:bg-white/80 dark:hover:bg-slate-800/80`}
                      >
                        <Link
                          href={`/self-analysis/chat?folderId=${encodeURIComponent(folder.id)}&folderName=${encodeURIComponent(folder.name)}`}
                        >
                          <MessageCircle className="size-3.5" />
                          AIと話して整理する
                        </Link>
                      </Button>
                      {/* フォルダ操作メニュー */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            className="flex size-8 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
                            aria-label="フォルダメニュー"
                          >
                            <MoreVertical className="size-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40">
                          <DropdownMenuItem
                            onClick={() => handleOpenEditFolder(folder)}
                          >
                            <Pencil className="mr-2 size-3.5" />
                            フォルダを編集
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => handleDeleteFolder(folder)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="mr-2 size-3.5" />
                            フォルダを削除
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardHeader>

                  <CardContent className="pt-0">
                    {sectionItems.length === 0 ? (
                      <div
                        className={`flex min-h-[100px] flex-col items-center justify-center rounded-lg border border-dashed ${borderAccent} ${bgAccent} py-8 text-center`}
                      >
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                          AIと話して、最初の1つを見つけましょう
                        </p>
                        <Button
                          asChild
                          variant="link"
                          className={`mt-2 text-sm ${accent}`}
                        >
                          <Link
                            href={`/self-analysis/chat?folderId=${encodeURIComponent(folder.id)}&folderName=${encodeURIComponent(folder.name)}`}
                          >
                            <MessageCircle className="mr-1.5 size-4" />
                            AIと話して、最初の1つを見つけましょう
                          </Link>
                        </Button>
                      </div>
                    ) : (
                      <div>
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                          {sectionItems.slice(0, 4).map((item) => (
                            <ItemCard
                              key={item.id}
                              item={item}
                              accent={accent}
                              bgAccent={bgAccent}
                              borderAccent={borderAccent}
                              onDelete={() => handleDelete(item.id)}
                              onEdit={(newText) => handleEdit(item.id, newText)}
                            />
                          ))}
                        </div>
                        {sectionItems.length > 4 && (
                          <Link
                            href={`/self-analysis/${folder.id}`}
                            className={`mt-3 inline-flex items-center gap-0.5 text-xs font-medium ${accent} hover:underline`}
                          >
                            もっと見る（{sectionItems.length - 4}件）
                            <ChevronRight className="size-3" />
                          </Link>
                        )}
                      </div>
                    )}
                    {/* インライン追加フォーム */}
                    {addSection === folder.id ? (
                      <div
                        className={`mt-2 rounded-lg border ${borderAccent} ${bgAccent} p-3`}
                      >
                        <Input
                          placeholder="例：テストで満点を取れた"
                          value={addText}
                          onChange={(e) => setAddText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleSaveAdd();
                            if (e.key === "Escape") setAddSection(null);
                          }}
                          className="mb-2"
                          autoFocus
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setAddSection(null)}
                          >
                            キャンセル
                          </Button>
                          <Button
                            size="sm"
                            onClick={handleSaveAdd}
                            disabled={!addText.trim()}
                          >
                            追加
                          </Button>
                        </div>
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              );
            })
          )}
        </main>
      </div>

      {/* ─── フォルダ作成ダイアログ ─── */}
      <Dialog open={showAddFolder} onOpenChange={setShowAddFolder}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>新しいフォルダを作成</DialogTitle>
          </DialogHeader>
          <FolderForm
            folderName={folderName}
            setFolderName={setFolderName}
            folderEmoji={folderEmoji}
            setFolderEmoji={setFolderEmoji}
            folderColor={folderColor}
            setFolderColor={setFolderColor}
            folderDescription={folderDescription}
            setFolderDescription={setFolderDescription}
            onKeyDownName={(e) => { if (e.key === "Enter" && folderName.trim()) handleCreateFolder(); }}
            autoFocus
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowAddFolder(false)}>キャンセル</Button>
            <Button onClick={handleCreateFolder} disabled={!folderName.trim()}>作成</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── フォルダ編集ダイアログ ─── */}
      <Dialog open={!!editingFolder} onOpenChange={(o) => { if (!o) setEditingFolder(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>フォルダを編集</DialogTitle>
          </DialogHeader>
          <FolderForm
            folderName={folderName}
            setFolderName={setFolderName}
            folderEmoji={folderEmoji}
            setFolderEmoji={setFolderEmoji}
            folderColor={folderColor}
            setFolderColor={setFolderColor}
            folderDescription={folderDescription}
            setFolderDescription={setFolderDescription}
            onKeyDownName={(e) => { if (e.key === "Enter" && folderName.trim()) handleSaveEditFolder(); }}
            autoFocus
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditingFolder(null)}>キャンセル</Button>
            <Button onClick={handleSaveEditFolder} disabled={!folderName.trim()}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── フォルダ削除確認ダイアログ ─── */}
      <Dialog open={!!deleteTargetFolder} onOpenChange={(o) => { if (!o) setDeleteTargetFolder(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>フォルダを削除しますか？</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            「{deleteTargetFolder?.name}」を削除すると、このフォルダ内の{" "}
            <span className="font-semibold text-destructive">
              {deleteTargetFolder ? (counts[deleteTargetFolder.id] ?? 0) : 0}件のアイテム
            </span>
            もすべて削除されます。この操作は元に戻せません。
          </p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteTargetFolder(null)}>
              キャンセル
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteTargetFolder && doDeleteFolder(deleteTargetFolder.id)}
            >
              削除する
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}

function ItemCard({
  item,
  accent,
  bgAccent,
  borderAccent,
  onDelete,
  onEdit,
}: {
  item: SelfAnalysisItem;
  accent: string;
  bgAccent: string;
  borderAccent: string;
  onDelete: () => void;
  onEdit: (newText: string) => void;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(item.text);

  const date = new Date(item.createdAt);
  const dateStr =
    date.toDateString() === new Date().toDateString()
      ? "今日"
      : date.toLocaleDateString("ja-JP", {
          month: "short",
          day: "numeric",
          year: date.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined,
        });

  const handleSaveEdit = () => {
    if (editText.trim()) {
      onEdit(editText.trim());
    }
    setEditing(false);
    setModalOpen(false);
  };

  return (
    <>
      {/* カード */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => { setEditing(false); setEditText(item.text); setModalOpen(true); }}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { setEditing(false); setEditText(item.text); setModalOpen(true); } }}
        className={`group flex aspect-square cursor-pointer flex-col overflow-hidden rounded-xl border ${borderAccent} ${bgAccent} shadow-sm transition-colors hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-ring`}
      >
        {/* 上部余白バー：⋮ メニューをここに配置 */}
        <div className="flex h-7 shrink-0 items-center justify-end px-1.5">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                onClick={(e) => e.stopPropagation()}
                className="flex size-6 items-center justify-center rounded-full text-slate-400 opacity-0 transition-opacity hover:bg-slate-200/80 hover:text-slate-700 group-hover:opacity-100 dark:hover:bg-slate-700 dark:hover:text-slate-300"
                aria-label="メニュー"
              >
                <MoreVertical className="size-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-28">
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  setEditText(item.text);
                  setEditing(true);
                  setModalOpen(true);
                }}
              >
                <Pencil className="mr-2 size-3.5" />
                編集
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={(e) => { e.stopPropagation(); onDelete(); }}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 size-3.5" />
                削除
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* テキストエリア */}
        <div className="flex flex-1 flex-col overflow-hidden px-2.5 pb-2.5">
          <p className="line-clamp-6 overflow-hidden text-sm leading-snug text-slate-800 dark:text-slate-200">
            {item.text}
          </p>
          <p className={`mt-auto pt-1 text-[10px] ${accent}`}>{dateStr}</p>
        </div>
      </div>

      {/* 全文モーダル */}
      <Dialog open={modalOpen} onOpenChange={(o) => { setModalOpen(o); if (!o) setEditing(false); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className={`text-sm font-medium ${accent}`}>{dateStr}</DialogTitle>
          </DialogHeader>
          {editing ? (
            <div className="flex flex-col gap-3">
              <Textarea
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                className="min-h-[120px] resize-none text-sm"
                autoFocus
              />
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>キャンセル</Button>
                <Button size="sm" onClick={handleSaveEdit} disabled={!editText.trim()}>保存</Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <p className="text-sm leading-relaxed text-slate-800 dark:text-slate-200">{item.text}</p>
              <div className="flex justify-end gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  className="gap-1.5 text-xs"
                  onClick={() => { setEditText(item.text); setEditing(true); }}
                >
                  <Pencil className="size-3.5" />
                  編集
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="gap-1.5 text-xs text-destructive hover:text-destructive"
                  onClick={() => { setModalOpen(false); onDelete(); }}
                >
                  <Trash2 className="size-3.5" />
                  削除
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
