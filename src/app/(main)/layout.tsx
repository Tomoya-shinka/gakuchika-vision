import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { MobileNav } from "@/components/MobileNav";
import { AuthGuard } from "@/components/auth-guard";

/** ビルド時に Firebase が初期化されないよう、(main) 配下は静的生成しない */
export const dynamic = "force-dynamic";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <div className="flex min-h-svh flex-1 flex-col overflow-x-hidden pb-16 md:pb-0">
            {children}
          </div>
        </SidebarInset>
        <MobileNav />
      </SidebarProvider>
    </AuthGuard>
  );
}
