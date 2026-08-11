import { Scissors } from "lucide-react";
import { MINI_APP_NAME } from "../config/branding";

export function BrandLogo() {
  return (
    <div className="brand-mark" aria-label={MINI_APP_NAME}>
      <Scissors size={17} strokeWidth={2.4} aria-hidden="true" />
      <span>{MINI_APP_NAME}</span>
    </div>
  );
}
