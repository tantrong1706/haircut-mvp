import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { AppErrorBoundary } from "./components/AppErrorBoundary";
import { initMonitoring } from "./services/monitoring";
import { registerServiceWorker } from "./services/pwa";
import "./styles/global.css";

initMonitoring();

const rootElement = document.getElementById("root") ?? document.getElementById("app");

if (!rootElement) {
  throw new Error("Không tìm thấy phần tử gốc để khởi động HAIRCUT.");
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </React.StrictMode>,
);

registerServiceWorker();
