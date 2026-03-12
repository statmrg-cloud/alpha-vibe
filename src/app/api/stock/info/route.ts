import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
};

const YAHOO_HEADERS = {
  ...HEADERS,
  "Origin": "https://finance.yahoo.com",
  "Referer": "https://finance.yahoo.com/",
  "Accept": "application/json",
};

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

// ─── Response types ───

interface OrderBookEntry {
  price: number;
  quantity: number;
}

interface StockInfoResponse {
  symbol: string;
  name: string | null;
  marketData: {
    open: number | null;
    close: number | null;
    high: number | null;
    low: number | null;
    volume: number | null;
    tradingValue: number | null;
  } | null;
  orderBook: {
    asks: OrderBookEntry[];
    bids: OrderBookEntry[];
  } | null;
  investorTrends: {
    individual: { buy: number; sell: number } | null;
    foreign: { buy: number; sell: number } | null;
    institution: { buy: number; sell: number } | null;
  } | null;
  metrics: {
    marketCap: number | null;
    dividendYield: number | null;
    pbr: number | null;
    per: number | null;
    roe: number | null;
    psr: number | null;
    foreignOwnership: number | null;
  } | null;
  news: Array<{ title: string; url: string; date: string }> | null;
}

// ─── Korean stock (Naver Finance) ───

async function fetchKoreanStockInfo(symbol: string): Promise<StockInfoResponse> {
  const code = symbol.replace(/\.(KS|KQ)$/, "");

  // 5개 API 병렬 호출 (실제 네이버 모바일 API 엔드포인트)
  const [basicRes, integrationRes, trendRes, askingPriceRes, newsRes] =
    await Promise.all([
      fetch(`https://m.stock.naver.com/api/stock/${code}/basic`, {
        headers: HEADERS,
        cache: "no-store",
      }).catch(() => null),
      fetch(`https://m.stock.naver.com/api/stock/${code}/integration`, {
        headers: HEADERS,
        cache: "no-store",
      }).catch(() => null),
      fetch(`https://m.stock.naver.com/api/stock/${code}/trend`, {
        headers: HEADERS,
        cache: "no-store",
      }).catch(() => null),
      fetch(`https://m.stock.naver.com/api/stock/${code}/askingPrice`, {
        headers: HEADERS,
        cache: "no-store",
      }).catch(() => null),
      fetch(`https://m.stock.naver.com/api/news/stock/${code}?pageSize=5`, {
        headers: HEADERS,
        cache: "no-store",
      }).catch(() => null),
    ]);

  const result: StockInfoResponse = {
    symbol,
    name: null,
    marketData: null,
    orderBook: null,
    investorTrends: null,
    metrics: null,
    news: null,
  };

  // 1) Basic → name + current price
  let currentPrice: number | null = null;
  try {
    if (basicRes && basicRes.ok) {
      const basic = await basicRes.json();
      result.name = basic.stockName || basic.stockNameEng || code;
      currentPrice = parseNaverNumber(basic.closePrice) || null;
    }
  } catch (e) {
    console.warn(`[stock/info] basic parse error (${code}):`, e);
  }

  // 2) Integration → marketData + metrics (totalInfos uses code-based lookup)
  try {
    if (integrationRes && integrationRes.ok) {
      const integration = await integrationRes.json();

      if (integration?.totalInfos) {
        const getByCode = (c: string): string | null => {
          const item = integration.totalInfos.find(
            (i: { code: string; value: string }) => i.code === c
          );
          return item?.value ?? null;
        };

        // marketData from integration
        result.marketData = {
          open: parseNaverNumber(getByCode("openPrice")) || null,
          close: currentPrice || parseNaverNumber(getByCode("lastClosePrice")) || null,
          high: parseNaverNumber(getByCode("highPrice")) || null,
          low: parseNaverNumber(getByCode("lowPrice")) || null,
          volume: parseNaverNumber(getByCode("accumulatedTradingVolume")) || null,
          tradingValue: null,
        };
        // 거래대금: "5,578,544백만" → parse
        const tradingStr = getByCode("accumulatedTradingValue");
        if (tradingStr) {
          const numPart = parseFloat(tradingStr.replace(/[,백만억원\s]/g, ""));
          if (tradingStr.includes("백만")) result.marketData.tradingValue = numPart * 1e6;
          else if (tradingStr.includes("억")) result.marketData.tradingValue = numPart * 1e8;
          else result.marketData.tradingValue = numPart;
        }

        // metrics
        const metrics: StockInfoResponse["metrics"] = {
          marketCap: null,
          dividendYield: null,
          pbr: null,
          per: null,
          roe: null,
          psr: null,
          foreignOwnership: null,
        };

        const perStr = getByCode("per");
        const pbrStr = getByCode("pbr");
        const divStr = getByCode("dividendYieldRatio");
        const foreignStr = getByCode("foreignRate");
        const capStr = getByCode("marketValue");

        if (perStr) metrics.per = parseFloat(perStr.replace(/[,%배원\s]/g, "")) || null;
        if (pbrStr) metrics.pbr = parseFloat(pbrStr.replace(/[,%배원\s]/g, "")) || null;
        if (divStr) metrics.dividendYield = parseFloat(divStr.replace(/[%]/g, "")) || null;
        if (foreignStr) metrics.foreignOwnership = parseFloat(foreignStr.replace(/[%]/g, "")) || null;

        if (capStr) {
          // "1,150조 1,856억" → parse
          let totalWon = 0;
          const joMatch = capStr.match(/([\d,]+)조/);
          const eokMatch = capStr.match(/([\d,]+)억/);
          if (joMatch) totalWon += parseFloat(joMatch[1].replace(/,/g, "")) * 1e12;
          if (eokMatch) totalWon += parseFloat(eokMatch[1].replace(/,/g, "")) * 1e8;
          if (totalWon > 0) metrics.marketCap = totalWon;
        }

        result.metrics = metrics;
      }
    }
  } catch (e) {
    console.warn(`[stock/info] integration parse error (${code}):`, e);
  }

  // 3) Trend → investorTrends (순매수량 기반)
  // API: /api/stock/{code}/trend → array of daily data
  // Each item: { foreignerPureBuyQuant, organPureBuyQuant, individualPureBuyQuant, ... }
  try {
    if (trendRes && trendRes.ok) {
      const trendData = await trendRes.json();

      if (Array.isArray(trendData) && trendData.length > 0) {
        // 가장 최근 데이터 (첫 번째)
        const latest = trendData[0];

        const foreignNet = parseNaverNumber(latest.foreignerPureBuyQuant);
        const organNet = parseNaverNumber(latest.organPureBuyQuant);
        const individualNet = parseNaverNumber(latest.individualPureBuyQuant);

        result.investorTrends = {
          individual: { buy: individualNet > 0 ? individualNet : 0, sell: individualNet < 0 ? Math.abs(individualNet) : 0 },
          foreign: { buy: foreignNet > 0 ? foreignNet : 0, sell: foreignNet < 0 ? Math.abs(foreignNet) : 0 },
          institution: { buy: organNet > 0 ? organNet : 0, sell: organNet < 0 ? Math.abs(organNet) : 0 },
        };
      }
    }
  } catch (e) {
    console.warn(`[stock/info] trend parse error (${code}):`, e);
  }

  // 4) AskingPrice → orderBook (호가)
  // API: /api/stock/{code}/askingPrice
  // { sellInfo: [{price, count, rate}], buyInfos: [{price, count, rate}] }
  try {
    if (askingPriceRes && askingPriceRes.ok) {
      const hoga = await askingPriceRes.json();
      const asks: OrderBookEntry[] = [];
      const bids: OrderBookEntry[] = [];

      if (hoga?.sellInfo) {
        for (const item of hoga.sellInfo.slice(0, 5)) {
          asks.push({
            price: parseNaverNumber(item.price),
            quantity: parseNaverNumber(item.count),
          });
        }
      }
      if (hoga?.buyInfos) {
        for (const item of hoga.buyInfos.slice(0, 5)) {
          bids.push({
            price: parseNaverNumber(item.price),
            quantity: parseNaverNumber(item.count),
          });
        }
      }

      result.orderBook = { asks, bids };
    }
  } catch (e) {
    console.warn(`[stock/info] askingPrice parse error (${code}):`, e);
  }

  // 5) News
  // API: /api/news/stock/{code}?pageSize=5
  // Returns array of { total, items: [{ officeId, articleId, title, titleFull, datetime, ... }] }
  try {
    if (newsRes && newsRes.ok) {
      const newsData = await newsRes.json();
      const articles: Array<{ title: string; url: string; date: string }> = [];

      if (Array.isArray(newsData)) {
        for (const group of newsData) {
          if (group?.items && Array.isArray(group.items)) {
            for (const item of group.items) {
              if (articles.length >= 5) break;
              const title = item.titleFull || item.title || "";
              const officeId = item.officeId || "";
              const articleId = item.articleId || "";
              const url = officeId && articleId
                ? `https://n.news.naver.com/mnews/article/${officeId}/${articleId}`
                : "";
              const datetime = item.datetime || "";
              // datetime format: "202603111352" → "2026-03-11 13:52"
              let dateStr = datetime;
              if (datetime.length >= 12) {
                dateStr = `${datetime.slice(0, 4)}-${datetime.slice(4, 6)}-${datetime.slice(6, 8)} ${datetime.slice(8, 10)}:${datetime.slice(10, 12)}`;
              }

              if (title) {
                articles.push({
                  title: title.replace(/<[^>]*>/g, ""),
                  url,
                  date: dateStr,
                });
              }
            }
          }
        }
      }

      if (articles.length > 0) {
        result.news = articles;
      }
    }
  } catch (e) {
    console.warn(`[stock/info] news parse error (${code}):`, e);
  }

  return result;
}

// ─── US stock (Yahoo Finance) ───

async function fetchUSStockInfo(symbol: string): Promise<StockInfoResponse> {
  const result: StockInfoResponse = {
    symbol,
    name: null,
    marketData: null,
    orderBook: null,
    investorTrends: null,
    metrics: null,
    news: null,
  };

  try {
    // v8/chart API — v10/quoteSummary requires authentication now
    const url = `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
      symbol
    )}?interval=1d&range=5d`;

    const res = await fetch(url, {
      headers: YAHOO_HEADERS,
      cache: "no-store",
    });

    if (!res.ok) {
      console.warn(`[stock/info] Yahoo API error (${symbol}): ${res.status}`);
      return result;
    }

    const data = await res.json();
    const meta = data?.chart?.result?.[0]?.meta;
    if (!meta) return result;

    const indicators = data?.chart?.result?.[0]?.indicators?.quote?.[0];
    const timestamps = data?.chart?.result?.[0]?.timestamp || [];
    const lastIdx = timestamps.length - 1;

    // Name
    result.name = meta.shortName || meta.longName || symbol;

    // Market data
    result.marketData = {
      open: indicators?.open?.[lastIdx] ?? null,
      close: meta.regularMarketPrice ?? null,
      high: indicators?.high?.[lastIdx] ?? null,
      low: indicators?.low?.[lastIdx] ?? null,
      volume: indicators?.volume?.[lastIdx] ?? null,
      tradingValue: null,
    };

    // Metrics — limited data from chart API
    result.metrics = {
      marketCap: null,
      dividendYield: null,
      pbr: null,
      per: null,
      roe: null,
      psr: null,
      foreignOwnership: null,
    };

    // Order book / investor trends not available from Yahoo
    result.orderBook = null;
    result.investorTrends = null;
    result.news = null;
  } catch (e) {
    console.warn(`[stock/info] Yahoo parse error (${symbol}):`, e);
  }

  return result;
}

// ─── API Handler ───

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get("symbol");

  if (!symbol) {
    return NextResponse.json(
      { error: "symbol 파라미터가 필요합니다. 예: /api/stock/info?symbol=005930.KS" },
      { status: 400 }
    );
  }

  const upperSymbol = symbol.toUpperCase().trim();

  try {
    const data = isKoreanStock(upperSymbol)
      ? await fetchKoreanStockInfo(upperSymbol)
      : await fetchUSStockInfo(upperSymbol);

    return NextResponse.json(data);
  } catch (error) {
    console.error(`[stock/info] unexpected error (${upperSymbol}):`, error);
    return NextResponse.json(
      { error: `종목 정보를 가져올 수 없습니다: ${upperSymbol}` },
      { status: 500 }
    );
  }
}
