import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { expect, test } from "vitest";

test(".env.example не содержит секретов", () => {
  const placeholders = new Set(["your-anon-key"]);
  const example = parseEnv(readFileSync(new URL("../../.env.example", import.meta.url), "utf8"));
  const suspiciousNames = Object.entries(example)
    .filter(([name, value]) => /KEY|TOKEN|SECRET|PASSWORD/i.test(name) && value && value.length > 12 && !placeholders.has(value))
    .map(([name]) => name);

  expect(suspiciousNames).toEqual([]);
});
