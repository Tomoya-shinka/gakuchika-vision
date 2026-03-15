"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  loadGoals,
  saveGoals,
  GOAL_AI_PROPOSAL_KEY,
  type GoalsData,
  type GoalItem,
} from "@/lib/goals";
import { ArrowLeft, Sparkles } from "lucide-react";

const TYPE_MAP = {
  long: {
    key: "longTermVision" as const,
    title: "長期ビジョン（卒業後の姿）",
    contentPlaceholder: "例：希望する業界で内定を獲得し、自信を持って社会人としてスタートしている",
  },
  year: {
    key: "oneYearGoal" as const,
    title: "1年後の目標",
    contentPlaceholder: "例：インターンに2社以上参加し、業界研究を深める",
  },
  month: {
    key: "oneMonthGoal" as const,
    title: "1ヶ月後の目標",
    contentPlaceholder: "例：企業リスト20社作成、OB訪問3件申し込み",
  },
};

export default function GoalEditPage() {
  const params = useParams();
  const router = useRouter();
  const typeParam = String(params.type ?? "");
  const config = TYPE_MAP[typeParam as keyof typeof TYPE_MAP];

  const [data, setData] = useState<GoalsData | null>(null);
  const [content, setContent] = useState("");
  const [image, setImage] = useState("");
  const [deadline, setDeadline] = useState("");

  const load = useCallback(() => {
    const g = loadGoals();
    setData(g);
    if (config) {
      const item = g[config.key];
      let initialContent = item.content ?? "";
      let initialImage = item.image ?? "";
      let initialDeadline = item.deadline ?? "";

      // AIチャットから戻った際の提案を反映
      try {
        const stored = sessionStorage.getItem(`${GOAL_AI_PROPOSAL_KEY}-${typeParam}`);
        if (stored) {
          const parsed = JSON.parse(stored) as { content?: string; image?: string; deadline?: string };
          if (parsed.content) initialContent = parsed.content;
          if (parsed.image) initialImage = parsed.image;
          if (parsed.deadline) initialDeadline = parsed.deadline;
          sessionStorage.removeItem(`${GOAL_AI_PROPOSAL_KEY}-${typeParam}`);
        }
      } catch {
        // ignore
      }

      setContent(initialContent);
      setImage(initialImage);
      setDeadline(initialDeadline);
    }
  }, [config, typeParam]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = () => {
    if (!data || !config) return;
    const now = new Date().toISOString();
    const item: GoalItem = {
      content: content.trim(),
      image: image.trim(),
      deadline: deadline.trim(),
      updatedAt: now,
    };
    const next = { ...data, [config.key]: item };
    setData(next);
    saveGoals(next);
    router.push("/mypage/goals");
  };

  if (!config) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center border-b border-border bg-background px-4">
          <Link
            href="/mypage/goals"
            className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" aria-hidden />
            戻る
          </Link>
        </header>
        <main className="flex flex-1 items-center justify-center p-6">
          <p className="text-sm text-muted-foreground">無効なページです</p>
        </main>
      </div>
    );
  }

  if (data == null) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center border-b border-border bg-background px-4">
          <Link
            href="/mypage/goals"
            className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" aria-hidden />
            戻る
          </Link>
        </header>
        <main className="flex flex-1 items-center justify-center p-6">
          <p className="text-sm text-muted-foreground">読み込み中...</p>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex shrink-0 items-center border-b border-border bg-background px-4 py-3">
        <Link
          href="/mypage/goals"
          className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden />
          戻る（My Pageへ）
        </Link>
      </header>

      <main className="flex flex-1 flex-col overflow-auto bg-gradient-to-b from-slate-50/40 via-white to-sky-50/20 px-4 py-10 dark:from-slate-950/20 dark:via-background dark:to-sky-950/10 sm:px-6">
        <div className="mx-auto w-full max-w-xl space-y-12">
          <div className="space-y-4">
            <h1 className="text-xl font-semibold text-foreground">
              {config.title}
            </h1>
            <p className="text-sm text-muted-foreground">
              自分と向き合い、目標を具体化していきましょう
            </p>
            <Link href={`/goals/chat?type=${typeParam}`} className="inline-block">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-10 gap-2 border-2 border-sky-300 bg-sky-50 px-5 text-sm font-semibold text-sky-700 shadow-md hover:bg-sky-100 dark:border-sky-600 dark:bg-sky-950/50 dark:text-sky-300"
              >
                <Sparkles className="size-4" aria-hidden />
                ✨ AIに相談
              </Button>
            </Link>
          </div>

          <div className="space-y-8">
            <div className="space-y-3">
              <Label htmlFor="content" className="text-sm font-medium">
                目標の内容 <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder={config.contentPlaceholder}
                className="min-h-[120px] resize-none text-base leading-relaxed"
              />
            </div>

            <div className="space-y-3">
              <Label htmlFor="image" className="text-sm font-medium text-muted-foreground">
                達成時の具体的なイメージ（任意）
              </Label>
              <Textarea
                id="image"
                value={image}
                onChange={(e) => setImage(e.target.value)}
                placeholder="達成したとき、どんな感情で、周りに誰がいて、どんな景色が見えているか。自由に書いてみましょう。"
                className="min-h-[160px] resize-none text-base leading-relaxed"
              />
            </div>

            <div className="space-y-3">
              <Label htmlFor="deadline" className="text-sm font-medium text-muted-foreground">
                達成予定日（任意）
              </Label>
              <Input
                id="deadline"
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="max-w-[200px]"
              />
            </div>
          </div>

          <div className="pt-4">
            <Button
              size="lg"
              className="w-full text-base sm:w-auto sm:min-w-[220px]"
              onClick={handleSave}
              disabled={!content.trim()}
            >
              保存して戻る
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
