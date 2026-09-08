import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import Ajv2020 from "ajv/dist/2020";
import addFormats from "ajv-formats";
import { describe, expect, it } from "vitest";
import { generateProjectJsonSchema } from "./projectJsonSchema";

const projectRoot = resolve(".");
const schema = generateProjectJsonSchema({ projectRoot });
const ajv = new Ajv2020({ allErrors: true });
addFormats(ajv);
const validate = ajv.compile(schema);

describe("project JSON Schema generator", () => {
  it("generates a Draft 2020-12 schema with reusable definitions and closed objects", () => {
    const designDocument = schema.$defs.DesignDocument as Record<string, unknown>;

    expect(schema).toMatchObject({
      $schema: "https://json-schema.org/draft/2020-12/schema",
      $id: "urn:hpa-design:schema:project:4",
      $ref: "#/$defs/DesignDocument",
    });
    expect(designDocument).toMatchObject({ type: "object", additionalProperties: false });
    expect(designDocument.required).toContain("schemaVersion");
    expect(designDocument.required).not.toContain("conceptualDesign");
    expect(schema.$defs.LaminatePly).toMatchObject({
      properties: {
        partialWidth: { type: "number", description: "上側または下側それぞれの積層幅 [m]。" },
      },
    });
  });

  it("accepts the public project examples, including encoded infinite numbers", () => {
    for (const relativePath of ["examples/HPADesign-Aero-Structural-MVP.json", "examples/Anonymized-HPA-Reference.json"]) {
      const document = JSON.parse(readFileSync(resolve(projectRoot, relativePath), "utf8"));
      expect(validate(document), `${relativePath}: ${JSON.stringify(validate.errors)}`).toBe(true);
    }
  });

  it("rejects an unsupported version and unknown top-level fields", () => {
    const document = JSON.parse(readFileSync(resolve(projectRoot, "examples/HPADesign-Aero-Structural-MVP.json"), "utf8"));

    expect(validate({ ...document, schemaVersion: 3, unexpected: true })).toBe(false);
    expect(validate.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ instancePath: "/schemaVersion", keyword: "const" }),
      expect.objectContaining({ instancePath: "", keyword: "additionalProperties" }),
    ]));
  });

  it("keeps the committed JSON Schema synchronized with the TypeScript contract", () => {
    const committed = readFileSync(resolve(projectRoot, "schemas/project.schema.json"), "utf8");

    expect(committed).toBe(`${JSON.stringify(schema, null, 2)}\n`);
  });
});
