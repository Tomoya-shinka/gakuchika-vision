"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSidebar } from "@/components/ui/sidebar";
import { useAuth } from "@/contexts/auth-context";
import {
  loadEntries,
  saveEntries,
  type JournalEntry,
  type JournalVisibility,
} from "@/lib/journal";
import {
  loadGoals,
  formatDeadlineShort,
  type GoalsData,
  type GoalItem,
} from "@/lib/goals";
import { getDb } from "@/lib/firebase";
import { collection, addDoc, Timestamp, doc, getDoc } from "firebase/firestore";
import {
  Sparkles,
  FileText,
  ChevronDown,
  Target,
  Flag,
  Calendar,
  ExternalLink,
  Globe,
  Lock,
  Loader2,
  Bold,
  Italic,
  Strikethrough,
  List,
  ListOrdered,
} from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { JournalRichEditor } from "@/components/journal-rich-editor";
import { StyleSelector } from "@/components/style-selector";
import type { Editor } from "@tiptap/react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { calculateUnivDay, formatUniversityDayLabel } from "@/lib/university-life";

type JournalTemplate = "free";

const TEMPLATE_LABELS: Record<JournalTemplate, string> = {
  free: "通常モード（自由記述）",
};

const AI_THEME_QUESTIONS = [
  "今、一番時間を使いたいことは？",
  "今日、自分の成長を感じた瞬間は？",
  "今日はどんな一日だった？",
  "今の悩みや、やりたいことは？",
];

function getRandomQuestion(): string {
  const idx = Math.floor(Math.random() * AI_THEME_QUESTIONS.length);
  return AI_THEME_QUESTIONS[idx] ?? AI_THEME_QUESTIONS[0];
}

const inputBase =
  "w-full resize-none border-none bg-transparent outline-none shadow-none ring-0 focus:ring-0 focus:ring-offset-0 focus-visible:ring-0 focus-visible:ring-offset-0";

function GoalRefCard({
  title,
  item,
  icon: Icon,
}: {
  title: string;
  item: GoalItem;
  icon: React.ComponentType<{ className?: string }>;
}) {
  const isEmpty = !item.content.trim();
  return (
    <Card className="overflow-hidden border-slate-200/80 bg-slate-50/80 dark:border-slate-700/60 dark:bg-slate-900/30">
      <CardHeader className="flex flex-row items-center gap-2 space-y-0 px-4 pb-2 pt-4">
        <div className="flex size-6 shrink-0 items-center justify-center rounded-md bg-sky-100 dark:bg-sky-900/40">
          <Icon className="size-3 text-sky-600 dark:text-sky-400" />
        </div>
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1.5 px-4 pb-4 pt-0">
        <p className="whitespace-pre-wrap text-sm font-medium leading-relaxed text-foreground">
          {isEmpty ? (
            <span className="font-normal text-muted-foreground">
              目標が未設定です
            </span>
          ) : (
            item.content
          )}
        </p>
        {!isEmpty && item.image.trim() && (
          <p className="whitespace-pre-wrap text-xs leading-relaxed text-slate-600 dark:text-slate-400">
            {item.image}
          </p>
        )}
        {item.deadline && (
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <Calendar className="size-3" aria-hidden />
            期限：{formatDeadlineShort(item.deadline)}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function GoalsPanelContent({ data }: { data: GoalsData }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        <GoalRefCard
          title="長期ビジョン（卒業後の姿）"
          item={data.longTermVision}
          icon={Target}
        />
        <GoalRefCard title="1年後の目標" item={data.oneYearGoal} icon={Flag} />
        <GoalRefCard
          title="1ヶ月後の目標"
          item={data.oneMonthGoal}
          icon={Calendar}
        />
      </div>
      <Link
        href="/mypage/goals"
        className="mt-2 flex items-center justify-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-slate-50 hover:text-foreground dark:border-slate-700 dark:bg-slate-800/50 dark:hover:bg-slate-800 dark:hover:text-foreground"
      >
        <ExternalLink className="size-3" aria-hidden />
        My Pageで目標を編集する
      </Link>
    </div>
  );
}


export default function JournalPage() {
  const router = useRouter();
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const { state: sidebarState } = useSidebar();
  const isSidebarOpen = sidebarState === "expanded";

  const [template] = useState<JournalTemplate>("free");
  const [goalsPanelOpen, setGoalsPanelOpen] = useState(false);
  const [goalsData, setGoalsData] = useState<GoalsData | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [aiQuestion, setAiQuestion] = useState<string | null>(null);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showSelfAnalysisPrompt, setShowSelfAnalysisPrompt] = useState(false);

  const freeEditorRef = useRef<Editor | null>(null);
  const [, setEditorUpdateTick] = useState(0);
  const titleInputRef = useRef<HTMLInputElement | null>(null);
  const [freeEditorKey, setFreeEditorKey] = useState(0);
  const [freeEditorEmpty, setFreeEditorEmpty] = useState(true);
  const [freeEditorCharCount, setFreeEditorCharCount] = useState(0);
  const [todayDayLabel, setTodayDayLabel] = useState<string | null>(null);

  useEffect(() => {
    if (goalsPanelOpen) {
      setGoalsData(loadGoals());
    }
  }, [goalsPanelOpen]);

  useEffect(() => {
    if (!user?.uid) {
      setTodayDayLabel(null);
      return;
    }
    const load = async () => {
      try {
        const snap = await getDoc(doc(getDb(), "users", user.uid));
        const data = snap.data() as Record<string, unknown> | undefined;
        const enrollment = data?.enrollmentDate ?? undefined;
        const day = calculateUnivDay(new Date(), enrollment);
        setTodayDayLabel(day != null ? formatUniversityDayLabel(day) : null);
      } catch {
        setTodayDayLabel(null);
      }
    };
    load();
  }, [user?.uid]);

  const handleAiTheme = () => {
    setAiQuestion(getRandomQuestion());
  };

  const hasTitleOrContent =
    title.trim().length > 0 || !freeEditorEmpty || content.trim().length > 0;

  const performSave = async (visibility: JournalVisibility) => {
    const html = (freeEditorRef.current?.getHTML() ?? "").trim();
    const trimmed = html || content.trim();
    if (!trimmed || isSaving) return;

    setIsSaving(true);
    try {
      const createdAt = new Date().toISOString();
      let entryId = crypto.randomUUID();

      if (user?.uid) {
        try {
          const db = getDb();
          const ref = await addDoc(collection(db, "journals"), {
            userId: user.uid,
            title: title.trim() || "",
            content: trimmed,
            createdAt: Timestamp.fromDate(new Date(createdAt)),
            isPublic: visibility === "public",
            visibility,
          });
          entryId = ref.id;
        } catch (err) {
          console.error("[journal] failed to save entry to Firestore:", err);
          toast.error("保存に失敗しました");
          return;
        }
      }

      const newEntry: JournalEntry = {
        id: entryId,
        content: trimmed,
        title: title.trim() || undefined,
        visibility,
        createdAt,
        category: "未分類",
      };

      const updated = [newEntry, ...loadEntries()];
      saveEntries(updated);

      setTitle("");
      setContent("");
      freeEditorRef.current?.commands.setContent("");
      setFreeEditorEmpty(true);
      setFreeEditorCharCount(0);
      setFreeEditorKey((k) => k + 1);
      setAiQuestion(null);
      setIsSaveModalOpen(false);

      toast.success("保存しました", {
        description:
          visibility === "public"
            ? "みんなのジャーナルに公開されました。"
            : "記録を保存しました。My Pageの記録で確認できます。",
        duration: 4000,
      });

      if (visibility === "private") {
        router.push("/");
      } else {
        router.push("/mypage/records");
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveClick = () => {
    const html = (freeEditorRef.current?.getHTML() ?? "").trim();
    const trimmed = html || content.trim();
    if (!trimmed) return;
    setIsSaveModalOpen(true);
  };

  const effectiveTotalChars = freeEditorCharCount || content.length;

  return (
    <div className="flex min-h-full flex-1 flex-col bg-[#fafafa] dark:bg-slate-950/50">
      <header className="sticky top-0 z-50 flex h-14 w-full shrink-0 flex-nowrap items-center justify-between overflow-visible border-b border-slate-200/60 bg-white px-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex shrink-0 flex-nowrap items-center gap-2">
          <h1 className="hidden text-sm font-medium text-slate-600 dark:text-slate-400 sm:block">
            ジャーナル
          </h1>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="shrink-0 gap-2 whitespace-nowrap text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
              >
                <FileText className="size-4" aria-hidden />
                テンプレート
                <ChevronDown className="size-3.5" aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem disabled>{TEMPLATE_LABELS.free}</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex min-w-0 flex-1 flex-nowrap items-center justify-center overflow-visible px-2">
          <div className="flex items-center gap-2">
            <StyleSelector editor={freeEditorRef.current} variant="toolbar" />

            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={cn(
                "size-8 shrink-0",
                freeEditorRef.current?.isActive("bold")
                  ? "bg-slate-200 text-slate-900 dark:bg-slate-700 dark:text-slate-100"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
              )}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() =>
                freeEditorRef.current?.chain().focus().toggleBold().run()
              }
              title="太字"
            >
              <Bold className="size-4" aria-hidden />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={cn(
                "size-8 shrink-0",
                freeEditorRef.current?.isActive("italic")
                  ? "bg-slate-200 text-slate-900 dark:bg-slate-700 dark:text-slate-100"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
              )}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() =>
                freeEditorRef.current?.chain().focus().toggleItalic().run()
              }
              title="斜体"
            >
              <Italic className="size-4" aria-hidden />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={cn(
                "size-8 shrink-0",
                freeEditorRef.current?.isActive("strike")
                  ? "bg-slate-200 text-slate-900 dark:bg-slate-700 dark:text-slate-100"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
              )}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() =>
                freeEditorRef.current?.chain().focus().toggleStrike().run()
              }
              title="打ち消し線"
            >
              <Strikethrough className="size-4" aria-hidden />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={cn(
                "size-8 shrink-0",
                freeEditorRef.current?.isActive("bulletList")
                  ? "bg-slate-200 text-slate-900 dark:bg-slate-700 dark:text-slate-100"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
              )}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() =>
                freeEditorRef.current
                  ?.chain()
                  .focus()
                  .toggleBulletList()
                  .run()
              }
              title="箇条書き"
            >
              <List className="size-4" aria-hidden />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={cn(
                "size-8 shrink-0",
                freeEditorRef.current?.isActive("orderedList")
                  ? "bg-slate-200 text-slate-900 dark:bg-slate-700 dark:text-slate-100"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
              )}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() =>
                freeEditorRef.current
                  ?.chain()
                  .focus()
                  .toggleOrderedList()
                  .run()
              }
              title="番号付きリスト"
            >
              <ListOrdered className="size-4" aria-hidden />
            </Button>
          </div>
        </div>

        <div className="ml-auto flex shrink-0 flex-nowrap items-center gap-2 whitespace-nowrap border-l border-slate-200/60 pl-3 dark:border-slate-700">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setGoalsPanelOpen((prev) => !prev)}
            className={cn(
              "shrink-0 whitespace-nowrap gap-2",
              goalsPanelOpen
                ? "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            )}
          >
            <Target className="size-4 shrink-0" aria-hidden />
            目標を表示
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleAiTheme}
            className="shrink-0 whitespace-nowrap gap-2 text-slate-600 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <Sparkles className="size-4 shrink-0" aria-hidden />
            AI相談
          </Button>
          <Button
            onClick={handleSaveClick}
            disabled={!hasTitleOrContent}
            size="sm"
            className="shrink-0 whitespace-nowrap"
          >
            保存
          </Button>
        </div>
      </header>

      {todayDayLabel ? (
        <div className="border-b border-slate-100 bg-slate-50/60 px-4 py-2 text-xs font-medium text-slate-600 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-200 sm:px-6">
          {todayDayLabel}
        </div>
      ) : (
        <div className="border-b border-slate-100 bg-amber-50/80 px-4 py-2 text-xs text-amber-700 dark:border-slate-800 dark:bg-slate-900/60 dark:text-amber-300 sm:px-6">
          入学年月日を設定すると、ここに「大学生活 ○日目」が表示されます（My Page のプロフィール編集から設定できます）。
        </div>
      )}

      <main className="flex flex-1 flex-col overflow-auto">
        <div
          className={cn(
            "flex flex-1",
            !isMobile && goalsPanelOpen ? "flex-row" : "flex-col"
          )}
        >
          {!isMobile && goalsPanelOpen && (
            <aside className="flex w-72 shrink-0 flex-col border-r border-slate-200/60 bg-white/80 dark:border-slate-800 dark:bg-slate-900/50">
              <div className="sticky top-0 border-b border-slate-200/60 bg-white/95 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/90">
                <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  あなたの目標
                </h2>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                {goalsData ? (
                  <GoalsPanelContent data={goalsData} />
                ) : (
                  <p className="text-sm text-muted-foreground">読み込み中...</p>
                )}
              </div>
            </aside>
          )}

          <div className="flex min-w-0 flex-1 flex-col overflow-auto">
            <div className="mx-auto w-full max-w-3xl flex-1 px-6 pt-16 pb-12 md:px-12 md:pt-20 md:pb-16">
              {aiQuestion && (
                <div className="mb-6 rounded-lg border border-sky-200/80 bg-sky-50/80 px-4 py-3 dark:border-sky-800 dark:bg-sky-950/40">
                  <p className="text-xs font-medium text-sky-600 dark:text-sky-400">
                    AIからのテーマ
                  </p>
                  <p className="mt-1 text-sm font-medium text-sky-900 dark:text-sky-100">
                    {aiQuestion}
                  </p>
                </div>
              )}

              <div
                data-journal-editor
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === "b") {
                    e.stopPropagation();
                  }
                }}
              >
                <input
                  ref={titleInputRef}
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      freeEditorRef.current?.commands.focus();
                    }
                  }}
                  placeholder="タイトル"
                  className={cn(
                    inputBase,
                    "mb-1 text-4xl font-bold tracking-tight text-slate-900 placeholder:text-slate-400 dark:text-slate-100 dark:placeholder:text-slate-500 md:text-5xl"
                  )}
                  aria-label="タイトル"
                />

                <div
                  className="mt-4 min-h-[420px] cursor-text"
                  onClick={(e) => {
                    if (!(e.target as HTMLElement).closest(".ProseMirror")) {
                      freeEditorRef.current?.commands.focus("end");
                    }
                  }}
                  role="button"
                  tabIndex={-1}
                  aria-label="本文を入力"
                >
                  <JournalRichEditor
                    key={freeEditorKey}
                    initialContent=""
                    onEditorReady={(editor) => {
                      freeEditorRef.current = editor;
                      setFreeEditorEmpty(editor.isEmpty);
                      setFreeEditorCharCount(editor.getText().length);
                      editor.on("update", () => {
                        setFreeEditorEmpty(editor.isEmpty);
                        setFreeEditorCharCount(editor.getText().length);
                        setEditorUpdateTick((t) => t + 1);
                      });
                      editor.on("selectionUpdate", () => setEditorUpdateTick((t) => t + 1));
                    }}
                    onSave={handleSaveClick}
                    onFocusTitleRequested={() => {
                      const el = titleInputRef.current;
                      if (!el) return;
                      el.focus();
                      requestAnimationFrame(() => {
                        el.setSelectionRange(el.value.length, el.value.length);
                      });
                    }}
                  />
                </div>
              </div>

              <p className="mt-6 text-xs text-slate-400 dark:text-slate-500">
                {effectiveTotalChars} 文字
              </p>
            </div>
          </div>
        </div>
      </main>

      {isMobile && (
        <Sheet open={goalsPanelOpen} onOpenChange={setGoalsPanelOpen}>
          <SheetContent
            side="bottom"
            className="max-h-[85vh] overflow-y-auto border-t"
            showCloseButton={true}
          >
            <SheetHeader>
              <SheetTitle>あなたの目標</SheetTitle>
            </SheetHeader>
            <div className="mt-4">
              {goalsData ? (
                <GoalsPanelContent data={goalsData} />
              ) : (
                <p className="text-sm text-muted-foreground">読み込み中...</p>
              )}
            </div>
          </SheetContent>
        </Sheet>
      )}

      <AlertDialog
        open={isSaveModalOpen}
        onOpenChange={(open) => {
          if (!open) setIsSaveModalOpen(false);
        }}
      >
        <AlertDialogContent className="max-w-md p-0 overflow-hidden rounded-2xl border-slate-200/80 shadow-xl dark:border-slate-700/80">
          <div className="px-6 pt-6 pb-4">
            <AlertDialogHeader className="space-y-2 text-left">
              <AlertDialogTitle className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
                保存方法を選んでください
              </AlertDialogTitle>
              <AlertDialogDescription className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                どのように日記を保存しますか？
              </AlertDialogDescription>
            </AlertDialogHeader>

            <div className="mt-5 space-y-3">
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  performSave("public");
                }}
                className="flex w-full items-start gap-4 rounded-xl border-2 border-slate-200/80 bg-slate-50/50 p-4 text-left transition-colors hover:border-sky-300 hover:bg-sky-50/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/50 dark:border-slate-700/80 dark:bg-slate-900/30 dark:hover:border-sky-600/60 dark:hover:bg-sky-950/40"
              >
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-sky-100 dark:bg-sky-900/50">
                  <Globe className="size-5 text-sky-600 dark:text-sky-400" aria-hidden />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-slate-900 dark:text-slate-50">
                    全体に公開して保存
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    『みんなのジャーナル』に表示され、他のユーザーが閲覧できます
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  performSave("private");
                }}
                className="flex w-full items-start gap-4 rounded-xl border-2 border-slate-200/80 bg-slate-50/50 p-4 text-left transition-colors hover:border-amber-300/80 hover:bg-amber-50/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50 dark:border-slate-700/80 dark:bg-slate-900/30 dark:hover:border-amber-700/60 dark:hover:bg-amber-950/30"
              >
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/40">
                  <Lock className="size-5 text-amber-600 dark:text-amber-400" aria-hidden />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-slate-900 dark:text-slate-50">
                    自分だけに保存
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    あなただけが閲覧できます。My Pageで確認できます
                  </p>
                </div>
              </button>
            </div>
          </div>

          <div className="flex justify-center border-t border-slate-200/80 bg-slate-50/50 px-6 py-4 dark:border-slate-700/80 dark:bg-slate-900/30">
            <AlertDialogCancel
              onClick={(e) => {
                e.preventDefault();
                setIsSaveModalOpen(false);
              }}
              className="min-w-[140px] border-slate-200 bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-slate-100"
            >
              キャンセル
            </AlertDialogCancel>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={showSelfAnalysisPrompt}
        onOpenChange={(open) => {
          if (!open) setShowSelfAnalysisPrompt(false);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>自己分析シートに活かせそうな内容があります</AlertDialogTitle>
            <AlertDialogDescription>
              今のジャーナルの中から、「成功体験」や「得意なこと」に当てはまりそうなエピソードをAIが見つけました。
              自己分析シートの「小さな成功体験」や「得意なこと・強み」に一緒に整理して追加しますか？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={(e) => {
                e.preventDefault();
                setShowSelfAnalysisPrompt(false);
              }}
            >
              今回はスキップ
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                setShowSelfAnalysisPrompt(false);
                router.push("/self-analysis");
              }}
            >
              自己分析シートを開く
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

