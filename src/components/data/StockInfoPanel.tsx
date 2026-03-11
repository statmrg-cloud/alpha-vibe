"use client";

import { useState, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

interface OrderBookEntry {
  price: number;
  quantity: number;
}

interface StockInfo {
  symbol: string;
  name: string;
  marketData: {
    open: number;
    close: number;
    high: number;
    low: number;
    volume: number;
    tradingValue: number;
  } | null;
  orderBook: {
    asks: OrderBookEntry[];
    bids: OrderBookEntry[];
  } | null;
  investorTrends: {
    individual: { buy: number; sell: number };
    foreign: { buy: number; sell: number };
    institution: { buy: number; sell: number };
  } | null;
  metrics: {
    marketCap: number;
    dividendYield: number;
    pbr: number;
    per: number;
    roe: number;
    psr: number;
    foreignOwnership: number;
  } | null;
  news: Array<{ title: string; url: string; date: string }> | null;
}

function fmtNum(v: number | null | undefined): string {
  if (v == null || isNaN(v)) return "-";
  if (Math.abs(v) >= 1e12) return `${(v / 1e12).toFixed(1)}조`;
  if (Math.abs(v) >= 1e8) return `${(v / 1e8).toFixed(0)}억`;
  if (Math.abs(v) >= 1e4) return `${(v / 1e4).toFixed(0)}만`;
  return v.toLocaleString();
}

function fmtPrice(v: number | null | undefined, isKR: boolean): string {
  if (v == null || isNaN(v)) return "-";
  return isKR ? v.toLocaleString() : `$${v.toFixed(2)}`;
}

function fmtPct(v: number | null | undefined): string {
  if (v == null || isNaN(v)) return "-";
  return `${v.toFixed(2)}%`;
}

interface StockInfoPanelProps {
  symbol: string;
}

export default function StockInfoPanel({ symbol }: StockInfoPanelProps) {
  const [info, setInfo] = useState<StockInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"orderbook" | "market" | "investor" | "metrics" | "news">("orderbook");

  const isKR = symbol.endsWith(".KS") || symbol.endsWith(".KQ");

  const fetchInfo = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/stock/info?symbol=${encodeURIComponent(symbol)}`);
      if (res.ok) {
        const data = await res.json();
        setInfo(data);
      }
    } catch { /* silent */ }
    setLoading(false);
  }, [symbol]);

  useEffect(() => {
    fetchInfo();
    const interval = setInterval(fetchInfo, 30000); // 30초마다 갱신
    return () => clearInterval(interval);
  }, [fetchInfo]);

  const tabs = [
    { key: "orderbook" as const, label: "호가" },
    { key: "market" as const, label: "시세" },
    { key: "investor" as const, label: "투자자" },
    { key: "metrics" as const, label: "지표" },
    { key: "news" as const, label: "뉴스" },
  ];

  const renderOrderBook = () => {
    const ob = info?.orderBook;
    if (!ob) return <div className="text-xs text-slate-400 text-center py-3">호가 데이터 없음</div>;

    const maxQty = Math.max(
      ...ob.asks.map((a) => a.quantity),
      ...ob.bids.map((b) => b.quantity),
      1
    );

    return (
      <div className="space-y-1">
        <div className="text-[11px] font-mono text-slate-400 flex justify-between px-1">
          <span>매도 대기</span>
          <span>가격</span>
          <span>수량</span>
        </div>
        {/* 매도 (위에서 아래로 = 높은가격→낮은가격) */}
        {[...ob.asks].reverse().map((a, i) => (
          <div key={`ask-${i}`} className="relative flex items-center justify-between text-xs font-mono px-1 py-0.5">
            <div
              className="absolute right-0 top-0 bottom-0 bg-red-500/10"
              style={{ width: `${(a.quantity / maxQty) * 100}%` }}
            />
            <span className="text-red-400 relative z-10">{fmtNum(a.quantity)}주</span>
            <span className="text-foreground relative z-10 font-medium">{fmtPrice(a.price, isKR)}</span>
            <span className="text-slate-400 relative z-10">{fmtNum(a.quantity)}</span>
          </div>
        ))}
        <Separator className="bg-border/50" />
        {/* 매수 (위에서 아래로 = 높은가격→낮은가격) */}
        {ob.bids.map((b, i) => (
          <div key={`bid-${i}`} className="relative flex items-center justify-between text-xs font-mono px-1 py-0.5">
            <div
              className="absolute left-0 top-0 bottom-0 bg-green-500/10"
              style={{ width: `${(b.quantity / maxQty) * 100}%` }}
            />
            <span className="text-slate-400 relative z-10">{fmtNum(b.quantity)}</span>
            <span className="text-foreground relative z-10 font-medium">{fmtPrice(b.price, isKR)}</span>
            <span className="text-green-400 relative z-10">{fmtNum(b.quantity)}주</span>
          </div>
        ))}
      </div>
    );
  };

  const renderMarket = () => {
    const md = info?.marketData;
    if (!md) return <div className="text-xs text-slate-400 text-center py-3">시세 데이터 없음</div>;
    return (
      <div className="grid grid-cols-2 gap-2 text-xs font-mono">
        <div className="flex justify-between"><span className="text-slate-400">시가</span><span>{fmtPrice(md.open, isKR)}</span></div>
        <div className="flex justify-between"><span className="text-slate-400">종가</span><span>{fmtPrice(md.close, isKR)}</span></div>
        <div className="flex justify-between"><span className="text-slate-400">고가</span><span className="text-red-400">{fmtPrice(md.high, isKR)}</span></div>
        <div className="flex justify-between"><span className="text-slate-400">저가</span><span className="text-blue-400">{fmtPrice(md.low, isKR)}</span></div>
        <div className="flex justify-between"><span className="text-slate-400">거래량</span><span>{fmtNum(md.volume)}</span></div>
        <div className="flex justify-between"><span className="text-slate-400">거래대금</span><span>{fmtNum(md.tradingValue)}</span></div>
      </div>
    );
  };

  const renderInvestor = () => {
    const it = info?.investorTrends;
    if (!it) return <div className="text-xs text-slate-400 text-center py-3">투자자 데이터 없음{!isKR && " (한국주식만 지원)"}</div>;

    const rows = [
      { label: "개인", data: it.individual },
      { label: "외국인", data: it.foreign },
      { label: "기관", data: it.institution },
    ];

    return (
      <div className="space-y-1.5">
        <div className="grid grid-cols-3 text-[11px] font-mono text-slate-400 px-1">
          <span></span><span className="text-right">순매수(주)</span><span className="text-right">방향</span>
        </div>
        {rows.map((r) => {
          if (!r.data) return null;
          const net = r.data.buy - r.data.sell;
          return (
            <div key={r.label} className="grid grid-cols-3 text-xs font-mono px-1 items-center">
              <span className="text-slate-300">{r.label}</span>
              <span className={`text-right font-medium ${net > 0 ? "text-up" : net < 0 ? "text-down" : "text-slate-400"}`}>
                {net > 0 ? "+" : ""}{fmtNum(net)}
              </span>
              <span className={`text-right text-[11px] ${net > 0 ? "text-up" : net < 0 ? "text-down" : "text-slate-400"}`}>
                {net > 0 ? "매수 우위" : net < 0 ? "매도 우위" : "-"}
              </span>
            </div>
          );
        })}
      </div>
    );
  };

  const renderMetrics = () => {
    const m = info?.metrics;
    if (!m) return <div className="text-xs text-slate-400 text-center py-3">지표 데이터 없음</div>;
    const items = [
      { label: "시가총액", value: fmtNum(m.marketCap) },
      { label: "PER", value: m.per ? m.per.toFixed(2) : "-" },
      { label: "PBR", value: m.pbr ? m.pbr.toFixed(2) : "-" },
      { label: "ROE", value: fmtPct(m.roe) },
      { label: "PSR", value: m.psr ? m.psr.toFixed(2) : "-" },
      { label: "배당수익률", value: fmtPct(m.dividendYield) },
      { label: "외국인소진율", value: fmtPct(m.foreignOwnership) },
    ];
    return (
      <div className="grid grid-cols-2 gap-2 text-xs font-mono">
        {items.map((item) => (
          <div key={item.label} className="flex justify-between">
            <span className="text-slate-400">{item.label}</span>
            <span className="text-foreground">{item.value}</span>
          </div>
        ))}
      </div>
    );
  };

  const renderNews = () => {
    const news = info?.news;
    if (!news || news.length === 0) return <div className="text-xs text-slate-400 text-center py-3">관련 뉴스 없음</div>;
    return (
      <div className="space-y-2">
        {news.map((n, i) => (
          <a
            key={i}
            href={n.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block text-xs font-mono hover:bg-secondary/50 rounded px-1 py-1 transition-colors"
          >
            <div className="text-slate-200 leading-relaxed">{n.title}</div>
            <div className="text-[10px] text-slate-500 mt-0.5">{n.date}</div>
          </a>
        ))}
      </div>
    );
  };

  return (
    <Card className="bg-card border-border overflow-hidden">
      <div className="px-3 pt-3 pb-1">
        <div className="flex items-center gap-1.5 mb-2">
          <div className="w-1 h-3 rounded-full bg-accent" />
          <span className="text-xs font-mono text-cyan-500 tracking-wider">
            STOCK INFO
          </span>
          {loading && <span className="text-[10px] text-slate-500 animate-pulse ml-auto">...</span>}
        </div>
        {/* 탭 */}
        <div className="flex gap-0.5 mb-2 overflow-x-auto scrollbar-none">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-2 py-0.5 text-[11px] font-mono rounded transition-colors whitespace-nowrap ${
                activeTab === tab.key
                  ? "bg-accent/20 text-accent border border-accent/30"
                  : "text-slate-400 hover:text-foreground hover:bg-secondary border border-transparent"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>
      <div className="px-3 pb-3">
        {activeTab === "orderbook" && renderOrderBook()}
        {activeTab === "market" && renderMarket()}
        {activeTab === "investor" && renderInvestor()}
        {activeTab === "metrics" && renderMetrics()}
        {activeTab === "news" && renderNews()}
      </div>
    </Card>
  );
}
