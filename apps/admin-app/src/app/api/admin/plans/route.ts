import { NextRequest, NextResponse } from "next/server";
import { listPlans, createPlan, updatePlan } from "@/lib/billing/service";

export async function GET() {
  const data = await listPlans();
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const plan = await createPlan(body);
  return NextResponse.json(plan, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const body = await request.json();
  const plan = await updatePlan(body.id, body);
  return NextResponse.json(plan);
}
