import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
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

  // 5개 API 병렬 호출
  const [basicRes, integrationRes, investorRes, askbidRes, newsRes] =
    await Promise.all([
      fetch(`https://m.stock.naver.com/api/stock/${code}/basic`, {
        headers: HEADERS,
        cache: "no-store",
      }).catch(() => null),
      fetch(`https://m.stock.naver.com/api/stock/${code}/integration`, {
        headers: HEADERS,
        cache: "no-store",
      }).catch(() => null),
      fetch(`https://m.stock.naver.com/api/stock/${code}/investor`, {
        headers: HEADERS,
        cache: "no-store",
      }).catch(() => null),
      fetch(`https://m.stock.naver.com/api/stock/${code}/askbid`, {
        headers: HEADERS,
        cache: "no-store",
      }).catch(() => null),
      fetch(`https://m.stock.naver.com/api/stock/${code}/news?pageSize=5`, {
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

  // 1) Basic → name + marketData
  try {
    if (basicRes && basicRes.ok) {
      const basic = await basicRes.json();
      result.name = basic.stockName || basic.stockNameEng || code;
      result.marketData = {
        open: parseNaverNumber(basic.openPrice) || null,
        close: parseNaverNumber(basic.closePrice) || null,
        high: parseNaverNumber(basic.highPrice) || null,
        low: parseNaverNumber(basic.lowPrice) || null,
        volume: parseNaverNumber(basic.accumulatedTradingVolume) || null,
        tradingValue: parseNaverNumber(basic.accumulatedTradingValue) || null,
      };
    }
  } catch (e) {
    console.warn(`[stock/info] basic parse error (${code}):`, e);
  }

  // 2) Integration → metrics
  try {
    if (integrationRes && integrationRes.ok) {
      const integration = await integrationRes.json();
      const metrics: StockInfoResponse["metrics"] = {
        marketCap: null,
        dividendYield: null,
        pbr: null,
        per: null,
        roe: null,
        psr: null,
        foreignOwnership: null,
      };

      // totalInfos: [{ key: "PER", value: "12.5" }, ...]
      if (integration?.totalInfos) {
        const getVal = (key: string): string | null => {
          const item = integration.totalInfos.find(
            (i: { key: string; value: string }) => i.key === key
          );
          return item?.value ?? null;
        };

        const perStr = getVal("PER");
        const pbrStr = getVal("PBR");
        const roeStr = getVal("ROE");
        const psrStr = getVal("PSR");
        const divStr = getVal("배당수익률");
        const capStr = getVal("시총");
        const foreignStr = getVal("외국인보유율") || getVal("외국인소진율");

        if (perStr) metrics.per = parseFloat(perStr.replace(/[,%배]/g, "")) || null;
        if (pbrStr) metrics.pbr = parseFloat(pbrStr.replace(/[,%배]/g, "")) || null;
        if (roeStr) metrics.roe = parseFloat(roeStr.replace(/[,%배]/g, "")) || null;
        if (psrStr) metrics.psr = parseFloat(psrStr.replace(/[,%배]/g, "")) || null;
        if (divStr) metrics.dividendYield = parseFloat(divStr.replace(/[%]/g, "")) || null;
        if (foreignStr) metrics.foreignOwnership = parseFloat(foreignStr.replace(/[%]/g, "")) || null;

        if (capStr) {
          const capNum = parseFloat(capStr.replace(/[,억원조\s]/g, ""));
          if (capStr.includes("조")) metrics.marketCap = capNum * 1e12;
          else if (capStr.includes("억")) metrics.marketCap = capNum * 1e8;
          else metrics.marketCap = capNum;
        }
      }

      result.metrics = metrics;
    }
  } catch (e) {
    console.warn(`[stock/info] integration parse error (${code}):`, e);
  }

  // 3) Investor trends → investorTrends
  try {
    if (investorRes && investorRes.ok) {
      const investorData = await investorRes.json();
      // Naver investor API returns an array or object with investor categories
      // Structure: { foreignInvestors, individuals, institutions } or similar
      const trends: StockInfoResponse["investorTrends"] = {
        individual: null,
        foreign: null,
        institution: null,
      };

      // Try parsing common Naver investor response structures
      if (Array.isArray(investorData)) {
        // Array format: each element has investorType, buyAmount, sellAmount
        for (const item of investorData) {
          const buy = parseNaverNumber(item.buyTradingValue || item.buyAmount || item.purchaseAmount);
          const sell = parseNaverNumber(item.sellTradingValue || item.sellAmount || item.saleAmount);
          const type = item.investorType || item.investorName || "";

          if (type.includes("개인") || type === "individual") {
            trends.individual = { buy, sell };
          } else if (type.includes("외국") || type.includes("외인") || type === "foreign") {
            trends.foreign = { buy, sell };
          } else if (type.includes("기관") || type === "institution") {
            trends.institution = { buy, sell };
          }
        }
      } else if (investorData?.investors) {
        // Nested format
        for (const item of investorData.investors) {
          const buy = parseNaverNumber(item.buyTradingValue || item.buyAmount);
          const sell = parseNaverNumber(item.sellTradingValue || item.sellAmount);
          const type = item.investorType || item.investorName || "";

          if (type.includes("개인") || type === "individual") {
            trends.individual = { buy, sell };
          } else if (type.includes("외국") || type.includes("외인") || type === "foreign") {
            trends.foreign = { buy, sell };
          } else if (type.includes("기관") || type === "institution") {
            trends.institution = { buy, sell };
          }
        }
      }

      result.investorTrends = trends;
    }
  } catch (e) {
    console.warn(`[stock/info] investor parse error (${code}):`, e);
  }

  // 4) Ask/bid → orderBook
  try {
    if (askbidRes && askbidRes.ok) {
      const askbidData = await askbidRes.json();
      const asks: OrderBookEntry[] = [];
      const bids: OrderBookEntry[] = [];

      // Naver askbid API typically returns askPrices/bidPrices or similar arrays
      if (askbidData?.askPrices && askbidData?.bidPrices) {
        for (const item of askbidData.askPrices.slice(0, 5)) {
          asks.push({
            price: parseNaverNumber(item.price),
            quantity: parseNaverNumber(item.quantity || item.count),
          });
        }
        for (const item of askbidData.bidPrices.slice(0, 5)) {
          bids.push({
            price: parseNaverNumber(item.price),
            quantity: parseNaverNumber(item.quantity || item.count),
          });
        }
      } else if (Array.isArray(askbidData)) {
        // Flat array format with type indicator
        for (const item of askbidData) {
          const entry: OrderBookEntry = {
            price: parseNaverNumber(item.price),
            quantity: parseNaverNumber(item.quantity || item.count || item.residualCount),
          };
          if (item.type === "ask" || item.type === "매도") {
            if (asks.length < 5) asks.push(entry);
          } else if (item.type === "bid" || item.type === "매수") {
            if (bids.length < 5) bids.push(entry);
          }
        }
      } else if (askbidData?.askTotalRemainingCount !== undefined) {
        // Another common Naver format with numbered fields (askPrice1, askPrice2, ...)
        for (let i = 1; i <= 5; i++) {
          const askPrice = parseNaverNumber(askbidData[`askPrice${i}`]);
          const askQty = parseNaverNumber(
            askbidData[`askRemainingCount${i}`] || askbidData[`askCount${i}`]
          );
          if (askPrice) asks.push({ price: askPrice, quantity: askQty });

          const bidPrice = parseNaverNumber(askbidData[`bidPrice${i}`]);
          const bidQty = parseNaverNumber(
            askbidData[`bidRemainingCount${i}`] || askbidData[`bidCount${i}`]
          );
          if (bidPrice) bids.push({ price: bidPrice, quantity: bidQty });
        }
      }

      result.orderBook = { asks, bids };
    }
  } catch (e) {
    console.warn(`[stock/info] askbid parse error (${code}):`, e);
  }

  // 5) News
  try {
    if (newsRes && newsRes.ok) {
      const newsData = await newsRes.json();
      const articles: Array<{ title: string; url: string; date: string }> = [];

      // Naver news API returns items in various shapes
      const newsList =
        newsData?.items || newsData?.news || (Array.isArray(newsData) ? newsData : []);

      for (const item of newsList.slice(0, 5)) {
        const title = item.title || item.articleTitle || "";
        const url =
          item.url ||
          item.link ||
          item.articleLink ||
          (item.oid && item.aid
            ? `https://n.news.naver.com/mnews/article/${item.oid}/${item.aid}`
            : "");
        const date =
          item.date ||
          item.publishedAt ||
          item.datetime ||
          item.registeredDate ||
          "";

        if (title) {
          articles.push({
            title: title.replace(/<[^>]*>/g, ""), // strip HTML tags
            url,
            date: formatDate(date),
          });
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
    const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(
      symbol
    )}?modules=defaultKeyStatistics,financialData,summaryDetail,price`;

    const res = await fetch(url, {
      headers: HEADERS,
      cache: "no-store",
    });

    if (!res.ok) {
      console.warn(`[stock/info] Yahoo API error (${symbol}): ${res.status}`);
      return result;
    }

    const data = await res.json();
    const quoteSummary = data?.quoteSummary?.result?.[0];
    if (!quoteSummary) return result;

    const price = quoteSummary.price || {};
    const summaryDetail = quoteSummary.summaryDetail || {};
    const keyStats = quoteSummary.defaultKeyStatistics || {};
    const financialData = quoteSummary.financialData || {};

    // Name
    result.name = price.shortName || price.longName || symbol;

    // Market data
    result.marketData = {
      open: extractYahooRaw(price.regularMarketOpen) ?? extractYahooRaw(summaryDetail.open),
      close: extractYahooRaw(price.regularMarketPrice) ?? null,
      high: extractYahooRaw(price.regularMarketDayHigh) ?? extractYahooRaw(summaryDetail.dayHigh),
      low: extractYahooRaw(price.regularMarketDayLow) ?? extractYahooRaw(summaryDetail.dayLow),
      volume: extractYahooRaw(price.regularMarketVolume) ?? extractYahooRaw(summaryDetail.volume),
      tradingValue: null, // Yahoo doesn't provide trading value directly
    };

    // Metrics
    result.metrics = {
      marketCap: extractYahooRaw(price.marketCap) ?? null,
      dividendYield: extractYahooRaw(summaryDetail.dividendYield)
        ? (extractYahooRaw(summaryDetail.dividendYield)! * 100)
        : null,
      pbr: extractYahooRaw(keyStats.priceToBook) ?? null,
      per: extractYahooRaw(summaryDetail.trailingPE) ?? extractYahooRaw(keyStats.trailingPE) ?? null,
      roe: extractYahooRaw(financialData.returnOnEquity)
        ? (extractYahooRaw(financialData.returnOnEquity)! * 100)
        : null,
      psr: extractYahooRaw(keyStats.priceToSalesTrailing12Months) ?? null,
      foreignOwnership: null, // Not applicable for US stocks
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

// Yahoo returns values as { raw: 123.45, fmt: "123.45" }
function extractYahooRaw(field: unknown): number | null {
  if (field === undefined || field === null) return null;
  if (typeof field === "number") return field;
  if (typeof field === "object" && field !== null && "raw" in field) {
    const raw = (field as { raw: unknown }).raw;
    if (typeof raw === "number") return raw;
  }
  return null;
}

// Format date string to YYYY-MM-DD
function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  try {
    // Already in YYYY-MM-DD format
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
    // Try parsing as Date
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      return d.toISOString().split("T")[0];
    }
  } catch {
    // ignore
  }
  return dateStr;
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
