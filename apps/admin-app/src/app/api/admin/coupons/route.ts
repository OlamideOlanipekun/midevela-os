import { NextRequest, NextResponse } from "next/server";
import { listCoupons, createCoupon } from "@/lib/billing/service";

export async function GET() {
  const data = await listCoupons();
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const coupon = await createCoupon(body);
  return NextResponse.json(coupon, { status: 201 });
}
