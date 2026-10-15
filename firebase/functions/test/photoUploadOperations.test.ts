import { describe, expect, it } from "vitest";
import {
  PHOTO_UPLOAD_MAX_BYTES,
  buildPhotoUploadOperationId,
  buildPhotoUploadStoragePath,
  isExpectedPhotoUploadPath,
  validatePhotoUploadObject,
  validatePhotoUploadBytes,
} from "../src/domains/photos/photoUploadOperations";
import { createHash } from "node:crypto";
import { TEST_JPEG } from "./fixtures/jpeg";

describe("photo upload operations", () => {
  it("rejects a non-image wrapped in JPEG markers even with a matching checksum", async () => {
    const fake = Buffer.concat([
      Buffer.from([0xff, 0xd8, 0xff]),
      Buffer.from("AUDIT_NOT_AN_IMAGE"),
      Buffer.from([0xff, 0xd9]),
    ]);
    expect(
      await validatePhotoUploadBytes(fake, createHash("sha256").update(fake).digest("hex")),
    ).toBe(false);
  });
  const context = {
    salonId: "salon-a",
    customerId: "customer-a",
    sessionId: "session-a",
    operationId: "op-1234567890abcdef",
  };

  it("tạo operation id ổn định theo request và tách biệt tenant", () => {
    expect(buildPhotoUploadOperationId("salon-a", "session-a", "staff-a", "request-a")).toBe(
      buildPhotoUploadOperationId("salon-a", "session-a", "staff-a", "request-a"),
    );
    expect(buildPhotoUploadOperationId("salon-b", "session-a", "staff-a", "request-a")).not.toBe(
      buildPhotoUploadOperationId("salon-a", "session-a", "staff-a", "request-a"),
    );
  });

  it("chỉ chấp nhận đường dẫn operation đúng salon, khách và session", () => {
    const path = buildPhotoUploadStoragePath(context);
    expect(path).toBe(
      "salons/salon-a/customers/customer-a/sessions/session-a/op-1234567890abcdef.jpg",
    );
    expect(isExpectedPhotoUploadPath(path, context)).toBe(true);
    expect(isExpectedPhotoUploadPath(path.replace("salon-a", "salon-b"), context)).toBe(false);
    expect(isExpectedPhotoUploadPath(`${path}/extra`, context)).toBe(false);
  });

  it("từ chối object sai MIME, quá kích thước hoặc sai metadata", () => {
    const valid = {
      contentType: "image/jpeg",
      size: PHOTO_UPLOAD_MAX_BYTES,
      metadata: {
        salonId: "salon-a",
        branchId: "branch-a",
        customerId: "customer-a",
        sessionId: "session-a",
        uploaderUid: "staff-a",
        operationId: context.operationId,
        requestId: "request-a",
      },
    };

    expect(
      validatePhotoUploadObject(valid, {
        ...context,
        branchId: "branch-a",
        staffUid: "staff-a",
        requestId: "request-a",
      }),
    ).toBe(true);
    expect(
      validatePhotoUploadObject(
        { ...valid, contentType: "image/png" },
        {
          ...context,
          branchId: "branch-a",
          staffUid: "staff-a",
          requestId: "request-a",
        },
      ),
    ).toBe(false);
    expect(
      validatePhotoUploadObject(
        { ...valid, size: PHOTO_UPLOAD_MAX_BYTES + 1 },
        {
          ...context,
          branchId: "branch-a",
          staffUid: "staff-a",
          requestId: "request-a",
        },
      ),
    ).toBe(false);
    expect(
      validatePhotoUploadObject(
        { ...valid, metadata: { ...valid.metadata, salonId: "salon-b" } },
        {
          ...context,
          branchId: "branch-a",
          staffUid: "staff-a",
          requestId: "request-a",
        },
      ),
    ).toBe(false);
  });

  it("xác minh ảnh JPEG giải mã được và checksum trên byte thật", async () => {
    const jpeg = TEST_JPEG;
    const checksum = createHash("sha256").update(jpeg).digest("hex");

    expect(await validatePhotoUploadBytes(jpeg, checksum)).toBe(true);
    expect(await validatePhotoUploadBytes(jpeg, "0".repeat(64))).toBe(false);
    expect(await validatePhotoUploadBytes(Buffer.from("not-an-image"), checksum)).toBe(false);
  });

  it("rejects oversized bodies, oversized dimensions and truncated JPEG scans", async () => {
    const huge = Buffer.alloc(PHOTO_UPLOAD_MAX_BYTES + 1);
    const dimensions = Buffer.from(TEST_JPEG);
    const sof = dimensions.indexOf(Buffer.from([0xff, 0xc0]));
    expect(sof).toBeGreaterThan(0);
    dimensions.writeUInt16BE(65535, sof + 5);
    dimensions.writeUInt16BE(65535, sof + 7);
    const truncated = Buffer.concat([TEST_JPEG.subarray(0, -9), Buffer.from([0xff, 0xd9])]);
    for (const bytes of [huge, dimensions, truncated]) {
      expect(
        await validatePhotoUploadBytes(bytes, createHash("sha256").update(bytes).digest("hex")),
      ).toBe(false);
    }
  });
});
