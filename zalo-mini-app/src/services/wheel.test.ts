import { describe, expect, it } from "vitest";
import {
  WHEEL_ANIMATION_DURATION_MS,
  activeWheelSlots,
  createWheelAnimationPlan,
  normalizeDegrees,
  normalizeLuckyWheelConfig,
  targetWheelRotation,
} from "./wheel";

describe("normalizeLuckyWheelConfig", () => {
  it("luôn tạo đúng 6 ô và ít nhất 1 điểm", () => {
    const config = normalizeLuckyWheelConfig({
      requiredPoints: 0,
      slots: [{ label: " Quà VIP ", active: true }],
    });

    expect(config.requiredPoints).toBe(1);
    expect(config.slots).toHaveLength(6);
    expect(config.slots[0]).toEqual({ label: "Quà VIP", active: true, type: "reward" });
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

  it("nhận diện ô không trúng cũ mà không tạo nhầm quà", () => {
    const config = normalizeLuckyWheelConfig({
      slots: [{ label: "Chúc bạn may mắn lần sau", active: true }],
    });

    expect(config.slots[0].type).toBe("no_prize");
  });
});

describe("targetWheelRotation", () => {
  it.each([
    { selectedIndex: 0, slotCount: 6 },
    { selectedIndex: 5, slotCount: 6 },
    { selectedIndex: 1, slotCount: 2 },
    { selectedIndex: 2, slotCount: 4 },
  ])(
    "đưa chính giữa ô $selectedIndex/$slotCount tới kim ở đỉnh",
    ({ selectedIndex, slotCount }) => {
      const rotation = targetWheelRotation(0, selectedIndex, slotCount);
      const slice = 360 / slotCount;
      const selectedCenter = selectedIndex * slice + slice / 2;

      expect(normalizeDegrees(selectedCenter + rotation)).toBeCloseTo(0, 8);
      expect(rotation).toBeGreaterThanOrEqual(6 * 360);
    },
  );

  it("quay liên tiếp luôn tiến tới và vẫn dừng đúng giữa ô backend chọn", () => {
    const first = targetWheelRotation(0, 1, 6);
    const second = targetWheelRotation(first, 4, 6);
    const third = targetWheelRotation(second, 1, 6);

    expect(second).toBeGreaterThan(first);
    expect(third).toBeGreaterThan(second);
    expect(normalizeDegrees(1 * 60 + 30 + first)).toBeCloseTo(0, 8);
    expect(normalizeDegrees(4 * 60 + 30 + second)).toBeCloseTo(0, 8);
    expect(normalizeDegrees(1 * 60 + 30 + third)).toBeCloseTo(0, 8);
  });

  it("tạo timeline 5–7 giây với quãng đường giảm rõ ở các pha cuối", () => {
    const plan = createWheelAnimationPlan(0, targetWheelRotation(0, 3, 6));
    const distances = plan.angles.slice(1).map((angle, index) => angle - plan.angles[index]);

    expect(WHEEL_ANIMATION_DURATION_MS).toBeGreaterThanOrEqual(5_000);
    expect(WHEEL_ANIMATION_DURATION_MS).toBeLessThanOrEqual(7_000);
    expect(plan.offsets).toEqual([0, 0.07, 0.48, 0.7, 0.84, 0.94, 1]);
    expect(distances[1]).toBeGreaterThan(distances[2]);
    expect(distances[2]).toBeGreaterThan(distances[3]);
    expect(distances[3]).toBeGreaterThan(distances[4]);
    expect(distances[4]).toBeGreaterThan(distances[5]);
  });
});
