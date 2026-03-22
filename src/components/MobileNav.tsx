"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, BookOpen, CircleUser, Sparkles, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCommentNotifications } from "@/hooks/useCommentNotifications";

const navItems = [
  {
    title: "ホーム",
    url: "/",
    icon: Home,
  },
  {
    title: "ジャーナル",
    url: "/journal",
    icon: BookOpen,
  },
  {
    title: "フィード",
    url: "/feed",
    icon: MessageCircle,
  },
  {
    title: "自己分析",
    url: "/self-analysis",
    icon: Sparkles,
  },
  {
    title: "My Page",
    url: "/mypage",
    icon: CircleUser,
  },
];

export function MobileNav() {
  const pathname = usePathname();
  const { hasUnread } = useCommentNotifications();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 flex h-16 items-center justify-around border-t border-border bg-background shadow-[0_-1px_10px_rgba(0,0,0,0.05)] md:hidden"
      aria-label="モバイルナビゲーション"
    >
      {navItems.map((item) => {
        const isActive =
          pathname === item.url ||
          (item.url !== "/" && pathname.startsWith(item.url));
        const Icon = item.icon;
        const showBadge = item.url === "/feed" && hasUnread;

        return (
          <Link
            key={item.url}
            href={item.url}
            className={cn(
              "flex flex-1 flex-col items-center justify-center gap-0.5 py-2 transition-colors",
              isActive
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
            aria-current={isActive ? "page" : undefined}
          >
            <span className="relative">
              <Icon className="size-5 shrink-0" aria-hidden />
              {showBadge && (
                <span className="absolute -right-1 -top-1 size-2 rounded-full bg-red-500" />
              )}
            </span>
            <span className="text-[10px] font-medium leading-tight">
              {item.title}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
