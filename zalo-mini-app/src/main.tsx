import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { AppErrorBoundary } from "./components/AppErrorBoundary";
import { initMonitoring } from "./services/monitoring";
import { registerServiceWorker } from "./services/pwa";
import "./styles/global.css";

initMonitoring();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </React.StrictMode>,
);

registerServiceWorker();
