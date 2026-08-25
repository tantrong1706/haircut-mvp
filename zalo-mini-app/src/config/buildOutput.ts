export const ZMP_BUILD_DIR = "www";
export const TEST_BUILD_DIR = "www-test";

export function getViteBuildOutDir(mode: string): string {
  return mode === "test" ? TEST_BUILD_DIR : ZMP_BUILD_DIR;
}
