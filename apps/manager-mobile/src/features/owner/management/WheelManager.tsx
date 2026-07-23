import { Save, SlidersHorizontal } from "lucide-react";
import { useEffect, useState } from "react";
import { InlineFeedback, LoadingState } from "../../../components/Feedback";
import { Section } from "../../../components/ScreenPrimitives";
import {
  defaultLuckyWheelConfig,
  getLuckyWheelConfig,
  saveLuckyWheelConfig,
  type LuckyWheelConfig,
} from "../../../services/managerApi";
import { trackEvent, withMonitoringTrace } from "../../../services/monitoring";

export function WheelManager({ salonId }: { salonId: string }) {
  const [config, setConfig] = useState<LuckyWheelConfig>(defaultLuckyWheelConfig);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    void getLuckyWheelConfig(salonId)
      .then(setConfig)
      .catch((caught) =>
        setError(caught instanceof Error ? caught.message : "Không tải được vòng quay."),
      )
      .finally(() => setLoading(false));
  }, [salonId]);

  function updateSlot(
    index: number,
    patch: Partial<LuckyWheelConfig["slots"][number]>,
  ) {
    setConfig((current) => ({
      ...current,
      slots: current.slots.map((slot, slotIndex) =>
        slotIndex === index ? { ...slot, ...patch } : slot,
      ),
    }));
  }

  async function save() {
    setSaving(true);
    setMessage("");
    setError("");
    try {
      await withMonitoringTrace(
        "owner_save_wheel_config",
        () => saveLuckyWheelConfig(salonId, config),
        {
          salon_id: salonId,
          active_slots: config.slots.filter((slot) => slot.active).length,
        },
      );
      trackEvent("owner_wheel_config_saved", {
        salon_id: salonId,
        required_points: config.requiredPoints,
      });
      setMessage("Đã lưu cấu hình vòng quay.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không lưu được vòng quay.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <LoadingState label="Đang tải vòng quay" />;

  return (
    <div className="manager-subscreen">
      <div className="manager-section-heading">
        <div>
          <h2>Vòng quay</h2>
          <p>Điểm cần quay, hạn mã quà và nội dung từng ô.</p>
        </div>
        <SlidersHorizontal aria-hidden="true" />
      </div>
      <Section title="Quy tắc quay">
        <div className="manager-two-columns">
          <label className="manager-field">
            <span>Số điểm cần quay</span>
            <input
              type="number"
              min={1}
              max={10000}
              value={config.requiredPoints}
              onChange={(event) =>
                setConfig((current) => ({
                  ...current,
                  requiredPoints: Math.min(10_000, Math.max(1, Number(event.target.value || 1))),
                }))
              }
            />
          </label>
          <label className="manager-field">
            <span>Hạn mã quà (ngày)</span>
            <input
              type="number"
              min={1}
              max={365}
              value={config.rewardValidityDays}
              onChange={(event) =>
                setConfig((current) => ({
                  ...current,
                  rewardValidityDays: Math.min(365, Math.max(1, Number(event.target.value || 1))),
                }))
              }
            />
          </label>
        </div>
        <label className="manager-toggle">
          <input
            type="checkbox"
            checked={config.deductPointsAfterSpin}
            onChange={(event) =>
              setConfig((current) => ({
                ...current,
                deductPointsAfterSpin: event.target.checked,
              }))
            }
          />
          <span>Trừ điểm sau khi khách quay</span>
        </label>
      </Section>

      <Section title="Nội dung các ô" description="Tắt ô không muốn xuất hiện trên vòng quay.">
        <div className="manager-wheel-slots">
          {config.slots.map((slot, index) => (
            <fieldset key={index}>
              <legend>Ô {index + 1}</legend>
              <label className="manager-field">
                <span>Nội dung</span>
                <input
                  maxLength={60}
                  value={slot.label}
                  onChange={(event) => updateSlot(index, { label: event.target.value })}
                />
              </label>
              <div className="manager-two-columns">
                <label className="manager-field">
                  <span>Loại ô</span>
                  <select
                    value={slot.type}
                    onChange={(event) =>
                      updateSlot(index, {
                        type: event.target.value === "no_prize" ? "no_prize" : "reward",
                      })
                    }
                  >
                    <option value="reward">Có quà</option>
                    <option value="no_prize">Không trúng</option>
                  </select>
                </label>
                <label className="manager-toggle inline">
                  <input
                    type="checkbox"
                    checked={slot.active}
                    onChange={(event) => updateSlot(index, { active: event.target.checked })}
                  />
                  <span>Đang bật</span>
                </label>
              </div>
            </fieldset>
          ))}
        </div>
      </Section>

      <button
        className="manager-button primary wide sticky-action"
        type="button"
        disabled={saving}
        onClick={() => void save()}
      >
        <Save aria-hidden="true" />
        {saving ? "Đang lưu..." : "Lưu vòng quay"}
      </button>
      {message ? <InlineFeedback tone="success">{message}</InlineFeedback> : null}
      {error ? <InlineFeedback tone="error">{error}</InlineFeedback> : null}
    </div>
  );
}
