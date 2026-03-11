"use client";

import { useState, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

interface AlpacaAccount {
  equity: number;
  cash: number;
  buyingPower: number;
  portfolioValue: number;
  lastEquity: number;
  longMarketValue: number;
  daytradeCount: number;
  tradingBlocked: boolean;
  isPaper: boolean;
}

interface AlpacaPosition {
  symbol: string;
  qty: number;
  side: string;
  avgEntryPrice: number;
  marketValue: number;
  currentPrice: number;
  unrealizedPl: number;
  unrealizedPlpc: number;
  changeToday: number;
}

export default function AlpacaAccountPanel() {
  const [account, setAccount] = useState<AlpacaAccount | null>(null);
  const [positions, setPositions] = useState<AlpacaPosition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchData = useCallback(async () => {
    try {
      const [accRes, posRes] = await Promise.all([
        fetch("/api/trade/account"),
        fetch("/api/trade/positions"),
      ]);

      if (!accRes.ok) {
        const data = await accRes.json().catch(() => ({}));
        setError(data.error || "계좌 조회 실패");
        setLoading(false);
        return;
      }

      const accData = await accRes.json();
      setAccount(accData);

      if (posRes.ok) {
        const posData = await posRes.json();
        setPositions(posData.positions || []);
      }

      setError("");
    } catch {
      setError("Alpaca API 연결 실패");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);

    // 거래 완료 이벤트 수신 시 즉시 새로고침
    const handleTradeComplete = () => {
      setTimeout(() => fetchData(), 1500); // Alpaca 반영 대기 1.5초
    };
    window.addEventListener("alpaca-trade-complete", handleTradeComplete);

    return () => {
      clearInterval(interval);
      window.removeEventListener("alpaca-trade-complete", handleTradeComplete);
    };
  }, [fetchData]);

  // 로딩
  if (loading) {
    return (
      <div className="p-3 text-center text-muted-foreground/70 font-mono text-xs animate-pulse">
        Alpaca 계좌 조회 중...
      </div>
    );
  }

  // API 키 미설정 또는 연결 실패
  if (error || !account) {
    return (
      <div className="p-3 space-y-2">
        <div className="flex items-center gap-1.5">
          <div className="w-1 h-3 rounded-full bg-chart-4" />
          <span className="text-[10px] font-mono text-muted-foreground tracking-wider">
            ALPACA ACCOUNT
          </span>
        </div>
        <div className="text-[10px] font-mono text-muted-foreground/65 py-3 text-center border border-dashed border-border/50 rounded">
          {error || "Alpaca API 키를 .env.local에 설정하세요"}
        </div>
      </div>
    );
  }

  const dailyPl = account.equity - account.lastEquity;
  const dailyPlPct = account.lastEquity > 0 ? (dailyPl / account.lastEquity) * 100 : 0;
  const totalPositionsPl = positions.reduce((sum, p) => sum + p.unrealizedPl, 0);

  return (
    <div className="space-y-2">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <div className="w-1 h-3 rounded-full bg-chart-4" />
          <span className="text-[10px] font-mono text-muted-foreground tracking-wider">
            ALPACA ACCOUNT
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {account.isPaper && (
            <Badge
              variant="outline"
              className="text-[10px] h-[18px] border-chart-4/40 text-chart-4 px-1.5"
            >
              PAPER
            </Badge>
          )}
          <button
            onClick={() => { setLoading(true); fetchData(); }}
            className="text-[11px] font-mono text-muted-foreground/65 hover:text-primary transition-colors"
            title="새로고침"
          >
            REFRESH
          </button>
        </div>
      </div>

      {/* 계좌 요약 */}
      <div className="font-mono">
        <div className="text-lg font-bold text-foreground tracking-tight">
          ${account.equity.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
        <div className={`text-xs font-bold mt-0.5 ${dailyPl >= 0 ? "text-up" : "text-down"}`}>
          {dailyPl >= 0 ? "+" : ""}${dailyPl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          {" "}({dailyPl >= 0 ? "+" : ""}{dailyPlPct.toFixed(2)}%) 오늘
        </div>
      </div>

      <Separator className="bg-border/50" />

      {/* 상세 지표 */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[10px] font-mono">
        <div className="flex justify-between">
          <span className="text-muted-foreground/70">현금 잔고</span>
          <span className="text-foreground">
            ${account.cash.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground/70">매수 여력</span>
          <span className="text-foreground">
            ${account.buyingPower.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground/70">포지션 가치</span>
          <span className="text-foreground">
            ${account.longMarketValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground/70">미실현 손익</span>
          <span className={totalPositionsPl >= 0 ? "text-up" : "text-down"}>
            {totalPositionsPl >= 0 ? "+" : ""}${totalPositionsPl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
      </div>

      {/* 포지션 */}
      {positions.length > 0 && (
        <>
          <Separator className="bg-border/50" />
          <div className="flex items-center gap-1.5 mt-1">
            <span className="text-[10px] font-mono text-muted-foreground tracking-wider">
              POSITIONS
            </span>
            <span className="text-[11px] font-mono text-muted-foreground/65 ml-auto">
              {positions.length}종목
            </span>
          </div>
          <div className="space-y-1">
            {positions.map((pos) => (
              <div
                key={pos.symbol}
                className="flex items-center justify-between py-1.5 px-2 -mx-2 hover:bg-secondary/50 rounded transition-all"
              >
                <div className="font-mono">
                  <div className="text-xs text-foreground font-medium">
                    {pos.symbol}
                  </div>
                  <div className="text-[10px] text-muted-foreground/60">
                    {pos.qty}주 @ ${pos.avgEntryPrice.toFixed(2)}
                  </div>
                </div>
                <div className="text-right font-mono">
                  <div className="text-xs text-foreground">
                    ${pos.currentPrice.toFixed(2)}
                  </div>
                  <div className={`text-[10px] font-medium ${pos.unrealizedPl >= 0 ? "text-up" : "text-down"}`}>
                    {pos.unrealizedPl >= 0 ? "+" : ""}${pos.unrealizedPl.toFixed(2)} ({pos.unrealizedPl >= 0 ? "+" : ""}{(pos.unrealizedPlpc * 100).toFixed(2)}%)
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {positions.length === 0 && (
        <>
          <Separator className="bg-border/50" />
          <div className="text-[10px] font-mono text-muted-foreground/65 py-2 text-center border border-dashed border-border/50 rounded">
            보유 포지션 없음
          </div>
        </>
      )}
    </div>
  );
}
