"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";

interface ExportModalProps {
  open: boolean;
  onClose: () => void;
  conversationId: string;
}

export function ExportModal({ open, onClose, conversationId }: ExportModalProps) {
  const [format, setFormat] = useState("txt");
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await fetch(`/api/admin/conversations/${conversationId}/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format }),
      });
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `conversation-${conversationId}.${format === "json" ? "json" : format === "csv" ? "csv" : "txt"}`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
      onClose();
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Export Conversation" size="sm">
      <div className="space-y-3">
        <p className="text-sm text-ink-soft">Choose export format:</p>
        <div className="flx-row gap-2">
          {["txt", "csv", "json"].map((f) => (
            <button key={f} className={`fltr-select ${format === f ? "active" : ""}`} onClick={() => setFormat(f)}>
              .{f}
            </button>
          ))}
        </div>
        <div className="flx-row gap-2 justify-end mt-2">
          <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
          <Button variant="primary" size="sm" loading={exporting} onClick={handleExport}>Export</Button>
        </div>
      </div>
    </Modal>
  );
}
