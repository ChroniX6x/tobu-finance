import { fileURLToPath } from "node:url";

// Source runner uses .ts; the production artifact uses emitted .js only.
export const migrationGlob = fileURLToPath(new URL(
  `./migrations/*.${import.meta.url.endsWith(".ts") ? "ts" : "js"}`,
  import.meta.url,
)).replaceAll("\\", "/");
