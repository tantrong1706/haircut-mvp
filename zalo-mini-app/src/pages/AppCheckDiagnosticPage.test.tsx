import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ run: vi.fn() }));
vi.mock("../services/appCheckDiagnostic", () => ({ runAppCheckDiagnostic: mocks.run }));
import { AppCheckDiagnosticPage } from "./AppCheckDiagnosticPage";
beforeEach(() => vi.clearAllMocks());
describe("App Check diagnostic page", () => {
  it("chỉ kiểm tra sau thao tác người dùng và khóa bấm lặp", async () => {
    let finish!: (result: { status: "passed" }) => void;
    mocks.run.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    render(<AppCheckDiagnosticPage />);
    expect(mocks.run).not.toHaveBeenCalled();
    await userEvent.setup().dblClick(screen.getByRole("button", { name: "Kiểm tra ngay" }));
    expect(mocks.run).toHaveBeenCalledOnce();
    finish({ status: "passed" });
    expect(await screen.findByText("Kiểm tra thành công")).toBeVisible();
    expect(screen.getByRole("button", { name: "Kiểm tra ngay" })).toBeDisabled();
  });
  it("hiển thị trạng thái thất bại rõ ràng", async () => {
    mocks.run.mockResolvedValue({
      status: "failed",
      code: "appCheck/initial-throttle",
      httpStatus: 403,
    });
    render(<AppCheckDiagnosticPage />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Kiểm tra ngay" }));
    expect(await screen.findByText("Chưa xác minh được trình duyệt")).toBeVisible();
    expect(screen.getByText(/HTTP 403/)).toBeVisible();
  });
});
