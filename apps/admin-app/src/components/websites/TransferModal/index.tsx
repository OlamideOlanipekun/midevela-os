"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

interface TransferModalProps {
  open: boolean;
  onClose: () => void;
  onTransfer: (newOrgId: string) => void;
}

export function TransferModal({ open, onClose, onTransfer }: TransferModalProps) {
  const [newOrgId, setNewOrgId] = useState("");

  const handleTransfer = () => {
    if (!newOrgId.trim()) return;
    onTransfer(newOrgId.trim());
    setNewOrgId("");
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Transfer Ownership" size="sm">
      <div className="space-y-3">
        <p className="text-sm text-ink-soft">Only Super Admins can transfer website ownership. This action is audited.</p>
        <Input label="New Merchant ID" value={newOrgId} onChange={(e) => setNewOrgId(e.target.value)} placeholder="Enter organization ID" />
        <div className="flx-row gap-2 justify-end mt-2">
          <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
          <Button variant="primary" size="sm" disabled={!newOrgId.trim()} onClick={handleTransfer}>Transfer</Button>
        </div>
      </div>
    </Modal>
  );
}
