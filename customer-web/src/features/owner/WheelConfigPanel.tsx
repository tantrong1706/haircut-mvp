import { Save, Settings2 } from "lucide-react";
import type { LuckyWheelConfig } from "../../services/types";
export function WheelConfigPanel({
  config,
  saving,
  onChange,
  onSave,
}: {
  config: LuckyWheelConfig;
  saving: boolean;
  onChange: (config: LuckyWheelConfig) => void;
  onSave: () => void;
}) {
  function updateSlot(index: number, label: string) {
    onChange({
      ...config,
      slots: config.slots.map((slot, slotIndex) =>
        slotIndex === index ? { ...slot, label } : slot,
      ),
    });
  }

  function toggleSlot(index: number, active: boolean) {
    onChange({
      ...config,
      slots: config.slots.map((slot, slotIndex) =>
        slotIndex === index ? { ...slot, active } : slot,
      ),
    });
  }

  function updateSlotType(index: number, type: "reward" | "no_prize") {
    onChange({
      ...config,
      slots: config.slots.map((slot, slotIndex) =>
        slotIndex === index ? { ...slot, type } : slot,
      ),
    });
  }

  function updateSlotWeight(index: number, weight: number) {
    onChange({
      ...config,
      slots: config.slots.map((slot, slotIndex) =>
        slotIndex === index
          ? { ...slot, weight: Math.min(1_000_000, Math.max(1, Math.floor(weight || 1))) }
          : slot,
      ),
    });
  }

  return (
    <div className="panel">
      <div className="detail-stack">
        <div className="section-heading">
          <Settings2 size={22} aria-hidden="true" />
          <div>
            <h2>Cấu hình vòng quay</h2>
            <p className="muted">
              Chủ salon có thể đổi điểm cần quay, nội dung và trọng số xác suất từng ô.
            </p>
          </div>
        </div>

        <label className="field">
          <span>Số điểm cần để quay</span>
          <input
            type="number"
            min={1}
            max={10000}
            value={config.requiredPoints}
            onChange={(event) =>
              onChange({
                ...config,
                requiredPoints: Math.min(10_000, Math.max(1, Number(event.target.value || 1))),
              })
            }
          />
        </label>

        <label className="field">
          <span>Hạn dùng mã quà (ngày)</span>
          <input
            type="number"
            min={1}
            max={365}
            value={config.rewardValidityDays}
            onChange={(event) =>
              onChange({
                ...config,
                rewardValidityDays: Math.min(365, Math.max(1, Number(event.target.value || 1))),
              })
            }
          />
        </label>

        <label className="toggle-row">
          <input
            type="checkbox"
            checked={config.deductPointsAfterSpin}
            onChange={(event) =>
              onChange({ ...config, deductPointsAfterSpin: event.target.checked })
            }
          />
          <span>Trừ điểm sau khi khách quay</span>
        </label>

        <div className="wheel-config-list" aria-label="Danh sách ô vòng quay">
          {config.slots.map((slot, index) => (
            <div className="wheel-slot-row" key={slot.slotId}>
              <span>{index + 1}</span>
              <label className="field wheel-slot-name">
                <span>Tên ô</span>
                <input
                  aria-label={`Tên ô ${index + 1}`}
                  value={slot.label}
                  maxLength={60}
                  onChange={(event) => updateSlot(index, event.target.value)}
                  placeholder={`Ô ${index + 1}`}
                />
              </label>
              <label className="field">
                <span>Loại ô</span>
                <select
                  aria-label={`Loại ô ${index + 1}`}
                  value={slot.type}
                  onChange={(event) =>
                    updateSlotType(index, event.target.value === "no_prize" ? "no_prize" : "reward")
                  }
                >
                  <option value="reward">Có quà</option>
                  <option value="no_prize">Không trúng</option>
                </select>
              </label>
              <label className="field">
                <span>Trọng số</span>
                <input
                  aria-label={`Trọng số ô ${index + 1}`}
                  type="number"
                  min={1}
                  max={1_000_000}
                  value={slot.weight}
                  onChange={(event) => updateSlotWeight(index, Number(event.target.value || 1))}
                />
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={slot.active}
                  onChange={(event) => toggleSlot(index, event.target.checked)}
                />
                Bật
              </label>
            </div>
          ))}
        </div>

        <button className="primary-button" disabled={saving} onClick={onSave}>
          {saving ? (
            "Đang lưu..."
          ) : (
            <>
              <Save size={20} aria-hidden="true" />
              Lưu vòng quay
            </>
          )}
        </button>
      </div>
    </div>
  );
}
