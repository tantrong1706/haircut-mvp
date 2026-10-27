import { useState } from "react";
import { act, fireEvent, render, renderHook, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { OwnerOverview, PointRequest } from "../../services/operations";
import { defaultLuckyWheelConfig } from "../../services/types";
import { ApprovalsPanel } from "./ApprovalsPanel";
import { OverviewPanel } from "./OverviewPanel";
import { WheelConfigPanel } from "./WheelConfigPanel";
import { ownerPhoneLabel } from "./ownerFormatters";
import { useOwnerNavigation } from "./useOwnerNavigation";

vi.mock("../../services/operations", () => ({ formatDateTime: () => "" }));
vi.mock("../../services/customerPhotos", () => ({ MAX_HAIRCUT_PHOTOS: 3 }));

describe("extracted owner panels", () => {
  it.each([
    [{ phone: "+84 912 345 678", phoneLast4: "5678" }, "0912345678"],
    [{ phone: "0912-345-678", phoneLast4: "5678" }, "0912345678"],
    [{ phoneLast4: "5678" }, "******5678"],
    [{ phone: "letters", phoneLast4: "" }, "Chưa có SĐT"],
  ])("preserves the existing owner phone label for %j", (customer, label) => {
    expect(ownerPhoneLabel(customer)).toBe(label);
  });

  it("keeps overview loading/empty values and exact quick-action destinations", async () => {
    const onOpenTab = vi.fn(),
      onRefresh = vi.fn();
    const { rerender } = render(
      <OverviewPanel overview={null} loading onOpenTab={onOpenTab} onRefresh={onRefresh} />,
    );
    expect(screen.getByRole("button", { name: "Đang tải" })).toBeDisabled();
    expect(screen.getAllByText("0", { exact: true })).toHaveLength(7);
    expect(screen.getByText("Chưa có khách cần nhắc lại")).toBeVisible();
    rerender(
      <OverviewPanel overview={null} loading={false} onOpenTab={onOpenTab} onRefresh={onRefresh} />,
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Làm mới" }));
    expect(onRefresh).toHaveBeenCalledOnce();
    await user.click(screen.getByRole("button", { name: "Duyệt điểmChưa có yêu cầu" }));
    await user.click(screen.getAllByRole("button", { name: /Tìm khách/ })[0]);
    await user.click(screen.getByRole("button", { name: "Đổi quàKiểm tra mã quà" }));
    await user.click(screen.getAllByRole("button", { name: /Tìm khách/ })[1]);
    expect(onOpenTab.mock.calls).toEqual([["approvals"], ["customers"], ["redeem"], ["customers"]]);
  });

  it("preserves populated metrics, inactive-day thresholds and missing-history fallback", () => {
    const overview: OwnerOverview = {
      customersToday: 3,
      customers7Days: 8,
      customers30Days: 20,
      pendingRequests: 2,
      pointsApprovedToday: 4,
      spinsToday: 6,
      unusedRewards: 5,
      inactiveCustomers: [40, 999].map((days) => ({
        id: `fixture-${days}`,
        name: `Khách ${days}`,
        phoneLast4: "1234",
        points: 7,
        lastVisitAtMs: null,
        daysSinceLastVisit: days,
      })),
    };
    render(
      <OverviewPanel overview={overview} loading={false} onOpenTab={vi.fn()} onRefresh={vi.fn()} />,
    );
    expect(screen.getByRole("button", { name: "Duyệt điểm2 đang chờ" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Đổi quà5 mã quà" })).toBeVisible();
    expect(screen.getByText("40 ngày")).toBeVisible();
    expect(screen.getByText("Chưa quay lại")).toBeVisible();
    expect(screen.getAllByText("Chưa có lịch sử")).toHaveLength(2);
  });

  const request: PointRequest = {
    id: "request",
    salonId: "salon",
    branchId: "branch",
    branchName: "",
    customerId: "customer",
    sessionId: "session",
    staffName: "",
    note: "Ghi chú cũ",
    photoUrls: ["https://example.invalid/photo.jpg"],
    pointsAdded: 1,
    status: "pending",
    createdAtMs: null,
  };
  function approvalProps() {
    return {
      requests: [request],
      noteDrafts: {},
      busyId: "",
      photoBusyId: "",
      photoProgress: 0,
      onNoteChange: vi.fn(),
      onSaveNote: vi.fn(async () => true),
      onApprove: vi.fn(),
      onReject: vi.fn(),
      onAddPhotos: vi.fn(),
      onRemovePhoto: vi.fn(),
      onCancelPhotoUpload: vi.fn(),
    };
  }
  it("keeps approval empty/fallback text, request identity and photo removal callbacks", async () => {
    const props = approvalProps();
    const { rerender } = render(<ApprovalsPanel {...props} requests={[]} />);
    expect(screen.getByText("Chưa có yêu cầu cộng điểm")).toBeVisible();
    rerender(<ApprovalsPanel {...props} />);
    expect(screen.getByText("Khách hàng")).toBeVisible();
    expect(screen.getByText("SĐT: Chưa có")).toBeVisible();
    expect(screen.getByText("Thợ: Nhân viên")).toBeVisible();
    expect(screen.getByText("Chi nhánh: Chi nhánh")).toBeVisible();
    expect(screen.getByRole("button", { name: "Lưu ghi chú" })).toBeDisabled();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Xóa ảnh kiểu tóc 1" }));
    expect(props.onRemovePhoto).toHaveBeenCalledWith(request, {
      id: request.photoUrls[0],
      url: request.photoUrls[0],
    });
    rerender(<ApprovalsPanel {...props} noteDrafts={{ request: "Ghi chú mới" }} />);
    await user.click(screen.getByRole("button", { name: "Lưu ghi chú" }));
    expect(props.onSaveNote).toHaveBeenCalledWith(request);
  });
  it("keeps busy photo controls/progress/cancel and blocks approval/rejection for that request", async () => {
    const props = approvalProps();
    render(<ApprovalsPanel {...props} photoBusyId="request" photoProgress={42} />);
    expect(screen.getByLabelText("Ghi chú kiểu tóc (không bắt buộc)")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Duyệt" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Từ chối" })).toBeDisabled();
    expect(screen.getByLabelText("Đã tải 42%")).toBeVisible();
    await userEvent.setup().click(screen.getByRole("button", { name: "Hủy tải" }));
    expect(props.onCancelPhotoUpload).toHaveBeenCalledOnce();
  });

  it("keeps all wheel fields controlled, bounded and isolated to the selected slot", async () => {
    const onSave = vi.fn();
    let latest = structuredClone(defaultLuckyWheelConfig);
    function Harness({ saving = false }: { saving?: boolean }) {
      const [config, setConfig] = useState(latest);
      latest = config;
      return (
        <WheelConfigPanel config={config} saving={saving} onChange={setConfig} onSave={onSave} />
      );
    }
    const { rerender } = render(<Harness />);
    const change = (label: string, value: string) =>
      fireEvent.change(screen.getByLabelText(label), { target: { value } });
    change("Tên ô 1", "Quà mới");
    change("Loại ô 1", "no_prize");
    change("Trọng số ô 1", "0");
    expect(latest.slots[0]).toMatchObject({ label: "Quà mới", type: "no_prize", weight: 1 });
    change("Trọng số ô 1", "1000001");
    expect(latest.slots[0].weight).toBe(1000000);
    change("Loại ô 1", "reward");
    change("Số điểm cần để quay", "0");
    change("Hạn dùng mã quà (ngày)", "366");
    expect(latest.requiredPoints).toBe(1);
    expect(latest.rewardValidityDays).toBe(365);
    const user = userEvent.setup();
    await user.click(screen.getByLabelText("Trừ điểm sau khi khách quay"));
    await user.click(
      within(screen.getByLabelText("Danh sách ô vòng quay")).getAllByRole("checkbox")[0],
    );
    expect(latest.deductPointsAfterSpin).toBe(!defaultLuckyWheelConfig.deductPointsAfterSpin);
    expect(latest.slots[0].active).toBe(!defaultLuckyWheelConfig.slots[0].active);
    expect(latest.slots.slice(1)).toEqual(defaultLuckyWheelConfig.slots.slice(1));
    await user.click(screen.getByRole("button", { name: "Lưu vòng quay" }));
    expect(onSave).toHaveBeenCalledOnce();
    rerender(<Harness saving />);
    expect(screen.getByRole("button", { name: "Đang lưu..." })).toBeDisabled();
  });

  it("keeps initial overview, explicit tab updates and empty navigation events inert", () => {
    const { result } = renderHook(() => useOwnerNavigation());
    expect(result.current[0]).toBe("overview");
    act(() => result.current[1]("wheel"));
    act(() => window.dispatchEvent(new CustomEvent("haircut:navigate")));
    expect(result.current[0]).toBe("wheel");
  });
});
