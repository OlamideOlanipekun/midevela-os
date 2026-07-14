"use client";

import React, { useState, useEffect } from "react";
import { useSubscription } from "@/components/providers/SubscriptionProvider";
import "./products.css";

interface Product {
  id: string;
  name: string;
  brand?: string;
  price: string;
  category: string;
  stockStatus: "In Stock" | "Low Stock" | "Out of Stock";
  stockClass: string;
  aiCompleteness: number;
  icon: string;
  description?: string;
}

interface CategoryOption {
  id: string;
  name: string;
}

function qualityColor(pct: number) {
  if (pct > 80) return "var(--teal)";
  if (pct > 50) return "var(--amber)";
  return "var(--rust)";
}

export default function ProductsPage() {
  const { isReadOnly } = useSubscription();
  const [products, setProducts] = useState<Product[]>([]);
  const [categoryOptions, setCategoryOptions] = useState<CategoryOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [showAddDrawer, setShowAddDrawer] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  const [newName, setNewName] = useState("");
  const [newBrand, setNewBrand] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [newStock, setNewStock] = useState<"In Stock" | "Low Stock" | "Out of Stock">("In Stock");
  const [newDescription, setNewDescription] = useState("");

  useEffect(() => {
    setLoading(true);
    fetch("/api/products")
      .then((res) => res.json())
      .then((data) => {
        if (data.products) setProducts(data.products);
      })
      .catch((err) => console.error("Error loading products:", err))
      .finally(() => setLoading(false));

    // Real categories drive both the filter and the add-form dropdown —
    // previously this was 3 hardcoded options unrelated to the widget's
    // actual category foundation.
    fetch("/api/categories")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data.categories)) {
          const opts = data.categories.map((c: { id: string; name: string }) => ({ id: c.id, name: c.name }));
          setCategoryOptions(opts);
          if (opts.length > 0) setNewCategory((prev) => prev || opts[0].name);
        }
      })
      .catch((err) => console.error("Error loading categories:", err));

    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("action") === "add") setShowAddDrawer(true);
    }
  }, []);

  const handleStartEdit = (p: Product) => {
    setEditingProduct(p);
    setNewName(p.name);
    setNewBrand(p.brand || "");
    setNewPrice(p.price.replace(/[₦,]/g, ""));
    setNewCategory(p.category);
    setNewStock(p.stockStatus);
    setNewDescription(p.description || "");
    setShowAddDrawer(true);
  };

  const handleDeleteProduct = async (id: string) => {
    if (!confirm("Are you sure you want to delete this product?")) return;
    try {
      const res = await fetch(`/api/products?id=${id}`, { method: "DELETE" });
      if (res.ok) setProducts((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      console.error("Failed to delete product:", err);
    }
  };

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newPrice.trim()) return;

    try {
      const method = editingProduct ? "PUT" : "POST";
      const payload = editingProduct
        ? { id: editingProduct.id, name: newName, brand: newBrand, price: newPrice, category: newCategory, stockStatus: newStock, description: newDescription }
        : { name: newName, brand: newBrand, price: newPrice, category: newCategory, stockStatus: newStock, description: newDescription };

      const res = await fetch("/api/products", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success) {
        if (editingProduct) {
          setProducts((prev) => prev.map((p) => (p.id === editingProduct.id ? data.product : p)));
        } else {
          setProducts((prev) => [data.product, ...prev]);
        }
        setNewName("");
        setNewBrand("");
        setNewPrice("");
        setNewDescription("");
        setEditingProduct(null);
        setShowAddDrawer(false);
      }
    } catch (err) {
      console.error("Failed to save product:", err);
    }
  };

  const closeDrawer = () => {
    setShowAddDrawer(false);
    setEditingProduct(null);
  };

  const visibleProducts = products
    .filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
    .filter((p) => category === "all" || p.category === category);

  const lowQualityCount = products.filter((p) => p.aiCompleteness <= 50).length;
  const avgQuality = products.length
    ? Math.round(products.reduce((sum, p) => sum + p.aiCompleteness, 0) / products.length)
    : 0;

  return (
    <div>
      {/* Page head */}
      <div className="prod-page-head">
        <div>
          <div className="eyebrow">
            <span className="dot"></span> CATALOG
          </div>
          <h1>Products</h1>
        </div>
        {!loading && (
          <div className="prod-page-actions">
            <button className="btn-outline" disabled={isReadOnly}>Import CSV</button>
            <button className="btn-dark" onClick={() => setShowAddDrawer(true)} disabled={isReadOnly}>
              + Add product
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="prod-grid">
          {[1, 2, 3].map((i) => (
            <div key={i} className="prod-skeleton">
              <div className="prod-skeleton-block" style={{ width: 44, height: 44 }} />
              <div className="prod-skeleton-block" style={{ width: "70%", height: 18 }} />
              <div className="prod-skeleton-block" style={{ width: "40%", height: 14 }} />
              <div className="prod-skeleton-block" style={{ marginTop: "auto", width: "100%", height: 22 }} />
            </div>
          ))}
        </div>
      ) : (
        <>
          {lowQualityCount > 0 && (
            <div className="alert-banner" style={{ marginBottom: 20 }}>
              <span>
                ⚠ {lowQualityCount} product{lowQualityCount > 1 ? "s have" : " has"} a low AI completeness score — add a fuller description for better recommendations.
              </span>
            </div>
          )}

          <div className="prod-toolbar">
            <div className="search-pill">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                placeholder="Search products…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <select className="prod-select" value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="all">All categories</option>
              {categoryOptions.map((c) => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
            </select>
            <span className="live-pill" style={{ marginLeft: "auto" }}>
              {visibleProducts.length} items · {avgQuality}% avg. AI-ready
            </span>
          </div>

          <div className="prod-grid">
            {visibleProducts.map((p) => (
              <div key={p.id} className="prod-card">
                <div className="prod-card-top">
                  <div className="prod-icon-tile">{p.icon}</div>
                  <span className="prod-category-tag">{p.category}</span>
                </div>

                <h3 className="prod-title">{p.name}</h3>

                <div className="prod-meta-row">
                  <span className="prod-price">{p.price}</span>
                  <div className="prod-stock">
                    <span className={`status-dot ${p.stockClass}`} />
                    {p.stockStatus}
                  </div>
                </div>

                <div className="prod-divider" />

                <div className="prod-quality-row">
                  <span className="prod-quality-label">AI description quality</span>
                  <div className="prod-quality-meter">
                    <div className="prod-quality-track">
                      <div
                        className="prod-quality-fill"
                        style={{ width: `${p.aiCompleteness}%`, background: qualityColor(p.aiCompleteness) }}
                      />
                    </div>
                    <span className="prod-quality-pct" style={{ color: qualityColor(p.aiCompleteness) }}>
                      {p.aiCompleteness}%
                    </span>
                  </div>
                </div>

                <div className="prod-card-actions">
                  <button className="prod-icon-btn" onClick={() => handleStartEdit(p)} disabled={isReadOnly}>
                    Edit
                  </button>
                  <button className="prod-icon-btn danger" onClick={() => handleDeleteProduct(p.id)} disabled={isReadOnly}>
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ADD/EDIT DRAWER */}
      {showAddDrawer && (
        <>
          <div className="prod-drawer-overlay" onClick={closeDrawer} />
          <div className="prod-drawer">
            <div className="prod-drawer-header">
              <h3>{editingProduct ? "Edit product" : "Add new product"}</h3>
              <button className="prod-drawer-close" onClick={closeDrawer} aria-label="Close">
                ✕
              </button>
            </div>

            <form className="prod-form" onSubmit={handleAddProduct}>
              <div className="prod-field">
                <label htmlFor="new-prod-name">Product name</label>
                <input
                  id="new-prod-name"
                  type="text"
                  placeholder="e.g. Ankara Wrap Dress"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  required
                />
              </div>

              <div className="prod-field">
                <label htmlFor="new-prod-brand">Brand (optional)</label>
                <input
                  id="new-prod-brand"
                  type="text"
                  placeholder="e.g. Apple, Dell, Zara"
                  value={newBrand}
                  onChange={(e) => setNewBrand(e.target.value)}
                />
              </div>

              <div className="prod-field">
                <label htmlFor="new-prod-price">Price (₦)</label>
                <input
                  id="new-prod-price"
                  type="number"
                  placeholder="25000"
                  value={newPrice}
                  onChange={(e) => setNewPrice(e.target.value)}
                  required
                />
              </div>

              <div className="prod-field">
                <label htmlFor="new-prod-cat">Category</label>
                {categoryOptions.length > 0 ? (
                  <select id="new-prod-cat" value={newCategory} onChange={(e) => setNewCategory(e.target.value)}>
                    {categoryOptions.map((c) => (
                      <option key={c.id} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    id="new-prod-cat"
                    type="text"
                    placeholder="e.g. Fashion & Apparel"
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                  />
                )}
              </div>

              <div className="prod-field">
                <label htmlFor="new-prod-stock">Stock status</label>
                <select id="new-prod-stock" value={newStock} onChange={(e) => setNewStock(e.target.value as any)}>
                  <option value="In Stock">In Stock</option>
                  <option value="Low Stock">Low Stock</option>
                  <option value="Out of Stock">Out of Stock</option>
                </select>
              </div>

              <div className="prod-field">
                <label htmlFor="new-prod-desc">AI product description (specs / sizes)</label>
                <textarea
                  id="new-prod-desc"
                  placeholder="Describe dimensions, fabrics, warranty details, or custom specifications. The AI uses this data directly."
                  rows={4}
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                />
              </div>

              <button type="submit" className="btn-dark" style={{ padding: "13px 0", marginTop: 6 }}>
                {editingProduct ? "Save changes" : "Add to catalog"}
              </button>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
