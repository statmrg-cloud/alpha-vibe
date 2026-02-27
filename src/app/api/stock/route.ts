import { NextRequest, NextResponse } from "next/server";
import YahooFinance from "yahoo-finance2";

const yf = new YahooFinance();

const ALPACA_API_KEY = process.env.ALPACA_API_KEY || "";
const ALPACA_API_SECRET = process.env.ALPACA_API_SECRET || "";
const ALPACA_BASE_URL = process.env.ALPACA_BASE_URL || "https://data.alpaca.markets";

interface StockResponse {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  open: number;
  high: number;
  low: number;
  previousClose: number;
  volume: number;
  marketCap: number | null;
  pe: number | null;
  eps: number | null;
  week52High: number | null;
  week52Low: number | null;
  dividendYield: number | null;
  source: "yahoo" | "alpaca";
}

// Yahoo Finance로 종목 데이터 가져오기
async function fetchFromYahoo(symbol: string): Promise<StockResponse> {
  const quote = await yf.quote(symbol);

  return {
    symbol: quote.symbol,
    name: quote.shortName || quote.longName || symbol,
    price: quote.regularMarketPrice ?? 0,
    change: quote.regularMarketChange ?? 0,
    changePercent: quote.regularMarketChangePercent ?? 0,
    open: quote.regularMarketOpen ?? 0,
    high: quote.regularMarketDayHigh ?? 0,
    low: quote.regularMarketDayLow ?? 0,
    previousClose: quote.regularMarketPreviousClose ?? 0,
    volume: quote.regularMarketVolume ?? 0,
    marketCap: quote.marketCap ?? null,
    pe: quote.trailingPE ?? null,
    eps: quote.epsTrailingTwelveMonths ?? null,
    week52High: quote.fiftyTwoWeekHigh ?? null,
    week52Low: quote.fiftyTwoWeekLow ?? null,
    dividendYield: quote.dividendYield ?? null,
    source: "yahoo",
  };
}

// Alpaca API로 종목 데이터 가져오기 (fallback)
async function fetchFromAlpaca(symbol: string): Promise<StockResponse> {
  const headers = {
    "APCA-API-KEY-ID": ALPACA_API_KEY,
    "APCA-API-SECRET-KEY": ALPACA_API_SECRET,
  };

  // 최신 스냅샷
  const snapRes = await fetch(
    `${ALPACA_BASE_URL}/v2/stocks/${symbol}/snapshot`,
    { headers }
  );
  if (!snapRes.ok) {
    throw new Error(`Alpaca snapshot error: ${snapRes.status}`);
  }
  const snap = await snapRes.json();

  const latestTrade = snap.latestTrade?.p ?? 0;
  const prevClose = snap.prevDailyBar?.c ?? 0;
  const change = latestTrade - prevClose;
  const changePercent = prevClose > 0 ? (change / prevClose) * 100 : 0;

  return {
    symbol,
    name: symbol,
    price: latestTrade,
    change,
    changePercent,
    open: snap.dailyBar?.o ?? 0,
    high: snap.dailyBar?.h ?? 0,
    low: snap.dailyBar?.l ?? 0,
    previousClose: prevClose,
    volume: snap.dailyBar?.v ?? 0,
    marketCap: null,
    pe: null,
    eps: null,
    week52High: null,
    week52Low: null,
    dividendYield: null,
    source: "alpaca",
  };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get("symbol");

  if (!symbol) {
    return NextResponse.json(
      { error: "symbol 파라미터가 필요합니다. 예: /api/stock?symbol=AAPL" },
      { status: 400 }
    );
  }

  const upperSymbol = symbol.toUpperCase().trim();

  try {
    // 1차: Yahoo Finance
    const data = await fetchFromYahoo(upperSymbol);
    return NextResponse.json(data);
  } catch (yahooError) {
    console.warn(`Yahoo Finance 실패 (${upperSymbol}):`, yahooError);

    // 2차: Alpaca (API Key 설정 시)
    if (ALPACA_API_KEY && ALPACA_API_SECRET) {
      try {
        const data = await fetchFromAlpaca(upperSymbol);
        return NextResponse.json(data);
      } catch (alpacaError) {
        console.warn(`Alpaca 실패 (${upperSymbol}):`, alpacaError);
      }
    }

    return NextResponse.json(
      { error: `종목 데이터를 가져올 수 없습니다: ${upperSymbol}` },
      { status: 500 }
    );
  }
}
