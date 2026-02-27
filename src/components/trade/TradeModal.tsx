"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePortfolioContext } from "@/contexts/PortfolioContext";

interface TradeModalProps {
  symbol: string;
  name: string;
  price: number;
  type: "BUY" | "SELL";
  onClose: () => void;
  onComplete: (message: string) => void;
}

export default function TradeModal({
  symbol,
  name,
  price,
  type,
  onClose,
  onComplete,
}: TradeModalProps) {
  const [quantity, setQuantity] = useState("");
  const [error, setError] = useState("");
  const [exchangeRate, setExchangeRate] = useState<number | null>(null);
  const { portfolio, executeBuy, executeSell, getHolding } =
    usePortfolioContext();

  const isKorean = symbol.endsWith(".KS") || symbol.endsWith(".KQ");

  // 미국 주식이면 환율 fetch
  useEffect(() => {
    if (!isKorean) {
      fetch("/api/exchange-rate")
        .then((res) => res.json())
        .then((data) => setExchangeRate(data.rate || 1350))
        .catch(() => setExchangeRate(1350));
    }
  }, [isKorean]);

  const qty = parseInt(quantity) || 0;

  // 미국 주식: USD 가격을 KRW로 환산
  const krwPrice = isKorean ? price : price * (exchangeRate || 1350);
  const total = krwPrice * qty;

  const holding = getHolding(symbol);
  const isBuy = type === "BUY";

  const fmtUsd = (v: number) =>
    `$${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const fmtKrw = (v: number) => `${Math.round(v).toLocaleString()}원`;

  const handleSubmit = () => {
    setError("");
    if (qty <= 0) {
      setError("1주 이상 입력하세요.");
      return;
    }

    try {
      if (isBuy) {
        // KRW 환산 가격으로 portfolio에 저장
        executeBuy(symbol, name, krwPrice, qty);
        const msg = isKorean
          ? `${name} (${symbol}) ${qty}주를 ${fmtKrw(price)}에 매수했습니다. 총 ${fmtKrw(total)}`
          : `${name} (${symbol}) ${qty}주를 ${fmtUsd(price)} (${fmtKrw(krwPrice)})에 매수했습니다. 총 ${fmtKrw(total)}`;
        onComplete(msg);
      } else {
        executeSell(symbol, name, krwPrice, qty);
        const profit = holding
          ? (krwPrice - holding.avgPrice) * qty
          : 0;
        const profitStr =
          profit >= 0
            ? `+${fmtKrw(profit)} 수익`
            : `${fmtKrw(Math.abs(profit))} 손실`;
        const msg = isKorean
          ? `${name} (${symbol}) ${qty}주를 ${fmtKrw(price)}에 매도했습니다. (${profitStr})`
          : `${name} (${symbol}) ${qty}주를 ${fmtUsd(price)} (${fmtKrw(krwPrice)})에 매도했습니다. (${profitStr})`;
        onComplete(msg);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "주문 실패");
    }
  };

  const maxQty = isBuy
    ? Math.floor(portfolio.cash / krwPrice)
    : holding?.quantity || 0;

  // 환율 로딩 중
  if (!isKorean && exchangeRate === null) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <div className="bg-card border border-border rounded-lg w-[360px] shadow-2xl p-6">
          <div className="text-center font-mono text-sm text-muted-foreground animate-pulse">
            환율 조회 중...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-lg w-[360px] shadow-2xl">
        {/* 헤더 */}
        <div
          className={`px-4 py-3 border-b border-border flex items-center justify-between ${
            isBuy ? "bg-primary/5" : "bg-destructive/5"
          }`}
        >
          <div className="flex items-center gap-2">
            <div
              className={`w-2 h-2 rounded-full ${
                isBuy ? "bg-primary" : "bg-destructive"
              }`}
            />
            <span className="font-mono text-sm font-bold text-foreground">
              {isBuy ? "즉시 매수" : "즉시 매도"}
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground text-lg leading-none"
          >
            x
          </button>
        </div>

        {/* 종목 정보 */}
        <div className="px-4 py-3 border-b border-border">
          <div className="font-mono">
            <span className="text-foreground text-sm font-bold">{symbol}</span>
            <span className="text-muted-foreground text-xs ml-2">{name}</span>
          </div>
          <div className="font-mono text-lg font-bold text-foreground mt-1">
            {isKorean ? fmtKrw(price) : fmtUsd(price)}
          </div>
          {!isKorean && exchangeRate && (
            <div className="font-mono text-xs text-muted-foreground mt-0.5">
              ≈ {fmtKrw(krwPrice)} (1 USD = {exchangeRate.toLocaleString(undefined, { maximumFractionDigits: 0 })}원)
            </div>
          )}
        </div>

        {/* 주문 입력 */}
        <div className="px-4 py-3 space-y-3">
          <div>
            <label className="text-[10px] font-mono text-muted-foreground block mb-1">
              주문 수량
            </label>
            <div className="flex gap-2">
              <Input
                type="number"
                min="1"
                max={maxQty}
                value={quantity}
                onChange={(e) => {
                  setQuantity(e.target.value);
                  setError("");
                }}
                placeholder="수량 입력"
                className="font-mono text-sm bg-secondary border-border h-9"
                autoFocus
              />
              <Button
                variant="outline"
                size="sm"
                className="font-mono text-[10px] h-9 px-2 shrink-0"
                onClick={() => setQuantity(String(maxQty))}
              >
                MAX
              </Button>
            </div>
            <div className="flex justify-between mt-1.5">
              {[10, 25, 50, 100].map((pct) => (
                <button
                  key={pct}
                  onClick={() =>
                    setQuantity(String(Math.floor((maxQty * pct) / 100)))
                  }
                  className="text-[10px] font-mono px-2 py-0.5 rounded border border-border text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors"
                >
                  {pct}%
                </button>
              ))}
            </div>
          </div>

          {/* 주문 요약 */}
          <div className="bg-secondary/50 rounded p-2.5 space-y-1 font-mono text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">주문 단가</span>
              <span className="text-foreground">
                {isKorean ? fmtKrw(price) : (
                  <span>{fmtUsd(price)} <span className="text-muted-foreground/60">({fmtKrw(krwPrice)})</span></span>
                )}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">주문 수량</span>
              <span className="text-foreground">{qty.toLocaleString()}주</span>
            </div>
            {!isKorean && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">적용 환율</span>
                <span className="text-foreground">1 USD = {(exchangeRate || 1350).toLocaleString(undefined, { maximumFractionDigits: 0 })}원</span>
              </div>
            )}
            <div className="flex justify-between border-t border-border pt-1 mt-1">
              <span className="text-muted-foreground font-bold">총 주문 금액</span>
              <span
                className={`font-bold ${isBuy ? "text-up" : "text-down"}`}
              >
                {fmtKrw(total)}
              </span>
            </div>
            {!isBuy && holding && qty > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">예상 손익</span>
                <span
                  className={
                    (krwPrice - holding.avgPrice) * qty >= 0
                      ? "text-up"
                      : "text-down"
                  }
                >
                  {((krwPrice - holding.avgPrice) * qty >= 0 ? "+" : "")}
                  {fmtKrw(Math.abs((krwPrice - holding.avgPrice) * qty))}
                </span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                {isBuy ? "주문 후 잔고" : "주문 후 현금"}
              </span>
              <span className="text-foreground">
                {isBuy
                  ? Math.round(portfolio.cash - total).toLocaleString()
                  : Math.round(portfolio.cash + total).toLocaleString()}
                원
              </span>
            </div>
          </div>

          {error && (
            <div className="text-destructive text-xs font-mono bg-destructive/10 rounded px-2 py-1.5">
              {error}
            </div>
          )}

          {/* 실행 버튼 */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1 font-mono text-xs h-9"
            >
              취소
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={qty <= 0}
              className={`flex-1 font-mono text-xs h-9 font-bold ${
                isBuy
                  ? "bg-primary hover:bg-primary/90 text-primary-foreground"
                  : "bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              }`}
            >
              {isBuy ? "매수 확인" : "매도 확인"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
