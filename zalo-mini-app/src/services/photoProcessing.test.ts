import { afterEach, describe, expect, it, vi } from "vitest";
import {
  PHOTO_MAX_DIMENSION,
  PHOTO_MAX_SOURCE_BYTES,
  classifyImageBytes,
  processHaircutPhoto,
  validateHaircutPhotoSource,
} from "./photoProcessing";

describe("photo processing validation", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });
  it("nhận diện JPEG, PNG và WebP theo magic bytes thay vì tên file", () => {
    expect(classifyImageBytes(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(
      classifyImageBytes(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
    ).toBe("image/png");
    expect(
      classifyImageBytes(
        new Uint8Array([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50]),
      ),
    ).toBe("image/webp");
    expect(classifyImageBytes(new Uint8Array([0x25, 0x50, 0x44, 0x46]))).toBeNull();
  });

  it("từ chối file giả MIME và file quá lớn", async () => {
    const fakeJpeg = new File([new Uint8Array([0x25, 0x50, 0x44, 0x46])], "fake.jpg", {
      type: "image/jpeg",
    });
    await expect(validateHaircutPhotoSource(fakeJpeg)).rejects.toThrow(/không phải ảnh/i);

    const oversized = {
      name: "large.jpg",
      type: "image/jpeg",
      size: PHOTO_MAX_SOURCE_BYTES + 1,
      slice: () => new Blob([new Uint8Array([0xff, 0xd8, 0xff])]),
    } as File;
    await expect(validateHaircutPhotoSource(oversized)).rejects.toThrow(/quá lớn/i);
  });

  it("không giả hỗ trợ HEIC khi runtime chưa chuyển đổi được", async () => {
    const heic = new File(
      [new Uint8Array([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63])],
      "photo.heic",
      { type: "image/heic" },
    );
    await expect(validateHaircutPhotoSource(heic)).rejects.toThrow(/HEIC/i);
  });

  it("sửa orientation qua decoder, resize và tái mã hóa JPEG không mang EXIF", async () => {
    const close = vi.fn();
    const drawImage = vi.fn();
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn().mockResolvedValue({ width: 4000, height: 2000, close }),
    );
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      fillStyle: "",
      fillRect: vi.fn(),
      imageSmoothingEnabled: false,
      imageSmoothingQuality: "low",
      drawImage,
    } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((callback, type) => {
      callback(new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], { type }));
    });
    const source = new File(
      [new Uint8Array([0xff, 0xd8, 0xff, 0xe1, 0x45, 0x78, 0x69, 0x66])],
      "portrait-with-exif.jpg",
      { type: "image/jpeg" },
    );

    const result = await processHaircutPhoto(source);

    expect(result).toMatchObject({
      width: PHOTO_MAX_DIMENSION,
      height: PHOTO_MAX_DIMENSION / 2,
      contentType: "image/jpeg",
    });
    expect(drawImage).toHaveBeenCalled();
    expect(close).toHaveBeenCalledOnce();
    expect(result.blob.type).toBe("image/jpeg");
    expect(Array.from(new Uint8Array(await result.blob.arrayBuffer()))).not.toEqual(
      Array.from(new Uint8Array(await source.arrayBuffer())),
    );
  });
});
