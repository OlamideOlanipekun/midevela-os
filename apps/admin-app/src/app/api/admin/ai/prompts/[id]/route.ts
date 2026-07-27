import { NextRequest, NextResponse } from "next/server";
import { getPrompt, updatePrompt, createPromptVersion } from "@/lib/ai/service";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const prompt = await getPrompt(id);
  if (!prompt) return NextResponse.json({ error: "Prompt not found" }, { status: 404 });
  return NextResponse.json(prompt);
}

export async function PATCH(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await _request.json();
  if (body.content) {
    const version = await createPromptVersion(id, body);
    return NextResponse.json(version);
  }
  const updated = await updatePrompt(id, body);
  return NextResponse.json(updated);
}
