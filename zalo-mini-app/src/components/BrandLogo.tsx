import { Scissors } from "lucide-react";

export function BrandLogo() {
  return (
    <div className="brand-mark" aria-label="HAIRCUT">
      <Scissors size={17} strokeWidth={2.4} aria-hidden="true" />
      <span>HAIRCUT</span>
    </div>
  );
}
