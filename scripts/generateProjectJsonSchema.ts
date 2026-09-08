import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import Ajv2020 from "ajv/dist/2020";
import addFormats from "ajv-formats";
import { generateProjectJsonSchema } from "./projectJsonSchema";

const projectRoot = resolve(".");
const outputPath = resolve(projectRoot, "schemas/project.schema.json");
const schema = generateProjectJsonSchema({ projectRoot });
const serialized = `${JSON.stringify(schema, null, 2)}\n`;
const check = process.argv.includes("--check");
const validateExamples = process.argv.includes("--validate-examples");

if (check) {
  const current = await readFile(outputPath, "utf8").catch(() => "");
  if (current !== serialized) {
    throw new Error("schemas/project.schema.json が型定義と一致しません。npm run schema:project-json を実行してください。");
  }
  console.log("Project JSON Schema is up to date.");
} else {
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, serialized, "utf8");
  console.log("Generated schemas/project.schema.json");
}

if (validateExamples) {
  const ajv = new Ajv2020({ allErrors: true });
  addFormats(ajv);
  const validate = ajv.compile(schema);
  for (const relativePath of ["examples/HPADesign-Aero-Structural-MVP.json", "examples/Anonymized-HPA-Reference.json"]) {
    const document = JSON.parse(await readFile(resolve(projectRoot, relativePath), "utf8"));
    if (!validate(document)) throw new Error(`${relativePath}: ${JSON.stringify(validate.errors)}`);
    console.log(`Validated ${relativePath}`);
  }
}
