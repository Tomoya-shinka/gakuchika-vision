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
import { Info, Plus, MessageCircle } from "lucide-react";
import {
  loadSelfAnalysisItems,
  saveSelfAnalysisItems,
  getCountBySection,
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

const sections = SELF_ANALYSIS_SECTIONS;

export default function SelfAnalysisPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<SelfAnalysisItem[]>([]);
  const [addSection, setAddSection] = useState<SectionId | null>(null);
  const [addText, setAddText] = useState("");

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

  const counts = getCountBySection(items);

  const handleAdd = (sectionId: SectionId) => {
    setAddSection(sectionId);
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

  return (
    <TooltipProvider>
      <div className="flex min-h-0 flex-1 flex-col bg-[#fafafa] px-4 pb-20 pt-6 dark:bg-slate-950/50 sm:px-6">
        <header className="mx-auto mb-4 flex w-full max-w-4xl flex-col gap-2">
          <p className="text-xs font-medium uppercase tracking-wide text-sky-600 dark:text-sky-400">
            Self Discovery
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-50 sm:text-3xl">
            自己分析シート
          </h1>

          {/* Stats Row */}
          <div className="flex flex-wrap gap-2">
            {sections.map((s) => (
              <span
                key={s.id}
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${s.bgAccent} ${s.accent} ${s.borderAccent} border`}
              >
                {s.shortLabel} {counts[s.id]}件
              </span>
            ))}
          </div>
        </header>

        <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 pb-8">
          {sections.map((section) => {
            const Icon = section.icon;
            const sectionItems = items.filter((i) => i.sectionId === section.id);

            return (
              <Card
                key={section.id}
                className={`flex flex-col overflow-hidden border bg-white/95 shadow-sm transition-colors dark:bg-slate-900/80 ${section.borderAccent} border`}
              >
                <CardHeader className="flex flex-row items-start justify-between gap-3 pb-2">
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <div
                      className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${section.bgAccent} ${section.accent}`}
                    >
                      <span className="text-xl" aria-hidden>
                        {section.emoji}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <CardTitle className="truncate text-base font-semibold leading-tight">
                          {section.title}
                        </CardTitle>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              className="shrink-0 rounded-full p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
                              aria-label="このセクションの説明"
                            >
                              <Info className="size-3.5" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent
                            side="right"
                            className="max-w-[280px] text-xs"
                          >
                            {section.description}
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                        {section.subtitle}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-8 gap-1 px-2 text-xs text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                      onClick={() => handleAdd(section.id)}
                    >
                      <Plus className="size-3.5" />
                      追加
                    </Button>
                    <Button
                      asChild
                      type="button"
                      size="sm"
                      variant="outline"
                      className={`h-8 gap-1 border px-2.5 text-xs ${section.borderAccent} ${section.accent} hover:bg-white/80 dark:hover:bg-slate-800/80`}
                    >
                      <Link
                        href={`/self-analysis/chat?category=${SECTION_TO_CATEGORY[section.id]}`}
                      >
                        <MessageCircle className="size-3.5" />
                        AIと話して整理する
                      </Link>
                    </Button>
                  </div>
                </CardHeader>

                <CardContent className="pt-0">
                  {sectionItems.length === 0 ? (
                    <div
                      className={`flex min-h-[100px] flex-col items-center justify-center rounded-lg border border-dashed ${section.borderAccent} ${section.bgAccent} py-8 text-center`}
                    >
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        AIと話して、最初の1つを見つけましょう
                      </p>
                      <Button
                        asChild
                        variant="link"
                        className={`mt-2 text-sm ${section.accent}`}
                      >
                        <Link
                          href={`/self-analysis/chat?category=${SECTION_TO_CATEGORY[section.id]}`}
                        >
                          <Icon className="mr-1.5 size-4" />
                          AIと話して、最初の1つを見つけましょう
                        </Link>
                      </Button>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {sectionItems.map((item) => (
                        <ItemCard
                          key={item.id}
                          item={item}
                          accent={section.accent}
                          bgAccent={section.bgAccent}
                          onDelete={() => handleDelete(item.id)}
                        />
                      ))}
                    </div>
                  )}
                  {/* インライン追加フォーム */}
                  {addSection === section.id ? (
                    <div
                      className={`mt-2 rounded-lg border ${section.borderAccent} ${section.bgAccent} p-3`}
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
          })}
        </main>
      </div>

    </TooltipProvider>
  );
}

function ItemCard({
  item,
  accent,
  bgAccent,
  onDelete,
}: {
  item: SelfAnalysisItem;
  accent: string;
  bgAccent: string;
  onDelete: () => void;
}) {
  const [showDel, setShowDel] = useState(false);
  const date = new Date(item.createdAt);
  const dateStr =
    date.toDateString() === new Date().toDateString()
      ? "今日"
      : date.toLocaleDateString("ja-JP", {
          month: "short",
          day: "numeric",
          year: date.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined,
        });

  return (
    <div
      className={`group relative rounded-lg border ${bgAccent} p-3 shadow-sm transition-colors`}
      onMouseEnter={() => setShowDel(true)}
      onMouseLeave={() => setShowDel(false)}
    >
      <p className="text-sm text-slate-800 dark:text-slate-200 line-clamp-3">
        {item.text}
      </p>
      <p className={`mt-2 text-xs ${accent}`}>{dateStr}</p>
      {showDel && (
        <button
          type="button"
          onClick={onDelete}
          className="absolute top-1.5 right-1.5 rounded p-1 text-slate-400 hover:bg-slate-200/80 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-300"
          aria-label="削除"
        >
          ×
        </button>
      )}
    </div>
  );
}
