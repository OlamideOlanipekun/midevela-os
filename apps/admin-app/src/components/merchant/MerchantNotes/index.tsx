"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import type { MerchantNoteItem } from "@/lib/merchant/types";

interface MerchantNotesProps {
  notes: MerchantNoteItem[];
  onAdd: (content: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onTogglePin: (id: string) => Promise<void>;
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  if (diff < 86400000) return d.toLocaleTimeString();
  return d.toLocaleDateString();
}

export function MerchantNotes({ notes, onAdd, onDelete, onTogglePin }: MerchantNotesProps) {
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!content.trim()) return;
    setSaving(true);
    await onAdd(content.trim());
    setContent("");
    setSaving(false);
  };

  return (
    <div className="mcht-notes">
      <div className="mcht-notes-input">
        <textarea
          className="mcht-notes-textarea"
          placeholder="Add an internal note..."
          rows={3}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSubmit(); }}
        />
        <div className="mcht-notes-input-actions">
          <span className="text-xs text-ink-soft">⌘+Enter to save</span>
          <Button size="sm" onClick={handleSubmit} loading={saving} disabled={!content.trim()}>Add Note</Button>
        </div>
      </div>
      <div className="mcht-notes-list">
        {notes.map((n) => (
          <div key={n.id} className={`mcht-note ${n.pinned ? "pinned" : ""}`}>
            <div className="mcht-note-hdr">
              <span className="mcht-note-admin">{n.adminName ?? "Admin"}</span>
              <span className="mcht-note-time">{fmtDate(n.createdAt)}</span>
              <div className="mcht-note-actions">
                <button className="mcht-note-action" onClick={() => onTogglePin(n.id)} title={n.pinned ? "Unpin" : "Pin"}>
                  {n.pinned ? "📌" : "📍"}
                </button>
                <button className="mcht-note-action" onClick={() => onDelete(n.id)} title="Delete">🗑️</button>
              </div>
            </div>
            <p className="mcht-note-content">{n.content}</p>
          </div>
        ))}
        {notes.length === 0 && (
          <p className="text-sm text-ink-soft">No notes yet. Internal notes are never visible to the merchant.</p>
        )}
      </div>
    </div>
  );
}
