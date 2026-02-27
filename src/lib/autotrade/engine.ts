/**
 * 자동매매 엔진
 * - node-cron 10분 간격 실행
 * - 관심종목 기술적 지표 + AI 분석
 * - Strong Buy 시그널 시 자동 매수
 * - 일일 최대 손실 제한 (Stop-loss)
 */

import * as cron from "node-cron";
import { analyzeTechnicals, OHLCV } from "./indicators";

// ── 타입 정의 ──

export interface AutoTradeConfig {
  enabled: boolean;
  watchlist: WatchlistItem[];
  maxOrderAmount: number; // 건당 최대 주문금액 (USD)
  dailyLossLimit: number; // 일일 최대 허용손실 (USD)
  cronInterval: string; // cron 표현식 (기본: "*/10 * * * *")
  requireStrongBuy: boolean; // true면 STRONG_BUY만, false면 BUY도 허용
  minTechnicalScore: number; // 최소 기술적 점수 (기본: 30)
}

export interface WatchlistItem {
  symbol: string;
  name: string;
  enabled: boolean;
}

export interface AutoTradeLog {
  id: string;
  timestamp: string;
  type: "CHECK" | "BUY" | "SKIP" | "STOP_LOSS" | "ERROR" | "START" | "STOP";
  symbol?: string;
  message: string;
  details?: Record<string, unknown>;
}

interface DailyPnL {
  date: string;
  realizedLoss: number;
  trades: number;
}

// ── 기본 설정 ──

const DEFAULT_CONFIG: AutoTradeConfig = {
  enabled: false,
  watchlist: [
    { symbol: "328130.KS", name: "루닛", enabled: true },
    { symbol: "298380.KS", name: "에이비엘바이오", enabled: true },
    { symbol: "NVDA", name: "NVIDIA", enabled: true },
    { symbol: "AAPL", name: "Apple", enabled: true },
  ],
  maxOrderAmount: 500,
  dailyLossLimit: 1000,
  cronInterval: "*/10 * * * *",
  requireStrongBuy: true,
  minTechnicalScore: 30,
};

// ── 엔진 상태 ──

let config: AutoTradeConfig = { ...DEFAULT_CONFIG };
let logs: AutoTradeLog[] = [];
let cronTask: ReturnType<typeof cron.schedule> | null = null;
let dailyPnL: DailyPnL = { date: "", realizedLoss: 0, trades: 0 };
let isRunning = false;

// ── 유틸리티 ──

function addLog(log: Omit<AutoTradeLog, "id" | "timestamp">) {
  const entry: AutoTradeLog = {
    ...log,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
  };
  logs.unshift(entry);
  // 최근 200개만 유지
  if (logs.length > 200) logs = logs.slice(0, 200);
  console.log(`[AutoTrade] ${entry.type}: ${entry.message}`);
}

function getTodayStr(): string {
  return new Date().toISOString().split("T")[0];
}

function resetDailyPnLIfNeeded() {
  const today = getTodayStr();
  if (dailyPnL.date !== today) {
    dailyPnL = { date: today, realizedLoss: 0, trades: 0 };
  }
}

// ── 주가 데이터 조회 (internal fetch → API routes) ──

async function fetchStockHistory(symbol: string): Promise<OHLCV[] | null> {
  try {
    // yahoo-finance2 직접 사용 (서버 사이드)
    const YahooFinance = (await import("yahoo-finance2")).default;
    const yf = new YahooFinance();

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 60); // 기술적 지표용 60일

    const result = await yf.chart(symbol, {
      period1: startDate,
      period2: endDate,
      interval: "1d",
    });

    return result.quotes
      .filter((q) => q.close != null)
      .map((q) => ({
        date: new Date(q.date).toISOString().split("T")[0],
        open: q.open ?? 0,
        high: q.high ?? 0,
        low: q.low ?? 0,
        close: q.close ?? 0,
        volume: q.volume ?? 0,
      }));
  } catch (error) {
    addLog({
      type: "ERROR",
      symbol,
      message: `주가 데이터 조회 실패: ${error instanceof Error ? error.message : "unknown"}`,
    });
    return null;
  }
}

// ── AI 분석 호출 ──

async function getAIAnalysis(
  symbol: string,
  name: string,
  currentPrice: number,
  technicalSignal: string,
  technicalScore: number
): Promise<{ signal: string; reasoning: string } | null> {
  try {
    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return null;

    const anthropic = new Anthropic({ apiKey });

    const prompt = `당신은 퀀트 트레이딩 알고리즘의 의사결정 모듈입니다.
다음 종목의 자동매매 여부를 판단해주세요.

종목: ${name} (${symbol})
현재가: $${currentPrice.toFixed(2)}
기술적 지표 시그널: ${technicalSignal}
기술적 점수: ${technicalScore}/100

다음 JSON 형식으로만 응답하세요 (다른 텍스트 없이):
{"signal": "STRONG_BUY" | "BUY" | "NEUTRAL" | "SELL" | "STRONG_SELL", "reasoning": "한줄 요약"}`;

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 200,
      messages: [{ role: "user", content: prompt }],
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";

    // JSON 추출
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return { signal: parsed.signal, reasoning: parsed.reasoning };
    }
    return null;
  } catch (error) {
    addLog({
      type: "ERROR",
      symbol,
      message: `AI 분석 실패: ${error instanceof Error ? error.message : "unknown"}`,
    });
    return null;
  }
}

// ── Alpaca 주문 실행 ──

async function executeAlpacaOrder(
  symbol: string,
  qty: number,
  side: "buy" | "sell"
): Promise<Record<string, unknown> | null> {
  const apiKey = process.env.ALPACA_API_KEY;
  const apiSecret = process.env.ALPACA_API_SECRET;
  const tradingUrl =
    process.env.ALPACA_TRADING_URL || "https://paper-api.alpaca.markets";

  if (!apiKey || !apiSecret) {
    addLog({ type: "ERROR", symbol, message: "Alpaca API 키 미설정" });
    return null;
  }

  try {
    const res = await fetch(`${tradingUrl}/v2/orders`, {
      method: "POST",
      headers: {
        "APCA-API-KEY-ID": apiKey,
        "APCA-API-SECRET-KEY": apiSecret,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        symbol: symbol.replace(".KS", ""), // 한국 종목은 Alpaca 미지원 → US만
        qty: qty.toString(),
        side,
        type: "market",
        time_in_force: "day",
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      addLog({
        type: "ERROR",
        symbol,
        message: `Alpaca 주문 실패: ${data.message || JSON.stringify(data)}`,
      });
      return null;
    }
    return data;
  } catch (error) {
    addLog({
      type: "ERROR",
      symbol,
      message: `주문 실행 오류: ${error instanceof Error ? error.message : "unknown"}`,
    });
    return null;
  }
}

// ── 포지션 P&L 조회 (Stop-loss 체크용) ──

async function checkDailyLoss(): Promise<number> {
  const apiKey = process.env.ALPACA_API_KEY;
  const apiSecret = process.env.ALPACA_API_SECRET;
  const tradingUrl =
    process.env.ALPACA_TRADING_URL || "https://paper-api.alpaca.markets";

  if (!apiKey || !apiSecret) return 0;

  try {
    const res = await fetch(`${tradingUrl}/v2/account`, {
      headers: {
        "APCA-API-KEY-ID": apiKey,
        "APCA-API-SECRET-KEY": apiSecret,
      },
    });

    if (!res.ok) return 0;
    const data = await res.json();

    const equity = parseFloat(data.equity);
    const lastEquity = parseFloat(data.last_equity);
    return equity - lastEquity; // 음수면 손실
  } catch {
    return 0;
  }
}

// ── 메인 체크 루틴 ──

async function runAutoTradeCheck() {
  if (isRunning) {
    addLog({ type: "SKIP", message: "이전 체크가 아직 실행 중입니다." });
    return;
  }

  isRunning = true;
  resetDailyPnLIfNeeded();

  try {
    // 1. 일일 손실 체크 (Stop-loss)
    const dailyChange = await checkDailyLoss();
    if (dailyChange < -config.dailyLossLimit) {
      addLog({
        type: "STOP_LOSS",
        message: `일일 손실 한도 도달! 금일 손실: $${Math.abs(dailyChange).toFixed(2)} / 한도: $${config.dailyLossLimit}`,
        details: { dailyChange, limit: config.dailyLossLimit },
      });
      isRunning = false;
      return;
    }

    const enabledWatchlist = config.watchlist.filter((w) => w.enabled);
    addLog({
      type: "CHECK",
      message: `${enabledWatchlist.length}개 종목 체크 시작 (일일 P&L: $${dailyChange >= 0 ? "+" : ""}${dailyChange.toFixed(2)})`,
    });

    // 2. 각 관심종목 분석
    for (const item of enabledWatchlist) {
      try {
        // 한국 종목은 Alpaca에서 매매 불가 → 로그만
        const isKorean = item.symbol.endsWith(".KS");

        // 주가 히스토리 조회
        const history = await fetchStockHistory(item.symbol);
        if (!history || history.length < 20) {
          addLog({
            type: "SKIP",
            symbol: item.symbol,
            message: `${item.name}: 데이터 부족 (${history?.length || 0}일)`,
          });
          continue;
        }

        // 기술적 지표 분석
        const technical = analyzeTechnicals(history);
        const currentPrice = history[history.length - 1].close;

        addLog({
          type: "CHECK",
          symbol: item.symbol,
          message: `${item.name}: $${currentPrice.toFixed(2)} | 기술점수: ${technical.overallScore} | 시그널: ${technical.signal} | RSI: ${technical.rsi14?.toFixed(1) ?? "N/A"}`,
          details: {
            price: currentPrice,
            score: technical.overallScore,
            signal: technical.signal,
            rsi: technical.rsi14,
            macd: technical.macdHistogram,
            bollingerPos: technical.bollingerPosition,
          },
        });

        // 기술적 점수 미달
        if (technical.overallScore < config.minTechnicalScore) {
          addLog({
            type: "SKIP",
            symbol: item.symbol,
            message: `${item.name}: 기술적 점수 미달 (${technical.overallScore} < ${config.minTechnicalScore})`,
          });
          continue;
        }

        // AI 분석 요청
        const aiResult = await getAIAnalysis(
          item.symbol,
          item.name,
          currentPrice,
          technical.signal,
          technical.overallScore
        );

        if (!aiResult) {
          addLog({
            type: "SKIP",
            symbol: item.symbol,
            message: `${item.name}: AI 분석 결과 없음`,
          });
          continue;
        }

        addLog({
          type: "CHECK",
          symbol: item.symbol,
          message: `${item.name} AI 판단: ${aiResult.signal} — ${aiResult.reasoning}`,
        });

        // 매수 조건 확인
        const isStrongBuy = aiResult.signal === "STRONG_BUY";
        const isBuy = aiResult.signal === "BUY";
        const shouldBuy = config.requireStrongBuy
          ? isStrongBuy
          : isStrongBuy || isBuy;

        if (!shouldBuy) {
          addLog({
            type: "SKIP",
            symbol: item.symbol,
            message: `${item.name}: AI 시그널 불일치 (${aiResult.signal}, 필요: ${config.requireStrongBuy ? "STRONG_BUY" : "BUY 이상"})`,
          });
          continue;
        }

        // 한국 종목은 Alpaca 미지원
        if (isKorean) {
          addLog({
            type: "SKIP",
            symbol: item.symbol,
            message: `${item.name}: 한국 종목은 Alpaca 자동매매 미지원 (수동 매매 권장)`,
            details: { signal: aiResult.signal, score: technical.overallScore },
          });
          continue;
        }

        // 주문 수량 계산
        const qty = Math.floor(config.maxOrderAmount / currentPrice);
        if (qty <= 0) {
          addLog({
            type: "SKIP",
            symbol: item.symbol,
            message: `${item.name}: 주문금액($${config.maxOrderAmount}) 대비 주가($${currentPrice.toFixed(2)})가 높아 매수 불가`,
          });
          continue;
        }

        // 자동 매수 실행
        const order = await executeAlpacaOrder(item.symbol, qty, "buy");
        if (order) {
          dailyPnL.trades++;
          addLog({
            type: "BUY",
            symbol: item.symbol,
            message: `${item.name} ${qty}주 자동매수 체결! (시장가, 주문ID: ${order.id})`,
            details: {
              qty,
              estimatedTotal: qty * currentPrice,
              orderId: order.id,
              technicalScore: technical.overallScore,
              aiSignal: aiResult.signal,
            },
          });
        }
      } catch (error) {
        addLog({
          type: "ERROR",
          symbol: item.symbol,
          message: `${item.name} 분석 오류: ${error instanceof Error ? error.message : "unknown"}`,
        });
      }

      // API 레이트 리밋 방지: 종목 간 2초 대기
      await new Promise((r) => setTimeout(r, 2000));
    }
  } catch (error) {
    addLog({
      type: "ERROR",
      message: `체크 루틴 오류: ${error instanceof Error ? error.message : "unknown"}`,
    });
  } finally {
    isRunning = false;
  }
}

// ── 엔진 제어 API ──

export function getConfig(): AutoTradeConfig {
  return { ...config };
}

export function updateConfig(updates: Partial<AutoTradeConfig>): AutoTradeConfig {
  config = { ...config, ...updates };
  // watchlist는 깊은 병합
  if (updates.watchlist) {
    config.watchlist = updates.watchlist;
  }
  addLog({
    type: "CHECK",
    message: `설정 업데이트: ${JSON.stringify(updates)}`,
  });
  return { ...config };
}

export function getLogs(limit: number = 50): AutoTradeLog[] {
  return logs.slice(0, limit);
}

export function clearLogs(): void {
  logs = [];
}

export function startEngine(): { success: boolean; message: string } {
  if (cronTask) {
    return { success: false, message: "자동매매가 이미 실행 중입니다." };
  }

  config.enabled = true;

  addLog({
    type: "START",
    message: `자동매매 엔진 시작 (간격: ${config.cronInterval}, 관심종목: ${config.watchlist.filter((w) => w.enabled).map((w) => w.name).join(", ")})`,
  });

  // 즉시 1회 실행
  runAutoTradeCheck();

  // cron 스케줄 등록
  cronTask = cron.schedule(config.cronInterval, () => {
    runAutoTradeCheck();
  });

  return { success: true, message: "자동매매 엔진이 시작되었습니다." };
}

export function stopEngine(): { success: boolean; message: string } {
  if (!cronTask) {
    return { success: false, message: "자동매매가 실행 중이 아닙니다." };
  }

  cronTask.stop();
  cronTask = null;
  config.enabled = false;

  addLog({ type: "STOP", message: "자동매매 엔진 중지" });

  return { success: true, message: "자동매매 엔진이 중지되었습니다." };
}

export function getStatus() {
  resetDailyPnLIfNeeded();
  return {
    enabled: config.enabled,
    isRunning,
    dailyPnL: { ...dailyPnL },
    logsCount: logs.length,
    watchlistCount: config.watchlist.filter((w) => w.enabled).length,
  };
}
