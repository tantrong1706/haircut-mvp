import { describe, expect, it } from "vitest";
import { activeWheelSlots, normalizeLuckyWheelConfig } from "./wheel";

describe("normalizeLuckyWheelConfig", () => {
  it("luôn tạo đúng 6 ô và ít nhất 1 điểm", () => {
    const config = normalizeLuckyWheelConfig({
      requiredPoints: 0,
      slots: [{ label: " Quà VIP ", active: true }],
    });

    expect(config.requiredPoints).toBe(1);
    expect(config.slots).toHaveLength(6);
    expect(config.slots[0]).toEqual({ label: "Quà VIP", active: true });
  });

  it("chỉ trả về ô đang bật và có tên", () => {
    const config = normalizeLuckyWheelConfig({
      slots: [
        { label: "Quà 1", active: true },
        { label: "", active: true },
        { label: "Quà 3", active: false },
      ],
    });

    expect(activeWheelSlots(config).map((slot) => slot.label)).toContain("Quà 1");
    expect(activeWheelSlots(config).map((slot) => slot.label)).not.toContain("Quà 3");
  });
});
