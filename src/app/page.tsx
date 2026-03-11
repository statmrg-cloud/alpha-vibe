import Header from "@/components/layout/Header";
import ChatPanel from "@/components/chat/ChatPanel";
import DataPanel from "@/components/data/DataPanel";

export default function Home() {
  return (
    <div className="h-screen flex flex-col bg-background terminal-grid">
      {/* 상단 헤더 — 시장 지수 티커 */}
      <Header />

      {/* 메인 콘텐츠 — 채팅 + 데이터 패널 */}
      <main className="flex-1 flex overflow-hidden">
        {/* 좌측: AI 채팅 패널 */}
        <div className="flex-1 border-r border-border/50 min-w-0">
          <ChatPanel />
        </div>

        {/* 우측: 데이터 패널 */}
        <div className="w-[400px] shrink-0 bg-card/30 backdrop-blur-sm">
          <DataPanel />
        </div>
      </main>

      {/* 하단 상태바 */}
      <footer className="h-6 border-t border-border/50 bg-card/60 backdrop-blur-sm flex items-center px-4 text-[11px] font-mono text-muted-foreground/70 shrink-0">
        <span className="tracking-wider">ALPHA-VIBE v0.1.0</span>
        <div className="w-px h-2.5 bg-border/30 mx-3" />
        <span>Next.js 14 + Claude Sonnet + Recharts</span>
        <span className="ml-auto flex items-center gap-1.5">
          <span className="w-1 h-1 rounded-full bg-primary/60 inline-block" />
          System Normal
          <div className="w-px h-2.5 bg-border/30 mx-1.5" />
          Paper Trading Mode
        </span>
      </footer>
    </div>
  );
}
