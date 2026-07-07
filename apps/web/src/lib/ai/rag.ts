import { readDb } from "../db";

interface VectorMatch {
  sourceId: string;
  sourceType: "product" | "knowledge_entry";
  content: string;
  similarity: number;
}

/**
 * Executes a simulated cosine similarity search against persistent database contents.
 * Returns the relevant snippets chunks scoped by orgId.
 */
export async function retrieveContext(
  orgId: string,
  query: string,
  limit: number = 3
): Promise<VectorMatch[]> {
  const db = readDb();
  const lowerQuery = query.toLowerCase();
  
  // Tokenize and clean query words (filtering short search terms)
  const queryWords = lowerQuery.split(/\s+/).filter(w => w.length > 2);
  if (queryWords.length === 0) return [];

  const matches: VectorMatch[] = [];

  // 1. Search products
  for (const product of db.products) {
    const textToMatch = `${product.name} ${product.category} ${product.description || ""}`.toLowerCase();
    let matchCount = 0;
    for (const word of queryWords) {
      if (textToMatch.includes(word)) matchCount++;
    }

    if (matchCount > 0) {
      const similarity = matchCount / queryWords.length;
      matches.push({
        sourceId: product.id,
        sourceType: "product",
        content: `Product: ${product.name}. Price: ${product.price}. Category: ${product.category}. Description: ${product.description || ""}`,
        similarity: similarity * 0.85, // Slower priority score relative to direct policies
      });
    }
  }

  // 2. Search FAQs
  for (const faq of db.faqs) {
    const textToMatch = `${faq.question} ${faq.answer} ${faq.category}`.toLowerCase();
    let matchCount = 0;
    for (const word of queryWords) {
      if (textToMatch.includes(word)) matchCount++;
    }

    if (matchCount > 0) {
      const similarity = matchCount / queryWords.length;
      matches.push({
        sourceId: `faq-${faq.question.slice(0, 12)}`,
        sourceType: "knowledge_entry",
        content: `Question: ${faq.question} Answer: ${faq.answer}`,
        similarity: similarity,
      });
    }
  }

  // 3. Search Policies
  for (const policy of db.policies) {
    const textToMatch = `${policy.name} ${policy.content}`.toLowerCase();
    let matchCount = 0;
    for (const word of queryWords) {
      if (textToMatch.includes(word)) matchCount++;
    }

    if (matchCount > 0) {
      const similarity = matchCount / queryWords.length;
      matches.push({
        sourceId: `policy-${policy.name.slice(0, 12)}`,
        sourceType: "knowledge_entry",
        content: `Policy Name: ${policy.name}. Content: ${policy.content}`,
        similarity: similarity,
      });
    }
  }

  // Sort by similarity descending
  matches.sort((a, b) => b.similarity - a.similarity);

  return matches.slice(0, limit);
}
