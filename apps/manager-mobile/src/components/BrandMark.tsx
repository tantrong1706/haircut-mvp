import { Scissors } from "lucide-react";

export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <span className={compact ? "manager-brand compact" : "manager-brand"} aria-label="HAIRCUT">
      <span className="manager-brand-icon" aria-hidden="true">
        <Scissors />
      </span>
      <span>
        <strong>HAIRCUT</strong>
        {!compact ? <small>Manager</small> : null}
      </span>
    </span>
  );
}
