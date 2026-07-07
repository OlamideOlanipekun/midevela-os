"use client";

import React, { useState } from "react";
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

const mockCustomers: Customer[] = [
  {
    id: "cust-1",
    name: "Amaka O.",
    email: "amaka.o@gmail.com",
    stage: "Purchase ready",
    stageClass: "badge-green",
    conversations: 4,
    lastSeen: "2 mins ago",
    aiConfidence: 94,
    preferences: ["Ankara fabrics", "Burgundy", "Express delivery", "Lagos"],
    viewedProducts: ["Ankara Co-ord Set (Burgundy)", "Ankara Flare Gown (Blue)"],
  },
  {
    id: "cust-2",
    name: "Tunde A.",
    email: "tunde.a@yahoo.com",
    stage: "Comparing",
    stageClass: "badge-gold",
    conversations: 7,
    lastSeen: "5 mins ago",
    aiConfidence: 82,
    preferences: ["HP EliteBook", "Dell XPS", "Developer specs", "Long battery"],
    viewedProducts: ["HP EliteBook 840 G8", "Dell XPS 13 9310"],
  },
  {
    id: "cust-3",
    name: "Chioma N.",
    email: "chioma@outlook.com",
    stage: "Exploring",
    stageClass: "badge-blue",
    conversations: 2,
    lastSeen: "8 mins ago",
    aiConfidence: 75,
    preferences: ["Serums", "Vitamin C", "Brightening", "Port Harcourt"],
    viewedProducts: ["Vitamin C Brightening Serum", "Hydrating Facial Cleanser"],
  },
  {
    id: "cust-4",
    name: "Kelechi E.",
    email: "kelechi@gmail.com",
    stage: "Returning",
    stageClass: "badge-green",
    conversations: 12,
    lastSeen: "1 day ago",
    aiConfidence: 96,
    preferences: ["Puma sneakers", "Size 43", "Black shoes"],
    viewedProducts: ["Puma Nitro Running Shoes"],
  },
];

export default function CustomersPage() {
  const [search, setSearch] = useState("");
  const [selectedCust, setSelectedCust] = useState<Customer | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 3;

  const filteredCustomers = mockCustomers.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );
  const totalPages = Math.max(1, Math.ceil(filteredCustomers.length / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedCustomers = filteredCustomers.slice(startIndex, startIndex + itemsPerPage);

  const avgConfidence = Math.round(
    mockCustomers.reduce((sum, c) => sum + c.aiConfidence, 0) / mockCustomers.length
  );

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
          {mockCustomers.length} tracked · {avgConfidence}% avg. AI confidence
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
                {selectedCust.preferences.map((p) => (
                  <span key={p} className="cust-pill">{p}</span>
                ))}
              </div>
            </div>

            <div className="cust-drawer-section">
              <span className="cust-drawer-label">Product interests</span>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {selectedCust.viewedProducts.map((p) => (
                  <div key={p} className="cust-drawer-product">
                    <span className="cust-drawer-product-thumb">{p[0]}</span>
                    <span className="cust-drawer-product-name">{p}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
