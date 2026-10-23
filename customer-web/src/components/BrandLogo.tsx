import { Scissors } from "lucide-react";
import { APP_NAME } from "../config/branding";

export function BrandLogo() {
  return (
    <div className="brand-mark" aria-label={APP_NAME}>
      <Scissors size={17} strokeWidth={2.4} aria-hidden="true" />
      <span>{APP_NAME}</span>
    </div>
  );
}
