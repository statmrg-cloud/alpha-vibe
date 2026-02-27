import { NextResponse } from "next/server";

/**
 * Alpaca Positions API — 보유 포지션 조회 (서버 사이드 전용)
 * GET /v2/positions
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
    const res = await fetch(`${ALPACA_TRADING_URL}/v2/positions`, {
      headers: {
        "APCA-API-KEY-ID": ALPACA_API_KEY,
        "APCA-API-SECRET-KEY": ALPACA_API_SECRET,
      },
      cache: "no-store",
    });

    if (!res.ok) {
      const err = await res.json();
      return NextResponse.json(
        { error: "포지션 조회 실패", alpacaError: err.message || err },
        { status: res.status }
      );
    }

    const data = await res.json();

    const positions = data.map(
      (p: Record<string, string>) => ({
        symbol: p.symbol,
        qty: parseFloat(p.qty),
        side: p.side,
        avgEntryPrice: parseFloat(p.avg_entry_price),
        marketValue: parseFloat(p.market_value),
        currentPrice: parseFloat(p.current_price),
        unrealizedPl: parseFloat(p.unrealized_pl),
        unrealizedPlpc: parseFloat(p.unrealized_plpc),
        changeToday: parseFloat(p.change_today),
      })
    );

    return NextResponse.json({ positions });
  } catch (error) {
    return NextResponse.json(
      { error: `포지션 조회 오류: ${error instanceof Error ? error.message : "알 수 없는 오류"}` },
      { status: 500 }
    );
  }
}
