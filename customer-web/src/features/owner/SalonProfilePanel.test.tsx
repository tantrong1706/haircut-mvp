import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DEFAULT_SYSTEM_FEATURES } from "@haircut/contracts";
import { SalonProfilePanel } from "./SalonProfilePanel";

const profile = {
  id: "fixture-salon",
  name: "Salon mẫu",
  phone: "0900000000",
  address: "Địa chỉ mẫu",
  hotline: "028 0000 0000",
  openingHours: "09:00–20:00",
  avatarUrl: "",
  pointPerVisit: 1,
  freeCustomerLimit: 50,
  features: DEFAULT_SYSTEM_FEATURES,
};

describe("salon public profile form", () => {
  it("does not fall back to the salon's private address when no branch is available", async () => {
    render(
      <SalonProfilePanel
        profile={profile}
        saving={false}
        onSave={vi.fn()}
      />,
    );
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Xem trước thông tin khách" }));
    const preview = within(screen.getByRole("region", { name: "Xem trước thông tin khách" }));
    expect(preview.getByText("Chưa có chi nhánh để xem trước.")).toBeVisible();
    expect(preview.queryByText(profile.address)).not.toBeInTheDocument();
    expect(preview.queryByText("Chỉ đường")).not.toBeInTheDocument();
  });

  it("previews the selected branch and unsaved visibility settings without submitting or opening external links", async () => {
    const onSave = vi.fn();
    const user = userEvent.setup();
    const branches = [
      {
        id: "first",
        salonId: profile.id,
        name: "Chi nhánh Một",
        address: "Đường Một",
        isActive: true,
      },
      {
        id: "second",
        salonId: profile.id,
        name: "Chi nhánh Hai",
        address: "Đường Hai",
        isActive: true,
      },
      {
        id: "inactive",
        salonId: profile.id,
        name: "Đã đóng",
        address: "Địa chỉ cũ",
        isActive: false,
      },
      {
        id: "other",
        salonId: "other-salon",
        name: "Salon khác",
        address: "Địa chỉ khác",
        isActive: true,
      },
    ];
    render(
      <SalonProfilePanel
        profile={profile}
        branches={branches}
        saving={false}
        onSave={onSave}
      />,
    );
    expect(
      screen.queryByRole("region", { name: "Xem trước thông tin khách" }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Xem trước thông tin khách" }));
    const preview = within(screen.getByRole("region", { name: "Xem trước thông tin khách" }));
    await user.selectOptions(preview.getByRole("combobox"), "second");
    expect(preview.queryByRole("option", { name: "Đã đóng" })).not.toBeInTheDocument();
    expect(preview.queryByRole("option", { name: "Salon khác" })).not.toBeInTheDocument();
    expect(preview.getByText("Chi nhánh Hai", { selector: "p" })).toBeVisible();
    expect(preview.queryByText("Đường Hai")).not.toBeInTheDocument();
    expect(preview.queryByText("Chỉ đường")).not.toBeInTheDocument();
    expect(preview.queryByRole("link")).not.toBeInTheDocument();
    expect(preview.queryByText(profile.phone)).not.toBeInTheDocument();
    await user.click(screen.getByRole("switch", { name: "Hiện hotline" }));
    expect(preview.queryByText("Đường Hai")).not.toBeInTheDocument();
    expect(preview.queryByText("Chỉ đường")).not.toBeInTheDocument();
    expect(preview.queryByText(profile.hotline)).not.toBeInTheDocument();
    expect(preview.getByText(profile.openingHours)).toBeVisible();
    expect(onSave).not.toHaveBeenCalled();
  });

  it("keeps operation switches without asking for customer location", async () => {
    const onSave = vi.fn();
    render(<SalonProfilePanel profile={profile} saving={false} onSave={onSave} />);
    const user = userEvent.setup();
    expect(screen.queryByRole("switch", { name: "Hiện địa chỉ chi nhánh" })).not.toBeInTheDocument();
    expect(screen.queryByRole("switch", { name: "Hiện nút Chỉ đường" })).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: /Địa chỉ hồ sơ salon/ })).not.toBeInTheDocument();
    const checkin = screen.getByRole("switch", { name: "Nhận yêu cầu tích điểm mới" });
    const wheel = screen.getByRole("switch", { name: "Cho phép quay thưởng" });
    expect(checkin).toBeChecked();
    expect(wheel).toBeChecked();
    await user.click(checkin);
    await user.click(wheel);
    await user.click(screen.getByRole("button", { name: "Lưu thông tin salon" }));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        acceptWebPointRequests: false,
        allowWebWheel: false,
      }),
    );
  });

  it("saves only the visibility switches changed and keeps the saved contact values", async () => {
    const onSave = vi.fn();
    render(<SalonProfilePanel profile={profile} saving={false} onSave={onSave} />);
    const user = userEvent.setup();
    const logo = screen.getByRole("switch", { name: "Hiện logo" });
    const hotline = screen.getByRole("switch", { name: "Hiện hotline" });
    const hours = screen.getByRole("switch", { name: "Hiện giờ mở cửa" });
    expect(logo).toBeChecked();
    expect(hotline).toBeChecked();
    expect(hours).toBeChecked();
    await user.click(logo);
    await user.click(hotline);
    await user.click(hours);
    await user.click(screen.getByRole("button", { name: "Lưu thông tin salon" }));
    expect(onSave).toHaveBeenCalledWith({
      name: profile.name,
      phone: profile.phone,
      address: profile.address,
      pointPerVisit: 1,
      showLogo: false,
      showHotline: false,
      showOpeningHours: false,
    });
    expect(screen.getByRole("textbox", { name: /Hotline hiển thị cho khách/ })).toHaveValue(
      profile.hotline,
    );
    expect(screen.getByRole("textbox", { name: /Giờ mở cửa/ })).toHaveValue(profile.openingHours);
  });

  it("sends explicit blanks only for the public fields the owner clears", async () => {
    const onSave = vi.fn();
    render(<SalonProfilePanel profile={profile} saving={false} onSave={onSave} />);
    const user = userEvent.setup();
    const save = screen.getByRole("button", { name: "Lưu thông tin salon" });
    expect(save).toBeDisabled();
    await user.clear(screen.getByRole("textbox", { name: /Hotline hiển thị cho khách/ }));
    await user.click(save);
    expect(onSave).toHaveBeenCalledWith({
      name: profile.name,
      phone: profile.phone,
      address: profile.address,
      pointPerVisit: 1,
      hotline: "",
    });
  });

  it("keeps private settings editable without resending public fields", async () => {
    const onSave = vi.fn();
    render(<SalonProfilePanel profile={profile} saving={false} onSave={onSave} />);
    const user = userEvent.setup();
    const phone = screen.getByRole("textbox", { name: "Số liên hệ nội bộ" });
    await user.clear(phone);
    const points = screen.getByRole("spinbutton", { name: /Điểm cộng mỗi lượt cắt/ });
    fireEvent.change(points, { target: { value: "2" } });
    await user.click(screen.getByRole("button", { name: "Lưu thông tin salon" }));
    expect(onSave).toHaveBeenCalledWith({
      name: profile.name,
      phone: "",
      address: profile.address,
      pointPerVisit: 2,
    });
  });

  it("disables the form while loading or saving", () => {
    const onSave = vi.fn();
    const { rerender } = render(
      <SalonProfilePanel profile={null} saving={false} onSave={onSave} />,
    );
    expect(screen.getByRole("textbox", { name: "Tên hiển thị" })).toBeDisabled();
    rerender(<SalonProfilePanel profile={profile} saving onSave={onSave} />);
    expect(screen.getByRole("button", { name: "Đang lưu..." })).toBeDisabled();
    expect(onSave).not.toHaveBeenCalled();
  });
});
