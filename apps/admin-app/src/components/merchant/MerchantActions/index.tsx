"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";

interface MerchantActionsProps {
  merchantId: string;
  isSuspended: boolean;
  onLoginAs: () => void;
  onSuspend: () => void;
  onReactivate: () => void;
  onDelete: () => void;
}

export function MerchantActions({ merchantId, isSuspended, onLoginAs, onSuspend, onReactivate, onDelete }: MerchantActionsProps) {
  const [showConfirm, setShowConfirm] = useState<"suspend" | "reactivate" | "delete" | null>(null);

  return (
    <>
      <div className="mcht-actions">
        <Button variant="outline" size="sm" onClick={onLoginAs}>Login As</Button>
        {isSuspended ? (
          <Button variant="outline" size="sm" onClick={() => setShowConfirm("reactivate")}>Reactivate</Button>
        ) : (
          <Button variant="ghost" size="sm" onClick={() => setShowConfirm("suspend")}>Suspend</Button>
        )}
        <Button variant="ghost" size="sm">Upgrade</Button>
        <Button variant="danger" size="sm" onClick={() => setShowConfirm("delete")}>Delete</Button>
      </div>

      <Modal open={showConfirm === "suspend"} onClose={() => setShowConfirm(null)} title="Suspend Merchant" size="sm">
        <p className="text-sm text-ink-soft mb-4">Are you sure you want to suspend {merchantId}? The merchant will lose access to their dashboard.</p>
        <div className="flx-row gap-2 justify-end">
          <Button variant="secondary" size="sm" onClick={() => setShowConfirm(null)}>Cancel</Button>
          <Button variant="danger" size="sm" onClick={() => { onSuspend(); setShowConfirm(null); }}>Suspend</Button>
        </div>
      </Modal>

      <Modal open={showConfirm === "reactivate"} onClose={() => setShowConfirm(null)} title="Reactivate Merchant" size="sm">
        <p className="text-sm text-ink-soft mb-4">Restore access for this merchant?</p>
        <div className="flx-row gap-2 justify-end">
          <Button variant="secondary" size="sm" onClick={() => setShowConfirm(null)}>Cancel</Button>
          <Button variant="primary" size="sm" onClick={() => { onReactivate(); setShowConfirm(null); }}>Reactivate</Button>
        </div>
      </Modal>

      <Modal open={showConfirm === "delete"} onClose={() => setShowConfirm(null)} title="Delete Merchant" size="sm">
        <p className="text-sm text-ink-soft mb-4">This will soft-delete the merchant. They will not be permanently removed immediately.</p>
        <div className="flx-row gap-2 justify-end">
          <Button variant="secondary" size="sm" onClick={() => setShowConfirm(null)}>Cancel</Button>
          <Button variant="danger" size="sm" onClick={() => { onDelete(); setShowConfirm(null); }}>Delete</Button>
        </div>
      </Modal>
    </>
  );
}
