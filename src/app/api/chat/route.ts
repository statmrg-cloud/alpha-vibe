import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

// 시장 전체 관련 질문인지 감지
function isMarketOverviewQuestion(message: string): boolean {
  const keywords = [
    "시장", "마켓", "장세", "증시", "지수", "오늘", "코스피", "나스닥",
    "S&P", "다우", "금리", "경기", "전망", "요약", "브리핑", "동향",
    "시황", "장마감", "장중", "선물", "환율", "유가", "금값",
    "market", "overview", "summary", "today",
  ];
  const lower = message.toLowerCase();
  return keywords.some((kw) => lower.includes(kw.toLowerCase()));
}

// 주요 시장 지수 실시간 조회
const MARKET_SYMBOLS = [
  { symbol: "^GSPC", name: "S&P 500" },
  { symbol: "^IXIC", name: "NASDAQ" },
  { symbol: "^DJI", name: "Dow Jones" },
  { symbol: "^KS11", name: "KOSPI" },
  { symbol: "^N225", name: "Nikkei 225" },
  { symbol: "BTC-USD", name: "Bitcoin" },
  { symbol: "KRW=X", name: "USD/KRW" },
  { symbol: "CL=F", name: "WTI 원유" },
  { symbol: "GC=F", name: "Gold" },
  { symbol: "^VIX", name: "VIX 변동성" },
];

// Yahoo Finance Chart API를 직접 호출 (yahoo-finance2 라이브러리 불안정 대체)
async function fetchYahooQuote(symbol: string): Promise<{
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
  fiftyDayAvg: number | null;
  twoHundredDayAvg: number | null;
} | null> {
  try {
    const encoded = encodeURIComponent(symbol);
    // range=1d로 조회해야 chartPreviousClose가 전일 종가를 정확히 반환
    // range=5d를 사용하면 5일 전 종가 대비로 변동률이 크게 부풀려짐
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encoded}?interval=1d&range=1d`;
    const res = await fetch(url, {
      cache: "no-store",
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const meta = data?.chart?.result?.[0]?.meta;
    if (!meta) return null;

    const price = meta.regularMarketPrice ?? 0;
    const previousClose = meta.chartPreviousClose ?? meta.previousClose ?? 0;
    const change = previousClose > 0 ? price - previousClose : 0;
    const changePercent = previousClose > 0 ? (change / previousClose) * 100 : 0;

    // 일별 OHLCV (가장 최근 거래일)
    const indicators = data?.chart?.result?.[0]?.indicators?.quote?.[0];
    const timestamps = data?.chart?.result?.[0]?.timestamp || [];
    const lastIdx = timestamps.length - 1;

    return {
      symbol: meta.symbol || symbol,
      name: meta.shortName || meta.longName || symbol,
      price,
      change,
      changePercent,
      open: indicators?.open?.[lastIdx] ?? 0,
      high: indicators?.high?.[lastIdx] ?? 0,
      low: indicators?.low?.[lastIdx] ?? 0,
      previousClose,
      volume: indicators?.volume?.[lastIdx] ?? 0,
      marketCap: null,
      pe: null,
      eps: null,
      week52High: meta.fiftyTwoWeekHigh ?? null,
      week52Low: meta.fiftyTwoWeekLow ?? null,
      dividendYield: null,
      fiftyDayAvg: meta.fiftyDayAverage ?? null,
      twoHundredDayAvg: meta.twoHundredDayAverage ?? null,
    };
  } catch (err) {
    console.error(`[fetchYahooQuote] ${symbol} error:`, err);
    return null;
  }
}

async function fetchMarketOverview(): Promise<string> {
  try {
    const results = await Promise.all(
      MARKET_SYMBOLS.map(async (idx) => {
        try {
          const q = await fetchYahooQuote(idx.symbol);
          if (!q || q.price === 0) return `${idx.name}: 데이터 없음`;
          const sign = q.changePercent >= 0 ? "+" : "";
          return `${idx.name}: ${q.price.toLocaleString(undefined, { maximumFractionDigits: 2 })} (${sign}${q.changePercent.toFixed(2)}%, ${sign}${q.change.toFixed(2)})`;
        } catch {
          return `${idx.name}: 데이터 없음`;
        }
      })
    );
    const now = new Date();
    const dateStr = now.toLocaleDateString("ko-KR", {
      year: "numeric", month: "long", day: "numeric", weekday: "long",
    });
    const timeStr = now.toLocaleTimeString("ko-KR", {
      hour: "2-digit", minute: "2-digit",
    });
    return `\n\n[📊 실시간 시장 데이터 — ${dateStr} ${timeStr} 기준]\n─────────────────────────────\n${results.join("\n")}\n─────────────────────────────`;
  } catch {
    return "";
  }
}

function buildSystemPrompt(): string {
  const today = new Date();
  const dateStr = today.toLocaleDateString("ko-KR", {
    year: "numeric", month: "long", day: "numeric", weekday: "long",
  });
  return `오늘 날짜: ${dateStr}

당신은 월가에서 20년 경력을 가진 헤지펀드 전략가입니다.
Goldman Sachs, Bridgewater Associates 등 세계 최고 금융기관에서 근무했으며,
매크로 전략, 퀀트 분석, 리스크 관리에 탁월한 전문성을 보유하고 있습니다.

## 최우선 규칙: 실시간 데이터만 사용 (할루시네이션 금지)
사용자의 메시지에 [참고 실시간 데이터] 또는 [실시간 시장 데이터]가 첨부되어 있으면:
1. **오직 해당 첨부 데이터의 숫자만 인용**하세요. 절대로 숫자를 변경하거나 추측하지 마세요.
2. 첨부 데이터에 "현재가: ₩210,000"이라면, 리포트에서도 반드시 "₩210,000"이라고 써야 합니다.
3. **목표가/손절가를 제시할 때**: 반드시 첨부된 현재가를 기준으로 ±10~20% 범위 내에서 산출하세요. 현재가와 동떨어진 숫자를 제시하지 마세요.
4. 첨부 데이터에 없는 정보(PER, EPS, 시가총액 등)는 "데이터 미제공"이라고 표기하세요. 절대 추측하지 마세요.
5. 한국 주식(통화: KRW)은 원화(₩)로, 미국 주식(통화: USD)은 달러($)로 표기하세요.
6. 변동률이 데이터에 "+0.50%"로 제공되면 "8% 상승" 같은 과장을 하지 마세요. 정확한 수치만 인용하세요.

## 절대 하지 말 것
- 첨부 데이터에 없는 가격, 지표, 수치를 지어내기
- 과거 학습 데이터의 가격을 현재 가격처럼 사용하기
- 데이터가 "N/A"인 항목을 임의의 숫자로 채우기

## 중요: 이 플랫폼의 매매 기능
이 플랫폼(Alpha-Vibe)은 실제 매매 기능이 내장되어 있습니다.
- 모의투자(Paper Trading): 1억원 가상 자금으로 즉시 매수/매도 가능
- Alpaca Paper Trading: 실제 시장 데이터 기반 모의매매 가능
- 자동매매: AI 분석 + 기술적 지표 기반 자동 매수 기능

따라서 사용자가 "매수해줘", "사줘", "팔아줘" 등의 요청을 하면,
절대 "매매를 실행할 수 없다"고 거절하지 마세요.
대신 해당 종목을 분석한 후, 분석 결과 하단에 나타나는 [매수]/[매도] 버튼을 사용하도록 안내하세요.
예: "아래 분석을 확인하신 후, 하단의 매수 버튼을 클릭하시면 즉시 매수됩니다."

## 분석 원칙
- 데이터 기반의 냉철한 판단을 내립니다
- 시장 심리와 기술적 지표를 종합적으로 고려합니다
- 리스크를 항상 최우선으로 평가합니다
- 개인 투자자도 이해할 수 있는 명확한 언어를 사용합니다

## 응답 규칙
종목 분석 요청 또는 매수/매도 요청 시 반드시 아래 형식으로 응답하세요:

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 [종목명] (티커) 투자 분석 리포트
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

【1. 투자 등급】
🟢 매수(BUY) / 🟡 보유(HOLD) / 🔴 매도(SELL) 중 하나

【2. 핵심 근거 3가지】
① (첫 번째 근거 - 데이터 기반)
② (두 번째 근거 - 시장/산업 맥락)
③ (세 번째 근거 - 기술적/모멘텀 분석)

【3. 리스크 요인】
⚠️ (주요 하방 리스크 2~3가지)

【부가 정보】
- 목표가 / 손절가 제안
- 투자 시계 (단기/중기/장기)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

매수/매도 요청 시에는 분석 후 반드시 이 문구를 추가하세요:
"위 분석을 참고하신 후, 아래에 표시된 [매수] 또는 [실매수] 버튼을 클릭하시면 바로 주문이 실행됩니다."

종목 분석이 아닌 일반 시장 질문에는 전문가 관점에서 자유롭게 답변하되,
항상 근거와 데이터를 함께 제시하세요.

⚠️ 모든 분석은 참고용이며, 투자 판단의 최종 책임은 투자자에게 있음을 명시하세요.`;
}

// 한글 종목명 → 티커 매핑 (주요 종목)
const KOREAN_STOCK_MAP: Record<string, string> = {
  // 미국 주식 (한글 입력 대응)
  애플: "AAPL",
  아이폰: "AAPL",
  엔비디아: "NVDA",
  마이크로소프트: "MSFT",
  테슬라: "TSLA",
  아마존: "AMZN",
  구글: "GOOGL",
  알파벳: "GOOGL",
  메타: "META",
  넷플릭스: "NFLX",
  // 한국 주식
  삼성전자: "005930.KS",
  SK하이닉스: "000660.KS",
  하이닉스: "000660.KS",
  네이버: "035420.KS",
  카카오: "035720.KS",
  현대차: "005380.KS",
  현대자동차: "005380.KS",
  LG에너지솔루션: "373220.KS",
  셀트리온: "068270.KS",
  기아: "000270.KS",
  포스코홀딩스: "005490.KS",
  삼성바이오로직스: "207940.KS",
  삼성SDI: "006400.KS",
  LG화학: "051910.KS",
  현대모비스: "012330.KS",
  KB금융: "105560.KS",
  신한지주: "055550.KS",
  하나금융지주: "086790.KS",
  삼성물산: "028260.KS",
  한국전력: "015760.KS",
  크래프톤: "259960.KS",
  루닛: "328130.KS",
  에이비엘바이오: "298380.KS",
  미래에셋증권: "006800.KS",
  미래에셋: "006800.KS",
  한화에어로스페이스: "012450.KS",
  한화오션: "042660.KS",
  에코프로비엠: "247540.KS",
  에코프로: "086520.KS",
  한미반도체: "042700.KS",
};

// 사용자 메시지에서 종목 심볼 추출
function extractSymbols(message: string): string[] {
  const symbols: string[] = [];

  // 1. 한글 종목명 매칭
  for (const [name, ticker] of Object.entries(KOREAN_STOCK_MAP)) {
    if (message.includes(name)) {
      symbols.push(ticker);
    }
  }

  // 2. 영문 티커 매칭 (대문자 1~5글자, $ 접두사 포함)
  const tickerPattern = /\$?([A-Z]{1,5})(?:\s|$|[,.])/g;
  let match;
  while ((match = tickerPattern.exec(message.toUpperCase())) !== null) {
    const ticker = match[1];
    // 일반 영어 단어 제외
    const excludeWords = new Set([
      "AI", "API", "CEO", "CFO", "ETF", "IPO", "GDP", "CPI",
      "FED", "SEC", "NYSE", "THE", "AND", "FOR", "BUT", "NOT",
      "BUY", "SELL", "HOLD", "WITH", "FROM", "THIS", "THAT",
    ]);
    if (!excludeWords.has(ticker) && ticker.length >= 2) {
      symbols.push(ticker);
    }
  }

  return Array.from(new Set(symbols));
}

// 한국 주식 여부 확인
function isKoreanStock(symbol: string): boolean {
  return symbol.endsWith(".KS") || symbol.endsWith(".KQ");
}

// 주식 데이터를 컨텍스트 문자열로 변환
function formatStockContext(d: Record<string, unknown>): string {
  const fmt = (v: unknown) => (v != null ? String(v) : "N/A");
  const symbol = String(d.symbol || "");
  const isKR = isKoreanStock(symbol);
  const currency = isKR ? "₩" : "$";
  const currencyLabel = isKR ? "KRW" : "USD";

  const fmtPrice = (v: unknown) => {
    if (v == null) return "N/A";
    const num = Number(v);
    return isKR
      ? `${currency}${Math.round(num).toLocaleString()}`
      : `${currency}${num.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  };
  const fmtPct = (v: unknown) =>
    v != null ? `${Number(v) >= 0 ? "+" : ""}${Number(v).toFixed(2)}%` : "N/A";
  const fmtVol = (v: unknown) =>
    v != null ? Number(v).toLocaleString() : "N/A";

  return `
📈 실시간 시세 데이터 [${fmt(d.name)} (${fmt(d.symbol)})] — 통화: ${currencyLabel}
─────────────────────────────
현재가: ${fmtPrice(d.price)} (${fmtPct(d.changePercent)})
시가: ${fmtPrice(d.open)} | 고가: ${fmtPrice(d.high)} | 저가: ${fmtPrice(d.low)}
전일종가: ${fmtPrice(d.previousClose)}
거래량: ${fmtVol(d.volume)}
52주 최고: ${fmtPrice(d.week52High)} | 52주 최저: ${fmtPrice(d.week52Low)}
50일 이평: ${fmtPrice(d.fiftyDayAvg)} | 200일 이평: ${fmtPrice(d.twoHundredDayAvg)}
─────────────────────────────`.trim();
}

export async function POST(request: NextRequest) {
  try {
    const { message, history } = await request.json();

    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { error: "message 필드가 필요합니다." },
        { status: 400 }
      );
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey || apiKey === "your_anthropic_api_key_here") {
      return NextResponse.json(
        { error: "ANTHROPIC_API_KEY가 설정되지 않았습니다. .env.local을 확인하세요." },
        { status: 500 }
      );
    }

    // 1. 메시지에서 종목 심볼 추출
    const symbols = extractSymbols(message);

    // 2. 종목 데이터 + 시장 개요 데이터 조회
    let stockContext = "";

    // 2a. 개별 종목 데이터
    if (symbols.length > 0) {
      const stockResults = await Promise.all(symbols.map(fetchYahooQuote));
      const validResults = stockResults.filter(Boolean);

      if (validResults.length > 0) {
        stockContext =
          "\n\n[참고 실시간 데이터]\n" +
          validResults.map((d) => formatStockContext(d as Record<string, unknown>)).join("\n\n");
      }
    }

    // 2b. 시장 전체 질문이면 주요 지수 데이터도 추가
    if (isMarketOverviewQuestion(message)) {
      const marketContext = await fetchMarketOverview();
      stockContext += marketContext;
    }

    // 3. 사용자 메시지에 주식 데이터 컨텍스트 추가
    const enrichedMessage = stockContext
      ? `${message}\n${stockContext}`
      : message;

    // 4. 대화 히스토리 구성
    const messages: Array<{ role: "user" | "assistant"; content: string }> = [];

    if (Array.isArray(history)) {
      for (const msg of history.slice(-10)) {
        if (msg.role === "user" || msg.role === "assistant") {
          messages.push({ role: msg.role, content: msg.content });
        }
      }
    }
    messages.push({ role: "user", content: enrichedMessage });

    // 5. Claude API 호출 (동적 시스템 프롬프트 — 오늘 날짜 포함)
    const anthropic = new Anthropic({ apiKey });

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2048,
      system: buildSystemPrompt(),
      messages,
    });

    const assistantMessage =
      response.content[0].type === "text" ? response.content[0].text : "";

    return NextResponse.json({
      message: assistantMessage,
      symbols,
      stockData: symbols.length > 0 ? true : false,
    });
  } catch (error) {
    console.error("Chat API 오류:", error);
    const errorMessage =
      error instanceof Error ? error.message : "알 수 없는 오류";
    return NextResponse.json(
      { error: `AI 분석 중 오류가 발생했습니다: ${errorMessage}` },
      { status: 500 }
    );
  }
}
