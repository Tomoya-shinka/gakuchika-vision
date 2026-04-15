"use client";

import { usePathname } from "next/navigation";
import { GlobalAiChat } from "@/components/global-ai-chat";

// 自己分析AIチャットページではグローバルアイコンを非表示
const HIDDEN_PATHS = ["/self-analysis/chat"];

export function ConditionalAiChat() {
  const pathname = usePathname();
  if (HIDDEN_PATHS.some((p) => pathname.startsWith(p))) return null;
  return <GlobalAiChat />;
}
