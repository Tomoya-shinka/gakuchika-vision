"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Send, CheckCircle, RotateCcw } from "lucide-react";

import { GOAL_PROPOSAL_SIGNAL } from "@/app/api/goals/chat/route";
import { SELF_ANALYSIS_SECTIONS } from "@/lib/self-analysis-sections";
import { getSelfAnalysisFromFirestore } from "@/lib/self-analysis-firestore";
import { GOAL_AI_PROPOSAL_KEY } from "@/lib/goals";
import { useAuth } from "@/contexts/auth-context";
import { getDb } from "@/lib/firebase";
import { cn } from "@/lib/utils";

const START_MARKER = "__GOAL_COACH_START__";

const VALID_GOAL_TYPES = ["long", "year", "month"] as const;
const GOAL_TYPE_LABELS: Record<string, string> = {
  long: "長期ビジョン（卒業後の姿）",
  year: "1年後の目標",
  month: "1ヶ月後の目標",
};

function extractGoalFromMessage(text: string): string | null {
  const marker = "---SUMMARY---";
  const idx = text.indexOf(marker);
  if (idx !== -1) {
    const after = text.slice(idx + marker.length).trim();
    if (after) {
      const match = after.match(/『([^』]+)』/);
      if (match) return match[1].trim();
      return after;
    }
  }
  const bracketMatch = text.match(/『([^』]+)』/);
  if (bracketMatch) return bracketMatch[1].trim();
  return null;
}

function getDisplayText(text: string): string {
  return text
    .replaceAll(GOAL_PROPOSAL_SIGNAL, "")
    .replace(/\s*---SUMMARY---[\s\S]*/, "")
    .trim();
}

function lastAssistantHasGoalProposal(
  messages: Array<{ role: string; parts?: Array<{ type: string; text?: string }> }>
): boolean {
  const last = [...messages].reverse().find((m) => m.role === "assistant");
  if (!last) return false;
  const text = getTextFromParts(last.parts ?? []);
  return text.includes(GOAL_PROPOSAL_SIGNAL);
}

function getTextFromParts(
  parts: Array<{ type: string; text?: string }>
): string {
  return (
    parts
      ?.filter((p): p is { type: string; text: string } => p.type === "text")
      .map((p) => p.text)
      .join("") ?? ""
  );
}

/** 自己分析データをプロンプト用のテキストに整形 */
function formatSelfAnalysisContext(
  items: Array<{ sectionId: string; content: string }>
): string {
  const bySection: Record<string, string[]> = {};
  for (const item of items) {
    if (!bySection[item.sectionId]) bySection[item.sectionId] = [];
    if (item.content.trim()) bySection[item.sectionId].push(item.content.trim());
  }

  const lines: string[] = [];
  for (const section of SELF_ANALYSIS_SECTIONS) {
    const entries = bySection[section.id] ?? [];
    if (entries.length > 0) {
      lines.push(`【${section.title}】`);
      lines.push(...entries.map((e) => `・${e}`));
      lines.push("");
    }
  }
  return lines.join("\n").trim();
}

export default function GoalsChatPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();

  const typeParam = searchParams.get("type") ?? "long";
  const goalType = VALID_GOAL_TYPES.includes(typeParam as (typeof VALID_GOAL_TYPES)[number])
    ? typeParam
    : "long";
  const goalLabel = GOAL_TYPE_LABELS[goalType] ?? GOAL_TYPE_LABELS["long"];

  const [input, setInput] = useState("");
  const [selfAnalysisContext, setSelfAnalysisContext] = useState("");
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [proposedGoal, setProposedGoal] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const selfAnalysisRef = useRef("");

  const hasInitialGreetingSent = useRef(false);

  // Firestore から自己分析データを取得
  useEffect(() => {
    if (!user?.uid) {
      setIsLoadingData(false);
      return;
    }
    let mounted = true;
    (async () => {
      try {
        const db = getDb();
        const items = await getSelfAnalysisFromFirestore(db, user.uid);
        const formatted = formatSelfAnalysisContext(
          items.map((i) => ({ sectionId: i.sectionId, content: i.content }))
        );
        if (mounted) {
          setSelfAnalysisContext(formatted);
          selfAnalysisRef.current = formatted;
        }
      } catch {
        if (mounted) setSelfAnalysisContext("");
      } finally {
        if (mounted) setIsLoadingData(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [user?.uid]);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/goals/chat",
        body: () => ({
          goalType,
          selfAnalysisContext: selfAnalysisRef.current,
        }),
      }),
    [goalType]
  );

  const { messages, sendMessage, status, error, clearError } = useChat({
    transport,
  });

  // body で selfAnalysisRef を使うため、context 更新時に ref を同期
  useEffect(() => {
    selfAnalysisRef.current = selfAnalysisContext;
  }, [selfAnalysisContext]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (authLoading || user === null) return;
    if (
      !hasInitialGreetingSent.current &&
      messages.length === 0 &&
      status === "ready" &&
      !isLoadingData
    ) {
      hasInitialGreetingSent.current = true;
      sendMessage({ text: START_MARKER });
    }
  }, [authLoading, user, messages.length, status, sendMessage, isLoadingData]);

  useEffect(() => {
    const lastAssistant = [...messages]
      .reverse()
      .find((m) => m.role === "assistant");
    if (!lastAssistant) {
      setProposedGoal(null);
      return;
    }
    const text = getTextFromParts(lastAssistant.parts ?? []);
    if (text.includes(GOAL_PROPOSAL_SIGNAL)) {
      const goal = extractGoalFromMessage(text);
      if (goal) setProposedGoal(goal);
    } else {
      setProposedGoal(null);
    }
  }, [messages]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || status !== "ready") return;

    sendMessage({ text: trimmed });
    setInput("");
    setTimeout(scrollToBottom, 100);
  };

  const handleRetry = () => {
    clearError();
    sendMessage({ text: START_MARKER });
  };

  const handleApplyGoal = () => {
    const content = proposedGoal?.trim();
    if (!content) return;

    try {
      sessionStorage.setItem(
        `${GOAL_AI_PROPOSAL_KEY}-${goalType}`,
        JSON.stringify({ content })
      );
      router.push(`/mypage/goals/edit/${goalType}`);
    } catch {
      router.push(`/mypage/goals/edit/${goalType}`);
    }
  };

  const isLoading = status === "submitted" || status === "streaming";
  const hasError = !!error || status === "error";
  const showProposalCard =
    proposedGoal &&
    !isLoading &&
    lastAssistantHasGoalProposal(messages);

  const backHref = `/mypage/goals/edit/${goalType}`;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center justify-between border-b border-border bg-card px-4">
        <Link
          href={backHref}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-5" />
          <span className="text-sm font-medium">戻る</span>
        </Link>
        <h1 className="text-sm font-semibold text-foreground">
          AIと目標設定中：{goalLabel}
        </h1>
        <div className="w-16" />
      </header>

      {/* Loading state */}
      {isLoadingData && (
        <div className="flex flex-1 items-center justify-center p-4">
          <p className="text-sm text-muted-foreground">
            自己分析データを読み込んでいます...
          </p>
        </div>
      )}

      {/* Chat */}
      {!isLoadingData && (
        <>
          <main className="flex flex-1 flex-col overflow-y-auto px-4 py-4">
            <div className="mx-auto flex w-full max-w-lg flex-col gap-4">
              {messages.map((message) => {
                const text = getTextFromParts(message.parts ?? []);
                if (message.role === "user" && text.trim() === START_MARKER) {
                  return null;
                }
                return (
                  <div
                    key={message.id}
                    className={cn(
                      "flex",
                      message.role === "user" ? "justify-end" : "justify-start"
                    )}
                  >
                    <div
                      className={cn(
                        "max-w-[85%] rounded-2xl px-4 py-2.5",
                        message.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted/80 text-foreground"
                      )}
                    >
                      <p className="whitespace-pre-wrap break-words text-sm">
                        {getDisplayText(text)}
                      </p>
                    </div>
                  </div>
                );
              })}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="rounded-2xl bg-muted/80 px-4 py-2.5">
                    <p className="text-sm text-muted-foreground">
                      AIが考えています...
                    </p>
                  </div>
                </div>
              )}
              {hasError && (
                <div className="flex flex-col gap-2 rounded-xl border border-destructive/50 bg-destructive/10 px-4 py-3">
                  <p className="text-sm text-destructive">
                    通信エラーが発生しました。もう一度お試しください。
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRetry}
                    className="w-fit gap-2 border-destructive/50 text-destructive hover:bg-destructive/20"
                  >
                    <RotateCcw className="size-4" />
                    再試行
                  </Button>
                </div>
              )}
              {showProposalCard && (
                <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4">
                  <p className="text-xs font-medium text-muted-foreground">
                    目標入力フォームに反映する内容
                  </p>
                  <p className="text-sm font-medium text-foreground">
                    「{proposedGoal}」
                  </p>
                  <Button
                    className="w-full gap-2"
                    onClick={handleApplyGoal}
                  >
                    <CheckCircle className="size-4" />
                    これにする（フォームに反映して戻る）
                  </Button>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </main>

          {/* Input */}
          <div className="flex shrink-0 flex-col gap-2 border-t border-border bg-card p-4">
            <form onSubmit={handleSendMessage} className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage(e as unknown as React.FormEvent);
                  }
                }}
                placeholder="メッセージを入力..."
                disabled={isLoading}
                className={cn(
                  "flex-1 rounded-xl border px-4 py-2.5 text-sm outline-none transition-colors placeholder:text-muted-foreground",
                  "focus:border-primary focus:ring-2 focus:ring-primary/20",
                  "disabled:cursor-not-allowed disabled:opacity-60",
                  "border-input bg-background"
                )}
                aria-label="メッセージを入力"
              />
              <Button
                type="submit"
                size="icon"
                className="shrink-0 rounded-xl"
                disabled={!input.trim() || isLoading}
                aria-label="送信"
              >
                <Send className="size-4" />
              </Button>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
