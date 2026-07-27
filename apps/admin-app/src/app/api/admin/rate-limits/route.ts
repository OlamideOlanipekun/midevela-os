import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;

    // Stats mode
    if (sp.get("stats") === "true") {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const [totalBlocks, todayBlocks, byEndpoint, byIp] = await Promise.all([
        prisma.systemEvent.count({ where: { source: "rate-limit" } }),
        prisma.systemEvent.count({ where: { source: "rate-limit", createdAt: { gte: today } } }),
        prisma.systemEvent.groupBy({
          by: ["title"],
          where: { source: "rate-limit" },
          _count: true,
          orderBy: { _count: { title: "desc" } },
          take: 10,
        }),
        prisma.$queryRawUnsafe(`
          SELECT metadata->>'ip' as ip, COUNT(*)::int as count
          FROM system_events WHERE source='rate-limit'
          GROUP BY metadata->>'ip' ORDER BY count DESC LIMIT 10
        `),
      ]);
      return NextResponse.json({ totalBlocks, todayBlocks, byEndpoint, byIp });
    }

    // List mode
    const page = Math.max(1, Number(sp.get("page")) || 1);
    const limit = Math.min(100, Math.max(1, Number(sp.get("limit")) || 20));
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      prisma.systemEvent.findMany({
        where: { source: "rate-limit" },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.systemEvent.count({ where: { source: "rate-limit" } }),
    ]);

    return NextResponse.json({
      items: items.map((e) => ({
        id: e.id,
        type: e.type,
        title: e.title,
        message: e.message,
        metadata: e.metadata as Record<string, unknown>,
        createdAt: e.createdAt.toISOString(),
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.error("rate-limits error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { id } = await request.json();
    if (id) {
      await prisma.systemEvent.delete({ where: { id } });
    } else {
      await prisma.systemEvent.deleteMany({ where: { source: "rate-limit" } });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("rate-limits delete error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
