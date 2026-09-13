import { Sparkles, Ticket } from "lucide-react";

type Props = {
  active: "wheel" | "rewards";
  onOpenWheel?: () => void;
  onOpenRewards?: () => void;
};

export function RewardNavigation({ active, onOpenWheel, onOpenRewards }: Props) {
  return (
    <nav className="reward-subnav" aria-label="Quà và vòng quay">
      <button
        type="button"
        className={active === "wheel" ? "active" : ""}
        aria-current={active === "wheel" ? "page" : undefined}
        onClick={onOpenWheel}
      >
        <Sparkles size={18} aria-hidden="true" />
        Vòng quay
      </button>
      <button
        type="button"
        className={active === "rewards" ? "active" : ""}
        aria-current={active === "rewards" ? "page" : undefined}
        onClick={onOpenRewards}
      >
        <Ticket size={18} aria-hidden="true" />
        Mã quà
      </button>
    </nav>
  );
}
