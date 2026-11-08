import { fireEvent, render, screen } from "@testing-library/react";
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
  it("offers separate location and operation switches and saves the changed choices", async () => {
    const onSave = vi.fn();
    render(<SalonProfilePanel profile={profile} saving={false} onSave={onSave} />);
    const user = userEvent.setup();
    const address = screen.getByRole("switch", { name: "Hiện địa chỉ chi nhánh" });
    const directions = screen.getByRole("switch", { name: "Hiện nút Chỉ đường" });
    const checkin = screen.getByRole("switch", { name: "Nhận yêu cầu tích điểm mới" });
    const wheel = screen.getByRole("switch", { name: "Cho phép quay thưởng" });
    expect(address).toBeChecked();
    expect(directions).not.toBeChecked();
    expect(checkin).toBeChecked();
    expect(wheel).toBeChecked();
    await user.click(directions);
    await user.click(checkin);
    await user.click(wheel);
    await user.click(screen.getByRole("button", { name: "Lưu thông tin salon" }));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        showDirections: true,
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
    const address = screen.getByRole("textbox", { name: "Địa chỉ" });
    await user.clear(address);
    const points = screen.getByRole("spinbutton", { name: /Điểm cộng mỗi lượt cắt/ });
    fireEvent.change(points, { target: { value: "2" } });
    await user.click(screen.getByRole("button", { name: "Lưu thông tin salon" }));
    expect(onSave).toHaveBeenCalledWith({
      name: profile.name,
      phone: "",
      address: "",
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
