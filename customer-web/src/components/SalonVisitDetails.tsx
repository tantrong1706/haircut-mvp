import { useEffect, useRef, useState } from "react";
import { Camera, FilePenLine, X } from "lucide-react";
import { HaircutPhotoCapture, type PhotoSelectionResult } from "./HaircutPhotoCapture";
import {
  getLatestHaircutDetails,
  updateLatestHaircutDetails,
  type LatestHaircutDetails,
} from "../services/visitDetails";
import { uploadHaircutPhoto } from "../services/customerPhotos";

type Props = { salonId: string; customerId: string; onSaved?: () => void };
export function SalonVisitDetails(props: Props) {
  return <VisitEditor key={`${props.salonId}:${props.customerId}`} {...props} />;
}
function VisitEditor({ salonId, customerId, onSaved }: Props) {
  const [mode, setMode] = useState<"photos" | "note" | null>(null);
  const [visit, setVisit] = useState<LatestHaircutDetails | null>(null);
  const [note, setNote] = useState("");
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const active = useRef(true),
    saving = useRef(false),
    generation = useRef(0);
  const abort = useRef<AbortController | null>(null);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      generation.current++;
      abort.current?.abort();
    };
  }, []);
  async function open(next: "photos" | "note") {
    if (saving.current || loading) return;
    const version = ++generation.current;
    setMode(next);
    setVisit(null);
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const current = await getLatestHaircutDetails({ salonId, customerId });
      if (!active.current || version !== generation.current) return;
      setVisit(current);
      setNote(current.note);
      setConsent(current.photoConsentGranted);
    } catch (err) {
      if (active.current && version === generation.current)
        setError(err instanceof Error ? err.message : "Chưa mở được lượt cắt.");
    } finally {
      if (active.current && version === generation.current) setLoading(false);
    }
  }
  async function saveNote() {
    if (!visit || saving.current) return;
    saving.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await updateLatestHaircutDetails({
        salonId,
        customerId,
        recordId: visit.recordId,
        revision: visit.revision,
        note,
      });
      if (active.current) {
        setVisit({ ...visit, note, revision: result.revision });
        setMessage("Đã lưu ghi chú nội bộ. Điểm không thay đổi.");
        onSaved?.();
      }
    } catch (err) {
      if (active.current) setError(err instanceof Error ? err.message : "Chưa lưu được ghi chú.");
    } finally {
      saving.current = false;
      if (active.current) setBusy(false);
    }
  }
  async function savePhotos(files: File[]): Promise<PhotoSelectionResult> {
    if (!visit || saving.current || !visit.allowPhoto || !consent) return { failedFiles: files };
    saving.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    const controller = new AbortController();
    abort.current = controller;
    let current = visit,
      uploaded = 0;
    try {
      if (!current.photoConsentGranted) {
        const saved = await updateLatestHaircutDetails({
          salonId,
          customerId,
          recordId: current.recordId,
          revision: current.revision,
          photoConsentConfirmed: true,
        });
        current = { ...current, revision: saved.revision, photoConsentGranted: true };
        if (active.current) setVisit(current);
      }
      for (const file of files) {
        if (controller.signal.aborted) throw new Error("Đã dừng tải ảnh.");
        const photo = await uploadHaircutPhoto({
          salonId,
          customerId,
          branchId: current.branchId,
          sessionId: current.sessionId,
          recordId: current.recordId,
          file,
          signal: controller.signal,
        });
        const result = await updateLatestHaircutDetails({
          salonId,
          customerId,
          recordId: current.recordId,
          revision: current.revision,
          addPhotoPaths: [photo.path],
        });
        current = {
          ...current,
          revision: result.revision,
          photoCount: current.photoCount + 1,
          photoUrls: [...current.photoUrls, photo.url],
        };
        uploaded++;
        if (active.current) setVisit(current);
      }
      if (active.current) {
        setMessage("Đã lưu ảnh nội bộ vào lượt cắt. Điểm không thay đổi.");
        onSaved?.();
      }
      return { failedFiles: [] };
    } catch (err) {
      if (active.current) setError(err instanceof Error ? err.message : "Chưa lưu được ảnh.");
      return { failedFiles: files.slice(uploaded) };
    } finally {
      saving.current = false;
      abort.current = null;
      if (active.current) setBusy(false);
    }
  }
  return (
    <section className="salon-visit-details" aria-label="Bổ sung lượt cắt gần nhất">
      <div className="button-row wrap-row">
        <button
          className="secondary-button"
          type="button"
          disabled={busy || loading}
          onClick={() => void open("photos")}
        >
          <Camera size={18} aria-hidden="true" />
          Thêm ảnh
        </button>
        <button
          className="secondary-button"
          type="button"
          disabled={busy || loading}
          onClick={() => void open("note")}
        >
          <FilePenLine size={18} aria-hidden="true" />
          Thêm ghi chú
        </button>
      </div>
      {mode ? (
        <div className="service-state-card">
          <div className="management-card-header">
            <strong>Bổ sung lượt cắt gần nhất</strong>
            <button
              className="secondary-button compact"
              type="button"
              disabled={busy}
              aria-label="Đóng bổ sung lượt cắt"
              onClick={() => {
                generation.current++;
                setMode(null);
                setLoading(false);
              }}
            >
              <X size={18} />
            </button>
          </div>
          <p className="field-note">
            Chỉ chủ salon và nhân viên có quyền xem. Không tạo lượt mới hoặc cộng thêm điểm.
          </p>
          {loading ? <p role="status">Đang mở lượt cắt...</p> : null}
          {visit ? (
            <>
              <p>
                {visit.createdAtMs
                  ? new Date(visit.createdAtMs).toLocaleString("vi-VN")
                  : "Lượt cắt đã hoàn tất"}
              </p>
              {mode === "note" ? (
                <>
                  <label className="field">
                    <span>Ghi chú nội bộ</span>
                    <textarea
                      value={note}
                      maxLength={1000}
                      disabled={busy}
                      onChange={(event) => setNote(event.target.value)}
                    />
                  </label>
                  <button
                    className="primary-button"
                    type="button"
                    disabled={busy}
                    onClick={() => void saveNote()}
                  >
                    {busy ? "Đang lưu..." : "Lưu ghi chú"}
                  </button>
                </>
              ) : (
                <>
                  {!visit.allowPhoto ? (
                    <p className="field-note">
                      Chưa có đồng ý lưu ảnh hoặc khách đã thu hồi. Không tự bật lại quyền lưu ảnh.
                    </p>
                  ) : !visit.photoConsentGranted ? (
                    <label className="checkbox-row">
                      <input
                        type="checkbox"
                        checked={consent}
                        disabled={busy}
                        onChange={(event) => setConsent(event.target.checked)}
                      />
                      Khách đã đồng ý để salon chụp và lưu ảnh cho lượt này
                    </label>
                  ) : null}
                  <HaircutPhotoCapture
                    photos={(visit.allowPhoto ? visit.photoUrls : []).map((url, index) => ({
                      id: String(index),
                      url,
                    }))}
                    consentGranted={visit.allowPhoto && consent}
                    busy={busy}
                    maxPhotos={Math.max(0, 3 - visit.photoCount + visit.photoUrls.length)}
                    onFilesSelected={savePhotos}
                  />
                </>
              )}
            </>
          ) : null}
          {message ? (
            <p role="status" className="alert success">
              {message}
            </p>
          ) : null}
          {error ? (
            <p role="alert" className="alert error">
              {error}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
