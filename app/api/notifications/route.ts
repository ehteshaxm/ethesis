import { NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { and, desc, eq, isNull } from "drizzle-orm";
import * as schema from "@/db/schema";

export const runtime = "nodejs";

function getDb() {
  if (!process.env.DATABASE_URL) return null;
  return drizzle(neon(process.env.DATABASE_URL), { schema });
}

// ─── GET /api/notifications?wallet=0x… ───────────────────────────────

export async function GET(req: NextRequest) {
  const db = getDb();
  if (!db) {
    return NextResponse.json({ error: "DATABASE_URL not configured." }, { status: 503 });
  }

  const wallet = req.nextUrl.searchParams.get("wallet");
  if (!wallet || !/^0x[0-9a-fA-F]{40}$/.test(wallet)) {
    return NextResponse.json({ error: "wallet query param required (0x address)." }, { status: 400 });
  }

  const user = await db.query.users.findFirst({
    where: eq(schema.users.walletAddress, wallet.toLowerCase()),
  });
  if (!user) {
    return NextResponse.json({ notifications: [], unreadCount: 0 });
  }

  const notifications = await db.query.notifications.findMany({
    where: eq(schema.notifications.userId, user.id),
    orderBy: desc(schema.notifications.createdAt),
    limit: 50,
  });

  const unreadCount = notifications.filter((n) => !n.readAt).length;

  return NextResponse.json({ notifications, unreadCount });
}
