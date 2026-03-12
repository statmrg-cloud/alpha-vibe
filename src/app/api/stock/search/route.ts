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

interface SearchResult {
  symbol: string;
  name: string;
  type: string;
  exchange: string;
}

// Naver 자동완성 API — 코스피/코스닥 전 종목 검색
async function searchNaver(query: string): Promise<SearchResult[]> {
  try {
    const url = `https://ac.stock.naver.com/ac?q=${encodeURIComponent(query)}&target=stock`;
    const res = await fetch(url, { headers: HEADERS, cache: "no-store" });
    if (!res.ok) return [];
    const data = await res.json();

    if (!data?.items || !Array.isArray(data.items)) return [];

    return data.items
      .filter((item: Record<string, string>) => item.nationCode === "KOR" && item.category === "stock")
      .map((item: Record<string, string>) => {
        const code = item.code || "";
        const exchange = item.typeCode === "KOSDAQ" ? "KQ" : "KS";
        return {
          symbol: `${code}.${exchange}`,
          name: item.name || code,
          type: `EQUITY (${item.typeName || item.typeCode || "KOSPI"})`,
          exchange: item.typeName || item.typeCode || "KOSPI",
        };
      })
      .slice(0, 15);
  } catch {
    return [];
  }
}

// Yahoo Finance REST Search API — 미국 및 글로벌 주식
async function searchYahoo(query: string): Promise<SearchResult[]> {
  try {
    const url = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=15&newsCount=0`;
    const res = await fetch(url, { headers: YAHOO_HEADERS, cache: "no-store" });
    if (!res.ok) return [];
    const data = await res.json();

    return (data.quotes || [])
      .filter((q: Record<string, unknown>) => q.isYahooFinance !== false)
      .map((q: Record<string, unknown>) => ({
        symbol: q.symbol as string,
        name: (q.shortname || q.longname || q.symbol) as string,
        type: (q.quoteType || "EQUITY") as string,
        exchange: (q.exchDisp || q.exchange || "") as string,
      }));
  } catch {
    return [];
  }
}

// Check if query contains Korean characters
function hasKorean(str: string): boolean {
  return /[\uAC00-\uD7AF\u3131-\u3163\u3165-\u318E]/.test(str);
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim();

  if (!query || query.length < 1) {
    return NextResponse.json({ results: [] });
  }

  try {
    const results: SearchResult[] = [];

    if (hasKorean(query)) {
      // 한글 검색 → 네이버 자동완성 API (코스피/코스닥 전 종목)
      const naverResults = await searchNaver(query);
      results.push(...naverResults);
    } else {
      // 영문/숫자 검색 → Yahoo + Naver 병렬
      const [yahooResults, naverResults] = await Promise.all([
        searchYahoo(query),
        searchNaver(query),
      ]);

      results.push(...yahooResults);

      // 네이버 결과 중 Yahoo에 없는 것 추가
      const existingSymbols = new Set(results.map((r) => r.symbol));
      for (const nr of naverResults) {
        if (!existingSymbols.has(nr.symbol)) {
          results.push(nr);
        }
      }
    }

    return NextResponse.json({ results: results.slice(0, 15) });
  } catch (error) {
    console.error("Search error:", error);
    return NextResponse.json({ results: [] });
  }
}
