import Link from "next/link";
import { User, Mic, ChevronRight, ChevronLeft } from "lucide-react";

const settingsItems = [
  {
    href: "/settings/account",
    icon: User,
    label: "アカウント設定",
    description: "名前・大学・学年などのプロフィール",
  },
  {
    href: "/settings/mic",
    icon: Mic,
    label: "マイク設定",
    description: "音声録音に使用するマイクの選択",
  },
];

export default function SettingsPage() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="flex h-12 shrink-0 items-center border-b border-border bg-background px-4 sm:h-14">
        <h1 className="text-base font-semibold sm:text-lg">設定</h1>
      </header>
      <main className="flex-1 overflow-auto">
        <div className="px-4 pt-3 sm:px-6 sm:pt-4">
          <Link
            href="/mypage"
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ChevronLeft className="size-3.5" />
            My Page に戻る
          </Link>
        </div>
        <div className="mx-auto max-w-2xl divide-y divide-border border-b border-t border-border mt-2 sm:mt-3 sm:rounded-lg sm:border">
          {settingsItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-4 bg-background px-4 py-4 transition-colors hover:bg-muted/50 sm:px-6 sm:py-5 first:sm:rounded-t-lg last:sm:rounded-b-lg"
              >
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                  <Icon className="size-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{item.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
                </div>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
              </Link>
            );
          })}
        </div>
      </main>
    </div>
  );
}
