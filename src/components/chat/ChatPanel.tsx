"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChatMessage } from "@/types";
import TradeModal from "@/components/trade/TradeModal";
import RealTradeModal from "@/components/trade/RealTradeModal";

interface ExtendedChatMessage extends ChatMessage {
  symbols?: string[];
  symbolNames?: Record<string, string>;
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

const INITIAL_MESSAGE_CONTENT =
  "안녕하세요! Alpha-Vibe AI 투자 에이전트입니다.\n월가 20년 경력의 헤지펀드 전략가가 종목 분석, 포트폴리오 추천, 시장 동향을 분석해드립니다.\n\n종목명이나 티커를 포함해 질문해보세요.";

const QUICK_QUESTIONS = [
  "오늘 시장 요약해줘",
  "삼성전자 분석해줘",
  "AAPL 투자 분석",
  "NVDA vs TSLA 비교",
];

export default function ChatPanel() {
  const [messages, setMessages] = useState<ExtendedChatMessage[]>(() => [
    {
      id: "1",
      role: "assistant",
      content: INITIAL_MESSAGE_CONTENT,
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [tradeModal, setTradeModal] = useState<TradeModalState | null>(null);
  const [realTradeModal, setRealTradeModal] = useState<RealTradeModalState | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // DataPanel에서 거래 완료 메시지 수신
  useEffect(() => {
    const handleTradeMessage = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.message) {
        const tradeMsg: ExtendedChatMessage = {
          id: Date.now().toString(),
          role: "system",
          content: detail.message,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, tradeMsg]);
      }
    };
    window.addEventListener("trade-complete-message", handleTradeMessage);
    return () => window.removeEventListener("trade-complete-message", handleTradeMessage);
  }, []);

  const fetchCurrentPrice = useCallback(async (symbol: string) => {
    try {
      const res = await fetch(`/api/stock?symbol=${encodeURIComponent(symbol)}`);
      if (!res.ok) return null;
      const data = await res.json();
      return { symbol: data.symbol, name: data.name, price: data.price };
    } catch {
      return null;
    }
  }, []);

  const handleTrade = useCallback(
    async (symbol: string, type: "BUY" | "SELL") => {
      const data = await fetchCurrentPrice(symbol);
      if (!data) {
        alert(`${symbol} 시세를 가져올 수 없습니다.`);
        return;
      }
      setTradeModal({ symbol: data.symbol, name: data.name, price: data.price, type });
    },
    [fetchCurrentPrice]
  );

  const handleTradeComplete = useCallback((message: string) => {
    setTradeModal(null);
    const tradeMsg: ExtendedChatMessage = {
      id: Date.now().toString(),
      role: "system",
      content: message,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, tradeMsg]);
  }, []);

  const handleRealTrade = useCallback(
    async (symbol: string, side: "buy" | "sell") => {
      const data = await fetchCurrentPrice(symbol);
      if (!data) {
        alert(`${symbol} 시세를 가져올 수 없습니다.`);
        return;
      }
      setRealTradeModal({ symbol: data.symbol, name: data.name, price: data.price, side });
    },
    [fetchCurrentPrice]
  );

  const handleRealTradeComplete = useCallback((message: string) => {
    setRealTradeModal(null);
    const tradeMsg: ExtendedChatMessage = {
      id: Date.now().toString(),
      role: "system",
      content: message,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, tradeMsg]);
  }, []);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userContent = input.trim();
    const userMsg: ExtendedChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: userContent,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    try {
      const history = messages
        .filter((m) => m.id !== "1" && m.role !== "system")
        .slice(-10)
        .map((m) => ({ role: m.role, content: m.content }));

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userContent, history }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "API 오류가 발생했습니다.");
      }

      const symbols = data.symbols || [];
      const symbolNames = data.symbolNames || {};
      const aiMsg: ExtendedChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.message,
        timestamp: new Date(),
        symbols,
        symbolNames,
      };
      setMessages((prev) => [...prev, aiMsg]);

      // 첫 번째 종목을 오른쪽 차트에 연동
      if (symbols.length > 0) {
        window.dispatchEvent(new CustomEvent("chart-symbol-change", { detail: { symbol: symbols[0] } }));
      }
    } catch (error) {
      const errorMsg: ExtendedChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: `⚠️ 오류: ${error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다."}\n\n.env.local에 ANTHROPIC_API_KEY가 올바르게 설정되어 있는지 확인해주세요.`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* 채팅 헤더 */}
      <div className="h-10 border-b border-border/50 flex items-center px-4 shrink-0 bg-card/30">
        <div className="flex items-center gap-1.5">
          <div className="w-1 h-3 rounded-full bg-accent" />
          <span className="text-[11px] font-mono text-foreground/80 tracking-wider font-medium">
            AI TERMINAL
          </span>
        </div>
        <div className="w-px h-3.5 bg-border/30 mx-3" />
        <span className="text-[9px] font-mono text-muted-foreground/50 tracking-wide">
          Claude Sonnet 4 | Hedge Fund Strategist
        </span>
        <div className="ml-auto flex gap-1.5">
          <div className="w-2 h-2 rounded-full bg-primary/50" />
          <div className="w-2 h-2 rounded-full bg-chart-4/50" />
          <div className="w-2 h-2 rounded-full bg-destructive/50" />
        </div>
      </div>

      {/* 메시지 영역 */}
      <ScrollArea className="flex-1 px-4 py-3" ref={scrollRef}>
        <div className="space-y-4">
          {messages.map((msg) => (
            <div key={msg.id}>
              {msg.role === "system" ? (
                <div className="flex justify-center">
                  <div className="bg-chart-4/10 border border-chart-4/30 rounded-lg px-4 py-2 text-xs font-mono text-chart-4 max-w-[90%] text-center">
                    {msg.content}
                  </div>
                </div>
              ) : (
                <div className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[85%] rounded-lg px-3.5 py-2.5 text-sm leading-relaxed ${
                      msg.role === "user"
                        ? "bg-primary/10 text-foreground border border-primary/15 rounded-br-sm"
                        : "bg-secondary/80 text-foreground border border-border/50 rounded-bl-sm"
                    }`}
                  >
                    {msg.role === "assistant" && (
                      <div className="flex items-center gap-1.5 mb-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                        <span className="text-[9px] font-mono text-primary/80 tracking-widest font-medium">ALPHA-VIBE</span>
                      </div>
                    )}
                    <p className="whitespace-pre-wrap font-mono text-xs leading-relaxed">{msg.content}</p>
                    <span className="text-[9px] text-muted-foreground/40 mt-1.5 block font-mono" suppressHydrationWarning>
                      {new Date(msg.timestamp).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}
                    </span>

                    {/* 매매 버튼 */}
                    {msg.role === "assistant" && msg.symbols && msg.symbols.length > 0 && (
                      <div className="mt-3 pt-2.5 border-t border-border/50 space-y-3">
                        {/* 모의 투자 */}
                        <div className="space-y-1.5">
                          <span className="text-[9px] font-mono text-muted-foreground/60 block tracking-wider">
                            PAPER TRADE (모의투자)
                          </span>
                          {msg.symbols.map((sym) => {
                            const isKR = sym.endsWith(".KS") || sym.endsWith(".KQ");
                            const displayName = msg.symbolNames?.[sym] || "";
                            return (
                            <div key={`paper-${sym}`} className="flex items-center gap-1.5">
                              <span className="text-[11px] font-mono text-primary font-bold min-w-[55px]">{sym}</span>
                              {displayName && (
                                <span className={`text-[10px] font-mono font-medium ${isKR ? "text-yellow-400" : "text-sky-400"}`}>{displayName}</span>
                              )}
                              <Button
                                size="sm"
                                onClick={() => handleTrade(sym, "BUY")}
                                className="h-5 px-2 text-[9px] font-mono font-bold bg-primary/10 text-up border border-primary/20 hover:bg-primary/20"
                                variant="outline"
                              >
                                매수
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => handleTrade(sym, "SELL")}
                                className="h-5 px-2 text-[9px] font-mono font-bold bg-destructive/10 text-down border border-destructive/20 hover:bg-destructive/20"
                                variant="outline"
                              >
                                매도
                              </Button>
                            </div>
                          );
                          })}
                        </div>
                        {/* 실제 매매 (Alpaca) — US 주식만 */}
                        {msg.symbols.some((sym) => !sym.endsWith(".KS") && !sym.endsWith(".KQ")) && (
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[9px] font-mono text-chart-4/70 block tracking-wider">
                              REAL TRADE (Alpaca)
                            </span>
                            <span className="text-[8px] font-mono px-1 py-0.5 rounded bg-chart-4/10 text-chart-4/60 border border-chart-4/20">
                              PAPER
                            </span>
                          </div>
                          {msg.symbols.filter((sym) => !sym.endsWith(".KS") && !sym.endsWith(".KQ")).map((sym) => {
                            const displayName = msg.symbolNames?.[sym] || "";
                            return (
                            <div key={`real-${sym}`} className="flex items-center gap-1.5">
                              <span className="text-[11px] font-mono text-primary font-bold min-w-[55px]">{sym}</span>
                              {displayName && (
                                <span className="text-[10px] font-mono font-medium text-sky-400">{displayName}</span>
                              )}
                              <Button
                                size="sm"
                                onClick={() => handleRealTrade(sym, "buy")}
                                className="h-5 px-2 text-[9px] font-mono font-bold bg-chart-4/10 text-chart-4 border border-chart-4/20 hover:bg-chart-4/20"
                                variant="outline"
                              >
                                실매수
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => handleRealTrade(sym, "sell")}
                                className="h-5 px-2 text-[9px] font-mono font-bold bg-chart-4/10 text-chart-4 border border-chart-4/20 hover:bg-chart-4/20"
                                variant="outline"
                              >
                                실매도
                              </Button>
                            </div>
                          );
                          })}
                        </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-secondary border border-border rounded-lg px-3.5 py-2.5">
                <div className="flex items-center gap-1.5 mb-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                  <span className="text-[10px] font-mono text-primary tracking-wider">ALPHA-VIBE</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce [animation-delay:0ms]" />
                    <div className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce [animation-delay:150ms]" />
                    <div className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce [animation-delay:300ms]" />
                  </div>
                  <span className="text-[10px] font-mono text-muted-foreground">데이터 조회 및 AI 분석 중...</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* 입력 영역 */}
      <div className="border-t border-border/50 p-3 shrink-0 bg-card/20">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-primary/60 font-mono text-xs">
              &gt;
            </span>
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder="종목, 시장 분석, 투자 전략을 질문하세요..."
              className="pl-7 bg-secondary/60 border-border/50 text-foreground font-mono text-xs h-9 placeholder:text-muted-foreground/30 focus-visible:ring-primary/20 focus-visible:border-primary/30 transition-colors"
              disabled={isLoading}
            />
          </div>
          <Button
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            size="sm"
            className="bg-primary/90 hover:bg-primary text-primary-foreground font-mono text-[10px] h-9 px-5 tracking-wider font-bold transition-all"
          >
            SEND
          </Button>
        </div>
        <div className="flex gap-1.5 mt-2 flex-wrap">
          {QUICK_QUESTIONS.map((q) => (
            <button
              key={q}
              onClick={() => setInput(q)}
              className="text-[9px] font-mono px-2.5 py-1 rounded-md border border-border/40 text-muted-foreground/50 hover:text-primary hover:border-primary/30 hover:bg-primary/5 transition-all"
              disabled={isLoading}
            >
              {q}
            </button>
          ))}
        </div>
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
    </div>
  );
}
