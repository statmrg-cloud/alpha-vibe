"use client";

import { useState, useEffect, useCallback, useRef, forwardRef, useImperativeHandle } from "react";

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

export interface DrawingSettings {
  tool: DrawingTool;
  color: string;
  lineWidth: number;
  lineStyle: "solid" | "dashed" | "dotted";
  fontSize: number;
}

export interface ChartDrawingOverlayHandle {
  undo: () => void;
  clearAll: () => void;
  getDrawingCount: () => number;
}

interface ChartDrawingOverlayProps {
  active: boolean;
  width: number;
  height: number;
  settings: DrawingSettings;
  onDrawingCountChange?: (count: number) => void;
}

// ─── 컴포넌트 ─────────────────────────────────────────
const ChartDrawingOverlay = forwardRef<ChartDrawingOverlayHandle, ChartDrawingOverlayProps>(
  function ChartDrawingOverlay({ active, width, height, settings, onDrawingCountChange }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // 텍스트 입력 UI
    const [textInput, setTextInput] = useState("");
    const [textPosition, setTextPosition] = useState<Point | null>(null);
    const [showTextInput, setShowTextInput] = useState(false);

    // 완성된 그리기 목록 (ref로 관리)
    const drawingsRef = useRef<Drawing[]>([]);
    const nextIdRef = useRef(1);

    // 드래그 상태 (ref)
    const isDrawingRef = useRef(false);
    const startPointRef = useRef<Point | null>(null);
    const currentPointRef = useRef<Point | null>(null);
    const freehandPointsRef = useRef<Point[]>([]);
    const rafRef = useRef<number>(0);

    // settings를 ref로 보관 (이벤트 핸들러에서 최신값 접근)
    const settingsRef = useRef(settings);
    useEffect(() => { settingsRef.current = settings; }, [settings]);

    const widthRef = useRef(width);
    const heightRef = useRef(height);

    // 부모 요소(캔버스)의 실제 크기를 ResizeObserver로 추적
    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas?.parentElement) return;
      const parent = canvas.parentElement;
      const observer = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const w = entry.contentRect.width;
          const h = entry.contentRect.height;
          if (w > 0) widthRef.current = w;
          if (h > 0) heightRef.current = h;
        }
      });
      observer.observe(parent);
      return () => observer.disconnect();
    }, []);

    // prop 변경 시에도 반영
    useEffect(() => { if (width > 0) widthRef.current = width; }, [width]);
    useEffect(() => { if (height > 0) heightRef.current = height; }, [height]);

    // ─── imperative handle ─────────────────────────────
    useImperativeHandle(ref, () => ({
      undo: () => {
        drawingsRef.current.pop();
        onDrawingCountChange?.(drawingsRef.current.length);
        scheduleRender();
      },
      clearAll: () => {
        drawingsRef.current = [];
        onDrawingCountChange?.(0);
        scheduleRender();
      },
      getDrawingCount: () => drawingsRef.current.length,
    }));

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

    const setCtxLineDash = useCallback((ctx: CanvasRenderingContext2D, style: "solid" | "dashed" | "dotted") => {
      if (style === "dashed") ctx.setLineDash([8, 4]);
      else if (style === "dotted") ctx.setLineDash([2, 3]);
      else ctx.setLineDash([]);
    }, []);

    const drawOne = useCallback((ctx: CanvasRenderingContext2D, d: Drawing, w: number, h: number) => {
      ctx.save();
      ctx.strokeStyle = d.color;
      ctx.fillStyle = d.color;
      ctx.lineWidth = d.lineWidth;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      setCtxLineDash(ctx, d.lineStyle);

      switch (d.type) {
        case "trendline":
          ctx.beginPath();
          ctx.moveTo(d.start.x, d.start.y);
          ctx.lineTo(d.end.x, d.end.y);
          ctx.stroke();
          break;
        case "horizontal":
          ctx.beginPath();
          ctx.moveTo(0, d.start.y);
          ctx.lineTo(w, d.start.y);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.font = "10px monospace";
          ctx.fillText(`─ ${d.start.y.toFixed(0)}px`, w - 60, d.start.y - 4);
          break;
        case "vertical":
          ctx.beginPath();
          ctx.moveTo(d.start.x, 0);
          ctx.lineTo(d.start.x, h);
          ctx.stroke();
          break;
        case "ray": {
          const dx = d.end.x - d.start.x;
          const dy = d.end.y - d.start.y;
          const len = Math.sqrt(dx * dx + dy * dy);
          if (len === 0) break;
          const sc = Math.max(w, h) * 2 / len;
          ctx.beginPath();
          ctx.moveTo(d.start.x, d.start.y);
          ctx.lineTo(d.start.x + dx * sc, d.start.y + dy * sc);
          ctx.stroke();
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
        case "freehand":
          if (d.points.length < 2) break;
          ctx.beginPath();
          ctx.moveTo(d.points[0].x, d.points[0].y);
          for (let i = 1; i < d.points.length; i++) {
            ctx.lineTo(d.points[i].x, d.points[i].y);
          }
          ctx.stroke();
          break;
        case "text":
          ctx.setLineDash([]);
          ctx.font = `${d.fontSize}px monospace`;
          ctx.fillText(d.content, d.position.x, d.position.y);
          break;
      }
      ctx.restore();
    }, [setCtxLineDash]);

    // 전체 프레임 렌더
    const renderFrame = useCallback(() => {
      const ctx = getCtx();
      if (!ctx) return;
      const w = widthRef.current;
      const h = heightRef.current;

      applyDpr(ctx);
      ctx.clearRect(0, 0, w, h);

      // 1. 완성된 도형
      drawingsRef.current.forEach((d) => drawOne(ctx, d, w, h));

      // 2. 프리뷰
      if (!isDrawingRef.current) return;
      const start = startPointRef.current;
      const cur = currentPointRef.current;
      const s = settingsRef.current;
      if (!start || !cur) return;
      if (s.tool === "none" || s.tool === "text" || s.tool === "eraser") return;

      ctx.save();
      ctx.strokeStyle = s.color;
      ctx.fillStyle = s.color;
      ctx.lineWidth = s.lineWidth;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.globalAlpha = 0.7;
      setCtxLineDash(ctx, s.lineStyle);

      switch (s.tool) {
        case "trendline":
          ctx.beginPath();
          ctx.moveTo(start.x, start.y);
          ctx.lineTo(cur.x, cur.y);
          ctx.stroke();
          break;
        case "horizontal":
          ctx.beginPath();
          ctx.moveTo(0, cur.y);
          ctx.lineTo(w, cur.y);
          ctx.stroke();
          ctx.globalAlpha = 0.5;
          ctx.setLineDash([]);
          ctx.font = "10px monospace";
          ctx.fillText(`─ ${cur.y.toFixed(0)}px`, w - 60, cur.y - 4);
          break;
        case "vertical":
          ctx.beginPath();
          ctx.moveTo(cur.x, 0);
          ctx.lineTo(cur.x, h);
          ctx.stroke();
          break;
        case "ray": {
          const dx = cur.x - start.x;
          const dy = cur.y - start.y;
          const len = Math.sqrt(dx * dx + dy * dy);
          if (len > 0) {
            const sc = Math.max(w, h) * 2 / len;
            ctx.beginPath();
            ctx.moveTo(start.x, start.y);
            ctx.lineTo(start.x + dx * sc, start.y + dy * sc);
            ctx.stroke();
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
    }, [getCtx, applyDpr, drawOne, setCtxLineDash]);

    // 캔버스 크기 동기화 (부모 요소 실제 크기 기준)
    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const parent = canvas.parentElement;
      const dpr = window.devicePixelRatio || 1;

      const syncSize = () => {
        const w = parent ? parent.clientWidth : width;
        const h = parent ? parent.clientHeight : height;
        if (w <= 0 || h <= 0) return;
        widthRef.current = w;
        heightRef.current = h;
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        canvas.style.width = `${w}px`;
        canvas.style.height = `${h}px`;
        renderFrame();
      };

      syncSize();

      if (parent) {
        const observer = new ResizeObserver(() => syncSize());
        observer.observe(parent);
        return () => observer.disconnect();
      }
    }, [width, height, renderFrame]);

    const scheduleRender = useCallback(() => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(renderFrame);
    }, [renderFrame]);

    // ─── 좌표 ────────────────────────────────────────
    const getCanvasPoint = useCallback((e: MouseEvent): Point => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }, []);

    // ─── 마우스 이벤트 ────────────────────────────────
    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas || !active) return;

      const handleMouseDown = (e: MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const point = getCanvasPoint(e);
        const t = settingsRef.current.tool;

        if (t === "eraser") {
          const threshold = 10;
          drawingsRef.current = drawingsRef.current.filter((d) => {
            if (d.type === "freehand") {
              return !d.points.some((p) => Math.abs(p.x - point.x) < threshold && Math.abs(p.y - point.y) < threshold);
            }
            if (d.type === "text") {
              return !(Math.abs(d.position.x - point.x) < 40 && Math.abs(d.position.y - point.y) < 20);
            }
            if (d.type === "horizontal") return Math.abs(d.start.y - point.y) >= threshold;
            if (d.type === "vertical") return Math.abs(d.start.x - point.x) >= threshold;
            const distToLine = pointToSegmentDist(point, d.start, d.end);
            return distToLine >= threshold;
          });
          onDrawingCountChange?.(drawingsRef.current.length);
          scheduleRender();
          return;
        }

        if (t === "text") {
          setTextPosition(point);
          setShowTextInput(true);
          setTextInput("");
          return;
        }

        isDrawingRef.current = true;
        startPointRef.current = point;
        currentPointRef.current = point;
        if (t === "freehand") freehandPointsRef.current = [point];
        scheduleRender();
      };

      const handleMouseMove = (e: MouseEvent) => {
        if (!isDrawingRef.current) return;
        e.preventDefault();
        e.stopPropagation();
        const point = getCanvasPoint(e);
        currentPointRef.current = point;
        if (settingsRef.current.tool === "freehand") {
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
        const s = settingsRef.current;
        if (!start) { isDrawingRef.current = false; return; }

        const id = nextIdRef.current++;
        const { color: c, lineWidth: lw, lineStyle: ls } = s;
        const w = widthRef.current;
        const h = heightRef.current;
        const dist = Math.sqrt((point.x - start.x) ** 2 + (point.y - start.y) ** 2);

        if (s.tool === "freehand") {
          freehandPointsRef.current.push(point);
          if (freehandPointsRef.current.length >= 2) {
            drawingsRef.current.push({
              id, type: "freehand", color: c, lineWidth: lw, lineStyle: ls,
              points: [...freehandPointsRef.current],
            });
          }
          freehandPointsRef.current = [];
        } else if (s.tool === "horizontal") {
          drawingsRef.current.push({
            id, type: "horizontal", color: c, lineWidth: lw, lineStyle: ls,
            start: { x: 0, y: point.y }, end: { x: w, y: point.y },
          });
        } else if (s.tool === "vertical") {
          drawingsRef.current.push({
            id, type: "vertical", color: c, lineWidth: lw, lineStyle: ls,
            start: { x: point.x, y: 0 }, end: { x: point.x, y: h },
          });
        } else if (s.tool === "trendline" && dist >= 3) {
          drawingsRef.current.push({
            id, type: "trendline", color: c, lineWidth: lw, lineStyle: ls,
            start, end: point,
          });
        } else if (s.tool === "ray" && dist >= 3) {
          drawingsRef.current.push({
            id, type: "ray", color: c, lineWidth: lw, lineStyle: ls,
            start, end: point,
          });
        } else if (s.tool === "rectangle" && dist >= 3) {
          drawingsRef.current.push({
            id, type: "rectangle", color: c, lineWidth: lw, lineStyle: ls,
            start, end: point,
          });
        }

        isDrawingRef.current = false;
        startPointRef.current = null;
        currentPointRef.current = null;
        onDrawingCountChange?.(drawingsRef.current.length);
        scheduleRender();
      };

      const handleMouseLeave = () => {
        if (isDrawingRef.current && settingsRef.current.tool === "freehand") {
          const pts = freehandPointsRef.current;
          if (pts.length >= 2) {
            const id = nextIdRef.current++;
            const s = settingsRef.current;
            drawingsRef.current.push({
              id, type: "freehand",
              color: s.color, lineWidth: s.lineWidth, lineStyle: s.lineStyle,
              points: [...pts],
            });
          }
          freehandPointsRef.current = [];
          isDrawingRef.current = false;
          startPointRef.current = null;
          currentPointRef.current = null;
          onDrawingCountChange?.(drawingsRef.current.length);
          scheduleRender();
        }
      };

      canvas.addEventListener("mousedown", handleMouseDown, { capture: true });
      canvas.addEventListener("mousemove", handleMouseMove, { capture: true });
      canvas.addEventListener("mouseup", handleMouseUp, { capture: true });
      canvas.addEventListener("mouseleave", handleMouseLeave);

      return () => {
        canvas.removeEventListener("mousedown", handleMouseDown, { capture: true });
        canvas.removeEventListener("mousemove", handleMouseMove, { capture: true });
        canvas.removeEventListener("mouseup", handleMouseUp, { capture: true });
        canvas.removeEventListener("mouseleave", handleMouseLeave);
        cancelAnimationFrame(rafRef.current);
      };
    }, [active, getCanvasPoint, scheduleRender, onDrawingCountChange]);

    // ─── 텍스트 입력 완료 ────────────────────────────
    const handleTextSubmit = useCallback(() => {
      if (!textPosition || !textInput.trim()) {
        setShowTextInput(false);
        return;
      }
      const id = nextIdRef.current++;
      const s = settingsRef.current;
      drawingsRef.current.push({
        id, type: "text",
        color: s.color, lineWidth: s.lineWidth, lineStyle: s.lineStyle,
        position: textPosition, content: textInput, fontSize: s.fontSize,
      });
      setShowTextInput(false);
      setTextInput("");
      setTextPosition(null);
      onDrawingCountChange?.(drawingsRef.current.length);
      scheduleRender();
    }, [textPosition, textInput, scheduleRender, onDrawingCountChange]);

    if (!active) return null;

    const cursor = settings.tool === "eraser" ? "crosshair" : settings.tool === "text" ? "text" : "crosshair";

    return (
      <>
        <canvas
          ref={canvasRef}
          className="absolute top-0 left-0"
          style={{
            width: "100%",
            height: "100%",
            cursor,
            pointerEvents: active ? "auto" : "none",
            zIndex: 15,
          }}
        />

        {/* 텍스트 입력 팝업 */}
        {showTextInput && textPosition && (
          <div
            className="absolute bg-slate-800 border border-slate-600 rounded-lg p-2 shadow-xl"
            style={{
              left: Math.min(textPosition.x, width - 200),
              top: Math.min(textPosition.y, height - 60),
              zIndex: 20,
            }}
          >
            <div className="flex gap-1">
              <input
                type="text"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleTextSubmit();
                  if (e.key === "Escape") setShowTextInput(false);
                }}
                className="bg-slate-700 text-white text-xs px-2 py-1 rounded border border-slate-600 w-36 font-mono focus:outline-none focus:border-primary"
                placeholder="텍스트 입력..."
                autoFocus
              />
              <button onClick={handleTextSubmit} className="px-2 py-1 bg-primary text-primary-foreground rounded text-xs font-mono">
                확인
              </button>
            </div>
          </div>
        )}
      </>
    );
  }
);

export default ChartDrawingOverlay;

// ─── 유틸 ──────────────────────────────────────────
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

// ─── 도구 설정 상수 (StockChart에서 사용) ─────────────
export const COLOR_PRESETS = [
  "#ef4444", "#f97316", "#eab308", "#22c55e", "#3b82f6",
  "#8b5cf6", "#ec4899", "#ffffff", "#94a3b8", "#000000",
];

export const LINE_WIDTHS = [1, 2, 3, 5, 8];

export const DRAWING_TOOLS: { key: DrawingTool; label: string; icon: string }[] = [
  { key: "trendline", label: "직선", icon: "╲" },
  { key: "horizontal", label: "수평선", icon: "─" },
  { key: "vertical", label: "수직선", icon: "│" },
  { key: "ray", label: "반직선", icon: "↗" },
  { key: "rectangle", label: "사각형", icon: "□" },
  { key: "freehand", label: "자유그리기", icon: "✏" },
  { key: "text", label: "텍스트", icon: "T" },
  { key: "eraser", label: "지우개", icon: "⌫" },
];
