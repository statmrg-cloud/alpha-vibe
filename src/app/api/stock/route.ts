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
  source: "yahoo" | "alpaca" | "naver";
}

// 한국 주식 여부 확인
function isKoreanStock(symbol: string): boolean {
  return symbol.endsWith(".KS") || symbol.endsWith(".KQ");
}

// 네이버 콤마 숫자 파싱: "189,300" → 189300
function parseNaverNumber(value: string | number | undefined | null): number {
  if (value === undefined || value === null) return 0;
  if (typeof value === "number") return value;
  return Number(value.replace(/,/g, "")) || 0;
}

// 네이버증권 API로 실시간 시세 가져오기 (한국 주식 전용, delayTime=0 실시간)
async function fetchFromNaver(symbol: string): Promise<StockResponse> {
  const code = symbol.replace(/\.(KS|KQ)$/, "");
  const headers = { "User-Agent": "Mozilla/5.0" };

  // basic(실시간 현재가) + price(OHLCV) + integration(PER/EPS/시총) 병렬 호출
  const [basicRes, priceRes, integrationRes] = await Promise.all([
    fetch(`https://m.stock.naver.com/api/stock/${code}/basic`, { headers, cache: "no-store" }),
    fetch(`https://m.stock.naver.com/api/stock/${code}/price`, { headers, cache: "no-store" }),
    fetch(`https://m.stock.naver.com/api/stock/${code}/integration`, { headers, cache: "no-store" }),
  ]);

  if (!basicRes.ok) throw new Error(`Naver basic API error: ${basicRes.status}`);

  const basicData = await basicRes.json();
  const priceData = priceRes.ok ? await priceRes.json() : [];
  const integrationData = integrationRes.ok ? await integrationRes.json() : null;

  // basic: 실시간 현재가
  const price = parseNaverNumber(basicData.closePrice);
  const change = parseNaverNumber(basicData.compareToPreviousClosePrice);
  const changePercent = parseFloat(basicData.fluctuationsRatio) || 0;
  const stockName = basicData.stockName || code;

  // price[0]: 오늘 OHLCV (일별 데이터의 첫번째)
  const today = Array.isArray(priceData) && priceData.length > 0 ? priceData[0] : null;
  const openPrice = today ? parseNaverNumber(today.openPrice) : price;
  const highPrice = today ? parseNaverNumber(today.highPrice) : price;
  const lowPrice = today ? parseNaverNumber(today.lowPrice) : price;
  const volume = today ? parseNaverNumber(today.accumulatedTradingVolume) : 0;

  // price[1]: 전일 종가
  const yesterday = Array.isArray(priceData) && priceData.length > 1 ? priceData[1] : null;
  const previousClose = yesterday ? parseNaverNumber(yesterday.closePrice) : price - change;

  // integration: PER, EPS, 시총 등
  let marketCap: number | null = null;
  let pe: number | null = null;
  let eps: number | null = null;
  let dividendYield: number | null = null;

  if (integrationData?.totalInfos) {
    const infos = integrationData.totalInfos;
    const getVal = (key: string): string | null => {
      const item = infos.find((i: { key: string; value: string }) => i.key === key);
      return item?.value ?? null;
    };

    const perStr = getVal("PER");
    const epsStr = getVal("EPS");
    const capStr = getVal("시총");
    const divStr = getVal("배당수익률");

    if (perStr) pe = parseFloat(perStr.replace(/,/g, "")) || null;
    if (epsStr) eps = parseFloat(epsStr.replace(/,/g, "")) || null;
    if (capStr) {
      // 시총: "1,127,301억" → 억 단위 → 원 단위로 변환
      const capNum = parseFloat(capStr.replace(/[,억원조\s]/g, ""));
      if (capStr.includes("조")) marketCap = capNum * 1e12;
      else if (capStr.includes("억")) marketCap = capNum * 1e8;
      else marketCap = capNum;
    }
    if (divStr) dividendYield = parseFloat(divStr.replace(/%/g, "")) || null;
  }

  return {
    symbol,
    name: stockName,
    price,
    change,
    changePercent,
    open: openPrice,
    high: highPrice,
    low: lowPrice,
    previousClose,
    volume,
    marketCap,
    pe,
    eps,
    week52High: null,
    week52Low: null,
    dividendYield,
    source: "naver",
  };
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
  const isKR = isKoreanStock(upperSymbol);

  // 한국 주식: 네이버증권(실시간) → Yahoo(fallback)
  // 미국 주식: Yahoo → Alpaca(fallback)
  if (isKR) {
    try {
      const data = await fetchFromNaver(upperSymbol);
      return NextResponse.json(data);
    } catch (naverError) {
      console.warn(`네이버증권 실패 (${upperSymbol}):`, naverError);
      // fallback: Yahoo Finance
      try {
        const data = await fetchFromYahoo(upperSymbol);
        return NextResponse.json(data);
      } catch (yahooError) {
        console.warn(`Yahoo Finance 실패 (${upperSymbol}):`, yahooError);
      }
      return NextResponse.json(
        { error: `종목 데이터를 가져올 수 없습니다: ${upperSymbol}` },
        { status: 500 }
      );
    }
  }

  try {
    // 미국 주식 1차: Yahoo Finance
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
