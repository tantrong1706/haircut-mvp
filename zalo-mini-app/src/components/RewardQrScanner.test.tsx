import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  startRewardQrCamera: vi.fn(),
  stop: vi.fn(),
  emitCode: null as null | ((code: string) => void),
}));

vi.mock("../services/rewardQrScanner", () => ({
  startRewardQrCamera: mocks.startRewardQrCamera,
}));

import { RewardQrScanner } from "./RewardQrScanner";

describe("RewardQrScanner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.emitCode = null;
    mocks.startRewardQrCamera.mockImplementation(
      async (_video: HTMLVideoElement, onCode: (code: string) => void) => {
        mocks.emitCode = onCode;
        return mocks.stop;
      },
    );
  });

  it("quét bằng camera, phát mã rồi đóng camera", async () => {
    const user = userEvent.setup();
    const onCode = vi.fn();
    render(<RewardQrScanner onCode={onCode} />);

    await user.click(screen.getByRole("button", { name: "Quét QR quà" }));

    expect(await screen.findByRole("dialog", { name: "Quét QR quà" })).toBeVisible();
    act(() => mocks.emitCode?.("HC-TEST12"));
    await waitFor(() => expect(onCode).toHaveBeenCalledWith("HC-TEST12"));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(mocks.stop).toHaveBeenCalledTimes(1);
  });

  it("cho đóng camera và hiển thị lỗi quyền", async () => {
    const user = userEvent.setup();
    mocks.startRewardQrCamera.mockRejectedValue(new Error("Camera đang bị chặn"));
    render(<RewardQrScanner onCode={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Quét QR quà" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Camera đang bị chặn");
    await user.click(screen.getByRole("button", { name: "Đóng camera" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
