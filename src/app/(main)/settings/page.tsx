export default function SettingsPage() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="flex h-14 shrink-0 items-center border-b border-border bg-background px-4">
        <h1 className="text-lg font-semibold">設定</h1>
      </header>
      <main className="flex-1 overflow-auto p-6">
        <div className="mx-auto max-w-4xl space-y-6">
          <section>
            <h2 className="mb-2 font-semibold text-foreground">アカウント</h2>
            <p className="text-sm text-muted-foreground">
              Firebase連携後にアカウント設定が利用可能になります。
            </p>
          </section>
          <section>
            <h2 className="mb-2 font-semibold text-foreground">通知</h2>
            <p className="text-sm text-muted-foreground">
              リマインダーやお知らせの設定は後日実装予定です。
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
