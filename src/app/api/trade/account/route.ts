import { NextResponse } from "next/server";

/**
 * Alpaca Account API — 계좌 정보 조회 (서버 사이드 전용)
 * GET /v2/account
 */

export const dynamic = "force-dynamic";

const ALPACA_API_KEY = process.env.ALPACA_API_KEY || "";
const ALPACA_API_SECRET = process.env.ALPACA_API_SECRET || "";
const ALPACA_TRADING_URL =
  process.env.ALPACA_TRADING_URL || "https://paper-api.alpaca.markets";

export async function GET() {
  if (!ALPACA_API_KEY || !ALPACA_API_SECRET) {
    return NextResponse.json(
      { error: "Alpaca API 키가 설정되지 않았습니다." },
      { status: 500 }
    );
  }

  try {
    const res = await fetch(`${ALPACA_TRADING_URL}/v2/account`, {
      headers: {
        "APCA-API-KEY-ID": ALPACA_API_KEY,
        "APCA-API-SECRET-KEY": ALPACA_API_SECRET,
      },
      cache: "no-store",
    });

    if (!res.ok) {
      const err = await res.json();
      return NextResponse.json(
        { error: "계좌 조회 실패", alpacaError: err.message || err },
        { status: res.status }
      );
    }

    const data = await res.json();

    return NextResponse.json({
      id: data.id,
      status: data.status,
      currency: data.currency,
      cash: parseFloat(data.cash),
      portfolioValue: parseFloat(data.portfolio_value),
      buyingPower: parseFloat(data.buying_power),
      equity: parseFloat(data.equity),
      lastEquity: parseFloat(data.last_equity),
      longMarketValue: parseFloat(data.long_market_value),
      shortMarketValue: parseFloat(data.short_market_value),
      daytradeCount: data.daytrade_count,
      tradingBlocked: data.trading_blocked,
      accountBlocked: data.account_blocked,
      patternDayTrader: data.pattern_day_trader,
      isPaper: ALPACA_TRADING_URL.includes("paper"),
    });
  } catch (error) {
    return NextResponse.json(
      { error: `계좌 조회 오류: ${error instanceof Error ? error.message : "알 수 없는 오류"}` },
      { status: 500 }
    );
  }
}
