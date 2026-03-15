"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Send, PlusCircle, RotateCcw } from "lucide-react";

import {
  SELF_ANALYSIS_SECTIONS,
  INSIGHT_SIGNAL,
} from "@/lib/self-analysis-sections";
import { type SectionId } from "@/lib/self-analysis";
import {
  categoryToSectionId,
  saveSelfAnalysisToFirestore,
} from "@/lib/self-analysis-firestore";
import { useAuth } from "@/contexts/auth-context";
import { getDb } from "@/lib/firebase";
import { cn } from "@/lib/utils";

const START_MARKER = "__COACH_START__";

const VALID_SECTIONS: SectionId[] = [
  "small-wins",
  "fun",
  "strength",
  "dream",
];

function extractSummaryFromMessage(text: string): string | null {
  const marker = "---SUMMARY---";
  const idx = text.indexOf(marker);
  if (idx !== -1) {
    const after = text.slice(idx + marker.length).trim();
    if (after) return after;
  }
  const bracketMatch = text.match(/『([^』]+)』/);
  if (bracketMatch) return bracketMatch[1].trim();
  return null;
}

/** メッセージ表示用：シグナルと SUMMARY 部分を除去 */
function getDisplayText(text: string): string {
  return text
    .replaceAll(INSIGHT_SIGNAL, "")
    .replace(/\s*---SUMMARY---[\s\S]*/, "")
    .trim();
}

/** 最後のアシスタントメッセージにシート提案シグナルが含まれるか */
function lastAssistantHasInsightSignal(
  messages: Array<{ role: string; parts?: Array<{ type: string; text?: string }> }>
): boolean {
  const last = [...messages].reverse().find((m) => m.role === "assistant");
  if (!last) return false;
  const text = getTextFromParts(last.parts ?? []);
  return text.includes(INSIGHT_SIGNAL);
}

function getTextFromParts(
  parts: Array<{ type: string; text?: string }>
): string {
  return parts
    ?.filter((p): p is { type: string; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("") ?? "";
}

export default function SelfAnalysisChatPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();

  const categoryParam = searchParams.get("category");
  const sectionParam = searchParams.get("section") as SectionId | null;
  const sectionIdFromCategory = categoryToSectionId(categoryParam);
  const sectionIdFromParam =
    sectionParam && VALID_SECTIONS.includes(sectionParam)
      ? sectionParam
      : null;
  const validSection = sectionIdFromParam ?? sectionIdFromCategory;

  const section = SELF_ANALYSIS_SECTIONS.find((s) => s.id === validSection);
  const sectionTitle = section?.title ?? "小さな成功体験";

  const [input, setInput] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [proposedSummary, setProposedSummary] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const hasInitialGreetingSent = useRef(false);
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/self-analysis/chat",
        body: { sectionId: validSection ?? "small-wins" },
      }),
    [validSection]
  );
  const {
    messages,
    sendMessage,
    status,
    error,
    clearError,
  } = useChat({ transport });

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (authLoading || user === null) return;
    if (!hasInitialGreetingSent.current && messages.length === 0 && status === "ready") {
      hasInitialGreetingSent.current = true;
      sendMessage({ text: START_MARKER });
    }
  }, [authLoading, user, messages.length, status, sendMessage]);

  useEffect(() => {
    const lastAssistant = [...messages]
      .reverse()
      .find((m) => m.role === "assistant");
    if (!lastAssistant) {
      setProposedSummary(null);
      return;
    }
    const text = getTextFromParts(lastAssistant.parts ?? []);
    if (text.includes(INSIGHT_SIGNAL)) {
      const summary = extractSummaryFromMessage(text);
      if (summary) setProposedSummary(summary);
    } else {
      setProposedSummary(null);
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

  useEffect(() => {
    if (error) {
      console.error("[chat] 通信エラー:", error.message, error);
    }
  }, [error]);

  const handleAddToSheet = async () => {
    const content = proposedSummary?.trim();
    if (!content || !user?.uid) return;

    setIsSaving(true);
    try {
      const db = getDb();
      await saveSelfAnalysisToFirestore(db, user.uid, validSection, content);
      router.push("/self-analysis");
    } catch {
      router.push("/self-analysis");
    } finally {
      setIsSaving(false);
    }
  };

  const isLoading = status === "submitted" || status === "streaming";
  const hasError = !!error || status === "error";
  const showProposalCard =
    proposedSummary &&
    !isLoading &&
    lastAssistantHasInsightSignal(messages);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center justify-between border-b border-border bg-card px-4">
        <Link
          href="/self-analysis"
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-5" />
          <span className="text-sm font-medium">戻る</span>
        </Link>
        <h1 className="text-sm font-semibold text-foreground">
          AIと自己分析中：{sectionTitle}について
        </h1>
        <div className="w-16" />
      </header>

      {/* Chat */}
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
                自己分析シートに登録するフレーズ
              </p>
              <p className="text-sm font-medium text-foreground">
                「{proposedSummary}」
              </p>
              <Button
                className="w-full gap-2"
                onClick={handleAddToSheet}
                disabled={isSaving}
              >
                <PlusCircle className="size-4" />
                シートに追加する
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
    </div>
  );
}
