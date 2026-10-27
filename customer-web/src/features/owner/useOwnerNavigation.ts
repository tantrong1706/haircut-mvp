import { useEffect, useState } from "react";
export type OwnerTab =
  "overview" | "approvals" | "branches" | "staff" | "customers" | "wheel" | "redeem" | "settings";

export function useOwnerNavigation() {
  const [activeTab, setActiveTab] = useState<OwnerTab>("overview");
  useEffect(() => {
    const navigate = (event: Event) => {
      const route = String((event as CustomEvent<string>).detail || "");
      const nextTab = ownerTabFromRoute(route);
      if (nextTab) setActiveTab(nextTab);
    };
    window.addEventListener("haircut:navigate", navigate);
    return () => window.removeEventListener("haircut:navigate", navigate);
  }, []);

  return [activeTab, setActiveTab] as const;
}
function ownerTabFromRoute(route: string): OwnerTab | null {
  if (route.startsWith("/approvals")) return "approvals";
  if (route.startsWith("/branches")) return "branches";
  if (route.startsWith("/staff")) return "staff";
  if (route.startsWith("/customers")) return "customers";
  if (route.startsWith("/wheel")) return "wheel";
  if (route.startsWith("/rewards")) return "redeem";
  if (route.startsWith("/settings") || route.startsWith("/delete-account")) return "settings";
  if (route.startsWith("/overview") || route.startsWith("/queue")) return "overview";
  return null;
}
