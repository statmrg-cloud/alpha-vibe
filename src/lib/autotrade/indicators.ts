/**
 * 기술적 지표 분석 모듈
 * RSI, 이동평균, MACD, 볼린저밴드 등 자동매매 판단에 사용
 */

export interface OHLCV {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface TechnicalSignals {
  rsi14: number | null;
  sma20: number | null;
  sma50: number | null;
  sma200: number | null;
  priceVsSma20: number; // 현재가 vs SMA20 (%)
  priceVsSma50: number;
  macdLine: number | null;
  macdSignal: number | null;
  macdHistogram: number | null;
  bollingerUpper: number | null;
  bollingerLower: number | null;
  bollingerPosition: number | null; // 0~1 (하단~상단)
  avgVolume20: number | null;
  volumeRatio: number | null; // 오늘 거래량 / 20일 평균
  overallScore: number; // -100 ~ +100 종합 점수
  signal: "STRONG_BUY" | "BUY" | "NEUTRAL" | "SELL" | "STRONG_SELL";
}

// RSI (Relative Strength Index)
function calcRSI(closes: number[], period: number = 14): number | null {
  if (closes.length < period + 1) return null;

  let gains = 0;
  let losses = 0;

  for (let i = closes.length - period; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }

  const avgGain = gains / period;
  const avgLoss = losses / period;

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

// SMA (Simple Moving Average)
function calcSMA(closes: number[], period: number): number | null {
  if (closes.length < period) return null;
  const slice = closes.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

// EMA (Exponential Moving Average)
function calcEMA(closes: number[], period: number): number | null {
  if (closes.length < period) return null;
  const k = 2 / (period + 1);
  let ema = closes.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < closes.length; i++) {
    ema = closes[i] * k + ema * (1 - k);
  }
  return ema;
}

// MACD
function calcMACD(closes: number[]): {
  line: number | null;
  signal: number | null;
  histogram: number | null;
} {
  const ema12 = calcEMA(closes, 12);
  const ema26 = calcEMA(closes, 26);

  if (ema12 === null || ema26 === null) {
    return { line: null, signal: null, histogram: null };
  }

  const line = ema12 - ema26;

  // 간소화된 시그널 계산
  const macdValues: number[] = [];
  const k12 = 2 / 13;
  const k26 = 2 / 27;
  let e12 = closes.slice(0, 12).reduce((a, b) => a + b, 0) / 12;
  let e26 = closes.slice(0, 26).reduce((a, b) => a + b, 0) / 26;

  for (let i = 26; i < closes.length; i++) {
    e12 = closes[i] * k12 + e12 * (1 - k12);
    e26 = closes[i] * k26 + e26 * (1 - k26);
    macdValues.push(e12 - e26);
  }

  let signal: number | null = null;
  if (macdValues.length >= 9) {
    const k9 = 2 / 10;
    signal = macdValues.slice(0, 9).reduce((a, b) => a + b, 0) / 9;
    for (let i = 9; i < macdValues.length; i++) {
      signal = macdValues[i] * k9 + signal * (1 - k9);
    }
  }

  const histogram = signal !== null ? line - signal : null;
  return { line, signal, histogram };
}

// 볼린저밴드
function calcBollinger(
  closes: number[],
  period: number = 20,
  stdDev: number = 2
): { upper: number | null; lower: number | null; position: number | null } {
  if (closes.length < period) {
    return { upper: null, lower: null, position: null };
  }

  const slice = closes.slice(-period);
  const sma = slice.reduce((a, b) => a + b, 0) / period;
  const variance =
    slice.reduce((sum, val) => sum + Math.pow(val - sma, 2), 0) / period;
  const sd = Math.sqrt(variance);

  const upper = sma + stdDev * sd;
  const lower = sma - stdDev * sd;
  const currentPrice = closes[closes.length - 1];
  const position = upper !== lower ? (currentPrice - lower) / (upper - lower) : 0.5;

  return { upper, lower, position };
}

// 종합 기술적 분석
export function analyzeTechnicals(data: OHLCV[]): TechnicalSignals {
  const closes = data.map((d) => d.close);
  const volumes = data.map((d) => d.volume);
  const currentPrice = closes[closes.length - 1] || 0;

  const rsi14 = calcRSI(closes, 14);
  const sma20 = calcSMA(closes, 20);
  const sma50 = calcSMA(closes, 50);
  const sma200 = calcSMA(closes, 200);
  const macd = calcMACD(closes);
  const bollinger = calcBollinger(closes, 20, 2);
  const avgVolume20 = calcSMA(volumes, 20);

  const priceVsSma20 =
    sma20 && currentPrice ? ((currentPrice - sma20) / sma20) * 100 : 0;
  const priceVsSma50 =
    sma50 && currentPrice ? ((currentPrice - sma50) / sma50) * 100 : 0;
  const volumeRatio =
    avgVolume20 && volumes.length > 0
      ? volumes[volumes.length - 1] / avgVolume20
      : null;

  // 종합 점수 계산 (-100 ~ +100)
  let score = 0;
  let factors = 0;

  // RSI 점수 (과매도 = 강매수, 과매수 = 강매도)
  if (rsi14 !== null) {
    if (rsi14 < 30) score += 30;
    else if (rsi14 < 40) score += 15;
    else if (rsi14 > 70) score -= 30;
    else if (rsi14 > 60) score -= 15;
    factors++;
  }

  // 이동평균 정배열 점수
  if (sma20 !== null && sma50 !== null) {
    if (currentPrice > sma20 && sma20 > sma50) score += 20; // 골든크로스 상태
    else if (currentPrice < sma20 && sma20 < sma50) score -= 20; // 데드크로스 상태
    factors++;
  }

  // 가격 vs SMA20 위치
  if (sma20 !== null) {
    if (priceVsSma20 > 0 && priceVsSma20 < 5) score += 10; // 약간 위
    else if (priceVsSma20 < -5) score += 15; // 이평선 하방 이탈 → 반등 기대
    else if (priceVsSma20 > 10) score -= 10; // 과열
    factors++;
  }

  // MACD 점수
  if (macd.histogram !== null) {
    if (macd.histogram > 0 && macd.line !== null && macd.line > 0) score += 15;
    else if (macd.histogram < 0 && macd.line !== null && macd.line < 0)
      score -= 15;
    factors++;
  }

  // 볼린저밴드 위치
  if (bollinger.position !== null) {
    if (bollinger.position < 0.1) score += 20; // 하단 터치 → 매수 기회
    else if (bollinger.position > 0.9) score -= 20; // 상단 터치 → 과열
    factors++;
  }

  // 거래량 점수
  if (volumeRatio !== null) {
    if (volumeRatio > 2.0 && score > 0) score += 10; // 상승 + 대량 거래
    else if (volumeRatio > 2.0 && score < 0) score -= 10; // 하락 + 대량 거래
    factors++;
  }

  // 정규화
  const normalizedScore = factors > 0 ? Math.max(-100, Math.min(100, score)) : 0;

  // 시그널 결정
  let signal: TechnicalSignals["signal"];
  if (normalizedScore >= 50) signal = "STRONG_BUY";
  else if (normalizedScore >= 20) signal = "BUY";
  else if (normalizedScore <= -50) signal = "STRONG_SELL";
  else if (normalizedScore <= -20) signal = "SELL";
  else signal = "NEUTRAL";

  return {
    rsi14,
    sma20,
    sma50,
    sma200,
    priceVsSma20,
    priceVsSma50,
    macdLine: macd.line,
    macdSignal: macd.signal,
    macdHistogram: macd.histogram,
    bollingerUpper: bollinger.upper,
    bollingerLower: bollinger.lower,
    bollingerPosition: bollinger.position,
    avgVolume20,
    volumeRatio,
    overallScore: normalizedScore,
    signal,
  };
}
