"use client";

import { useState, useEffect, useCallback, useRef } from "react";

// ─── 타입 ─────────────────────────────────────────────
export type DrawingTool =
  | "none"
  | "trendline"    // 직선 (추세선)
  | "horizontal"   // 수평선
  | "vertical"     // 수직선
  | "ray"          // 반직선
  | "rectangle"    // 사각형
  | "freehand"     // 자유 그리기
  | "text"         // 텍스트
  | "eraser";      // 지우개

interface Point {
  x: number;
  y: number;
}

interface DrawingBase {
  id: number;
  color: string;
  lineWidth: number;
  lineStyle: "solid" | "dashed" | "dotted";
}

interface LineDrawing extends DrawingBase {
  type: "trendline" | "horizontal" | "vertical" | "ray";
  start: Point;
  end: Point;
}

interface RectDrawing extends DrawingBase {
  type: "rectangle";
  start: Point;
  end: Point;
}

interface FreehandDrawing extends DrawingBase {
  type: "freehand";
  points: Point[];
}

interface TextDrawing extends DrawingBase {
  type: "text";
  position: Point;
  content: string;
  fontSize: number;
}

type Drawing = LineDrawing | RectDrawing | FreehandDrawing | TextDrawing;

interface ChartDrawingOverlayProps {
  active: boolean;
  width: number;
  height: number;
}

// ─── 색상 프리셋 ──────────────────────────────────────
const COLOR_PRESETS = [
  "#ef4444", // 빨강
  "#f97316", // 주황
  "#eab308", // 노랑
  "#22c55e", // 초록
  "#3b82f6", // 파랑
  "#8b5cf6", // 보라
  "#ec4899", // 핑크
  "#ffffff", // 흰색
  "#94a3b8", // 회색
  "#000000", // 검정
];

const LINE_WIDTHS = [1, 2, 3, 5, 8];

const TOOLS: { key: DrawingTool; label: string; icon: string }[] = [
  { key: "trendline", label: "직선", icon: "╲" },
  { key: "horizontal", label: "수평선", icon: "─" },
  { key: "vertical", label: "수직선", icon: "│" },
  { key: "ray", label: "반직선", icon: "↗" },
  { key: "rectangle", label: "사각형", icon: "□" },
  { key: "freehand", label: "자유그리기", icon: "✏" },
  { key: "text", label: "텍스트", icon: "T" },
  { key: "eraser", label: "지우개", icon: "⌫" },
];

// ─── 컴포넌트 ─────────────────────────────────────────
export default function ChartDrawingOverlay({ active, width, height }: ChartDrawingOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // 도구 설정 (UI 반영 필요 → state)
  const [tool, setTool] = useState<DrawingTool>("trendline");
  const [color, setColor] = useState("#ef4444");
  const [lineWidth, setLineWidth] = useState(2);
  const [lineStyle, setLineStyle] = useState<"solid" | "dashed" | "dotted">("solid");
  const [customColor, setCustomColor] = useState("#ef4444");
  const [fontSize, setFontSize] = useState(14);
  const [showToolbar, setShowToolbar] = useState(true);
  const [drawingCount, setDrawingCount] = useState(0);

  // 텍스트 입력 UI
  const [textInput, setTextInput] = useState("");
  const [textPosition, setTextPosition] = useState<Point | null>(null);
  const [showTextInput, setShowTextInput] = useState(false);

  // 완성된 그리기 목록 (ref로 관리 - 캔버스 직접 조작)
  const drawingsRef = useRef<Drawing[]>([]);
  const nextIdRef = useRef(1);

  // 드래그 상태 (ref - state 아님! 리렌더링 없이 직접 캔버스 조작)
  const isDrawingRef = useRef(false);
  const startPointRef = useRef<Point | null>(null);
  const currentPointRef = useRef<Point | null>(null);
  const freehandPointsRef = useRef<Point[]>([]);
  const rafRef = useRef<number>(0);

  // 현재 도구/설정을 ref로도 보관 (이벤트 핸들러에서 최신값 접근)
  const toolRef = useRef(tool);
  const colorRef = useRef(color);
  const lineWidthRef = useRef(lineWidth);
  const lineStyleRef = useRef(lineStyle);
  const fontSizeRef = useRef(fontSize);

  useEffect(() => { toolRef.current = tool; }, [tool]);
  useEffect(() => { colorRef.current = color; }, [color]);
  useEffect(() => { lineWidthRef.current = lineWidth; }, [lineWidth]);
  useEffect(() => { lineStyleRef.current = lineStyle; }, [lineStyle]);
  useEffect(() => { fontSizeRef.current = fontSize; }, [fontSize]);

  // width/height를 ref로도 보관
  const widthRef = useRef(width);
  const heightRef = useRef(height);
  useEffect(() => { widthRef.current = width; }, [width]);
  useEffect(() => { heightRef.current = height; }, [height]);

  // ─── 캔버스 유틸 ──────────────────────────────────
  const getCtx = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    return canvas.getContext("2d");
  }, []);

  const applyDpr = useCallback((ctx: CanvasRenderingContext2D) => {
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }, []);

  const setLineDash = useCallback((ctx: CanvasRenderingContext2D, style: "solid" | "dashed" | "dotted") => {
    if (style === "dashed") ctx.setLineDash([8, 4]);
    else if (style === "dotted") ctx.setLineDash([2, 3]);
    else ctx.setLineDash([]);
  }, []);

  // 단일 도형 그리기
  const drawOne = useCallback((ctx: CanvasRenderingContext2D, d: Drawing, w: number, h: number) => {
    ctx.save();
    ctx.strokeStyle = d.color;
    ctx.fillStyle = d.color;
    ctx.lineWidth = d.lineWidth;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    setLineDash(ctx, d.lineStyle);

    switch (d.type) {
      case "trendline": {
        ctx.beginPath();
        ctx.moveTo(d.start.x, d.start.y);
        ctx.lineTo(d.end.x, d.end.y);
        ctx.stroke();
        break;
      }
      case "horizontal": {
        ctx.beginPath();
        ctx.moveTo(0, d.start.y);
        ctx.lineTo(w, d.start.y);
        ctx.stroke();
        // 가격 라벨 표시 (우측)
        ctx.setLineDash([]);
        ctx.font = "10px monospace";
        const label = `─ ${d.start.y.toFixed(0)}px`;
        ctx.fillText(label, w - 60, d.start.y - 4);
        break;
      }
      case "vertical": {
        ctx.beginPath();
        ctx.moveTo(d.start.x, 0);
        ctx.lineTo(d.start.x, h);
        ctx.stroke();
        break;
      }
      case "ray": {
        const dx = d.end.x - d.start.x;
        const dy = d.end.y - d.start.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len === 0) break;
        const scale = Math.max(w, h) * 2 / len;
        ctx.beginPath();
        ctx.moveTo(d.start.x, d.start.y);
        ctx.lineTo(d.start.x + dx * scale, d.start.y + dy * scale);
        ctx.stroke();
        // 시작점 dot
        ctx.beginPath();
        ctx.arc(d.start.x, d.start.y, 3, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case "rectangle": {
        const rx = Math.min(d.start.x, d.end.x);
        const ry = Math.min(d.start.y, d.end.y);
        const rw = Math.abs(d.end.x - d.start.x);
        const rh = Math.abs(d.end.y - d.start.y);
        ctx.beginPath();
        ctx.rect(rx, ry, rw, rh);
        ctx.stroke();
        ctx.globalAlpha = 0.08;
        ctx.fillRect(rx, ry, rw, rh);
        break;
      }
      case "freehand": {
        if (d.points.length < 2) break;
        ctx.beginPath();
        ctx.moveTo(d.points[0].x, d.points[0].y);
        for (let i = 1; i < d.points.length; i++) {
          ctx.lineTo(d.points[i].x, d.points[i].y);
        }
        ctx.stroke();
        break;
      }
      case "text": {
        ctx.setLineDash([]);
        ctx.font = `${d.fontSize}px monospace`;
        ctx.fillText(d.content, d.position.x, d.position.y);
        break;
      }
    }
    ctx.restore();
  }, [setLineDash]);

  // 전체 화면 다시 그리기 (완성된 도형들 + 현재 프리뷰)
  const renderFrame = useCallback(() => {
    const ctx = getCtx();
    if (!ctx) return;

    const w = widthRef.current;
    const h = heightRef.current;

    // DPR 재적용 (안전)
    applyDpr(ctx);
    ctx.clearRect(0, 0, w, h);

    // 1. 완성된 도형 그리기
    drawingsRef.current.forEach((d) => drawOne(ctx, d, w, h));

    // 2. 현재 드래그 중 프리뷰
    if (!isDrawingRef.current) return;
    const start = startPointRef.current;
    const cur = currentPointRef.current;
    const t = toolRef.current;
    if (!start || !cur) return;
    if (t === "none" || t === "text" || t === "eraser") return;

    ctx.save();
    ctx.strokeStyle = colorRef.current;
    ctx.fillStyle = colorRef.current;
    ctx.lineWidth = lineWidthRef.current;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.globalAlpha = 0.7;
    setLineDash(ctx, lineStyleRef.current);

    switch (t) {
      case "trendline": {
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(cur.x, cur.y);
        ctx.stroke();
        break;
      }
      case "horizontal": {
        ctx.beginPath();
        ctx.moveTo(0, cur.y);
        ctx.lineTo(w, cur.y);
        ctx.stroke();
        // 라벨
        ctx.globalAlpha = 0.5;
        ctx.setLineDash([]);
        ctx.font = "10px monospace";
        ctx.fillText(`─ ${cur.y.toFixed(0)}px`, w - 60, cur.y - 4);
        break;
      }
      case "vertical": {
        ctx.beginPath();
        ctx.moveTo(cur.x, 0);
        ctx.lineTo(cur.x, h);
        ctx.stroke();
        break;
      }
      case "ray": {
        const dx = cur.x - start.x;
        const dy = cur.y - start.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len > 0) {
          const scale = Math.max(w, h) * 2 / len;
          ctx.beginPath();
          ctx.moveTo(start.x, start.y);
          ctx.lineTo(start.x + dx * scale, start.y + dy * scale);
          ctx.stroke();
          // 시작점
          ctx.beginPath();
          ctx.arc(start.x, start.y, 3, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }
      case "rectangle": {
        const rx = Math.min(start.x, cur.x);
        const ry = Math.min(start.y, cur.y);
        const rw = Math.abs(cur.x - start.x);
        const rh = Math.abs(cur.y - start.y);
        ctx.beginPath();
        ctx.rect(rx, ry, rw, rh);
        ctx.stroke();
        ctx.globalAlpha = 0.05;
        ctx.fillRect(rx, ry, rw, rh);
        break;
      }
      case "freehand": {
        const pts = freehandPointsRef.current;
        if (pts.length < 2) break;
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) {
          ctx.lineTo(pts[i].x, pts[i].y);
        }
        ctx.stroke();
        break;
      }
    }
    ctx.restore();
  }, [getCtx, applyDpr, drawOne, setLineDash]);

  // 캔버스 크기 동기화
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    renderFrame();
  }, [width, height, renderFrame]);

  // drawingsRef 변경 후 다시 그리기
  const scheduleRender = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(renderFrame);
  }, [renderFrame]);

  // ─── 좌표 계산 ────────────────────────────────────
  const getCanvasPoint = useCallback((e: MouseEvent | React.MouseEvent): Point => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }, []);

  // ─── 마우스 이벤트 (네이티브 이벤트 리스너) ────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !active) return;

    const handleMouseDown = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const point = getCanvasPoint(e);
      const t = toolRef.current;

      if (t === "eraser") {
        const threshold = 10;
        drawingsRef.current = drawingsRef.current.filter((d) => {
          if (d.type === "freehand") {
            return !d.points.some((p) => Math.abs(p.x - point.x) < threshold && Math.abs(p.y - point.y) < threshold);
          }
          if (d.type === "text") {
            return !(Math.abs(d.position.x - point.x) < 40 && Math.abs(d.position.y - point.y) < 20);
          }
          if (d.type === "horizontal") {
            return Math.abs(d.start.y - point.y) >= threshold;
          }
          if (d.type === "vertical") {
            return Math.abs(d.start.x - point.x) >= threshold;
          }
          // trendline, ray, rectangle: 시작/끝점 및 선 위 근처
          const distToLine = pointToSegmentDist(point, d.start, d.end);
          return distToLine >= threshold;
        });
        setDrawingCount(drawingsRef.current.length);
        scheduleRender();
        return;
      }

      if (t === "text") {
        setTextPosition(point);
        setShowTextInput(true);
        setTextInput("");
        return;
      }

      // 수평선/수직선: 드래그 모드로 시작 (마우스 따라다니는 프리뷰)
      isDrawingRef.current = true;
      startPointRef.current = point;
      currentPointRef.current = point;

      if (t === "freehand") {
        freehandPointsRef.current = [point];
      }

      scheduleRender();
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDrawingRef.current) return;
      e.preventDefault();
      e.stopPropagation();
      const point = getCanvasPoint(e);
      currentPointRef.current = point;

      if (toolRef.current === "freehand") {
        freehandPointsRef.current.push(point);
      }

      scheduleRender();
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (!isDrawingRef.current) return;
      e.preventDefault();
      e.stopPropagation();

      const point = getCanvasPoint(e);
      const start = startPointRef.current;
      const t = toolRef.current;
      if (!start) {
        isDrawingRef.current = false;
        return;
      }

      const id = nextIdRef.current++;
      const c = colorRef.current;
      const lw = lineWidthRef.current;
      const ls = lineStyleRef.current;
      const w = widthRef.current;
      const h = heightRef.current;

      // 최소 거리 체크 (너무 짧은 클릭 무시 — 수평/수직선 제외)
      const dist = Math.sqrt((point.x - start.x) ** 2 + (point.y - start.y) ** 2);

      if (t === "freehand") {
        freehandPointsRef.current.push(point);
        if (freehandPointsRef.current.length >= 2) {
          drawingsRef.current.push({
            id, type: "freehand", color: c, lineWidth: lw, lineStyle: ls,
            points: [...freehandPointsRef.current],
          });
        }
        freehandPointsRef.current = [];
      } else if (t === "horizontal") {
        drawingsRef.current.push({
          id, type: "horizontal", color: c, lineWidth: lw, lineStyle: ls,
          start: { x: 0, y: point.y }, end: { x: w, y: point.y },
        });
      } else if (t === "vertical") {
        drawingsRef.current.push({
          id, type: "vertical", color: c, lineWidth: lw, lineStyle: ls,
          start: { x: point.x, y: 0 }, end: { x: point.x, y: h },
        });
      } else if (t === "trendline" && dist >= 3) {
        drawingsRef.current.push({
          id, type: "trendline", color: c, lineWidth: lw, lineStyle: ls,
          start, end: point,
        });
      } else if (t === "ray" && dist >= 3) {
        drawingsRef.current.push({
          id, type: "ray", color: c, lineWidth: lw, lineStyle: ls,
          start, end: point,
        });
      } else if (t === "rectangle" && dist >= 3) {
        drawingsRef.current.push({
          id, type: "rectangle", color: c, lineWidth: lw, lineStyle: ls,
          start, end: point,
        });
      }

      isDrawingRef.current = false;
      startPointRef.current = null;
      currentPointRef.current = null;
      setDrawingCount(drawingsRef.current.length);
      scheduleRender();
    };

    const handleMouseLeave = () => {
      if (isDrawingRef.current && toolRef.current === "freehand") {
        // 자유그리기 중 캔버스 밖으로 나가면 자동 완료
        const pts = freehandPointsRef.current;
        if (pts.length >= 2) {
          const id = nextIdRef.current++;
          drawingsRef.current.push({
            id, type: "freehand",
            color: colorRef.current, lineWidth: lineWidthRef.current, lineStyle: lineStyleRef.current,
            points: [...pts],
          });
        }
        freehandPointsRef.current = [];
        isDrawingRef.current = false;
        startPointRef.current = null;
        currentPointRef.current = null;
        setDrawingCount(drawingsRef.current.length);
        scheduleRender();
      }
    };

    canvas.addEventListener("mousedown", handleMouseDown);
    canvas.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("mouseup", handleMouseUp);
    canvas.addEventListener("mouseleave", handleMouseLeave);

    return () => {
      canvas.removeEventListener("mousedown", handleMouseDown);
      canvas.removeEventListener("mousemove", handleMouseMove);
      canvas.removeEventListener("mouseup", handleMouseUp);
      canvas.removeEventListener("mouseleave", handleMouseLeave);
      cancelAnimationFrame(rafRef.current);
    };
  }, [active, getCanvasPoint, scheduleRender]);

  // ─── 텍스트 입력 완료 ────────────────────────────
  const handleTextSubmit = useCallback(() => {
    if (!textPosition || !textInput.trim()) {
      setShowTextInput(false);
      return;
    }
    const id = nextIdRef.current++;
    drawingsRef.current.push({
      id, type: "text",
      color: colorRef.current, lineWidth: lineWidthRef.current, lineStyle: lineStyleRef.current,
      position: textPosition, content: textInput, fontSize: fontSizeRef.current,
    });
    setShowTextInput(false);
    setTextInput("");
    setTextPosition(null);
    setDrawingCount(drawingsRef.current.length);
    scheduleRender();
  }, [textPosition, textInput, scheduleRender]);

  // ─── 되돌리기 / 전체삭제 ─────────────────────────
  const handleUndo = useCallback(() => {
    drawingsRef.current.pop();
    setDrawingCount(drawingsRef.current.length);
    scheduleRender();
  }, [scheduleRender]);

  const handleClearAll = useCallback(() => {
    drawingsRef.current = [];
    setDrawingCount(0);
    scheduleRender();
  }, [scheduleRender]);

  if (!active) return null;

  const getCursor = () => {
    if (tool === "eraser") return "crosshair";
    if (tool === "text") return "text";
    return "crosshair";
  };

  return (
    <>
      {/* 캔버스 오버레이 */}
      <canvas
        ref={canvasRef}
        className="absolute top-0 left-0 z-10"
        style={{
          width: `${width}px`,
          height: `${height}px`,
          cursor: getCursor(),
          pointerEvents: active ? "auto" : "none",
        }}
      />

      {/* 텍스트 입력 팝업 */}
      {showTextInput && textPosition && (
        <div
          className="absolute z-20 bg-slate-800 border border-slate-600 rounded-lg p-2 shadow-xl"
          style={{
            left: Math.min(textPosition.x, width - 200),
            top: Math.min(textPosition.y, height - 60),
          }}
        >
          <div className="flex gap-1">
            <input
              type="text"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleTextSubmit(); if (e.key === "Escape") setShowTextInput(false); }}
              className="bg-slate-700 text-white text-xs px-2 py-1 rounded border border-slate-600 w-36 font-mono focus:outline-none focus:border-primary"
              placeholder="텍스트 입력..."
              autoFocus
            />
            <button onClick={handleTextSubmit} className="px-2 py-1 bg-primary text-primary-foreground rounded text-xs font-mono">
              확인
            </button>
          </div>
          <div className="flex items-center gap-1 mt-1">
            <span className="text-[10px] text-slate-400 font-mono">크기:</span>
            {[10, 12, 14, 18, 24].map((s) => (
              <button
                key={s}
                onClick={() => setFontSize(s)}
                className={`px-1 py-0.5 text-[10px] rounded font-mono ${fontSize === s ? "bg-primary text-primary-foreground" : "text-slate-400 hover:text-white"}`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 도구 모음 */}
      {showToolbar && (
        <div className="absolute top-1 left-1 z-20 flex flex-col gap-1">
          {/* 그리기 도구 */}
          <div className="bg-slate-800/95 border border-slate-600/60 rounded-lg p-1 shadow-xl backdrop-blur-sm">
            <div className="flex flex-col gap-0.5">
              {TOOLS.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTool(t.key)}
                  title={t.label}
                  className={`flex items-center gap-1 px-1.5 py-0.5 text-[11px] font-mono rounded transition-colors whitespace-nowrap ${
                    tool === t.key
                      ? "bg-primary text-primary-foreground"
                      : "text-slate-300 hover:text-white hover:bg-slate-700"
                  }`}
                >
                  <span className="w-4 text-center">{t.icon}</span>
                  <span>{t.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 색상 */}
          <div className="bg-slate-800/95 border border-slate-600/60 rounded-lg p-1.5 shadow-xl backdrop-blur-sm">
            <div className="text-[10px] font-mono text-slate-400 mb-1">색상</div>
            <div className="grid grid-cols-5 gap-0.5">
              {COLOR_PRESETS.map((c) => (
                <button
                  key={c}
                  onClick={() => { setColor(c); setCustomColor(c); }}
                  className={`w-4 h-4 rounded-sm border transition-all ${
                    color === c ? "border-white scale-125 shadow-lg" : "border-slate-600 hover:border-slate-400"
                  }`}
                  style={{ backgroundColor: c }}
                  title={c}
                />
              ))}
            </div>
            <div className="mt-1 flex items-center gap-1">
              <input
                type="color"
                value={customColor}
                onChange={(e) => { setCustomColor(e.target.value); setColor(e.target.value); }}
                className="w-5 h-4 rounded cursor-pointer border-0 p-0"
                title="커스텀 색상"
              />
              <span className="text-[9px] font-mono text-slate-500">{color}</span>
            </div>
          </div>

          {/* 굵기 */}
          <div className="bg-slate-800/95 border border-slate-600/60 rounded-lg p-1.5 shadow-xl backdrop-blur-sm">
            <div className="text-[10px] font-mono text-slate-400 mb-1">굵기</div>
            <div className="flex gap-0.5">
              {LINE_WIDTHS.map((w) => (
                <button
                  key={w}
                  onClick={() => setLineWidth(w)}
                  className={`flex items-center justify-center w-6 h-5 rounded text-[10px] font-mono transition-colors ${
                    lineWidth === w
                      ? "bg-primary text-primary-foreground"
                      : "text-slate-400 hover:text-white hover:bg-slate-700"
                  }`}
                  title={`${w}px`}
                >
                  <div className="rounded-full bg-current" style={{ width: `${Math.min(w * 2, 12)}px`, height: `${Math.min(w, 5)}px` }} />
                </button>
              ))}
            </div>
          </div>

          {/* 선 스타일 */}
          <div className="bg-slate-800/95 border border-slate-600/60 rounded-lg p-1.5 shadow-xl backdrop-blur-sm">
            <div className="text-[10px] font-mono text-slate-400 mb-1">선 스타일</div>
            <div className="flex gap-0.5">
              {([
                { key: "solid" as const, label: "───" },
                { key: "dashed" as const, label: "- - -" },
                { key: "dotted" as const, label: "· · ·" },
              ]).map((s) => (
                <button
                  key={s.key}
                  onClick={() => setLineStyle(s.key)}
                  className={`px-1.5 py-0.5 text-[10px] font-mono rounded transition-colors ${
                    lineStyle === s.key
                      ? "bg-primary text-primary-foreground"
                      : "text-slate-400 hover:text-white hover:bg-slate-700"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* 액션 */}
          <div className="bg-slate-800/95 border border-slate-600/60 rounded-lg p-1.5 shadow-xl backdrop-blur-sm flex gap-0.5">
            <button
              onClick={handleUndo}
              disabled={drawingCount === 0}
              className="px-1.5 py-0.5 text-[10px] font-mono rounded text-slate-400 hover:text-white hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="되돌리기 (Undo)"
            >
              ↩ 되돌리기
            </button>
            <button
              onClick={handleClearAll}
              disabled={drawingCount === 0}
              className="px-1.5 py-0.5 text-[10px] font-mono rounded text-red-400 hover:text-red-300 hover:bg-red-400/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="전체 삭제"
            >
              ✕ 전체삭제
            </button>
          </div>

          {/* 도구 모음 접기 */}
          <button
            onClick={() => setShowToolbar(false)}
            className="bg-slate-800/95 border border-slate-600/60 rounded-lg p-1 shadow-xl text-[10px] font-mono text-slate-400 hover:text-white transition-colors"
          >
            ◀ 도구 접기
          </button>
        </div>
      )}

      {/* 도구 모음 펼치기 */}
      {!showToolbar && (
        <button
          onClick={() => setShowToolbar(true)}
          className="absolute top-1 left-1 z-20 bg-slate-800/95 border border-slate-600/60 rounded-lg px-2 py-1 shadow-xl text-[10px] font-mono text-slate-400 hover:text-white transition-colors backdrop-blur-sm"
        >
          ▶ 도구
        </button>
      )}

      {/* 현재 도구 + 그리기 수 표시 */}
      <div className="absolute bottom-1 left-1 z-20 bg-slate-800/90 border border-slate-600/60 rounded px-2 py-0.5 text-[10px] font-mono text-slate-400 backdrop-blur-sm">
        {TOOLS.find((t) => t.key === tool)?.label || "선택"} | {drawingCount}개 그림
      </div>
    </>
  );
}

// ─── 유틸: 점에서 선분까지의 거리 ──────────────────
function pointToSegmentDist(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.sqrt((p.x - a.x) ** 2 + (p.y - a.y) ** 2);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const projX = a.x + t * dx;
  const projY = a.y + t * dy;
  return Math.sqrt((p.x - projX) ** 2 + (p.y - projY) ** 2);
}
