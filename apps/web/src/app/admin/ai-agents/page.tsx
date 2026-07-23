"use client";
import React, { useEffect, useState } from "react";

interface Agent {
  id: string;
  name: string;
  merchant: string;
  orgId: string;
  health: number;
  confidence: number;
  latency: number;
  errors: number;
  conversations: number;
  lastActive: string;
}

export default function AdminAIAgents() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Agent | null>(null);

  useEffect(() => {
    fetch("/api/admin/ai-agents")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (d?.agents) setAgents(d.agents);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const avgConfidence = agents.length > 0
    ? Math.round(agents.reduce((s, a) => s + a.confidence, 0) / agents.length)
    : 0;
  const avgLatency = agents.length > 0
    ? (agents.reduce((s, a) => s + a.latency, 0) / agents.length).toFixed(1)
    : "0";
  const totalErrors = agents.reduce((s, a) => s + a.errors, 0);

  return (
    <div>
      <div className="admin-page-head">
        <div>
          <h1>AI Agents</h1>
          <p>{agents.length} agent{agents.length !== 1 ? "s" : ""} deployed across the platform</p>
        </div>
      </div>

      {/* Summary metrics */}
      <div className="admin-metrics">
        <div className="admin-metric-card">
          <div className="admin-metric-label">Avg Confidence</div>
          <div className="admin-metric-value" style={avgConfidence < 80 ? { color: "var(--admin-yellow)" } : {}}>{avgConfidence}%</div>
        </div>
        <div className="admin-metric-card">
          <div className="admin-metric-label">Avg Latency</div>
          <div className="admin-metric-value">{avgLatency}s</div>
        </div>
        <div className="admin-metric-card">
          <div className="admin-metric-label">Total Errors</div>
          <div className="admin-metric-value" style={totalErrors > 0 ? { color: "var(--admin-red)" } : {}}>{totalErrors.toLocaleString()}</div>
        </div>
        <div className="admin-metric-card">
          <div className="admin-metric-label">Online</div>
          <div className="admin-metric-value">{agents.filter((a) => a.health > 0).length}</div>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: "center", color: "var(--admin-text-muted)" }}>Loading agents...</div>
      ) : (
        <div className="admin-card" style={{ marginBottom: 24 }}>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>AI Agent</th>
                  <th>Merchant</th>
                  <th>Health</th>
                  <th>Confidence</th>
                  <th>Latency</th>
                  <th>Errors</th>
                  <th>Conversations</th>
                  <th>Last Active</th>
                </tr>
              </thead>
              <tbody>
                {agents.length === 0 ? (
                  <tr><td colSpan={8} style={{ padding: 24, textAlign: "center", color: "var(--admin-text-muted)" }}>No AI agents deployed yet.</td></tr>
                ) : (
                  agents.map((a) => (
                    <tr key={a.id} style={{ cursor: "pointer" }} onClick={() => setSelected(a)}>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{
                            width: 24, height: 24, borderRadius: "var(--admin-radius-sm)",
                            background: "linear-gradient(135deg, #a855f7, #6366f1)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            color: "#fff", fontFamily: "var(--admin-mono)", fontSize: 10, fontWeight: 600,
                          }}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                          </div>
                          <span style={{ fontWeight: 600 }}>{a.name}</span>
                        </div>
                      </td>
                      <td>{a.merchant}</td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <div style={{ width: 60, height: 4, background: "var(--admin-bg)", borderRadius: 4, overflow: "hidden" }}>
                            <div style={{ height: "100%", width: `${a.health}%`, borderRadius: 4, background: a.health > 80 ? "var(--admin-green)" : a.health > 50 ? "var(--admin-yellow)" : "var(--admin-red)" }} />
                          </div>
                          <span style={{ fontFamily: "var(--admin-mono)", fontSize: 11 }}>{a.health}%</span>
                        </div>
                      </td>
                      <td style={{ fontFamily: "var(--admin-mono)", fontSize: 12 }}>{a.confidence}%</td>
                      <td style={{ fontFamily: "var(--admin-mono)", fontSize: 12 }}>{a.latency}s</td>
                      <td style={{ fontFamily: "var(--admin-mono)", fontSize: 12, color: a.errors > 0 ? "var(--admin-red)" : "var(--admin-text-soft)" }}>{a.errors}</td>
                      <td style={{ fontFamily: "var(--admin-mono)", fontSize: 12 }}>{a.conversations.toLocaleString()}</td>
                      <td style={{ fontFamily: "var(--admin-mono)", fontSize: 11, color: "var(--admin-text-muted)" }}>{a.lastActive}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selected && (
        <div className="admin-card">
          <div className="admin-card-head">
            <h3><span style={{ color: "#a855f7" }}>⚡</span> {selected.name} — Agent Details</h3>
            <button onClick={() => setSelected(null)} style={{ background: "none", border: "none", color: "var(--admin-text-muted)", cursor: "pointer", fontFamily: "var(--admin-mono)", fontSize: 11 }}>Close</button>
          </div>
          <div className="admin-card-body">
            <div className="admin-grid-2">
              <div>
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontFamily: "var(--admin-mono)", fontSize: 10, color: "var(--admin-text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Agent Info</div>
                  <div style={{ fontSize: 13 }}><strong>Merchant:</strong> {selected.merchant}</div>
                  <div style={{ fontSize: 13 }}><strong>Health:</strong> {selected.health}%</div>
                  <div style={{ fontSize: 13 }}><strong>Confidence:</strong> {selected.confidence}%</div>
                  <div style={{ fontSize: 13 }}><strong>Avg Latency:</strong> {selected.latency}s</div>
                  <div style={{ fontSize: 13 }}><strong>Conversations:</strong> {selected.conversations.toLocaleString()}</div>
                  <div style={{ fontSize: 13 }}><strong>Errors:</strong> {selected.errors}</div>
                </div>
              </div>
              <div>
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontFamily: "var(--admin-mono)", fontSize: 10, color: "var(--admin-text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Actions</div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button className="admin-login-btn" style={{ padding: "6px 14px", fontSize: 11, background: "transparent", border: "1px solid var(--admin-border)", color: "var(--admin-text)" }}>View Logs</button>
                    <button className="admin-login-btn" style={{ padding: "6px 14px", fontSize: 11, background: "transparent", border: "1px solid var(--admin-border)", color: "var(--admin-text)" }}>View Prompt</button>
                    <button className="admin-login-btn" style={{ padding: "6px 14px", fontSize: 11, background: "transparent", border: "1px solid var(--admin-border)", color: "var(--admin-text)" }}>View Knowledge</button>
                    <button className="admin-login-btn" style={{ padding: "6px 14px", fontSize: 11, background: "transparent", border: "1px solid var(--admin-border)", color: "var(--admin-text)" }}>Restart Agent</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
