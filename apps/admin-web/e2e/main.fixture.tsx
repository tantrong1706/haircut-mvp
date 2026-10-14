import { createRoot } from "react-dom/client";
import { AdminDashboard } from "../src/components/AdminDashboard";
import "../src/styles.css";
import type { User } from "firebase/auth";

// This entry is used exclusively by vite.e2e.config.ts, never the production entry.
document.documentElement.dataset.fixture = "ADMIN_E2E_FIXTURE_ONLY";
createRoot(document.getElementById("root")!).render(<AdminDashboard user={{ uid: "fixture-admin", email: "admin@example.test" } as User} />);
