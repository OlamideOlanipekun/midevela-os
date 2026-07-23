"use client";

import React, { useEffect, useState } from "react";
import { useSubscription } from "@/components/providers/SubscriptionProvider";
import "./team.css";

interface TeamMember {
  name: string;
  email: string;
  role: string;
}

export default function TeamPage() {
  const { isReadOnly } = useSubscription();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("Agent");
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/team")
      .then((r) => r.json())
      .then((data) => setMembers(Array.isArray(data.team) ? data.team : []))
      .catch(() => setMembers([]))
      .finally(() => setLoading(false));
  }, []);

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setToast("Team invites aren't available yet — coming in a future update.");
    setInviteEmail("");
    setTimeout(() => setToast(null), 3000);
  };

  return (
    <div>
      <div className="tm-page-head">
        <div className="eyebrow"><span className="dot"></span> WORKSPACE</div>
        <h1>Team</h1>
        <p className="tm-subtitle">Manage who has access to your Midevela dashboard.</p>
      </div>

      <div className="tm-layout">
        <section className="tm-section">
          <h2>Team members ({members.length})</h2>
          {loading ? (
            <div style={{ padding: 20, color: "var(--ink-soft)" }}>Loading…</div>
          ) : members.length === 0 ? (
            <div className="tm-empty">
              <p>No team members yet. Invite someone to get started.</p>
            </div>
          ) : (
            <div className="tm-list">
              {members.map((m) => (
                <div key={m.email} className="tm-row">
                  <div className="tm-avatar">{m.name[0]}</div>
                  <div className="tm-info">
                    <div className="tm-name">{m.name}</div>
                    <div className="tm-email">{m.email}</div>
                  </div>
                  <span className="badge badge-muted">{m.role}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="tm-section">
          <h2>Invite member</h2>
          <p className="tm-hint" style={{ marginBottom: 16 }}>
            Send an invitation to join your workspace. The recipient will receive an email with a sign-up link.
          </p>
          <form onSubmit={handleInvite} className="tm-invite-form">
            <fieldset disabled={isReadOnly} style={{ border: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 16 }}>
              <div className="tm-field">
                <label htmlFor="invite-em">Email address</label>
                <input id="invite-em" type="email" placeholder="name@business.com" value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)} required />
              </div>
              <div className="tm-field">
                <label htmlFor="invite-role">Role</label>
                <select id="invite-role" value={inviteRole} onChange={(e) => setInviteRole(e.target.value)}>
                  <option value="Admin">Admin — full access to all settings</option>
                  <option value="Agent">Agent — conversations only, no settings</option>
                </select>
              </div>
              <button type="submit" className="btn-dark" style={{ padding: "12px 0" }}>
                Send invitation
              </button>
            </fieldset>
          </form>
        </section>
      </div>

      {toast && <div className="tm-toast">{toast}</div>}
    </div>
  );
}
