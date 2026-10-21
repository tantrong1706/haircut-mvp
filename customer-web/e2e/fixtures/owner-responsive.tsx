import React from "react";
import { createRoot } from "react-dom/client";
import { OwnerPage } from "../../src/pages/OwnerPage";
import "../../src/styles/global.css";
import "../../src/styles/home.css";
import "../../src/styles/scan-entry.css";
import "../../src/styles/staff.css";
import "../../src/styles/owner.css";
import "../../src/styles/rewards.css";
import "../../src/styles/barber-web.css";
import "../../src/styles/customer.css";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <div className="app-shell ops-shell">
      <main className="app-main wide-main">
        <OwnerPage
          currentUser={{
            uid: "fixture-owner",
            salonId: "fixture-owner-salon-not-an-account-number",
            name: "Chủ salon mẫu",
            role: "owner",
            isActive: true,
            avatarUrl: "",
          }}
        />
      </main>
    </div>
  </React.StrictMode>,
);
