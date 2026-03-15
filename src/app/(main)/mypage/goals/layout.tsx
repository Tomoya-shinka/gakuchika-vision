/** ビルド時の静的生成をスキップ（Firebase 初期化エラー回避） */
export const dynamic = "force-dynamic";

export default function MyPageGoalsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
