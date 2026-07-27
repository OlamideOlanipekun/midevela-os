"use client";

import { useState, useEffect } from "react";
import { apiRequest } from "@/lib/api/request";
import { Spinner } from "@/components/ui/Spinner";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import type { CatalogAnalytics, ProductItem, CategoryItem, CatalogHealthData, SyncJobItem, RankingData } from "@/lib/catalog/types";

export default function CatalogPage() {
  const [analytics, setAnalytics] = useState<CatalogAnalytics | null>(null);
  const [health, setHealth] = useState<CatalogHealthData | null>(null);
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [ranking, setRanking] = useState<RankingData[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"dashboard" | "products" | "categories" | "ranking">("dashboard");
  const [search, setSearch] = useState("");

  useEffect(() => {
    Promise.all([
      apiRequest<CatalogAnalytics>("/api/admin/catalog/health"),
      apiRequest<ProductItem[]>("/api/admin/catalog/products?limit=5"),
      apiRequest<CategoryItem[]>("/api/admin/catalog/categories?orgId=all"),
      apiRequest<RankingData[]>("/api/admin/catalog/recommendations?limit=10"),
    ]).then(([a, p, c, r]) => {
      if (a.ok) setAnalytics(a.data as any);
      if (a.ok) setHealth(a.data as any);
      if (p.ok) setProducts(Array.isArray(p.data) ? p.data : ((p.data as any)?.items || []));
      if (c.ok) setCategories(Array.isArray(c.data) ? c.data : []);
      if (r.ok) setRanking(Array.isArray(r.data) ? r.data : []);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="flx-center py-20"><Spinner size="lg" /></div>;

  return (
    <div className="flx-col gap-4">
      <div className="dash-header">
        <div>
          <div className="dash-breadcrumb">Catalog</div>
          <h1 className="dash-title">Catalog Operations</h1>
        </div>
      </div>

      {/* Tab Nav */}
      <div className="flx-row gap-1 border-b border-border pb-2">
        {(["dashboard", "products", "categories", "ranking"] as const).map((t) => (
          <button key={t} className={`px-3 py-1.5 text-sm font-medium rounded-t ${tab === t ? "bg-paper-raised border border-border border-b-transparent text-teal-deep" : "text-ink-soft hover:text-ink"}`} onClick={() => setTab(t)}>
            {t === "dashboard" ? "Dashboard" : t === "products" ? "Products" : t === "categories" ? "Categories" : "Ranking"}
          </button>
        ))}
      </div>

      {tab === "dashboard" && (
        <>
          {health && (
            <div className="dash-grid-3col">
              <div className="p-4 rounded-xl border border-border bg-paper-raised flx-col gap-2">
                <div className="text-2xl font-bold">{health.totalProducts.toLocaleString()}</div>
                <div className="text-xs text-ink-soft uppercase tracking-wide">Products</div>
              </div>
              <div className="p-4 rounded-xl border border-border bg-paper-raised flx-col gap-2">
                <div className="text-2xl font-bold">{health.activeProducts.toLocaleString()}</div>
                <div className="text-xs text-ink-soft uppercase tracking-wide">Active Products</div>
              </div>
              <div className="p-4 rounded-xl border border-border bg-paper-raised flx-col gap-2">
                <div className="text-2xl font-bold">{health.missingImages}</div>
                <div className="text-xs text-ink-soft uppercase tracking-wide">Missing Images</div>
              </div>
              <div className="p-4 rounded-xl border border-border bg-paper-raised flx-col gap-2">
                <div className="text-2xl font-bold">{health.missingPrices}</div>
                <div className="text-xs text-ink-soft uppercase tracking-wide">Missing Prices</div>
              </div>
              <div className="p-4 rounded-xl border border-border bg-paper-raised flx-col gap-2">
                <div className="text-2xl font-bold text-rust">{health.outOfStock.toLocaleString()}</div>
                <div className="text-xs text-ink-soft uppercase tracking-wide">Out of Stock</div>
              </div>
              <div className="p-4 rounded-xl border border-border bg-paper-raised flx-col gap-2">
                <div className="text-2xl font-bold text-gold">{health.duplicateCount}</div>
                <div className="text-xs text-ink-soft uppercase tracking-wide">Duplicates</div>
              </div>
            </div>
          )}

          {/* Recent Products */}
          <div className="rounded-xl border border-border bg-paper-raised overflow-hidden">
            <div className="px-4 py-3 border-b border-border font-semibold text-sm">Recent Products</div>
            <div className="divide-y divide-border">
              {products.map((p) => (
                <div key={p.id} className="px-4 py-3 flx-row justify-between items-center">
                  <div>
                    <div className="text-sm font-medium">{p.name}</div>
                    <div className="text-xs text-ink-soft">{p.sku || "No SKU"} · ₦{Number(p.price).toLocaleString()}</div>
                  </div>
                  <div className="flx-row gap-2 items-center">
                    <span className={`text-xs font-mono ${p.inventory > 0 ? "text-teal" : "text-red"}`}>{p.inventory > 0 ? `${p.inventory} in stock` : "Out of stock"}</span>
                    {!p.active && <Badge variant="rust" size="sm">Inactive</Badge>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Top Rankings */}
          {ranking.length > 0 && (
            <div className="rounded-xl border border-border bg-paper-raised overflow-hidden">
              <div className="px-4 py-3 border-b border-border font-semibold text-sm">Top Recommendations</div>
              <div className="divide-y divide-border">
                {ranking.slice(0, 5).map((r) => (
                  <div key={r.productId} className="px-4 py-3 flx-row justify-between items-center">
                    <div className="text-sm">{r.productName}</div>
                    <div className="text-xs font-mono text-ink-soft">Rank {r.avgRank.toFixed(1)} · {r.avgConfidence.toFixed(0)}% confidence</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {tab === "products" && (
        <div className="flx-col gap-3">
          <div className="flx-row gap-2">
            <input className="flex-1 px-3 py-2 rounded-lg border border-border bg-paper text-sm outline-none focus:border-teal" placeholder="Search products..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="rounded-xl border border-border bg-paper-raised overflow-hidden">
            <div className="divide-y divide-border">
              {products.filter((p) => !search || p.name.toLowerCase().includes(search.toLowerCase())).map((p) => (
                <div key={p.id} className="px-4 py-3 flx-row justify-between items-center hover:bg-black/[0.02]">
                  <div>
                    <div className="text-sm font-medium">{p.name}</div>
                    <div className="text-xs text-ink-soft">₦{Number(p.price).toLocaleString()} · {p.imageCount} images · {p.variantCount} variants</div>
                  </div>
                  <div className="flx-row gap-2 items-center">
                    <Badge variant={p.active ? "teal" : "default"} size="sm">{p.active ? "Active" : "Inactive"}</Badge>
                    <span className="text-xs text-ink-soft">{new Date(p.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === "categories" && (
        <div className="rounded-xl border border-border bg-paper-raised overflow-hidden">
          <div className="px-4 py-3 border-b border-border font-semibold text-sm">Categories</div>
          <div className="divide-y divide-border">
            {categories.map((c) => (
              <div key={c.id} className="px-4 py-3">
                <div className="flx-row justify-between items-center">
                  <div className="text-sm font-medium">{c.name}</div>
                  <span className="text-xs text-ink-soft">{c.productCount} products</span>
                </div>
                {c.children.length > 0 && (
                  <div className="ml-4 mt-2 space-y-1">
                    {c.children.map((ch) => (
                      <div key={ch.id} className="flx-row justify-between items-center text-xs text-ink-soft">
                        <span>{ch.name}</span>
                        <span>{ch.productCount} products</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "ranking" && (
        <div className="rounded-xl border border-border bg-paper-raised overflow-hidden">
          <div className="px-4 py-3 border-b border-border font-semibold text-sm">Recommendation Ranking</div>
          <div className="divide-y divide-border">
            {ranking.map((r) => (
              <div key={r.productId} className="px-4 py-3">
                <div className="flx-row justify-between items-center">
                  <div className="text-sm font-medium">#{r.avgRank.toFixed(0)} {r.productName}</div>
                  <div className="text-xs font-mono text-teal">{r.avgConfidence.toFixed(0)}% confidence</div>
                </div>
                {r.rankings.slice(0, 3).map((rr, i) => (
                  <div key={i} className="flx-row gap-4 mt-1 text-xs text-ink-soft">
                    <span>Similarity: {rr.similarity ? `${(rr.similarity * 100).toFixed(0)}%` : "N/A"}</span>
                    <span>Sales: {rr.salesScore ? `${(rr.salesScore * 100).toFixed(0)}%` : "N/A"}</span>
                    <span>Clicked: {rr.clicked ? "Yes" : "No"}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
