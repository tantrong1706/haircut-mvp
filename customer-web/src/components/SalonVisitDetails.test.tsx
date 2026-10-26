import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SalonVisitDetails } from "./SalonVisitDetails";
const mocks = vi.hoisted(() => ({ read: vi.fn(), save: vi.fn(), upload: vi.fn() }));
vi.mock("../services/visitDetails", () => ({
  getLatestHaircutDetails: mocks.read,
  updateLatestHaircutDetails: mocks.save,
}));
vi.mock("../services/customerPhotos", () => ({ uploadHaircutPhoto: mocks.upload }));
describe("salon latest visit editor", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.read.mockResolvedValue({
      recordId: "record",
      sessionId: "session",
      branchId: "branch",
      createdAtMs: null,
      revision: 0,
      note: "",
      photoUrls: [],
      photoCount: 0,
      allowPhoto: true,
      photoConsentGranted: true,
    });
    mocks.save.mockImplementation(async (input) => ({ revision: input.revision + 1 }));
    mocks.upload.mockResolvedValue({
      path: "synthetic-photo-path",
      url: "https://example.invalid/saved.jpg",
    });
    vi.stubGlobal(
      "URL",
      class extends URL {
        static createObjectURL = vi.fn(() => "blob:fixture");
        static revokeObjectURL = vi.fn();
      },
    );
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });
  it("uploads a photo to the exact completed record and saves it without calling points", async () => {
    const saved = vi.fn(),
      user = userEvent.setup();
    render(<SalonVisitDetails salonId="salon" customerId="customer" onSaved={saved} />);
    await user.click(screen.getByRole("button", { name: "Thêm ảnh" }));
    const input = await screen.findByLabelText("Chụp ảnh kiểu tóc");
    await user.upload(
      input,
      new File([new Uint8Array([255, 216, 255])], "fixture.jpg", { type: "image/jpeg" }),
    );
    await user.click(screen.getByRole("button", { name: "Tải 1 ảnh" }));
    expect(await screen.findByText(/Đã lưu ảnh nội bộ/)).toBeVisible();
    expect(mocks.upload).toHaveBeenCalledWith(
      expect.objectContaining({
        recordId: "record",
        sessionId: "session",
        customerId: "customer",
        branchId: "branch",
      }),
    );
    expect(mocks.save).toHaveBeenCalledWith({
      salonId: "salon",
      customerId: "customer",
      recordId: "record",
      revision: 0,
      addPhotoPaths: ["synthetic-photo-path"],
    });
    expect(saved).toHaveBeenCalledOnce();
    expect(screen.getByAltText("Ảnh kiểu tóc 1")).toBeVisible();
  });
  it("records explicit visit consent before upload and retains an unsuccessful draft for retry", async () => {
    mocks.read.mockResolvedValue({
      recordId: "record",
      sessionId: "session",
      branchId: "branch",
      revision: 0,
      note: "",
      photoUrls: [],
      photoCount: 0,
      allowPhoto: true,
      photoConsentGranted: false,
    });
    mocks.upload.mockRejectedValueOnce(new Error("Synthetic network failure"));
    const user = userEvent.setup();
    render(<SalonVisitDetails salonId="salon" customerId="customer" />);
    await user.click(screen.getByRole("button", { name: "Thêm ảnh" }));
    expect(await screen.findByLabelText("Chụp ảnh kiểu tóc")).toBeDisabled();
    await user.click(screen.getByRole("checkbox"));
    await user.upload(
      screen.getByLabelText("Chụp ảnh kiểu tóc"),
      new File([new Uint8Array([255, 216, 255])], "fixture.jpg", { type: "image/jpeg" }),
    );
    await user.click(screen.getByRole("button", { name: "Tải 1 ảnh" }));
    expect(await screen.findByText("Synthetic network failure")).toBeVisible();
    expect(mocks.save).toHaveBeenCalledWith(
      expect.objectContaining({ photoConsentConfirmed: true, revision: 0 }),
    );
    expect(screen.getByAltText("Ảnh chờ tải 1")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Tải 1 ảnh" }));
    expect(await screen.findByText(/Đã lưu ảnh nội bộ/)).toBeVisible();
    expect(mocks.save).toHaveBeenLastCalledWith(
      expect.objectContaining({ revision: 1, addPhotoPaths: ["synthetic-photo-path"] }),
    );
  });
  it("retains a failed note and only closes the editor explicitly", async () => {
    mocks.save.mockRejectedValue(new Error("Hồ sơ vừa được cập nhật"));
    const user = userEvent.setup();
    render(<SalonVisitDetails salonId="salon" customerId="customer" />);
    await user.click(screen.getByRole("button", { name: "Thêm ghi chú" }));
    await user.type(await screen.findByLabelText("Ghi chú nội bộ"), "Keep draft");
    await user.click(screen.getByRole("button", { name: "Lưu ghi chú" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Hồ sơ vừa được cập nhật");
    expect(screen.getByLabelText("Ghi chú nội bộ")).toHaveValue("Keep draft");
    await user.click(screen.getByRole("button", { name: "Đóng bổ sung lượt cắt" }));
    expect(screen.queryByLabelText("Ghi chú nội bộ")).not.toBeInTheDocument();
  });
  it.each([new Error("Không có lượt cắt"), null])(
    "handles unavailable records without permitting writes (%j)",
    async (failure) => {
      mocks.read.mockRejectedValue(failure);
      render(<SalonVisitDetails salonId="salon" customerId="customer" />);
      await userEvent.setup().click(screen.getByRole("button", { name: "Thêm ảnh" }));
      expect(await screen.findByRole("alert")).toBeVisible();
      expect(screen.queryByLabelText("Chụp ảnh kiểu tóc")).not.toBeInTheDocument();
      expect(mocks.save).not.toHaveBeenCalled();
    },
  );
  it("opens notes at the customer card and saves the exact completed record without awarding points", async () => {
    const visit = {
      recordId: "record",
      sessionId: "session",
      branchId: "branch",
      createdAtMs: 1234567890000,
      revision: 0,
      note: "Internal note",
      photoUrls: [],
      photoCount: 0,
      allowPhoto: true,
      photoConsentGranted: true,
    };
    mocks.read.mockResolvedValue(visit);
    mocks.save.mockResolvedValue({ revision: 1 });
    render(<SalonVisitDetails salonId="salon" customerId="customer" />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Thêm ghi chú" }));
    const note = await screen.findByLabelText("Ghi chú nội bộ");
    await user.clear(note);
    await user.type(note, "New style");
    await user.click(screen.getByRole("button", { name: "Lưu ghi chú" }));
    expect(mocks.save).toHaveBeenCalledWith({
      salonId: "salon",
      customerId: "customer",
      recordId: "record",
      revision: 0,
      note: "New style",
    });
    expect(await screen.findByText(/Đã lưu ghi chú/)).toBeInTheDocument();
  });
  it("shows saved images to salon staff, with upload locked if customer consent is absent", async () => {
    mocks.read.mockResolvedValue({
      recordId: "record",
      sessionId: "session",
      branchId: "branch",
      revision: 0,
      note: "",
      photoUrls: ["https://example.invalid/internal.jpg"],
      photoCount: 1,
      allowPhoto: false,
      photoConsentGranted: false,
    });
    render(<SalonVisitDetails salonId="salon" customerId="customer" />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Thêm ảnh" }));
    expect(await screen.findByLabelText("Chụp ảnh kiểu tóc")).toBeDisabled();
    expect(screen.getByText(/Chỉ chủ salon và nhân viên/)).toBeInTheDocument();
    expect(mocks.upload).not.toHaveBeenCalled();
  });
});
