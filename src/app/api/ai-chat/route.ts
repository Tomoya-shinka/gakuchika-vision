import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { openai } from "@ai-sdk/openai";
import {
  type ChatMode,
  COACHING_SYSTEM_PROMPT,
} from "@/lib/ai-prompts";

export const maxDuration = 60;

interface JournalContext {
  title?: string;
  contentPlain: string;
  createdAt: string;
}

interface SelfAnalysisContext {
  folderName: string;
  text: string;
}

interface GoalsContext {
  longTermVision?: string;
  oneYearGoal?: string;
  oneMonthGoal?: string;
  smallSteps?: { label: string; done: boolean; dueDate?: string }[];
}

interface ChatContext {
  journals?: JournalContext[];
  selfAnalysis?: SelfAnalysisContext[];
  goals?: GoalsContext;
}

type SummaryPeriod = "thisWeek" | "lastWeek" | "thisMonth" | "lastMonth" | null;

/** ユーザーの最新メッセージから振り返り期間を検出する */
function detectSummaryPeriod(messages: UIMessage[]): SummaryPeriod {
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  if (!lastUser) return null;
  const text =
    lastUser.parts
      ?.filter((p): p is { type: "text"; text: string } => p.type === "text")
      .map((p) => p.text)
      .join("") ?? "";
  if (/今週/.test(text)) return "thisWeek";
  if (/先週|1週間|一週間|週間|weekly/.test(text)) return "lastWeek";
  if (/今月/.test(text)) return "thisMonth";
  if (/先月|1か月|1ヶ月|一ヶ月|一か月|月間|monthly/.test(text)) return "lastMonth";
  return null;
}

/** 期間内のジャーナルを抽出する（週は日曜始まり） */
function filterJournalsByPeriod(
  journals: JournalContext[],
  period: SummaryPeriod
): JournalContext[] {
  if (!period) return journals;
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0=日, 1=月, ..., 6=土

  if (period === "thisWeek") {
    // 今週の日曜00:00〜現在
    const thisSunday = new Date(now);
    thisSunday.setDate(now.getDate() - dayOfWeek);
    thisSunday.setHours(0, 0, 0, 0);
    return journals.filter((j) => new Date(j.createdAt) >= thisSunday);
  }

  if (period === "lastWeek") {
    // 先週の日曜00:00〜土曜23:59:59
    const lastSunday = new Date(now);
    lastSunday.setDate(now.getDate() - dayOfWeek - 7);
    lastSunday.setHours(0, 0, 0, 0);
    const lastSaturday = new Date(lastSunday);
    lastSaturday.setDate(lastSunday.getDate() + 6);
    lastSaturday.setHours(23, 59, 59, 999);
    return journals.filter((j) => {
      const d = new Date(j.createdAt);
      return d >= lastSunday && d <= lastSaturday;
    });
  }

  if (period === "thisMonth") {
    // 今月1日00:00〜現在
    const firstOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    return journals.filter((j) => new Date(j.createdAt) >= firstOfThisMonth);
  }

  // lastMonth: 先月1日〜末日
  const firstOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const firstOfLastMonth = new Date(
    firstOfThisMonth.getFullYear(),
    firstOfThisMonth.getMonth() - 1,
    1
  );
  const lastOfLastMonth = new Date(firstOfThisMonth.getTime() - 1);
  return journals.filter((j) => {
    const d = new Date(j.createdAt);
    return d >= firstOfLastMonth && d <= lastOfLastMonth;
  });
}

function getPeriodLabel(period: SummaryPeriod): string {
  if (period === "thisWeek") return "今週";
  if (period === "lastWeek") return "先週";
  if (period === "thisMonth") return "今月";
  if (period === "lastMonth") return "先月";
  return "";
}

/** 自己分析シートのセクションをプロンプト文字列に変換 */
function buildSelfAnalysisSection(selfAnalysis: SelfAnalysisContext[]): string {
  if (selfAnalysis.length === 0) return `## 自己分析シート\nまだ記録がありません。\n\n`;
  const grouped: Record<string, string[]> = {};
  for (const item of selfAnalysis) {
    if (!grouped[item.folderName]) grouped[item.folderName] = [];
    grouped[item.folderName].push(item.text);
  }
  let section = `## 自己分析シート\n`;
  for (const [folderName, items] of Object.entries(grouped)) {
    section += `\n### ${folderName}\n`;
    items.forEach((t) => (section += `- ${t}\n`));
  }
  return section + "\n";
}

/** 目標データをプロンプト文字列に変換 */
function buildGoalsSection(goals?: GoalsContext): string {
  if (!goals) return "";
  const hasAny = goals.longTermVision || goals.oneYearGoal || goals.oneMonthGoal ||
    (goals.smallSteps && goals.smallSteps.length > 0);
  if (!hasAny) return `## 目標設定\nまだ目標が設定されていません。\n\n`;
  let section = `## 目標設定\n`;
  if (goals.longTermVision) section += `- **長期ビジョン**: ${goals.longTermVision}\n`;
  if (goals.oneYearGoal)    section += `- **1年後の目標**: ${goals.oneYearGoal}\n`;
  if (goals.oneMonthGoal)   section += `- **今月の目標**: ${goals.oneMonthGoal}\n`;
  if (goals.smallSteps && goals.smallSteps.length > 0) {
    const pending = goals.smallSteps.filter((s) => !s.done);
    const done    = goals.smallSteps.filter((s) => s.done);
    if (pending.length > 0)
      section += `- **進行中のアクション**: ${pending.map((s) => s.label).join("、")}\n`;
    if (done.length > 0)
      section += `- **完了済みアクション**: ${done.map((s) => s.label).join("、")}\n`;
  }
  return section + "\n";
}

function buildSystemPrompt(
  context: ChatContext,
  summaryPeriod: SummaryPeriod,
  periodJournals: JournalContext[],
  mode: ChatMode = "default"
): string {
  const allJournals = context?.journals ?? [];
  const selfAnalysis = context?.selfAnalysis ?? [];
  const goals = context?.goals;

  // コーチングモード: 専用プロンプト + ユーザーデータを追記
  if (mode === "coaching") {
    let prompt = COACHING_SYSTEM_PROMPT;
    if (allJournals.length > 0) {
      prompt += `\n## ジャーナル記録（直近 ${allJournals.length} 件）\n`;
      allJournals.forEach((j, i) => {
        const date = j.createdAt ? j.createdAt.slice(0, 10) : "";
        const title = j.title ? `「${j.title}」` : "無題";
        prompt += `\n### ${i + 1}. ${title} (${date})\n${j.contentPlain}\n`;
      });
      prompt += "\n";
    } else {
      prompt += `\n## ジャーナル記録\nまだ記録がありません。\n\n`;
    }
    prompt += buildSelfAnalysisSection(selfAnalysis);
    prompt += buildGoalsSection(goals);
    return prompt;
  }

  // 振り返りモード: ジャーナルのみ使用
  if (summaryPeriod) {
    const label = getPeriodLabel(summaryPeriod);
    let prompt = `あなたは「ガクチカビジョン」アプリのAIアシスタントです。
ユーザーが${label}の振り返りを求めています。以下の${label}のジャーナル記録のみを参照して、まとめを作成してください。

`;
    prompt += `## ${label}のジャーナル記録（${periodJournals.length}件）\n`;
    periodJournals.forEach((j, i) => {
      const date = j.createdAt ? j.createdAt.slice(0, 10) : "";
      const title = j.title ? `「${j.title}」` : "無題";
      prompt += `\n### ${i + 1}. ${title} (${date})\n${j.contentPlain}\n`;
    });

    prompt += `
## まとめの作成指針
- ${label}全体の流れをわかりやすく整理する
- 頑張ったこと・気づき・成長をポジティブに伝える
- ジャーナルに書かれた具体的なエピソードや日付を引用する
- 「来週/来月につながること」や「気づいた課題」があれば触れる
- 回答は日本語で、フレンドリーで温かみのある丁寧な口調にする
- 見出しと箇条書きを活用して読みやすくまとめる
- 自己分析シートのデータは使わない`;
    return prompt;
  }

  // 通常モード: ジャーナル + 自己分析 + 目標を使用
  let prompt = `あなたは「ガクチカビジョン」アプリのAIアシスタントです。
大学生のガクチカ（学生時代に力を入れたこと）の振り返りと就職活動の準備をサポートします。

以下のユーザーデータを参照して、具体的で的確なアドバイスをしてください。

`;

  if (allJournals.length > 0) {
    prompt += `## ジャーナル記録（直近 ${allJournals.length} 件）\n`;
    allJournals.forEach((j, i) => {
      const date = j.createdAt ? j.createdAt.slice(0, 10) : "";
      const title = j.title ? `「${j.title}」` : "無題";
      prompt += `\n### ${i + 1}. ${title} (${date})\n${j.contentPlain}\n`;
    });
    prompt += "\n";
  } else {
    prompt += `## ジャーナル記録\nまだ記録がありません。\n\n`;
  }

  prompt += buildSelfAnalysisSection(selfAnalysis);
  prompt += buildGoalsSection(goals);

  prompt += `## あなたの役割と行動指針
- ユーザーの目標や方向性を見つける手伝いをする
- 自己分析シートの内容から強みや成功体験を整理・発見する手伝いをする
- 設定済みの目標に関連するアドバイスや振り返りを積極的に行う
- ガクチカのエピソード候補を提案し、STAR法でまとめる手伝いをする
- 具体的なデータ（日付・エピソード・感情・目標）を引用しながら回答する
- 回答は日本語で、フレンドリーで温かみのある丁寧な口調にする
- 箇条書きや見出しを活用して読みやすくまとめる`;

  return prompt;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { messages, context, mode = "default" } = body as {
      messages: UIMessage[];
      context?: ChatContext;
      mode?: ChatMode;
    };

    if (!process.env.OPENAI_API_KEY) {
      return Response.json(
        { error: "OpenAI API key is not configured" },
        { status: 503 }
      );
    }

    const allJournals = context?.journals ?? [];

    // コーチングモードでは振り返り検出をスキップ
    const summaryPeriod = mode === "coaching" ? null : detectSummaryPeriod(messages);
    const periodJournals = summaryPeriod
      ? filterJournalsByPeriod(allJournals, summaryPeriod)
      : [];

    // 振り返りモードでジャーナルが0件の場合は即時返答
    if (summaryPeriod && periodJournals.length === 0) {
      const label = getPeriodLabel(summaryPeriod);
      const noDataMsg = `${label}のジャーナルのデータがありません。ジャーナルを記録してから振り返りをお試しください！`;
      const result = streamText({
        model: openai("gpt-4o-mini"),
        system: "ユーザーへ以下のメッセージをそのまま1行で出力してください。追加の説明は不要です。",
        messages: [{ role: "user" as const, content: noDataMsg }],
      });
      return result.toUIMessageStreamResponse();
    }

    const systemPrompt = buildSystemPrompt(
      context ?? {},
      summaryPeriod,
      periodJournals,
      mode
    );

    const result = streamText({
      model: openai("gpt-4o-mini"),
      system: systemPrompt,
      messages: await convertToModelMessages(messages),
    });

    return result.toUIMessageStreamResponse();
  } catch (err) {
    console.error("[ai-chat] error:", err);
    return Response.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
