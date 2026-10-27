import assert from "node:assert/strict";
import test from "node:test";

// Small synthetic inputs prove bounded work; never stress a live endpoint or allocate huge inputs.
export function registerZodSecurityTests(requirePackage, workspace) {
  const { z } = requirePackage("zod");
  const invalidArray = Array.from({ length: 64 }, () => "invalid-number");
  const cases = [
    ["array.max", (item) => z.array(item).max(2), invalidArray],
    ["array.length", (item) => z.array(item).length(2), invalidArray],
    [
      "nested object array",
      (item) => z.object({ items: z.array(item).max(2) }),
      { items: invalidArray },
    ],
    [
      "set.max",
      (item) => z.set(item).max(2),
      new Set(invalidArray.map((value, index) => `${value}-${index}`)),
    ],
    [
      "map.max",
      (item) => z.map(z.string(), item).max(2),
      new Map(invalidArray.map((value, index) => [String(index), value])),
    ],
  ];

  for (const [label, schema, input] of cases) {
    test(`${workspace}: oversized ${label} stops before visiting elements (GHSA-mrhx-c7xc-m3w5)`, () => {
      let visited = 0;
      const item = z.preprocess((value) => {
        visited++;
        return value;
      }, z.number());
      const result = schema(item).safeParse(input);
      assert.equal(result.success, false);
      assert.equal(
        visited,
        0,
        "Size bounds must reject before item parsing allocates per-item issues",
      );
      assert.equal(result.error.issues.length, 1);
      assert.equal(result.error.issues[0].code, "too_big");
    });
  }

  test(`${workspace}: ordinary bounded validation preserves accepted values and error paths`, () => {
    const schema = z.object({
      salonId: z.string().trim().min(1),
      values: z.array(z.number()).max(2),
    });
    assert.deepEqual(schema.parse({ salonId: " salon-a ", values: [1, 2], ignored: true }), {
      salonId: "salon-a",
      values: [1, 2],
    });
    const invalid = schema.safeParse({ salonId: "salon-a", values: [true] });
    assert.equal(invalid.success, false);
    assert.deepEqual(invalid.error.issues[0].path, ["values", 0]);
    assert.equal(invalid.error.issues[0].code, "invalid_type");
  });

  test(`${workspace}: shared CommonJS contracts keep their schema and default behavior`, () => {
    const contracts = requirePackage("@haircut/contracts");
    assert.equal(contracts.AppRoleSchema.parse("staff"), "staff");
    assert.equal(contracts.AppRoleSchema.safeParse("customer").success, false);
    assert.equal(
      contracts.CloudFunctionNameSchema.parse("approvePointRequest"),
      "approvePointRequest",
    );
    assert.equal(contracts.RewardStatusSchema.parse("used"), "used");
    assert.deepEqual(contracts.normalizeSystemFeatures({ maintenanceMode: true }), {
      ...contracts.DEFAULT_SYSTEM_FEATURES,
      maintenanceMode: true,
    });
    assert.deepEqual(contracts.normalizeSystemFeatures({ checkinEnabled: "wrong-type" }), {
      ...contracts.DEFAULT_SYSTEM_FEATURES,
    });
  });
}
