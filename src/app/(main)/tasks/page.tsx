"use client";

import { useEffect, useState, useCallback } from "react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  loadHabitTasks,
  saveHabitTasks,
  loadHabitCompletions,
  saveHabitCompletions,
  getWeekKeys,
  get7DayChartData,
  getTodayRate,
  getCompletion,
  toggleCompletion,
  formatDateLabel,
  formatDateWithWeekday,
  getTodayKey,
  type HabitTask,
  type HabitCompletions,
  type ChartDataItem,
} from "@/lib/habits";
import {
  Plus,
  ListTodo,
  MoreHorizontal,
  Pencil,
  Trash2,
  BookOpen,
  Dumbbell,
  Coffee,
  PenLine,
  Sunrise,
  Moon,
  Utensils,
  Brain,
  GraduationCap,
  Briefcase,
  Target,
  Sparkles,
  Flame,
  FileText,
  type LucideIcon,
} from "lucide-react";

const CHART_COLORS = ["#22c55e", "#e5e7eb"];

/** アイコン選択肢：Lucide名と絵文字 */
const ICON_OPTIONS: { value: string; label: string; type: "lucide" | "emoji" }[] = [
  { value: "lucide:BookOpen", label: "本", type: "lucide" },
  { value: "lucide:Dumbbell", label: "運動", type: "lucide" },
  { value: "lucide:Coffee", label: "コーヒー", type: "lucide" },
  { value: "lucide:PenLine", label: "メモ", type: "lucide" },
  { value: "lucide:Sunrise", label: "早起き", type: "lucide" },
  { value: "lucide:Moon", label: "就寝", type: "lucide" },
  { value: "lucide:Utensils", label: "食事", type: "lucide" },
  { value: "lucide:Brain", label: "学習", type: "lucide" },
  { value: "lucide:GraduationCap", label: "勉強", type: "lucide" },
  { value: "lucide:Briefcase", label: "就活", type: "lucide" },
  { value: "lucide:Target", label: "目標", type: "lucide" },
  { value: "lucide:Sparkles", label: "習慣", type: "lucide" },
  { value: "lucide:Flame", label: "継続", type: "lucide" },
  { value: "lucide:FileText", label: "記録", type: "lucide" },
  { value: "📚", label: "読書", type: "emoji" },
  { value: "✍️", label: "筆記", type: "emoji" },
  { value: "🏃", label: "ランニング", type: "emoji" },
  { value: "💪", label: "筋トレ", type: "emoji" },
  { value: "🧘", label: "瞑想", type: "emoji" },
  { value: "📋", label: "タスク", type: "emoji" },
];

const LUCIDE_ICON_MAP: Record<string, LucideIcon> = {
  BookOpen,
  Dumbbell,
  Coffee,
  PenLine,
  Sunrise,
  Moon,
  Utensils,
  Brain,
  GraduationCap,
  Briefcase,
  Target,
  Sparkles,
  Flame,
  FileText,
};

function HabitIcon({ icon }: { icon: string }) {
  if (icon.startsWith("lucide:")) {
    const name = icon.replace("lucide:", "");
    const LucideIcon = LUCIDE_ICON_MAP[name];
    if (LucideIcon) {
      return <LucideIcon className="size-4 shrink-0 text-muted-foreground" />;
    }
  }
  return <span className="text-base leading-none">{icon}</span>;
}

export default function TasksPage() {
  const isMobile = useIsMobile();
  const [tasks, setTasks] = useState<HabitTask[]>([]);
  const [completions, setCompletions] = useState<HabitCompletions>({});
  const [chartData, setChartData] = useState<ChartDataItem[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [addName, setAddName] = useState("");
  const [addIcon, setAddIcon] = useState("lucide:BookOpen");
  const [editTask, setEditTask] = useState<HabitTask | null>(null);
  const [editName, setEditName] = useState("");
  const [editIcon, setEditIcon] = useState("");
  const [deleteTaskId, setDeleteTaskId] = useState<string | null>(null);

  const load = useCallback(() => {
    const t = loadHabitTasks();
    const c = loadHabitCompletions();
    setTasks(t);
    setCompletions(c);
    setChartData(get7DayChartData(t, c));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const persistTasks = useCallback((next: HabitTask[]) => {
    setTasks(next);
    saveHabitTasks(next);
  }, []);

  const persistCompletions = useCallback(
    (next: HabitCompletions, tasksOverride?: HabitTask[]) => {
      const t = tasksOverride ?? tasks;
      setCompletions(next);
      saveHabitCompletions(next);
      setChartData(get7DayChartData(t, next));
    },
    [tasks]
  );

  const handleToggle = (taskId: string, date: string) => {
    const next = toggleCompletion(taskId, date, completions);
    persistCompletions(next);
  };

  const openAddDialog = () => {
    setAddName("");
    setAddIcon("lucide:BookOpen");
    setEditTask(null);
    setDialogOpen(true);
  };

  const openEditDialog = (task: HabitTask) => {
    setEditTask(task);
    setEditName(task.name);
    setEditIcon(task.icon);
    setDialogOpen(true);
  };

  const handleAddTask = () => {
    if (!addName.trim()) return;
    const newTask: HabitTask = {
      id: crypto.randomUUID(),
      name: addName.trim(),
      icon: addIcon,
    };
    const next = [...tasks, newTask];
    persistTasks(next);
    setChartData(get7DayChartData(next, completions));
    setDialogOpen(false);
  };

  const handleEditTask = () => {
    if (!editTask || !editName.trim()) return;
    const next = tasks.map((t) =>
      t.id === editTask.id ? { ...t, name: editName.trim(), icon: editIcon } : t
    );
    persistTasks(next);
    setChartData(get7DayChartData(next, completions));
    setDialogOpen(false);
    setEditTask(null);
  };

  const openDeleteConfirm = (id: string) => {
    setDeleteTaskId(id);
  };

  const handleDeleteTask = () => {
    if (!deleteTaskId) return;
    removeTask(deleteTaskId);
    setDeleteTaskId(null);
  };

  const removeTask = (id: string) => {
    const nextTasks = tasks.filter((t) => t.id !== id);
    const nextCompletions = { ...completions };
    for (const key of Object.keys(nextCompletions)) {
      if (key.startsWith(`${id}_`)) delete nextCompletions[key];
    }
    persistTasks(nextTasks);
    persistCompletions(nextCompletions, nextTasks);
  };

  const dayKeys = getWeekKeys();
  const todayKey = getTodayKey();
  const rate = getTodayRate(tasks, completions);
  const doneCount = tasks.filter((t) => getCompletion(t.id, todayKey, completions)).length;
  // 12時から時計回り。endAngle = 90 - (360 * 達成率/100) で時計回りに伸びる
  const progressEndAngle = 90 - (360 * rate) / 100;
  const hasTasks = tasks.length > 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-border bg-background px-4 py-2">
        <h1 className="flex items-center gap-2 text-base font-semibold">
          <ListTodo className="size-4 text-sky-600" />
          習慣トラッカー
        </h1>
        <Button size="sm" className="gap-1.5" onClick={openAddDialog}>
          <Plus className="size-4" />
          タスクを追加
        </Button>
      </header>

      <main className="flex min-h-0 flex-1 flex-col gap-2 overflow-auto bg-gradient-to-b from-slate-50/80 via-white to-sky-50/30 p-3 sm:gap-4 sm:p-4 dark:from-slate-950/50 dark:via-background dark:to-sky-950/20">
        {/* 統計セクション */}
        <div className="grid min-h-0 shrink-0 grid-cols-2 gap-2 sm:gap-4">
          <Card className="overflow-hidden gap-0 border-slate-200/80 py-0 shadow-sm dark:border-slate-800/60">
            <CardHeader className="px-2 pb-0.5 pt-2 sm:px-6 sm:pb-2 sm:pt-6">
              <CardTitle className="text-[10px] font-medium sm:text-sm">本日の達成率</CardTitle>
            </CardHeader>
            <CardContent className="flex min-h-0 items-center justify-center px-1 pb-1 pt-0 sm:px-2 sm:pb-2 sm:pt-0">
              <div className="relative h-[90px] w-full sm:h-[180px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                    {hasTasks ? (
                      <>
                        {/* レイヤー1: 背景（灰色）全周固定 */}
                        <Pie
                          data={[{ name: "bg", value: 1 }]}
                          cx="50%"
                          cy="50%"
                          innerRadius="60%"
                          outerRadius="95%"
                          startAngle={90}
                          endAngle={-270}
                          paddingAngle={0}
                          dataKey="value"
                          stroke="none"
                          isAnimationActive={false}
                        >
                          <Cell fill={CHART_COLORS[1]} />
                        </Pie>
                        {/* レイヤー2: 進捗（緑）12時から時計回りに伸びる */}
                        <Pie
                          data={[{ name: "progress", value: 1 }]}
                          cx="50%"
                          cy="50%"
                          innerRadius="60%"
                          outerRadius="95%"
                          startAngle={90}
                          endAngle={progressEndAngle}
                          paddingAngle={0}
                          dataKey="value"
                          stroke="none"
                          isAnimationActive
                          animationDuration={800}
                          animationBegin={0}
                          animationEasing="ease-out"
                        >
                          <Cell fill={CHART_COLORS[0]} />
                        </Pie>
                      </>
                    ) : (
                      /* タスク未登録時 */
                      <Pie
                        data={[{ name: "未登録", value: 1 }]}
                        cx="50%"
                        cy="50%"
                        innerRadius="60%"
                        outerRadius="95%"
                        startAngle={90}
                        endAngle={-270}
                        paddingAngle={0}
                        dataKey="value"
                        stroke="none"
                        isAnimationActive={false}
                      >
                        <Cell fill="#e5e7eb" />
                      </Pie>
                    )}
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center select-none">
                  <span className="text-xl font-bold tabular-nums text-foreground sm:text-3xl">{rate}%</span>
                  <span className="text-xs text-muted-foreground sm:text-sm">達成</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="overflow-hidden gap-0 border-slate-200/80 py-0 shadow-sm dark:border-slate-800/60">
            <CardHeader className="px-2 pb-0.5 pt-2 sm:px-6 sm:pb-2 sm:pt-6">
              <CardTitle className="text-[10px] font-medium sm:text-sm">1週間の達成状況</CardTitle>
            </CardHeader>
            <CardContent className="h-[90px] px-2 pb-2 pt-0 sm:h-[180px] sm:pb-6 sm:pt-0 sm:px-6">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={chartData}
                  margin={isMobile ? { top: 2, right: 2, left: 2, bottom: 2 } : { top: 5, right: 5, left: 5, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted/50" />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: isMobile ? 0 : 11 }}
                    hide={isMobile}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 11 }}
                    width={isMobile ? 0 : 24}
                    hide={isMobile}
                  />
                  <Tooltip
                    contentStyle={{ fontSize: 10, borderRadius: 6 }}
                    formatter={(value: number | undefined) => [value ?? 0, "完了数"]}
                    labelFormatter={(label) => `日付: ${label}`}
                  />
                  <Line
                    type="monotone"
                    dataKey="count"
                    name="完了数"
                    stroke="var(--chart-1)"
                    strokeWidth={1.5}
                    dot={{ fill: "var(--chart-1)", r: 2 }}
                    activeDot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* 習慣トラッカーテーブル */}
        <Card className="min-h-0 flex-1 overflow-hidden gap-0 border-slate-200/80 py-0 shadow-sm dark:border-slate-800/60 sm:gap-6 sm:py-6">
          <CardHeader className="px-3 pb-1 pt-3 sm:px-6 sm:pb-2 sm:pt-6">
            <CardTitle className="text-xs font-medium sm:text-sm">習慣チェック</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            {tasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-4 py-16">
                <p className="text-sm text-muted-foreground">
                  習慣タスクがありません。「＋ タスクを追加」から追加してください。
                </p>
                <Button variant="outline" size="sm" className="gap-1.5" onClick={openAddDialog}>
                  <Plus className="size-4" />
                  タスクを追加
                </Button>
              </div>
            ) : (
              <div className="min-w-max overflow-x-auto overflow-y-visible">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="sticky left-0 top-0 z-20 min-w-[140px] border-r border-border bg-card px-3 py-2 text-left font-medium shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]">
                        タスク
                      </th>
                      {dayKeys.map((dateKey) => {
                        const { date, weekday } = formatDateWithWeekday(dateKey);
                        const isToday = dateKey === todayKey;
                        const isFuture = dateKey > todayKey;
                        return (
                          <th
                            key={dateKey}
                            className={`sticky top-0 z-10 min-w-[64px] border-r border-border px-2 py-2 text-center font-medium shadow-[0_2px_4px_-2px_rgba(0,0,0,0.05)] sm:min-w-[72px] last:border-r-0 ${
                              isToday
                                ? "border-l-2 border-r-2 border-blue-200 bg-blue-100/50 dark:border-blue-700 dark:bg-blue-900/40"
                                : isFuture
                                  ? "bg-slate-50 dark:bg-slate-900/50 [background-image:repeating-linear-gradient(45deg,transparent,transparent_10px,#e2e8f0_10px,#e2e8f0_11px)] dark:[background-image:repeating-linear-gradient(45deg,transparent,transparent_10px,#334155_10px,#334155_11px)]"
                                  : "bg-card"
                            }`}
                          >
                            <div className="flex flex-col items-center gap-0.5">
                              <span
                                className={`text-xs ${isToday ? "font-bold text-blue-600 dark:text-blue-400" : "font-medium"}`}
                              >
                                {date} {weekday}
                              </span>
                            </div>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {tasks.map((task) => (
                      <tr
                        key={task.id}
                        className="group border-b border-border transition-colors hover:bg-muted/30"
                      >
                        <td className="sticky left-0 z-10 min-w-[140px] border-r border-border bg-card px-3 py-2 font-medium shadow-[2px_0_4px_-2px_rgba(0,0,0,0.05)] group-hover:bg-muted/30">
                          <div className="flex min-w-0 items-center gap-2">
                            <HabitIcon icon={task.icon} />
                            <span className="min-w-0 flex-1 truncate">{task.name}</span>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon-xs"
                                  className="ml-auto h-7 w-7 shrink-0 text-muted-foreground opacity-60 hover:opacity-100 hover:text-foreground"
                                  aria-label={`${task.name}の操作メニュー`}
                                >
                                  <MoreHorizontal className="size-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => openEditDialog(task)}>
                                  <Pencil className="size-4" />
                                  編集
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  variant="destructive"
                                  className="text-red-600 focus:text-red-600"
                                  onClick={() => openDeleteConfirm(task.id)}
                                >
                                  <Trash2 className="size-4" />
                                  削除
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </td>
                        {dayKeys.map((dateKey) => {
                          const isToday = dateKey === todayKey;
                          const isFuture = dateKey > todayKey;
                          return (
                            <td
                              key={`${task.id}-${dateKey}`}
                              className={`border-r border-border px-2 py-2 last:border-r-0 ${
                                isToday
                                  ? "border-l-2 border-r-2 border-blue-200 bg-blue-100/50 dark:border-blue-700 dark:bg-blue-900/40"
                                  : isFuture
                                    ? "bg-slate-50 dark:bg-slate-900/50 [background-image:repeating-linear-gradient(45deg,transparent,transparent_10px,#e2e8f0_10px,#e2e8f0_11px)] dark:[background-image:repeating-linear-gradient(45deg,transparent,transparent_10px,#334155_10px,#334155_11px)]"
                                    : ""
                              }`}
                            >
                              <div className="flex items-center justify-center">
                                <Checkbox
                                  checked={getCompletion(task.id, dateKey, completions)}
                                  onCheckedChange={() => handleToggle(task.id, dateKey)}
                                  disabled={isFuture}
                                  aria-label={`${task.name} - ${formatDateLabel(dateKey)}${isFuture ? "（入力不可）" : ""}`}
                                />
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
          {tasks.length > 0 && (
            <div className="border-t px-4 py-2">
              <Button
                variant="outline"
                size="sm"
                className="w-full gap-1.5 border-dashed"
                onClick={openAddDialog}
              >
                <Plus className="size-4" />
                タスクを追加
              </Button>
            </div>
          )}
        </Card>
      </main>

      {/* タスク追加・編集モーダル */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditTask(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editTask ? "タスクを編集" : "タスクを追加"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="task-name">タスク名</Label>
              <Input
                id="task-name"
                value={editTask ? editName : addName}
                onChange={(e) => (editTask ? setEditName(e.target.value) : setAddName(e.target.value))}
                placeholder="例：朝の読書"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="task-icon">アイコン</Label>
              <div className="flex flex-wrap gap-2">
                {ICON_OPTIONS.map((opt) => {
                  const current = editTask ? editIcon : addIcon;
                  const setCurrent = editTask ? setEditIcon : setAddIcon;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setCurrent(opt.value)}
                      className={`flex h-10 w-10 items-center justify-center rounded-lg border transition-colors ${
                        current === opt.value
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-muted/30 hover:bg-muted/60"
                      }`}
                      title={opt.label}
                      aria-label={opt.label}
                    >
                      {opt.type === "lucide" ? (
                        <HabitIcon icon={opt.value} />
                      ) : (
                        <span className="text-lg">{opt.value}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              キャンセル
            </Button>
            {editTask ? (
              <Button onClick={handleEditTask} disabled={!editName.trim()}>
                保存
              </Button>
            ) : (
              <Button onClick={handleAddTask} disabled={!addName.trim()}>
                追加
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 削除確認ダイアログ */}
      <AlertDialog open={deleteTaskId !== null} onOpenChange={(open) => !open && setDeleteTaskId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>習慣を削除</AlertDialogTitle>
            <AlertDialogDescription>この習慣を削除しますか？削除すると完了記録もすべて失われます。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={handleDeleteTask}
            >
              削除する
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
