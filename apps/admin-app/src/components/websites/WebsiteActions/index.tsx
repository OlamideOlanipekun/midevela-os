"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";

interface WebsiteActionsProps {
  websiteId: string;
  status: string;
  verified: boolean;
  crawlStatus: string;
  onVerify: () => void;
  onRecrawl: () => void;
  onSuspend: () => void;
  onReactivate: () => void;
  onDelete: () => void;
  onTransfer: () => void;
}

export function WebsiteActions({ websiteId, status, verified, crawlStatus, onVerify, onRecrawl, onSuspend, onReactivate, onDelete, onTransfer }: WebsiteActionsProps) {
  const [showConfirm, setShowConfirm] = useState<"suspend" | "reactivate" | "delete" | "transfer" | null>(null);
  const [newMerchantId, setNewMerchantId] = useState("");

  const isActive = status === "ACTIVE";
  const isSuspended = status === "SUSPENDED";

  return (
    <>
      <div className="mcht-actions">
        {!verified && <Button variant="outline" size="sm" onClick={onVerify}>Verify</Button>}
        {isActive && crawlStatus !== "CRAWLING" && <Button variant="outline" size="sm" onClick={onRecrawl}>Recrawl</Button>}
        {isActive && <Button variant="ghost" size="sm" onClick={() => setShowConfirm("suspend")}>Suspend</Button>}
        {isSuspended && <Button variant="outline" size="sm" onClick={() => setShowConfirm("reactivate")}>Reactivate</Button>}
        <Button variant="ghost" size="sm" onClick={() => setShowConfirm("transfer")}>Transfer</Button>
        <Button variant="danger" size="sm" onClick={() => setShowConfirm("delete")}>Delete</Button>
      </div>

      <Modal open={showConfirm === "suspend"} onClose={() => setShowConfirm(null)} title="Suspend Website" size="sm">
        <p className="text-sm text-ink-soft mb-4">A suspended website cannot crawl or serve content. Are you sure?</p>
        <div className="flx-row gap-2 justify-end">
          <Button variant="secondary" size="sm" onClick={() => setShowConfirm(null)}>Cancel</Button>
          <Button variant="danger" size="sm" onClick={() => { onSuspend(); setShowConfirm(null); }}>Suspend</Button>
        </div>
      </Modal>

      <Modal open={showConfirm === "reactivate"} onClose={() => setShowConfirm(null)} title="Reactivate Website" size="sm">
        <p className="text-sm text-ink-soft mb-4">Restore this website to active status?</p>
        <div className="flx-row gap-2 justify-end">
          <Button variant="secondary" size="sm" onClick={() => setShowConfirm(null)}>Cancel</Button>
          <Button variant="primary" size="sm" onClick={() => { onReactivate(); setShowConfirm(null); }}>Reactivate</Button>
        </div>
      </Modal>

      <Modal open={showConfirm === "delete"} onClose={() => setShowConfirm(null)} title="Delete Website" size="sm">
        <p className="text-sm text-ink-soft mb-4">This will soft-delete the website. The domain can be re-registered later.</p>
        <div className="flx-row gap-2 justify-end">
          <Button variant="secondary" size="sm" onClick={() => setShowConfirm(null)}>Cancel</Button>
          <Button variant="danger" size="sm" onClick={() => { onDelete(); setShowConfirm(null); }}>Delete</Button>
        </div>
      </Modal>

      <Modal open={showConfirm === "transfer"} onClose={() => setShowConfirm(null)} title="Transfer Ownership" size="sm">
        <p className="text-sm text-ink-soft mb-4">Only Super Admins can transfer website ownership.</p>
        <Input label="New Merchant ID" value={newMerchantId} onChange={(e) => setNewMerchantId(e.target.value)} placeholder="Enter organization ID" />
        <div className="flx-row gap-2 justify-end mt-4">
          <Button variant="secondary" size="sm" onClick={() => setShowConfirm(null)}>Cancel</Button>
          <Button variant="primary" size="sm" disabled={!newMerchantId} onClick={() => { onTransfer(); setShowConfirm(null); }}>Transfer</Button>
        </div>
      </Modal>
    </>
  );
}
