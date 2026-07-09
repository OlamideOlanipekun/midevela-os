/**
 * LLM provider interface. MVP implementation calls Groq directly via
 * fetch (Groq's API is OpenAI-compatible) — no SDK dependency, kept
 * deliberately swappable so a Claude implementation can sit behind the
 * same interface later without touching the conversation engine.
 */

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LlmJsonResult {
  raw: string;
  inputTokens: number;
  outputTokens: number;
}

const GROQ_MODEL = "llama-3.3-70b-versatile";

/**
 * Requests a JSON-object completion. Throws on transport/API failure;
 * callers are responsible for parsing + validating `raw` (the model can
 * return syntactically-invalid JSON even in json_object mode) and for
 * retry/fallback behavior.
 */
export async function completeJson(messages: ChatMessage[]): Promise<LlmJsonResult> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("GROQ_API_KEY is not set.");
  }

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages,
      response_format: { type: "json_object" },
      temperature: 0.4,
      max_tokens: 700,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Groq request failed (${res.status}): ${body.slice(0, 300)}`);
  }

  const data = await res.json();
  const raw: string | undefined = data?.choices?.[0]?.message?.content;
  if (!raw) {
    throw new Error("Groq response had no message content.");
  }

  return {
    raw,
    inputTokens: data?.usage?.prompt_tokens ?? 0,
    outputTokens: data?.usage?.completion_tokens ?? 0,
  };
}
