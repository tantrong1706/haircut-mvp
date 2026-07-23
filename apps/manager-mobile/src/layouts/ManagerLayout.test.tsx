import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { AppUser } from "../services/managerApi";
import { ManagerLayout } from "./ManagerLayout";

const owner: AppUser = {
  uid: "owner-test",
  salonId: "salon-test",
  name: "Chủ salon",
  avatarUrl: "",
  role: "owner",
  isActive: true,
};

const staff: AppUser = {
  ...owner,
  uid: "staff-test",
  name: "Nhân viên",
  role: "staff",
  branchId: "branch-test",
  branchIds: ["branch-test"],
};

describe("ManagerLayout accessibility", () => {
  it("có nhãn điều hướng, đúng năm nút và trạng thái trang hiện tại", () => {
    const html = renderToStaticMarkup(
      <ManagerLayout
        user={owner}
        salonName="Salon kiểm thử"
        activeOwnerTab="today"
        onOwnerTabChange={() => undefined}
      >
        <p>Nội dung</p>
      </ManagerLayout>,
    );

    expect(html).toContain('aria-label="Điều hướng chính"');
    expect((html.match(/<button/g) || []).length).toBe(5);
    expect((html.match(/aria-current="page"/g) || []).length).toBe(1);
    expect(html).toContain("Hôm nay");
    expect(html).toContain("Cài đặt");
  });

  it("không hiển thị ID kỹ thuật của salon trong header", () => {
    const html = renderToStaticMarkup(
      <ManagerLayout
        user={owner}
        salonName="Salon kiểm thử"
        activeOwnerTab="today"
        onOwnerTabChange={() => undefined}
      >
        <p>Nội dung</p>
      </ManagerLayout>,
    );

    expect(html).not.toContain(owner.salonId);
    expect(html).not.toContain(owner.uid);
  });

  it("Staff chỉ thấy đúng năm tab dành cho nhân viên", () => {
    const html = renderToStaticMarkup(
      <ManagerLayout
        user={staff}
        salonName="Salon kiểm thử"
        branchName="Chi nhánh chính"
        activeStaffTab="queue"
        onStaffTabChange={() => undefined}
      >
        <p>Nội dung</p>
      </ManagerLayout>,
    );

    expect((html.match(/<button/g) || []).length).toBe(5);
    for (const label of ["Hàng chờ", "Đang làm", "Điểm và quà", "Lịch sử", "Tài khoản"]) {
      expect(html).toContain(label);
    }
    expect(html).not.toContain(">Quản lý<");
    expect(html).not.toContain(">Duyệt<");
  });
});
