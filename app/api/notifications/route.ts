// GET /api/notifications — demo stub.

import { NextRequest, NextResponse } from "next/server";
import { DEMO_NOTIFICATIONS } from "@/lib/demo-fixtures";

export const runtime = "edge";

export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get("wallet");
  if (!wallet || !/^0x[0-9a-fA-F]{40}$/.test(wallet)) {
    return NextResponse.json(
      { error: "wallet query param required (0x address)." },
      { status: 400 },
    );
  }

  const notifications = DEMO_NOTIFICATIONS.map((n) => ({
    ...n,
    createdAt: n.createdAt.toISOString(),
    readAt: n.readAt ? n.readAt.toISOString() : null,
  }));
  const unreadCount = notifications.filter((n) => !n.readAt).length;

  return NextResponse.json({ notifications, unreadCount });
}
