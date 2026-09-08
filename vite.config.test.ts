import { describe, expect, it } from "vitest";
import config from "./vite.config";

describe("Vite dependency optimization", () => {
  it("pre-bundles the XFOIL dependency before the analysis worker starts", () => {
    const resolved = typeof config === "function" ? config({ command: "serve", mode: "test" }) : config;

    expect(resolved.optimizeDeps?.include).toContain("webxfoil-wasm");
  });

  it("publishes the generated project schema as a stable Pages asset", () => {
    const resolved = typeof config === "function" ? config({ command: "build", mode: "test" }) : config;

    expect(resolved.plugins).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: "project-schema-asset" }),
    ]));
  });
});
