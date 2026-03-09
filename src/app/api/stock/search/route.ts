import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

interface SearchResult {
  symbol: string;
  name: string;
  type: string;  // EQUITY, ETF, INDEX, etc.
  exchange: string;
}

// Yahoo Finance REST Search API
async function searchYahoo(query: string): Promise<SearchResult[]> {
  const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=15&newsCount=0`;
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0" },
    cache: "no-store",
  });
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
}

// Korean stock name search (for hangul queries that Yahoo can't handle)
// Comprehensive KOSPI/KOSDAQ mapping
const KOREAN_STOCKS: Array<{ name: string; symbol: string; keywords: string[] }> = [
  // === Banks & Finance ===
  { name: "KB\uAE08\uC735", symbol: "105560.KS", keywords: ["kb\uAE08\uC735", "kb", "\uAD6D\uBBFC\uC740\uD589"] },
  { name: "\uC2E0\uD55C\uC9C0\uC8FC", symbol: "055550.KS", keywords: ["\uC2E0\uD55C", "\uC2E0\uD55C\uC9C0\uC8FC", "\uC2E0\uD55C\uC740\uD589"] },
  { name: "\uD558\uB098\uAE08\uC735\uC9C0\uC8FC", symbol: "086790.KS", keywords: ["\uD558\uB098\uAE08\uC735", "\uD558\uB098\uC740\uD589", "\uD558\uB098"] },
  { name: "\uC6B0\uB9AC\uAE08\uC735\uC9C0\uC8FC", symbol: "316140.KS", keywords: ["\uC6B0\uB9AC\uAE08\uC735", "\uC6B0\uB9AC\uC740\uD589", "\uC6B0\uB9AC"] },
  { name: "\uAE30\uC5C5\uC740\uD589", symbol: "024110.KS", keywords: ["\uAE30\uC5C5\uC740\uD589", "ibk", "\uAE30\uC740"] },
  { name: "BNK\uAE08\uC735\uC9C0\uC8FC", symbol: "138930.KS", keywords: ["bnk", "\uBD80\uC0B0\uC740\uD589", "\uACBD\uB0A8\uC740\uD589"] },
  { name: "DGB\uAE08\uC735\uC9C0\uC8FC", symbol: "139130.KS", keywords: ["dgb", "\uB300\uAD6C\uC740\uD589"] },
  { name: "JB\uAE08\uC735\uC9C0\uC8FC", symbol: "175330.KS", keywords: ["jb", "\uC804\uBD81\uC740\uD589", "\uAD11\uC8FC\uC740\uD589"] },
  { name: "\uBBF8\uB798\uC5D0\uC14B\uC99D\uAD8C", symbol: "006800.KS", keywords: ["\uBBF8\uB798\uC5D0\uC14B", "\uBBF8\uB798\uC5D0\uC14B\uC99D\uAD8C"] },
  { name: "NH\uD22C\uC790\uC99D\uAD8C", symbol: "005940.KS", keywords: ["nh\uD22C\uC790", "nh\uC99D\uAD8C", "\uB18D\uD611"] },
  { name: "\uD55C\uAD6D\uAE08\uC735\uC9C0\uC8FC", symbol: "071050.KS", keywords: ["\uD55C\uAD6D\uAE08\uC735", "\uD55C\uAE08\uD22C"] },
  { name: "\uBA54\uB9AC\uCE20\uC99D\uAD8C", symbol: "008560.KS", keywords: ["\uBA54\uB9AC\uCE20", "\uBA54\uB9AC\uCE20\uC99D\uAD8C"] },
  { name: "\uC0BC\uC131\uC99D\uAD8C", symbol: "016360.KS", keywords: ["\uC0BC\uC131\uC99D\uAD8C"] },
  { name: "\uD0A4\uC6C0\uC99D\uAD8C", symbol: "039490.KS", keywords: ["\uD0A4\uC6C0", "\uD0A4\uC6C0\uC99D\uAD8C"] },
  // === Samsung Group ===
  { name: "\uC0BC\uC131\uC804\uC790", symbol: "005930.KS", keywords: ["\uC0BC\uC131\uC804\uC790", "\uC0BC\uC131", "samsung"] },
  { name: "\uC0BC\uC131\uC804\uC790\uC6B0", symbol: "005935.KS", keywords: ["\uC0BC\uC131\uC804\uC790\uC6B0", "\uC0BC\uC131\uC6B0\uC120\uC8FC"] },
  { name: "\uC0BC\uC131SDI", symbol: "006400.KS", keywords: ["\uC0BC\uC131sdi"] },
  { name: "\uC0BC\uC131\uBC14\uC774\uC624\uB85C\uC9C1\uC2A4", symbol: "207940.KS", keywords: ["\uC0BC\uC131\uBC14\uC774\uC624", "\uC0BC\uC131"] },
  { name: "\uC0BC\uC131\uBB3C\uC0B0", symbol: "028260.KS", keywords: ["\uC0BC\uC131\uBB3C\uC0B0"] },
  { name: "\uC0BC\uC131\uC0DD\uBA85", symbol: "032830.KS", keywords: ["\uC0BC\uC131\uC0DD\uBA85"] },
  { name: "\uC0BC\uC131\uD654\uC7AC", symbol: "000810.KS", keywords: ["\uC0BC\uC131\uD654\uC7AC"] },
  { name: "\uC0BC\uC131\uC804\uAE30", symbol: "009150.KS", keywords: ["\uC0BC\uC131\uC804\uAE30"] },
  { name: "\uC0BC\uC131\uC911\uACF5\uC5C5", symbol: "010140.KS", keywords: ["\uC0BC\uC131\uC911\uACF5\uC5C5"] },
  { name: "\uC0BC\uC131SDS", symbol: "018260.KS", keywords: ["\uC0BC\uC131sds"] },
  // === SK Group ===
  { name: "SK\uD558\uC774\uB2C9\uC2A4", symbol: "000660.KS", keywords: ["sk\uD558\uC774\uB2C9\uC2A4", "\uD558\uC774\uB2C9\uC2A4"] },
  { name: "SK", symbol: "034730.KS", keywords: ["sk", "\uC5D0\uC2A4\uCF00\uC774"] },
  { name: "SK\uD154\uB808\uCF64", symbol: "017670.KS", keywords: ["sk\uD154\uB808\uCF64", "skt"] },
  { name: "SK\uC774\uB178\uBCA0\uC774\uC158", symbol: "096770.KS", keywords: ["sk\uC774\uB178", "sk"] },
  { name: "SK\uC2A4\uD018\uC5B4", symbol: "402340.KS", keywords: ["sk\uC2A4\uD018\uC5B4"] },
  // === IT/Internet ===
  { name: "\uB124\uC774\uBC84", symbol: "035420.KS", keywords: ["\uB124\uC774\uBC84", "naver"] },
  { name: "\uCE74\uCE74\uC624", symbol: "035720.KS", keywords: ["\uCE74\uCE74\uC624", "kakao"] },
  { name: "\uCE74\uCE74\uC624\uBF45\uD06C", symbol: "323410.KS", keywords: ["\uCE74\uCE74\uC624\uBF45\uD06C"] },
  { name: "\uCE74\uCE74\uC624\uD398\uC774", symbol: "377300.KS", keywords: ["\uCE74\uCE74\uC624\uD398\uC774"] },
  { name: "\uCE74\uCE74\uC624\uAC8C\uC784\uC988", symbol: "293490.KQ", keywords: ["\uCE74\uCE74\uC624\uAC8C\uC784\uC988"] },
  { name: "KT", symbol: "030200.KS", keywords: ["kt", "\uCF00\uC774\uD2F0"] },
  { name: "KT&G", symbol: "033780.KS", keywords: ["kt&g", "ktng", "\uCF00\uC774\uD2F0\uC9C0"] },
  { name: "LG\uC804\uC790", symbol: "066570.KS", keywords: ["lg\uC804\uC790", "lg"] },
  { name: "LG", symbol: "003550.KS", keywords: ["lg", "\uC5D8\uC9C0"] },
  { name: "LG\uD654\uD559", symbol: "051910.KS", keywords: ["lg\uD654\uD559"] },
  { name: "LG\uC5D0\uB108\uC9C0\uC194\uB8E8\uC158", symbol: "373220.KS", keywords: ["lg\uC5D0\uB108\uC9C0", "lg"] },
  { name: "LG\uC774\uB178\uD14D", symbol: "011070.KS", keywords: ["lg\uC774\uB178\uD14D"] },
  { name: "LG\uC720\uD50C\uB7EC\uC2A4", symbol: "032640.KS", keywords: ["lg\uC720\uD50C\uB7EC\uC2A4", "lg\uC720\uD50C"] },
  // === Auto ===
  { name: "\uD604\uB300\uCC28", symbol: "005380.KS", keywords: ["\uD604\uB300\uCC28", "\uD604\uB300\uC790\uB3D9\uCC28", "\uD604\uB300"] },
  { name: "\uD604\uB300\uBAA8\uBE44\uC2A4", symbol: "012330.KS", keywords: ["\uD604\uB300\uBAA8\uBE44\uC2A4"] },
  { name: "\uAE30\uC544", symbol: "000270.KS", keywords: ["\uAE30\uC544", "\uAE30\uC544\uCC28"] },
  { name: "\uD604\uB300\uAC74\uC124", symbol: "000720.KS", keywords: ["\uD604\uB300\uAC74\uC124"] },
  { name: "\uD604\uB300\uAE00\uB85C\uBE44\uC2A4", symbol: "086280.KS", keywords: ["\uD604\uB300\uAE00\uB85C\uBE44\uC2A4"] },
  // === Defense/Shipbuilding ===
  { name: "\uD55C\uD654\uC5D0\uC5B4\uB85C\uC2A4\uD398\uC774\uC2A4", symbol: "012450.KS", keywords: ["\uD55C\uD654\uC5D0\uC5B4\uB85C", "\uD55C\uD654", "\uD55C\uD654\uD56D\uACF5\uC6B0\uC8FC"] },
  { name: "\uD55C\uD654\uC624\uC158", symbol: "042660.KS", keywords: ["\uD55C\uD654\uC624\uC158", "\uB300\uC6B0\uC870\uC120"] },
  { name: "\uD55C\uD654\uC2DC\uC2A4\uD15C", symbol: "272210.KS", keywords: ["\uD55C\uD654\uC2DC\uC2A4\uD15C"] },
  { name: "HD\uD604\uB300\uC911\uACF5\uC5C5", symbol: "329180.KS", keywords: ["hd\uD604\uB300", "\uD604\uB300\uC911\uACF5\uC5C5"] },
  { name: "HD\uD55C\uAD6D\uC870\uC120\uD574\uC591", symbol: "009540.KS", keywords: ["\uD55C\uAD6D\uC870\uC120", "hd\uD604\uB300"] },
  // === Bio/Pharma ===
  { name: "\uC140\uD2B8\uB9AC\uC628", symbol: "068270.KS", keywords: ["\uC140\uD2B8\uB9AC\uC628"] },
  { name: "\uC0BC\uC131\uBC14\uC774\uC624\uC5D0\uD53C\uC2A4", symbol: "235980.KS", keywords: ["\uC0BC\uC131\uBC14\uC774\uC624\uC5D0\uD53C\uC2A4"] },
  { name: "\uC720\uD55C\uC591\uD589", symbol: "000100.KS", keywords: ["\uC720\uD55C\uC591\uD589"] },
  { name: "\uB8E8\uB2DB", symbol: "328130.KS", keywords: ["\uB8E8\uB2DB", "lunit"] },
  { name: "\uC5D0\uC774\uBE44\uC5D8\uBC14\uC774\uC624", symbol: "298380.KS", keywords: ["\uC5D0\uC774\uBE44\uC5D8", "abl"] },
  { name: "\uC54C\uD14C\uC624\uC820", symbol: "196170.KQ", keywords: ["\uC54C\uD14C\uC624\uC824"] },
  { name: "HLB", symbol: "028300.KQ", keywords: ["hlb"] },
  { name: "\uB9AC\uAC00\uCF00\uBBF8\uBC14\uC774\uC624", symbol: "141080.KQ", keywords: ["\uB9AC\uAC00\uCF00\uBBF8"] },
  // === Materials/Energy ===
  { name: "\uD3EC\uC2A4\uCF54\uD640\uB529\uC2A4", symbol: "005490.KS", keywords: ["\uD3EC\uC2A4\uCF54", "posco"] },
  { name: "POSCO\uD4E8\uCC98\uC5E0", symbol: "003670.KS", keywords: ["\uD3EC\uC2A4\uCF54\uD4E8\uCC98\uC5E0"] },
  { name: "\uC5D0\uCF54\uD504\uB85C", symbol: "086520.KS", keywords: ["\uC5D0\uCF54\uD504\uB85C"] },
  { name: "\uC5D0\uCF54\uD504\uB85C\uBE44\uC5E0", symbol: "247540.KS", keywords: ["\uC5D0\uCF54\uD504\uB85C\uBE44\uC5E0"] },
  { name: "\uACE0\uB824\uC544\uC5F0", symbol: "010130.KS", keywords: ["\uACE0\uB824\uC544\uC5F0"] },
  // === Entertainment ===
  { name: "\uD06C\uB798\uD504\uD1A4", symbol: "259960.KS", keywords: ["\uD06C\uB798\uD504\uD1A4", "\uBC30\uADF8", "krafton"] },
  { name: "JYP\uC5D4\uD130", symbol: "035900.KQ", keywords: ["jyp", "\uC81C\uC774\uC640\uC774\uD53C"] },
  { name: "SM", symbol: "041510.KQ", keywords: ["sm", "\uC5D0\uC2A4\uC5E0"] },
  { name: "\uD558\uC774\uBE0C", symbol: "352820.KQ", keywords: ["\uD558\uC774\uBE0C", "hybe", "\uBE45\uD788\uD2B8"] },
  { name: "\uB354\uBE14\uC720\uAC8C\uC784\uC988", symbol: "192080.KQ", keywords: ["\uB354\uBE14\uC720\uAC8C\uC784\uC988", "\uB354\uBE14\uC720"] },
  { name: "\uD3A0\uB4DC\uB098\uC778", symbol: "376300.KQ", keywords: ["\uD3A0\uB4DC\uB098\uC778"] },
  // === Semiconductor ===
  { name: "\uD55C\uBBF8\uBC18\uB3C4\uCCB4", symbol: "042700.KS", keywords: ["\uD55C\uBBF8\uBC18\uB3C4\uCCB4"] },
  { name: "\uD074\uB798\uC2DC\uC2A4", symbol: "214150.KQ", keywords: ["\uD074\uB798\uC2DC\uC2A4"] },
  // === Utility/Heavy ===
  { name: "\uD55C\uAD6D\uC804\uB825", symbol: "015760.KS", keywords: ["\uD55C\uAD6D\uC804\uB825", "\uD55C\uC804"] },
  { name: "\uB450\uC0B0\uC5D0\uB108\uBE4C\uB9AC\uD2F0", symbol: "034020.KS", keywords: ["\uB450\uC0B0\uC5D0\uB108", "\uB450\uC0B0"] },
  { name: "\uB450\uC0B0\uBC25\uCE43", symbol: "001440.KS", keywords: ["\uB450\uC0B0\uBC25\uCE43"] },
  // === Retail/Consumer ===
  { name: "\uD638\uD154\uC2E0\uB77C", symbol: "008770.KS", keywords: ["\uD638\uD154\uC2E0\uB77C", "\uC2E0\uB77C"] },
  { name: "\uB300\uD55C\uD56D\uACF5", symbol: "003490.KS", keywords: ["\uB300\uD55C\uD56D\uACF5"] },
  { name: "CJ", symbol: "001040.KS", keywords: ["cj", "\uC528\uC81C\uC774"] },
  { name: "CJ\uC81C\uC77C\uC81C\uB2F9", symbol: "097950.KS", keywords: ["cj\uC81C\uC77C\uC81C\uB2F9", "cj"] },
  { name: "CJ ENM", symbol: "035760.KS", keywords: ["cj enm", "cj\uC5D4\uD130"] },
  { name: "\uC544\uBAA8\uB808\uD37C\uC2DC\uD53D", symbol: "090430.KS", keywords: ["\uC544\uBAA8\uB808"] },
  { name: "\uB86D\uB370\uC1FC\uD551", symbol: "271560.KS", keywords: ["\uB86D\uB370", "\uB86D\uB370\uC1FC\uD551"] },
  // === ETF (Korean) ===
  { name: "KODEX 200", symbol: "069500.KS", keywords: ["kodex", "kodex 200", "\uCF54\uB371\uC2A4"] },
  { name: "KODEX \uB808\uBC84\uB9AC\uC9C0 \uB098\uC2A4\uB2E5100", symbol: "233740.KS", keywords: ["kodex \uB808\uBC84\uB9AC\uC9C0", "\uCF54\uB371\uC2A4 \uB098\uC2A4\uB2E5"] },
  { name: "TIGER 200", symbol: "102110.KS", keywords: ["tiger", "tiger 200", "\uD0C0\uC774\uAC70"] },
  { name: "KODEX \uC0BC\uC131\uADF8\uB8F9", symbol: "102780.KS", keywords: ["kodex \uC0BC\uC131", "\uCF54\uB371\uC2A4 \uC0BC\uC131"] },
  { name: "KODEX \uC778\uBC84\uC2A4", symbol: "114800.KS", keywords: ["kodex \uC778\uBC84\uC2A4"] },
  { name: "TIGER \uBC18\uB3C4\uCCB4", symbol: "091230.KS", keywords: ["tiger \uBC18\uB3C4\uCCB4"] },
  { name: "KODEX 2\uCC28\uC804\uC9C0", symbol: "091180.KS", keywords: ["kodex 2\uCC28\uC804\uC9C0", "\uCF54\uB371\uC2A4 2\uCC28\uC804\uC9C0"] },
];

function searchKorean(query: string): SearchResult[] {
  const q = query.toLowerCase().trim();
  return KOREAN_STOCKS
    .filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        item.symbol.toLowerCase().includes(q) ||
        item.keywords.some((kw) => kw.includes(q))
    )
    .slice(0, 15)
    .map((item) => ({
      symbol: item.symbol,
      name: item.name,
      type: item.symbol.includes(".KQ") ? "EQUITY (KOSDAQ)" : "EQUITY (KOSPI)",
      exchange: item.symbol.includes(".KQ") ? "KOSDAQ" : "KOSPI",
    }));
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
      // Korean query: search local DB (Yahoo doesn't support Korean text search)
      const koreanResults = searchKorean(query);
      results.push(...koreanResults);
    } else {
      // English/code query: search Yahoo Finance (covers all US/KR/global stocks & ETFs)
      const yahooResults = await searchYahoo(query);
      results.push(...yahooResults);

      // Also check local Korean DB for romanized names (samsung, hyundai, etc.)
      const koreanResults = searchKorean(query);
      // Add Korean results that aren't already in Yahoo results
      const existingSymbols = new Set(results.map((r) => r.symbol));
      for (const kr of koreanResults) {
        if (!existingSymbols.has(kr.symbol)) {
          results.push(kr);
        }
      }
    }

    return NextResponse.json({ results: results.slice(0, 15) });
  } catch (error) {
    console.error("Search error:", error);
    return NextResponse.json({ results: [] });
  }
}
