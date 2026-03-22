"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  BookOpen,
  CircleUser,
  GraduationCap,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  MessageCircle,
  Mail,
  LogIn,
  LogOut,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAuth } from "@/contexts/auth-context";
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
    title: "自己分析シート",
    url: "/self-analysis",
    icon: Sparkles,
  },
  {
    title: "メッセージ",
    url: "/messages",
    icon: Mail,
  },
  {
    title: "My Page",
    url: "/mypage",
    icon: CircleUser,
  },
];

export function AppSidebar() {
  const pathname = usePathname();
  const { state, toggleSidebar, isMobile } = useSidebar();
  const isExpanded = state === "expanded";
  const { user, loading, signOut } = useAuth();
  const { hasUnread } = useCommentNotifications();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader
        className={cn(
          "flex min-h-[52px] flex-row items-center justify-center gap-2 border-b border-sidebar-border p-2 transition-all duration-200",
          isExpanded && "justify-between"
        )}
      >
        {/* ロゴ + テキスト：閉じている時は width:0 + opacity:0 で非表示 */}
        <Link
          href="/"
          className={cn(
            "flex min-w-0 items-center gap-2 overflow-hidden whitespace-nowrap transition-all duration-200",
            isExpanded ? "flex-1 opacity-100" : "w-0 min-w-0 flex-none opacity-0"
          )}
          tabIndex={isExpanded ? 0 : -1}
          aria-hidden={!isExpanded}
        >
          <div
            className={cn(
              "flex aspect-square size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-opacity duration-200",
              isExpanded ? "opacity-100" : "opacity-0"
            )}
          >
            <GraduationCap className="size-4" />
          </div>
          <div className="flex min-w-0 flex-col gap-0.5 overflow-hidden whitespace-nowrap">
            <span className="truncate font-semibold">ガクチカビジョン</span>
            <span className="block text-xs leading-tight text-muted-foreground">
              大学生向け
              <br />
              ガクチカ蓄積アプリ
            </span>
          </div>
        </Link>
        {/* 開閉ボタン */}
        <Button
          variant="ghost"
          size="icon"
          className="size-8 shrink-0 rounded-md text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          onClick={toggleSidebar}
          aria-label={isExpanded ? "サイドバーを閉じる" : "サイドバーを開く"}
        >
          {isExpanded ? (
            <ChevronLeft className="size-4" />
          ) : (
            <ChevronRight className="size-4" />
          )}
        </Button>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>メニュー</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const showBadge = item.url === "/feed" && hasUnread;
                return (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton
                      asChild
                      isActive={
                        pathname === item.url ||
                        (item.url === "/mypage" && pathname.startsWith("/mypage"))
                      }
                      tooltip={item.title}
                    >
                      <Link href={item.url}>
                        <span className="relative shrink-0">
                          <item.icon className="size-4" />
                          {showBadge && (
                            <span className="absolute -right-1 -top-1 size-2 rounded-full bg-red-500" />
                          )}
                        </span>
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter
        className={cn(
          "mt-auto border-t border-sidebar-border pt-2",
          "group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:items-center"
        )}
      >
        {!loading && (
          <>
            {!user ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size={isExpanded ? "default" : "icon"}
                    className="w-full justify-center gap-2 border-sidebar-border bg-sidebar text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                    asChild
                  >
                    <Link href="/login">
                      <LogIn className="size-4 shrink-0" />
                      {isExpanded && <span>ログイン</span>}
                    </Link>
                  </Button>
                </TooltipTrigger>
                <TooltipContent
                  side="right"
                  align="center"
                  hidden={isExpanded || isMobile}
                >
                  ログイン
                </TooltipContent>
              </Tooltip>
            ) : (
              <div
                className={cn(
                  "flex w-full min-w-0 items-center gap-2",
                  !isExpanded && "flex-col"
                )}
              >
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <Avatar className="size-8 shrink-0">
                    <AvatarImage src={user.photoURL ?? undefined} alt="" />
                    <AvatarFallback className="text-xs">
                      {user.displayName?.slice(0, 2) ?? user.email?.slice(0, 2) ?? "?"}
                    </AvatarFallback>
                  </Avatar>
                  {isExpanded && (
                    <span
                      className="min-w-0 truncate text-sm text-sidebar-foreground"
                      title={user.displayName ?? user.email ?? ""}
                    >
                      {user.email ?? user.displayName ?? "ユーザー"}
                    </span>
                  )}
                </div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="shrink-0 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                      onClick={signOut}
                    >
                      <LogOut className="size-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent
                    side="right"
                    align="center"
                    hidden={isExpanded || isMobile}
                  >
                    ログアウト
                  </TooltipContent>
                </Tooltip>
              </div>
            )}
          </>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
