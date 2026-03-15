/** ビルド時に Firebase が初期化されないよう、このルートは静的生成しない */
export const dynamic = "force-dynamic";

export default function GoalsChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
