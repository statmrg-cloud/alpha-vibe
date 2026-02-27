import { NextRequest, NextResponse } from "next/server";

/**
 * Alpaca Trading API — 실제 주문 실행 (서버 사이드 전용)
 * API 키는 절대 클라이언트에 노출되지 않음
 *
 * Alpaca API 명세: POST /v2/orders
 * https://docs.alpaca.markets/reference/postorder
 */

const ALPACA_API_KEY = process.env.ALPACA_API_KEY || "";
const ALPACA_API_SECRET = process.env.ALPACA_API_SECRET || "";
const ALPACA_TRADING_URL =
  process.env.ALPACA_TRADING_URL || "https://paper-api.alpaca.markets";

interface OrderRequest {
  symbol: string;
  qty: number;
  side: "buy" | "sell";
  type: "market" | "limit" | "stop" | "stop_limit";
  time_in_force: "day" | "gtc" | "ioc" | "fok";
  limit_price?: number;
  stop_price?: number;
  confirmed: boolean; // 클라이언트에서 최종 확인 완료 여부
}

function validateApiKeys() {
  if (!ALPACA_API_KEY || !ALPACA_API_SECRET) {
    return {
      valid: false,
      error: "Alpaca API 키가 설정되지 않았습니다. .env.local을 확인하세요.",
    };
  }
  return { valid: true, error: null };
}

function validateOrder(body: OrderRequest) {
  const errors: string[] = [];

  if (!body.symbol || typeof body.symbol !== "string") {
    errors.push("종목 심볼이 필요합니다.");
  }
  if (!body.qty || body.qty <= 0 || !Number.isInteger(body.qty)) {
    errors.push("수량은 1 이상의 정수여야 합니다.");
  }
  if (!["buy", "sell"].includes(body.side)) {
    errors.push("주문 방향은 buy 또는 sell이어야 합니다.");
  }
  if (!["market", "limit", "stop", "stop_limit"].includes(body.type)) {
    errors.push("주문 유형이 올바르지 않습니다.");
  }
  if (!["day", "gtc", "ioc", "fok"].includes(body.time_in_force)) {
    errors.push("유효기간이 올바르지 않습니다.");
  }
  if (body.type === "limit" && (!body.limit_price || body.limit_price <= 0)) {
    errors.push("지정가 주문에는 limit_price가 필요합니다.");
  }
  if (!body.confirmed) {
    errors.push("주문이 최종 확인되지 않았습니다.");
  }

  return errors;
}

// POST — 주문 실행
export async function POST(request: NextRequest) {
  try {
    // API 키 검증
    const keyCheck = validateApiKeys();
    if (!keyCheck.valid) {
      return NextResponse.json({ error: keyCheck.error }, { status: 500 });
    }

    const body: OrderRequest = await request.json();

    // 주문 유효성 검증
    const errors = validateOrder(body);
    if (errors.length > 0) {
      return NextResponse.json(
        { error: "주문 유효성 검증 실패", details: errors },
        { status: 400 }
      );
    }

    // 최종 확인 필수
    if (!body.confirmed) {
      return NextResponse.json(
        { error: "사용자 최종 확인이 필요합니다." },
        { status: 400 }
      );
    }

    // Alpaca API 주문 요청 구성
    const orderPayload: Record<string, unknown> = {
      symbol: body.symbol.toUpperCase(),
      qty: body.qty.toString(),
      side: body.side,
      type: body.type,
      time_in_force: body.time_in_force,
    };

    if (body.limit_price) {
      orderPayload.limit_price = body.limit_price.toString();
    }
    if (body.stop_price) {
      orderPayload.stop_price = body.stop_price.toString();
    }

    // Alpaca POST /v2/orders 호출
    const res = await fetch(`${ALPACA_TRADING_URL}/v2/orders`, {
      method: "POST",
      headers: {
        "APCA-API-KEY-ID": ALPACA_API_KEY,
        "APCA-API-SECRET-KEY": ALPACA_API_SECRET,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(orderPayload),
    });

    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json(
        {
          error: "Alpaca 주문 실패",
          alpacaError: data.message || data.code || JSON.stringify(data),
          status: res.status,
        },
        { status: res.status }
      );
    }

    // 성공 응답
    return NextResponse.json({
      success: true,
      order: {
        id: data.id,
        clientOrderId: data.client_order_id,
        symbol: data.symbol,
        qty: data.qty,
        side: data.side,
        type: data.type,
        timeInForce: data.time_in_force,
        status: data.status,
        createdAt: data.created_at,
        filledAt: data.filled_at,
        filledQty: data.filled_qty,
        filledAvgPrice: data.filled_avg_price,
      },
    });
  } catch (error) {
    console.error("Trade API 오류:", error);
    return NextResponse.json(
      {
        error: `주문 처리 중 오류: ${error instanceof Error ? error.message : "알 수 없는 오류"}`,
      },
      { status: 500 }
    );
  }
}

// DELETE — 주문 취소
export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const orderId = searchParams.get("order_id");

  if (!orderId) {
    return NextResponse.json(
      { error: "order_id가 필요합니다." },
      { status: 400 }
    );
  }

  const keyCheck = validateApiKeys();
  if (!keyCheck.valid) {
    return NextResponse.json({ error: keyCheck.error }, { status: 500 });
  }

  try {
    const res = await fetch(`${ALPACA_TRADING_URL}/v2/orders/${orderId}`, {
      method: "DELETE",
      headers: {
        "APCA-API-KEY-ID": ALPACA_API_KEY,
        "APCA-API-SECRET-KEY": ALPACA_API_SECRET,
      },
    });

    if (res.status === 204) {
      return NextResponse.json({ success: true, message: "주문이 취소되었습니다." });
    }

    const data = await res.json();
    return NextResponse.json(
      { error: "주문 취소 실패", alpacaError: data.message || data },
      { status: res.status }
    );
  } catch (error) {
    return NextResponse.json(
      { error: `주문 취소 오류: ${error instanceof Error ? error.message : "알 수 없는 오류"}` },
      { status: 500 }
    );
  }
}
