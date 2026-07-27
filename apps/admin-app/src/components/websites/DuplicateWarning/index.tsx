"use client";

import { Modal } from "@/components/ui/Modal";

interface DuplicateWarningProps {
  open: boolean;
  onClose: () => void;
  domain: string;
  owner?: string;
  status?: string;
}

export function DuplicateWarning({ open, onClose, domain, owner, status }: DuplicateWarningProps) {
  return (
    <Modal open={open} onClose={onClose} title="Duplicate Domain Detected" size="sm">
      <div className="space-y-3">
        <p className="text-sm text-ink-soft">
          The domain <strong className="text-ink">{domain}</strong> is already registered.
        </p>
        {owner && (
          <div className="bg-gold/10 border border-gold/30 rounded-lg p-3 text-sm">
            <p><strong>Current owner:</strong> {owner}</p>
            <p><strong>Status:</strong> {status}</p>
          </div>
        )}
        <p className="text-sm text-ink-soft">
          One active website = one workspace. This domain cannot be registered until the current owner releases it.
        </p>
        <div className="flx-row gap-2 justify-end mt-2">
          <button className="btn-ghost btn-sm" onClick={onClose}>Close</button>
        </div>
      </div>
    </Modal>
  );
}
