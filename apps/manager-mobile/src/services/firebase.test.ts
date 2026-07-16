import { describe, expect, it } from "vitest";
import { missingManagerFirebaseKeys } from "./firebase";

describe("Manager Firebase config", () => {
  it("không phụ thuộc biến Zalo và báo đủ khóa Firebase còn thiếu", () => {
    expect(missingManagerFirebaseKeys({})).toEqual([
      "apiKey",
      "authDomain",
      "projectId",
      "storageBucket",
      "messagingSenderId",
      "appId",
    ]);
  });

  it("chấp nhận cấu hình Manager tối thiểu", () => {
    expect(
      missingManagerFirebaseKeys({
        apiKey: "public-api-key",
        authDomain: "manager.example",
        projectId: "manager-project",
        storageBucket: "manager-bucket",
        messagingSenderId: "123",
        appId: "app-id",
      }),
    ).toEqual([]);
  });
});
