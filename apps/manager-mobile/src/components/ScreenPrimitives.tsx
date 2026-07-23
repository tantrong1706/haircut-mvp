import { ChevronLeft, ChevronRight, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function ScreenHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <header className="manager-screen-header">
      <div>
        {eyebrow ? <p className="manager-eyebrow">{eyebrow}</p> : null}
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
      </div>
      {action}
    </header>
  );
}

export function DetailHeader({
  title,
  description,
  onBack,
}: {
  title: string;
  description?: string;
  onBack: () => void;
}) {
  return (
    <header className="manager-detail-header">
      <button className="manager-icon-button" type="button" aria-label="Quay lại" onClick={onBack}>
        <ChevronLeft aria-hidden="true" />
      </button>
      <div>
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
      </div>
    </header>
  );
}

export function MetricCard({
  icon: Icon,
  label,
  value,
  tone = "default",
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  tone?: "default" | "success" | "warning";
}) {
  return (
    <div className={`manager-metric ${tone}`}>
      <Icon aria-hidden="true" />
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export function ActionRow({
  icon: Icon,
  title,
  description,
  meta,
  onClick,
  disabled,
  danger,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  meta?: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      className={`manager-action-row${danger ? " danger" : ""}`}
      type="button"
      disabled={disabled}
      onClick={onClick}
    >
      <span className="manager-action-icon">
        <Icon aria-hidden="true" />
      </span>
      <span className="manager-action-copy">
        <strong>{title}</strong>
        <small>{description}</small>
      </span>
      {meta ? <span className="manager-action-meta">{meta}</span> : null}
      <ChevronRight aria-hidden="true" />
    </button>
  );
}

export function Section({
  title,
  description,
  action,
  children,
  className = "",
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`manager-section ${className}`.trim()}>
      {title || description || action ? (
        <div className="manager-section-heading">
          <div>
            {title ? <h2>{title}</h2> : null}
            {description ? <p>{description}</p> : null}
          </div>
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}
