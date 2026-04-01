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

function getTextFromMessage(m: {
  role: string;
  content?: string;
  parts?: Array<{ type: string; text?: string }>;
}): string {
  if (typeof m.content === "string") return m.content;
  return (
    m.parts
      ?.filter((p): p is { type: "text"; text: string } => p.type === "text")
      .map((p) => p.text)
      .join("") ?? ""
  );
}

function countTurns(raw: UIMessage[]) {
  const userTurns = raw.filter((m) => m.role === "user").length;
  const assistantTurns = raw.filter((m) => m.role === "assistant").length;
  return { userTurns, assistantTurns };
}

function isCoachingCompleteRequest(lastUserText: string): boolean {
  const t = lastUserText.trim();
  if (!t) return false;
  // 完了ボタン相当の手入力を許容
  if (/^(完了|終了|終わり|まとめ|まとめて|最終)$/u.test(t)) return true;
  return false;
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

  // コーチングモード: 専用プロンプト + ユーザーデータをプレーンテキストで追記
  if (mode === "coaching") {
    let prompt = COACHING_SYSTEM_PROMPT;
    prompt += `\n[参考: ユーザーデータ（会話の中で自然に活用すること）]\n`;
    if (allJournals.length > 0) {
      prompt += `\nジャーナル記録（直近${allJournals.length}件）:\n`;
      allJournals.forEach((j, i) => {
        const date = j.createdAt ? j.createdAt.slice(0, 10) : "";
        const title = j.title ? `「${j.title}」` : "無題";
        prompt += `(${i + 1}) ${date} ${title}: ${j.contentPlain}\n`;
      });
    } else {
      prompt += `\nジャーナル記録: まだ記録がありません。\n`;
    }
    if (selfAnalysis.length > 0) {
      prompt += `\n自己分析メモ:\n`;
      selfAnalysis.forEach((s) => {
        prompt += `[${s.folderName}] ${s.text}\n`;
      });
    }
    if (goals) {
      const parts: string[] = [];
      if (goals.longTermVision) parts.push(`長期ビジョン: ${goals.longTermVision}`);
      if (goals.oneYearGoal) parts.push(`1年後の目標: ${goals.oneYearGoal}`);
      if (goals.oneMonthGoal) parts.push(`今月の目標: ${goals.oneMonthGoal}`);
      if (parts.length > 0) prompt += `\n目標: ${parts.join(" / ")}\n`;
    }
    return prompt;
  }

  // 振り返りモード: ジャーナルのみ使用
  if (summaryPeriod) {
    const label = getPeriodLabel(summaryPeriod);
    let prompt = `あなたは「LIFE VISION JOURNAL」アプリのAIアシスタントです。
ユーザーの自己理解・目標達成・日々の成長をサポートします。
ユーザーが${label}の振り返りを求めています。以下の${label}のジャーナル記録のみを参照して、まとめを作成してください。

`;
    prompt += `## ${label}のジャーナル記録（${periodJournals.length}件）\n`;
    periodJournals.forEach((j, i) => {
      const date = j.createdAt ? j.createdAt.slice(0, 10) : "";
      const title = j.title ? `「${j.title}」` : "無題";
      prompt += `\n### ${i + 1}. ${title} (${date})\n${j.contentPlain}\n`;
    });

    prompt += `
まとめの作成指針:
- ${label}全体の流れをわかりやすく整理する（3〜6文程度で簡潔に）
- 頑張ったこと・気づき・成長をポジティブに伝える
- ジャーナルに書かれた具体的なエピソードや日付を自然に引用する
- 「来週/来月につながること」があれば1文で触れる
- 回答は日本語で、フレンドリーで温かみのある丁寧な口調にする
- 見出し（###）は使わない。箇条書きは最小限にとどめる
- 自己分析シートのデータは使わない`;
    return prompt;
  }

  // 通常モード: ジャーナル + 自己分析 + 目標を使用
  let prompt = `あなたは「LIFE VISION JOURNAL」のAIアシスタントです。
このアプリはジャーナルで日々を記録し、自己分析シートで強みを整理し、目標設定で行動を具体化できます。
ユーザーの振り返りをサポートし、一緒に考えていくパートナーとして関わってください。
返答は3〜4文以内の会話調で。見出し・箇条書き・太字は使わない。
ユーザーの質問には必ず答えた上で、最後にユーザー自身のことを引き出す問いかけを1つ添えてください。

`;

  if (allJournals.length > 0) {
    prompt += `ジャーナル記録（直近${allJournals.length}件）:\n`;
    allJournals.forEach((j, i) => {
      const date = j.createdAt ? j.createdAt.slice(0, 10) : "";
      const title = j.title ? `「${j.title}」` : "無題";
      prompt += `(${i + 1}) ${date} ${title}: ${j.contentPlain}\n`;
    });
    prompt += "\n";
  } else {
    prompt += `ジャーナル記録: まだ記録がありません。\n\n`;
  }

  if (selfAnalysis.length > 0) {
    prompt += `自己分析メモ:\n`;
    selfAnalysis.forEach((s) => {
      prompt += `[${s.folderName}] ${s.text}\n`;
    });
    prompt += "\n";
  }

  if (goals) {
    const parts: string[] = [];
    if (goals.longTermVision) parts.push(`長期ビジョン: ${goals.longTermVision}`);
    if (goals.oneYearGoal) parts.push(`1年後の目標: ${goals.oneYearGoal}`);
    if (goals.oneMonthGoal) parts.push(`今月の目標: ${goals.oneMonthGoal}`);
    if (parts.length > 0) prompt += `目標設定: ${parts.join(" / ")}\n`;
  }

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

    let systemPrompt = buildSystemPrompt(
      context ?? {},
      summaryPeriod,
      periodJournals,
      mode
    );

    // コーチングモードの「超簡潔・段階的ヒアリング方式」をAPI側で強制
    if (mode === "coaching") {
      const raw = (messages ?? []) as Array<{
        role: string;
        content?: string;
        parts?: Array<{ type: string; text?: string }>;
      }>;
      const lastUser = [...raw].reverse().find((m) => m.role === "user");
      const lastUserText = lastUser ? getTextFromMessage(lastUser) : "";
      const { userTurns, assistantTurns } = countTurns(raw as UIMessage[]);

      const isFirst = userTurns === 1 && assistantTurns === 0;
      const completeRequested = isCoachingCompleteRequest(lastUserText);
      const shouldAutoFinalize = userTurns >= 5; // 通常3〜5なので、5で確実にまとめる
      const shouldFinalize =
        completeRequested ||
        shouldAutoFinalize ||
        (userTurns >= 3 && /まとめ|整理|結論|アクション|次の一歩/u.test(lastUserText));

      const stageInstruction = isFirst
        ? `【出力制約: 初回（厳守）】
- 出力は必ず2文だけ
- 1文目: ユーザーの目的（長期目標/得意/状況）に対し、あなたが選んだ「最も効果的な解決アプローチ」を1文で提示
- 2文目: ヒアリングの最初の質問を1つだけ（「？」で終える）
- 挨拶・自己紹介・流れ説明・応援は禁止`
        : shouldFinalize
          ? `【出力制約: 最終提案（厳守）】
- 質問しない（「？」禁止）
- 余計な前置きなし
- 次の2項目を必ず含める（簡潔に）
対話の要約:（2〜4行）
具体的なアクションプラン:（2〜4行）`
          : `【出力制約: ヒアリング中（厳守）】
- 冒頭でユーザーの回答を短く肯定（1フレーズ）
- その後すぐ、質問は必ず1つだけ（「？」で終える）
- 余計な前置き・流れ説明は禁止`;

      systemPrompt = `${systemPrompt}\n\n${stageInstruction}`;
    }

    const result = streamText({
      model: openai(mode === "coaching" ? "gpt-4o" : "gpt-4o-mini"),
      system: systemPrompt,
      messages: await convertToModelMessages(messages),
      maxTokens: mode === "coaching" ? 120 : 350,
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
