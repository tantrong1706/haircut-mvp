import { describe, expect, it } from "vitest";

import { getViteBuildOutDir, TEST_BUILD_DIR, ZMP_BUILD_DIR } from "./buildOutput";

describe("getViteBuildOutDir", () => {
  it("keeps test artifacts outside the ZMP deployment package", () => {
    expect(getViteBuildOutDir("test")).toBe(TEST_BUILD_DIR);
    expect(TEST_BUILD_DIR).not.toBe(ZMP_BUILD_DIR);
  });

  it.each(["production", "development", "staging"])("uses the ZMP package for %s mode", (mode) => {
    expect(getViteBuildOutDir(mode)).toBe(ZMP_BUILD_DIR);
  });
});
