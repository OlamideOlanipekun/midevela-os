"use client";

import React, { useEffect, useState } from "react";
import "./customers.css";

interface Customer {
  id: string;
  name: string;
  email: string;
  stage: string;
  stageClass: string;
  conversations: number;
  lastSeen: string;
  aiConfidence: number;
  preferences: string[];
  viewedProducts: string[];
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedCust, setSelectedCust] = useState<Customer | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 3;

  useEffect(() => {
    fetch("/api/customers")
      .then((res) => res.json())
      .then((data) => setCustomers(Array.isArray(data.customers) ? data.customers : []))
      .catch(() => setCustomers([]))
      .finally(() => setLoading(false));
  }, []);

  const filteredCustomers = customers.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );
  const totalPages = Math.max(1, Math.ceil(filteredCustomers.length / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedCustomers = filteredCustomers.slice(startIndex, startIndex + itemsPerPage);

  const avgConfidence = customers.length
    ? Math.round(customers.reduce((sum, c) => sum + c.aiConfidence, 0) / customers.length)
    : 0;

  return (
    <div>
      {/* Page head */}
      <div className="cust-page-head">
        <div>
          <div className="eyebrow">
            <span className="dot"></span> AUDIENCE
          </div>
          <h1>Customers</h1>
        </div>
        <div className="live-pill">
          {customers.length} tracked{customers.length > 0 ? ` · ${avgConfidence}% avg. AI confidence` : ""}
        </div>
      </div>

      {/* Toolbar */}
      <div className="cust-toolbar">
        <div className="search-pill">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Search customers…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCurrentPage(1);
            }}
          />
        </div>
      </div>

      {/* Table */}
      <div className="card cust-table-card">
        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--ink-soft)" }}>Loading customers…</div>
        ) : customers.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--ink-soft)" }}>
            No customers yet. Once visitors start chatting through your widget, they&apos;ll show up here.
          </div>
        ) : (
          <>
            <table className="cust-table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Email</th>
                  <th>Buying stage</th>
                  <th>Conversations</th>
                  <th>Last seen</th>
                  <th>AI confidence</th>
                </tr>
              </thead>
              <tbody>
                {paginatedCustomers.map((c) => (
                  <tr
                    key={c.id}
                    className={`cust-row ${selectedCust?.id === c.id ? "selected" : ""}`}
                    onClick={() => setSelectedCust(c)}
                  >
                    <td>
                      <div className="cust-name-cell">
                        <div className="cust-avatar">{c.name[0]}</div>
                        <span className="cust-name">{c.name}</span>
                      </div>
                    </td>
                    <td className="cust-email">{c.email}</td>
                    <td>
                      <span className={`badge ${c.stageClass}`}>{c.stage}</span>
                    </td>
                    <td style={{ fontWeight: 600 }}>{c.conversations}</td>
                    <td className="cust-email">{c.lastSeen}</td>
                    <td>
                      <div className="cust-conf-cell">
                        <div className="cust-conf-track">
                          <div className="cust-conf-fill" style={{ width: `${c.aiConfidence}%` }} />
                        </div>
                        <span className="cust-conf-pct">{c.aiConfidence}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {filteredCustomers.length > itemsPerPage && (
              <div className="cust-pagination">
                <span className="cust-pagination-info">
                  Showing {startIndex + 1}–{Math.min(startIndex + itemsPerPage, filteredCustomers.length)} of {filteredCustomers.length}
                </span>
                <div className="cust-pagination-controls">
                  <button
                    className="cust-page-btn"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    Previous
                  </button>
                  <span className="cust-page-count">{currentPage} / {totalPages}</span>
                  <button
                    className="cust-page-btn"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* DETAIL DRAWER */}
      {selectedCust && (
        <>
          <div className="cust-drawer-overlay" onClick={() => setSelectedCust(null)} />
          <div className="cust-drawer">
            <button className="cust-drawer-close" onClick={() => setSelectedCust(null)} aria-label="Close">
              ✕
            </button>

            <div className="cust-drawer-header">
              <div className="cust-drawer-avatar">{selectedCust.name[0]}</div>
              <div className="cust-drawer-name">{selectedCust.name}</div>
              <div className="cust-drawer-email">{selectedCust.email}</div>
              <span className={`badge ${selectedCust.stageClass}`}>{selectedCust.stage}</span>
            </div>

            <div className="cust-drawer-section">
              <span className="cust-drawer-label">AI confidence</span>
              <div className="cust-conf-cell">
                <div className="cust-conf-track" style={{ flex: 1, width: "auto" }}>
                  <div className="cust-conf-fill" style={{ width: `${selectedCust.aiConfidence}%` }} />
                </div>
                <span className="cust-conf-pct">{selectedCust.aiConfidence}%</span>
              </div>
            </div>

            <div className="cust-drawer-section">
              <div className="cust-stat-row">
                <div className="cust-stat-box">
                  <div className="cust-stat-val">{selectedCust.conversations}</div>
                  <div className="cust-stat-lbl">Chats</div>
                </div>
                <div className="cust-stat-box">
                  <div className="cust-stat-val" style={{ fontSize: 13 }}>{selectedCust.lastSeen}</div>
                  <div className="cust-stat-lbl">Last active</div>
                </div>
              </div>
            </div>

            <div className="cust-drawer-section">
              <span className="cust-drawer-label">Preferences learned</span>
              <div className="cust-pill-row">
                {selectedCust.preferences.length > 0 ? (
                  selectedCust.preferences.map((p) => (
                    <span key={p} className="cust-pill">{p}</span>
                  ))
                ) : (
                  <span style={{ color: "var(--ink-soft)", fontSize: 13 }}>Nothing learned yet.</span>
                )}
              </div>
            </div>

            <div className="cust-drawer-section">
              <span className="cust-drawer-label">Product interests</span>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {selectedCust.viewedProducts.length > 0 ? (
                  selectedCust.viewedProducts.map((p) => (
                    <div key={p} className="cust-drawer-product">
                      <span className="cust-drawer-product-thumb">{p[0]}</span>
                      <span className="cust-drawer-product-name">{p}</span>
                    </div>
                  ))
                ) : (
                  <span style={{ color: "var(--ink-soft)", fontSize: 13 }}>No product views tracked yet.</span>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
