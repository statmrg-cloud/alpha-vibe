"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from "recharts";

interface ChartData {
  date: string;
  close: number;
  high: number;
  low: number;
  volume: number;
}

interface LivePrice {
  price: number;
  change: number;
  changePercent: number;
  name: string;
}

interface StockChartProps {
  symbol: string;
  compact?: boolean;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number; payload: ChartData }>;
  label?: string;
  trend: "up" | "down";
}

function CustomTooltip({ active, payload, label, trend }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const data = payload[0].payload;
  const color = trend === "up" ? "rgb(34, 197, 94)" : "rgb(239, 68, 68)";

  return (
    <div className="bg-card/95 backdrop-blur border border-border rounded-lg px-3 py-2 shadow-xl">
      <div className="text-[10px] font-mono text-muted-foreground mb-1">{label}</div>
      <div className="font-mono text-sm font-bold" style={{ color }}>
        {data.close.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 mt-1">
        <span className="text-[9px] font-mono text-muted-foreground">
          H {data.high.toLocaleString(undefined, { maximumFractionDigits: 2 })}
        </span>
        <span className="text-[9px] font-mono text-muted-foreground">
          L {data.low.toLocaleString(undefined, { maximumFractionDigits: 2 })}
        </span>
      </div>
    </div>
  );
}

export default function StockChart({ symbol, compact = false }: StockChartProps) {
  const [data, setData] = useState<ChartData[]>([]);
  const [trend, setTrend] = useState<"up" | "down">("up");
  const [changePercent, setChangePercent] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [livePrice, setLivePrice] = useState<LivePrice | null>(null);
  const [priceFlash, setPriceFlash] = useState<"up" | "down" | null>(null);
  const prevPriceRef = useRef<number>(0);

  // 7일 차트 데이터 fetch
  const fetchChartData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/stock/history?symbol=${encodeURIComponent(symbol)}`);
      if (!res.ok) throw new Error("데이터 로드 실패");
      const json = await res.json();
      setData(json.quotes || []);
      setTrend(json.trend || "up");
      setChangePercent(json.changePercent || 0);
    } catch {
      setError("차트 데이터를 불러올 수 없습니다");
    } finally {
      setLoading(false);
    }
  }, [symbol]);

  // 실시간 현재가 fetch
  const fetchLivePrice = useCallback(async () => {
    try {
      const res = await fetch(`/api/stock?symbol=${encodeURIComponent(symbol)}`);
      if (!res.ok) return;
      const json = await res.json();
      const newPrice = json.price || 0;

      // 가격 변동 플래시 효과
      if (prevPriceRef.current > 0 && newPrice !== prevPriceRef.current) {
        setPriceFlash(newPrice > prevPriceRef.current ? "up" : "down");
        setTimeout(() => setPriceFlash(null), 800);
      }
      prevPriceRef.current = newPrice;

      setLivePrice({
        price: newPrice,
        change: json.change || 0,
        changePercent: json.changePercent || 0,
        name: json.name || symbol,
      });
    } catch {
      // silent
    }
  }, [symbol]);

  // 초기 로드
  useEffect(() => {
    fetchChartData();
    fetchLivePrice();
  }, [fetchChartData, fetchLivePrice]);

  // 실시간 갱신: 현재가 15초, 차트 5분
  useEffect(() => {
    const priceInterval = setInterval(fetchLivePrice, 15000);
    const chartInterval = setInterval(fetchChartData, 300000);
    return () => {
      clearInterval(priceInterval);
      clearInterval(chartInterval);
    };
  }, [fetchLivePrice, fetchChartData]);

  if (loading) {
    return (
      <div className={`flex items-center justify-center ${compact ? "h-[100px]" : "h-[180px]"}`}>
        <div className="flex gap-1">
          <div className="w-1 h-1 rounded-full bg-primary animate-bounce [animation-delay:0ms]" />
          <div className="w-1 h-1 rounded-full bg-primary animate-bounce [animation-delay:100ms]" />
          <div className="w-1 h-1 rounded-full bg-primary animate-bounce [animation-delay:200ms]" />
        </div>
      </div>
    );
  }

  if (error || data.length === 0) {
    return (
      <div className={`flex items-center justify-center ${compact ? "h-[100px]" : "h-[180px]"} text-[10px] font-mono text-muted-foreground/50`}>
        {error || "데이터 없음"}
      </div>
    );
  }

  const isUp = trend === "up";
  const lineColor = isUp ? "#22c55e" : "#ef4444";
  const gradientId = `gradient-${symbol.replace(/[^a-zA-Z0-9]/g, "")}`;
  const minVal = Math.min(...data.map((d) => d.low));
  const maxVal = Math.max(...data.map((d) => d.high));
  const padding = (maxVal - minVal) * 0.1 || 1;
  const firstClose = data[0].close;

  const isKorean = symbol.endsWith(".KS") || symbol.endsWith(".KQ");
  const fmtPrice = (v: number) =>
    isKorean
      ? v.toLocaleString() + "원"
      : "$" + v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div>
      {/* 차트 헤더 — 실시간 현재가 */}
      {!compact && (
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold text-foreground">{symbol}</span>
            {livePrice && (
              <span className="text-[9px] font-mono text-muted-foreground/50 truncate max-w-[100px]">
                {livePrice.name}
              </span>
            )}
          </div>
          <div className="text-right">
            {livePrice ? (
              <>
                <div
                  className={`font-mono text-sm font-bold text-foreground transition-colors duration-300 ${
                    priceFlash === "up"
                      ? "!text-up"
                      : priceFlash === "down"
                      ? "!text-down"
                      : ""
                  }`}
                >
                  {fmtPrice(livePrice.price)}
                </div>
                <div className={`font-mono text-[10px] font-medium ${livePrice.changePercent >= 0 ? "text-up" : "text-down"}`}>
                  {livePrice.changePercent >= 0 ? "+" : ""}{livePrice.changePercent.toFixed(2)}%
                  <span className="text-muted-foreground/40 ml-1">7D {isUp ? "+" : ""}{changePercent.toFixed(2)}%</span>
                </div>
              </>
            ) : (
              <div className={`font-mono text-xs font-bold ${isUp ? "text-up" : "text-down"}`}>
                {isUp ? "+" : ""}{changePercent.toFixed(2)}%
              </div>
            )}
          </div>
        </div>
      )}

      <ResponsiveContainer width="100%" height={compact ? 100 : 180}>
        <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={lineColor} stopOpacity={0.3} />
              <stop offset="100%" stopColor={lineColor} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="rgba(255,255,255,0.04)"
            vertical={false}
          />
          <XAxis
            dataKey="date"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 9, fill: "rgba(255,255,255,0.3)", fontFamily: "monospace" }}
            tickFormatter={(v: string) => {
              const parts = v.split("-");
              return `${parts[1]}/${parts[2]}`;
            }}
          />
          <YAxis
            domain={[minVal - padding, maxVal + padding]}
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 9, fill: "rgba(255,255,255,0.3)", fontFamily: "monospace" }}
            tickFormatter={(v: number) =>
              v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v.toFixed(1)
            }
            width={42}
          />
          <Tooltip
            content={<CustomTooltip trend={trend} />}
            cursor={{
              stroke: "rgba(255,255,255,0.15)",
              strokeWidth: 1,
              strokeDasharray: "4 4",
            }}
          />
          <ReferenceLine
            y={firstClose}
            stroke="rgba(255,255,255,0.08)"
            strokeDasharray="3 3"
          />
          <Area
            type="monotone"
            dataKey="close"
            stroke={lineColor}
            strokeWidth={2}
            fill={`url(#${gradientId})`}
            dot={false}
            activeDot={{
              r: 4,
              fill: lineColor,
              stroke: "rgba(0,0,0,0.5)",
              strokeWidth: 2,
            }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
