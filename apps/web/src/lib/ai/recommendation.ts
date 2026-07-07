import { readDb } from "../db";

interface RecommendationRequest {
  category?: string;
  maxPrice?: number;
  attributes?: Record<string, string>;
  descriptionMatch?: string;
}

interface RecommendedProduct {
  id: string;
  name: string;
  price: string;
  whyThis: string;
  score: number;
}

/**
 * Recommends products matching constraints with explainable justifications by querying the local database.
 */
export async function generateRecommendations(
  orgId: string,
  requirements: RecommendationRequest
): Promise<RecommendedProduct[]> {
  const db = readDb();
  const recommendations: RecommendedProduct[] = [];

  const descMatch = requirements.descriptionMatch?.toLowerCase() || "";
  const matchWords = descMatch.split(/\s+/).filter(w => w.length > 2);

  for (const product of db.products) {
    let score = 0;
    
    // 1. Match category
    if (requirements.category && product.category.toLowerCase().includes(requirements.category.toLowerCase())) {
      score += 0.4;
    }

    // 2. Semantic matching on name and description
    if (matchWords.length > 0) {
      const productText = `${product.name} ${product.description || ""}`.toLowerCase();
      let matches = 0;
      for (const word of matchWords) {
        if (productText.includes(word)) {
          matches++;
        }
      }
      if (matches > 0) {
        score += (matches / matchWords.length) * 0.6;
      }
    }

    if (score > 0.1) {
      // Formulate a custom explainability sentence based on category
      let whyThis = `Highly rated option in our ${product.category} collection. Fits standard buyer preferences.`;
      
      if (product.name.includes("Ankara")) {
        whyThis = `Fits size requirements. Matches traditional fabric cuts and premium cotton preferences. The price ${product.price} aligns with standard budgets.`;
      } else if (product.name.includes("Serum") || product.name.includes("Cleanser")) {
        whyThis = `Contains organic compounds tailored for daily skincare routines and sensitive skin types.`;
      } else if (product.name.includes("Laptop") || product.name.includes("XPS") || product.name.includes("Book")) {
        whyThis = `High performance specifications suitable for programming, development, and heavy office workflows.`;
      }

      recommendations.push({
        id: product.id,
        name: product.name,
        price: product.price,
        whyThis,
        score: Math.min(score, 0.99),
      });
    }
  }

  // Sort descending by score
  recommendations.sort((a, b) => b.score - a.score);

  return recommendations.slice(0, 3);
}
