import { NextRequest, NextResponse } from "next/server";
import YahooFinance from "yahoo-finance2";

const yf = new YahooFinance();

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get("symbol");

  if (!symbol) {
    return NextResponse.json(
      { error: "symbol 파라미터가 필요합니다." },
      { status: 400 }
    );
  }

  const upperSymbol = symbol.toUpperCase().trim();

  try {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 10); // 주말 고려하여 10일 전부터

    const result = await yf.chart(upperSymbol, {
      period1: startDate,
      period2: endDate,
      interval: "1d",
    });

    const quotes = result.quotes
      .filter((q) => q.close != null)
      .slice(-7) // 최근 7거래일
      .map((q) => ({
        date: new Date(q.date).toISOString().split("T")[0],
        open: q.open ?? 0,
        high: q.high ?? 0,
        low: q.low ?? 0,
        close: q.close ?? 0,
        volume: q.volume ?? 0,
      }));

    const firstClose = quotes.length > 0 ? quotes[0].close : 0;
    const lastClose = quotes.length > 0 ? quotes[quotes.length - 1].close : 0;
    const change = lastClose - firstClose;
    const changePercent = firstClose > 0 ? (change / firstClose) * 100 : 0;

    return NextResponse.json({
      symbol: upperSymbol,
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
