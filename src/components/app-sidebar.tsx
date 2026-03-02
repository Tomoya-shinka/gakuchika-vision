"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  BookOpen,
  ListTodo,
  CircleUser,
  GraduationCap,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
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
import { cn } from "@/lib/utils";

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
    title: "習慣トラッカー",
    url: "/tasks",
    icon: ListTodo,
  },
  {
    title: "My Page",
    url: "/mypage",
    icon: CircleUser,
  },
];

export function AppSidebar() {
  const pathname = usePathname();
  const { state, toggleSidebar } = useSidebar();
  const isExpanded = state === "expanded";

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
              {navItems.map((item) => (
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
                      <item.icon className="size-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
