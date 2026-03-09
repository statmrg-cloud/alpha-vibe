// 기술적 지표 계산 유틸리티

export interface OHLCV {
  time: number;
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// SMA (Simple Moving Average)
export function calcSMA(data: OHLCV[], period: number): (number | null)[] {
  const result: (number | null)[] = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push(null);
    } else {
      let sum = 0;
      for (let j = i - period + 1; j <= i; j++) {
        sum += data[j].close;
      }
      result.push(sum / period);
    }
  }
  return result;
}

// EMA (Exponential Moving Average)
export function calcEMA(data: OHLCV[], period: number): (number | null)[] {
  const result: (number | null)[] = [];
  const multiplier = 2 / (period + 1);

  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push(null);
    } else if (i === period - 1) {
      // 첫 EMA = SMA
      let sum = 0;
      for (let j = 0; j < period; j++) {
        sum += data[j].close;
      }
      result.push(sum / period);
    } else {
      const prev = result[i - 1];
      if (prev === null) {
        result.push(null);
      } else {
        result.push((data[i].close - prev) * multiplier + prev);
      }
    }
  }
  return result;
}

// CCI (Commodity Channel Index)
export function calcCCI(data: OHLCV[], period: number = 20): (number | null)[] {
  const result: (number | null)[] = [];

  // Typical Price = (High + Low + Close) / 3
  const tp = data.map((d) => (d.high + d.low + d.close) / 3);

  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push(null);
    } else {
      // SMA of TP
      let tpSum = 0;
      for (let j = i - period + 1; j <= i; j++) {
        tpSum += tp[j];
      }
      const tpSMA = tpSum / period;

      // Mean Deviation
      let mdSum = 0;
      for (let j = i - period + 1; j <= i; j++) {
        mdSum += Math.abs(tp[j] - tpSMA);
      }
      const md = mdSum / period;

      // CCI = (TP - SMA(TP)) / (0.015 * MD)
      if (md === 0) {
        result.push(0);
      } else {
        result.push((tp[i] - tpSMA) / (0.015 * md));
      }
    }
  }
  return result;
}

// RSI (Relative Strength Index)
export function calcRSI(data: OHLCV[], period: number = 14): (number | null)[] {
  const result: (number | null)[] = [];

  if (data.length < period + 1) {
    return data.map(() => null);
  }

  let avgGain = 0;
  let avgLoss = 0;

  // 초기 평균 계산
  for (let i = 1; i <= period; i++) {
    const change = data[i].close - data[i - 1].close;
    if (change > 0) avgGain += change;
    else avgLoss += Math.abs(change);
  }
  avgGain /= period;
  avgLoss /= period;

  for (let i = 0; i < data.length; i++) {
    if (i < period) {
      result.push(null);
    } else if (i === period) {
      const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
      result.push(100 - 100 / (1 + rs));
    } else {
      const change = data[i].close - data[i - 1].close;
      const gain = change > 0 ? change : 0;
      const loss = change < 0 ? Math.abs(change) : 0;
      avgGain = (avgGain * (period - 1) + gain) / period;
      avgLoss = (avgLoss * (period - 1) + loss) / period;
      const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
      result.push(100 - 100 / (1 + rs));
    }
  }
  return result;
}

// MACD (Moving Average Convergence Divergence)
export function calcMACD(
  data: OHLCV[],
  fastPeriod: number = 12,
  slowPeriod: number = 26,
  signalPeriod: number = 9
): { macd: (number | null)[]; signal: (number | null)[]; histogram: (number | null)[] } {
  const emaFast = calcEMA(data, fastPeriod);
  const emaSlow = calcEMA(data, slowPeriod);

  const macdLine: (number | null)[] = [];
  for (let i = 0; i < data.length; i++) {
    if (emaFast[i] !== null && emaSlow[i] !== null) {
      macdLine.push(emaFast[i]! - emaSlow[i]!);
    } else {
      macdLine.push(null);
    }
  }

  // Signal line = EMA of MACD
  const signalLine: (number | null)[] = [];
  const multiplier = 2 / (signalPeriod + 1);

  let signalIdx = 0;
  let signalEma: number | null = null;

  for (let i = 0; i < data.length; i++) {
    if (macdLine[i] === null) {
      signalLine.push(null);
    } else {
      if (signalIdx < signalPeriod - 1) {
        signalLine.push(null);
      } else if (signalIdx === signalPeriod - 1) {
        let sum = 0;
        let count = 0;
        for (let j = 0; j <= i; j++) {
          if (macdLine[j] !== null) {
            sum += macdLine[j]!;
            count++;
            if (count >= signalPeriod) break;
          }
        }
        signalEma = count > 0 ? sum / count : null;
        signalLine.push(signalEma);
      } else {
        if (signalEma !== null) {
          signalEma = (macdLine[i]! - signalEma) * multiplier + signalEma;
          signalLine.push(signalEma);
        } else {
          signalLine.push(null);
        }
      }
      signalIdx++;
    }
  }

  const histogram: (number | null)[] = [];
  for (let i = 0; i < data.length; i++) {
    if (macdLine[i] !== null && signalLine[i] !== null) {
      histogram.push(macdLine[i]! - signalLine[i]!);
    } else {
      histogram.push(null);
    }
  }

  return { macd: macdLine, signal: signalLine, histogram };
}

// 볼린저 밴드
export function calcBollingerBands(
  data: OHLCV[],
  period: number = 20,
  multiplier: number = 2
): { upper: (number | null)[]; middle: (number | null)[]; lower: (number | null)[] } {
  const sma = calcSMA(data, period);
  const upper: (number | null)[] = [];
  const lower: (number | null)[] = [];

  for (let i = 0; i < data.length; i++) {
    if (sma[i] === null || i < period - 1) {
      upper.push(null);
      lower.push(null);
    } else {
      let variance = 0;
      for (let j = i - period + 1; j <= i; j++) {
        variance += Math.pow(data[j].close - sma[i]!, 2);
      }
      const stdDev = Math.sqrt(variance / period);
      upper.push(sma[i]! + multiplier * stdDev);
      lower.push(sma[i]! - multiplier * stdDev);
    }
  }

  return { upper, middle: sma, lower };
}

// 골든크로스/데드크로스 신호 감지
export interface CrossSignal {
  index: number;
  type: "golden" | "dead";
  time: number;
  price: number;
}

export function detectCrosses(
  smaShort: (number | null)[],
  smaLong: (number | null)[]
): CrossSignal[] {
  const signals: CrossSignal[] = [];
  for (let i = 1; i < smaShort.length; i++) {
    if (
      smaShort[i] !== null &&
      smaShort[i - 1] !== null &&
      smaLong[i] !== null &&
      smaLong[i - 1] !== null
    ) {
      const prevDiff = smaShort[i - 1]! - smaLong[i - 1]!;
      const currDiff = smaShort[i]! - smaLong[i]!;
      if (prevDiff <= 0 && currDiff > 0) {
        signals.push({ index: i, type: "golden", time: 0, price: smaShort[i]! });
      } else if (prevDiff >= 0 && currDiff < 0) {
        signals.push({ index: i, type: "dead", time: 0, price: smaShort[i]! });
      }
    }
  }
  return signals;
}
