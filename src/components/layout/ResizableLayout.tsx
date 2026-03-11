"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import ChatPanel from "@/components/chat/ChatPanel";
import DataPanel from "@/components/data/DataPanel";

export default function ResizableLayout() {
  const [rightWidth, setRightWidth] = useState(() => {
    if (typeof window === "undefined") return 420;
    const saved = localStorage.getItem("alpha-vibe-right-width");
    return saved ? parseInt(saved) : 420;
  });
  const resizingRef = useRef(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(420);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    resizingRef.current = true;
    startXRef.current = e.clientX;
    startWidthRef.current = rightWidth;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, [rightWidth]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!resizingRef.current) return;
      const delta = startXRef.current - e.clientX;
      const newWidth = Math.max(300, Math.min(700, startWidthRef.current + delta));
      setRightWidth(newWidth);
    };

    const handleMouseUp = () => {
      if (resizingRef.current) {
        resizingRef.current = false;
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        localStorage.setItem("alpha-vibe-right-width", String(rightWidth));
      }
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [rightWidth]);

  return (
    <main className="flex-1 flex overflow-hidden">
      {/* 좌측: AI 채팅 패널 */}
      <div className="flex-1 min-w-0">
        <ChatPanel />
      </div>

      {/* 리사이즈 핸들 */}
      <div
        className="w-1 shrink-0 cursor-col-resize bg-border/30 hover:bg-primary/30 active:bg-primary/50 transition-colors group flex items-center justify-center"
        onMouseDown={handleMouseDown}
      >
        <div className="w-0.5 h-8 bg-slate-600 group-hover:bg-primary/70 rounded-full transition-colors" />
      </div>

      {/* 우측: 데이터 패널 */}
      <div
        className="shrink-0 bg-card/30 backdrop-blur-sm"
        style={{ width: rightWidth }}
      >
        <DataPanel />
      </div>
    </main>
  );
}
