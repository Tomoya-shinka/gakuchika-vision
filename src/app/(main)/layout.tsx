import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { MobileNav } from "@/components/MobileNav";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <div className="flex min-h-svh flex-1 flex-col overflow-x-hidden pb-16 md:pb-0">
          {children}
        </div>
      </SidebarInset>
      <MobileNav />
    </SidebarProvider>
  );
}
