import { fileURLToPath } from "node:url";

const managerDependency = (packageName: string) =>
  fileURLToPath(new URL(`./node_modules/${packageName}`, import.meta.url));

export const managerDependencyAliases = {
  "@haircut/contracts": managerDependency("@haircut/contracts"),
  "@sentry/react": managerDependency("@sentry/react"),
  firebase: managerDependency("firebase"),
  "lucide-react": managerDependency("lucide-react"),
  qrcode: managerDependency("qrcode"),
  react: managerDependency("react"),
  "react-dom": managerDependency("react-dom"),
};
