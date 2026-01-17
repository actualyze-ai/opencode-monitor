import { execSync } from "node:child_process";
import { defineConfig } from "tsup";
import { APP_NAME } from "./src/lib/config";

// Generate version string at build time
function getVersionString(): string {
  try {
    return execSync("bun run scripts/version.ts", {
      encoding: "utf-8",
    }).trim();
  } catch {
    return `${APP_NAME} v0.0.0`;
  }
}

export default defineConfig({
  entry: ["src/index.tsx"],
  format: ["esm"],
  outDir: "dist",
  clean: true,
  sourcemap: true,
  // Handle path aliases
  esbuildOptions(options) {
    options.alias = {
      "@": "./src",
    };
  },
  // Inject version string at build time
  define: {
    __VERSION_STRING__: JSON.stringify(getVersionString()),
  },
  // Note: shebang is in src/index.tsx, no banner needed
});
