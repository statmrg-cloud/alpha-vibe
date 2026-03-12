import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// 타임프레임별 Yahoo Finance 설정 (3배 확장 로딩 → 드래그로 과거 데이터 탐색 가능)
const TIMEFRAME_CONFIG: Record<string, { range: string; interval: string }> = {
  "1m": { range: "3d", interval: "1m" },
  "30m": { range: "1mo", interval: "30m" },
  "60m": { range: "1mo", interval: "60m" },
  "1D": { range: "3d", interval: "5m" },
  "1W": { range: "1mo", interval: "15m" },
  "1M": { range: "3mo", interval: "1d" },
  "3M": { range: "1y", interval: "1d" },
  "1Y": { range: "3y", interval: "1wk" },
  "5Y": { range: "max", interval: "1mo" },
  "sma200": { range: "2y", interval: "1d" },  // SMA200 계산용 일봉 2년치 (~500 거래일)
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

  let upperSymbol = symbol.toUpperCase().trim();
  const config = TIMEFRAME_CONFIG[timeframe] || TIMEFRAME_CONFIG["1M"];

  // 한글 심볼이 들어오면 네이버 자동완성으로 종목코드 변환
  if (/[가-힣]/.test(upperSymbol)) {
    try {
      const acUrl = `https://ac.stock.naver.com/ac?q=${encodeURIComponent(symbol.trim())}&target=stock`;
      const acRes = await fetch(acUrl, {
        headers: { "User-Agent": "Mozilla/5.0" },
        cache: "no-store",
      });
      if (acRes.ok) {
        const acData = await acRes.json();
        const first = acData?.items?.find(
          (item: Record<string, string>) => item.nationCode === "KOR" && item.category === "stock"
        );
        if (first?.code) {
          const ext = first.typeCode === "KOSDAQ" ? "KQ" : "KS";
          upperSymbol = `${first.code}.${ext}`;
        }
      }
    } catch { /* fallback to original */ }
  }

  try {
    const encoded = encodeURIComponent(upperSymbol);
    const url = `https://query2.finance.yahoo.com/v8/finance/chart/${encoded}?interval=${config.interval}&range=${config.range}`;
    const res = await fetch(url, {
      cache: "no-store",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        "Origin": "https://finance.yahoo.com",
        "Referer": "https://finance.yahoo.com/",
      },
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
