"use client";

import { useState, useEffect, useCallback } from "react";
import type { Portfolio, Trade, Holding } from "@/types";

const STORAGE_KEY = "alpha-vibe-portfolio";
const INITIAL_CASH = 100_000_000; // 1억원 시작 자금

function getInitialPortfolio(): Portfolio {
  return { cash: INITIAL_CASH, holdings: [], trades: [] };
}

function loadPortfolio(): Portfolio {
  if (typeof window === "undefined") return getInitialPortfolio();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return getInitialPortfolio();
    return JSON.parse(raw) as Portfolio;
  } catch {
    return getInitialPortfolio();
  }
}

function savePortfolio(portfolio: Portfolio) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(portfolio));
}

export function usePortfolio() {
  const [portfolio, setPortfolio] = useState<Portfolio>(getInitialPortfolio);
  const [isLoaded, setIsLoaded] = useState(false);

  // 클라이언트에서만 localStorage 로드
  useEffect(() => {
    setPortfolio(loadPortfolio());
    setIsLoaded(true);
  }, []);

  // 상태 변경 시 localStorage에 저장
  useEffect(() => {
    if (isLoaded) {
      savePortfolio(portfolio);
    }
  }, [portfolio, isLoaded]);

  const executeBuy = useCallback(
    (symbol: string, name: string, price: number, quantity: number) => {
      const total = price * quantity;

      setPortfolio((prev) => {
        if (total > prev.cash) {
          throw new Error(
            `잔고 부족: 필요 ${total.toLocaleString()}원, 보유 현금 ${prev.cash.toLocaleString()}원`
          );
        }

        // 기존 보유 종목 업데이트 또는 신규 추가
        const existingIdx = prev.holdings.findIndex(
          (h) => h.symbol === symbol
        );
        const newHoldings: Holding[] = [...prev.holdings];

        if (existingIdx >= 0) {
          const existing = newHoldings[existingIdx];
          const newQty = existing.quantity + quantity;
          const newTotalInvested = existing.totalInvested + total;
          newHoldings[existingIdx] = {
            ...existing,
            quantity: newQty,
            avgPrice: newTotalInvested / newQty,
            totalInvested: newTotalInvested,
          };
        } else {
          newHoldings.push({
            symbol,
            name,
            quantity,
            avgPrice: price,
            totalInvested: total,
          });
        }

        const trade: Trade = {
          id: Date.now().toString(),
          symbol,
          name,
          type: "BUY",
          quantity,
          price,
          total,
          timestamp: new Date().toISOString(),
        };

        return {
          cash: prev.cash - total,
          holdings: newHoldings,
          trades: [trade, ...prev.trades],
        };
      });
    },
    []
  );

  const executeSell = useCallback(
    (symbol: string, name: string, price: number, quantity: number) => {
      setPortfolio((prev) => {
        const existingIdx = prev.holdings.findIndex(
          (h) => h.symbol === symbol
        );
        if (existingIdx < 0) {
          throw new Error(`보유하지 않은 종목: ${symbol}`);
        }

        const existing = prev.holdings[existingIdx];
        if (quantity > existing.quantity) {
          throw new Error(
            `보유 수량 초과: 보유 ${existing.quantity}주, 매도 요청 ${quantity}주`
          );
        }

        const total = price * quantity;
        const newHoldings: Holding[] = [...prev.holdings];

        if (quantity === existing.quantity) {
          // 전량 매도
          newHoldings.splice(existingIdx, 1);
        } else {
          // 부분 매도
          const newQty = existing.quantity - quantity;
          const soldRatio = quantity / existing.quantity;
          const remainingInvested =
            existing.totalInvested * (1 - soldRatio);
          newHoldings[existingIdx] = {
            ...existing,
            quantity: newQty,
            totalInvested: remainingInvested,
            avgPrice: remainingInvested / newQty,
          };
        }

        const trade: Trade = {
          id: Date.now().toString(),
          symbol,
          name,
          type: "SELL",
          quantity,
          price,
          total,
          timestamp: new Date().toISOString(),
        };

        return {
          cash: prev.cash + total,
          holdings: newHoldings,
          trades: [trade, ...prev.trades],
        };
      });
    },
    []
  );

  const resetPortfolio = useCallback(() => {
    const initial = getInitialPortfolio();
    setPortfolio(initial);
    savePortfolio(initial);
  }, []);

  const getHolding = useCallback(
    (symbol: string): Holding | undefined => {
      return portfolio.holdings.find((h) => h.symbol === symbol);
    },
    [portfolio.holdings]
  );

  // 총 평가액 계산 (현재가 필요 — 외부에서 제공)
  const getTotalValue = useCallback(
    (currentPrices: Record<string, number>) => {
      const holdingsValue = portfolio.holdings.reduce((sum, h) => {
        const curPrice = currentPrices[h.symbol] || h.avgPrice;
        return sum + curPrice * h.quantity;
      }, 0);
      return portfolio.cash + holdingsValue;
    },
    [portfolio]
  );

  return {
    portfolio,
    isLoaded,
    executeBuy,
    executeSell,
    resetPortfolio,
    getHolding,
    getTotalValue,
  };
}
