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

    // 텍스트 드래그 이동 상태
    const isDraggingTextRef = useRef(false);
    const dragTextIdRef = useRef<number | null>(null);
    const dragOffsetRef = useRef<Point>({ x: 0, y: 0 });

    // settings를 ref로 보관 (이벤트 핸들러에서 최신값 접근)
    const settingsRef = useRef(settings);
    useEffect(() => { settingsRef.current = settings; }, [settings]);

    const widthRef = useRef(width);
    const heightRef = useRef(height);

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
      const dpr = window.devicePixelRatio || 1;

      const syncSize = () => {
        // CSS width:100%/height:100% 기준으로 실제 렌더링된 크기를 사용
        const rect = canvas.getBoundingClientRect();
        const w = rect.width;
        const h = rect.height;
        if (w <= 0 || h <= 0) return;
        // 내부 해상도가 이미 맞으면 불필요한 리셋 방지
        if (canvas.width === Math.round(w * dpr) && canvas.height === Math.round(h * dpr)) return;
        widthRef.current = w;
        heightRef.current = h;
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
        renderFrame();
      };

      syncSize();

      const observer = new ResizeObserver(() => syncSize());
      observer.observe(canvas);
      return () => observer.disconnect();
    }, [renderFrame]);

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

    // ─── 텍스트 히트 테스트 (클릭한 위치에 텍스트가 있는지) ───
    const hitTestText = useCallback((point: Point): TextDrawing | null => {
      const ctx = getCtx();
      for (let i = drawingsRef.current.length - 1; i >= 0; i--) {
        const d = drawingsRef.current[i];
        if (d.type !== "text") continue;
        const fontSize = d.fontSize || 14;
        // 텍스트 너비 측정
        let textWidth = d.content.length * fontSize * 0.6; // 기본 추정
        if (ctx) {
          ctx.font = `${fontSize}px monospace`;
          textWidth = ctx.measureText(d.content).width;
        }
        // 텍스트 영역: position.x ~ position.x + textWidth, position.y - fontSize ~ position.y
        if (
          point.x >= d.position.x - 4 &&
          point.x <= d.position.x + textWidth + 4 &&
          point.y >= d.position.y - fontSize - 4 &&
          point.y <= d.position.y + 4
        ) {
          return d;
        }
      }
      return null;
    }, [getCtx]);

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

        // 텍스트 드래그 이동: 텍스트 도구가 아닌 상태에서도 기존 텍스트를 클릭하면 이동
        const hitText = hitTestText(point);
        if (hitText) {
          isDraggingTextRef.current = true;
          dragTextIdRef.current = hitText.id;
          dragOffsetRef.current = {
            x: point.x - hitText.position.x,
            y: point.y - hitText.position.y,
          };
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
        // 텍스트 드래그 이동 중
        if (isDraggingTextRef.current && dragTextIdRef.current !== null) {
          e.preventDefault();
          e.stopPropagation();
          const point = getCanvasPoint(e);
          const d = drawingsRef.current.find((d) => d.id === dragTextIdRef.current);
          if (d && d.type === "text") {
            d.position = {
              x: point.x - dragOffsetRef.current.x,
              y: point.y - dragOffsetRef.current.y,
            };
            scheduleRender();
          }
          return;
        }

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
        // 텍스트 드래그 이동 완료
        if (isDraggingTextRef.current) {
          isDraggingTextRef.current = false;
          dragTextIdRef.current = null;
          return;
        }

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
        // 텍스트 드래그 중 캔버스 벗어나면 종료
        if (isDraggingTextRef.current) {
          isDraggingTextRef.current = false;
          dragTextIdRef.current = null;
          return;
        }

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
    }, [active, getCanvasPoint, hitTestText, scheduleRender, onDrawingCountChange]);

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
              left: Math.max(0, Math.min(textPosition.x, widthRef.current - 200)),
              top: Math.max(0, Math.min(textPosition.y, heightRef.current - 60)),
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
