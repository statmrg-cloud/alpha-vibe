import { NextRequest, NextResponse } from "next/server";
import { getConfig, updateConfig } from "@/lib/autotrade/engine";

// GET — 현재 설정 조회
export async function GET() {
  return NextResponse.json(getConfig());
}

// PUT — 설정 업데이트
export async function PUT(request: NextRequest) {
  try {
    const updates = await request.json();
    const updated = updateConfig(updates);
    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json(
      { error: `설정 업데이트 실패: ${error instanceof Error ? error.message : "unknown"}` },
      { status: 400 }
    );
  }
}
