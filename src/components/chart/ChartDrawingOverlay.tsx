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
  const [tool, setTool] = useState<DrawingTool>("trendline");
  const [color, setColor] = useState("#ef4444");
  const [lineWidth, setLineWidth] = useState(2);
  const [lineStyle, setLineStyle] = useState<"solid" | "dashed" | "dotted">("solid");
  const [drawings, setDrawings] = useState<Drawing[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState<Point | null>(null);
  const [currentPoint, setCurrentPoint] = useState<Point | null>(null);
  const [freehandPoints, setFreehandPoints] = useState<Point[]>([]);
  const [textInput, setTextInput] = useState("");
  const [textPosition, setTextPosition] = useState<Point | null>(null);
  const [showTextInput, setShowTextInput] = useState(false);
  const [showToolbar, setShowToolbar] = useState(true);
  const nextIdRef = useRef(1);
  const [customColor, setCustomColor] = useState("#ef4444");
  const [fontSize, setFontSize] = useState(14);

  // 캔버스 크기 동기화
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    const ctx = canvas.getContext("2d");
    if (ctx) ctx.scale(dpr, dpr);
    redraw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, height]);

  // ─── 그리기 유틸 ──────────────────────────────────
  const setLineStyleOnCtx = useCallback((ctx: CanvasRenderingContext2D, style: "solid" | "dashed" | "dotted") => {
    if (style === "dashed") ctx.setLineDash([8, 4]);
    else if (style === "dotted") ctx.setLineDash([2, 3]);
    else ctx.setLineDash([]);
  }, []);

  const drawSingleDrawing = useCallback((ctx: CanvasRenderingContext2D, d: Drawing) => {
    ctx.strokeStyle = d.color;
    ctx.fillStyle = d.color;
    ctx.lineWidth = d.lineWidth;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    setLineStyleOnCtx(ctx, d.lineStyle);

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
        ctx.lineTo(width, d.start.y);
        ctx.stroke();
        // 가격 라벨 표시 (우측)
        ctx.setLineDash([]);
        ctx.font = "10px monospace";
        ctx.fillStyle = d.color;
        const label = `─ ${d.start.y.toFixed(0)}px`;
        ctx.fillText(label, width - 60, d.start.y - 4);
        break;
      }
      case "vertical": {
        ctx.beginPath();
        ctx.moveTo(d.start.x, 0);
        ctx.lineTo(d.start.x, height);
        ctx.stroke();
        break;
      }
      case "ray": {
        const dx = d.end.x - d.start.x;
        const dy = d.end.y - d.start.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len === 0) break;
        const scale = Math.max(width, height) * 2 / len;
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
        // 반투명 채우기
        ctx.save();
        ctx.globalAlpha = 0.08;
        ctx.fillRect(rx, ry, rw, rh);
        ctx.restore();
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
        ctx.fillStyle = d.color;
        ctx.fillText(d.content, d.position.x, d.position.y);
        break;
      }
    }
    ctx.setLineDash([]);
  }, [width, height, setLineStyleOnCtx]);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, width * dpr, height * dpr);
    drawings.forEach((d) => drawSingleDrawing(ctx, d));
  }, [drawings, width, height, drawSingleDrawing]);

  useEffect(() => {
    redraw();
  }, [redraw]);

  // 임시 프리뷰 그리기
  const drawPreview = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, width * dpr, height * dpr);
    drawings.forEach((d) => drawSingleDrawing(ctx, d));

    if (!startPoint || !currentPoint) return;
    if (tool === "none" || tool === "text" || tool === "eraser") return;

    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.globalAlpha = 0.7;
    setLineStyleOnCtx(ctx, lineStyle);

    switch (tool) {
      case "trendline": {
        ctx.beginPath();
        ctx.moveTo(startPoint.x, startPoint.y);
        ctx.lineTo(currentPoint.x, currentPoint.y);
        ctx.stroke();
        break;
      }
      case "horizontal": {
        ctx.beginPath();
        ctx.moveTo(0, currentPoint.y);
        ctx.lineTo(width, currentPoint.y);
        ctx.stroke();
        break;
      }
      case "vertical": {
        ctx.beginPath();
        ctx.moveTo(currentPoint.x, 0);
        ctx.lineTo(currentPoint.x, height);
        ctx.stroke();
        break;
      }
      case "ray": {
        const dx = currentPoint.x - startPoint.x;
        const dy = currentPoint.y - startPoint.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len > 0) {
          const scale = Math.max(width, height) * 2 / len;
          ctx.beginPath();
          ctx.moveTo(startPoint.x, startPoint.y);
          ctx.lineTo(startPoint.x + dx * scale, startPoint.y + dy * scale);
          ctx.stroke();
        }
        break;
      }
      case "rectangle": {
        const rx = Math.min(startPoint.x, currentPoint.x);
        const ry = Math.min(startPoint.y, currentPoint.y);
        const rw = Math.abs(currentPoint.x - startPoint.x);
        const rh = Math.abs(currentPoint.y - startPoint.y);
        ctx.beginPath();
        ctx.rect(rx, ry, rw, rh);
        ctx.stroke();
        ctx.save();
        ctx.globalAlpha = 0.05;
        ctx.fillRect(rx, ry, rw, rh);
        ctx.restore();
        break;
      }
      case "freehand": {
        if (freehandPoints.length < 2) break;
        ctx.beginPath();
        ctx.moveTo(freehandPoints[0].x, freehandPoints[0].y);
        for (let i = 1; i < freehandPoints.length; i++) {
          ctx.lineTo(freehandPoints[i].x, freehandPoints[i].y);
        }
        ctx.stroke();
        break;
      }
    }
    ctx.globalAlpha = 1;
    ctx.setLineDash([]);
  }, [drawings, startPoint, currentPoint, tool, color, lineWidth, lineStyle, freehandPoints, width, height, drawSingleDrawing, setLineStyleOnCtx]);

  useEffect(() => {
    if (isDrawing) drawPreview();
  }, [isDrawing, drawPreview]);

  // ─── 마우스 이벤트 ────────────────────────────────
  const getCanvasPoint = (e: React.MouseEvent): Point => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!active) return;
    e.preventDefault();
    e.stopPropagation();

    const point = getCanvasPoint(e);

    if (tool === "eraser") {
      // 지우개: 클릭 위치 근처의 그리기 삭제
      const threshold = 10;
      setDrawings((prev) =>
        prev.filter((d) => {
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
          // trendline, ray, rectangle: 시작/끝점 근처
          return !(
            (Math.abs(d.start.x - point.x) < threshold && Math.abs(d.start.y - point.y) < threshold) ||
            (Math.abs(d.end.x - point.x) < threshold && Math.abs(d.end.y - point.y) < threshold)
          );
        })
      );
      return;
    }

    if (tool === "text") {
      setTextPosition(point);
      setShowTextInput(true);
      setTextInput("");
      return;
    }

    if (tool === "horizontal" || tool === "vertical") {
      const id = nextIdRef.current++;
      const drawing: Drawing = {
        id,
        type: tool,
        color,
        lineWidth,
        lineStyle,
        start: point,
        end: point,
      };
      setDrawings((prev) => [...prev, drawing]);
      return;
    }

    setIsDrawing(true);
    setStartPoint(point);
    setCurrentPoint(point);
    if (tool === "freehand") {
      setFreehandPoints([point]);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!active || !isDrawing) return;
    e.preventDefault();
    e.stopPropagation();
    const point = getCanvasPoint(e);
    setCurrentPoint(point);
    if (tool === "freehand") {
      setFreehandPoints((prev) => [...prev, point]);
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (!active || !isDrawing || !startPoint) return;
    e.preventDefault();
    e.stopPropagation();

    const point = getCanvasPoint(e);
    const id = nextIdRef.current++;

    if (tool === "freehand") {
      const finalPoints = [...freehandPoints, point];
      if (finalPoints.length >= 2) {
        const drawing: FreehandDrawing = { id, type: "freehand", color, lineWidth, lineStyle, points: finalPoints };
        setDrawings((prev) => [...prev, drawing]);
      }
      setFreehandPoints([]);
    } else if (tool === "trendline" || tool === "ray") {
      const drawing: LineDrawing = { id, type: tool, color, lineWidth, lineStyle, start: startPoint, end: point };
      setDrawings((prev) => [...prev, drawing]);
    } else if (tool === "rectangle") {
      const drawing: RectDrawing = { id, type: "rectangle", color, lineWidth, lineStyle, start: startPoint, end: point };
      setDrawings((prev) => [...prev, drawing]);
    }

    setIsDrawing(false);
    setStartPoint(null);
    setCurrentPoint(null);
  };

  const handleTextSubmit = () => {
    if (!textPosition || !textInput.trim()) {
      setShowTextInput(false);
      return;
    }
    const id = nextIdRef.current++;
    const drawing: TextDrawing = {
      id,
      type: "text",
      color,
      lineWidth,
      lineStyle,
      position: textPosition,
      content: textInput,
      fontSize,
    };
    setDrawings((prev) => [...prev, drawing]);
    setShowTextInput(false);
    setTextInput("");
    setTextPosition(null);
  };

  const handleUndo = () => {
    setDrawings((prev) => prev.slice(0, -1));
  };

  const handleClearAll = () => {
    setDrawings([]);
  };

  if (!active) return null;

  const getCursor = () => {
    if (tool === "eraser") return "crosshair";
    if (tool === "text") return "text";
    if (tool === "freehand") return "crosshair";
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
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => {
          if (isDrawing && tool === "freehand" && startPoint) {
            handleMouseUp({ preventDefault: () => {}, stopPropagation: () => {}, clientX: 0, clientY: 0 } as unknown as React.MouseEvent);
          }
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
              disabled={drawings.length === 0}
              className="px-1.5 py-0.5 text-[10px] font-mono rounded text-slate-400 hover:text-white hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="되돌리기 (Undo)"
            >
              ↩ 되돌리기
            </button>
            <button
              onClick={handleClearAll}
              disabled={drawings.length === 0}
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
        {TOOLS.find((t) => t.key === tool)?.label || "선택"} | {drawings.length}개 그림
      </div>
    </>
  );
}
