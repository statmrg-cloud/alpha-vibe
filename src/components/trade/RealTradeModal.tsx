"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface RealTradeModalProps {
  symbol: string;
  name: string;
  price: number;
  side: "buy" | "sell";
  onClose: () => void;
  onComplete: (message: string) => void;
}

type OrderType = "market" | "limit";
type Step = "input" | "confirm" | "executing" | "result";

export default function RealTradeModal({
  symbol,
  name,
  price,
  side,
  onClose,
  onComplete,
}: RealTradeModalProps) {
  const [step, setStep] = useState<Step>("input");
  const [quantity, setQuantity] = useState("");
  const [orderType, setOrderType] = useState<OrderType>("market");
  const [limitPrice, setLimitPrice] = useState(price.toFixed(2));
  const [error, setError] = useState("");
  const [result, setResult] = useState<Record<string, unknown> | null>(null);

  const qty = parseInt(quantity) || 0;
  const isBuy = side === "buy";
  const effectivePrice = orderType === "limit" ? parseFloat(limitPrice) || price : price;
  const total = effectivePrice * qty;

  const isKoreanStock = symbol.endsWith(".KS") || symbol.endsWith(".KQ");

  const handleProceedToConfirm = () => {
    setError("");
    if (isKoreanStock) {
      setError("Alpaca는 미국 주식만 지원합니다. 한국 주식은 모의투자(Paper Trade)를 이용하세요.");
      return;
    }
    if (qty <= 0) {
      setError("1주 이상 입력하세요.");
      return;
    }
    if (orderType === "limit" && (!parseFloat(limitPrice) || parseFloat(limitPrice) <= 0)) {
      setError("유효한 지정가를 입력하세요.");
      return;
    }
    setStep("confirm");
  };

  const handleExecuteOrder = async () => {
    setStep("executing");
    setError("");

    try {
      const res = await fetch("/api/trade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol: symbol.toUpperCase(),
          qty,
          side,
          type: orderType,
          time_in_force: "day",
          limit_price: orderType === "limit" ? parseFloat(limitPrice) : undefined,
          confirmed: true,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error + (data.alpacaError ? `: ${data.alpacaError}` : ""));
        setStep("confirm");
        return;
      }

      setResult(data.order);
      setStep("result");
    } catch (err) {
      setError(err instanceof Error ? err.message : "주문 실행 실패");
      setStep("confirm");
    }
  };

  const handleDone = () => {
    const typeLabel = orderType === "market" ? "시장가" : `지정가($${limitPrice})`;
    const sideLabel = isBuy ? "매수" : "매도";
    onComplete(
      `[실제 주문 체결] ${symbol} ${qty}주 ${sideLabel} (${typeLabel}) — 주문 ID: ${(result as Record<string, unknown>)?.id || "N/A"}`
    );
    // Alpaca 계좌 패널에 즉시 새로고침 신호 전달
    window.dispatchEvent(new CustomEvent("alpaca-trade-complete"));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-lg w-[400px] shadow-2xl overflow-hidden">
        {/* 헤더 — 실거래 경고 */}
        <div className={`px-4 py-3 border-b border-border ${isBuy ? "bg-primary/5" : "bg-destructive/5"}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full animate-pulse ${isBuy ? "bg-primary" : "bg-destructive"}`} />
              <span className="font-mono text-sm font-bold text-foreground">
                {isBuy ? "REAL BUY" : "REAL SELL"}
              </span>
              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-chart-4/15 text-chart-4 border border-chart-4/30">
                PAPER
              </span>
            </div>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-lg leading-none">
              x
            </button>
          </div>
          {step !== "result" && (
            <div className="mt-1.5 text-[9px] font-mono text-chart-4/80">
              Alpaca Paper Trading API - 실제 시장 시뮬레이션
            </div>
          )}
        </div>

        {/* Step 1: 주문 입력 */}
        {step === "input" && (
          <div className="px-4 py-3 space-y-3">
            {/* 종목 정보 */}
            <div className="bg-secondary/50 rounded-lg p-3">
              <div className="font-mono">
                <span className="text-foreground text-sm font-bold">{symbol}</span>
                <span className="text-muted-foreground text-xs ml-2">{name}</span>
              </div>
              <div className="font-mono text-lg font-bold text-foreground mt-1">
                ${price.toFixed(2)}
              </div>
            </div>

            {/* 주문 유형 */}
            <div>
              <label className="text-[10px] font-mono text-muted-foreground block mb-1">주문 유형</label>
              <div className="flex gap-2">
                {(["market", "limit"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setOrderType(t)}
                    className={`flex-1 text-xs font-mono py-1.5 rounded border transition-all ${
                      orderType === t
                        ? "border-primary/40 bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:border-border/80"
                    }`}
                  >
                    {t === "market" ? "시장가" : "지정가"}
                  </button>
                ))}
              </div>
            </div>

            {/* 지정가 입력 */}
            {orderType === "limit" && (
              <div>
                <label className="text-[10px] font-mono text-muted-foreground block mb-1">지정가 (USD)</label>
                <Input
                  type="number"
                  step="0.01"
                  value={limitPrice}
                  onChange={(e) => setLimitPrice(e.target.value)}
                  className="font-mono text-sm bg-secondary border-border h-9"
                />
              </div>
            )}

            {/* 수량 */}
            <div>
              <label className="text-[10px] font-mono text-muted-foreground block mb-1">수량 (주)</label>
              <Input
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => {
                  setQuantity(e.target.value);
                  setError("");
                }}
                placeholder="수량 입력"
                className="font-mono text-sm bg-secondary border-border h-9"
                autoFocus
              />
              <div className="flex gap-1 mt-1.5">
                {[1, 5, 10, 25, 50].map((n) => (
                  <button
                    key={n}
                    onClick={() => setQuantity(String(n))}
                    className="text-[9px] font-mono px-2 py-0.5 rounded border border-border text-muted-foreground hover:text-primary hover:border-primary/30 transition-all"
                  >
                    {n}주
                  </button>
                ))}
              </div>
            </div>

            {/* 주문 요약 */}
            <div className="bg-secondary/50 rounded p-2.5 space-y-1 font-mono text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">예상 금액</span>
                <span className={`font-bold ${isBuy ? "text-up" : "text-down"}`}>
                  ${total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {error && (
              <div className="text-destructive text-xs font-mono bg-destructive/10 rounded px-2 py-1.5">{error}</div>
            )}

            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose} className="flex-1 font-mono text-xs h-9">
                취소
              </Button>
              <Button
                onClick={handleProceedToConfirm}
                disabled={qty <= 0}
                className={`flex-1 font-mono text-xs h-9 font-bold ${
                  isBuy
                    ? "bg-primary hover:bg-primary/90 text-primary-foreground"
                    : "bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                }`}
              >
                주문 확인
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: 최종 확인 */}
        {step === "confirm" && (
          <div className="px-4 py-3 space-y-3">
            <div className="bg-chart-4/5 border border-chart-4/20 rounded-lg p-3 text-center">
              <div className="text-chart-4 font-mono text-xs font-bold mb-2">
                FINAL CONFIRMATION
              </div>
              <div className="text-foreground font-mono text-sm">
                <span className="font-bold">{symbol}</span>을(를)
              </div>
              <div className={`font-mono text-2xl font-bold my-2 ${isBuy ? "text-up" : "text-down"}`}>
                {qty}주 {isBuy ? "매수" : "매도"}
              </div>
              <div className="text-muted-foreground font-mono text-xs">
                {orderType === "market" ? "시장가" : `지정가 $${limitPrice}`} | Day Order
              </div>
              <div className="text-foreground font-mono text-sm font-bold mt-1">
                예상 금액: ${total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>

            <div className="bg-destructive/5 border border-destructive/20 rounded p-2 text-[10px] font-mono text-destructive/80 text-center">
              이 주문은 Alpaca Paper Trading을 통해 실행됩니다.
              실제 자금이 이동하지는 않지만, 실제 시장 데이터 기반으로 체결됩니다.
            </div>

            {error && (
              <div className="text-destructive text-xs font-mono bg-destructive/10 rounded px-2 py-1.5">{error}</div>
            )}

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep("input")} className="flex-1 font-mono text-xs h-9">
                뒤로
              </Button>
              <Button
                onClick={handleExecuteOrder}
                className={`flex-1 font-mono text-xs h-10 font-bold tracking-wider ${
                  isBuy
                    ? "bg-primary hover:bg-primary/90 text-primary-foreground"
                    : "bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                }`}
              >
                {isBuy ? "최종 매수 실행" : "최종 매도 실행"}
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: 실행 중 */}
        {step === "executing" && (
          <div className="px-4 py-8 flex flex-col items-center gap-3">
            <div className="flex gap-1.5">
              <div className="w-2 h-2 rounded-full bg-primary animate-bounce [animation-delay:0ms]" />
              <div className="w-2 h-2 rounded-full bg-primary animate-bounce [animation-delay:150ms]" />
              <div className="w-2 h-2 rounded-full bg-primary animate-bounce [animation-delay:300ms]" />
            </div>
            <div className="font-mono text-xs text-muted-foreground">
              Alpaca API로 주문 전송 중...
            </div>
          </div>
        )}

        {/* Step 4: 결과 */}
        {step === "result" && result && (
          <div className="px-4 py-3 space-y-3">
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 text-center">
              <div className="text-primary font-mono text-sm font-bold mb-1">
                ORDER SUBMITTED
              </div>
              <div className="text-foreground font-mono text-xs">
                {symbol} {qty}주 {isBuy ? "매수" : "매도"} 주문이 접수되었습니다
              </div>
            </div>

            <div className="bg-secondary/50 rounded p-2.5 space-y-1 font-mono text-[10px]">
              <div className="flex justify-between">
                <span className="text-muted-foreground">주문 ID</span>
                <span className="text-foreground truncate ml-2 max-w-[180px]">{String(result.id)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">상태</span>
                <span className="text-chart-4">{String(result.status)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">유형</span>
                <span className="text-foreground">{String(result.type)} / {String(result.timeInForce)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">수량</span>
                <span className="text-foreground">{String(result.qty)}주</span>
              </div>
            </div>

            <Button
              onClick={handleDone}
              className="w-full font-mono text-xs h-9 bg-primary hover:bg-primary/90 text-primary-foreground font-bold"
            >
              확인
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
