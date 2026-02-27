import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

let cachedRate: { rate: number; timestamp: number } | null = null;
const CACHE_TTL = 10 * 60 * 1000; // 10분 캐시

export async function GET() {
  try {
    // 캐시가 유효하면 반환
    if (cachedRate && Date.now() - cachedRate.timestamp < CACHE_TTL) {
      return NextResponse.json({ rate: cachedRate.rate, cached: true });
    }

    // Yahoo Finance에서 USD/KRW 환율 조회
    const res = await fetch(
      "https://query1.finance.yahoo.com/v8/finance/chart/KRW=X?interval=1d&range=1d",
      { cache: "no-store" }
    );

    if (res.ok) {
      const data = await res.json();
      const price =
        data?.chart?.result?.[0]?.meta?.regularMarketPrice ||
        data?.chart?.result?.[0]?.meta?.previousClose;
      if (price && price > 0) {
        cachedRate = { rate: price, timestamp: Date.now() };
        return NextResponse.json({ rate: price, cached: false });
      }
    }

    // 폴백: 기본 환율
    const fallbackRate = cachedRate?.rate || 1350;
    return NextResponse.json({ rate: fallbackRate, cached: true, fallback: true });
  } catch {
    const fallbackRate = cachedRate?.rate || 1350;
    return NextResponse.json({ rate: fallbackRate, cached: true, fallback: true });
  }
}
