import prisma from "@/lib/prisma";

/**
 * Real "is this AI ready to sell?" signal for an org. Every number is from
 * the DB — no fabricated percentages. Powers three surfaces: the onboarding
 * AI-readiness score, the dashboard Widget Health card, and the launch
 * checklist. Weighted so the things that actually make the assistant work
 * (products + embeddings) dominate the score.
 */

type ItemStatus = "pass" | "warn" | "missing";

export interface ReadinessItem {
  key: string;
  label: string;
  status: ItemStatus;
  detail: string;
  weight: number; // contribution to the score when passing
}

export interface Readiness {
  score: number; // 0-100, real
  ready: boolean; // products + embeddings present = the AI can actually recommend
  items: ReadinessItem[];
  counts: {
    products: number;
    categories: number;
    faqs: number;
    policies: number;
    embeddedProducts: number;
    conversations: number;
  };
}

export async function getReadiness(orgId: string): Promise<Readiness> {
  const [products, categories, faqs, policies, embeddedProducts, conversations] = await Promise.all([
    prisma.product.count({ where: { orgId } }),
    prisma.category.count({ where: { orgId } }),
    prisma.knowledgeEntry.count({ where: { orgId, type: "FAQ" } }),
    prisma.knowledgeEntry.count({ where: { orgId, type: "POLICY" } }),
    prisma.embedding.count({ where: { orgId, sourceType: "PRODUCT" } }),
    prisma.conversation.count({ where: { orgId } }),
  ]);

  const items: ReadinessItem[] = [
    {
      key: "products",
      label: "Products added",
      status: products > 0 ? "pass" : "missing",
      detail: products > 0 ? `${products} product${products === 1 ? "" : "s"} in your catalog` : "Add products — the AI has nothing to recommend without them",
      weight: 30,
    },
    {
      key: "recommendation",
      label: "AI can recommend",
      status: products === 0 ? "missing" : embeddedProducts > 0 ? "pass" : "warn",
      detail:
        products === 0
          ? "Add products first"
          : embeddedProducts > 0
            ? `${embeddedProducts} product${embeddedProducts === 1 ? "" : "s"} indexed for AI search`
            : "Products aren't indexed yet — they'll become searchable shortly after import",
      weight: 25,
    },
    {
      key: "categories",
      label: "Categories set up",
      status: categories > 0 ? "pass" : "warn",
      detail: categories > 0 ? `${categories} categor${categories === 1 ? "y" : "ies"}` : "No categories — the widget's shopping grid will be empty",
      weight: 15,
    },
    {
      key: "faqs",
      label: "FAQs in knowledge base",
      status: faqs > 0 ? "pass" : "warn",
      detail: faqs > 0 ? `${faqs} FAQ${faqs === 1 ? "" : "s"}` : "Add FAQs so the AI can answer common questions",
      weight: 15,
    },
    {
      key: "policies",
      label: "Policies (shipping, returns)",
      status: policies > 0 ? "pass" : "warn",
      detail: policies > 0 ? `${policies} polic${policies === 1 ? "y" : "ies"}` : "Add shipping/returns policies so the AI can answer delivery questions",
      weight: 15,
    },
  ];

  const score = items.reduce((sum, it) => sum + (it.status === "pass" ? it.weight : 0), 0);
  const ready = products > 0 && embeddedProducts > 0;

  return {
    score,
    ready,
    items,
    counts: { products, categories, faqs, policies, embeddedProducts, conversations },
  };
}
