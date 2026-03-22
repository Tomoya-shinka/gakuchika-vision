"use client";

import { usePathname } from "next/navigation";
import { GlobalAiChat } from "@/components/global-ai-chat";

/** プロフィールページ・メッセージページではAIチャットを非表示 */
export function ConditionalAiChat() {
  const pathname = usePathname();
  const hidden =
    pathname.startsWith("/profile/") || pathname.startsWith("/messages");
  if (hidden) return null;
  return <GlobalAiChat />;
}
