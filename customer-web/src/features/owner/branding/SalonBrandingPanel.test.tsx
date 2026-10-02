import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SalonBrandingPanel } from "./SalonBrandingPanel";

describe("SalonBrandingPanel", () => {
  it("hiển thị ảnh salon và cho owner xóa ảnh", () => {
    const onClear = vi.fn();
    render(
      <SalonBrandingPanel
        salonName="Salon Tân Trọng"
        avatarUrl="https://example.test/salon.webp"
        saving={false}
        onUpload={vi.fn()}
        onClear={onClear}
      />,
    );

    expect(screen.getByAltText("Ảnh đại diện Salon Tân Trọng")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Xóa ảnh salon" }));
    expect(onClear).toHaveBeenCalledTimes(1);
  });
});
