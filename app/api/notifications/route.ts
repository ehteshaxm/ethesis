// GET /api/notifications — demo stub. No auth, no wallet.

import { NextResponse } from "next/server";
import { DEMO_NOTIFICATIONS } from "@/lib/demo-fixtures";

export const runtime = "edge";

export async function GET() {
  const notifications = DEMO_NOTIFICATIONS.map((n) => ({
    ...n,
    createdAt: n.createdAt.toISOString(),
    readAt: n.readAt ? n.readAt.toISOString() : null,
  }));
  const unreadCount = notifications.filter((n) => !n.readAt).length;
  return NextResponse.json({ notifications, unreadCount });
}
