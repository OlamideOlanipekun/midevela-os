export interface CatalogHealthData {
  totalProducts: number;
  activeProducts: number;
  missingImages: number;
  missingPrices: number;
  missingCategories: number;
  duplicateCount: number;
  brokenUrls: number;
  outOfStock: number;
  lastChecked: string;
}

export interface ProductItem {
  id: string;
  orgId: string;
  categoryId: string | null;
  categoryName: string | null;
  name: string;
  slug: string | null;
  description: string | null;
  price: number;
  comparePrice: number | null;
  currency: string;
  costPrice: number | null;
  sku: string | null;
  barcode: string | null;
  inventory: number;
  weight: number | null;
  active: boolean;
  seoTitle: string | null;
  seoDescription: string | null;
  tags: string[];
  attributes: Record<string, unknown>;
  source: string;
  externalId: string | null;
  externalUrl: string | null;
  imageCount: number;
  variantCount: number;
  aiUsageCount: number;
  lastRecommendedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProductVariantItem {
  id: string;
  productId: string;
  sku: string | null;
  name: string | null;
  price: number | null;
  comparePrice: number | null;
  currency: string;
  inventory: number;
  weight: number | null;
  attributes: Record<string, unknown>;
  imageUrl: string | null;
  sortOrder: number;
  active: boolean;
}

export interface ProductImageItem {
  id: string;
  productId: string;
  url: string;
  altText: string | null;
  width: number | null;
  height: number | null;
  sortOrder: number;
  isPrimary: boolean;
}

export interface ProductDetail extends ProductItem {
  variants: ProductVariantItem[];
  images: ProductImageItem[];
  recommendationStats: {
    totalRankings: number;
    avgScore: number;
    clickRate: number;
    purchaseRate: number;
  };
}

export interface CategoryItem {
  id: string;
  orgId: string;
  name: string;
  slug: string | null;
  description: string | null;
  parentId: string | null;
  imageUrl: string | null;
  sortOrder: number;
  productCount: number;
  children: CategoryItem[];
}

export interface CatalogAnalytics {
  totalProducts: number;
  activeProducts: number;
  totalCategories: number;
  totalImages: number;
  totalVariants: number;
  outOfStock: number;
  syncQueueStatus: string;
  duplicateCount: number;
}

export interface SyncJobItem {
  id: string;
  orgId: string;
  source: string;
  status: string;
  totalItems: number;
  processedItems: number;
  failedItems: number;
  errors: Record<string, unknown>[];
  fileName: string | null;
  fileSize: number | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

export interface RecommendationRanking {
  rank: number;
  similarity: number | null;
  popularity: number | null;
  salesScore: number | null;
  confidence: number | null;
  clicked: boolean;
  purchased: boolean;
}

export interface RankingData {
  productName: string;
  productId: string;
  rankings: RecommendationRanking[];
  avgRank: number;
  avgConfidence: number;
}
