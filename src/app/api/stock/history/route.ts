import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// 타임프레임별 Yahoo Finance 설정
const TIMEFRAME_CONFIG: Record<string, { range: string; interval: string }> = {
  "1D": { range: "1d", interval: "5m" },
  "1W": { range: "5d", interval: "15m" },
  "1M": { range: "1mo", interval: "1d" },
  "3M": { range: "3mo", interval: "1d" },
  "1Y": { range: "1y", interval: "1wk" },
  "5Y": { range: "5y", interval: "1mo" },
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get("symbol");
  const timeframe = searchParams.get("timeframe") || "1M";

  if (!symbol) {
    return NextResponse.json(
      { error: "symbol 파라미터가 필요합니다." },
      { status: 400 }
    );
  }

  const upperSymbol = symbol.toUpperCase().trim();
  const config = TIMEFRAME_CONFIG[timeframe] || TIMEFRAME_CONFIG["1M"];

  try {
    const encoded = encodeURIComponent(upperSymbol);
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encoded}?interval=${config.interval}&range=${config.range}`;
    const res = await fetch(url, {
      cache: "no-store",
      headers: { "User-Agent": "Mozilla/5.0" },
    });

    if (!res.ok) {
      throw new Error(`Yahoo Finance API error: ${res.status}`);
    }

    const data = await res.json();
    const result = data?.chart?.result?.[0];
    if (!result) throw new Error("No chart data");

    const timestamps = result.timestamp || [];
    const quote = result.indicators?.quote?.[0] || {};
    const opens = quote.open || [];
    const highs = quote.high || [];
    const lows = quote.low || [];
    const closes = quote.close || [];
    const volumes = quote.volume || [];

    const quotes = timestamps
      .map((ts: number, i: number) => {
        const close = closes[i];
        if (close == null) return null;
        return {
          time: ts,
          date: new Date(ts * 1000).toISOString(),
          open: opens[i] ?? close,
          high: highs[i] ?? close,
          low: lows[i] ?? close,
          close,
          volume: volumes[i] ?? 0,
        };
      })
      .filter(Boolean);

    const firstClose = quotes.length > 0 ? quotes[0].close : 0;
    const lastClose = quotes.length > 0 ? quotes[quotes.length - 1].close : 0;
    const change = lastClose - firstClose;
    const changePercent = firstClose > 0 ? (change / firstClose) * 100 : 0;

    return NextResponse.json({
      symbol: upperSymbol,
      timeframe,
      quotes,
      change,
      changePercent,
      trend: change >= 0 ? "up" : "down",
    });
  } catch (error) {
    console.error(`히스토리 조회 실패 (${upperSymbol}):`, error);
    return NextResponse.json(
      { error: `주가 히스토리를 가져올 수 없습니다: ${upperSymbol}` },
      { status: 500 }
    );
  }
}
