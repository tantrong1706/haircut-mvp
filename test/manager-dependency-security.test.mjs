import { createRequire } from "node:module";
import { registerZodSecurityTests } from "./helpers/zod-security.mjs";
registerZodSecurityTests(createRequire(new URL("../apps/manager-mobile/package.json", import.meta.url)), "Manager Web");
