"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import ChatPanel from "@/components/chat/ChatPanel";
import DataPanel from "@/components/data/DataPanel";

const DEFAULT_RIGHT_WIDTH = 520;
const MIN_RIGHT_WIDTH = 320;
const MAX_RIGHT_WIDTH = 900;
const MIN_LEFT_WIDTH = 300;

export default function ResizableLayout() {
  const [rightWidth, setRightWidth] = useState(DEFAULT_RIGHT_WIDTH);
  const [hydrated, setHydrated] = useState(false);
  const resizingRef = useRef(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(DEFAULT_RIGHT_WIDTH);
  const rightWidthRef = useRef(DEFAULT_RIGHT_WIDTH);

  // SSR hydration 안전: localStorage는 useEffect에서만 접근
  useEffect(() => {
    const saved = localStorage.getItem("alpha-vibe-right-width");
    if (saved) {
      const parsed = parseInt(saved);
      if (!isNaN(parsed) && parsed >= MIN_RIGHT_WIDTH && parsed <= MAX_RIGHT_WIDTH) {
        setRightWidth(parsed);
        rightWidthRef.current = parsed;
      }
    }
    setHydrated(true);
  }, []);

  // rightWidth 변경 시 ref 동기화
  useEffect(() => {
    rightWidthRef.current = rightWidth;
  }, [rightWidth]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    resizingRef.current = true;
    startXRef.current = e.clientX;
    startWidthRef.current = rightWidthRef.current;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!resizingRef.current) return;
      const delta = startXRef.current - e.clientX;
      const maxAllowed = Math.min(MAX_RIGHT_WIDTH, window.innerWidth - MIN_LEFT_WIDTH);
      const newWidth = Math.max(MIN_RIGHT_WIDTH, Math.min(maxAllowed, startWidthRef.current + delta));
      setRightWidth(newWidth);
    };

    const handleMouseUp = () => {
      if (resizingRef.current) {
        resizingRef.current = false;
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        localStorage.setItem("alpha-vibe-right-width", String(rightWidthRef.current));
      }
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  return (
    <main className="flex-1 flex overflow-hidden">
      {/* 좌측: AI 채팅 패널 */}
      <div className="flex-1 min-w-0" style={{ minWidth: MIN_LEFT_WIDTH }}>
        <ChatPanel />
      </div>

      {/* 리사이즈 핸들 */}
      <div
        className="w-1.5 shrink-0 cursor-col-resize bg-border/30 hover:bg-primary/40 active:bg-primary/60 transition-colors group flex items-center justify-center"
        onMouseDown={handleMouseDown}
        title="드래그하여 너비 조절"
      >
        <div className="w-0.5 h-10 bg-slate-600 group-hover:bg-primary/70 rounded-full transition-colors" />
      </div>

      {/* 우측: 데이터 패널 */}
      <div
        className="shrink-0 bg-card/30 backdrop-blur-sm"
        style={{ width: hydrated ? rightWidth : DEFAULT_RIGHT_WIDTH }}
      >
        <DataPanel />
      </div>
    </main>
  );
}
