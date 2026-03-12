"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceLine,
  Cell,
  BarChart,
  Area,
  AreaChart,
} from "recharts";
import {
  OHLCV,
  calcSMA,
  calcCCI,
  calcRSI,
  calcMACD,
  calcBollingerBands,
  detectCrosses,
} from "@/lib/chart/indicators";
import ChartDrawingOverlay, {
  type DrawingTool,
  type DrawingSettings,
  type ChartDrawingOverlayHandle,
  COLOR_PRESETS,
  LINE_WIDTHS,
  DRAWING_TOOLS,
} from "@/components/chart/ChartDrawingOverlay";

// ─── 타입 ─────────────────────────────────────────────
interface LivePrice {
  price: number;
  change: number;
  changePercent: number;
  name: string;
}

interface StockChartProps {
  symbol: string;
  compact?: boolean;
}

type Timeframe = "1m" | "30m" | "60m" | "1D" | "1W" | "1M" | "3M" | "1Y" | "5Y";
type ChartType = "candle" | "line";
type SubIndicator = "volume" | "cci" | "rsi" | "macd";

interface IndicatorSettings {
  sma5: boolean;
  sma20: boolean;
  sma60: boolean;
  sma120: boolean;
  bb: boolean;
  gcdc: boolean;
}

interface ChartDataPoint {
  idx: number;
  date: string;
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  // 캔들 렌더링용
  candleBody: [number, number];
  wickHigh: number;
  wickLow: number;
  isUp: boolean;
  // 지표
  sma5?: number | null;
  sma20?: number | null;
  sma60?: number | null;
  sma120?: number | null;
  bbUpper?: number | null;
  bbMiddle?: number | null;
  bbLower?: number | null;
  cci?: number | null;
  rsi?: number | null;
  macd?: number | null;
  macdSignal?: number | null;
  macdHist?: number | null;
}

// ─── 타임프레임 설정 ─────────────────────────────────
const TIMEFRAMES: { key: Timeframe; label: string }[] = [
  { key: "1m", label: "1분" },
  { key: "30m", label: "30분" },
  { key: "60m", label: "60분" },
  { key: "1D", label: "1일" },
  { key: "1W", label: "1주" },
  { key: "1M", label: "1개월" },
  { key: "3M", label: "3개월" },
  { key: "1Y", label: "1년" },
  { key: "5Y", label: "5년" },
];

const SUB_INDICATORS: { key: SubIndicator; label: string }[] = [
  { key: "volume", label: "거래량" },
  { key: "cci", label: "CCI" },
  { key: "rsi", label: "RSI" },
  { key: "macd", label: "MACD" },
];

// 한국 종목 한글명 매핑
const TICKER_TO_KOREAN_NAME: Record<string, string> = {
  "005930.KS": "삼성전자", "000660.KS": "SK하이닉스", "035420.KS": "네이버",
  "035720.KS": "카카오", "005380.KS": "현대차", "373220.KS": "LG에너지솔루션",
  "068270.KS": "셀트리온", "000270.KS": "기아", "005490.KS": "포스코홀딩스",
  "207940.KS": "삼성바이오로직스", "006400.KS": "삼성SDI", "051910.KS": "LG화학",
  "012330.KS": "현대모비스", "105560.KS": "KB금융", "055550.KS": "신한지주",
  "086790.KS": "하나금융지주", "028260.KS": "삼성물산", "015760.KS": "한국전력",
  "259960.KS": "크래프톤", "328130.KS": "루닛", "298380.KS": "에이비엘바이오",
  "006800.KS": "미래에셋증권", "012450.KS": "한화에어로스페이스",
  "042660.KS": "한화오션", "247540.KS": "에코프로비엠",
  "086520.KS": "에코프로", "042700.KS": "한미반도체",
  "024110.KS": "기업은행", "316140.KS": "우리금융지주",
  "017670.KS": "SK텔레콤", "030200.KS": "KT", "066570.KS": "LG전자",
  "018260.KS": "삼성SDS", "034730.KS": "SK", "003550.KS": "LG",
  "009540.KS": "HD한국조선해양", "402340.KS": "SK스퀘어", "005935.KS": "삼성전자우",
  "000720.KS": "현대건설", "005940.KS": "NH투자증권",
  "096770.KS": "SK이노베이션", "034020.KS": "두산에너빌리티",
  "329180.KS": "HD현대중공업", "003670.KS": "POSCO퓨처엠",
  "032830.KS": "삼성생명", "000810.KS": "삼성화재",
  "009150.KS": "삼성전기", "010140.KS": "삼성중공업",
  "323410.KS": "카카오뱅크", "377300.KS": "카카오페이",
};

// ─── 캔들스틱 커스텀 Shape ─────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any
function CandleShape(props: any) {
  const { x, y, width, height, payload } = props;
  if (!payload) return null;

  const isUp = payload.isUp;
  const color = isUp ? "#22c55e" : "#ef4444";
  const bodyWidth = Math.max(width * 0.7, 2);
  const bodyX = x + (width - bodyWidth) / 2;
  const wickX = x + width / 2;

  // 캔들 body
  const bodyTop = y;
  const bodyHeight = Math.max(Math.abs(height), 1);

  return (
    <g>
      {/* 심지 (wick) */}
      <line
        x1={wickX}
        y1={props.wickHighY}
        x2={wickX}
        y2={props.wickLowY}
        stroke={color}
        strokeWidth={1}
      />
      {/* 몸통 (body) */}
      <rect
        x={bodyX}
        y={bodyTop}
        width={bodyWidth}
        height={bodyHeight}
        fill={isUp ? color : color}
        stroke={color}
        strokeWidth={0.5}
        opacity={isUp ? 0.9 : 0.9}
      />
    </g>
  );
}

// ─── 날짜 포맷 ──────────────────────────────────────
function formatDateLabel(dateStr: string, timeframe: Timeframe): string {
  const d = new Date(dateStr);
  if (timeframe === "1m" || timeframe === "30m" || timeframe === "60m" || timeframe === "1D") {
    return d.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
  }
  if (timeframe === "1W") {
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
  }
  if (timeframe === "1M" || timeframe === "3M") {
    return `${d.getMonth() + 1}/${d.getDate()}`;
  }
  return `${d.getFullYear().toString().slice(2)}/${d.getMonth() + 1}`;
}

// ─── 메인 컴포넌트 ──────────────────────────────────
export default function StockChart({ symbol, compact = false }: StockChartProps) {
  const [rawData, setRawData] = useState<OHLCV[]>([]);
  const [trend, setTrend] = useState<"up" | "down">("up");
  const [changePercent, setChangePercent] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [livePrice, setLivePrice] = useState<LivePrice | null>(null);
  const [priceFlash, setPriceFlash] = useState<"up" | "down" | null>(null);
  const prevPriceRef = useRef<number>(0);

  // 차트 설정 상태
  const [timeframe, setTimeframe] = useState<Timeframe>("1M");
  const [chartType, setChartType] = useState<ChartType>("candle");
  const [subIndicators, setSubIndicators] = useState<Set<SubIndicator>>(() => new Set<SubIndicator>(["volume"]));
  const [showSettings, setShowSettings] = useState(false);

  // 전체화면 & 그리기 모드
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fullscreenHeight, setFullscreenHeight] = useState(500);
  const [drawingMode, setDrawingMode] = useState(false);
  const drawingModeRef = useRef(false);
  const fullscreenRef = useRef<HTMLDivElement>(null);
  const chartAreaRef = useRef<HTMLDivElement>(null);
  const [chartDimensions, setChartDimensions] = useState({ width: 0, height: 0 });
  const drawingOverlayRef = useRef<ChartDrawingOverlayHandle>(null);
  const [drawingCount, setDrawingCount] = useState(0);

  // 그리기 도구 설정
  const [drawingTool, setDrawingTool] = useState<DrawingTool>("trendline");
  const [drawingColor, setDrawingColor] = useState("#ef4444");
  const [drawingLineWidth, setDrawingLineWidth] = useState(2);
  const [drawingLineStyle, setDrawingLineStyle] = useState<"solid" | "dashed" | "dotted">("solid");
  const [drawingFontSize, setDrawingFontSize] = useState(14);
  const [customColor, setCustomColor] = useState("#ef4444");

  const drawingSettings: DrawingSettings = useMemo(() => ({
    tool: drawingTool,
    color: drawingColor,
    lineWidth: drawingLineWidth,
    lineStyle: drawingLineStyle,
    fontSize: drawingFontSize,
  }), [drawingTool, drawingColor, drawingLineWidth, drawingLineStyle, drawingFontSize]);

  useEffect(() => { drawingModeRef.current = drawingMode; }, [drawingMode]);

  // 전체화면 높이 리사이즈 드래그
  const fsResizingRef = useRef<{ startY: number; startH: number } | null>(null);

  useEffect(() => {
    const handleFsResizeMove = (e: MouseEvent) => {
      if (!fsResizingRef.current) return;
      e.preventDefault();
      const delta = e.clientY - fsResizingRef.current.startY;
      const newH = Math.max(300, Math.min(window.innerHeight - 100, fsResizingRef.current.startH + delta));
      setFullscreenHeight(newH);
    };
    const handleFsResizeUp = () => { fsResizingRef.current = null; };
    document.addEventListener("mousemove", handleFsResizeMove);
    document.addEventListener("mouseup", handleFsResizeUp);
    return () => {
      document.removeEventListener("mousemove", handleFsResizeMove);
      document.removeEventListener("mouseup", handleFsResizeUp);
    };
  }, []);

  // ESC로 전체화면 & 그리기 모드 해제
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (drawingMode) setDrawingMode(false);
        else if (isFullscreen) setIsFullscreen(false);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isFullscreen, drawingMode]);

  // 차트 영역 크기 추적 (그리기 오버레이용)
  useEffect(() => {
    const el = chartAreaRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setChartDimensions({ width: entry.contentRect.width, height: entry.contentRect.height });
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [isFullscreen]);

  // 줌 상태: 전체 데이터 중 보여줄 범위 (0~1 비율)
  // 기본값: 최근 1/3만 표시 (나머지 2/3는 오른쪽 드래그로 과거 탐색 가능)
  const DEFAULT_ZOOM: [number, number] = [0.67, 1];
  const [zoomRange, setZoomRange] = useState<[number, number]>(DEFAULT_ZOOM);
  const chartContainerRef = useRef<HTMLDivElement>(null);

  // 드래그 패닝 상태
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ x: number; startRange: [number, number] } | null>(null);
  const zoomRangeRef = useRef(zoomRange);
  useEffect(() => { zoomRangeRef.current = zoomRange; }, [zoomRange]);

  const [indicators, setIndicators] = useState<IndicatorSettings>({
    sma5: true,
    sma20: false,
    sma60: false,
    sma120: false,
    bb: false,
    gcdc: false,
  });

  // SMA60/120용 일봉 데이터 (분봉 차트에서 진짜 일봉 이동평균을 그리기 위함)
  const [dailySmaData, setDailySmaData] = useState<Map<string, { sma60: number | null; sma120: number | null }>>(new Map());
  const needsDailySma = indicators.sma60 || indicators.sma120;

  // SMA60/120용 일봉 데이터 별도 fetch (분봉/주봉 차트에서 일봉 기준 이동평균 계산)
  useEffect(() => {
    if (!needsDailySma) {
      setDailySmaData(new Map());
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/stock/history?symbol=${encodeURIComponent(symbol)}&timeframe=sma200`
        );
        if (!res.ok || cancelled) return;
        const json = await res.json();
        const quotes: OHLCV[] = json.quotes || [];
        if (quotes.length < 60) return;

        const sma60Vals = calcSMA(quotes, 60);
        const sma120Vals = quotes.length >= 120 ? calcSMA(quotes, 120) : quotes.map(() => null);
        const smaMap = new Map<string, { sma60: number | null; sma120: number | null }>();
        quotes.forEach((q, i) => {
          const dateKey = new Date(q.date).toISOString().slice(0, 10);
          smaMap.set(dateKey, { sma60: sma60Vals[i], sma120: sma120Vals[i] });
        });
        if (!cancelled) setDailySmaData(smaMap);
      } catch { /* silent */ }
    })();
    return () => { cancelled = true; };
  }, [symbol, needsDailySma]);

  // ─── 데이터 fetch ──────────────────────────────────
  const fetchChartData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(
        `/api/stock/history?symbol=${encodeURIComponent(symbol)}&timeframe=${timeframe}`
      );
      if (!res.ok) throw new Error("데이터 로드 실패");
      const json = await res.json();
      setRawData(json.quotes || []);
      setTrend(json.trend || "up");
      setChangePercent(json.changePercent || 0);
    } catch {
      setError("차트 데이터를 불러올 수 없습니다");
    } finally {
      setLoading(false);
    }
  }, [symbol, timeframe]);

  const fetchLivePrice = useCallback(async () => {
    try {
      const res = await fetch(`/api/stock?symbol=${encodeURIComponent(symbol)}&lite=true`);
      if (!res.ok) return;
      const json = await res.json();
      const newPrice = json.price || 0;
      if (prevPriceRef.current > 0 && newPrice !== prevPriceRef.current) {
        setPriceFlash(newPrice > prevPriceRef.current ? "up" : "down");
        setTimeout(() => setPriceFlash(null), 800);
      }
      prevPriceRef.current = newPrice;
      setLivePrice({
        price: newPrice,
        change: json.change || 0,
        changePercent: json.changePercent || 0,
        name: json.name || symbol,
      });
    } catch {
      // silent
    }
  }, [symbol]);

  useEffect(() => {
    fetchChartData();
    fetchLivePrice();
  }, [fetchChartData, fetchLivePrice]);

  useEffect(() => {
    const priceInterval = setInterval(fetchLivePrice, 3000);     // 3초마다 실시간 가격 (lite 모드)
    const chartInterval = setInterval(fetchChartData, 60000);    // 1분마다 차트 갱신
    return () => {
      clearInterval(priceInterval);
      clearInterval(chartInterval);
    };
  }, [fetchLivePrice, fetchChartData]);

  // 타임프레임 변경 시 줌 리셋 (기본 뷰: 최근 1/3)
  useEffect(() => {
    setZoomRange(DEFAULT_ZOOM);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeframe]);

  // 마우스 휠 줌 핸들러 — document 레벨 캡처로 ScrollArea보다 먼저 잡음
  useEffect(() => {
    if (loading) return;

    const handleWheel = (e: WheelEvent) => {
      const container = chartContainerRef.current;
      if (!container) return;

      const target = e.target as Node;
      if (!container.contains(target)) return;

      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();

      setZoomRange((prev) => {
        const [start, end] = prev;
        const range = end - start;

        // 마우스 위치 기준 줌 중심점 계산
        const rect = container.getBoundingClientRect();
        const mouseX = (e.clientX - rect.left) / rect.width;
        const center = start + range * mouseX;

        // 줌인: 고정 비율 곱셈 (range가 작아져도 일정하게 줌됨)
        let newRange: number;
        if (e.deltaY > 0) {
          // 아래 스크롤 = 줌아웃 (범위 확대)
          newRange = Math.min(1, range * 1.25);
        } else {
          // 위 스크롤 = 줌인 (범위 축소)
          newRange = Math.max(0.05, range * 0.75);
        }

        let newStart = center - newRange * mouseX;
        let newEnd = newStart + newRange;

        if (newStart < 0) {
          newStart = 0;
          newEnd = newRange;
        }
        if (newEnd > 1) {
          newEnd = 1;
          newStart = 1 - newRange;
        }

        return [Math.max(0, newStart), Math.min(1, newEnd)];
      });
    };

    // document 레벨 캡처 → ScrollArea, Recharts 등 어떤 컴포넌트보다 먼저 이벤트를 잡음
    document.addEventListener("wheel", handleWheel, { passive: false, capture: true });
    return () => document.removeEventListener("wheel", handleWheel, { capture: true });
  }, [loading]);

  // 줌 버튼 핸들러
  const handleZoomIn = useCallback(() => {
    setZoomRange((prev) => {
      const [start, end] = prev;
      const range = end - start;
      const newRange = Math.max(0.05, range * 0.7);
      const center = (start + end) / 2;
      let newStart = center - newRange / 2;
      let newEnd = center + newRange / 2;
      if (newStart < 0) { newStart = 0; newEnd = newRange; }
      if (newEnd > 1) { newEnd = 1; newStart = 1 - newRange; }
      return [newStart, newEnd];
    });
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoomRange((prev) => {
      const [start, end] = prev;
      const range = end - start;
      const newRange = Math.min(1, range * 1.4);
      const center = (start + end) / 2;
      let newStart = center - newRange / 2;
      let newEnd = center + newRange / 2;
      if (newStart < 0) { newStart = 0; newEnd = newRange; }
      if (newEnd > 1) { newEnd = 1; newStart = 1 - newRange; }
      return [newStart, newEnd];
    });
  }, []);

  // 드래그 패닝 핸들러 (마우스 왼쪽 클릭 후 좌우 이동)
  // zoomRangeRef를 사용하여 이벤트 리스너가 드래그 중 재생성되지 않도록 함
  useEffect(() => {
    if (loading) return;

    const handleMouseDown = (e: MouseEvent) => {
      if (drawingModeRef.current) return; // 그리기 모드일 때 드래그 패닝 비활성화
      const container = chartContainerRef.current;
      if (!container) return;
      const target = e.target as Node;
      if (!container.contains(target)) return;
      if (e.button !== 0) return; // 왼쪽 클릭만

      e.preventDefault();
      e.stopPropagation();
      setIsDragging(true);
      dragStartRef.current = { x: e.clientX, startRange: [...zoomRangeRef.current] as [number, number] };
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!dragStartRef.current) return;
      const container = chartContainerRef.current;
      if (!container) return;

      e.preventDefault();
      const rect = container.getBoundingClientRect();
      const deltaX = e.clientX - dragStartRef.current.x;
      // 오른쪽 드래그(deltaX>0) → 과거(왼쪽) 데이터, 왼쪽 드래그(deltaX<0) → 미래(오른쪽) 데이터
      const deltaPct = -(deltaX / rect.width) * (dragStartRef.current.startRange[1] - dragStartRef.current.startRange[0]);

      const range = dragStartRef.current.startRange[1] - dragStartRef.current.startRange[0];
      let newStart = dragStartRef.current.startRange[0] + deltaPct;
      let newEnd = newStart + range;

      if (newStart < 0) { newStart = 0; newEnd = range; }
      if (newEnd > 1) { newEnd = 1; newStart = 1 - range; }

      setZoomRange([Math.max(0, newStart), Math.min(1, newEnd)]);
    };

    const handleMouseUp = () => {
      if (dragStartRef.current) {
        dragStartRef.current = null;
        setIsDragging(false);
      }
    };

    document.addEventListener("mousedown", handleMouseDown, { capture: true });
    document.addEventListener("mousemove", handleMouseMove, { capture: true });
    document.addEventListener("mouseup", handleMouseUp, { capture: true });
    return () => {
      document.removeEventListener("mousedown", handleMouseDown, { capture: true });
      document.removeEventListener("mousemove", handleMouseMove, { capture: true });
      document.removeEventListener("mouseup", handleMouseUp, { capture: true });
    };
  }, [loading]);

  // ─── 지표 계산 ──────────────────────────────────────
  const chartData: ChartDataPoint[] = useMemo(() => {
    if (rawData.length === 0) return [];

    const sma5 = indicators.sma5 ? calcSMA(rawData, 5) : null;
    const sma20 = indicators.sma20 ? calcSMA(rawData, 20) : null;
    const bb = indicators.bb ? calcBollingerBands(rawData) : null;
    const cci = subIndicators.has("cci") ? calcCCI(rawData) : null;
    const rsi = subIndicators.has("rsi") ? calcRSI(rawData) : null;
    const macd = subIndicators.has("macd") ? calcMACD(rawData) : null;

    // 일봉 SMA60/120 키 목록 (분봉에서 가장 가까운 날짜 매핑용)
    const dailyKeys = needsDailySma && dailySmaData.size > 0 ? Array.from(dailySmaData.keys()).sort() : [];

    return rawData.map((d, i) => {
      const isUp = d.close >= d.open;

      // SMA60/120: 일봉 데이터에서 해당 날짜 값을 매핑
      let sma60Val: number | null = null;
      let sma120Val: number | null = null;
      if (needsDailySma && dailySmaData.size > 0) {
        const dateKey = new Date(d.date).toISOString().slice(0, 10);
        let entry = dailySmaData.get(dateKey);
        if (!entry && dailyKeys.length > 0) {
          for (let k = dailyKeys.length - 1; k >= 0; k--) {
            if (dailyKeys[k] <= dateKey) {
              entry = dailySmaData.get(dailyKeys[k]);
              break;
            }
          }
        }
        if (entry) {
          sma60Val = indicators.sma60 ? entry.sma60 : null;
          sma120Val = indicators.sma120 ? entry.sma120 : null;
        }
      }

      return {
        idx: i,
        date: d.date,
        time: d.time,
        open: d.open,
        high: d.high,
        low: d.low,
        close: d.close,
        volume: d.volume,
        candleBody: isUp ? [d.open, d.close] : [d.close, d.open],
        wickHigh: d.high,
        wickLow: d.low,
        isUp,
        sma5: sma5 ? sma5[i] : null,
        sma20: sma20 ? sma20[i] : null,
        sma60: sma60Val,
        sma120: sma120Val,
        bbUpper: bb ? bb.upper[i] : null,
        bbMiddle: bb ? bb.middle[i] : null,
        bbLower: bb ? bb.lower[i] : null,
        cci: cci ? cci[i] : null,
        rsi: rsi ? rsi[i] : null,
        macd: macd ? macd.macd[i] : null,
        macdSignal: macd ? macd.signal[i] : null,
        macdHist: macd ? macd.histogram[i] : null,
      };
    });
  }, [rawData, indicators, subIndicators, needsDailySma, dailySmaData]);

  // ─── 줌 적용된 가시 데이터 ──────────────────────────────
  const visibleData = useMemo(() => {
    if (chartData.length === 0) return [];
    const startIdx = Math.floor(zoomRange[0] * chartData.length);
    const endIdx = Math.ceil(zoomRange[1] * chartData.length);
    return chartData.slice(startIdx, endIdx);
  }, [chartData, zoomRange]);

  const isZoomed = Math.abs(zoomRange[0] - DEFAULT_ZOOM[0]) > 0.01 || Math.abs(zoomRange[1] - DEFAULT_ZOOM[1]) > 0.01;

  // 골든/데드크로스 신호
  const crossSignals = useMemo(() => {
    if (!indicators.gcdc || rawData.length === 0) return [];
    const short = calcSMA(rawData, 5);
    const long = calcSMA(rawData, 20);
    return detectCrosses(short, long);
  }, [rawData, indicators.gcdc]);

  // ─── 가격 포맷 ──────────────────────────────────────
  const isKorean = symbol.endsWith(".KS") || symbol.endsWith(".KQ");
  const fmtPrice = (v: number) =>
    isKorean
      ? v.toLocaleString() + "원"
      : "$" + v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const fmtAxisPrice = (v: number) =>
    v >= 1000000 ? `${(v / 10000).toFixed(0)}만` : v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v.toFixed(1);

  // ─── 서브 지표 높이 (유저 조절 가능) ──────────────────────
  const [subHeights, setSubHeights] = useState<Record<SubIndicator, number>>({
    volume: 90, cci: 90, rsi: 90, macd: 90,
  });
  const subResizingRef = useRef<{ key: SubIndicator; startY: number; startH: number } | null>(null);

  useEffect(() => {
    const handleResizeMove = (e: MouseEvent) => {
      if (!subResizingRef.current) return;
      e.preventDefault();
      const delta = e.clientY - subResizingRef.current.startY;
      const newH = Math.max(50, Math.min(300, subResizingRef.current.startH + delta));
      setSubHeights((prev) => ({ ...prev, [subResizingRef.current!.key]: newH }));
    };
    const handleResizeUp = () => { subResizingRef.current = null; };
    document.addEventListener("mousemove", handleResizeMove);
    document.addEventListener("mouseup", handleResizeUp);
    return () => {
      document.removeEventListener("mousemove", handleResizeMove);
      document.removeEventListener("mouseup", handleResizeUp);
    };
  }, []);

  const renderResizeHandle = (key: SubIndicator) => (
    <div
      className="h-1.5 cursor-ns-resize group flex items-center justify-center hover:bg-primary/10 rounded transition-colors"
      onMouseDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
        subResizingRef.current = { key, startY: e.clientY, startH: subHeights[key] };
      }}
    >
      <div className="w-8 h-0.5 bg-slate-600 group-hover:bg-primary/50 rounded-full transition-colors" />
    </div>
  );

  // ─── 로딩/에러 ──────────────────────────────────────
  if (loading) {
    return (
      <div className={`flex items-center justify-center ${compact ? "h-[100px]" : "h-[400px]"}`}>
        <div className="flex gap-1">
          <div className="w-1 h-1 rounded-full bg-primary animate-bounce [animation-delay:0ms]" />
          <div className="w-1 h-1 rounded-full bg-primary animate-bounce [animation-delay:100ms]" />
          <div className="w-1 h-1 rounded-full bg-primary animate-bounce [animation-delay:200ms]" />
        </div>
      </div>
    );
  }

  if (error || chartData.length === 0) {
    return (
      <div className={`flex items-center justify-center ${compact ? "h-[100px]" : "h-[400px]"} text-xs font-mono text-slate-300`}>
        {error || "데이터 없음"}
      </div>
    );
  }

  // ─── 차트 범위 (가시 데이터 기준) ──────────────────────
  // Y축 domain은 순수 가격(high/low)과 볼린저밴드만으로 결정
  // SMA 라인은 Y축에 포함하지 않음 → 차트 뭉개짐 완전 방지
  // SMA가 범위 밖이면 자연스럽게 클리핑됨
  const allPrices = visibleData.flatMap((d) => [d.high, d.low]);
  if (indicators.bb) {
    visibleData.forEach((d) => {
      if (d.bbUpper != null) allPrices.push(d.bbUpper);
      if (d.bbLower != null) allPrices.push(d.bbLower);
    });
  }
  const minPrice = Math.min(...allPrices);
  const maxPrice = Math.max(...allPrices);
  const pricePadding = (maxPrice - minPrice) * 0.08 || 1;

  // compact 모드: 간단한 라인 차트만
  if (compact) {
    const isUp = trend === "up";
    const lineColor = isUp ? "#22c55e" : "#ef4444";
    const gradientId = `grad-${symbol.replace(/[^a-zA-Z0-9]/g, "")}`;
    return (
      <ResponsiveContainer width="100%" height={100}>
        <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={lineColor} stopOpacity={0.3} />
              <stop offset="100%" stopColor={lineColor} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <Area type="monotone" dataKey="close" stroke={lineColor} strokeWidth={1.5} fill={`url(#${gradientId})`} dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    );
  }

  const renderVolume = () => {
    const maxVol = Math.max(...visibleData.map((d) => d.volume));
    return (
      <div key="sub-volume">
        <div className="flex items-center gap-1 text-[11px] font-mono text-slate-400 mb-0.5">
          <span>거래량</span>
        </div>
        <ResponsiveContainer width="100%" height={subHeights.volume}>
          <BarChart data={visibleData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <XAxis dataKey="date" hide />
            <YAxis
              domain={[0, maxVol * 1.1]}
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 10, fill: "rgba(255,255,255,0.55)", fontFamily: "monospace" }}
              tickFormatter={(v: number) => v >= 1000000 ? `${(v / 1000000).toFixed(0)}M` : `${(v / 1000).toFixed(0)}K`}
              width={42}
            />
            <Bar dataKey="volume" maxBarSize={6}>
              {visibleData.map((d, i) => (
                <Cell key={i} fill={d.isUp ? "rgba(34,197,94,0.5)" : "rgba(239,68,68,0.5)"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        {renderResizeHandle("volume")}
      </div>
    );
  };

  const renderCCI = () => (
    <div key="sub-cci">
      <div className="flex items-center gap-1 text-[11px] font-mono text-slate-400 mb-0.5">
        <span className="text-cyan-400">CCI</span>
        <span className="text-slate-400">(-100/+100 기준선)</span>
      </div>
      <ResponsiveContainer width="100%" height={subHeights.cci}>
        <ComposedChart data={visibleData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
          <XAxis dataKey="date" hide />
          <YAxis
            domain={[-300, 300]}
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 10, fill: "rgba(255,255,255,0.55)", fontFamily: "monospace" }}
            ticks={[-200, -100, 0, 100, 200]}
            width={42}
          />
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
          <ReferenceLine y={100} stroke="rgba(239,68,68,0.4)" strokeDasharray="3 3" />
          <ReferenceLine y={-100} stroke="rgba(34,197,94,0.4)" strokeDasharray="3 3" />
          <ReferenceLine y={0} stroke="rgba(255,255,255,0.1)" />
          <Line type="monotone" dataKey="cci" stroke="#06b6d4" strokeWidth={1.5} dot={false} connectNulls />
        </ComposedChart>
      </ResponsiveContainer>
      {renderResizeHandle("cci")}
    </div>
  );

  const renderRSI = () => (
    <div key="sub-rsi">
      <div className="flex items-center gap-1 text-[11px] font-mono text-slate-400 mb-0.5">
        <span className="text-pink-400">RSI</span>
        <span className="text-slate-400">(30 과매도 / 70 과매수)</span>
      </div>
      <ResponsiveContainer width="100%" height={subHeights.rsi}>
        <ComposedChart data={visibleData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
          <XAxis dataKey="date" hide />
          <YAxis
            domain={[0, 100]}
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 10, fill: "rgba(255,255,255,0.55)", fontFamily: "monospace" }}
            ticks={[30, 50, 70]}
            width={42}
          />
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
          <ReferenceLine y={70} stroke="rgba(239,68,68,0.4)" strokeDasharray="3 3" />
          <ReferenceLine y={30} stroke="rgba(34,197,94,0.4)" strokeDasharray="3 3" />
          <Line type="monotone" dataKey="rsi" stroke="#ec4899" strokeWidth={1.5} dot={false} connectNulls />
        </ComposedChart>
      </ResponsiveContainer>
      {renderResizeHandle("rsi")}
    </div>
  );

  const renderMACD = () => (
    <div key="sub-macd">
      <div className="flex items-center gap-1 text-[11px] font-mono text-slate-400 mb-0.5">
        <span className="text-blue-400">MACD</span>
      </div>
      <ResponsiveContainer width="100%" height={subHeights.macd}>
        <ComposedChart data={visibleData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
          <XAxis dataKey="date" hide />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 10, fill: "rgba(255,255,255,0.55)", fontFamily: "monospace" }}
            width={42}
          />
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
          <ReferenceLine y={0} stroke="rgba(255,255,255,0.1)" />
          <Bar dataKey="macdHist" maxBarSize={4}>
            {visibleData.map((d, i) => (
              <Cell key={i} fill={(d.macdHist ?? 0) >= 0 ? "rgba(34,197,94,0.5)" : "rgba(239,68,68,0.5)"} />
            ))}
          </Bar>
          <Line type="monotone" dataKey="macd" stroke="#3b82f6" strokeWidth={1.5} dot={false} connectNulls />
          <Line type="monotone" dataKey="macdSignal" stroke="#f97316" strokeWidth={1} dot={false} connectNulls />
        </ComposedChart>
      </ResponsiveContainer>
      {renderResizeHandle("macd")}
    </div>
  );

  // 선택된 지표 순서대로 렌더
  const SUB_RENDER_MAP: Record<SubIndicator, () => React.ReactNode> = {
    volume: renderVolume,
    cci: renderCCI,
    rsi: renderRSI,
    macd: renderMACD,
  };

  const orderedSubIndicators: SubIndicator[] = ["volume", "cci", "rsi", "macd"];

  // ─── 메인 차트 높이 (전체화면 시 가변) ──────────────
  const mainChartHeight = isFullscreen ? fullscreenHeight : 220;

  // ─── 메인 렌더 ──────────────────────────────────────
  const chartContent = (
    <div className="space-y-1">
      {/* 헤더: 종목 + 현재가 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`font-mono ${isFullscreen ? "text-sm" : "text-xs"} font-bold text-primary`}>{symbol}</span>
          {(() => {
            const korName = TICKER_TO_KOREAN_NAME[symbol];
            const displayName = korName || livePrice?.name;
            if (!displayName) return null;
            return (
              <span className={`text-xs font-mono font-semibold truncate max-w-[120px] ${
                isKorean ? "text-yellow-400" : "text-sky-400"
              }`}>
                {displayName}
              </span>
            );
          })()}
        </div>
        <div className="text-right">
          {livePrice ? (
            <>
              <span
                className={`font-mono text-sm font-bold text-foreground transition-colors duration-300 ${
                  priceFlash === "up" ? "!text-up" : priceFlash === "down" ? "!text-down" : ""
                }`}
              >
                {fmtPrice(livePrice.price)}
              </span>
              <span className={`font-mono text-xs font-medium ml-2 ${livePrice.changePercent >= 0 ? "text-up" : "text-down"}`}>
                {livePrice.changePercent >= 0 ? "+" : ""}{livePrice.changePercent.toFixed(2)}%
              </span>
            </>
          ) : (
            <span className={`font-mono text-xs font-bold ${trend === "up" ? "text-up" : "text-down"}`}>
              {trend === "up" ? "+" : ""}{changePercent.toFixed(2)}%
            </span>
          )}
        </div>
      </div>

      {/* 타임프레임 + 차트타입 + 설정 버튼 — 가로 한 줄 */}
      <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
        <div className="flex gap-0.5 shrink-0">
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf.key}
              onClick={() => setTimeframe(tf.key)}
              className={`px-1.5 py-0.5 text-[11px] font-mono rounded transition-colors whitespace-nowrap ${
                timeframe === tf.key
                  ? "bg-primary text-primary-foreground"
                  : "text-slate-400 hover:text-foreground hover:bg-secondary"
              }`}
            >
              {tf.label}
            </button>
          ))}
        </div>
        <div className="w-px h-4 bg-border/50 shrink-0" />
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            onClick={() => setChartType(chartType === "candle" ? "line" : "candle")}
            className="px-1.5 py-0.5 text-[11px] font-mono rounded text-slate-400 hover:text-foreground hover:bg-secondary transition-colors whitespace-nowrap"
          >
            {chartType === "candle" ? "캔들" : "라인"}
          </button>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`px-1.5 py-0.5 text-[11px] font-mono rounded transition-colors ${
              showSettings ? "bg-secondary text-foreground" : "text-slate-400 hover:text-foreground hover:bg-secondary"
            }`}
          >
            ⚙
          </button>
          <div className="w-px h-4 bg-border/50 shrink-0" />
          <button
            onClick={() => {
              setDrawingMode(!drawingMode);
              if (!drawingMode) setDrawingTool("trendline");
            }}
            className={`px-1.5 py-0.5 text-[11px] font-mono rounded transition-colors whitespace-nowrap ${
              drawingMode
                ? "bg-orange-500/20 text-orange-400 border border-orange-500/30"
                : "text-slate-400 hover:text-foreground hover:bg-secondary"
            }`}
            title="그리기 도구"
          >
            ✏ 그리기
          </button>
          <button
            onClick={() => {
              setIsFullscreen(!isFullscreen);
              if (!isFullscreen) setFullscreenHeight(Math.min(window.innerHeight - 150, 600));
            }}
            className={`px-1.5 py-0.5 text-[11px] font-mono rounded transition-colors whitespace-nowrap ${
              isFullscreen
                ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"
                : "text-slate-400 hover:text-foreground hover:bg-secondary"
            }`}
            title={isFullscreen ? "원래 크기로 (ESC)" : "전체화면"}
          >
            {isFullscreen ? "✕ 축소" : "⛶ 확대"}
          </button>
        </div>
      </div>

      {/* 지표 설정 패널 */}
      {showSettings && (
        <div className="bg-secondary/50 rounded-lg p-2 space-y-1.5">
          <div className="text-[11px] font-mono text-muted-foreground font-bold">오버레이 지표</div>
          <div className="flex flex-wrap gap-1">
            {(
              [
                { key: "sma5", label: "5일선", color: "bg-red-400/20 text-red-400 border-red-400/30" },
                { key: "sma20", label: "20일선", color: "bg-yellow-400/20 text-yellow-400 border-yellow-400/30" },
                { key: "sma60", label: "60일선", color: "bg-green-400/20 text-green-400 border-green-400/30" },
                { key: "sma120", label: "120일선", color: "bg-purple-400/20 text-purple-400 border-purple-400/30" },
                { key: "bb", label: "볼린저밴드", color: "bg-blue-400/20 text-blue-400 border-blue-400/30" },
                { key: "gcdc", label: "GC/DC", color: "bg-pink-400/20 text-pink-400 border-pink-400/30" },
              ] as { key: keyof IndicatorSettings; label: string; color: string }[]
            ).map((ind) => (
              <button
                key={ind.key}
                onClick={() => setIndicators((prev) => ({ ...prev, [ind.key]: !prev[ind.key] }))}
                className={`px-1.5 py-0.5 text-[11px] font-mono rounded border transition-colors ${
                  indicators[ind.key]
                    ? ind.color
                    : "border-border text-slate-300 hover:text-muted-foreground"
                }`}
              >
                {ind.label}
              </button>
            ))}
          </div>
          <div className="text-[11px] font-mono text-muted-foreground font-bold mt-1">하단 지표 (복수 선택 가능)</div>
          <div className="flex gap-1">
            {SUB_INDICATORS.map((si) => (
              <button
                key={si.key}
                onClick={() => setSubIndicators((prev) => {
                  const next = new Set(prev);
                  if (next.has(si.key)) {
                    next.delete(si.key);
                  } else {
                    next.add(si.key);
                  }
                  return next;
                })}
                className={`px-1.5 py-0.5 text-[11px] font-mono rounded border transition-colors ${
                  subIndicators.has(si.key)
                    ? "bg-primary/20 text-primary border-primary/30"
                    : "border-border text-slate-300 hover:text-muted-foreground"
                }`}
              >
                {si.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 활성 지표 범례 */}
      <div className="flex flex-wrap gap-2 text-[10px] font-mono">
        {indicators.sma5 && <span className="text-red-400">● 5일</span>}
        {indicators.sma20 && <span className="text-yellow-400">● 20일</span>}
        {indicators.sma60 && <span className="text-green-400">● 60일</span>}
        {indicators.sma120 && <span className="text-purple-400">● 120일</span>}
        {indicators.bb && <span className="text-blue-400">● BB</span>}
        {indicators.gcdc && <span className="text-pink-400">● GC/DC</span>}
      </div>

      {/* 줌 컨트롤 */}
      <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
        <span className="text-cyan-700">스크롤=줌 | 드래그=이동</span>
        <div className="flex items-center gap-1">
          <button
            onClick={handleZoomIn}
            className="px-1.5 py-0.5 rounded bg-secondary/50 hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors text-xs"
            title="줌인"
          >
            +
          </button>
          <button
            onClick={handleZoomOut}
            className="px-1.5 py-0.5 rounded bg-secondary/50 hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors text-xs"
            title="줌아웃"
          >
            -
          </button>
          {isZoomed && (
            <>
              <span className="text-slate-400 mx-0.5">{Math.round((zoomRange[1] - zoomRange[0]) * 100)}%</span>
              <button
                onClick={() => setZoomRange(DEFAULT_ZOOM)}
                className="px-1 py-0.5 rounded bg-secondary/50 hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
              >
                리셋
              </button>
            </>
          )}
        </div>
      </div>

      {/* 그리기 도구 바 (차트 바깥 상단) */}
      {drawingMode && (
        <div className="bg-slate-800/90 border border-orange-500/20 rounded-lg p-1.5 backdrop-blur-sm">
          <div className="flex items-center gap-2 flex-wrap">
            {/* 선 유형 */}
            <div className="flex items-center gap-0.5">
              {DRAWING_TOOLS.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setDrawingTool(t.key)}
                  title={t.label}
                  className={`flex items-center gap-0.5 px-1.5 py-0.5 text-[11px] font-mono rounded transition-colors whitespace-nowrap ${
                    drawingTool === t.key
                      ? "bg-orange-500/30 text-orange-300 border border-orange-500/40"
                      : "text-slate-300 hover:text-white hover:bg-slate-700"
                  }`}
                >
                  <span className="w-3.5 text-center">{t.icon}</span>
                  <span>{t.label}</span>
                </button>
              ))}
            </div>

            <div className="w-px h-5 bg-slate-600/50 shrink-0" />

            {/* 색상 */}
            <div className="flex items-center gap-0.5">
              {COLOR_PRESETS.map((c) => (
                <button
                  key={c}
                  onClick={() => { setDrawingColor(c); setCustomColor(c); }}
                  className={`w-4 h-4 rounded-sm border transition-all ${
                    drawingColor === c ? "border-white scale-125 shadow-lg" : "border-slate-600 hover:border-slate-400"
                  }`}
                  style={{ backgroundColor: c }}
                  title={c}
                />
              ))}
              <input
                type="color"
                value={customColor}
                onChange={(e) => { setCustomColor(e.target.value); setDrawingColor(e.target.value); }}
                className="w-5 h-4 rounded cursor-pointer border-0 p-0 ml-0.5"
                title="커스텀 색상"
              />
            </div>

            <div className="w-px h-5 bg-slate-600/50 shrink-0" />

            {/* 굵기 */}
            <div className="flex items-center gap-0.5">
              <span className="text-[9px] font-mono text-slate-500 mr-0.5">굵기</span>
              {LINE_WIDTHS.map((w) => (
                <button
                  key={w}
                  onClick={() => setDrawingLineWidth(w)}
                  className={`flex items-center justify-center w-5 h-4 rounded text-[10px] font-mono transition-colors ${
                    drawingLineWidth === w
                      ? "bg-orange-500/30 text-orange-300"
                      : "text-slate-400 hover:text-white hover:bg-slate-700"
                  }`}
                  title={`${w}px`}
                >
                  <div className="rounded-full bg-current" style={{ width: `${Math.min(w * 2, 10)}px`, height: `${Math.min(w, 4)}px` }} />
                </button>
              ))}
            </div>

            {/* 텍스트 크기 (텍스트 도구 선택 시) */}
            {drawingTool === "text" && (
              <>
                <div className="w-px h-5 bg-slate-600/50 shrink-0" />
                <div className="flex items-center gap-0.5">
                  <span className="text-[9px] font-mono text-slate-500 mr-0.5">크기</span>
                  {[10, 12, 14, 18, 24].map((s) => (
                    <button
                      key={s}
                      onClick={() => setDrawingFontSize(s)}
                      className={`px-1 py-0.5 text-[10px] font-mono rounded transition-colors ${
                        drawingFontSize === s
                          ? "bg-orange-500/30 text-orange-300"
                          : "text-slate-400 hover:text-white hover:bg-slate-700"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </>
            )}

            <div className="w-px h-5 bg-slate-600/50 shrink-0" />

            {/* 선 스타일 */}
            <div className="flex items-center gap-0.5">
              {([
                { key: "solid" as const, label: "───" },
                { key: "dashed" as const, label: "- - -" },
                { key: "dotted" as const, label: "· · ·" },
              ]).map((s) => (
                <button
                  key={s.key}
                  onClick={() => setDrawingLineStyle(s.key)}
                  className={`px-1 py-0.5 text-[10px] font-mono rounded transition-colors ${
                    drawingLineStyle === s.key
                      ? "bg-orange-500/30 text-orange-300"
                      : "text-slate-400 hover:text-white hover:bg-slate-700"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>

            <div className="w-px h-5 bg-slate-600/50 shrink-0" />

            {/* 액션 */}
            <div className="flex items-center gap-0.5">
              <button
                onClick={() => drawingOverlayRef.current?.undo()}
                disabled={drawingCount === 0}
                className="px-1.5 py-0.5 text-[10px] font-mono rounded text-slate-400 hover:text-white hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="되돌리기"
              >
                ↩ 되돌리기
              </button>
              <button
                onClick={() => drawingOverlayRef.current?.clearAll()}
                disabled={drawingCount === 0}
                className="px-1.5 py-0.5 text-[10px] font-mono rounded text-red-400 hover:text-red-300 hover:bg-red-400/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="전체 삭제"
              >
                ✕ 전체삭제
              </button>
              <span className="text-[9px] font-mono text-slate-500 ml-1">{drawingCount}개</span>
            </div>
          </div>
        </div>
      )}

      {/* 메인 캔들/라인 차트 */}
      <div ref={(el) => { (chartContainerRef as React.MutableRefObject<HTMLDivElement | null>).current = el; (chartAreaRef as React.MutableRefObject<HTMLDivElement | null>).current = el; }} className={`relative ${drawingMode ? "cursor-crosshair" : isDragging ? "cursor-grabbing" : "cursor-grab"}`} style={{ touchAction: "none", overscrollBehavior: "contain", userSelect: "none" }}>
      {drawingMode && (
        <ChartDrawingOverlay
          ref={drawingOverlayRef}
          active={drawingMode}
          width={chartDimensions.width || 400}
          height={mainChartHeight}
          settings={drawingSettings}
          onDrawingCountChange={setDrawingCount}
        />
      )}
      <ResponsiveContainer width="100%" height={mainChartHeight}>
        <ComposedChart data={visibleData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
          <XAxis
            dataKey="date"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 10, fill: "rgba(255,255,255,0.55)", fontFamily: "monospace" }}
            tickFormatter={(v: string) => formatDateLabel(v, timeframe)}
            interval="preserveStartEnd"
            minTickGap={40}
          />
          <YAxis
            domain={[minPrice - pricePadding, maxPrice + pricePadding]}
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 10, fill: "rgba(255,255,255,0.55)", fontFamily: "monospace" }}
            tickFormatter={fmtAxisPrice}
            width={48}
            orientation="right"
          />
          {/* 툴팁 제거 — 드래그 패닝 시 방해되므로 비활성화 */}

          {/* 볼린저 밴드 */}
          {indicators.bb && (
            <>
              <Line type="monotone" dataKey="bbUpper" stroke="rgba(59,130,246,0.4)" strokeWidth={1} dot={false} connectNulls />
              <Line type="monotone" dataKey="bbLower" stroke="rgba(59,130,246,0.4)" strokeWidth={1} dot={false} connectNulls />
              <Line type="monotone" dataKey="bbMiddle" stroke="rgba(59,130,246,0.2)" strokeWidth={1} strokeDasharray="3 3" dot={false} connectNulls />
            </>
          )}

          {/* 캔들 또는 라인 */}
          {chartType === "candle" ? (
            <Bar dataKey="candleBody" maxBarSize={8} isAnimationActive={false}>
              {visibleData.map((d, i) => (
                <Cell key={i} fill={d.isUp ? "#22c55e" : "#ef4444"} stroke={d.isUp ? "#22c55e" : "#ef4444"} />
              ))}
            </Bar>
          ) : (
            <Line type="monotone" dataKey="close" stroke={trend === "up" ? "#22c55e" : "#ef4444"} strokeWidth={1.5} dot={false} />
          )}

          {/* 심지 (캔들 모드일 때) — high/low 표시용 라인 */}
          {chartType === "candle" && (
            <>
              <Line type="monotone" dataKey="high" stroke="transparent" dot={false} activeDot={false} />
              <Line type="monotone" dataKey="low" stroke="transparent" dot={false} activeDot={false} />
            </>
          )}

          {/* SMA 라인 (5, 20, 60, 120일) */}
          {indicators.sma5 && (
            <Line type="monotone" dataKey="sma5" stroke="#f87171" strokeWidth={1} dot={false} connectNulls />
          )}
          {indicators.sma20 && (
            <Line type="monotone" dataKey="sma20" stroke="#facc15" strokeWidth={1} dot={false} connectNulls />
          )}
          {indicators.sma60 && (
            <Line type="monotone" dataKey="sma60" stroke="#4ade80" strokeWidth={1} dot={false} connectNulls />
          )}
          {indicators.sma120 && (
            <Line type="monotone" dataKey="sma120" stroke="#a855f7" strokeWidth={1} dot={false} connectNulls />
          )}

          {/* 골든/데드크로스 마커 */}
          {indicators.gcdc &&
            crossSignals.map((sig, i) => {
              const point = chartData[sig.index];
              if (!point) return null;
              // 가시 범위 내에 있는 신호만 표시
              const isVisible = visibleData.some((vd) => vd.date === point.date);
              if (!isVisible) return null;
              return (
                <ReferenceLine
                  key={`cross-${i}`}
                  x={point.date}
                  stroke={sig.type === "golden" ? "#22c55e" : "#ef4444"}
                  strokeDasharray="3 3"
                  strokeWidth={1}
                  label={{
                    value: sig.type === "golden" ? "GC" : "DC",
                    position: "top",
                    fill: sig.type === "golden" ? "#22c55e" : "#ef4444",
                    fontSize: 9,
                    fontFamily: "monospace",
                  }}
                />
              );
            })}
        </ComposedChart>
      </ResponsiveContainer>
      </div>

      {/* 서브 지표 차트 (선택된 모든 지표 렌더) */}
      {orderedSubIndicators
        .filter((key) => subIndicators.has(key))
        .map((key) => SUB_RENDER_MAP[key]())}

      {/* 전체화면 리사이즈 핸들 */}
      {isFullscreen && (
        <div
          className="h-2 cursor-ns-resize group flex items-center justify-center hover:bg-primary/10 rounded transition-colors mt-1"
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            fsResizingRef.current = { startY: e.clientY, startH: fullscreenHeight };
          }}
        >
          <div className="w-16 h-0.5 bg-slate-600 group-hover:bg-primary/50 rounded-full transition-colors" />
        </div>
      )}
    </div>
  );

  // ─── 전체화면 래퍼 ──────────────────────────────────
  if (isFullscreen) {
    return (
      <div
        ref={fullscreenRef}
        className="fixed inset-0 z-[100] bg-background/98 backdrop-blur-sm overflow-auto"
        style={{ padding: "12px 16px" }}
      >
        {/* 전체화면 상단 바 */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-bold text-primary">{symbol}</span>
            <span className="text-xs font-mono text-slate-400">전체화면</span>
            {drawingMode && (
              <span className="text-[10px] font-mono text-orange-400 bg-orange-500/10 border border-orange-500/20 rounded px-1.5 py-0.5">
                그리기 모드 ON
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <span className="text-[10px] font-mono text-slate-500">ESC로 닫기 | 하단 드래그로 크기 조절</span>
            <button
              onClick={() => setIsFullscreen(false)}
              className="px-2 py-0.5 text-xs font-mono rounded bg-secondary hover:bg-secondary/80 text-foreground transition-colors"
            >
              ✕ 닫기
            </button>
          </div>
        </div>
        {chartContent}
      </div>
    );
  }

  return chartContent;
}
