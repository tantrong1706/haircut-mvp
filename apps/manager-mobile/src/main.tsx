import React from "react";
import ReactDOM from "react-dom/client";
import { ManagerApp } from "./ManagerApp";
import "../../../zalo-mini-app/src/styles/global.css";
import "../../../zalo-mini-app/src/styles/staff.css";
import "../../../zalo-mini-app/src/styles/owner.css";
import "../../../zalo-mini-app/src/styles/rewards.css";
import "./manager.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ManagerApp />
  </React.StrictMode>,
);
