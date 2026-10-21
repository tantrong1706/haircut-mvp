import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";

test("haircut upload Rules stay within the two Firestore document access budget", () => {
  const source = readFileSync(new URL("../firebase/storage.rules", import.meta.url), "utf8");
  const functions = new Map();
  for (const match of source.matchAll(/function\s+(\w+)\([^)]*\)\s*\{/g)) {
    let depth = 1, end = match.index + match[0].length;
    const start = end;
    while (end < source.length && depth) {
      if (source[end] === "{") depth++;
      if (source[end] === "}") depth--;
      end++;
    }
    assert.equal(depth, 0);
    functions.set(match[1], source.slice(start, end - 1));
  }
  const section = source.split("match /salons/{salonId}/customers/{customerId}/sessions/{sessionId}/{fileName}")[1];
  assert.ok(section, "operation upload path must exist");
  const expression = section.match(/allow create:\s*if\s*([\s\S]*?);/)?.[1];
  assert.ok(expression, "create gate must be explicit");
  const reached = new Set();
  const bodies = [expression];
  for (let index = 0; index < bodies.length; index++) {
    for (const [, name] of bodies[index].matchAll(/\b(\w+)\s*\(/g)) {
      if (functions.has(name) && !reached.has(name)) {
        reached.add(name); bodies.push(functions.get(name));
      }
    }
  }
  const paths = new Set(bodies.join("\n").match(/\/databases\/\(default\)\/documents\/(?:[\w-]+|\$\([\w.]+\))(?:\/(?:[\w-]+|\$\([\w.]+\)))*/g));
  assert.equal(paths.size, 2, `Upload gate accesses ${paths.size} document paths: ${[...paths].join(", ")}`);
  assert.ok([...paths].every(path => path.includes("/customers/$(customerId)") || path.includes("/photo_upload_operations/$(operationId)")));
});
