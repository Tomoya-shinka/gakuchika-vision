"use client";

import { useEffect, useRef, useState } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import { Button } from "@/components/ui/button";
import { StyleSelector } from "@/components/style-selector";
import {
  Bold,
  Italic,
  Strikethrough,
  List,
  ListOrdered,
  Quote,
  Type,
  RemoveFormatting,
  Underline as UnderlineIcon,
  Code,
  Link as LinkIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

const PLACEHOLDER_TEXT =
  "自由に書き始めてください。今日あったこと、感じたこと、考えたことなど、何でも大丈夫です...";


/** ツールバー内の書式ボタン（アクティブ時にハイライト） */
function FormatButton({
  active,
  onClick,
  title,
  children,
  className,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn(
        "size-8 shrink-0",
        active
          ? "bg-slate-200 text-slate-900 dark:bg-slate-700 dark:text-slate-100"
          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100",
        className
      )}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      title={title}
      aria-pressed={active}
    >
      {children}
    </Button>
  );
}

/** Bubble Menu 用のアイコンボタン（アクティブ時 bg-slate-100） */
function BubbleMenuButton({
  active,
  onClick,
  title,
  children,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn(
        "size-8 shrink-0 rounded-md",
        active
          ? "bg-slate-100 text-slate-900 dark:bg-slate-700 dark:text-slate-100"
          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
      )}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      title={title}
      aria-pressed={active}
    >
      {children}
    </Button>
  );
}

/** Bubble Menu 用の縦区切り線 */
function BubbleMenuDivider() {
  return (
    <div
      className="mx-0.5 h-5 w-px shrink-0 bg-slate-200 dark:bg-slate-600"
      aria-hidden
    />
  );
}

export interface JournalRichEditorProps {
  /** 初期コンテンツ（HTML） */
  initialContent?: string;
  /** エディタ準備完了時に呼ばれる（親で ref を保持して getHTML() 等に使う） */
  onEditorReady?: (editor: Editor) => void;
  /** Cmd+Enter で保存するときに呼ばれる */
  onSave?: () => void;
  /** 本文先頭で Backspace 押下時にタイトルへフォーカスを戻す（Notion風） */
  onFocusTitleRequested?: () => void;
  /** プレースホルダー文言 */
  placeholder?: string;
  /** エディタの className */
  className?: string;
}

export function JournalRichEditor({
  initialContent = "",
  onEditorReady,
  onSave,
  onFocusTitleRequested,
  placeholder = PLACEHOLDER_TEXT,
  className,
}: JournalRichEditorProps) {
  const onEditorReadyRef = useRef(onEditorReady);
  const onSaveRef = useRef(onSave);
  const onFocusTitleRef = useRef(onFocusTitleRequested);
  onEditorReadyRef.current = onEditorReady;
  onSaveRef.current = onSave;
  onFocusTitleRef.current = onFocusTitleRequested;

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Placeholder.configure({
        placeholder,
        emptyEditorClass: "is-editor-empty",
        emptyNodeClass: "is-editor-empty",
      }),
      Underline,
      Link.configure({ openOnClick: false }),
    ],
    content: initialContent || undefined,
    editorProps: {
      attributes: {
        class:
          "prose-journal prose min-h-[380px] w-full resize-none border-none bg-transparent text-lg leading-relaxed text-slate-800 outline-none focus:outline-none dark:text-slate-200 md:text-xl",
        "data-placeholder": placeholder,
      },
      handleKeyDown: (view, event) => {
        if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
          event.preventDefault();
          onSaveRef.current?.();
          return true;
        }
        // 本文先頭（位置1）で Backspace → タイトルにフォーカス（Notion風）
        if (event.key === "Backspace" && view.state.selection.from === 1) {
          event.preventDefault();
          onFocusTitleRef.current?.();
          return true;
        }
        return false;
      },
    },
    immediatelyRender: false,
  });

  useEffect(() => {
    if (!editor) return;
    onEditorReadyRef.current?.(editor);
  }, [editor]);

  const [isEmpty, setIsEmpty] = useState(true);
  const [, setHeadingSync] = useState(0);
  useEffect(() => {
    if (!editor) return;
    setIsEmpty(editor.isEmpty);
    const h = () => setIsEmpty(editor.isEmpty);
    editor.on("update", h);
    editor.on("selectionUpdate", h);
    return () => {
      editor.off("update", h);
      editor.off("selectionUpdate", h);
    };
  }, [editor]);
  useEffect(() => {
    if (!editor) return;
    let prev: "paragraph" | 1 | 2 | 3 = "paragraph";
    const getHeading = () => {
      if (editor.isActive("heading", { level: 1 })) return 1;
      if (editor.isActive("heading", { level: 2 })) return 2;
      if (editor.isActive("heading", { level: 3 })) return 3;
      return "paragraph";
    };
    const h = () => {
      const next = getHeading();
      if (prev !== next) {
        prev = next;
        setHeadingSync((s) => s + 1);
      }
    };
    editor.on("selectionUpdate", h);
    editor.on("transaction", h);
    return () => {
      editor.off("selectionUpdate", h);
      editor.off("transaction", h);
    };
  }, [editor]);

  // 本文をすべて削除した場合、1行目を自動的に「標準」に戻す
  useEffect(() => {
    if (!editor) return;
    const ensureParagraphWhenEmpty = () => {
      if (!editor.isEmpty) return;
      if (editor.isActive("paragraph")) return;
      queueMicrotask(() => {
        editor.chain().focus().setParagraph().run();
      });
    };
    editor.on("transaction", ensureParagraphWhenEmpty);
    return () => {
      editor.off("transaction", ensureParagraphWhenEmpty);
    };
  }, [editor]);

  if (!editor) return null;

  return (
    <div
      className={cn(
        "flex flex-col",
        isEmpty && "journal-editor-empty",
        className
      )}
      data-placeholder={placeholder}
    >
      <EditorContent editor={editor} />
      <BubbleMenu
        editor={editor}
        shouldShow={({ state }) => {
          const { selection } = state;
          return !selection.empty;
        }}
        options={{
          placement: "top",
          offset: 8,
        }}
        className="z-[999] flex items-center gap-0 rounded-lg border border-slate-200 bg-white/95 py-1.5 px-1 shadow-lg backdrop-blur-sm dark:border-slate-700 dark:bg-slate-900/95"
      >
        <StyleSelector editor={editor} variant="bubble" />
        <BubbleMenuDivider />
        {/* 太字・斜体・下線・打ち消し */}
        <BubbleMenuButton
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
          title="太字 (Ctrl+B)"
        >
          <Bold className="size-4" aria-hidden />
        </BubbleMenuButton>
        <BubbleMenuButton
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          title="斜体 (Ctrl+I)"
        >
          <Italic className="size-4" aria-hidden />
        </BubbleMenuButton>
        <BubbleMenuButton
          active={editor.isActive("underline")}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          title="下線"
        >
          <UnderlineIcon className="size-4" aria-hidden />
        </BubbleMenuButton>
        <BubbleMenuButton
          active={editor.isActive("strike")}
          onClick={() => editor.chain().focus().toggleStrike().run()}
          title="打ち消し線"
        >
          <Strikethrough className="size-4" aria-hidden />
        </BubbleMenuButton>
        <BubbleMenuDivider />
        {/* 箇条書き */}
        <BubbleMenuButton
          active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          title="箇条書き"
        >
          <List className="size-4" aria-hidden />
        </BubbleMenuButton>
        <BubbleMenuDivider />
        {/* インラインコード・リンク */}
        <BubbleMenuButton
          active={editor.isActive("code")}
          onClick={() => editor.chain().focus().toggleCode().run()}
          title="インラインコード"
        >
          <Code className="size-4" aria-hidden />
        </BubbleMenuButton>
        <BubbleMenuButton
          active={editor.isActive("link")}
          onClick={() => {
            if (editor.isActive("link")) {
              editor.chain().focus().unsetLink().run();
              return;
            }
            const url = window.prompt("URLを入力してください");
            if (url) {
              editor.chain().focus().setLink({ href: url }).run();
            }
          }}
          title="リンク"
        >
          <LinkIcon className="size-4" aria-hidden />
        </BubbleMenuButton>
      </BubbleMenu>
    </div>
  );
}

/** 固定ツールバー用の書式コントロール（Editor を渡して使用） */
export function JournalFormatToolbar({
  editor,
  onClearFormat,
  compact = false,
}: {
  editor: Editor | null;
  onClearFormat?: () => void;
  /** true のとき引用・クリアを非表示（サイドバー展開時や狭い画面用） */
  compact?: boolean;
}) {
  if (!editor) return null;

  return (
    <div className="flex flex-nowrap items-center gap-1 border-r border-slate-200 pr-2 dark:border-slate-700">
      {compact ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 shrink-0 gap-1 px-2 text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor.chain().focus().setParagraph().run()}
          title="標準テキスト"
        >
          <Type className="size-4" aria-hidden />
          標準
        </Button>
      ) : (
        <StyleSelector editor={editor} variant="toolbar" />
      )}

      {/* スタイル: 太字・斜体・打ち消し */}
      <FormatButton
        active={editor.isActive("bold")}
        onClick={() => editor.chain().focus().toggleBold().run()}
        title="太字 (Ctrl+B)"
      >
        <Bold className="size-4 font-bold" aria-hidden />
      </FormatButton>
      <FormatButton
        active={editor.isActive("italic")}
        onClick={() => editor.chain().focus().toggleItalic().run()}
        title="斜体 (Ctrl+I)"
      >
        <Italic className="size-4 italic" aria-hidden />
      </FormatButton>
      <FormatButton
        active={editor.isActive("strike")}
        onClick={() => editor.chain().focus().toggleStrike().run()}
        title="打ち消し線"
      >
        <Strikethrough className="size-4" aria-hidden />
      </FormatButton>

      {/* リスト */}
      <FormatButton
        active={editor.isActive("bulletList")}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        title="箇条書き"
      >
        <List className="size-4" aria-hidden />
      </FormatButton>
      <FormatButton
        active={editor.isActive("orderedList")}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        title="番号付きリスト"
      >
        <ListOrdered className="size-4" aria-hidden />
      </FormatButton>

      {/* 引用・クリア（compact 時は非表示。compact でないときも lg 未満では非表示） */}
      {!compact && (
        <span className="hidden items-center gap-1 lg:inline-flex">
          <FormatButton
            active={editor.isActive("blockquote")}
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            title="引用"
          >
            <Quote className="size-4" aria-hidden />
          </FormatButton>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 shrink-0 text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-300"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              editor.chain().focus().clearNodes().unsetAllMarks().run();
              onClearFormat?.();
            }}
            title="書式をクリア"
          >
            <RemoveFormatting className="size-4" aria-hidden />
            クリア
          </Button>
        </span>
      )}
    </div>
  );
}
