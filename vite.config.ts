import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";
import { defineConfig, type Plugin } from "vite";

function projectSchemaAsset(): Plugin {
  return {
    name: "project-schema-asset",
    apply: "build",
    buildStart() {
      this.emitFile({
        type: "asset",
        fileName: "schemas/project.schema.json",
        source: readFileSync(new URL("./schemas/project.schema.json", import.meta.url), "utf8"),
      });
    },
  };
}

export default defineConfig({
  base: process.env.BASE_PATH ?? "/",
  plugins: [react(), tailwindcss(), projectSchemaAsset()],
  optimizeDeps: {
    include: ["webxfoil-wasm"],
  },
  test: {
    environment: "jsdom",
  },
  server: {
    allowedHosts: [".trycloudflare.com"],
  },
  resolve: {
    alias: {
      "@": "/src",
    },
  },
});
