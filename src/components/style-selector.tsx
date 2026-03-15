"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Type, ChevronDown } from "lucide-react";
import type { Editor } from "@tiptap/react";
import { cn } from "@/lib/utils";

const HOVER_CLOSE_DELAY_MS = 180;

const HEADING_LABELS = {
  paragraph: "標準",
  1: "見出し1",
  2: "見出し2",
  3: "見出し3",
} as const;

type HeadingLevel = "paragraph" | 1 | 2 | 3;

function getCurrentHeading(editor: Editor): HeadingLevel {
  if (editor.isActive("heading", { level: 1 })) return 1;
  if (editor.isActive("heading", { level: 2 })) return 2;
  if (editor.isActive("heading", { level: 3 })) return 3;
  return "paragraph";
}

export interface StyleSelectorProps {
  editor: Editor | null;
  variant?: "toolbar" | "bubble";
  className?: string;
}

/**
 * スタイル選択コンポーネント（標準 / 見出し1〜3）
 * - ホバーでメニュー表示（クリック不要、フォーカス・改行問題を回避）
 * - ボタン→メニュー間の移動を考慮した遅延閉じ
 * - メニュー項目は onMouseDown で preventDefault して改行を防止
 */
export function StyleSelector({
  editor,
  variant = "toolbar",
  className,
}: StyleSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const leaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearLeaveTimeout = useCallback(() => {
    if (leaveTimeoutRef.current) {
      clearTimeout(leaveTimeoutRef.current);
      leaveTimeoutRef.current = null;
    }
  }, []);

  const scheduleClose = useCallback(() => {
    clearLeaveTimeout();
    leaveTimeoutRef.current = setTimeout(() => {
      setIsOpen(false);
      leaveTimeoutRef.current = null;
    }, HOVER_CLOSE_DELAY_MS);
  }, [clearLeaveTimeout]);

  const handleContainerEnter = useCallback(() => {
    clearLeaveTimeout();
    setIsOpen(true);
  }, [clearLeaveTimeout]);

  const handleContainerLeave = useCallback(() => {
    scheduleClose();
  }, [scheduleClose]);

  const handleMenuEnter = useCallback(() => {
    clearLeaveTimeout();
  }, [clearLeaveTimeout]);

  useEffect(() => () => clearLeaveTimeout(), [clearLeaveTimeout]);

  if (!editor) return null;

  const currentHeading = getCurrentHeading(editor);
  const label = HEADING_LABELS[currentHeading];
  const isBubble = variant === "bubble";

  const handleParagraphMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    editor.chain().focus().setParagraph().run();
    setIsOpen(false);
  };

  const handleHeadingMouseDown = (level: 1 | 2 | 3) => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    editor.chain().focus().toggleHeading({ level }).run();
    setIsOpen(false);
  };

  return (
    <div
      className={cn("relative", className)}
      onMouseEnter={handleContainerEnter}
      onMouseLeave={handleContainerLeave}
    >
      <button
        type="button"
        className={cn(
          "flex h-8 shrink-0 items-center gap-1.5 rounded-md px-2 text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100",
          isBubble &&
            "bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
        )}
        title="文字スタイルを変更"
        aria-expanded={isOpen}
        aria-haspopup="menu"
      >
        <Type className="size-4 shrink-0" aria-hidden />
        <span
          className={cn(
            "text-left text-xs",
            isBubble && "max-w-[72px] truncate"
          )}
        >
          {label}
        </span>
        <ChevronDown className="size-3.5 shrink-0" aria-hidden />
      </button>

      {isOpen && (
        <div
          role="menu"
          className="absolute left-0 top-full z-[999] mt-1 min-w-[10rem] rounded-md border border-slate-200 bg-white py-1 text-xs shadow-lg dark:border-slate-700 dark:bg-slate-900"
          onMouseEnter={handleMenuEnter}
        >
          <button
            type="button"
            role="menuitem"
            onMouseDown={handleParagraphMouseDown}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            標準
          </button>
          <button
            type="button"
            role="menuitem"
            onMouseDown={handleHeadingMouseDown(1)}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            見出し1
          </button>
          <button
            type="button"
            role="menuitem"
            onMouseDown={handleHeadingMouseDown(2)}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            見出し2
          </button>
          <button
            type="button"
            role="menuitem"
            onMouseDown={handleHeadingMouseDown(3)}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            見出し3
          </button>
        </div>
      )}
    </div>
  );
}
