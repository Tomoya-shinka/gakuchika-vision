"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus, MessageCircle, MoreVertical, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  loadSelfAnalysisItems,
  saveSelfAnalysisItems,
  type SelfAnalysisItem,
  type SectionId,
} from "@/lib/self-analysis";
import {
  getSelfAnalysisFromFirestore,
  SECTION_TO_CATEGORY,
} from "@/lib/self-analysis-firestore";
import { SELF_ANALYSIS_SECTIONS } from "@/lib/self-analysis-sections";
import { useAuth } from "@/contexts/auth-context";
import { getDb } from "@/lib/firebase";

export default function SectionDetailPage() {
  const params = useParams();
  const sectionId = params.sectionId as SectionId;
  const section = SELF_ANALYSIS_SECTIONS.find((s) => s.id === sectionId);

  const { user } = useAuth();
  const [items, setItems] = useState<SelfAnalysisItem[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [addText, setAddText] = useState("");

  const load = useCallback(async () => {
    const localItems = loadSelfAnalysisItems();
    if (user?.uid) {
      try {
        const firestoreItems = await getSelfAnalysisFromFirestore(getDb(), user.uid);
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
        unique.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
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

  const sectionItems = items.filter((i) => i.sectionId === sectionId);

  const handleSaveAdd = () => {
    if (!addText.trim()) return;
    const newItem: SelfAnalysisItem = {
      id: crypto.randomUUID(),
      sectionId,
      text: addText.trim(),
      createdAt: new Date().toISOString(),
    };
    const next = [newItem, ...items];
    setItems(next);
    saveSelfAnalysisItems(next);
    setIsAdding(false);
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

  if (!section) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4">
        <p className="text-sm text-muted-foreground">セクションが見つかりません</p>
        <Link href="/self-analysis" className="text-sm text-primary hover:underline">
          ← 自己分析シートに戻る
        </Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[#fafafa] dark:bg-slate-950/50">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background px-4">
        <Link
          href="/self-analysis"
          className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden />
          戻る
        </Link>
        <div className="flex flex-1 items-center gap-2 overflow-hidden">
          <span className="text-xl" aria-hidden>{section.emoji}</span>
          <h1 className="truncate text-base font-semibold">{section.title}</h1>
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${section.bgAccent} ${section.accent}`}>
            {sectionItems.length}件
          </span>
        </div>
        <Button
          asChild
          size="sm"
          variant="outline"
          className={`shrink-0 gap-1.5 border px-3 text-xs ${section.borderAccent} ${section.accent} hover:bg-white/80 dark:hover:bg-slate-800/80`}
        >
          <Link href={`/self-analysis/chat?category=${SECTION_TO_CATEGORY[sectionId]}`}>
            <MessageCircle className="size-3.5" />
            AIと話して整理する
          </Link>
        </Button>
      </header>

      <main className="flex flex-1 flex-col overflow-auto px-4 py-6 sm:px-6">
        <div className="mx-auto w-full max-w-4xl">
          {sectionItems.length === 0 && !isAdding ? (
            <div className={`flex min-h-[160px] flex-col items-center justify-center rounded-xl border border-dashed ${section.borderAccent} ${section.bgAccent} text-center`}>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                まだ記録がありません
              </p>
              <Button
                asChild
                variant="link"
                className={`mt-2 text-sm ${section.accent}`}
              >
                <Link href={`/self-analysis/chat?category=${SECTION_TO_CATEGORY[sectionId]}`}>
                  AIと話して、最初の1つを見つけましょう
                </Link>
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {sectionItems.map((item) => (
                <ItemCard
                  key={item.id}
                  item={item}
                  accent={section.accent}
                  bgAccent={section.bgAccent}
                  borderAccent={section.borderAccent}
                  onDelete={() => handleDelete(item.id)}
                  onEdit={(newText) => handleEdit(item.id, newText)}
                />
              ))}
            </div>
          )}

          {isAdding ? (
            <div className={`mt-4 rounded-xl border ${section.borderAccent} ${section.bgAccent} p-4`}>
              <Input
                placeholder={`例：${section.subtitle}`}
                value={addText}
                onChange={(e) => setAddText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveAdd();
                  if (e.key === "Escape") { setIsAdding(false); setAddText(""); }
                }}
                className="mb-3"
                autoFocus
              />
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" onClick={() => { setIsAdding(false); setAddText(""); }}>
                  キャンセル
                </Button>
                <Button size="sm" onClick={handleSaveAdd} disabled={!addText.trim()}>
                  追加
                </Button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setIsAdding(true)}
              className={`mt-4 inline-flex items-center gap-1.5 rounded-lg border border-dashed ${section.borderAccent} px-3 py-2 text-xs font-medium ${section.accent} transition-colors hover:${section.bgAccent}`}
            >
              <Plus className="size-3.5" />
              追加する
            </button>
          )}
        </div>
      </main>
    </div>
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
    if (editText.trim()) onEdit(editText.trim());
    setEditing(false);
    setModalOpen(false);
  };

  return (
    <>
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
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setEditText(item.text); setEditing(true); setModalOpen(true); }}>
                <Pencil className="mr-2 size-3.5" />
                編集
              </DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onDelete(); }} className="text-destructive focus:text-destructive">
                <Trash2 className="mr-2 size-3.5" />
                削除
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* テキストエリア */}
        <div className="flex flex-1 flex-col overflow-hidden px-3 pb-3">
          <p className="line-clamp-6 overflow-hidden text-sm leading-snug text-slate-800 dark:text-slate-200">
            {item.text}
          </p>
          <p className={`mt-auto pt-1 text-[10px] ${accent}`}>{dateStr}</p>
        </div>
      </div>

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
                <Button size="sm" variant="ghost" className="gap-1.5 text-xs" onClick={() => { setEditText(item.text); setEditing(true); }}>
                  <Pencil className="size-3.5" />編集
                </Button>
                <Button size="sm" variant="ghost" className="gap-1.5 text-xs text-destructive hover:text-destructive" onClick={() => { setModalOpen(false); onDelete(); }}>
                  <Trash2 className="size-3.5" />削除
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
