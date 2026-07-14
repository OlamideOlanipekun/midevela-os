"use client";

import React, { useEffect, useState } from "react";
import { useSubscription } from "@/components/providers/SubscriptionProvider";
import "./categories.css";

interface QualificationOption {
  label: string;
  value: string;
  icon?: string;
}

interface QualificationStep {
  id: string;
  key: string;
  question: string;
  type: "single" | "budget";
  options: QualificationOption[];
}

type QualificationFlow = QualificationStep[];

interface Category {
  id: string;
  name: string;
  slug: string;
  image: string | null;
  icon: string;
  displayOrder: number;
  qualificationFlow: QualificationFlow;
  productCount: number;
}

interface Template {
  key: string;
  label: string;
  flow: QualificationFlow;
}

interface ProductRow {
  id: string;
  name: string;
  category: string;
}

function flowSummary(flow: QualificationFlow): string {
  if (!flow.length) return "No qualification steps.";
  return flow.map((s) => s.question).join(" → ");
}

export default function CategoriesPage() {
  const { isReadOnly } = useSubscription();
  const [categories, setCategories] = useState<Category[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);

  const [showDrawer, setShowDrawer] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [name, setName] = useState("");
  const [image, setImage] = useState("");
  const [templateKey, setTemplateKey] = useState("");

  const [showAssign, setShowAssign] = useState(false);
  const [assignCategoryId, setAssignCategoryId] = useState<string | null>(null);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);

  const loadCategories = () => {
    setLoading(true);
    fetch("/api/categories")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data.categories)) setCategories(data.categories);
      })
      .catch((err) => console.error("Error loading categories:", err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadCategories();
    fetch("/api/categories/templates")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data.templates)) setTemplates(data.templates);
      })
      .catch(() => {});
  }, []);

  const openCreate = () => {
    setEditing(null);
    setName("");
    setImage("");
    setTemplateKey("");
    setShowDrawer(true);
  };

  const openEdit = (c: Category) => {
    setEditing(c);
    setName(c.name);
    setImage(c.image ?? "");
    setTemplateKey("");
    setShowDrawer(true);
  };

  const closeDrawer = () => {
    setShowDrawer(false);
    setEditing(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const selectedTemplate = templates.find((t) => t.key === templateKey);
    try {
      if (editing) {
        const res = await fetch("/api/categories", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: editing.id,
            name,
            image: image || null,
            ...(selectedTemplate ? { qualificationFlow: selectedTemplate.flow } : {}),
          }),
        });
        if (res.ok) loadCategories();
      } else {
        const res = await fetch("/api/categories", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            image: image || null,
            ...(selectedTemplate ? { qualificationFlow: selectedTemplate.flow } : {}),
          }),
        });
        if (res.ok) loadCategories();
      }
      closeDrawer();
    } catch (err) {
      console.error("Failed to save category:", err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this category? Products in it become uncategorized, not deleted.")) return;
    try {
      const res = await fetch(`/api/categories?id=${id}`, { method: "DELETE" });
      if (res.ok) setCategories((prev) => prev.filter((c) => c.id !== id));
    } catch (err) {
      console.error("Failed to delete category:", err);
    }
  };

  const move = async (index: number, direction: -1 | 1) => {
    const next = [...categories];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setCategories(next);
    try {
      await fetch("/api/categories", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderedIds: next.map((c) => c.id) }),
      });
    } catch (err) {
      console.error("Failed to reorder categories:", err);
    }
  };

  const openAssign = (categoryId: string) => {
    setAssignCategoryId(categoryId);
    setSelectedProductIds([]);
    setShowAssign(true);
    fetch("/api/products")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data.products)) {
          setProducts(data.products.map((p: { id: string; name: string; category: string }) => ({ id: p.id, name: p.name, category: p.category })));
        }
      })
      .catch((err) => console.error("Error loading products:", err));
  };

  const toggleProduct = (id: string) => {
    setSelectedProductIds((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));
  };

  const handleAssign = async () => {
    if (!assignCategoryId || selectedProductIds.length === 0) return;
    try {
      const res = await fetch("/api/categories/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categoryId: assignCategoryId, productIds: selectedProductIds }),
      });
      if (res.ok) {
        setShowAssign(false);
        loadCategories();
      }
    } catch (err) {
      console.error("Failed to assign products:", err);
    }
  };

  return (
    <div>
      <div className="cat-page-head">
        <div>
          <div className="eyebrow">
            <span className="dot"></span> WIDGET FUNNEL
          </div>
          <h1>Categories</h1>
        </div>
        {!loading && (
          <button className="btn-dark" onClick={openCreate} disabled={isReadOnly}>
            + Add category
          </button>
        )}
      </div>

      <p className="cat-hint">
        These power the shopping assistant&apos;s category grid and qualification questions. Only categories with
        products show up in the widget — an empty category won&apos;t appear until you assign products to it.
      </p>

      {loading ? (
        <div className="cat-grid">
          {[1, 2, 3].map((i) => (
            <div key={i} className="cat-card" style={{ height: 140 }} />
          ))}
        </div>
      ) : categories.length === 0 ? (
        <div className="alert-banner">
          <span>No categories yet. Add one, or add products with a category name from the Products page.</span>
        </div>
      ) : (
        <div className="cat-grid">
          {categories.map((c, idx) => (
            <div key={c.id} className="cat-card">
              <div className="cat-card-top">
                <div className="cat-icon-tile">
                  {c.image ? <img src={c.image} alt="" /> : c.icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="cat-name">{c.name}</div>
                  <div className="cat-count">{c.productCount} product{c.productCount === 1 ? "" : "s"}</div>
                </div>
                <div className="cat-order-controls">
                  <button className="cat-order-btn" onClick={() => move(idx, -1)} disabled={idx === 0 || isReadOnly} aria-label="Move up">↑</button>
                  <button className="cat-order-btn" onClick={() => move(idx, 1)} disabled={idx === categories.length - 1 || isReadOnly} aria-label="Move down">↓</button>
                </div>
              </div>

              {c.productCount === 0 && <span className="cat-empty-tag">Won&apos;t show in widget yet</span>}

              <div className="cat-flow-preview">
                <strong>Qualification flow:</strong> {flowSummary(c.qualificationFlow)}
              </div>

              <div className="cat-card-actions">
                <button className="cat-icon-btn" onClick={() => openAssign(c.id)} disabled={isReadOnly}>
                  Assign products
                </button>
                <button className="cat-icon-btn" onClick={() => openEdit(c)} disabled={isReadOnly}>
                  Edit
                </button>
                <button className="cat-icon-btn danger" onClick={() => handleDelete(c.id)} disabled={isReadOnly}>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* CREATE/EDIT DRAWER */}
      {showDrawer && (
        <>
          <div className="cat-drawer-overlay" onClick={closeDrawer} />
          <div className="cat-drawer">
            <div className="cat-drawer-header">
              <h3>{editing ? "Edit category" : "Add category"}</h3>
              <button className="cat-drawer-close" onClick={closeDrawer} aria-label="Close">✕</button>
            </div>

            <form className="cat-form" onSubmit={handleSave}>
              <div className="cat-field">
                <label htmlFor="cat-name">Category name</label>
                <input id="cat-name" type="text" placeholder="e.g. Laptops" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>

              <div className="cat-field">
                <label htmlFor="cat-image">Image URL (optional)</label>
                <input id="cat-image" type="text" placeholder="https://…" value={image} onChange={(e) => setImage(e.target.value)} />
              </div>

              <div className="cat-field">
                <label htmlFor="cat-template">Qualification flow</label>
                <select id="cat-template" value={templateKey} onChange={(e) => setTemplateKey(e.target.value)}>
                  <option value="">
                    {editing ? "Keep current flow" : "Auto-detect from name (recommended)"}
                  </option>
                  {templates.map((t) => (
                    <option key={t.key} value={t.key}>{t.label}</option>
                  ))}
                </select>
              </div>

              {editing && (
                <div className="cat-flow-preview">
                  <strong>Current flow:</strong> {flowSummary(editing.qualificationFlow)}
                </div>
              )}

              <button type="submit" className="btn-dark" style={{ padding: "13px 0", marginTop: 6 }}>
                {editing ? "Save changes" : "Add category"}
              </button>
            </form>
          </div>
        </>
      )}

      {/* ASSIGN PRODUCTS MODAL */}
      {showAssign && (
        <>
          <div className="cat-drawer-overlay" onClick={() => setShowAssign(false)} />
          <div className="cat-drawer">
            <div className="cat-drawer-header">
              <h3>Assign products</h3>
              <button className="cat-drawer-close" onClick={() => setShowAssign(false)} aria-label="Close">✕</button>
            </div>

            {products.length === 0 ? (
              <p style={{ color: "var(--ink-soft)", fontSize: 13 }}>No products yet — add some from the Products page first.</p>
            ) : (
              <div className="cat-assign-list">
                {products.map((p) => (
                  <label key={p.id} className="cat-assign-row">
                    <input type="checkbox" checked={selectedProductIds.includes(p.id)} onChange={() => toggleProduct(p.id)} />
                    <span className="name">{p.name}</span>
                    <span className="meta">{p.category}</span>
                  </label>
                ))}
              </div>
            )}

            <button className="btn-dark" onClick={handleAssign} disabled={selectedProductIds.length === 0}>
              Assign {selectedProductIds.length > 0 ? `${selectedProductIds.length} product${selectedProductIds.length === 1 ? "" : "s"}` : ""}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
