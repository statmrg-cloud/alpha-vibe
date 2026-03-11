"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface WatchlistItem {
  symbol: string;
  name: string;
  enabled: boolean;
}

interface AutoTradeConfig {
  enabled: boolean;
  watchlist: WatchlistItem[];
  maxOrderAmount: number;
  dailyLossLimit: number;
  cronInterval: string;
  requireStrongBuy: boolean;
  minTechnicalScore: number;
}

interface AutoTradeLog {
  id: string;
  timestamp: string;
  type: "CHECK" | "BUY" | "SKIP" | "STOP_LOSS" | "ERROR" | "START" | "STOP";
  symbol?: string;
  message: string;
}

interface EngineStatus {
  enabled: boolean;
  isRunning: boolean;
  dailyPnL: { date: string; realizedLoss: number; trades: number };
  logsCount: number;
  watchlistCount: number;
}

const LOG_TYPE_COLORS: Record<string, string> = {
  CHECK: "text-muted-foreground",
  BUY: "text-up",
  SKIP: "text-slate-400",
  STOP_LOSS: "text-destructive",
  ERROR: "text-destructive",
  START: "text-primary",
  STOP: "text-chart-4",
};

export default function AutoTradePanel() {
  const [config, setConfig] = useState<AutoTradeConfig | null>(null);
  const [status, setStatus] = useState<EngineStatus | null>(null);
  const [logs, setLogs] = useState<AutoTradeLog[]>([]);
  const [tab, setTab] = useState<"control" | "watchlist" | "logs">("control");
  const [newSymbol, setNewSymbol] = useState("");
  const [newName, setNewName] = useState("");
  const [loading, setLoading] = useState(false);

  // 설정 & 상태 & 로그 불러오기
  const fetchAll = useCallback(async () => {
    try {
      const [configRes, statusRes, logsRes] = await Promise.all([
        fetch("/api/autotrade/config"),
        fetch("/api/autotrade/control"),
        fetch("/api/autotrade/logs?limit=30"),
      ]);
      if (configRes.ok) setConfig(await configRes.json());
      if (statusRes.ok) setStatus(await statusRes.json());
      if (logsRes.ok) {
        const data = await logsRes.json();
        setLogs(data.logs || []);
      }
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 15000); // 15초마다 새로고침
    return () => clearInterval(interval);
  }, [fetchAll]);

  // 엔진 시작/중지
  const handleToggleEngine = async () => {
    setLoading(true);
    try {
      const action = status?.enabled ? "stop" : "start";
      await fetch("/api/autotrade/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      await fetchAll();
    } catch {
      // silent
    }
    setLoading(false);
  };

  // 설정 업데이트
  const handleUpdateConfig = async (updates: Partial<AutoTradeConfig>) => {
    try {
      const res = await fetch("/api/autotrade/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (res.ok) setConfig(await res.json());
    } catch {
      // silent
    }
  };

  // 관심종목 추가
  const handleAddSymbol = () => {
    if (!newSymbol.trim() || !config) return;
    const updated = [
      ...config.watchlist,
      { symbol: newSymbol.trim().toUpperCase(), name: newName.trim() || newSymbol.trim(), enabled: true },
    ];
    handleUpdateConfig({ watchlist: updated });
    setNewSymbol("");
    setNewName("");
  };

  // 관심종목 삭제
  const handleRemoveSymbol = (symbol: string) => {
    if (!config) return;
    handleUpdateConfig({
      watchlist: config.watchlist.filter((w) => w.symbol !== symbol),
    });
  };

  // 관심종목 토글
  const handleToggleSymbol = (symbol: string) => {
    if (!config) return;
    handleUpdateConfig({
      watchlist: config.watchlist.map((w) =>
        w.symbol === symbol ? { ...w, enabled: !w.enabled } : w
      ),
    });
  };

  // 로그 초기화
  const handleClearLogs = async () => {
    await fetch("/api/autotrade/logs", { method: "DELETE" });
    setLogs([]);
  };

  if (!config || !status) {
    return (
      <div className="p-3 text-center text-slate-300 font-mono text-xs">
        로딩 중...
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* 헤더 + 상태 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${status.enabled ? "bg-up animate-pulse" : "bg-muted-foreground/30"}`} />
          <span className="text-[10px] font-mono font-bold text-foreground tracking-wider">
            AUTO TRADE
          </span>
          <span className="text-[10px] font-mono text-slate-300 px-1 py-0.5 rounded border border-border/40">
            US ONLY
          </span>
          {status.enabled && (
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-up/10 text-up border border-up/20">
              ACTIVE
            </span>
          )}
        </div>
        <Button
          size="sm"
          onClick={handleToggleEngine}
          disabled={loading}
          className={`h-5 px-2.5 text-[11px] font-mono font-bold tracking-wider ${
            status.enabled
              ? "bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive/20"
              : "bg-up/10 text-up border border-up/20 hover:bg-up/20"
          }`}
          variant="outline"
        >
          {loading ? "..." : status.enabled ? "STOP" : "START"}
        </Button>
      </div>

      {/* 일일 P&L */}
      {status.enabled && (
        <div className="bg-secondary/50 rounded p-2 font-mono text-[10px] space-y-0.5">
          <div className="flex justify-between">
            <span className="text-muted-foreground">일일 P&L</span>
            <span className={status.dailyPnL.realizedLoss >= 0 ? "text-up" : "text-down"}>
              ${status.dailyPnL.realizedLoss >= 0 ? "+" : ""}{status.dailyPnL.realizedLoss.toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">금일 거래</span>
            <span className="text-foreground">{status.dailyPnL.trades}건</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">손실 한도</span>
            <span className="text-chart-4">${config.dailyLossLimit}</span>
          </div>
        </div>
      )}

      {/* 탭 */}
      <div className="flex gap-1 border-b border-border/30 pb-1">
        {(["control", "watchlist", "logs"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`text-[11px] font-mono px-2 py-0.5 rounded-t transition-all ${
              tab === t
                ? "text-primary border-b border-primary bg-primary/5"
                : "text-slate-300 hover:text-muted-foreground"
            }`}
          >
            {t === "control" ? "설정" : t === "watchlist" ? "관심종목" : "로그"}
          </button>
        ))}
      </div>

      {/* 탭 콘텐츠: 설정 */}
      {tab === "control" && (
        <div className="space-y-2 font-mono text-[10px]">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">건당 최대 금액 (USD)</span>
              <Input
                type="number"
                value={config.maxOrderAmount}
                onChange={(e) =>
                  handleUpdateConfig({ maxOrderAmount: parseInt(e.target.value) || 0 })
                }
                className="w-20 h-5 text-[10px] font-mono bg-secondary border-border text-right px-1.5"
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">일일 손실한도 (USD)</span>
              <Input
                type="number"
                value={config.dailyLossLimit}
                onChange={(e) =>
                  handleUpdateConfig({ dailyLossLimit: parseInt(e.target.value) || 0 })
                }
                className="w-20 h-5 text-[10px] font-mono bg-secondary border-border text-right px-1.5"
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">최소 기술점수</span>
              <Input
                type="number"
                value={config.minTechnicalScore}
                onChange={(e) =>
                  handleUpdateConfig({ minTechnicalScore: parseInt(e.target.value) || 0 })
                }
                className="w-20 h-5 text-[10px] font-mono bg-secondary border-border text-right px-1.5"
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">매수 조건</span>
              <button
                onClick={() =>
                  handleUpdateConfig({ requireStrongBuy: !config.requireStrongBuy })
                }
                className={`px-2 py-0.5 rounded border text-[11px] transition-all ${
                  config.requireStrongBuy
                    ? "border-chart-4/30 bg-chart-4/10 text-chart-4"
                    : "border-up/30 bg-up/10 text-up"
                }`}
              >
                {config.requireStrongBuy ? "STRONG BUY만" : "BUY 이상"}
              </button>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">체크 간격</span>
              <span className="text-foreground">10분</span>
            </div>
          </div>
        </div>
      )}

      {/* 탭 콘텐츠: 관심종목 */}
      {tab === "watchlist" && (
        <div className="space-y-2">
          <div className="space-y-1">
            {config.watchlist.map((item) => (
              <div
                key={item.symbol}
                className="flex items-center gap-1.5 bg-secondary/30 rounded px-2 py-1"
              >
                <button
                  onClick={() => handleToggleSymbol(item.symbol)}
                  className={`w-3 h-3 rounded-sm border flex items-center justify-center transition-all ${
                    item.enabled
                      ? "bg-primary/20 border-primary/40"
                      : "bg-secondary border-border"
                  }`}
                >
                  {item.enabled && (
                    <div className="w-1.5 h-1.5 rounded-sm bg-primary" />
                  )}
                </button>
                <span
                  className={`text-[10px] font-mono flex-1 ${
                    item.enabled ? "text-foreground" : "text-slate-400 line-through"
                  }`}
                >
                  {item.name}
                  <span className="text-slate-300 ml-1">
                    ({item.symbol})
                  </span>
                </span>
                <button
                  onClick={() => handleRemoveSymbol(item.symbol)}
                  className="text-slate-400 hover:text-destructive text-xs transition-colors"
                >
                  x
                </button>
              </div>
            ))}
          </div>
          {/* 추가 폼 */}
          <div className="flex gap-1">
            <Input
              value={newSymbol}
              onChange={(e) => setNewSymbol(e.target.value)}
              placeholder="심볼"
              className="flex-1 h-5 text-[10px] font-mono bg-secondary border-border px-1.5"
            />
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="종목명"
              className="flex-1 h-5 text-[10px] font-mono bg-secondary border-border px-1.5"
            />
            <Button
              size="sm"
              onClick={handleAddSymbol}
              disabled={!newSymbol.trim()}
              className="h-5 px-2 text-[11px] font-mono bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20"
              variant="outline"
            >
              추가
            </Button>
          </div>
        </div>
      )}

      {/* 탭 콘텐츠: 로그 */}
      {tab === "logs" && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono text-slate-300">
              최근 {logs.length}건
            </span>
            <button
              onClick={handleClearLogs}
              className="text-[10px] font-mono text-slate-400 hover:text-destructive transition-colors"
            >
              초기화
            </button>
          </div>
          <div className="max-h-[250px] overflow-y-auto space-y-0.5 scrollbar-thin">
            {logs.length === 0 ? (
              <div className="text-center text-slate-400 font-mono text-[10px] py-4">
                로그가 없습니다
              </div>
            ) : (
              logs.map((log) => (
                <div
                  key={log.id}
                  className="bg-secondary/20 rounded px-2 py-1 font-mono text-[11px] leading-relaxed"
                >
                  <div className="flex items-start gap-1.5">
                    <span className={`font-bold shrink-0 ${LOG_TYPE_COLORS[log.type] || "text-foreground"}`}>
                      [{log.type}]
                    </span>
                    <span className="text-foreground/80 flex-1 break-all">
                      {log.message}
                    </span>
                  </div>
                  <div className="text-slate-400 text-[10px] mt-0.5">
                    {new Date(log.timestamp).toLocaleString("ko-KR", {
                      month: "2-digit",
                      day: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
