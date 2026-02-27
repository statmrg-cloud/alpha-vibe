"use client";

import { useState, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { usePortfolioContext } from "@/contexts/PortfolioContext";
import StockChart from "@/components/chart/StockChart";
import AutoTradePanel from "@/components/autotrade/AutoTradePanel";
import AlpacaAccountPanel from "@/components/data/AlpacaAccountPanel";
import TradeModal from "@/components/trade/TradeModal";
import RealTradeModal from "@/components/trade/RealTradeModal";

const WATCHLIST_SYMBOLS = [
  { symbol: "AAPL", name: "Apple Inc." },
  { symbol: "NVDA", name: "NVIDIA Corp." },
  { symbol: "MSFT", name: "Microsoft" },
  { symbol: "005930.KS", name: "삼성전자" },
  { symbol: "TSLA", name: "Tesla Inc." },
  { symbol: "035720.KS", name: "카카오" },
];

interface WatchlistData {
  symbol: string;
  name: string;
  price: number;
  changePercent: number;
  loading: boolean;
}

interface TradeModalState {
  symbol: string;
  name: string;
  price: number;
  type: "BUY" | "SELL";
}

interface RealTradeModalState {
  symbol: string;
  name: string;
  price: number;
  side: "buy" | "sell";
}

// 한글/영문 종목 검색 DB
const STOCK_SEARCH_DB: Array<{ name: string; symbol: string; keywords: string[] }> = [
  // 미국 주식
  { name: "Apple", symbol: "AAPL", keywords: ["애플", "아이폰", "apple", "aapl"] },
  { name: "NVIDIA", symbol: "NVDA", keywords: ["엔비디아", "nvidia", "nvda"] },
  { name: "Microsoft", symbol: "MSFT", keywords: ["마이크로소프트", "microsoft", "msft"] },
  { name: "Tesla", symbol: "TSLA", keywords: ["테슬라", "tesla", "tsla"] },
  { name: "Amazon", symbol: "AMZN", keywords: ["아마존", "amazon", "amzn"] },
  { name: "Google", symbol: "GOOGL", keywords: ["구글", "알파벳", "google", "googl"] },
  { name: "Meta", symbol: "META", keywords: ["메타", "페이스북", "meta"] },
  { name: "Netflix", symbol: "NFLX", keywords: ["넷플릭스", "netflix", "nflx"] },
  // 한국 주식
  { name: "삼성전자", symbol: "005930.KS", keywords: ["삼성전자", "삼성", "samsung"] },
  { name: "삼성SDI", symbol: "006400.KS", keywords: ["삼성sdi", "삼성"] },
  { name: "삼성바이오로직스", symbol: "207940.KS", keywords: ["삼성바이오", "삼성"] },
  { name: "삼성물산", symbol: "028260.KS", keywords: ["삼성물산", "삼성"] },
  { name: "삼성생명", symbol: "032830.KS", keywords: ["삼성생명", "삼성"] },
  { name: "삼성화재", symbol: "000810.KS", keywords: ["삼성화재", "삼성"] },
  { name: "삼성전기", symbol: "009150.KS", keywords: ["삼성전기", "삼성"] },
  { name: "삼성중공업", symbol: "010140.KS", keywords: ["삼성중공업", "삼성"] },
  { name: "SK하이닉스", symbol: "000660.KS", keywords: ["sk하이닉스", "하이닉스", "sk"] },
  { name: "네이버", symbol: "035420.KS", keywords: ["네이버", "naver"] },
  { name: "카카오", symbol: "035720.KS", keywords: ["카카오", "kakao"] },
  { name: "카카오뱅크", symbol: "323410.KS", keywords: ["카카오뱅크", "카카오"] },
  { name: "카카오페이", symbol: "377300.KS", keywords: ["카카오페이", "카카오"] },
  { name: "현대차", symbol: "005380.KS", keywords: ["현대차", "현대자동차", "현대"] },
  { name: "현대모비스", symbol: "012330.KS", keywords: ["현대모비스", "현대"] },
  { name: "기아", symbol: "000270.KS", keywords: ["기아", "기아차"] },
  { name: "LG에너지솔루션", symbol: "373220.KS", keywords: ["lg에너지", "lg"] },
  { name: "LG화학", symbol: "051910.KS", keywords: ["lg화학", "lg"] },
  { name: "셀트리온", symbol: "068270.KS", keywords: ["셀트리온"] },
  { name: "포스코홀딩스", symbol: "005490.KS", keywords: ["포스코", "posco"] },
  { name: "KB금융", symbol: "105560.KS", keywords: ["kb금융", "kb", "국민은행"] },
  { name: "신한지주", symbol: "055550.KS", keywords: ["신한", "신한지주"] },
  { name: "한국전력", symbol: "015760.KS", keywords: ["한국전력", "한전"] },
  { name: "크래프톤", symbol: "259960.KS", keywords: ["크래프톤", "배그", "krafton"] },
  { name: "루닛", symbol: "328130.KS", keywords: ["루닛", "lunit"] },
  { name: "에이비엘바이오", symbol: "298380.KS", keywords: ["에이비엘", "abl"] },
  { name: "미래에셋증권", symbol: "006800.KS", keywords: ["미래에셋", "미래에셋증권"] },
  { name: "한화에어로스페이스", symbol: "012450.KS", keywords: ["한화에어로", "한화", "한화항공우주"] },
  { name: "한화오션", symbol: "042660.KS", keywords: ["한화오션", "한화", "대우조선"] },
  { name: "HD현대중공업", symbol: "329180.KS", keywords: ["hd현대", "현대중공업", "현대"] },
  { name: "두산에너빌리티", symbol: "034020.KS", keywords: ["두산에너", "두산"] },
  { name: "POSCO퓨처엠", symbol: "003670.KS", keywords: ["포스코퓨처엠", "포스코", "에코프로"] },
  { name: "에코프로비엠", symbol: "247540.KS", keywords: ["에코프로비엠", "에코프로"] },
  { name: "에코프로", symbol: "086520.KS", keywords: ["에코프로"] },
  { name: "한미반도체", symbol: "042700.KS", keywords: ["한미반도체", "한미"] },
  { name: "SK이노베이션", symbol: "096770.KS", keywords: ["sk이노", "sk"] },
];

export default function DataPanel() {
  const { portfolio, isLoaded, resetPortfolio } = usePortfolioContext();
  const [chartSymbol, setChartSymbol] = useState("AAPL");
  const [symbolInput, setSymbolInput] = useState("");
  const [suggestions, setSuggestions] = useState<typeof STOCK_SEARCH_DB>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(-1);
  const [watchlist, setWatchlist] = useState<WatchlistData[]>(
    WATCHLIST_SYMBOLS.map((w) => ({ ...w, price: 0, changePercent: 0, loading: true }))
  );
  const [holdingPrices, setHoldingPrices] = useState<Record<string, number>>({});
  const [tradeModal, setTradeModal] = useState<TradeModalState | null>(null);
  const [realTradeModal, setRealTradeModal] = useState<RealTradeModalState | null>(null);
  const [chartPrice, setChartPrice] = useState<{ price: number; name: string } | null>(null);
  const [exchangeRate, setExchangeRate] = useState<number>(1350);
  const [showAlpaca, setShowAlpaca] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("alpha-vibe-show-alpaca") === "true";
  });
  const [showSettings, setShowSettings] = useState(false);

  const toggleAlpaca = (val: boolean) => {
    setShowAlpaca(val);
    localStorage.setItem("alpha-vibe-show-alpaca", String(val));
  };

  // 환율 fetch
  useEffect(() => {
    const fetchRate = () => {
      fetch("/api/exchange-rate")
        .then((res) => res.json())
        .then((data) => { if (data.rate) setExchangeRate(data.rate); })
        .catch(() => {});
    };
    fetchRate();
    const interval = setInterval(fetchRate, 10 * 60 * 1000); // 10분마다
    return () => clearInterval(interval);
  }, []);

  // 채팅에서 종목 변경 이벤트 수신
  useEffect(() => {
    const handleSymbolChange = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.symbol) {
        setChartSymbol(detail.symbol);
      }
    };
    window.addEventListener("chart-symbol-change", handleSymbolChange);
    return () => window.removeEventListener("chart-symbol-change", handleSymbolChange);
  }, []);

  // 차트 종목 가격 fetch (매수/매도 버튼용)
  const fetchChartPrice = useCallback(async () => {
    try {
      const res = await fetch(`/api/stock?symbol=${encodeURIComponent(chartSymbol)}`);
      if (res.ok) {
        const data = await res.json();
        setChartPrice({ price: data.price, name: data.name });
      }
    } catch { /* skip */ }
  }, [chartSymbol]);

  useEffect(() => {
    fetchChartPrice();
  }, [fetchChartPrice]);

  // 차트에서 매수/매도 트리거
  const handleChartTrade = async (type: "BUY" | "SELL") => {
    if (!chartPrice) {
      await fetchChartPrice();
    }
    const name = chartPrice?.name || getStockName(chartSymbol) || chartSymbol;
    const price = chartPrice?.price || 0;
    if (price <= 0) {
      alert(`${chartSymbol} 시세를 가져올 수 없습니다.`);
      return;
    }
    setTradeModal({ symbol: chartSymbol, name, price, type });
  };

  const handleChartRealTrade = async (side: "buy" | "sell") => {
    if (!chartPrice) {
      await fetchChartPrice();
    }
    const name = chartPrice?.name || getStockName(chartSymbol) || chartSymbol;
    const price = chartPrice?.price || 0;
    if (price <= 0) {
      alert(`${chartSymbol} 시세를 가져올 수 없습니다.`);
      return;
    }
    setRealTradeModal({ symbol: chartSymbol, name, price, side });
  };

  // 보유종목 현재가 fetch
  const fetchHoldingPrices = useCallback(async () => {
    if (portfolio.holdings.length === 0) return;
    const prices: Record<string, number> = {};
    await Promise.all(
      portfolio.holdings.map(async (h) => {
        try {
          const res = await fetch(`/api/stock?symbol=${encodeURIComponent(h.symbol)}`);
          if (res.ok) {
            const data = await res.json();
            prices[h.symbol] = data.price || 0;
          }
        } catch { /* skip */ }
      })
    );
    setHoldingPrices(prices);
  }, [portfolio.holdings]);

  useEffect(() => {
    if (isLoaded && portfolio.holdings.length > 0) {
      fetchHoldingPrices();
      const interval = setInterval(fetchHoldingPrices, 30000);
      return () => clearInterval(interval);
    } else if (isLoaded && portfolio.holdings.length === 0) {
      setHoldingPrices({});
    }
  }, [isLoaded, portfolio.holdings, fetchHoldingPrices]);

  const handleTradeComplete = useCallback((message: string) => {
    setTradeModal(null);
    // 포트폴리오 갱신되면 가격 다시 fetch
    setTimeout(() => {
      fetchChartPrice();
      fetchHoldingPrices();
    }, 500);
    // 채팅에 거래 결과 전달
    window.dispatchEvent(new CustomEvent("trade-complete-message", { detail: { message } }));
  }, [fetchChartPrice, fetchHoldingPrices]);

  const handleRealTradeComplete = useCallback((message: string) => {
    setRealTradeModal(null);
    window.dispatchEvent(new CustomEvent("alpaca-trade-complete"));
    window.dispatchEvent(new CustomEvent("trade-complete-message", { detail: { message } }));
  }, []);

  // 입력값에 따라 자동완성 후보 계산
  const handleInputChange = (value: string) => {
    setSymbolInput(value);
    const q = value.trim().toLowerCase();
    if (q.length === 0) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    const matched = STOCK_SEARCH_DB.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        item.symbol.toLowerCase().includes(q) ||
        item.keywords.some((kw) => kw.includes(q))
    ).slice(0, 8);
    setSuggestions(matched);
    setShowSuggestions(matched.length > 0);
    setSelectedIdx(-1);
  };

  const handleSelectSuggestion = (symbol: string) => {
    setChartSymbol(symbol);
    setSymbolInput("");
    setSuggestions([]);
    setShowSuggestions(false);
    setSelectedIdx(-1);
  };

  const handleSymbolSearch = () => {
    const q = symbolInput.trim();
    if (!q) return;

    // 한글이면 매핑에서 찾기
    const exact = STOCK_SEARCH_DB.find(
      (item) =>
        item.name.toLowerCase() === q.toLowerCase() ||
        item.keywords.some((kw) => kw === q.toLowerCase())
    );
    if (exact) {
      setChartSymbol(exact.symbol);
    } else {
      setChartSymbol(q.toUpperCase());
    }
    setSymbolInput("");
    setSuggestions([]);
    setShowSuggestions(false);
  };

  // 실시간 워치리스트 데이터 fetch
  const fetchWatchlistData = useCallback(async () => {
    const updated = await Promise.all(
      WATCHLIST_SYMBOLS.map(async (item) => {
        try {
          const res = await fetch(`/api/stock?symbol=${encodeURIComponent(item.symbol)}`);
          if (!res.ok) return { ...item, price: 0, changePercent: 0, loading: false };
          const data = await res.json();
          return {
            symbol: item.symbol,
            name: data.name || item.name,
            price: data.price || 0,
            changePercent: data.changePercent || 0,
            loading: false,
          };
        } catch {
          return { ...item, price: 0, changePercent: 0, loading: false };
        }
      })
    );
    setWatchlist(updated);
  }, []);

  useEffect(() => {
    fetchWatchlistData();
    const interval = setInterval(fetchWatchlistData, 60000);
    return () => clearInterval(interval);
  }, [fetchWatchlistData]);

  const totalInvested = portfolio.holdings.reduce(
    (sum, h) => sum + h.totalInvested,
    0
  );
  // 종목의 현재가를 KRW로 환산
  const getKrwPrice = (symbol: string, usdPrice: number) => {
    const isKorean = symbol.endsWith(".KS") || symbol.endsWith(".KQ");
    return isKorean ? usdPrice : usdPrice * exchangeRate;
  };

  const totalMarketValue = portfolio.holdings.reduce(
    (sum, h) => {
      const rawPrice = holdingPrices[h.symbol];
      const curPrice = rawPrice ? getKrwPrice(h.symbol, rawPrice) : h.avgPrice;
      return sum + curPrice * h.quantity;
    },
    0
  );
  const totalValue = portfolio.cash + totalMarketValue;
  const initialCash = 100_000_000;
  const pnl = totalValue - initialCash;
  const pnlPct = (pnl / initialCash) * 100;

  const getStockName = (sym: string): string => {
    const found = STOCK_SEARCH_DB.find((s) => s.symbol === sym);
    return found ? found.name : "";
  };

  const getDisplayLabel = (sym: string): string => {
    const name = getStockName(sym);
    const isKorean = sym.endsWith(".KS") || sym.endsWith(".KQ");
    if (isKorean && name) return name;
    return name ? `${sym} ${name}` : sym;
  };

  const formatPrice = (symbol: string, price: number) => {
    if (price === 0) return "\u2014";
    const isKorean = symbol.endsWith(".KS") || symbol.endsWith(".KQ");
    return isKorean
      ? price.toLocaleString()
      : price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const isKoreanStock = chartSymbol.endsWith(".KS") || chartSymbol.endsWith(".KQ");

  return (
    <ScrollArea className="h-full">
      <div className="p-3 space-y-3">
        {/* 주가 차트 */}
        <Card className="bg-card border-border overflow-hidden">
          <div className="px-3 pt-3 pb-1">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <div className="w-1 h-3 rounded-full bg-primary" />
                <span className="text-[10px] font-mono text-muted-foreground tracking-wider">
                  PRICE CHART
                </span>
              </div>
              <span className="text-[9px] font-mono text-muted-foreground/50">7D</span>
            </div>
            {/* 종목 검색 + 자동완성 */}
            <div className="relative mb-2">
              <div className="flex gap-1">
                <input
                  type="text"
                  value={symbolInput}
                  onChange={(e) => handleInputChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (showSuggestions && suggestions.length > 0) {
                      if (e.key === "ArrowDown") {
                        e.preventDefault();
                        setSelectedIdx((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
                      } else if (e.key === "ArrowUp") {
                        e.preventDefault();
                        setSelectedIdx((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
                      } else if (e.key === "Enter") {
                        e.preventDefault();
                        if (selectedIdx >= 0 && selectedIdx < suggestions.length) {
                          handleSelectSuggestion(suggestions[selectedIdx].symbol);
                        } else {
                          handleSymbolSearch();
                        }
                      } else if (e.key === "Escape") {
                        setShowSuggestions(false);
                        setSelectedIdx(-1);
                      }
                    } else {
                      if (e.key === "Enter") handleSymbolSearch();
                    }
                  }}
                  onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
                  onBlur={() => setTimeout(() => { setShowSuggestions(false); setSelectedIdx(-1); }, 200)}
                  placeholder="종목 검색 (삼성, GOOG, 카카오...)"
                  className="flex-1 h-5 text-[10px] font-mono bg-secondary/60 border border-border/50 rounded px-2 text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:border-primary/40"
                />
                <button
                  onClick={handleSymbolSearch}
                  className="text-[9px] font-mono px-2 h-5 rounded bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-all"
                >
                  검색
                </button>
              </div>
              {/* 자동완성 드롭다운 */}
              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute top-6 left-0 right-0 z-50 bg-card border border-border/80 rounded-md shadow-xl overflow-hidden">
                  {suggestions.map((item, idx) => (
                    <button
                      key={item.symbol}
                      onMouseDown={() => handleSelectSuggestion(item.symbol)}
                      onMouseEnter={() => setSelectedIdx(idx)}
                      className={`w-full flex items-center justify-between px-2 py-1.5 transition-colors text-left ${
                        idx === selectedIdx
                          ? "bg-primary/15 text-primary"
                          : "hover:bg-primary/10"
                      }`}
                    >
                      <div className="font-mono flex items-center gap-1.5">
                        {idx === selectedIdx && (
                          <span className="text-primary text-[10px]">&gt;</span>
                        )}
                        <span className={`text-[10px] font-medium ${idx === selectedIdx ? "text-primary" : "text-foreground"}`}>
                          {item.name}
                        </span>
                      </div>
                      <span className={`text-[9px] font-mono ${idx === selectedIdx ? "text-primary/70" : "text-muted-foreground/60"}`}>
                        {item.symbol}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {/* 종목 선택 탭 */}
            <div className="flex gap-1 mb-2 flex-wrap">
              {["AAPL", "NVDA", "MSFT", "TSLA"].map((sym) => (
                <button
                  key={sym}
                  onClick={() => setChartSymbol(sym)}
                  className={`text-[9px] font-mono px-2 py-0.5 rounded transition-all ${
                    chartSymbol === sym
                      ? "bg-primary/20 text-primary border border-primary/30"
                      : "text-muted-foreground/60 border border-transparent hover:text-muted-foreground hover:border-border"
                  }`}
                >
                  {getDisplayLabel(sym)}
                </button>
              ))}
              {portfolio.holdings.length > 0 &&
                portfolio.holdings
                  .filter((h) => !["AAPL", "NVDA", "MSFT", "TSLA"].includes(h.symbol))
                  .slice(0, 2)
                  .map((h) => (
                    <button
                      key={h.symbol}
                      onClick={() => setChartSymbol(h.symbol)}
                      className={`text-[9px] font-mono px-2 py-0.5 rounded transition-all ${
                        chartSymbol === h.symbol
                          ? "bg-primary/20 text-primary border border-primary/30"
                          : "text-muted-foreground/60 border border-transparent hover:text-muted-foreground hover:border-border"
                      }`}
                    >
                      {getDisplayLabel(h.symbol)}
                    </button>
                  ))}
            </div>
          </div>
          <div className="px-1 pb-2">
            <StockChart symbol={chartSymbol} />
          </div>
          {/* 매수/매도 버튼 */}
          <div className="px-3 pb-3 pt-1 border-t border-border/30">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono text-foreground font-medium flex-shrink-0">
                {getDisplayLabel(chartSymbol)}
              </span>
              <div className="flex gap-1.5 ml-auto">
                <Button
                  size="sm"
                  onClick={() => handleChartTrade("BUY")}
                  className="h-6 px-3 text-[9px] font-mono font-bold bg-primary/10 text-up border border-primary/20 hover:bg-primary/20"
                  variant="outline"
                >
                  매수
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleChartTrade("SELL")}
                  className="h-6 px-3 text-[9px] font-mono font-bold bg-destructive/10 text-down border border-destructive/20 hover:bg-destructive/20"
                  variant="outline"
                >
                  매도
                </Button>
                {showAlpaca && !isKoreanStock && (
                  <>
                    <div className="w-px h-4 bg-border/50" />
                    <Button
                      size="sm"
                      onClick={() => handleChartRealTrade("buy")}
                      className="h-6 px-3 text-[9px] font-mono font-bold bg-chart-4/10 text-chart-4 border border-chart-4/20 hover:bg-chart-4/20"
                      variant="outline"
                    >
                      실매수
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleChartRealTrade("sell")}
                      className="h-6 px-3 text-[9px] font-mono font-bold bg-chart-4/10 text-chart-4 border border-chart-4/20 hover:bg-chart-4/20"
                      variant="outline"
                    >
                      실매도
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        </Card>

        {/* 모의투자 포트폴리오 */}
        <Card className="bg-card border-border overflow-hidden">
          <div className="px-3 pt-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <div className="w-1 h-3 rounded-full bg-chart-4" />
                <span className="text-[10px] font-mono text-muted-foreground tracking-wider">
                  PORTFOLIO
                </span>
                <span className="text-[7px] font-mono text-muted-foreground/50 px-1 py-0.5 rounded border border-border/40">
                  KR / US
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <Badge
                  variant="outline"
                  className="text-[8px] h-[18px] border-chart-4/40 text-chart-4 px-1.5"
                >
                  PAPER TRADING
                </Badge>
                <button
                  onClick={() => setShowSettings(!showSettings)}
                  className="text-[9px] font-mono text-muted-foreground/40 hover:text-foreground transition-colors"
                  title="설정"
                >
                  ⚙
                </button>
                <button
                  onClick={resetPortfolio}
                  className="text-[9px] font-mono text-muted-foreground/40 hover:text-destructive transition-colors"
                  title="포트폴리오 초기화"
                >
                  RESET
                </button>
              </div>
            </div>
          </div>
          {isLoaded ? (
            <div className="px-3 pb-3">
              <div className="font-mono">
                <div className="text-xl font-bold text-foreground tracking-tight">
                  {Math.round(totalValue).toLocaleString()}
                  <span className="text-xs text-muted-foreground ml-0.5">KRW</span>
                </div>
                <div className={`text-xs font-bold mt-0.5 ${pnl >= 0 ? "text-up" : "text-down"}`}>
                  {pnl >= 0 ? "+" : ""}
                  {Math.round(pnl).toLocaleString()}원 ({pnl >= 0 ? "+" : ""}
                  {pnlPct.toFixed(2)}%)
                </div>
              </div>
              <Separator className="my-2.5 bg-border/50" />
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[10px] font-mono">
                <div className="flex justify-between">
                  <span className="text-muted-foreground/70">보유 현금</span>
                  <span className="text-foreground">{Math.round(portfolio.cash).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground/70">평가액</span>
                  <span className="text-foreground">{Math.round(totalMarketValue).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground/70">투자 원금</span>
                  <span className="text-foreground">{Math.round(totalInvested).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground/70">평가 손익</span>
                  <span className={totalMarketValue - totalInvested >= 0 ? "text-up" : "text-down"}>
                    {totalMarketValue - totalInvested >= 0 ? "+" : ""}
                    {Math.round(totalMarketValue - totalInvested).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground/70">종목 수</span>
                  <span className="text-foreground">{portfolio.holdings.length}종목</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground/70">총 거래</span>
                  <span className="text-foreground">{portfolio.trades.length}건</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="px-3 pb-3 text-xs font-mono text-muted-foreground animate-pulse">
              로딩 중...
            </div>
          )}
        </Card>

        {/* 설정 패널 */}
        {showSettings && (
          <Card className="bg-card border-border overflow-hidden">
            <div className="px-3 py-2.5">
              <div className="flex items-center gap-1.5 mb-2">
                <div className="w-1 h-3 rounded-full bg-muted-foreground" />
                <span className="text-[10px] font-mono text-muted-foreground tracking-wider">
                  SETTINGS
                </span>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[10px] font-mono text-foreground">Alpaca 실거래 계좌</div>
                    <div className="text-[9px] font-mono text-muted-foreground/50">Alpaca Paper Trading API 연동</div>
                  </div>
                  <button
                    onClick={() => toggleAlpaca(!showAlpaca)}
                    className={`w-8 h-4 rounded-full transition-colors relative ${
                      showAlpaca ? "bg-primary" : "bg-muted"
                    }`}
                  >
                    <div
                      className={`w-3 h-3 rounded-full bg-white absolute top-0.5 transition-transform ${
                        showAlpaca ? "translate-x-4" : "translate-x-0.5"
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Alpaca 실매매 계좌 (설정에서 활성화 시만 표시) */}
        {showAlpaca && (
          <Card className="bg-card border-border overflow-hidden">
            <div className="px-3 py-3">
              <AlpacaAccountPanel />
            </div>
          </Card>
        )}

        {/* 보유 종목 */}
        <Card className="bg-card border-border overflow-hidden">
          <div className="px-3 pt-3 pb-1">
            <div className="flex items-center gap-1.5 mb-2">
              <div className="w-1 h-3 rounded-full bg-primary" />
              <span className="text-[10px] font-mono text-muted-foreground tracking-wider">
                HOLDINGS
              </span>
              {portfolio.holdings.length > 0 && (
                <span className="text-[9px] font-mono text-muted-foreground/40 ml-auto">
                  {portfolio.holdings.length}종목
                </span>
              )}
            </div>
          </div>
          <div className="px-3 pb-3">
            {portfolio.holdings.length === 0 ? (
              <div className="text-[10px] font-mono text-muted-foreground/40 py-3 text-center border border-dashed border-border/50 rounded">
                보유 종목 없음 — 차트에서 매수하거나 AI 분석 후 매수해보세요
              </div>
            ) : (
              <div className="space-y-1">
                {portfolio.holdings.map((h) => (
                  <div
                    key={h.symbol}
                    onClick={() => setChartSymbol(h.symbol)}
                    className="flex items-center justify-between py-1.5 px-2 -mx-2 hover:bg-secondary/50 rounded cursor-pointer transition-all group"
                  >
                    <div className="font-mono">
                      <div className="text-xs text-foreground font-medium group-hover:text-primary transition-colors">
                        {h.name || getStockName(h.symbol) || h.symbol}
                      </div>
                      <div className="text-[10px] text-muted-foreground/60">{h.symbol}</div>
                    </div>
                    <div className="text-right font-mono">
                      <div className="text-xs text-foreground">{h.quantity}주</div>
                      {holdingPrices[h.symbol] ? (() => {
                        const rawPrice = holdingPrices[h.symbol];
                        const krwCurPrice = getKrwPrice(h.symbol, rawPrice);
                        const pnlPctVal = ((krwCurPrice - h.avgPrice) / h.avgPrice * 100);
                        const isKr = h.symbol.endsWith(".KS") || h.symbol.endsWith(".KQ");
                        return (
                          <>
                            <div className="text-[10px] text-foreground">
                              {isKr ? formatPrice(h.symbol, rawPrice) : `$${rawPrice.toFixed(2)}`}
                            </div>
                            {!isKr && (
                              <div className="text-[9px] text-muted-foreground/50">
                                ≈{Math.round(krwCurPrice).toLocaleString()}원
                              </div>
                            )}
                            <div className={`text-[10px] font-medium ${pnlPctVal >= 0 ? "text-up" : "text-down"}`}>
                              {pnlPctVal >= 0 ? "+" : ""}{pnlPctVal.toFixed(2)}%
                            </div>
                          </>
                        );
                      })() : (
                        <div className="text-[10px] text-muted-foreground/60">
                          avg {h.avgPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}원
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        {/* 최근 거래 내역 */}
        <Card className="bg-card border-border overflow-hidden">
          <div className="px-3 pt-3 pb-1">
            <div className="flex items-center gap-1.5 mb-2">
              <div className="w-1 h-3 rounded-full bg-accent" />
              <span className="text-[10px] font-mono text-muted-foreground tracking-wider">
                TRADE HISTORY
              </span>
              {portfolio.trades.length > 0 && (
                <span className="text-[9px] font-mono text-muted-foreground/40 ml-auto">
                  {portfolio.trades.length}건
                </span>
              )}
            </div>
          </div>
          <div className="px-3 pb-3">
            {portfolio.trades.length === 0 ? (
              <div className="text-[10px] font-mono text-muted-foreground/40 py-3 text-center border border-dashed border-border/50 rounded">
                거래 내역 없음
              </div>
            ) : (
              <div className="space-y-1.5">
                {portfolio.trades.slice(0, 8).map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center gap-2 text-xs font-mono py-1 px-2 -mx-2 rounded hover:bg-secondary/30 transition-colors"
                  >
                    <Badge
                      className={`text-[8px] h-[16px] px-1.5 shrink-0 font-bold ${
                        t.type === "BUY"
                          ? "bg-primary/10 text-up border-primary/20"
                          : "bg-destructive/10 text-down border-destructive/20"
                      }`}
                      variant="outline"
                    >
                      {t.type}
                    </Badge>
                    <div className="flex-1 min-w-0">
                      <span className="text-foreground">{t.symbol}</span>
                      <span className="text-muted-foreground/50 ml-1">{t.quantity}주</span>
                    </div>
                    <span className="text-muted-foreground/50 text-[10px] shrink-0">
                      {Math.round(t.total).toLocaleString()}
                    </span>
                  </div>
                ))}
                {portfolio.trades.length > 8 && (
                  <div className="text-[9px] font-mono text-muted-foreground/30 text-center pt-1">
                    +{portfolio.trades.length - 8}건 더
                  </div>
                )}
              </div>
            )}
          </div>
        </Card>

        {/* 자동매매 */}
        <Card className="bg-card border-border overflow-hidden">
          <div className="px-3 py-3">
            <AutoTradePanel />
          </div>
        </Card>

        {/* 관심종목 (실시간) */}
        <Card className="bg-card border-border overflow-hidden">
          <div className="px-3 pt-3 pb-1">
            <div className="flex items-center gap-1.5 mb-2">
              <div className="w-1 h-3 rounded-full bg-chart-4" />
              <span className="text-[10px] font-mono text-muted-foreground tracking-wider">
                WATCHLIST
              </span>
              <span className="text-[8px] font-mono text-muted-foreground/30 ml-auto">LIVE</span>
            </div>
          </div>
          <div className="px-3 pb-3">
            <div className="space-y-0.5">
              {watchlist.map((stock) => (
                <div
                  key={stock.symbol}
                  onClick={() => setChartSymbol(stock.symbol)}
                  className="flex items-center justify-between py-1.5 px-2 -mx-2 hover:bg-secondary/50 rounded cursor-pointer transition-all group"
                >
                  <div className="font-mono">
                    <div className="text-xs text-foreground font-medium group-hover:text-primary transition-colors">
                      {stock.name || getStockName(stock.symbol) || stock.symbol}
                    </div>
                    <div className="text-[10px] text-muted-foreground/60">{stock.symbol}</div>
                  </div>
                  <div className="text-right font-mono">
                    {stock.loading ? (
                      <div className="text-[10px] text-muted-foreground/30 animate-pulse">로딩...</div>
                    ) : (
                      <>
                        <div className="text-xs text-foreground">
                          {formatPrice(stock.symbol, stock.price)}
                        </div>
                        <div className={`text-[10px] font-medium ${stock.changePercent >= 0 ? "text-up" : "text-down"}`}>
                          {stock.changePercent >= 0 ? "+" : ""}{stock.changePercent.toFixed(2)}%
                        </div>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      {/* 모의투자 거래 모달 */}
      {tradeModal && (
        <TradeModal
          symbol={tradeModal.symbol}
          name={tradeModal.name}
          price={tradeModal.price}
          type={tradeModal.type}
          onClose={() => setTradeModal(null)}
          onComplete={handleTradeComplete}
        />
      )}

      {/* 실제 매매 모달 (Alpaca) */}
      {realTradeModal && (
        <RealTradeModal
          symbol={realTradeModal.symbol}
          name={realTradeModal.name}
          price={realTradeModal.price}
          side={realTradeModal.side}
          onClose={() => setRealTradeModal(null)}
          onComplete={handleRealTradeComplete}
        />
      )}
    </ScrollArea>
  );
}
