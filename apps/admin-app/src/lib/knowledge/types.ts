export interface KnowledgeHealth {
  healthScore: number;
  totalDocuments: number;
  indexedDocuments: number;
  totalChunks: number;
  totalEmbeddings: number;
  coverage: number;
  missingAnswerCount: number;
  queueStatus: string;
}

export interface DocumentItem {
  id: string;
  orgId: string;
  title: string;
  type: string;
  url: string | null;
  fileSize: number | null;
  pageCount: number | null;
  status: string;
  source: string;
  author: string | null;
  chunkCount: number;
  totalTokens: number;
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ChunkItem {
  id: string;
  documentId: string;
  index: number;
  content: string;
  tokens: number;
  heading: string | null;
  pageNumber: number | null;
  status: string;
  createdAt: string;
}

export interface EmbeddingItem {
  id: string;
  chunkId: string;
  model: string;
  dimensions: number;
  createdAt: string;
}

export interface MissingAnswerItem {
  id: string;
  orgId: string;
  question: string;
  context: string | null;
  suggestedSource: string | null;
  status: string;
  frequency: number;
  conversationId: string | null;
  createdAt: string;
}

export interface SearchResult {
  chunkId: string;
  content: string;
  documentTitle: string;
  similarity: number;
  score: number;
  source: string;
}

export interface KnowledgeAnalytics {
  totalDocuments: number;
  indexedDocuments: number;
  failedDocuments: number;
  totalChunks: number;
  totalTokens: number;
  coverage: number;
  missingAnswers: number;
  reindexQueue: number;
}

export interface DocumentDetail extends DocumentItem {
  chunks: ChunkItem[];
}
