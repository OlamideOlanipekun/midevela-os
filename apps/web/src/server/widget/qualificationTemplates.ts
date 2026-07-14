/**
 * Default qualification flows, seeded onto a Category's `qualificationFlow`
 * JSON when the category is created (or backfilled). The widget NEVER
 * hardcodes these steps — it only ever renders whatever flow the backend
 * returns, so a merchant (or a future industry template) can fully
 * customize the questions without touching widget code.
 *
 * A flow is an ordered list of steps; each step maps to one funnel screen
 * (a single-choice question, or the budget picker).
 */

export interface QualificationOption {
  label: string;
  value: string;
  icon?: string;
}

export interface QualificationStep {
  id: string;
  /** Key this step's answer is stored under in the answers object. */
  key: string;
  question: string;
  type: "single" | "budget";
  options: QualificationOption[];
}

export type QualificationFlow = QualificationStep[];

/** Budget bucket values are "min-max" (max empty = open-ended above min). */
const BUDGET_STEP: QualificationStep = {
  id: "budget",
  key: "budget",
  question: "What's your budget?",
  type: "budget",
  options: [
    { label: "Under ₦200,000", value: "0-200000" },
    { label: "₦200k – ₦500k", value: "200000-500000" },
    { label: "₦500k – ₦1M", value: "500000-1000000" },
    { label: "Above ₦1M", value: "1000000-" },
  ],
};

const LAPTOP_FLOW: QualificationFlow = [
  {
    id: "purpose",
    key: "purpose",
    question: "What will you use your laptop for?",
    type: "single",
    options: [
      { label: "Programming", value: "programming", icon: "💻" },
      { label: "Gaming", value: "gaming", icon: "🎮" },
      { label: "Office work", value: "office", icon: "📊" },
      { label: "School", value: "school", icon: "🎓" },
      { label: "Video editing", value: "video_editing", icon: "🎬" },
    ],
  },
  BUDGET_STEP,
  {
    id: "brand",
    key: "brand",
    question: "Any preferred brand?",
    type: "single",
    options: [
      { label: "Apple", value: "Apple" },
      { label: "Dell", value: "Dell" },
      { label: "HP", value: "HP" },
      { label: "Lenovo", value: "Lenovo" },
      { label: "No preference", value: "" },
    ],
  },
];

const FASHION_FLOW: QualificationFlow = [
  {
    id: "gender",
    key: "gender",
    question: "Who are you shopping for?",
    type: "single",
    options: [
      { label: "Women", value: "women", icon: "👗" },
      { label: "Men", value: "men", icon: "👔" },
      { label: "Unisex", value: "unisex", icon: "🧥" },
    ],
  },
  {
    id: "type",
    key: "type",
    question: "What are you looking for?",
    type: "single",
    options: [
      { label: "Tops", value: "tops" },
      { label: "Bottoms", value: "bottoms" },
      { label: "Dresses", value: "dresses" },
      { label: "Shoes", value: "shoes" },
      { label: "Accessories", value: "accessories" },
    ],
  },
  {
    id: "size",
    key: "size",
    question: "What's your size?",
    type: "single",
    options: [
      { label: "XS", value: "XS" },
      { label: "S", value: "S" },
      { label: "M", value: "M" },
      { label: "L", value: "L" },
      { label: "XL", value: "XL" },
    ],
  },
  BUDGET_STEP,
];

const BEAUTY_FLOW: QualificationFlow = [
  {
    id: "skin_type",
    key: "skinType",
    question: "What's your skin type?",
    type: "single",
    options: [
      { label: "Oily", value: "oily" },
      { label: "Dry", value: "dry" },
      { label: "Combination", value: "combination" },
      { label: "Sensitive", value: "sensitive" },
      { label: "Normal", value: "normal" },
    ],
  },
  {
    id: "concern",
    key: "concern",
    question: "What's your main concern?",
    type: "single",
    options: [
      { label: "Acne", value: "acne" },
      { label: "Brightening", value: "brightening" },
      { label: "Anti-aging", value: "anti_aging" },
      { label: "Hydration", value: "hydration" },
      { label: "Just browsing", value: "" },
    ],
  },
  BUDGET_STEP,
];

const FURNITURE_FLOW: QualificationFlow = [
  {
    id: "room",
    key: "room",
    question: "Which room is this for?",
    type: "single",
    options: [
      { label: "Living room", value: "living_room", icon: "🛋️" },
      { label: "Bedroom", value: "bedroom", icon: "🛏️" },
      { label: "Office", value: "office", icon: "🪑" },
      { label: "Kitchen & dining", value: "kitchen", icon: "🍽️" },
    ],
  },
  {
    id: "material",
    key: "material",
    question: "Any material preference?",
    type: "single",
    options: [
      { label: "Wood", value: "wood" },
      { label: "Metal", value: "metal" },
      { label: "Fabric", value: "fabric" },
      { label: "No preference", value: "" },
    ],
  },
  BUDGET_STEP,
];

/** Fallback for any category that doesn't match a known vertical — still
 *  qualifies on budget so recommendations stay relevant, without assuming
 *  domain-specific questions we can't ask honestly. */
const GENERIC_FLOW: QualificationFlow = [BUDGET_STEP];

interface TemplateMatch {
  keywords: string[];
  flow: QualificationFlow;
}

const TEMPLATES: TemplateMatch[] = [
  { keywords: ["laptop", "computer", "pc", "notebook"], flow: LAPTOP_FLOW },
  { keywords: ["fashion", "apparel", "clothing", "wear", "shoe"], flow: FASHION_FLOW },
  { keywords: ["beauty", "cosmetic", "skincare", "skin care"], flow: BEAUTY_FLOW },
  { keywords: ["furniture", "home", "decor", "interior"], flow: FURNITURE_FLOW },
];

/** Picks a default qualification flow for a category by matching its name
 *  (and optionally the org's industry) against known vertical keywords. */
export function getDefaultQualificationFlow(categoryName: string, orgIndustry?: string | null): QualificationFlow {
  const haystack = `${categoryName} ${orgIndustry ?? ""}`.toLowerCase();
  for (const { keywords, flow } of TEMPLATES) {
    if (keywords.some((k) => haystack.includes(k))) return flow;
  }
  return GENERIC_FLOW;
}

/**
 * Named templates a merchant can explicitly pick in the dashboard's
 * category editor — v1's "editable in the dashboard" is choosing one of
 * these, not a free-form step builder. Single source of truth shared with
 * the auto-seed matching above.
 */
export const NAMED_QUALIFICATION_TEMPLATES: Record<string, { label: string; flow: QualificationFlow }> = {
  laptops: { label: "Laptops & Electronics", flow: LAPTOP_FLOW },
  fashion: { label: "Fashion & Apparel", flow: FASHION_FLOW },
  beauty: { label: "Beauty & Skincare", flow: BEAUTY_FLOW },
  furniture: { label: "Furniture & Home", flow: FURNITURE_FLOW },
  generic: { label: "Budget only (generic)", flow: GENERIC_FLOW },
};
