import { afterEach, describe, expect, it, vi } from "vitest";
import { processHaircutPhoto } from "./photoProcessing";

describe("native image decoding compatibility", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });
  function canvas() {
    vi.stubGlobal("Worker", undefined);
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      fillRect: vi.fn(),
      drawImage: vi.fn(),
      fillStyle: "",
      imageSmoothingEnabled: true,
    } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((callback) =>
      callback(new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], { type: "image/jpeg" })),
    );
  }
  it("re-encodes a recognized HEIC source when the device's native decoder supports it", async () => {
    canvas();
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn().mockResolvedValue({ width: 10, height: 20, close: vi.fn() }),
    );
    const source = new File(
      [new Uint8Array([0, 0, 0, 24, 102, 116, 121, 112, 104, 101, 105, 99])],
      "fixture.heic",
      { type: "image/heic" },
    );
    await expect(processHaircutPhoto(source)).resolves.toMatchObject({
      width: 10,
      height: 20,
      contentType: "image/jpeg",
    });
  });
  it("uses an HTML image fallback when createImageBitmap is unavailable", async () => {
    canvas();
    vi.stubGlobal("createImageBitmap", undefined);
    vi.stubGlobal(
      "Image",
      class {
        naturalWidth = 10;
        naturalHeight = 20;
        width = 10;
        height = 20;
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        set src(_value: string) {
          queueMicrotask(() => this.onload?.());
        }
      },
    );
    vi.stubGlobal(
      "URL",
      class extends URL {
        static createObjectURL = vi.fn(() => "blob:synthetic-image");
        static revokeObjectURL = vi.fn();
      },
    );
    const source = new File([new Uint8Array([0xff, 0xd8, 0xff])], "fixture.jpg", {
      type: "image/jpeg",
    });
    await expect(processHaircutPhoto(source)).resolves.toMatchObject({
      width: 10,
      height: 20,
      contentType: "image/jpeg",
    });
    expect(URL.revokeObjectURL).toHaveBeenCalled();
  });
});
