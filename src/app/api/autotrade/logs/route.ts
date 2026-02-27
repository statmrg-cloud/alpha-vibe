import { NextRequest, NextResponse } from "next/server";
import { getLogs, clearLogs } from "@/lib/autotrade/engine";

// GET — 로그 조회
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get("limit") || "50");
  return NextResponse.json({ logs: getLogs(limit) });
}

// DELETE — 로그 초기화
export async function DELETE() {
  clearLogs();
  return NextResponse.json({ success: true, message: "로그가 초기화되었습니다." });
}
