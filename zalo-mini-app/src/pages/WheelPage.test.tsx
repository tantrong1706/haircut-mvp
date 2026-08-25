import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppSession, LuckyWheelConfig, SpinResult } from "../services/types";
import { normalizeDegrees } from "../services/wheel";
import { WheelPage } from "./WheelPage";

const mocks = vi.hoisted(() => ({
  getCustomerWheelConfig: vi.fn(),
  spinWheel: vi.fn(),
}));

vi.mock("../services/api", () => ({
  getCustomerWheelConfig: mocks.getCustomerWheelConfig,
  spinWheel: mocks.spinWheel,
}));

vi.mock("../services/monitoring", () => ({
  trackEvent: vi.fn(),
  withMonitoringTrace: vi.fn((_name: string, callback: () => unknown) => callback()),
}));

const config: LuckyWheelConfig = {
  requiredPoints: 5,
  rewardValidityDays: 30,
  deductPointsAfterSpin: true,
  slots: Array.from({ length: 6 }, (_, index) => ({
    label: `Quà ${index + 1}`,
    active: true,
    type: "reward" as const,
  })),
};

const session: AppSession = {
  qr: { qrType: "branch", salonId: "salon-a", branchId: "branch-a", mirrorId: "" },
  sessionId: "session-a",
  zaloUserId: "zalo-a",
  customer: { customerId: "customer-a", name: "Khách A", points: 20, allowPhoto: true },
};

function spinResult(selectedIndex: number): SpinResult {
  return {
    rewardId: `reward-${selectedIndex}`,
    rewardName: config.slots[selectedIndex].label,
    rewardCode: `CODE-${selectedIndex}`,
    pointsAfter: 15,
    isWinning: true,
    selectedIndex,
  };
}

async function finishCurrentSpin() {
  const wheel = await screen.findByTestId("lucky-wheel");
  await waitFor(() => expect(wheel).toHaveClass("animating"));
  fireEvent(wheel, new Event("animationend", { bubbles: true }));
}

describe("WheelPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCustomerWheelConfig.mockResolvedValue(config);
  });

  it.each([0, 5])("dừng đúng giữa ô backend trả về ở index %s", async (selectedIndex) => {
    const user = userEvent.setup();
    mocks.spinWheel.mockResolvedValue(spinResult(selectedIndex));
    render(<WheelPage session={session} onSessionChange={vi.fn()} />);

    await user.click(await screen.findByRole("button", { name: "Quay ngay" }));
    const wheel = await screen.findByTestId("lucky-wheel");
    await finishCurrentSpin();

    await waitFor(() => expect(document.querySelector(".reward-result")).toBeInTheDocument());
    expect(
      within(document.querySelector(".reward-result")!).getByText(
        config.slots[selectedIndex].label,
      ),
    ).toBeInTheDocument();
    const finalRotation = Number(wheel.getAttribute("data-rotation"));
    const selectedCenter = selectedIndex * 60 + 30;
    expect(normalizeDegrees(selectedCenter + finalRotation)).toBeCloseTo(0, 8);
    expect(wheel.style.getPropertyValue("--wheel-label-counter")).toBe(`${-finalRotation}deg`);
    expect(document.querySelector(".wheel-label")?.getAttribute("style")).toContain(
      "rotate(var(--wheel-label-counter))",
    );
  });

  it("khóa double click và disable nút cho tới khi animation kết thúc", async () => {
    const user = userEvent.setup();
    let resolveSpin!: (result: SpinResult) => void;
    mocks.spinWheel.mockReturnValue(
      new Promise<SpinResult>((resolve) => {
        resolveSpin = resolve;
      }),
    );
    render(<WheelPage session={session} onSessionChange={vi.fn()} />);

    const button = await screen.findByRole("button", { name: "Quay ngay" });
    await Promise.all([user.click(button), user.click(button)]);

    expect(mocks.spinWheel).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Đang quay..." })).toBeDisabled();

    resolveSpin(spinResult(2));
    await finishCurrentSpin();
    await waitFor(() => expect(screen.getByRole("button", { name: "Quay ngay" })).toBeEnabled());
  });

  it("giữ góc liên tục qua nhiều lượt quay", async () => {
    const user = userEvent.setup();
    mocks.spinWheel.mockResolvedValueOnce(spinResult(1)).mockResolvedValueOnce(spinResult(4));
    render(<WheelPage session={session} onSessionChange={vi.fn()} />);

    await user.click(await screen.findByRole("button", { name: "Quay ngay" }));
    await finishCurrentSpin();
    const wheel = screen.getByTestId("lucky-wheel");
    const firstRotation = Number(wheel.getAttribute("data-rotation"));

    await user.click(await screen.findByRole("button", { name: "Quay ngay" }));
    await finishCurrentSpin();
    const secondRotation = Number(wheel.getAttribute("data-rotation"));

    expect(mocks.spinWheel).toHaveBeenCalledTimes(2);
    expect(secondRotation).toBeGreaterThan(firstRotation);
    expect(normalizeDegrees(4 * 60 + 30 + secondRotation)).toBeCloseTo(0, 8);
  });

  it("xóa kết quả lượt cũ khi chuyển sang phiên khách khác", async () => {
    const user = userEvent.setup();
    mocks.spinWheel.mockResolvedValue(spinResult(1));
    const view = render(<WheelPage session={session} onSessionChange={vi.fn()} />);

    await user.click(await screen.findByRole("button", { name: "Quay ngay" }));
    await finishCurrentSpin();
    await waitFor(() => expect(document.querySelector(".reward-result")).toBeInTheDocument());
    expect(
      within(document.querySelector(".reward-result")!).getByText(config.slots[1].label),
    ).toBeInTheDocument();

    view.rerender(
      <WheelPage
        session={{
          ...session,
          sessionId: "session-b",
          customer: { ...session.customer, customerId: "customer-b", name: "Khách B" },
        }}
        onSessionChange={vi.fn()}
      />,
    );

    await waitFor(() => expect(document.querySelector(".reward-result")).not.toBeInTheDocument());
  });

  it("đưa khách đến danh sách quà sau khi quay trúng", async () => {
    const user = userEvent.setup();
    const onOpenRewards = vi.fn();
    mocks.spinWheel.mockResolvedValue(spinResult(2));
    const props = { session, onSessionChange: vi.fn(), onOpenRewards } as Parameters<
      typeof WheelPage
    >[0] & { onOpenRewards: () => void };
    render(<WheelPage {...props} />);

    await user.click(await screen.findByRole("button", { name: "Quay ngay" }));
    await finishCurrentSpin();
    await user.click(await screen.findByRole("button", { name: "Xem quà của tôi" }));

    expect(onOpenRewards).toHaveBeenCalledTimes(1);
  });
});
