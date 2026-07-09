/**
 * Voyage AI embeddings. Model output dimension must match the schema's
 * `vector(1024)` column (voyage-3-large's default output size) — if the
 * model here ever changes, the Prisma migration has to change with it.
 */

const VOYAGE_MODEL = "voyage-3-large";

/** Embeds a batch of texts in one request (cheaper than one call each). */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  const apiKey = process.env.VOYAGE_API_KEY;
  if (!apiKey) {
    throw new Error("VOYAGE_API_KEY is not set.");
  }

  const res = await fetch("https://api.voyageai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ input: texts, model: VOYAGE_MODEL }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Voyage request failed (${res.status}): ${body.slice(0, 300)}`);
  }

  const data = await res.json();
  const items: Array<{ embedding: number[]; index: number }> = data?.data ?? [];
  // Voyage documents results as index-ordered, but sort defensively rather
  // than assume — a swapped pair here silently corrupts retrieval.
  return items
    .slice()
    .sort((a, b) => a.index - b.index)
    .map((item) => item.embedding);
}

export async function embedText(text: string): Promise<number[]> {
  const [vector] = await embedTexts([text]);
  return vector;
}
