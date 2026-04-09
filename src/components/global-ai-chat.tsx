"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import {
  Send,
  Bot,
  User,
  MessageSquareDot,
  ChevronDown,
  BrainCircuit,
  Square,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { stripHtml } from "@/lib/journal";
import { loadSelfAnalysisItems } from "@/lib/self-analysis";
import { loadGoals } from "@/lib/goals";
import { loadFolders } from "@/lib/self-analysis-folders";
import {
  type ChatMode,
  DEFAULT_QUICK_ACTIONS,
  COACHING_QUICK_ACTIONS,
  COACHING_WELCOME_MESSAGE,
} from "@/lib/ai-prompts";
import { collection, query, where, getDocs, Timestamp } from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import { useAuth } from "@/contexts/auth-context";

type ContextData = {
  journals: { title?: string; contentPlain: string; createdAt: string }[];
  selfAnalysis: { folderName: string; text: string }[];
  goals: {
    longTermVision?: string;
    oneYearGoal?: string;
    oneMonthGoal?: string;
    smallSteps?: { label: string; done: boolean; dueDate?: string }[];
  };
};

async function buildContext(userId: string): Promise<ContextData> {
  // FirestoreからSnapのみ取得（コンパクトな洞察のみAIに渡す）
  let journals: ContextData["journals"] = [];
  try {
    const db = getDb();
    const q = query(
      collection(db, "journals"),
      where("userId", "==", userId),
      where("type", "==", "snap")
    );
    const snap = await getDocs(q);
    const list: { title?: string; contentPlain: string; createdAt: string }[] = [];
    snap.forEach((d) => {
      const data = d.data();
      const createdAt = data.createdAt instanceof Timestamp
        ? data.createdAt.toDate().toISOString()
        : String(data.createdAt ?? "");
      list.push({
        contentPlain: stripHtml(String(data.content ?? "")),
        createdAt,
      });
    });
    list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    journals = list.slice(0, 50);
  } catch {
    // Firestore取得失敗時は空
  }

  // フォルダ名を解決（sectionId → フォルダ表示名）
  const folders = loadFolders();
  const folderMap = new Map(folders.map((f) => [f.id, f.name]));
  const selfAnalysis = loadSelfAnalysisItems().map((s) => ({
    folderName: folderMap.get(s.sectionId) ?? s.sectionId,
    text: s.text,
  }));

  // 目標データ
  const goalsData = loadGoals();
  const goals: ContextData["goals"] = {
    longTermVision: goalsData.longTermVision.content || undefined,
    oneYearGoal: goalsData.oneYearGoal.content || undefined,
    oneMonthGoal: goalsData.oneMonthGoal.content || undefined,
    smallSteps:
      goalsData.smallSteps.length > 0
        ? goalsData.smallSteps.map((s) => ({
            label: s.label,
            done: s.done,
            dueDate: s.dueDate,
          }))
        : undefined,
  };

  return { journals, selfAnalysis, goals };
}

export function GlobalAiChat() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<ChatMode>("default");
  const [input, setInput] = useState("");
  const [stopped, setStopped] = useState(false);
  const [contextData, setContextData] = useState<ContextData>({
    journals: [],
    selfAnalysis: [],
    goals: {},
  });
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load context on mount (client-side only)
  useEffect(() => {
    if (!user?.uid) return;
    buildContext(user.uid).then(setContextData);
  }, [user?.uid]);

  // Refresh context each time panel opens
  useEffect(() => {
    if (isOpen && user?.uid) {
      buildContext(user.uid).then(setContextData);
    }
  }, [isOpen, user?.uid]);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/ai-chat",
        body: { context: contextData, mode },
      }),
    [contextData, mode]
  );

  const { messages, sendMessage, status, setMessages, stop } = useChat({ transport });

  const isLoading = status === "submitted" || status === "streaming";

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;
    setStopped(false);
    sendMessage({ text: trimmed });
    setInput("");
  };

  const handleStop = () => {
    stop();
    setStopped(true);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleModeChange = (newMode: ChatMode) => {
    setMode(newMode);
    setMessages([]);
    setStopped(false);
  };

  const handleQuickAction = (text: string) => {
    setStopped(false);
    sendMessage({ text });
  };

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setIsOpen(true)}
        className={cn(
          "fixed bottom-20 right-4 z-[200] flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xl transition-all duration-200 hover:scale-105 active:scale-95 md:bottom-6 md:right-6",
          isOpen && "pointer-events-none opacity-0"
        )}
        aria-label="AIアシスタントを開く"
      >
        <MessageSquareDot className="size-6" />
      </button>

      {/* Backdrop (mobile) */}
      {isOpen && (
        <div
          className="fixed inset-0 z-[199] bg-black/30 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Chat panel */}
      <div
        className={cn(
          "fixed z-[200] flex flex-col overflow-hidden bg-background shadow-2xl transition-all duration-300",
          "bottom-0 left-0 right-0 rounded-t-2xl border-t border-border",
          "md:bottom-6 md:left-auto md:right-6 md:w-[420px] md:rounded-2xl md:border",
          isOpen
            ? "h-[85svh] md:h-[600px]"
            : "h-0 md:h-0 pointer-events-none opacity-0"
        )}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <MessageSquareDot className="size-4" />
            </div>
            <div>
              <p className="text-sm font-semibold">AIアシスタント</p>
              <p className="text-xs text-muted-foreground">
                {mode === "coaching" ? "壁打ち・コーチングモード" : "日々の振り返りをサポート"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {/* モードトグル */}
            <div className="flex items-center gap-0.5 rounded-md border p-0.5 text-xs">
              <button
                onClick={() => handleModeChange("default")}
                className={cn(
                  "rounded px-2 py-1 transition-colors",
                  mode === "default"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                通常
              </button>
              <button
                onClick={() => handleModeChange("coaching")}
                className={cn(
                  "flex items-center gap-1 rounded px-2 py-1 transition-colors",
                  mode === "coaching"
                    ? "bg-emerald-600 text-white"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <BrainCircuit className="size-3" />
                コーチング
              </button>
            </div>
            {messages.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-xs text-muted-foreground"
                onClick={() => setMessages([])}
              >
                クリア
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={() => setIsOpen(false)}
              aria-label="閉じる"
            >
              <ChevronDown className="size-4" />
            </Button>
          </div>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-4">
          {messages.length === 0 && (
            <div className="space-y-4">
              {/* Welcome message */}
              <div className="flex gap-3">
                <div className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-full",
                  mode === "coaching" ? "bg-emerald-100 text-emerald-600" : "bg-primary/10 text-primary"
                )}>
                  {mode === "coaching" ? <BrainCircuit className="size-3.5" /> : <Bot className="size-3.5" />}
                </div>
                <div className={cn(
                  "rounded-2xl rounded-tl-sm px-4 py-3 text-sm leading-relaxed",
                  mode === "coaching"
                    ? "bg-emerald-50 text-foreground dark:bg-emerald-950/30"
                    : "bg-muted text-foreground"
                )}>
                  {mode === "coaching"
                    ? COACHING_WELCOME_MESSAGE
                    : "ジャーナルのまとめや振り返り、アプリの使い方など、何でも聞いてください。"}
                </div>
              </div>

              {/* Quick action chips */}
              <div className="pl-10">
                <p className="mb-2 text-xs text-muted-foreground">
                  {mode === "coaching" ? "話したいテーマを選ぶ：" : "よく使われる質問："}
                </p>
                <div className="flex flex-wrap gap-2">
                  {(mode === "coaching" ? COACHING_QUICK_ACTIONS : DEFAULT_QUICK_ACTIONS).map((action) => (
                    <button
                      key={action}
                      onClick={() => handleQuickAction(action)}
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-xs transition-colors",
                        mode === "coaching"
                          ? "border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 active:bg-emerald-200 dark:border-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300"
                          : "border-primary/30 bg-primary/5 text-primary hover:bg-primary/10 active:bg-primary/15"
                      )}
                    >
                      {action}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {messages.map((m) => {
            const isUser = m.role === "user";
            const text =
              m.parts
                ?.filter(
                  (p): p is { type: "text"; text: string } => p.type === "text"
                )
                .map((p) => p.text)
                .join("") ?? "";

            return (
              <div
                key={m.id}
                className={cn("flex gap-2.5", isUser && "flex-row-reverse")}
              >
                <div
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-full",
                    isUser
                      ? "bg-primary text-primary-foreground"
                      : mode === "coaching"
                      ? "bg-emerald-100 text-emerald-600"
                      : "bg-primary/10 text-primary"
                  )}
                >
                  {isUser ? (
                    <User className="size-3.5" />
                  ) : mode === "coaching" ? (
                    <BrainCircuit className="size-3.5" />
                  ) : (
                    <Bot className="size-3.5" />
                  )}
                </div>
                <div
                  className={cn(
                    "max-w-[82%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap",
                    isUser
                      ? "rounded-tr-sm bg-primary text-primary-foreground"
                      : mode === "coaching"
                      ? "rounded-tl-sm bg-emerald-50 text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100"
                      : "rounded-tl-sm bg-muted text-foreground"
                  )}
                >
                  {text}
                </div>
              </div>
            );
          })}

          {isLoading && (
            <div className="flex gap-2.5">
              <div className={cn(
                "flex size-7 shrink-0 items-center justify-center rounded-full",
                mode === "coaching" ? "bg-emerald-100 text-emerald-600" : "bg-primary/10 text-primary"
              )}>
                {mode === "coaching" ? <BrainCircuit className="size-3.5" /> : <Bot className="size-3.5" />}
              </div>
              <div className={cn(
                "rounded-2xl rounded-tl-sm px-4 py-3",
                mode === "coaching"
                  ? "bg-emerald-50 dark:bg-emerald-950/30"
                  : "bg-muted"
              )}>
                <div className="flex items-center gap-1.5">
                  <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:0ms]" />
                  <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:150ms]" />
                  <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:300ms]" />
                </div>
              </div>
            </div>
          )}

          {stopped && !isLoading && (
            <p className="text-center text-xs text-muted-foreground">回答を停止しました。</p>
          )}
        </div>

        {/* Input */}
        <div className="shrink-0 border-t p-3">
          <div className="flex items-end gap-2">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="メッセージを入力... (Shift+Enterで改行)"
              className="min-h-[44px] max-h-32 resize-none text-sm"
              rows={1}
            />
            <Button
              type="button"
              size="icon"
              className="shrink-0"
              disabled={!isLoading && !input.trim()}
              onClick={isLoading ? handleStop : handleSend}
              aria-label={isLoading ? "停止" : "送信"}
            >
              {isLoading ? (
                <Square className="size-4" />
              ) : (
                <Send className="size-4" />
              )}
            </Button>
          </div>
          <p className="mt-1.5 text-center text-[10px] text-muted-foreground">
            AIの回答は参考情報です。重要な判断は自身で確認してください。
          </p>
        </div>
      </div>
    </>
  );
}
