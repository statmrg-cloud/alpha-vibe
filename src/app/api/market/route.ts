import { NextResponse } from "next/server";
import YahooFinance from "yahoo-finance2";

const yf = new YahooFinance();

// 주요 시장 지수 심볼
const INDEX_SYMBOLS = [
  { symbol: "^GSPC", name: "S&P 500" },
  { symbol: "^IXIC", name: "NASDAQ" },
  { symbol: "^KS11", name: "KOSPI" },
  { symbol: "^N225", name: "Nikkei 225" },
  { symbol: "BTC-USD", name: "BTC/USD" },
  { symbol: "EURUSD=X", name: "EUR/USD" },
  { symbol: "KRW=X", name: "USD/KRW" },
];

interface MarketIndexData {
  symbol: string;
  name: string;
  value: number;
  change: number;
  changePercent: number;
}

async function fetchIndex(idx: { symbol: string; name: string }): Promise<MarketIndexData> {
  try {
    const q = await yf.quote(idx.symbol);
    return {
      symbol: idx.symbol,
      name: idx.name,
      value: q.regularMarketPrice ?? 0,
      change: q.regularMarketChange ?? 0,
      changePercent: q.regularMarketChangePercent ?? 0,
    };
  } catch {
    return {
      symbol: idx.symbol,
      name: idx.name,
      value: 0,
      change: 0,
      changePercent: 0,
    };
  }
}

export async function GET() {
  try {
    const results = await Promise.all(INDEX_SYMBOLS.map(fetchIndex));

    return NextResponse.json({
      indices: results,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("시장 지수 조회 실패:", error);
    return NextResponse.json(
      { error: "시장 데이터를 가져올 수 없습니다." },
      { status: 500 }
    );
  }
}
