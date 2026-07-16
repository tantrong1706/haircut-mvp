import React from "react";
import ReactDOM from "react-dom/client";
import { ManagerApp } from "./ManagerApp";
import { initializeNativeFirebaseSecurity } from "./nativeRuntime";
import "../../../zalo-mini-app/src/styles/global.css";
import "../../../zalo-mini-app/src/styles/staff.css";
import "../../../zalo-mini-app/src/styles/owner.css";
import "../../../zalo-mini-app/src/styles/rewards.css";
import "./manager.css";

async function bootstrap() {
  try {
    await initializeNativeFirebaseSecurity();
    ReactDOM.createRoot(document.getElementById("root")!).render(
      <React.StrictMode>
        <ManagerApp />
      </React.StrictMode>,
    );
  } catch {
    ReactDOM.createRoot(document.getElementById("root")!).render(
      <main className="manager-startup-error">
        <h1>Không thể xác minh thiết bị</h1>
        <p>Kiểm tra kết nối và cấu hình Firebase, sau đó mở lại ứng dụng.</p>
        <button onClick={() => window.location.reload()}>Thử lại</button>
      </main>,
    );
  }
}

void bootstrap();
