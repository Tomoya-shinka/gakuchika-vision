import { Sparkles, Target, Heart, Rocket } from "lucide-react";
import type { SectionId } from "./self-analysis";

export const SELF_ANALYSIS_SECTIONS = [
  {
    id: "small-wins" as SectionId,
    emoji: "🌟",
    title: "小さな成功体験",
    subtitle: "自分が達成感を感じたこと",
    shortLabel: "成功体験",
    icon: Sparkles,
    description:
      "最近の「できた！」と思えた出来事を、できるだけ具体的に書き出してみましょう。テスト・アルバイト・サークル・日常生活など、どんな小さなことでも大丈夫です。",
    accent: "text-amber-700 dark:text-amber-400",
    bgAccent: "bg-amber-50 dark:bg-amber-950/40",
    borderAccent: "border-amber-200/60 dark:border-amber-800/50",
  },
  {
    id: "fun" as SectionId,
    emoji: "❤️",
    title: "楽しかったこと",
    subtitle: "時間を忘れて没頭したこと",
    shortLabel: "楽しかったこと",
    icon: Heart,
    description:
      "「気づいたら時間が過ぎていた」「つい人に話したくなる」ような体験を集めます。遊び・学び・作業など、ジャンルは問いません。",
    accent: "text-rose-700 dark:text-rose-400",
    bgAccent: "bg-rose-50 dark:bg-rose-950/40",
    borderAccent: "border-rose-200/60 dark:border-rose-800/50",
  },
  {
    id: "strength" as SectionId,
    emoji: "💪",
    title: "得意なこと・強み",
    subtitle: "他人に褒められた、苦なくできること",
    shortLabel: "強み",
    icon: Target,
    description:
      "友人や先生、先輩からよく言われることや、自分では当たり前にできてしまうことを書き出してみましょう。ジャーナルの内容から思い出してもOKです。",
    accent: "text-emerald-700 dark:text-emerald-400",
    bgAccent: "bg-emerald-50 dark:bg-emerald-950/40",
    borderAccent: "border-emerald-200/60 dark:border-emerald-800/50",
  },
  {
    id: "dream" as SectionId,
    emoji: "🚀",
    title: "夢・人生の目標",
    subtitle: "上記から導き出される仮のゴール",
    shortLabel: "夢",
    icon: Rocket,
    description:
      "これまでの3つのセクションをヒントに、「こんな自分でありたい」「こんなことをしていたら楽しそう」という仮のゴールを言葉にしてみましょう。途中で変わっても大丈夫な\"たたき台\"です。",
    accent: "text-orange-700 dark:text-orange-400",
    bgAccent: "bg-orange-50 dark:bg-orange-950/40",
    borderAccent: "border-orange-200/60 dark:border-orange-800/50",
  },
] as const;

/** カテゴリごとのAI自動挨拶（最初のメッセージ） */
export const INITIAL_COACH_GREETINGS: Record<SectionId, string> = {
  "small-wins":
    "こんにちは！過去を振り返って、どんなに小さくてもいいので『あ、自分ちょっと頑張ったな』『これ、うまくいったかも』と思えた瞬間を教えてください。最近のことでも、ずっと前のことでも大丈夫ですよ。",
  fun: "こんにちは！子供の頃でも、中高生時代でも、最近の数ヶ月でも、いつでも大丈夫です。時間を忘れて夢中になったことや、つい人に話したくなるような体験はありますか？",
  strength:
    "こんにちは！過去を振り返って、誰かに褒められたことや「あなたって〇〇だね」と言われたことはありますか？子供の頃でも、中高生時代でも、最近のことでも、いつでも大丈夫ですよ。",
  dream:
    "こんにちは！これまで話してくれたことを踏まえて、「こんな自分でありたい」「こんな未来が楽しそう」と感じることはありますか？まだぼんやりでも大丈夫です。",
};

const BASE_COACH_IDENTITY = `【あなたの役割とスタンス】
あなたは「夢や目標がまだ見つかっていない若者」に並走する、自己分析の専門コーチです。
ユーザーが「自分一人では絶対に気づけない自分の価値」を言語化することを、徹底的にサポートしてください。

【口調】
20歳の大学生にとって親しみやすく、かつ信頼できる、押し付けがましくない優しいトーンで話してください。`;

const BASE_DIALOGUE_RULES = `【対話ルール】
・一度に複数の質問をせず、必ず1つだけ質問する
・ユーザーの回答に対して「なるほど！」「それは素敵ですね」など共感を示してから次の質問へ

【時間軸】
・「今日」や「最近」に限定しない。「子供の頃」「中高生時代」「最近の数ヶ月」など、人生のどのタイミングのエピソードでも良いことを伝える`;

const NOTHING_RESPONSE_GUIDE = `【「何もない」と答えたとき】
諦めず、「小さな違和感」や「当たり前にできていること」からヒアリングする。
例：「特別なことじゃなくていいんです。例えば、つい夢中になって時間を忘れてしまったことや、人から『丁寧だね』と言われたことなどはありますか？」`;

const DEEP_DIVE_GUIDE = `【1つのエピソードの深掘り】
・具体的な行動（何をしたか）
・その時の感情（どう感じたか）
・その理由（なぜそう感じたか）
この3点を丁寧に聞き出してください。`;

const SUMMARY_OUTPUT_GUIDE = `【シートに登録するフレーズの質】
単なる事実ではなく、ユーザーの価値観が凝縮された言葉にする。
例：「テストで満点」→「目標に向かって戦略的に努力し、結果を出すことに喜びを感じる力」
例：「遅刻しなかった」→「約束やルールを守ることで、人との信頼関係を大切にしている」`;

/** フロントエンドが「シート追加カードを表示する」と判断するためのシグナル */
export const INSIGHT_SIGNAL = "[INSIGHT_FOUND]";

const SUMMARY_FLOW = `
【2段階のフェーズ】

■ 探索フェーズ（最初の3〜4往復）
・徹底的にヒアリングに徹する。エピソードの背景、行動、感情を深く掘り下げる
・この間は絶対に提案を行わない。シート登録の話は一切しない

■ 洞察フェーズ
・ユーザーの強みや価値観が明確になったと感じたタイミングでのみ、次の手順を実行する
・対話を一度まとめ、「本質を突いた短いフレーズ」を1つだけ生成する
・提案文の直後に「${INSIGHT_SIGNAL}」を必ず出力し、続けて「---SUMMARY---」を書き、次の行に『』で囲んだフレーズだけを1行で出力する

【厳格な禁止事項】
・ユーザーが「何もない」「特にない」「思いつかない」などと答えている段階では、絶対に提案を出さない
・ユーザーの言葉から「夢の原石」が見つかった時だけ、そっと差し出すような演出にする

【出力フォーマット（提案時のみ）】
ここまでの話をまとめると、あなたの強み（価値観）は『〇〇』と言えそうですね。シートに追加しますか？
${INSIGHT_SIGNAL}
---SUMMARY---
『〇〇』

ユーザーが「終わり」「完了」と言った場合も、洞察が十分に見つかっている場合のみ同様に出力する。まだ洞察が不十分な場合は、もう少し聞き返してから提案する。`;

export const SECTION_COACH_PROMPTS: Record<SectionId, string> = {
  "small-wins": `${BASE_COACH_IDENTITY}
「小さな成功体験」について、一問一答で深掘りします。
${BASE_DIALOGUE_RULES}
${NOTHING_RESPONSE_GUIDE}
${DEEP_DIVE_GUIDE}
${SUMMARY_OUTPUT_GUIDE}
${SUMMARY_FLOW}`,
  fun: `${BASE_COACH_IDENTITY}
「楽しかったこと」について、一問一答で深掘りします。
${BASE_DIALOGUE_RULES}
${NOTHING_RESPONSE_GUIDE}
${DEEP_DIVE_GUIDE}
${SUMMARY_OUTPUT_GUIDE}
${SUMMARY_FLOW}`,
  strength: `${BASE_COACH_IDENTITY}
「得意なこと・強み」について、一問一答で深掘りします。
${BASE_DIALOGUE_RULES}
${NOTHING_RESPONSE_GUIDE}
${DEEP_DIVE_GUIDE}
${SUMMARY_OUTPUT_GUIDE}
${SUMMARY_FLOW}`,
  dream: `${BASE_COACH_IDENTITY}
「夢・人生の目標」について、一問一答で深掘りします。
${BASE_DIALOGUE_RULES}
${NOTHING_RESPONSE_GUIDE}
${DEEP_DIVE_GUIDE}
${SUMMARY_OUTPUT_GUIDE}
${SUMMARY_FLOW}`,
};
