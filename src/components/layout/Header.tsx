"use client";

import { useEffect, useState, useCallback } from "react";
import { Badge } from "@/components/ui/badge";

interface IndexData {
  name: string;
  value: number;
  change: number;
  changePercent: number;
}

const FALLBACK_INDICES: IndexData[] = [
  { name: "S&P 500", value: 0, change: 0, changePercent: 0 },
  { name: "NASDAQ", value: 0, change: 0, changePercent: 0 },
  { name: "KOSPI", value: 0, change: 0, changePercent: 0 },
  { name: "BTC/USD", value: 0, change: 0, changePercent: 0 },
];

export default function Header() {
  const [time, setTime] = useState("");
  const [indices, setIndices] = useState<IndexData[]>(FALLBACK_INDICES);
  const [isConnected, setIsConnected] = useState(false);

  // 시장 데이터 fetch
  const fetchMarketData = useCallback(async () => {
    try {
      const res = await fetch("/api/market");
      if (!res.ok) return;
      const data = await res.json();
      if (data.indices && data.indices.length > 0) {
        setIndices(
          data.indices
            .filter((idx: IndexData) => idx.value > 0)
            .slice(0, 6)
        );
        setIsConnected(true);
      }
    } catch {
      // silent — 기존 데이터 유지
    }
  }, []);

  useEffect(() => {
    fetchMarketData();
    const marketInterval = setInterval(fetchMarketData, 60000); // 60초마다 갱신
    return () => clearInterval(marketInterval);
  }, [fetchMarketData]);

  useEffect(() => {
    const update = () => {
      setTime(
        new Date().toLocaleTimeString("ko-KR", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      );
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <header className="h-11 border-b border-border bg-card/80 backdrop-blur-sm flex items-center px-4 gap-4 shrink-0">
      {/* 로고 */}
      <div className="flex items-center gap-2 mr-2">
        <div className="relative">
          <div className="w-2 h-2 rounded-full bg-primary" />
          <div className="absolute inset-0 w-2 h-2 rounded-full bg-primary animate-ping opacity-40" />
        </div>
        <span className="font-bold text-sm tracking-wider text-foreground">
          ALPHA<span className="text-primary">-VIBE</span>
        </span>
        <Badge
          variant="outline"
          className="text-[8px] h-[16px] px-1.5 border-primary/30 text-primary font-bold tracking-widest"
        >
          LIVE
        </Badge>
      </div>

      {/* 구분선 */}
      <div className="w-px h-5 bg-border/60" />

      {/* 시장 지수 티커 */}
      <div className="flex items-center gap-4 overflow-x-auto text-xs font-mono flex-1">
        {indices.map((idx) => (
          <div
            key={idx.name}
            className="flex items-center gap-1.5 whitespace-nowrap group cursor-default"
          >
            <span className="text-muted-foreground/60 text-[10px]">{idx.name}</span>
            <span className="text-foreground/90 text-[11px] font-medium">
              {idx.value.toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </span>
            <span
              className={`text-[10px] font-medium ${
                idx.changePercent >= 0 ? "text-up" : "text-down"
              }`}
            >
              {idx.changePercent >= 0 ? "+" : ""}
              {idx.changePercent.toFixed(2)}%
            </span>
          </div>
        ))}
      </div>

      {/* 우측 상태 */}
      <div className="flex items-center gap-3 text-[10px] text-muted-foreground/60 shrink-0">
        <span className="font-mono tabular-nums" suppressHydrationWarning>{time}</span>
        <div className="w-px h-3.5 bg-border/40" />
        <div className="flex items-center gap-1">
          <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? "bg-primary/80" : "bg-chart-4/80 animate-pulse"}`} />
          <span className="font-mono">{isConnected ? "Online" : "Connecting..."}</span>
        </div>
      </div>
    </header>
  );
}
