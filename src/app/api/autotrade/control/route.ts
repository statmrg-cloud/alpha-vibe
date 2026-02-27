import { NextRequest, NextResponse } from "next/server";
import { startEngine, stopEngine, getStatus } from "@/lib/autotrade/engine";

// GET — 상태 조회
export async function GET() {
  return NextResponse.json(getStatus());
}

// POST — 엔진 시작/중지
export async function POST(request: NextRequest) {
  try {
    const { action } = await request.json();

    if (action === "start") {
      const result = startEngine();
      return NextResponse.json(result);
    }

    if (action === "stop") {
      const result = stopEngine();
      return NextResponse.json(result);
    }

    return NextResponse.json(
      { error: "action은 'start' 또는 'stop'이어야 합니다." },
      { status: 400 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: `제어 오류: ${error instanceof Error ? error.message : "unknown"}` },
      { status: 500 }
    );
  }
}
