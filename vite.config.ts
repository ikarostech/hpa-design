import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  base: process.env.BASE_PATH ?? "/",
  plugins: [react(), tailwindcss()],
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
