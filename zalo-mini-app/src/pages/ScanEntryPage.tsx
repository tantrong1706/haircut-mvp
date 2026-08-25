import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  Camera,
  CheckCircle2,
  ChevronDown,
  MessageCircle,
  Phone,
  QrCode,
  RefreshCcw,
  Scissors,
  UserRound,
} from "lucide-react";
import { BrandLogo } from "../components/BrandLogo";
import { MINI_APP_NAME } from "../config/branding";
import {
  CustomerQrResolution,
  buildRegisterInput,
  registerCustomer,
  resolveCustomerQr,
} from "../services/api";
import { captureError, trackEvent, withMonitoringTrace } from "../services/monitoring";
import { hasQrContext, parseQrContext } from "../services/qr";
import { isZaloMiniAppRuntime } from "../services/runtime";
import type { AppSession } from "../services/types";
import {
  getZaloIdentity,
  isZaloProfilePermissionError,
  isZaloProfileRetryableError,
  openZaloProfilePermissionSettings,
} from "../services/zalo";

type Props = {
  onReady: (session: AppSession) => void;
  onOpenLegalPage?: (page: "privacy" | "terms") => void;
};

export function ScanEntryPage({ onReady, onOpenLegalPage }: Props) {
  const [allowPhoto, setAllowPhoto] = useState(false);
  const [phone, setPhone] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [zaloAvatarUrl, setZaloAvatarUrl] = useState("");
  const [salonAvatarFailed, setSalonAvatarFailed] = useState(false);
  const [loadingIdentity, setLoadingIdentity] = useState(true);
  const [loadingQr, setLoadingQr] = useState(true);
  const [qrResolution, setQrResolution] = useState<CustomerQrResolution | null>(null);
  const [selectedBranchId, setSelectedBranchId] = useState("");
  const [qrError, setQrError] = useState("");
  const [zaloRequired, setZaloRequired] = useState(false);
  const [loading, setLoading] = useState(false);
  const [permissionSettingsRequired, setPermissionSettingsRequired] = useState(false);
  const [identityRetryRequired, setIdentityRetryRequired] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mountedRef = useRef(false);

  const qr = useMemo(() => parseQrContext(), []);
  const hasQr = useMemo(() => hasQrContext(qr), [qr]);
  const isZaloRuntime = useMemo(() => isZaloMiniAppRuntime(), []);
  const selectedBranch = qrResolution?.branches.find((branch) => branch.id === selectedBranchId);
  const checkinUnavailable =
    qrResolution?.features?.maintenanceMode === true ||
    qrResolution?.features?.checkinEnabled === false;

  useEffect(() => {
    if (!hasQr) {
      setLoadingQr(false);
      return;
    }

    let cancelled = false;
    setLoadingQr(true);
    setQrError("");
    resolveCustomerQr(qr)
      .then((resolution) => {
        if (cancelled) {
          return;
        }
        setQrResolution(resolution);
        setSalonAvatarFailed(false);
        setSelectedBranchId(resolution.branchId || "");
      })
      .catch((err) => {
        if (!cancelled) {
          setQrError(err instanceof Error ? err.message : "Không xác minh được QR");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingQr(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [hasQr, qr]);

  useEffect(() => {
    mountedRef.current = true;

    if (!hasQr) {
      setLoadingIdentity(false);

      return () => {
        mountedRef.current = false;
      };
    }

    if (!isZaloRuntime) {
      setLoadingIdentity(false);
      setZaloRequired(true);

      return () => {
        mountedRef.current = false;
      };
    }

    loadZaloIdentity();

    return () => {
      mountedRef.current = false;
    };
  }, [hasQr, isZaloRuntime]);

  function loadZaloIdentity(requestProfilePermission = false) {
    if (!isZaloRuntime) {
      setLoadingIdentity(false);
      setZaloRequired(true);
      setError(null);
      return;
    }

    setLoadingIdentity(true);
    setZaloRequired(false);
    setError(null);
    if (requestProfilePermission) {
      setPermissionSettingsRequired(false);
    }

    getZaloIdentity({ requestProfilePermission })
      .then((nextIdentity) => {
        if (!mountedRef.current) {
          return;
        }

        const nextDisplayName = normalizeDisplayName(nextIdentity.name);
        if (!nextDisplayName) {
          setIdentityRetryRequired(false);
          throw new Error("Chưa nhận được tên Zalo. Vui lòng cho phép đọc hồ sơ rồi thử lại.");
        }

        setDisplayName(nextDisplayName);
        setZaloAvatarUrl(nextIdentity.avatar || "");
        setIdentityRetryRequired(false);
        setPermissionSettingsRequired(false);
      })
      .catch((err) => {
        captureError(err, {
          area: "zalo_identity",
          salon_id: qr.salonId,
          branch_id: selectedBranchId,
        });

        if (mountedRef.current) {
          if (isZaloProfilePermissionError(err)) {
            setPermissionSettingsRequired(true);
            setIdentityRetryRequired(false);
          } else if (isZaloProfileRetryableError(err)) {
            setPermissionSettingsRequired(false);
            setIdentityRetryRequired(true);
          }
          setZaloRequired(true);
          setError(
            err instanceof Error
              ? err.message
              : `Vui lòng mở ${MINI_APP_NAME} trong Zalo để xác nhận danh tính.`,
          );
        }
      })
      .finally(() => {
        if (mountedRef.current) {
          setLoadingIdentity(false);
        }
      });
  }

  function openProfilePermissionSettings() {
    setLoadingIdentity(true);
    setError(null);

    openZaloProfilePermissionSettings()
      .then(() => {
        if (mountedRef.current) {
          loadZaloIdentity(false);
        }
      })
      .catch((err) => {
        captureError(err, {
          area: "zalo_profile_permission_settings",
          salon_id: qr.salonId,
          branch_id: selectedBranchId,
        });

        if (mountedRef.current) {
          setError(
            err instanceof Error
              ? err.message
              : "Không mở được cài đặt quyền Zalo. Vui lòng thử lại.",
          );
          setLoadingIdentity(false);
        }
      });
  }

  async function continueWithZalo() {
    const confirmedName = normalizeDisplayName(displayName);

    if (checkinUnavailable) {
      setError(
        qrResolution?.features?.maintenanceMode
          ? "Hệ thống đang bảo trì. Vui lòng thử lại sau."
          : "Salon đang tạm ngừng nhận lượt check-in mới.",
      );
      return;
    }

    if (!confirmedName) {
      setError("Vui lòng nhập tên hiển thị tại salon để nhân viên dễ nhận khách.");
      return;
    }
    if (!qrResolution || !selectedBranchId || !selectedBranch) {
      setError("Vui lòng chọn một chi nhánh đang hoạt động.");
      return;
    }

    setLoading(true);
    setError(null);

    trackEvent("customer_checkin_started", {
      salon_id: qr.salonId,
      branch_id: selectedBranchId,
      has_phone: Boolean(phone.trim()),
      allow_photo: allowPhoto,
    });

    try {
      /*
       * Luôn lấy access token mới ngay khi khách
       * bấm tạo lượt cắt, không dùng token cũ.
       */
      const confirmedIdentity = await getZaloIdentity({ requestProfilePermission: false });

      const session = await withMonitoringTrace(
        "customer_checkin",
        () =>
          registerCustomer(
            buildRegisterInput(
              { ...qr, branchId: selectedBranchId },
              {
                ...confirmedIdentity,
                name: confirmedName,
              },
              allowPhoto,
              phone || undefined,
              undefined,
            ),
          ),
        {
          salon_id: qr.salonId,
          branch_id: selectedBranchId,
        },
      );

      trackEvent("customer_checkin_created", {
        salon_id: qr.salonId,
        branch_id: selectedBranchId,
        session_status: session.sessionStatus,
      });

      onReady(session);
    } catch (err) {
      captureError(err, {
        area: "customer_checkin",
        salon_id: qr.salonId,
        branch_id: selectedBranchId,
      });

      setError(err instanceof Error ? err.message : "Không thể tạo hồ sơ khách");
    } finally {
      setLoading(false);
    }
  }

  if (!hasQr) {
    return (
      <section className="entry-page">
        <header className="entry-hero premium-hero visual-hero">
          <div className="hero-topline">
            <BrandLogo />
            <span className="soft-chip">{MINI_APP_NAME}</span>
          </div>

          <p className="eyebrow">Check-in</p>
          <h1>Quét QR tại salon</h1>

          <p className="muted">Khách cần quét QR chung của salon hoặc QR tại chi nhánh.</p>
        </header>

        <div className="panel missing-qr-panel">
          <QrCode size={38} aria-hidden="true" />

          <div>
            <h2>Cần QR của salon</h2>

            <p className="muted">
              QR giúp {MINI_APP_NAME} xác định đúng salon và chi nhánh. Hãy quét QR do salon cung
              cấp rồi mở lại ứng dụng.
            </p>
          </div>
        </div>

        {isZaloRuntime ? (
          <nav className="entry-help-links" aria-label={`Thông tin ${MINI_APP_NAME}`}>
            <a
              href="#privacy"
              onClick={(event) => {
                if (onOpenLegalPage) {
                  event.preventDefault();
                  onOpenLegalPage("privacy");
                }
              }}
            >
              Chính sách quyền riêng tư
            </a>
            <a
              href="#terms"
              onClick={(event) => {
                if (onOpenLegalPage) {
                  event.preventDefault();
                  onOpenLegalPage("terms");
                }
              }}
            >
              Điều khoản sử dụng
            </a>
          </nav>
        ) : (
          <div className="quick-actions">
            <button type="button" onClick={() => window.location.assign("/owner")}>
              <span>
                <ArrowRight size={20} aria-hidden="true" />
              </span>

              <div>
                <strong>Trang chủ salon</strong>
                <small>Quản lý chi nhánh, nhân viên và QR</small>
              </div>
            </button>

            <button type="button" onClick={() => window.location.assign("/staff")}>
              <span>
                <Scissors size={20} aria-hidden="true" />
              </span>

              <div>
                <strong>Trang nhân viên</strong>
                <small>Xem khách đang chờ và đổi mã quà</small>
              </div>
            </button>
          </div>
        )}
      </section>
    );
  }

  return (
    <section className="entry-page">
      <header className="entry-hero premium-hero visual-hero">
        <div className="hero-topline">
          <BrandLogo />

          <span className="soft-chip">
            {selectedBranch?.name || qrResolution?.salonName || "Đang xác minh"}
          </span>
        </div>

        <p className="eyebrow">Check-in</p>
        <h1>{qrResolution?.salonName || MINI_APP_NAME}</h1>

        <p className="muted">Xác nhận để salon nhận đúng khách và cộng điểm sau khi cắt.</p>
      </header>

      <section className="panel salon-identity-card" aria-live="polite">
        <div className="salon-identity-avatar">
          {loadingQr ? (
            <span className="salon-avatar-placeholder" aria-hidden="true" />
          ) : qrResolution?.salonAvatarUrl && !salonAvatarFailed ? (
            <img
              src={qrResolution.salonAvatarUrl}
              alt={`Ảnh đại diện ${qrResolution.salonName}`}
              onError={() => setSalonAvatarFailed(true)}
            />
          ) : (
            <BrandLogo />
          )}
        </div>

        <div className="salon-identity-copy">
          <span>Salon phục vụ</span>
          <h2>{loadingQr ? "Đang xác minh salon..." : qrResolution?.salonName || MINI_APP_NAME}</h2>
          <strong>
            {loadingQr
              ? "Đang tải chi nhánh"
              : selectedBranch?.name ||
                (qrResolution?.selectionRequired ? "Chọn chi nhánh bên dưới" : "Chi nhánh")}
          </strong>
          {!loadingQr && selectedBranch?.address ? <small>{selectedBranch.address}</small> : null}
        </div>
      </section>

      {zaloRequired ? (
        <div className="panel zalo-required-card">
          <MessageCircle size={34} aria-hidden="true" />

          <div>
            <h2>{isZaloRuntime ? "Chưa nhận được thông tin Zalo" : "Cần mở trong Zalo"}</h2>

            <p className="muted">
              {isZaloRuntime
                ? `Cho phép ${MINI_APP_NAME} đọc tên hiển thị để salon nhận đúng khách.`
                : `${MINI_APP_NAME} cần mở trong Zalo để xác nhận danh tính trước khi tạo lượt cắt.`}
            </p>
          </div>

          <div className="button-row wrap-row">
            {!isZaloRuntime && zaloOpenUrl(qr) ? (
              <button
                className="primary-button"
                onClick={() => window.location.assign(zaloOpenUrl(qr))}
              >
                <MessageCircle size={20} aria-hidden="true" />
                Mở trong Zalo
              </button>
            ) : null}

            {isZaloRuntime ? (
              <button
                className="secondary-button"
                onClick={
                  permissionSettingsRequired
                    ? openProfilePermissionSettings
                    : identityRetryRequired
                      ? () => loadZaloIdentity(false)
                      : () => loadZaloIdentity(true)
                }
                disabled={loadingIdentity}
              >
                <RefreshCcw size={18} aria-hidden="true" />
                {loadingIdentity
                  ? "Đang kiểm tra quyền..."
                  : permissionSettingsRequired
                    ? "Mở cài đặt quyền Zalo"
                    : identityRetryRequired
                      ? "Thử lại"
                      : "Cho phép đọc tên Zalo"}
              </button>
            ) : null}
          </div>

          {error ? <p className="alert error">{error}</p> : null}
        </div>
      ) : null}

      {!zaloRequired ? (
        <>
          <div className="mirror-card">
            <div className="mirror-visual">
              <Scissors size={34} aria-hidden="true" />
            </div>

            <div>
              <span>Chi nhánh phục vụ</span>

              {loadingQr ? <strong>Đang xác minh QR...</strong> : null}
              {!loadingQr && qrResolution?.selectionRequired ? (
                <label className="field compact-field">
                  <span>Chọn chi nhánh</span>
                  <select
                    value={selectedBranchId}
                    onChange={(event) => setSelectedBranchId(event.target.value)}
                    disabled={loading}
                  >
                    <option value="">Chọn nơi bạn đang có mặt</option>
                    {qrResolution.branches.map((branch) => (
                      <option key={branch.id} value={branch.id}>
                        {branch.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              {selectedBranch ? (
                <>
                  <strong>{selectedBranch.name}</strong>
                  <small>{selectedBranch.address || "Địa chỉ do salon xác nhận"}</small>
                </>
              ) : null}
              {!loadingQr && qrResolution && qrResolution.branches.length === 0 ? (
                <small>Salon chưa có chi nhánh đang hoạt động.</small>
              ) : null}
            </div>
          </div>

          {qrError ? <p className="alert error">{qrError}</p> : null}
          {checkinUnavailable ? (
            <p className="alert error" role="status">
              {qrResolution?.features?.maintenanceMode
                ? "Hệ thống đang bảo trì. Vui lòng thử lại sau."
                : "Salon đang tạm ngừng nhận lượt check-in mới."}
            </p>
          ) : null}

          <div className="panel zalo-profile-card" aria-live="polite">
            <div className="zalo-profile-avatar" aria-hidden="true">
              {zaloAvatarUrl ? (
                <img src={zaloAvatarUrl} alt="" referrerPolicy="no-referrer" />
              ) : (
                <UserRound />
              )}
            </div>

            <div className="zalo-profile-copy">
              <span>Thông tin từ Zalo</span>
              <strong>{loadingIdentity ? "Đang nhận thông tin..." : displayName}</strong>
              <small>Salon sẽ dùng tên này để nhận đúng khách.</small>
            </div>

            {!loadingIdentity && displayName ? (
              <CheckCircle2
                className="zalo-profile-ready"
                size={24}
                aria-label="Đã nhận thông tin"
              />
            ) : null}
          </div>

          <details className="panel entry-options" open>
            <summary>
              <span>
                <strong>Thông tin tùy chọn</strong>
                <small>Sửa tên, thêm số điện thoại hoặc đồng ý lưu ảnh</small>
              </span>
              <ChevronDown size={20} aria-hidden="true" />
            </summary>

            <div className="entry-options-content">
              <label className="field">
                <span>
                  <UserRound size={18} aria-hidden="true" />
                  Tên hiển thị tại salon
                </span>

                <input
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  placeholder={loadingIdentity ? "Đang lấy tên Zalo..." : "Ví dụ: Anh Tân"}
                  disabled={loading}
                />
              </label>

              <label className="field">
                <span>
                  <Phone size={18} aria-hidden="true" />
                  Số điện thoại
                </span>

                <input
                  inputMode="tel"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder="Nhập nếu bạn muốn salon liên hệ"
                  disabled={loading}
                />

                <small>Không bắt buộc; nhân viên chỉ thấy 4 số cuối.</small>
              </label>

              <label className="toggle-row photo-consent">
                <input
                  type="checkbox"
                  checked={allowPhoto}
                  onChange={(event) => setAllowPhoto(event.target.checked)}
                  disabled={loading || qrResolution?.features?.photoUploadEnabled === false}
                />

                <Camera size={18} aria-hidden="true" />

                <span>Đồng ý lưu ảnh kiểu tóc cho lần sau</span>
              </label>

              <p className="field-note">Dữ liệu chỉ dùng để phục vụ bạn tại salon này.</p>
            </div>
          </details>

          {error ? <p className="alert error">{error}</p> : null}

          <button
            className="primary-button"
            disabled={
              loading ||
              loadingQr ||
              loadingIdentity ||
              !selectedBranchId ||
              checkinUnavailable ||
              Boolean(qrError) ||
              displayName.trim().length === 0
            }
            onClick={continueWithZalo}
          >
            {loading ? (
              "Đang tạo lượt..."
            ) : (
              <>
                <CheckCircle2 size={20} aria-hidden="true" />
                Xác nhận vào hàng chờ
              </>
            )}
          </button>
        </>
      ) : null}
    </section>
  );
}

function normalizeDisplayName(name: string) {
  return name.replace(/\s+/g, " ").trim();
}

function zaloOpenUrl(qr: ReturnType<typeof parseQrContext>) {
  /*
   * Trong bản Development không tự chuyển về
   * link production vì Zalo sẽ báo ứng dụng
   * đang trong giai đoạn phát triển.
   */
  if (import.meta.env.VITE_ZALO_PREVIEW === "true") {
    return "";
  }

  const miniAppId = String(import.meta.env.VITE_ZALO_MINI_APP_ID || "").trim();

  if (!miniAppId) {
    return "";
  }

  if (!qr.qrToken) {
    return "";
  }

  const params = new URLSearchParams({
    qrType: qr.qrType,
    salonId: qr.salonId,
    qrToken: qr.qrToken,
  });
  if (qr.branchId) {
    params.set("branchId", qr.branchId);
  }
  if (qr.mirrorId) {
    params.set("mirrorId", qr.mirrorId);
  }

  return `https://zalo.me/s/${miniAppId}?${params.toString()}`;
}
