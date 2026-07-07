import fs from "fs";
import path from "path";

export interface DBProduct {
  id: string;
  name: string;
  price: string;
  category: string;
  stockStatus: "In Stock" | "Low Stock" | "Out of Stock";
  stockClass: string;
  aiCompleteness: number;
  icon: string;
  description?: string;
}

export interface DBFAQ {
  question: string;
  answer: string;
  category: string;
  usageCount: number;
}

export interface DBPolicy {
  name: string;
  content: string;
  updatedAt: string;
}

export interface DBDocument {
  name: string;
  size: string;
  chunks: number;
  status: "Synced" | "Processing";
}

export interface DBSettings {
  orgName: string;
  website: string;
  country: string;
  currency: string;
  accentColor: string;
  engagementDelay: number;
  features: {
    exitIntent: boolean;
    showProductImages: boolean;
    playSounds: boolean;
  };
  tone: string;
  greeting: string;
}

export interface MidevelaDbSchema {
  products: DBProduct[];
  faqs: DBFAQ[];
  policies: DBPolicy[];
  documents: DBDocument[];
  settings: DBSettings;
}

const DB_PATH = path.join(process.cwd(), "src/data/db.json");

const defaultSettings: DBSettings = {
  orgName: "LuxeStyle NG",
  website: "luxestyle.ng",
  country: "Nigeria",
  currency: "NGN",
  accentColor: "#1EE67A",
  engagementDelay: 15,
  features: {
    exitIntent: true,
    showProductImages: true,
    playSounds: true,
  },
  tone: "friendly",
  greeting: "Good day! Welcome to LuxeStyle. How can I help you find the perfect outfit today?",
};

const defaultProducts: DBProduct[] = [
  {
    id: "prod-1",
    name: "Ankara Co-ord Set (Burgundy)",
    price: "₦28,500",
    category: "Fashion & Apparel",
    stockStatus: "In Stock",
    stockClass: "status-dot-green",
    aiCompleteness: 95,
    icon: "🛍️",
    description: "Premium Ankara cotton co-ord set in dark burgundy. Suitable for formal events and traditional weddings. Fits standard sizes S, M, L.",
  },
  {
    id: "prod-2",
    name: "Ankara Flare Gown (Blue)",
    price: "₦32,000",
    category: "Fashion & Apparel",
    stockStatus: "In Stock",
    stockClass: "status-dot-green",
    aiCompleteness: 85,
    icon: "👗",
    description: "Elegant Ankara cotton flare gown in royal blue. Double-lined borders with dynamic flow patterns. Dry clean recommended.",
  },
  {
    id: "prod-3",
    name: "Vitamin C Brightening Serum",
    price: "₦14,500",
    category: "Beauty & Cosmetics",
    stockStatus: "Low Stock",
    stockClass: "status-dot-gold",
    aiCompleteness: 90,
    icon: "🧴",
    description: "Lumina Beauty organic Vitamin C brightening serum. Active formula with hyaluronic acid and niacinamide for radiant skin tone.",
  },
  {
    id: "prod-4",
    name: "Hydrating Facial Cleanser",
    price: "₦9,200",
    category: "Beauty & Cosmetics",
    stockStatus: "In Stock",
    stockClass: "status-dot-green",
    aiCompleteness: 45,
    icon: "🧴",
    description: "Gentle daily foaming cleanser. Hydrates dry skin while removing oils.",
  },
  {
    id: "prod-5",
    name: "Dell XPS 13 9310 Laptop",
    price: "₦650,000",
    category: "Electronics",
    stockStatus: "In Stock",
    stockClass: "status-dot-green",
    aiCompleteness: 92,
    icon: "💻",
    description: "Dell XPS 13. Intel Core i7 11th Gen, 16GB RAM, 512GB SSD, 13.4 inch FHD Display. Designed for software developers and designers.",
  },
  {
    id: "prod-6",
    name: "HP EliteBook 840 G8 Laptop",
    price: "₦480,000",
    category: "Electronics",
    stockStatus: "Out of Stock",
    stockClass: "status-dot-red",
    aiCompleteness: 75,
    icon: "💻",
    description: "HP EliteBook 840. Intel Core i5 11th Gen, 16GB RAM, 256GB SSD. Highly portable, 14 hours battery life, anti-glare screen.",
  },
];

const defaultFAQs: DBFAQ[] = [
  {
    question: "Do you deliver outside Lagos?",
    answer: "Yes! We offer nationwide delivery across all 36 states in Nigeria. Express delivery takes 24 hours within Lagos, while standard delivery to other states takes 3-5 business days.",
    category: "Shipping",
    usageCount: 47,
  },
  {
    question: "What is your return policy?",
    answer: "We accept returns within 7 days of delivery for clothing items in unused condition with tags intact. Cosmetics and custom-made apparel cannot be returned.",
    category: "Returns",
    usageCount: 32,
  },
  {
    question: "How do I pay for my orders?",
    answer: "Payment is secure through Paystack. You can pay via card, bank transfer, USSD, or mobile money immediately inside our chat system.",
    category: "Payments",
    usageCount: 29,
  },
];

const defaultPolicies: DBPolicy[] = [
  {
    name: "Shipping Policy",
    content: "Standard shipping is ₦2,000 for Lagos and ₦4,500 for other Nigerian states (e.g. Port Harcourt, Abuja, Kano). Free shipping is applicable for orders above ₦100,000.",
    updatedAt: "2 weeks ago",
  },
  {
    name: "Return & Refund Policy",
    content: "Returns must be initiated within 7 days. Refunds are processed within 3-5 business days to the customer's bank account once items are verified.",
    updatedAt: "1 month ago",
  },
];

const defaultDocuments: DBDocument[] = [
  { name: "luxestyle-size-guide-2026.pdf", size: "1.4 MB", chunks: 14, status: "Synced" },
  { name: "return-policy-detailed-v2.docx", size: "84 KB", chunks: 4, status: "Synced" },
];

export function readDb(): MidevelaDbSchema {
  try {
    if (!fs.existsSync(DB_PATH)) {
      const initialDb: MidevelaDbSchema = {
        products: defaultProducts,
        faqs: defaultFAQs,
        policies: defaultPolicies,
        documents: defaultDocuments,
        settings: defaultSettings,
      };
      writeDb(initialDb);
      return initialDb;
    }
    const raw = fs.readFileSync(DB_PATH, "utf-8");
    const parsed = JSON.parse(raw);
    if (!parsed.settings) {
      parsed.settings = defaultSettings;
      writeDb(parsed);
    }
    return parsed;
  } catch (err) {
    console.error("Error reading db:", err);
    return {
      products: defaultProducts,
      faqs: defaultFAQs,
      policies: defaultPolicies,
      documents: defaultDocuments,
      settings: defaultSettings,
    };
  }
}

export function writeDb(data: MidevelaDbSchema): void {
  try {
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.error("Error writing db:", err);
  }
}
