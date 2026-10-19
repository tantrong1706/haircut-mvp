import React from "react";
import { createRoot } from "react-dom/client";
import { ReturningCustomerPoints } from "../../src/components/ReturningCustomerPoints";
import "../../src/styles/global.css";
import "../../src/styles/staff.css";
import "../../src/styles/barber-web.css";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <div className="app-shell">
      <main className="ops-page compact-ops-page">
        <h1>Nhân viên</h1>
        <ReturningCustomerPoints
          salonId="salon-fixture"
          branchId="branch-fixture"
          branchName="Chi nhánh mẫu"
          pointPerVisit={1}
          canAward
        />
      </main>
    </div>
  </React.StrictMode>,
);
