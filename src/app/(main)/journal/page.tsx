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
  Mic,
  MoreHorizontal,
  Play,
  Pause,
  Square,
  ImagePlus,
  X,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { JournalRichEditor } from "@/components/journal-rich-editor";
import { StyleSelector } from "@/components/style-selector";
import type { Editor } from "@tiptap/react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { calculateUnivDay, formatUniversityDayLabel } from "@/lib/university-life";

type JournalTemplate = "free" | "star" | "short";

const TEMPLATE_LABELS: Record<JournalTemplate, string> = {
  free: "通常モード（自由記述）",
  star: "STAR法（就活・エピソード集め用）",
  short: "短期モード（日々の振り返り用）",
};

interface StarFields { situation: string; task: string; action: string; result: string; }
interface ShortFields { today: string; insights: string; tomorrow: string; }

function buildStarHtml(f: StarFields): string {
  return [
    f.situation && `<p><strong>【Situation（状況）】</strong></p><p>${f.situation.replace(/\n/g, "<br>")}</p>`,
    f.task && `<p><strong>【Task（課題）】</strong></p><p>${f.task.replace(/\n/g, "<br>")}</p>`,
    f.action && `<p><strong>【Action（行動）】</strong></p><p>${f.action.replace(/\n/g, "<br>")}</p>`,
    f.result && `<p><strong>【Result（結果）】</strong></p><p>${f.result.replace(/\n/g, "<br>")}</p>`,
  ].filter(Boolean).join("");
}

function buildShortHtml(f: ShortFields): string {
  return [
    f.today && `<p><strong>【今日やったこと】</strong></p><p>${f.today.replace(/\n/g, "<br>")}</p>`,
    f.insights && `<p><strong>【気づき・学び】</strong></p><p>${f.insights.replace(/\n/g, "<br>")}</p>`,
    f.tomorrow && `<p><strong>【明日の改善点】</strong></p><p>${f.tomorrow.replace(/\n/g, "<br>")}</p>`,
  ].filter(Boolean).join("");
}

function TemplateField({
  label,
  placeholder,
  value,
  onChange,
  fieldName,
}: {
  label: string;
  placeholder?: string;
  value: string;
  onChange: (v: string) => void;
  fieldName: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">{label}</p>
      <textarea
        data-field={fieldName}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? "ここに入力してください..."}
        rows={4}
        className="w-full resize-none rounded-lg border border-slate-200 bg-white px-4 py-3 text-base leading-relaxed text-slate-800 outline-none transition-colors placeholder:text-slate-400 focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:placeholder:text-slate-500 dark:focus:border-sky-500"
      />
    </div>
  );
}

function formatRecordingTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

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

  const [template, setTemplate] = useState<JournalTemplate>("free");
  const [pendingTemplate, setPendingTemplate] = useState<JournalTemplate | null>(null);
  const [showSwitchConfirm, setShowSwitchConfirm] = useState(false);
  // STAR fields
  const [situation, setSituation] = useState("");
  const [task, setTask] = useState("");
  const [action, setAction] = useState("");
  const [result, setResult] = useState("");
  // SHORT fields
  const [today, setToday] = useState("");
  const [insights, setInsights] = useState("");
  const [tomorrow, setTomorrow] = useState("");

  const [goalsPanelOpen, setGoalsPanelOpen] = useState(false);
  const [goalsData, setGoalsData] = useState<GoalsData | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [aiQuestion, setAiQuestion] = useState<string | null>(null);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showSelfAnalysisPrompt, setShowSelfAnalysisPrompt] = useState(false);

  const [isVoiceMode, setIsVoiceMode] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingStartTimeRef = useRef<number>(0);
  const templateRef = useRef<JournalTemplate>("free");
  const transcribeTargetRef = useRef<
    | { type: "tiptap" }
    | { type: "field"; field: string; cursorStart: number; cursorEnd: number }
    | { type: "default" }
  >({ type: "default" });

  // 音声レビューモーダル（録音直後の確認）
  const [voiceReview, setVoiceReview] = useState<{
    audioUrl: string;
    audioBlob: Blob;
    durationSec: number;
    transcription: string;
    isTranscribing: boolean;
  } | null>(null);
  const voiceAudioRef = useRef<HTMLAudioElement | null>(null);
  const [isVoicePlaying, setIsVoicePlaying] = useState(false);
  const [voicePlaySec, setVoicePlaySec] = useState(0);
  const [voiceDurationSec, setVoiceDurationSec] = useState(0);

  // 画像添付
  const [attachedImages, setAttachedImages] = useState<{ file: File; localUrl: string }[]>([]);
  const imageInputRef = useRef<HTMLInputElement | null>(null);

  // エディタに添付された音声
  const [attachedAudio, setAttachedAudio] = useState<{
    blob: Blob;
    localUrl: string;
    transcription: string;
    durationSec: number;
  } | null>(null);
  const attachedAudioRef = useRef<HTMLAudioElement | null>(null);
  const [isAttachedPlaying, setIsAttachedPlaying] = useState(false);
  const [attachedPlaySec, setAttachedPlaySec] = useState(0);

  useEffect(() => { templateRef.current = template; }, [template]);

  useEffect(() => {
    if (!isRecording) { setRecordingSeconds(0); return; }
    const id = setInterval(() => setRecordingSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [isRecording]);

  useEffect(() => {
    if (!isRecording) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        mediaRecorderRef.current?.stop();
        setIsRecording(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isRecording]);

  const freeEditorRef = useRef<Editor | null>(null);
  const [, setEditorUpdateTick] = useState(0);
  const titleInputRef = useRef<HTMLInputElement | null>(null);
  const [freeEditorKey, setFreeEditorKey] = useState(0);
  const [freeEditorEmpty, setFreeEditorEmpty] = useState(true);
  const [freeEditorCharCount, setFreeEditorCharCount] = useState(0);
  const [todayDayLabel, setTodayDayLabel] = useState<string | null>(null);
  const [isStudent, setIsStudent] = useState<boolean>(true);

  useEffect(() => {
    if (goalsPanelOpen) {
      setGoalsData(loadGoals());
    }
  }, [goalsPanelOpen]);

  useEffect(() => {
    if (!user?.uid) {
      setTodayDayLabel(null);
      setIsStudent(true);
      return;
    }
    const load = async () => {
      try {
        const snap = await getDoc(doc(getDb(), "users", user.uid));
        const data = snap.data() as Record<string, unknown> | undefined;
        const nextIsStudent = data?.isStudent !== undefined ? Boolean(data.isStudent) : true;
        setIsStudent(nextIsStudent);
        if (!nextIsStudent) {
          setTodayDayLabel(null);
          return;
        }
        const enrollment = data?.enrollmentDate ?? undefined;
        const day = calculateUnivDay(new Date(), enrollment);
        setTodayDayLabel(day != null ? formatUniversityDayLabel(day) : null);
      } catch {
        setIsStudent(true);
        setTodayDayLabel(null);
      }
    };
    load();
  }, [user?.uid]);

  const handleAiTheme = () => {
    setAiQuestion(getRandomQuestion());
  };

  const hasFreeContent = !freeEditorEmpty || content.trim().length > 0;
  const hasStarContent = !!(situation || task || action || result);
  const hasShortContent = !!(today || insights || tomorrow);

  const applyTemplate = (next: JournalTemplate) => {
    // Clear current template fields
    if (template === "star") { setSituation(""); setTask(""); setAction(""); setResult(""); }
    if (template === "short") { setToday(""); setInsights(""); setTomorrow(""); }
    if (template === "free") {
      freeEditorRef.current?.commands.setContent("");
      setFreeEditorEmpty(true);
      setFreeEditorCharCount(0);
      setFreeEditorKey((k) => k + 1);
      setContent("");
    }
    setTemplate(next);
    setPendingTemplate(null);
  };

  const handleTemplateChange = (next: JournalTemplate) => {
    if (next === template) return;
    const hasContent =
      (template === "free" && hasFreeContent) ||
      (template === "star" && hasStarContent) ||
      (template === "short" && hasShortContent);
    if (hasContent) {
      setPendingTemplate(next);
      setShowSwitchConfirm(true);
    } else {
      applyTemplate(next);
    }
  };

  const handleMicClick = async () => {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
      return;
    }

    // 押下時点のフォーカス位置を記録（onMouseDown で focus 移動を防いでいるため有効）
    const ae = document.activeElement;
    if (ae instanceof HTMLTextAreaElement && ae.dataset.field) {
      transcribeTargetRef.current = {
        type: "field",
        field: ae.dataset.field,
        cursorStart: ae.selectionStart ?? ae.value.length,
        cursorEnd: ae.selectionEnd ?? ae.value.length,
      };
    } else if (ae?.classList.contains("ProseMirror")) {
      transcribeTargetRef.current = { type: "tiptap" };
    } else {
      transcribeTargetRef.current = { type: "default" };
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      toast.error("このブラウザは音声録音に対応していません");
      return;
    }

    const fieldSetters: Record<string, React.Dispatch<React.SetStateAction<string>>> = {
      situation: setSituation,
      task: setTask,
      action: setAction,
      result: setResult,
      today: setToday,
      insights: setInsights,
      tomorrow: setTomorrow,
    };

    try {
      // 設定ページで選択されたデバイスIDを使用（必ず設定済みのはず）
      const preferredDeviceId = typeof window !== "undefined" ? localStorage.getItem("preferred_mic_device_id") : null;

      const audioConstraints: MediaTrackConstraints = {
        ...(preferredDeviceId ? { deviceId: { exact: preferredDeviceId } } : {}),
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
        sampleRate: { ideal: 48000 },
        channelCount: { ideal: 1 },
      };
      const stream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints });
      audioChunksRef.current = [];
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";
      const recorder = new MediaRecorder(stream, {
        mimeType,
        audioBitsPerSecond: 192_000,
      });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        void (async () => {
          stream.getTracks().forEach((t) => t.stop());
          const audioBlob = new Blob(audioChunksRef.current, { type: recorder.mimeType || "audio/webm" });
          audioChunksRef.current = [];
          const audioUrl = URL.createObjectURL(audioBlob);
          setIsVoiceMode(false);
          const durationSec = recordingStartTimeRef.current
            ? Math.round((Date.now() - recordingStartTimeRef.current) / 1000)
            : 0;
          setVoiceReview({ audioUrl, audioBlob, durationSec, transcription: "", isTranscribing: true });
          try {
            const form = new FormData();
            form.append("audio", audioBlob, "audio.webm");
            const res = await fetch("/api/transcribe", { method: "POST", body: form });
            if (!res.ok) throw new Error("transcription failed");
            const { text } = (await res.json()) as { text: string };
            setVoiceReview((prev) => prev ? { ...prev, transcription: text ?? "", isTranscribing: false } : prev);
          } catch {
            setVoiceReview((prev) => prev ? { ...prev, isTranscribing: false } : prev);
          }
        })();
      };

      // マイクHW初期化を待ってから録音開始（USBマイクは500ms必要）
      await new Promise<void>((r) => setTimeout(r, 500));
      recordingStartTimeRef.current = Date.now();
      recorder.start(100); // 100ms timeslice で定期チャンク収集
      setIsRecording(true);
    } catch {
      toast.error("マイクへのアクセスが拒否されました");
    }
  };

  const hasTitleOrContent =
    title.trim().length > 0 ||
    !!attachedAudio ||
    attachedImages.length > 0 ||
    (template === "free" && hasFreeContent) ||
    (template === "star" && hasStarContent) ||
    (template === "short" && hasShortContent);

  const performSave = async (visibility: JournalVisibility) => {
    let trimmed = "";
    if (template === "free") {
      const html = (freeEditorRef.current?.getHTML() ?? "").trim();
      trimmed = html || content.trim();
    } else if (template === "star") {
      trimmed = buildStarHtml({ situation, task, action, result });
    } else if (template === "short") {
      trimmed = buildShortHtml({ today, insights, tomorrow });
    }
    if (!trimmed && !attachedAudio && attachedImages.length === 0) return;
    if (isSaving) return;

    setIsSaving(true);
    try {
      // 音声添付がある場合はアップロード
      let uploadedAudioUrl: string | undefined;
      let uploadedDurationSec: number | undefined;
      let uploadedTranscription: string | undefined;
      if (attachedAudio && user?.uid) {
        const form = new FormData();
        form.append("audio", attachedAudio.blob, "audio.webm");
        form.append("uid", user.uid);
        const uploadRes = await fetch("/api/upload-audio", { method: "POST", body: form });
        if (!uploadRes.ok) {
          const err = (await uploadRes.json()) as { error?: string; detail?: string };
          throw new Error(err.detail ?? err.error ?? "upload failed");
        }
        const { audioUrl: url } = (await uploadRes.json()) as { audioUrl: string };
        uploadedAudioUrl = url;
        uploadedDurationSec = Math.floor(attachedAudio.durationSec);
        uploadedTranscription = attachedAudio.transcription || undefined;
      }

      // 画像アップロード（Storage 有効化後に動作）
      let uploadedImageUrls: string[] | undefined;
      if (attachedImages.length > 0 && user?.uid) {
        const urls: string[] = [];
        for (const img of attachedImages) {
          const ext = img.file.name.split(".").pop() ?? "jpg";
          const form = new FormData();
          form.append("image", img.file);
          form.append("uid", user.uid);
          form.append("ext", ext);
          const res = await fetch("/api/upload-image", { method: "POST", body: form });
          if (!res.ok) {
            const err = (await res.json()) as { error?: string };
            throw new Error(err.error ?? "image upload failed");
          }
          const { imageUrl } = (await res.json()) as { imageUrl: string };
          urls.push(imageUrl);
        }
        uploadedImageUrls = urls;
      }

      const createdAt = new Date().toISOString();
      let entryId = crypto.randomUUID();

      if (user?.uid) {
        try {
          const db = getDb();
          const ref = await addDoc(collection(db, "journals"), {
            userId: user.uid,
            title: title.trim() || "",
            content: trimmed,
            ...(uploadedAudioUrl && {
              audioUrl: uploadedAudioUrl,
              audioDurationSec: uploadedDurationSec,
            }),
            ...(uploadedTranscription && { transcription: uploadedTranscription }),
            ...(uploadedImageUrls && { imageUrls: uploadedImageUrls }),
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
        ...(uploadedAudioUrl && { audioUrl: uploadedAudioUrl, audioDurationSec: uploadedDurationSec }),
        ...(uploadedImageUrls && { imageUrls: uploadedImageUrls }),
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
      setSituation(""); setTask(""); setAction(""); setResult("");
      setToday(""); setInsights(""); setTomorrow("");
      setAiQuestion(null);
      setIsSaveModalOpen(false);
      if (attachedAudio) {
        URL.revokeObjectURL(attachedAudio.localUrl);
        setAttachedAudio(null);
        setIsAttachedPlaying(false);
        setAttachedPlaySec(0);
      }
      attachedImages.forEach((img) => URL.revokeObjectURL(img.localUrl));
      setAttachedImages([]);

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
    if (!hasTitleOrContent) return;
    setIsSaveModalOpen(true);
  };


  const effectiveTotalChars =
    template === "free"
      ? freeEditorCharCount || content.length
      : template === "star"
      ? (situation + task + action + result).length
      : (today + insights + tomorrow).length;

  return (
    <div className="flex min-h-full flex-1 flex-col bg-[#fafafa] dark:bg-slate-950/50">
      <header className="sticky top-0 z-50 flex h-14 w-full shrink-0 flex-nowrap items-center justify-between overflow-visible border-b border-slate-200/60 bg-white px-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex shrink-0 flex-nowrap items-center gap-2">
          <h1 className="text-sm font-medium text-slate-600 dark:text-slate-400">
            ジャーナル
          </h1>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="hidden shrink-0 gap-2 whitespace-nowrap text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100 sm:flex"
              >
                <FileText className="size-4" aria-hidden />
                テンプレート
                <ChevronDown className="size-3.5" aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {(["free", "star", "short"] as JournalTemplate[]).map((t) => (
                <DropdownMenuItem
                  key={t}
                  onClick={() => handleTemplateChange(t)}
                  className={cn(template === t && "font-semibold text-primary")}
                >
                  {template === t && <span className="mr-1">✓</span>}
                  {TEMPLATE_LABELS[t]}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="hidden min-w-0 flex-1 flex-nowrap items-center justify-center overflow-visible px-2 sm:flex">
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

            <div className="mx-1 h-5 w-px shrink-0 bg-slate-200 dark:bg-slate-700" aria-hidden />

            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={cn(
                "size-8 shrink-0",
                isVoiceMode
                  ? "bg-sky-100 text-sky-600 hover:bg-sky-200 dark:bg-sky-900/40 dark:text-sky-400"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
              )}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setIsVoiceMode((v) => !v)}
              title="音声入力モード"
            >
              <Mic className="size-4" aria-hidden />
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 shrink-0 text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => imageInputRef.current?.click()}
              title="画像を添付"
            >
              <ImagePlus className="size-4" aria-hidden />
            </Button>
          </div>
        </div>

        <div className="ml-auto flex shrink-0 flex-nowrap items-center gap-2 whitespace-nowrap border-l border-slate-200/60 pl-3 dark:border-slate-700">
          {/* 画像添付ボタン - モバイルのみ */}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 shrink-0 text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100 sm:hidden"
            onClick={() => imageInputRef.current?.click()}
            title="画像を添付"
          >
            <ImagePlus className="size-4" aria-hidden />
          </Button>

          {/* マイクボタン - モバイルのみ */}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn(
              "size-8 shrink-0 sm:hidden",
              isVoiceMode
                ? "bg-sky-100 text-sky-600 hover:bg-sky-200 dark:bg-sky-900/40 dark:text-sky-400"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            )}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setIsVoiceMode((v) => !v)}
            title="音声入力モード"
          >
            <Mic className="size-4" aria-hidden />
          </Button>

          {/* その他メニュー - モバイルのみ */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8 shrink-0 text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100 sm:hidden"
                title="メニュー"
              >
                <MoreHorizontal className="size-4" aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <FileText className="mr-2 size-4" aria-hidden />
                  テンプレート
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  {(["free", "star", "short"] as JournalTemplate[]).map((t) => (
                    <DropdownMenuItem
                      key={t}
                      onClick={() => handleTemplateChange(t)}
                      className={cn(template === t && "font-semibold text-primary")}
                    >
                      {template === t && <span className="mr-1">✓</span>}
                      {TEMPLATE_LABELS[t]}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setGoalsPanelOpen((prev) => !prev)}
              >
                <Target className="mr-2 size-4" aria-hidden />
                目標を表示
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleAiTheme}>
                <Sparkles className="mr-2 size-4" aria-hidden />
                AI相談
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setGoalsPanelOpen((prev) => !prev)}
            className={cn(
              "hidden shrink-0 whitespace-nowrap gap-2 sm:flex",
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
            className="hidden shrink-0 whitespace-nowrap gap-2 text-slate-600 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200 sm:flex"
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

      {isStudent && todayDayLabel ? (
        <div className="border-b border-slate-100 bg-slate-50/60 px-4 py-2 text-xs font-medium text-slate-600 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-200 sm:px-6">
          {todayDayLabel}
        </div>
      ) : isStudent ? (
        <div className="border-b border-slate-100 bg-amber-50/80 px-4 py-2 text-xs text-amber-700 dark:border-slate-800 dark:bg-slate-900/60 dark:text-amber-300 sm:px-6">
          入学年月日を設定すると、ここに「大学生活 ○日目」が表示されます（My Page のプロフィール編集から設定できます）。
        </div>
      ) : null}

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

              {/* 音声添付バナー */}
              {attachedAudio && (
                <div className="mb-6 rounded-xl border border-sky-200 bg-sky-50 p-4 dark:border-sky-800 dark:bg-sky-950/40">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-xs font-semibold text-sky-700 dark:text-sky-400">音声メモ</p>
                    <button
                      type="button"
                      onClick={() => {
                        URL.revokeObjectURL(attachedAudio.localUrl);
                        setAttachedAudio(null);
                        setIsAttachedPlaying(false);
                        setAttachedPlaySec(0);
                      }}
                      className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                    >
                      削除
                    </button>
                  </div>
                  <audio
                    ref={attachedAudioRef}
                    src={attachedAudio.localUrl}
                    onTimeUpdate={() => setAttachedPlaySec(attachedAudioRef.current?.currentTime ?? 0)}
                    onEnded={() => {
                      setIsAttachedPlaying(false);
                      setAttachedPlaySec(0);
                      if (attachedAudioRef.current) attachedAudioRef.current.currentTime = 0;
                    }}
                  />
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        const audio = attachedAudioRef.current;
                        if (!audio) return;
                        if (isAttachedPlaying) { audio.pause(); setIsAttachedPlaying(false); }
                        else { void audio.play(); setIsAttachedPlaying(true); }
                      }}
                      className="flex size-9 shrink-0 items-center justify-center rounded-full bg-sky-500 text-white hover:bg-sky-600"
                    >
                      {isAttachedPlaying ? <Pause className="size-4" /> : <Play className="size-4 translate-x-0.5" />}
                    </button>
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <input
                        type="range"
                        min={0}
                        max={attachedAudio.durationSec || 1}
                        step={0.1}
                        value={attachedPlaySec}
                        onChange={(e) => {
                          const t = Number(e.target.value);
                          setAttachedPlaySec(t);
                          if (attachedAudioRef.current) attachedAudioRef.current.currentTime = t;
                        }}
                        className="h-1.5 w-full cursor-pointer accent-sky-500"
                      />
                      <div className="flex justify-between text-[11px] text-slate-500">
                        <span>{formatRecordingTime(Math.floor(attachedPlaySec))}</span>
                        <span>{formatRecordingTime(Math.floor(attachedAudio.durationSec))}</span>
                      </div>
                    </div>
                  </div>
                  {attachedAudio.transcription && (
                    <p className="mt-3 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                      {attachedAudio.transcription}
                    </p>
                  )}
                </div>
              )}

              {/* 画像添付 hidden input */}
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  const files = Array.from(e.target.files ?? []);
                  const newImages = files.map((file) => ({
                    file,
                    localUrl: URL.createObjectURL(file),
                  }));
                  setAttachedImages((prev) => [...prev, ...newImages]);
                  e.target.value = "";
                }}
              />

              {/* 画像プレビュー */}
              {attachedImages.length > 0 && (
                <div className="mb-6 flex flex-wrap gap-3">
                  {attachedImages.map((img, i) => (
                    <div key={img.localUrl} className="relative group">
                      <img
                        src={img.localUrl}
                        alt={`添付画像 ${i + 1}`}
                        className="h-28 w-28 rounded-xl object-cover border border-slate-200 dark:border-slate-700 sm:h-36 sm:w-36"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          URL.revokeObjectURL(img.localUrl);
                          setAttachedImages((prev) => prev.filter((_, idx) => idx !== i));
                        }}
                        className="absolute -right-2 -top-2 flex size-6 items-center justify-center rounded-full bg-slate-800 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                        aria-label="画像を削除"
                      >
                        <X className="size-3.5" />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => imageInputRef.current?.click()}
                    className="flex h-28 w-28 items-center justify-center rounded-xl border-2 border-dashed border-slate-300 text-slate-400 hover:border-sky-400 hover:text-sky-500 transition-colors dark:border-slate-700 dark:hover:border-sky-500 sm:h-36 sm:w-36"
                    aria-label="画像を追加"
                  >
                    <ImagePlus className="size-6" />
                  </button>
                </div>
              )}

              {/* 大きなマイクボタン（音声入力モード時のみ） */}
              {isVoiceMode && <div className="flex flex-col items-center gap-3 py-8 sm:py-12">
                <button
                  type="button"
                  onClick={handleMicClick}
                  className={cn(
                    "relative flex size-24 items-center justify-center rounded-full shadow-xl transition-all duration-200 active:scale-95 sm:size-28",
                    isRecording
                      ? "bg-red-500 text-white hover:bg-red-600"
                      : "bg-sky-500 text-white hover:bg-sky-600"
                  )}
                  aria-label={isRecording ? "録音を停止" : "音声入力を開始"}
                >
                  {/* 録音中のリップルエフェクト */}
                  {isRecording && (
                    <>
                      <span className="absolute inset-0 animate-ping rounded-full bg-red-400 opacity-30" />
                      <span className="absolute inset-0 animate-pulse rounded-full bg-red-400 opacity-20" />
                    </>
                  )}
                  {isRecording ? (
                    <Square className="size-10 fill-white" aria-hidden />
                  ) : (
                    <Mic className="size-10" aria-hidden />
                  )}
                </button>
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                  {isRecording
                    ? `録音中 ${formatRecordingTime(recordingSeconds)} · タップして停止`
                    : "タップして音声入力"}
                </p>
              </div>}

              <div
                data-journal-editor=""
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

                {template === "star" && (
                  <div className="mt-6 space-y-6">
                    <TemplateField fieldName="situation" label="Situation（状況）" placeholder="そのときどんな状況でしたか？" value={situation} onChange={setSituation} />
                    <TemplateField fieldName="task" label="Task（課題）" placeholder="あなたが果たすべき役割・課題は何でしたか？" value={task} onChange={setTask} />
                    <TemplateField fieldName="action" label="Action（行動）" placeholder="課題に対して具体的にどんな行動をとりましたか？" value={action} onChange={setAction} />
                    <TemplateField fieldName="result" label="Result（結果）" placeholder="その結果どうなりましたか？学んだことは？" value={result} onChange={setResult} />
                  </div>
                )}

                {template === "short" && (
                  <div className="mt-6 space-y-6">
                    <TemplateField fieldName="today" label="今日やったこと" placeholder="今日取り組んだことを書いてみよう" value={today} onChange={setToday} />
                    <TemplateField fieldName="insights" label="気づき・学び" placeholder="今日気づいたこと、学んだことは？" value={insights} onChange={setInsights} />
                    <TemplateField fieldName="tomorrow" label="明日の改善点" placeholder="明日やってみたいことや改善したいことは？" value={tomorrow} onChange={setTomorrow} />
                  </div>
                )}

                <div
                  className={cn("mt-4 min-h-[420px] cursor-text", template !== "free" && "hidden")}
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

      {/* 音声レビューモーダル */}
      <Dialog
        open={!!voiceReview}
        onOpenChange={(open) => {
          if (!open) {
            if (voiceReview) URL.revokeObjectURL(voiceReview.audioUrl);
            setVoiceReview(null);
            setIsVoicePlaying(false);
            setVoicePlaySec(0);
            setVoiceDurationSec(0);
          }
        }}
      >
        <DialogContent className="max-w-lg sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>音声の確認</DialogTitle>
            <DialogDescription>
              録音した音声と文字起こしを確認して、エディタに添付できます。
            </DialogDescription>
          </DialogHeader>

          {voiceReview && (
            <div className="space-y-4">
              {/* 音声プレイヤー */}
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50">
                <audio
                  ref={voiceAudioRef}
                  src={voiceReview.audioUrl}
                  onLoadedMetadata={() => {
                    const dur = voiceAudioRef.current?.duration ?? 0;
                    if (isFinite(dur) && dur > 0) {
                      setVoiceDurationSec(dur);
                    } else if (voiceReview?.durationSec && voiceReview.durationSec > 0) {
                      setVoiceDurationSec(voiceReview.durationSec);
                    }
                  }}
                  onTimeUpdate={() => setVoicePlaySec(voiceAudioRef.current?.currentTime ?? 0)}
                  onEnded={() => {
                    setIsVoicePlaying(false);
                    setVoicePlaySec(0);
                    if (voiceAudioRef.current) voiceAudioRef.current.currentTime = 0;
                  }}
                />
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      const audio = voiceAudioRef.current;
                      if (!audio) return;
                      if (isVoicePlaying) { audio.pause(); setIsVoicePlaying(false); }
                      else { void audio.play(); setIsVoicePlaying(true); }
                    }}
                    className="flex size-10 shrink-0 items-center justify-center rounded-full bg-sky-500 text-white transition-colors hover:bg-sky-600 active:scale-95"
                  >
                    {isVoicePlaying ? <Pause className="size-5" /> : <Play className="size-5 translate-x-0.5" />}
                  </button>
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <input
                      type="range"
                      min={0}
                      max={voiceDurationSec || voiceReview.durationSec || 1}
                      step={0.1}
                      value={voicePlaySec}
                      onChange={(e) => {
                        const t = Number(e.target.value);
                        setVoicePlaySec(t);
                        if (voiceAudioRef.current) voiceAudioRef.current.currentTime = t;
                      }}
                      className="h-1.5 w-full cursor-pointer accent-sky-500"
                    />
                    <div className="flex justify-between text-[11px] text-slate-500 dark:text-slate-400">
                      <span>{formatRecordingTime(Math.floor(voicePlaySec))}</span>
                      <span>{formatRecordingTime(Math.floor(voiceDurationSec || voiceReview.durationSec))}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 文字起こし */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300">文字起こし</p>
                  {voiceReview.isTranscribing && (
                    <span className="flex items-center gap-1 text-xs text-slate-400">
                      <Loader2 className="size-3 animate-spin" />
                      変換中...
                    </span>
                  )}
                </div>
                <Textarea
                  value={voiceReview.transcription}
                  onChange={(e) =>
                    setVoiceReview((prev) => prev ? { ...prev, transcription: e.target.value } : prev)
                  }
                  placeholder={voiceReview.isTranscribing ? "文字起こし中..." : "文字起こし結果がここに表示されます"}
                  disabled={voiceReview.isTranscribing}
                  rows={4}
                  className="resize-none text-sm"
                />
              </div>
            </div>
          )}

          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button
              variant="outline"
              onClick={() => {
                if (voiceReview) URL.revokeObjectURL(voiceReview.audioUrl);
                setVoiceReview(null);
                setIsVoicePlaying(false);
                setVoicePlaySec(0);
                setVoiceDurationSec(0);
              }}
            >
              キャンセル
            </Button>
            <Button
              onClick={() => {
                if (!voiceReview) return;
                // 既存の添付があればURLを解放
                if (attachedAudio) URL.revokeObjectURL(attachedAudio.localUrl);
                setAttachedAudio({
                  blob: voiceReview.audioBlob,
                  localUrl: voiceReview.audioUrl,
                  transcription: voiceReview.transcription,
                  durationSec: voiceDurationSec,
                });
                setAttachedPlaySec(0);
                setIsAttachedPlaying(false);
                // モーダルを閉じる（URLはattachedAudioで引き続き使うのでrevokeしない）
                setVoiceReview(null);
                setIsVoicePlaying(false);
                setVoicePlaySec(0);
                setVoiceDurationSec(0);
              }}
            >
              <Mic className="mr-2 size-4" />
              エディタに添付
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

      {/* テンプレート切り替え確認ダイアログ */}
      <AlertDialog open={showSwitchConfirm} onOpenChange={setShowSwitchConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>テンプレートを切り替えますか？</AlertDialogTitle>
            <AlertDialogDescription>
              現在入力中の内容は失われます。「{pendingTemplate ? TEMPLATE_LABELS[pendingTemplate] : ""}」に切り替えますか？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setShowSwitchConfirm(false); setPendingTemplate(null); }}>
              キャンセル
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { if (pendingTemplate) applyTemplate(pendingTemplate); setShowSwitchConfirm(false); }}
            >
              切り替える
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

