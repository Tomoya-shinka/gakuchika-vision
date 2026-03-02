"use client";

import { useState, useCallback, useEffect, type ElementType } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { loadEntries, saveEntries, type JournalEntry } from "@/lib/journal";
import {
  loadGoals,
  formatDeadlineShort,
  type GoalsData,
  type GoalItem,
} from "@/lib/goals";
import { useIsMobile } from "@/hooks/use-mobile";
import { Sparkles, FileText, ChevronDown, Target, Flag, Calendar, ExternalLink } from "lucide-react";

export type JournalTemplate = "free" | "star" | "short";

const TEMPLATE_LABELS: Record<JournalTemplate, string> = {
  free: "通常モード（自由記述）",
  star: "STAR法（就活・エピソード集め用）",
  short: "短期モード（日々の振り返り用）",
};

const AI_THEME_QUESTIONS = [
  "今、一番時間を使いたいことは？",
  "今日、自分の成長を感じた瞬間は？",
  "今日はどんな一日だった？",
  "今の悩みや、やりたいことは？",
  "今日嬉しかったこと、小さな気づきを書いてみよう",
  "今の気持ちをそのまま書き出してみよう",
  "明日の自分に伝えたいことは？",
  "今日一番心が動いた瞬間は？",
  "今週の学びを一言でまとめると？",
  "今の自分に一番足りないと思うことは？",
  "将来の自分に聞いてみたいことは？",
  "今日やれてよかったことをひとつ",
];

function getRandomQuestion(): string {
  const idx = Math.floor(Math.random() * AI_THEME_QUESTIONS.length);
  return AI_THEME_QUESTIONS[idx] ?? AI_THEME_QUESTIONS[0];
}

// 現在の入力内容があるかどうか
function hasContent(
  template: JournalTemplate,
  fields: {
    content: string;
    situation: string;
    task: string;
    action: string;
    result: string;
    today: string;
    insights: string;
    tomorrow: string;
  }
): boolean {
  switch (template) {
    case "free":
      return fields.content.trim().length > 0;
    case "star":
      return [fields.situation, fields.task, fields.action, fields.result].some(
        (s) => s.trim().length > 0
      );
    case "short":
      return [fields.today, fields.insights, fields.tomorrow].some(
        (s) => s.trim().length > 0
      );
    default:
      return false;
  }
}

// 入力内容を結合して保存用テキストを生成（見出し付き）
function buildContentForSave(
  template: JournalTemplate,
  fields: {
    content: string;
    situation: string;
    task: string;
    action: string;
    result: string;
    today: string;
    insights: string;
    tomorrow: string;
  }
): string {
  switch (template) {
    case "free":
      return fields.content.trim();
    case "star": {
      const parts: string[] = [];
      if (fields.situation.trim())
        parts.push(`【Situation（状況）】\n${fields.situation.trim()}`);
      if (fields.task.trim())
        parts.push(`【Task（課題）】\n${fields.task.trim()}`);
      if (fields.action.trim())
        parts.push(`【Action（行動）】\n${fields.action.trim()}`);
      if (fields.result.trim())
        parts.push(`【Result（結果）】\n${fields.result.trim()}`);
      return parts.join("\n\n");
    }
    case "short": {
      const parts: string[] = [];
      if (fields.today.trim())
        parts.push(`【今日やったこと】\n${fields.today.trim()}`);
      if (fields.insights.trim())
        parts.push(`【気づき・学び】\n${fields.insights.trim()}`);
      if (fields.tomorrow.trim())
        parts.push(`【明日の改善点】\n${fields.tomorrow.trim()}`);
      return parts.join("\n\n");
    }
    default:
      return "";
  }
}

// 現在の内容を自由記述用に統合
function migrateToFreeContent(
  template: JournalTemplate,
  fields: {
    content: string;
    situation: string;
    task: string;
    action: string;
    result: string;
    today: string;
    insights: string;
    tomorrow: string;
  }
): string {
  if (template === "free") return fields.content;
  return buildContentForSave(template, fields);
}

// 総文字数
function getTotalCharCount(
  template: JournalTemplate,
  fields: {
    content: string;
    situation: string;
    task: string;
    action: string;
    result: string;
    today: string;
    insights: string;
    tomorrow: string;
  }
): number {
  switch (template) {
    case "free":
      return fields.content.length;
    case "star":
      return fields.situation.length + fields.task.length + fields.action.length + fields.result.length;
    case "short":
      return fields.today.length + fields.insights.length + fields.tomorrow.length;
    default:
      return 0;
  }
}

const textareaBase =
  "min-h-[120px] resize-none border-0 bg-transparent px-4 py-3 text-base leading-relaxed shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 md:text-base";

/** 目標パネル内カード（閲覧専用リファレンス用） */
function GoalRefCard({
  title,
  item,
  icon: Icon,
}: {
  title: string;
  item: GoalItem;
  icon: ElementType;
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
            <span className="font-normal text-muted-foreground">目標が未設定です</span>
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

/** 目標リファレンスパネルのコンテンツ（デスクトップ・モバイル共通） */
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
        <GoalRefCard title="1ヶ月後の目標" item={data.oneMonthGoal} icon={Calendar} />
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
  const isMobile = useIsMobile();
  const [template, setTemplate] = useState<JournalTemplate>("free");
  const [goalsPanelOpen, setGoalsPanelOpen] = useState(false);
  const [goalsData, setGoalsData] = useState<GoalsData | null>(null);
  const [content, setContent] = useState("");
  const [situation, setSituation] = useState("");
  const [task, setTask] = useState("");
  const [action, setAction] = useState("");
  const [result, setResult] = useState("");
  const [today, setToday] = useState("");
  const [insights, setInsights] = useState("");
  const [tomorrow, setTomorrow] = useState("");
  const [aiQuestion, setAiQuestion] = useState<string | null>(null);

  // テンプレート切り替え時に警告ダイアログ用
  const [pendingTemplate, setPendingTemplate] = useState<JournalTemplate | null>(null);
  const [showSwitchConfirm, setShowSwitchConfirm] = useState(false);

  const fields = {
    content,
    situation,
    task,
    action,
    result,
    today,
    insights,
    tomorrow,
  };

  // 目標パネル表示時に目標データを読み込み
  useEffect(() => {
    if (goalsPanelOpen) {
      setGoalsData(loadGoals());
    }
  }, [goalsPanelOpen]);

  const handleAiTheme = () => {
    setAiQuestion(getRandomQuestion());
  };

  const handleTemplateSelect = useCallback(
    (next: JournalTemplate) => {
      if (next === template) return;

      const hasExisting = hasContent(template, fields);

      if (hasExisting) {
        setPendingTemplate(next);
        setShowSwitchConfirm(true);
      } else {
        setTemplate(next);
      }
    },
    [template, fields]
  );

  const confirmSwitch = useCallback(() => {
    if (pendingTemplate == null) return;
    const hasExisting = hasContent(template, fields);

    if (hasExisting) {
      // 自由記述欄へ移行（入力内容を保持して通常モードに切り替え）
      const migrated = migrateToFreeContent(template, fields);
      setContent(migrated);
      setSituation("");
      setTask("");
      setAction("");
      setResult("");
      setToday("");
      setInsights("");
      setTomorrow("");
    }
    setTemplate("free"); // 自由記述欄に移行するため、常に通常モードへ
    setPendingTemplate(null);
    setShowSwitchConfirm(false);
  }, [pendingTemplate, template, fields]);

  const confirmDiscard = useCallback(() => {
    if (pendingTemplate == null) return;
    setContent("");
    setSituation("");
    setTask("");
    setAction("");
    setResult("");
    setToday("");
    setInsights("");
    setTomorrow("");
    setTemplate(pendingTemplate);
    setPendingTemplate(null);
    setShowSwitchConfirm(false);
  }, [pendingTemplate]);

  const cancelSwitch = useCallback(() => {
    setPendingTemplate(null);
    setShowSwitchConfirm(false);
  }, []);

  const contentToSave = buildContentForSave(template, fields);
  const totalChars = getTotalCharCount(template, fields);

  const handleSave = () => {
    const trimmed = contentToSave.trim();
    if (!trimmed) return;

    const newEntry: JournalEntry = {
      id: crypto.randomUUID(),
      content: trimmed,
      createdAt: new Date().toISOString(),
      category: "未分類",
    };

    const updated = [newEntry, ...loadEntries()];
    saveEntries(updated);

    setContent("");
    setSituation("");
    setTask("");
    setAction("");
    setResult("");
    setToday("");
    setInsights("");
    setTomorrow("");
    setAiQuestion(null);

    toast.success("保存しました", {
      description: "記録を保存しました。My Pageの記録で確認できます。",
      action: {
        label: "記録を見る",
        onClick: () => router.push("/mypage/records"),
      },
      duration: 5000,
    });
  };

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex h-14 shrink-0 items-center border-b border-border bg-background px-4">
        <h1 className="text-lg font-semibold">ジャーナル</h1>
      </header>
      <main className="flex flex-1 overflow-hidden">
        {/* デスクトップ: 目標パネル開時は2ペインレイアウト */}
        <div
          className={`flex flex-1 overflow-auto ${
            !isMobile && goalsPanelOpen ? "flex-row" : "flex-col"
          }`}
        >
          {/* 左サイド: 目標パネル（デスクトップのみ） */}
          {!isMobile && goalsPanelOpen && (
            <aside
              className="flex w-72 shrink-0 flex-col border-r border-slate-200 bg-slate-100/70 dark:border-slate-700 dark:bg-slate-900/50"
              aria-label="目標リファレンス"
            >
              <div className="sticky top-0 border-b border-slate-200 bg-slate-100/90 px-4 py-3 dark:border-slate-700 dark:bg-slate-900/70">
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

          {/* 右側: ジャーナル入力フォーム */}
          <div className="flex min-w-0 flex-1 flex-col overflow-auto p-6">
            <div
              className={`mx-auto flex w-full flex-col gap-6 ${
                !isMobile && goalsPanelOpen ? "max-w-xl" : "max-w-2xl"
              }`}
            >
          {/* テンプレート選択 + 目標確認 + AIテーマボタン */}
          <div className="flex flex-wrap items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 border-violet-200 bg-violet-50/50 text-violet-700 hover:bg-violet-100 hover:text-violet-800 dark:border-violet-800 dark:bg-violet-950/30 dark:text-violet-300 dark:hover:bg-violet-900/50"
                >
                  <FileText className="size-4" />
                  {TEMPLATE_LABELS[template]}
                  <ChevronDown className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={() => handleTemplateSelect("free")}>
                  {TEMPLATE_LABELS.free}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleTemplateSelect("star")}>
                  {TEMPLATE_LABELS.star}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleTemplateSelect("short")}>
                  {TEMPLATE_LABELS.short}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setGoalsPanelOpen((prev) => !prev)}
              className={`gap-2 ${
                goalsPanelOpen
                  ? "border-amber-300 bg-amber-50/80 text-amber-800 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
                  : "border-amber-200 bg-amber-50/50 text-amber-700 hover:bg-amber-100 hover:text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300 dark:hover:bg-amber-900/50"
              }`}
            >
              <Target className="size-4" />
              目標を確認する
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleAiTheme}
              className="w-fit gap-2 border-sky-200 bg-sky-50/50 text-sky-700 hover:bg-sky-100 hover:text-sky-800 dark:border-sky-800 dark:bg-sky-950/30 dark:text-sky-300 dark:hover:bg-sky-900/50"
            >
              <Sparkles className="size-4" />
              何を書くか迷ったら（AIに聞く）
            </Button>
          </div>

          {/* AIからの質問表示 */}
          {aiQuestion && (
            <div className="rounded-lg border border-sky-200 bg-sky-50/80 px-4 py-3 dark:border-sky-800 dark:bg-sky-950/40">
              <p className="text-xs font-medium text-sky-600 dark:text-sky-400">
                AIからのテーマ
              </p>
              <p className="mt-1 text-sm font-medium text-sky-900 dark:text-sky-100">
                {aiQuestion}
              </p>
            </div>
          )}

          {/* 執筆キャンバス */}
          <div className="flex flex-col gap-4">
            <div className="relative pb-6">
              <div className="rounded-lg border-2 border-sky-300 bg-slate-50 shadow-sm transition-shadow focus-within:border-sky-400 focus-within:ring-2 focus-within:ring-sky-400/30 focus-within:ring-offset-2 focus-within:shadow-md dark:border-sky-700 dark:bg-slate-900/50 dark:focus-within:border-sky-600 dark:focus-within:ring-sky-500/20">
                {template === "free" && (
                  <Textarea
                    placeholder="自由に書き始めてください。今日あったこと、感じたこと、考えたことなど、何でも大丈夫です..."
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    className={`${textareaBase} min-h-[300px] px-4 py-4 md:min-h-[340px] md:text-lg`}
                    rows={14}
                  />
                )}

                {template === "star" && (
                  <div className="flex flex-col gap-4 px-4 py-4">
                    <div>
                      <Label className="mb-2 block text-sm font-medium text-sky-700 dark:text-sky-400">
                        Situation（状況）
                      </Label>
                      <Textarea
                        placeholder="どんな状況でしたか？例：ゼミのプレゼンで発表役を任された、アルバイト先でクレーム対応が発生した など"
                        value={situation}
                        onChange={(e) => setSituation(e.target.value)}
                        className={textareaBase}
                        rows={3}
                      />
                    </div>
                    <div>
                      <Label className="mb-2 block text-sm font-medium text-sky-700 dark:text-sky-400">
                        Task（課題）
                      </Label>
                      <Textarea
                        placeholder="どんな課題や目標がありましたか？例：限られた時間で資料をまとめる必要があった、お客様の不満を解消する必要があった など"
                        value={task}
                        onChange={(e) => setTask(e.target.value)}
                        className={textareaBase}
                        rows={3}
                      />
                    </div>
                    <div>
                      <Label className="mb-2 block text-sm font-medium text-sky-700 dark:text-sky-400">
                        Action（行動）
                      </Label>
                      <Textarea
                        placeholder="あなたは具体的に何をしましたか？例：チームメンバーと役割分担し、スケジュールを組んだ、丁寧に説明して代替案を提案した など"
                        value={action}
                        onChange={(e) => setAction(e.target.value)}
                        className={textareaBase}
                        rows={3}
                      />
                    </div>
                    <div>
                      <Label className="mb-2 block text-sm font-medium text-sky-700 dark:text-sky-400">
                        Result（結果）
                      </Label>
                      <Textarea
                        placeholder="どんな結果になりましたか？例：プレゼンが好評だった、お客様が感謝してくれた など。可能なら数字も入れると効果的です"
                        value={result}
                        onChange={(e) => setResult(e.target.value)}
                        className={textareaBase}
                        rows={3}
                      />
                    </div>
                  </div>
                )}

                {template === "short" && (
                  <div className="flex flex-col gap-4 px-4 py-4">
                    <div>
                      <Label className="mb-2 block text-sm font-medium text-sky-700 dark:text-sky-400">
                        今日やったこと
                      </Label>
                      <Textarea
                        placeholder="今日やったこと、達成したこと、取り組んだことを書きましょう。例：レポートを1章分書いた、バイトを3時間入れた、友達とご飯に行った など"
                        value={today}
                        onChange={(e) => setToday(e.target.value)}
                        className={textareaBase}
                        rows={3}
                      />
                    </div>
                    <div>
                      <Label className="mb-2 block text-sm font-medium text-sky-700 dark:text-sky-400">
                        気づき・学び
                      </Label>
                      <Textarea
                        placeholder="今日の出来事から得た気づきや学び、新しい発見を書きましょう。例：優先順位をつけて進めると効率が上がる、先に質問しておくと安心して取り組める など"
                        value={insights}
                        onChange={(e) => setInsights(e.target.value)}
                        className={textareaBase}
                        rows={3}
                      />
                    </div>
                    <div>
                      <Label className="mb-2 block text-sm font-medium text-sky-700 dark:text-sky-400">
                        明日の改善点
                      </Label>
                      <Textarea
                        placeholder="明日以降、試してみたいことや改善したい点を書きましょう。例：朝イチで一番難しいタスクから着手する、10分でも勉強時間を確保する など"
                        value={tomorrow}
                        onChange={(e) => setTomorrow(e.target.value)}
                        className={textareaBase}
                        rows={3}
                      />
                    </div>
                  </div>
                )}
              </div>
              <p className="absolute bottom-0 right-0 text-xs text-slate-400 dark:text-slate-500">
                {totalChars} 文字
              </p>
            </div>
            <Button
              onClick={handleSave}
              disabled={!contentToSave.trim()}
              size="lg"
              className="w-full sm:w-auto"
            >
              保存する
            </Button>
          </div>
            </div>
          </div>
        </div>
      </main>

      {/* モバイル: 目標ドロワー（下からせり上がるシート） */}
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

      {/* テンプレート切り替え時の確認ダイアログ */}
      <AlertDialog
        open={showSwitchConfirm}
        onOpenChange={(open) => {
          setShowSwitchConfirm(open);
          if (!open) setPendingTemplate(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>入力内容があります</AlertDialogTitle>
            <AlertDialogDescription>
              テンプレートを切り替えると、現在の入力形式と合わなくなります。
              自由記述欄に移行してから切り替えますか？それとも入力内容を破棄して切り替えますか？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={cancelSwitch}>
              キャンセル
            </AlertDialogCancel>
            <AlertDialogAction
              variant="outline"
              onClick={(e) => {
                e.preventDefault();
                confirmSwitch();
              }}
            >
              自由記述に移行して切り替え
            </AlertDialogAction>
            <AlertDialogAction
              variant="destructive"
              onClick={(e) => {
                e.preventDefault();
                confirmDiscard();
              }}
            >
              破棄して切り替え
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
