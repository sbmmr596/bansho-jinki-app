import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/login")({ component: Login });

function Login() {
  return (
    <main className="grid min-h-dvh place-items-center bg-[#0b0907] p-6 text-[#e8dfd0]">
      <div className="w-full max-w-sm space-y-4">
        <p className="text-[12px] tracking-[0.35em] text-[#b8a07a]">BANSHO JINKI</p>
        <h1 className="font-serif text-2xl tracking-wide">万象陣記</h1>
        <p className="text-sm text-[#9a8f7c]">
          標準データで遊べます。ドライブはタイトルの「マイデータ」から。
        </p>
        <a href="/" className="block text-center text-sm text-[#b8a07a]">
          戻る
        </a>
      </div>
    </main>
  );
}
