import { useEffect, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  ImageOff,
  RefreshCcw,
  Scissors,
  X,
} from "lucide-react";
import { getHaircutHistory } from "../services/api";
import { AppSession, HaircutRecord } from "../services/types";

type Props = { session: AppSession };

export function HistoryPage({ session }: Props) {
  const [records, setRecords] = useState<HaircutRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [loadVersion, setLoadVersion] = useState(0);
  const [selectedRecord, setSelectedRecord] = useState<HaircutRecord | null>(null);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const lastTriggerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    getHaircutHistory(session)
      .then((nextRecords) => {
        if (!cancelled) setRecords(nextRecords);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Không tải được lịch sử cắt tóc");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [loadVersion, session]);

  useEffect(() => {
    if (!selectedRecord) return;
    closeButtonRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeDetails();
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [selectedRecord]);

  function openDetails(record: HaircutRecord, trigger: HTMLButtonElement) {
    lastTriggerRef.current = trigger;
    setSelectedPhotoIndex(0);
    setSelectedRecord(record);
  }

  function closeDetails() {
    setSelectedRecord(null);
    window.setTimeout(() => lastTriggerRef.current?.focus(), 0);
  }

  function movePhoto(direction: -1 | 1) {
    if (!selectedRecord?.photoUrls.length) return;
    setSelectedPhotoIndex(
      (current) =>
        (current + direction + selectedRecord.photoUrls.length) % selectedRecord.photoUrls.length,
    );
  }

  return (
    <section className="page history-page">
      <header className="page-header">
        <p className="eyebrow">Hồ sơ khách</p>
        <h1>Lịch sử cắt tóc</h1>
      </header>

      <div className="list">
        {loading ? (
          <div className="empty-state">
            <Scissors size={28} aria-hidden="true" />
            <strong>Đang tải lịch sử</strong>
            <p>Vui lòng chờ trong giây lát.</p>
          </div>
        ) : error ? (
          <div className="alert error retry-alert">
            <span>{error}</span>
            <button type="button" onClick={() => setLoadVersion((value) => value + 1)}>
              <RefreshCcw size={16} aria-hidden="true" />
              Thử lại
            </button>
          </div>
        ) : records.length === 0 ? (
          <div className="empty-state">
            <ClipboardList size={30} aria-hidden="true" />
            <strong>Chưa có lịch sử cắt tóc</strong>
            <p>Sau khi chủ salon duyệt điểm, ghi chú kiểu tóc sẽ xuất hiện tại đây.</p>
          </div>
        ) : (
          records.map((record) => (
            <button
              className="list-item history-record-button"
              key={record.id}
              type="button"
              aria-label={`Xem chi tiết lần cắt ${record.createdAt || "chưa có ngày"}`}
              onClick={(event) => openDetails(record, event.currentTarget)}
            >
              {record.photoUrls.length > 0 ? (
                <span className="history-thumbnail">
                  <img
                    src={record.photoUrls[0]}
                    alt={`Ảnh đại diện lần cắt ${record.createdAt || "chưa có ngày"}`}
                    loading="lazy"
                  />
                  {record.photoUrls.length > 1 ? (
                    <span
                      className="history-photo-count"
                      aria-label={`Còn ${record.photoUrls.length - 1} ảnh`}
                    >
                      +{record.photoUrls.length - 1}
                    </span>
                  ) : null}
                </span>
              ) : (
                <span
                  className="history-thumbnail history-thumbnail-empty"
                  aria-label="Không có ảnh"
                >
                  <ImageOff size={22} aria-hidden="true" />
                </span>
              )}
              <span className="history-record-content">
                <strong>{record.createdAt || "Chưa có ngày"}</strong>
                <span>{record.note || "Không có ghi chú kiểu tóc"}</span>
                <small>Nhân viên: {record.staffName || "Chưa rõ"}</small>
              </span>
              <span className="history-record-aside">
                <span className="pill">+{record.pointsAdded}</span>
                <ChevronRight size={18} aria-hidden="true" />
              </span>
            </button>
          ))
        )}
      </div>

      {selectedRecord ? (
        <div
          className="dialog-backdrop history-detail-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeDetails();
          }}
        >
          <article
            className="history-detail-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="history-detail-title"
          >
            <button
              ref={closeButtonRef}
              className="dialog-close"
              type="button"
              aria-label="Đóng chi tiết"
              onClick={closeDetails}
            >
              <X size={18} aria-hidden="true" />
            </button>
            <header>
              <p className="eyebrow">Hồ sơ lần cắt</p>
              <h2 id="history-detail-title">Chi tiết lần cắt</h2>
              <strong>{selectedRecord.createdAt || "Chưa có ngày"}</strong>
            </header>

            <dl className="history-detail-fields">
              {selectedRecord.salonName ? (
                <div>
                  <dt>Salon</dt>
                  <dd>{selectedRecord.salonName}</dd>
                </div>
              ) : null}
              {selectedRecord.branchName ? (
                <div>
                  <dt>Chi nhánh</dt>
                  <dd>{selectedRecord.branchName}</dd>
                </div>
              ) : null}
              {selectedRecord.staffName ? (
                <div>
                  <dt>Nhân viên</dt>
                  <dd>{selectedRecord.staffName}</dd>
                </div>
              ) : null}
              {selectedRecord.serviceName ? (
                <div>
                  <dt>Dịch vụ</dt>
                  <dd>{selectedRecord.serviceName}</dd>
                </div>
              ) : null}
              {selectedRecord.rewardName ? (
                <div>
                  <dt>Phần thưởng</dt>
                  <dd>{selectedRecord.rewardName}</dd>
                </div>
              ) : null}
              <div>
                <dt>Điểm cộng</dt>
                <dd>+{selectedRecord.pointsAdded}</dd>
              </div>
              <div className="history-detail-note">
                <dt>Ghi chú</dt>
                <dd>{selectedRecord.note || "Không có ghi chú kiểu tóc"}</dd>
              </div>
            </dl>

            <section className="history-detail-photos" aria-label="Ảnh lần cắt">
              <h3>Ảnh kiểu tóc</h3>
              {selectedRecord.photoUrls.length > 0 ? (
                <>
                  <div className="history-photo-viewer">
                    <img
                      src={selectedRecord.photoUrls[selectedPhotoIndex]}
                      alt={`Ảnh lớn ${selectedPhotoIndex + 1} trong ${selectedRecord.photoUrls.length}`}
                    />
                    {selectedRecord.photoUrls.length > 1 ? (
                      <>
                        <button type="button" aria-label="Ảnh trước" onClick={() => movePhoto(-1)}>
                          <ChevronLeft size={22} aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          aria-label="Ảnh tiếp theo"
                          onClick={() => movePhoto(1)}
                        >
                          <ChevronRight size={22} aria-hidden="true" />
                        </button>
                        <span>
                          {selectedPhotoIndex + 1}/{selectedRecord.photoUrls.length}
                        </span>
                      </>
                    ) : null}
                  </div>
                  {selectedRecord.photoUrls.length > 1 ? (
                    <div className="history-photo-thumbnails" aria-label="Chọn ảnh">
                      {selectedRecord.photoUrls.map((photoUrl, index) => (
                        <button
                          type="button"
                          className={index === selectedPhotoIndex ? "active" : ""}
                          aria-label={`Xem ảnh ${index + 1}`}
                          aria-current={index === selectedPhotoIndex ? "true" : undefined}
                          key={`${photoUrl}-${index}`}
                          onClick={() => setSelectedPhotoIndex(index)}
                        >
                          <img src={photoUrl} alt="" loading="lazy" />
                        </button>
                      ))}
                    </div>
                  ) : null}
                </>
              ) : (
                <div className="history-no-photo">
                  <ImageOff size={26} aria-hidden="true" />
                  <span>Không có ảnh</span>
                </div>
              )}
            </section>

            <button className="secondary-button" type="button" onClick={closeDetails}>
              <ChevronLeft size={18} aria-hidden="true" />
              Quay lại lịch sử
            </button>
          </article>
        </div>
      ) : null}
    </section>
  );
}
