import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  ClipboardCheck,
  Copy,
  Download,
  Gift,
  Image as ImageIcon,
  Power,
  Printer,
  QrCode,
  RefreshCcw,
  Save,
  Search,
  Share2,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  TicketCheck,
  Trash2,
  UserPlus,
  UserRound,
  UsersRound,
  XCircle,
} from "lucide-react";
import QRCode from "qrcode";
import { BrandLogo } from "../components/BrandLogo";
import { MINI_APP_NAME } from "../config/branding";
import { AccountDeletionPanel } from "../components/AccountDeletionPanel";
import { HaircutPhotoCapture, type HaircutPhotoItem } from "../components/HaircutPhotoCapture";
import { RedeemRewardPanel } from "../components/RedeemRewardPanel";
import { SalonBrandingPanel } from "../features/owner/branding/SalonBrandingPanel";
import {
  CustomerLookupResult,
  SalonBranch,
  OwnerOverview,
  PointRequest,
  SalonProfile,
  StaffProfile,
  approvePointRequest,
  createBranch,
  createStaffProfile,
  deleteCustomerData,
  formatDateTime,
  getLuckyWheelConfig,
  getBranchQrSettings,
  getOwnerOverview,
  getSalonCustomerDetails,
  getSalonProfile,
  listenStaffProfiles,
  listenPendingPointRequests,
  migrateSalonBranches,
  rejectPointRequest,
  rotateBranchQr,
  rotateSalonQr,
  sendStaffInviteEmail,
  saveLuckyWheelConfig,
  searchSalonCustomers,
  updateBranch,
  updatePendingPointRequestPhotos,
  updateSalonProfile,
  updateStaffProfile,
} from "../services/operations";
import { AppUser, updateOwnerAvatar, uploadOwnerAvatarFile } from "../services/auth";
import {
  MAX_HAIRCUT_PHOTOS,
  deleteHaircutPhoto,
  uploadHaircutPhoto,
} from "../services/customerPhotos";
import { trackEvent, withMonitoringTrace } from "../services/monitoring";
import { removeSalonAvatar, uploadSalonAvatarFile } from "../services/salonBranding";
import { LuckyWheelConfig, defaultLuckyWheelConfig } from "../services/types";

type OwnerTab =
  "overview" | "approvals" | "branches" | "staff" | "customers" | "wheel" | "redeem" | "settings";

type ConfirmRequest = {
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: "default" | "danger";
  onConfirm: () => Promise<void> | void;
};

type Props = {
  currentUser: AppUser;
};

function legacyPhotoUrlsFor(request: PointRequest): string[] {
  if (request.legacyPhotoUrls) return request.legacyPhotoUrls;
  const pathCount = request.photoPaths?.length ?? 0;
  return request.photoUrls.slice(0, Math.max(0, request.photoUrls.length - pathCount));
}

function photoItemsFor(request: PointRequest): HaircutPhotoItem[] {
  const legacyUrls = legacyPhotoUrlsFor(request);
  const pathUrls = request.photoUrls.slice(legacyUrls.length);
  return [
    ...legacyUrls.map((url) => ({ id: url, url })),
    ...(request.photoPaths ?? []).flatMap((path, index) => {
      const url = pathUrls[index];
      return url ? [{ id: path, url }] : [];
    }),
  ];
}

export function OwnerPage({ currentUser }: Props) {
  const salonId = useMemo(() => {
    return currentUser.salonId.trim();
  }, [currentUser.salonId]);
  const [activeTab, setActiveTab] = useState<OwnerTab>("overview");
  const [requests, setRequests] = useState<PointRequest[]>([]);
  const [ownerBranches, setOwnerBranches] = useState<SalonBranch[]>([]);
  const [branchFilter, setBranchFilter] = useState("all");

  useEffect(() => {
    const navigate = (event: Event) => {
      const route = String((event as CustomEvent<string>).detail || "");
      const nextTab = ownerTabFromRoute(route);
      if (nextTab) setActiveTab(nextTab);
    };
    window.addEventListener("haircut:navigate", navigate);
    return () => window.removeEventListener("haircut:navigate", navigate);
  }, []);
  const [overview, setOverview] = useState<OwnerOverview | null>(null);
  const [salonProfile, setSalonProfile] = useState<SalonProfile | null>(null);
  const [wheelConfig, setWheelConfig] = useState<LuckyWheelConfig>(defaultLuckyWheelConfig);
  const [busyId, setBusyId] = useState("");
  const [photoBusyId, setPhotoBusyId] = useState("");
  const [photoProgress, setPhotoProgress] = useState(0);
  const photoAbortRef = useRef<AbortController | null>(null);
  const [loadingOverview, setLoadingOverview] = useState(true);

  useEffect(() => () => photoAbortRef.current?.abort(), []);
  const [savingSalonProfile, setSavingSalonProfile] = useState(false);
  const [savingWheel, setSavingWheel] = useState(false);
  const [ownerAvatarUrl, setOwnerAvatarUrl] = useState(currentUser.avatarUrl || "");
  const [savingAvatar, setSavingAvatar] = useState(false);
  const [savingSalonAvatar, setSavingSalonAvatar] = useState(false);
  const [confirmRequest, setConfirmRequest] = useState<ConfirmRequest | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!salonId) {
      return undefined;
    }

    return listenPendingPointRequests(
      salonId,
      branchFilter === "all" ? null : branchFilter,
      (nextRequests) => {
        setRequests(nextRequests);
        setError("");
        void getOwnerOverview(salonId, branchFilter === "all" ? null : branchFilter)
          .then(setOverview)
          .catch(() => undefined);
      },
      setError,
    );
  }, [branchFilter, salonId]);

  useEffect(() => {
    if (!salonId) {
      return;
    }
    getBranchQrSettings(salonId)
      .then((settings) => setOwnerBranches(settings.branches))
      .catch(() => undefined);
  }, [activeTab, salonId]);

  useEffect(() => {
    if (!salonId) {
      return;
    }

    getLuckyWheelConfig(salonId)
      .then(setWheelConfig)
      .catch((err) => setError(err instanceof Error ? err.message : "Không tải được vòng quay"));
  }, [salonId]);

  useEffect(() => {
    refreshOverview();
  }, [branchFilter, salonId]);

  useEffect(() => {
    if (!salonId) {
      return undefined;
    }

    const refreshSilently = () => {
      if (document.visibilityState === "visible") {
        void getOwnerOverview(salonId, branchFilter === "all" ? null : branchFilter)
          .then(setOverview)
          .catch(() => undefined);
      }
    };
    const intervalId = window.setInterval(refreshSilently, 60_000);
    window.addEventListener("focus", refreshSilently);
    document.addEventListener("visibilitychange", refreshSilently);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", refreshSilently);
      document.removeEventListener("visibilitychange", refreshSilently);
    };
  }, [branchFilter, salonId]);

  useEffect(() => {
    refreshSalonProfile();
  }, [salonId]);

  useEffect(() => {
    setOwnerAvatarUrl(currentUser.avatarUrl || "");
  }, [currentUser.avatarUrl, currentUser.uid]);

  useEffect(() => {
    trackEvent("owner_tab_opened", {
      salon_id: salonId,
      tab: activeTab,
    });
  }, [activeTab, salonId]);

  async function refreshOverview() {
    if (!salonId) {
      return;
    }

    setLoadingOverview(true);
    try {
      setOverview(await getOwnerOverview(salonId, branchFilter === "all" ? null : branchFilter));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tải được tổng quan");
    } finally {
      setLoadingOverview(false);
    }
  }

  async function refreshSalonProfile() {
    if (!salonId) {
      return;
    }

    try {
      setSalonProfile(await getSalonProfile(salonId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tải được thông tin salon");
    }
  }

  async function saveSalonProfile(input: {
    name: string;
    address: string;
    phone: string;
    pointPerVisit: number;
  }) {
    setSavingSalonProfile(true);
    setMessage("");
    setError("");

    try {
      const nextProfile = await withMonitoringTrace(
        "owner_save_salon_profile",
        () =>
          updateSalonProfile({
            salonId,
            ...input,
          }),
        {
          salon_id: salonId,
        },
      );
      setSalonProfile(nextProfile);
      trackEvent("owner_salon_profile_saved", {
        salon_id: salonId,
      });
      setMessage("Đã cập nhật thông tin salon.");
      refreshOverview();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không lưu được thông tin salon");
    } finally {
      setSavingSalonProfile(false);
    }
  }

  function approve(request: PointRequest) {
    setConfirmRequest({
      title: "Duyệt cộng điểm?",
      description: `Cộng ${request.pointsAdded} điểm cho ${request.customer?.name || "khách hàng"} và lưu lịch sử cắt tóc.`,
      confirmLabel: "Duyệt điểm",
      onConfirm: () => approveAfterConfirm(request),
    });
  }

  async function approveAfterConfirm(request: PointRequest) {
    setBusyId(request.id);
    setMessage("");
    setError("");

    try {
      await withMonitoringTrace("owner_approve_point_request", () => approvePointRequest(request), {
        salon_id: salonId,
        points_added: request.pointsAdded,
      });
      refreshOverview();
      trackEvent("owner_point_request_approved", {
        salon_id: salonId,
        points_added: request.pointsAdded,
      });
      setMessage("Đã duyệt cộng điểm và lưu lịch sử cắt tóc.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không duyệt được yêu cầu");
    } finally {
      setBusyId("");
    }
  }

  function reject(request: PointRequest) {
    setConfirmRequest({
      title: "Từ chối yêu cầu?",
      description: `Yêu cầu cộng điểm của ${request.customer?.name || "khách hàng"} sẽ bị hủy, điểm khách không thay đổi.`,
      confirmLabel: "Từ chối",
      tone: "danger",
      onConfirm: () => rejectAfterConfirm(request),
    });
  }

  async function rejectAfterConfirm(request: PointRequest) {
    setBusyId(request.id);
    setMessage("");
    setError("");

    try {
      await withMonitoringTrace("owner_reject_point_request", () => rejectPointRequest(request), {
        salon_id: salonId,
      });
      refreshOverview();
      trackEvent("owner_point_request_rejected", {
        salon_id: salonId,
      });
      setMessage("Đã từ chối yêu cầu.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không từ chối được yêu cầu");
    } finally {
      setBusyId("");
    }
  }

  async function addOwnerPhotos(request: PointRequest, files: File[]) {
    if (photoBusyId || request.customer?.allowPhoto !== true || files.length === 0) {
      return;
    }

    const availableSlots = MAX_HAIRCUT_PHOTOS - request.photoUrls.length;
    if (availableSlots <= 0) {
      setError(`Mỗi lượt chỉ lưu tối đa ${MAX_HAIRCUT_PHOTOS} ảnh.`);
      return;
    }
    if (files.length > availableSlots) {
      setError(`Bạn chỉ có thể thêm ${availableSlots} ảnh nữa cho lượt này.`);
      return;
    }

    setPhotoBusyId(request.id);
    setPhotoProgress(0);
    setMessage("");
    setError("");
    const uploadedPhotos: Array<{ path: string; url: string }> = [];
    const abortController = new AbortController();
    photoAbortRef.current = abortController;

    try {
      for (const file of files) {
        const uploaded = await withMonitoringTrace(
          "owner_upload_haircut_photo",
          () =>
            uploadHaircutPhoto({
              salonId,
              branchId: request.branchId,
              customerId: request.customerId,
              sessionId: request.sessionId,
              file,
              signal: abortController.signal,
              onProgress: setPhotoProgress,
            }),
          { salon_id: salonId, file_size: file.size, file_type: file.type },
        );
        uploadedPhotos.push(uploaded);
      }

      const nextLegacyPhotoUrls = legacyPhotoUrlsFor(request);
      const nextPhotoPaths = [
        ...(request.photoPaths ?? []),
        ...uploadedPhotos.map((photo) => photo.path),
      ];
      const nextPhotoUrls = [...request.photoUrls, ...uploadedPhotos.map((photo) => photo.url)];
      await updatePendingPointRequestPhotos({
        salonId,
        requestId: request.id,
        photoUrls: nextLegacyPhotoUrls,
        photoPaths: nextPhotoPaths,
      });
      setRequests((current) =>
        current.map((item) =>
          item.id === request.id
            ? {
                ...item,
                photoUrls: nextPhotoUrls,
                legacyPhotoUrls: nextLegacyPhotoUrls,
                photoPaths: nextPhotoPaths,
              }
            : item,
        ),
      );
      setMessage(`Đã lưu ${uploadedPhotos.length} ảnh cho ${request.customer?.name || "khách"}.`);
    } catch (err) {
      await Promise.allSettled(
        uploadedPhotos.map((photo) => deleteHaircutPhoto(photo.path, salonId)),
      );
      setError(err instanceof Error ? err.message : "Không lưu được ảnh kiểu tóc");
    } finally {
      if (photoAbortRef.current === abortController) photoAbortRef.current = null;
      setPhotoBusyId("");
      setPhotoProgress(0);
    }
  }

  async function removeOwnerPhoto(request: PointRequest, photo: HaircutPhotoItem) {
    if (photoBusyId) {
      return;
    }

    setPhotoBusyId(request.id);
    setMessage("");
    setError("");
    const isStoredPath = (request.photoPaths ?? []).includes(photo.id);
    const nextLegacyPhotoUrls = isStoredPath
      ? legacyPhotoUrlsFor(request)
      : legacyPhotoUrlsFor(request).filter((url) => url !== photo.id);
    const nextPhotoPaths = isStoredPath
      ? (request.photoPaths ?? []).filter((path) => path !== photo.id)
      : (request.photoPaths ?? []);
    const nextPhotoUrls = request.photoUrls.filter((photoUrl) => photoUrl !== photo.url);

    try {
      await updatePendingPointRequestPhotos({
        salonId,
        requestId: request.id,
        photoUrls: nextLegacyPhotoUrls,
        photoPaths: nextPhotoPaths,
      });
      setRequests((current) =>
        current.map((item) =>
          item.id === request.id
            ? {
                ...item,
                photoUrls: nextPhotoUrls,
                legacyPhotoUrls: nextLegacyPhotoUrls,
                photoPaths: nextPhotoPaths,
              }
            : item,
        ),
      );
      try {
        await deleteHaircutPhoto(photo.id, isStoredPath ? salonId : undefined);
      } catch {
        trackEvent("owner_haircut_photo_cleanup_deferred", { salon_id: salonId });
      }
      setMessage("Đã gỡ ảnh khỏi yêu cầu duyệt.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không gỡ được ảnh kiểu tóc");
    } finally {
      setPhotoBusyId("");
    }
  }

  async function saveWheel() {
    setSavingWheel(true);
    setMessage("");
    setError("");

    try {
      await withMonitoringTrace(
        "owner_save_wheel_config",
        () => saveLuckyWheelConfig(salonId, wheelConfig),
        {
          salon_id: salonId,
          active_slots: wheelConfig.slots.filter((slot) => slot.active).length,
        },
      );
      trackEvent("owner_wheel_config_saved", {
        salon_id: salonId,
        required_points: wheelConfig.requiredPoints,
      });
      setMessage("Đã lưu cấu hình vòng quay.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không lưu được vòng quay");
    } finally {
      setSavingWheel(false);
    }
  }

  async function saveOwnerAvatar(nextAvatarUrl = "") {
    setSavingAvatar(true);
    setMessage("");
    setError("");

    try {
      const result = await withMonitoringTrace(
        "owner_save_avatar",
        () =>
          updateOwnerAvatar({
            salonId,
            avatarUrl: nextAvatarUrl,
          }),
        {
          salon_id: salonId,
          has_avatar: Boolean(nextAvatarUrl.trim()),
        },
      );
      setOwnerAvatarUrl(result.avatarUrl);
      trackEvent("owner_avatar_saved", {
        salon_id: salonId,
        has_avatar: Boolean(result.avatarUrl),
      });
      setMessage(result.avatarUrl ? "Đã cập nhật avatar chủ salon." : "Đã xóa avatar chủ salon.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không lưu được avatar");
    } finally {
      setSavingAvatar(false);
    }
  }

  async function uploadOwnerAvatar(file: File) {
    setSavingAvatar(true);
    setMessage("");
    setError("");

    try {
      const result = await withMonitoringTrace(
        "owner_upload_avatar",
        () =>
          uploadOwnerAvatarFile({
            salonId,
            file,
          }),
        {
          salon_id: salonId,
          file_size: file.size,
          file_type: file.type,
        },
      );
      setOwnerAvatarUrl(result.avatarUrl);
      trackEvent("owner_avatar_uploaded", {
        salon_id: salonId,
        file_size: file.size,
        file_type: file.type,
      });
      setMessage("Đã tải avatar chủ salon lên.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tải được avatar");
    } finally {
      setSavingAvatar(false);
    }
  }

  async function uploadSalonAvatar(file: File) {
    if (savingSalonAvatar) {
      return;
    }

    setSavingSalonAvatar(true);
    setMessage("");
    setError("");
    try {
      const result = await withMonitoringTrace(
        "owner_upload_salon_avatar",
        () => uploadSalonAvatarFile({ salonId, file }),
        { salon_id: salonId, file_size: file.size, file_type: file.type },
      );
      setSalonProfile((current) =>
        current ? { ...current, avatarUrl: result.salonAvatarUrl } : current,
      );
      trackEvent("owner_salon_avatar_saved", {
        salon_id: salonId,
        has_avatar: true,
      });
      setMessage("Đã cập nhật ảnh đại diện salon.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tải được ảnh đại diện salon");
    } finally {
      setSavingSalonAvatar(false);
    }
  }

  async function clearSalonAvatar() {
    if (savingSalonAvatar) {
      return;
    }

    setSavingSalonAvatar(true);
    setMessage("");
    setError("");
    try {
      const result = await withMonitoringTrace(
        "owner_remove_salon_avatar",
        () => removeSalonAvatar(salonId),
        { salon_id: salonId },
      );
      setSalonProfile((current) =>
        current ? { ...current, avatarUrl: result.salonAvatarUrl } : current,
      );
      trackEvent("owner_salon_avatar_saved", {
        salon_id: salonId,
        has_avatar: false,
      });
      setMessage("Đã xóa ảnh đại diện salon và dùng lại logo mặc định.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không xóa được ảnh đại diện salon");
    } finally {
      setSavingSalonAvatar(false);
    }
  }

  async function runConfirmRequest() {
    const request = confirmRequest;

    if (!request || confirming) {
      return;
    }

    setConfirming(true);
    try {
      await request.onConfirm();
      setConfirmRequest(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không xử lý được thao tác");
    } finally {
      setConfirming(false);
    }
  }

  function cancelConfirmRequest() {
    if (!confirming) {
      setConfirmRequest(null);
    }
  }

  if (!salonId) {
    return (
      <section className="ops-page owner-page">
        <div className="empty-state">
          <ShieldCheck size={32} aria-hidden="true" />
          <strong>Tài khoản chưa có salon</strong>
          <p>Đăng xuất rồi đăng nhập lại để hoàn tất hồ sơ salon.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="ops-page owner-page">
      <header className="ops-topbar owner-topbar">
        <BrandLogo />
        <div>
          <p className="eyebrow">Chủ salon</p>
          <h1>{salonProfile?.name || "Quản lý salon"}</h1>
          <span>{salonId}</span>
        </div>
        <OwnerAvatar avatarUrl={ownerAvatarUrl} name={currentUser.name} />
      </header>

      <div className="segmented-control owner-tabs compact-tabs" aria-label="Chọn mục quản lý">
        <OwnerTabButton
          active={activeTab === "overview"}
          icon={<BarChart3 size={18} />}
          label="Tổng"
          onClick={() => setActiveTab("overview")}
        />
        <OwnerTabButton
          active={activeTab === "approvals"}
          icon={<ClipboardCheck size={18} />}
          label="Duyệt & ảnh"
          onClick={() => setActiveTab("approvals")}
        />
        <OwnerTabButton
          active={activeTab === "branches"}
          icon={<QrCode size={18} />}
          label="Chi nhánh"
          onClick={() => setActiveTab("branches")}
        />
        <OwnerTabButton
          active={activeTab === "staff"}
          icon={<UsersRound size={18} />}
          label="Nhân viên"
          onClick={() => setActiveTab("staff")}
        />
        <OwnerTabButton
          active={activeTab === "customers"}
          icon={<Search size={18} />}
          label="Khách"
          onClick={() => setActiveTab("customers")}
        />
        <OwnerTabButton
          active={activeTab === "wheel"}
          icon={<SlidersHorizontal size={18} />}
          label="Vòng quay"
          onClick={() => setActiveTab("wheel")}
        />
        <OwnerTabButton
          active={activeTab === "redeem"}
          icon={<TicketCheck size={18} />}
          label="Quà"
          onClick={() => setActiveTab("redeem")}
        />
        <OwnerTabButton
          active={activeTab === "settings"}
          icon={<Settings2 size={18} />}
          label="Cài đặt"
          onClick={() => setActiveTab("settings")}
        />
      </div>

      {activeTab === "overview" || activeTab === "approvals" ? (
        <label className="field owner-branch-filter">
          <span>Phạm vi dữ liệu</span>
          <select value={branchFilter} onChange={(event) => setBranchFilter(event.target.value)}>
            <option value="all">Tất cả chi nhánh</option>
            {ownerBranches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {activeTab === "overview" ? (
        <OverviewPanel
          overview={overview}
          loading={loadingOverview}
          onRefresh={refreshOverview}
          onOpenTab={setActiveTab}
        />
      ) : activeTab === "approvals" ? (
        <ApprovalsPanel
          requests={requests}
          busyId={busyId}
          photoBusyId={photoBusyId}
          photoProgress={photoProgress}
          onApprove={approve}
          onReject={reject}
          onAddPhotos={addOwnerPhotos}
          onRemovePhoto={removeOwnerPhoto}
          onCancelPhotoUpload={() => photoAbortRef.current?.abort()}
        />
      ) : activeTab === "branches" ? (
        <BranchesPanel
          salonId={salonId}
          onMessage={setMessage}
          onError={setError}
          onConfirm={setConfirmRequest}
        />
      ) : activeTab === "staff" ? (
        <StaffManagementPanel salonId={salonId} onMessage={setMessage} onError={setError} />
      ) : activeTab === "customers" ? (
        <CustomerSearchPanel
          salonId={salonId}
          onMessage={setMessage}
          onError={setError}
          onConfirm={setConfirmRequest}
        />
      ) : activeTab === "wheel" ? (
        <WheelConfigPanel
          config={wheelConfig}
          saving={savingWheel}
          onChange={setWheelConfig}
          onSave={saveWheel}
        />
      ) : activeTab === "redeem" ? (
        <RedeemRewardPanel
          salonId={salonId}
          branchId={branchFilter === "all" ? undefined : branchFilter}
          allowRestore
        />
      ) : (
        <>
          <SalonProfilePanel
            profile={salonProfile}
            saving={savingSalonProfile}
            onSave={saveSalonProfile}
          />
          <SalonBrandingPanel
            salonName={salonProfile?.name || "Salon"}
            avatarUrl={salonProfile?.avatarUrl || ""}
            saving={savingSalonAvatar}
            onUpload={uploadSalonAvatar}
            onClear={clearSalonAvatar}
          />
          <OwnerProfilePanel
            currentUser={currentUser}
            avatarUrl={ownerAvatarUrl}
            saving={savingAvatar}
            onUpload={uploadOwnerAvatar}
            onClear={() => saveOwnerAvatar("")}
          />
          <AccountDeletionPanel currentUser={currentUser} />
        </>
      )}

      {message ? <p className="alert success">{message}</p> : null}
      {error ? <p className="alert error">{error}</p> : null}
      <ConfirmDialog
        request={confirmRequest}
        busy={confirming}
        onCancel={cancelConfirmRequest}
        onConfirm={runConfirmRequest}
      />
    </section>
  );
}

function OwnerTabButton({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button className={active ? "active" : ""} onClick={onClick}>
      {icon}
      {label}
    </button>
  );
}

function ConfirmDialog({
  request,
  busy,
  onCancel,
  onConfirm,
}: {
  request: ConfirmRequest | null;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!request) {
    return null;
  }

  return (
    <div className="dialog-backdrop" role="presentation">
      <div
        className={request.tone === "danger" ? "confirm-dialog danger" : "confirm-dialog"}
        role="dialog"
        aria-modal="true"
        aria-labelledby="owner-confirm-title"
      >
        <div className="confirm-icon">
          <AlertTriangle size={24} aria-hidden="true" />
        </div>
        <div className="confirm-copy">
          <h2 id="owner-confirm-title">{request.title}</h2>
          <p className="muted">{request.description}</p>
        </div>
        <div className="button-row wrap-row">
          <button className="secondary-button" disabled={busy} onClick={onCancel}>
            {request.cancelLabel || "Hủy"}
          </button>
          <button
            className={
              request.tone === "danger" ? "primary-button danger-primary" : "primary-button"
            }
            disabled={busy}
            onClick={onConfirm}
          >
            {busy ? "Đang xử lý..." : request.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function OwnerProfilePanel({
  currentUser,
  avatarUrl,
  saving,
  onUpload,
  onClear,
}: {
  currentUser: AppUser;
  avatarUrl: string;
  saving: boolean;
  onUpload: (file: File) => void;
  onClear: () => void;
}) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");

  useEffect(() => {
    if (!selectedFile) {
      setPreviewUrl("");
      return undefined;
    }

    const nextPreviewUrl = URL.createObjectURL(selectedFile);
    setPreviewUrl(nextPreviewUrl);
    return () => URL.revokeObjectURL(nextPreviewUrl);
  }, [selectedFile]);

  useEffect(() => {
    setSelectedFile(null);
  }, [avatarUrl]);

  return (
    <div className="panel owner-profile-panel">
      <OwnerAvatar avatarUrl={previewUrl || avatarUrl} name={currentUser.name} large />
      <div className="owner-profile-form">
        <div className="dashboard-heading">
          <div>
            <p className="eyebrow">Tài khoản cá nhân</p>
            <h2>Ảnh tài khoản</h2>
          </div>
          <span className="pill muted-pill">{currentUser.name || "Chủ salon"}</span>
        </div>

        <label className={saving ? "avatar-upload-zone disabled" : "avatar-upload-zone"}>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={saving}
            onChange={(event) => {
              const file = event.target.files?.[0] || null;
              setSelectedFile(file);
              event.currentTarget.value = "";
            }}
          />
          <span className="avatar-upload-icon">
            <ImageIcon size={18} aria-hidden="true" />
          </span>
          <span>
            <strong>{selectedFile ? selectedFile.name : "Chọn ảnh tài khoản"}</strong>
            <small>
              {selectedFile
                ? `${formatUploadSize(selectedFile.size)} · bấm Lưu để tải lên`
                : "JPG, PNG hoặc WebP. App sẽ tự cắt vuông và nén ảnh cho nhẹ."}
            </small>
          </span>
        </label>

        <div className="button-row wrap-row">
          <button
            className="primary-button"
            disabled={saving || !selectedFile}
            onClick={() => {
              if (selectedFile) {
                onUpload(selectedFile);
              }
            }}
          >
            <Save size={18} aria-hidden="true" />
            {saving ? "Đang tải lên..." : "Lưu ảnh tài khoản"}
          </button>
          {selectedFile ? (
            <button
              className="secondary-button"
              disabled={saving}
              onClick={() => setSelectedFile(null)}
            >
              <XCircle size={18} aria-hidden="true" />
              Bỏ chọn
            </button>
          ) : null}
          <button className="secondary-button" disabled={saving || !avatarUrl} onClick={onClear}>
            <Trash2 size={18} aria-hidden="true" />
            Xóa ảnh tài khoản
          </button>
        </div>
      </div>
    </div>
  );
}

function formatUploadSize(size: number) {
  if (size >= 1024 * 1024) {
    return `${(size / 1024 / 1024).toFixed(1)}MB`;
  }

  return `${Math.max(1, Math.round(size / 1024))}KB`;
}

function SalonProfilePanel({
  profile,
  saving,
  onSave,
}: {
  profile: SalonProfile | null;
  saving: boolean;
  onSave: (input: { name: string; address: string; phone: string; pointPerVisit: number }) => void;
}) {
  const [name, setName] = useState(profile?.name || "");
  const [address, setAddress] = useState(profile?.address || "");
  const [phone, setPhone] = useState(profile?.phone || "");
  const [pointPerVisit, setPointPerVisit] = useState(profile?.pointPerVisit || 1);

  useEffect(() => {
    setName(profile?.name || "");
    setAddress(profile?.address || "");
    setPhone(profile?.phone || "");
    setPointPerVisit(profile?.pointPerVisit || 1);
  }, [profile?.id, profile?.name, profile?.address, profile?.phone, profile?.pointPerVisit]);

  const changed = profile
    ? name.trim() !== profile.name ||
      address.trim() !== profile.address ||
      phone.trim() !== profile.phone ||
      Number(pointPerVisit) !== profile.pointPerVisit
    : false;

  return (
    <div className="panel salon-profile-panel">
      <div className="dashboard-heading">
        <div>
          <p className="eyebrow">Thiết lập salon</p>
          <h2>Thông tin vận hành</h2>
        </div>
        <span className="pill muted-pill">
          {profile ? `${profile.freeCustomerLimit} khách miễn phí` : "Đang tải"}
        </span>
      </div>

      <div className="salon-profile-grid">
        <label className="field">
          <span>Tên salon</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Ví dụ: HAIRCUT Studio"
          />
        </label>
        <label className="field">
          <span>Số điện thoại salon</span>
          <input
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            inputMode="tel"
            placeholder="Số hotline hoặc Zalo"
          />
        </label>
        <label className="field wide-field">
          <span>Địa chỉ</span>
          <input
            value={address}
            onChange={(event) => setAddress(event.target.value)}
            placeholder="Địa chỉ để khách nhận diện đúng salon"
          />
        </label>
        <label className="field">
          <span>Điểm cộng mỗi lượt cắt</span>
          <input
            type="number"
            min={1}
            max={100}
            value={pointPerVisit}
            onChange={(event) =>
              setPointPerVisit(Math.min(100, Math.max(1, Number(event.target.value || 1))))
            }
          />
          <small>Nhân viên sẽ gửi yêu cầu cộng đúng số điểm này cho mỗi lượt cắt.</small>
        </label>
      </div>

      <div className="button-row wrap-row">
        <button
          className="primary-button"
          disabled={saving || !profile || !name.trim() || !changed}
          onClick={() =>
            onSave({
              name,
              address,
              phone,
              pointPerVisit,
            })
          }
        >
          <Save size={18} aria-hidden="true" />
          {saving ? "Đang lưu..." : "Lưu thông tin salon"}
        </button>
      </div>
    </div>
  );
}

function OwnerAvatar({
  avatarUrl,
  name,
  large = false,
}: {
  avatarUrl: string;
  name: string;
  large?: boolean;
}) {
  return (
    <div className={large ? "owner-avatar large" : "owner-avatar"}>
      {avatarUrl ? (
        <img src={avatarUrl} alt="" />
      ) : (
        <>
          <UserRound size={large ? 30 : 22} aria-hidden="true" />
          <span>{ownerInitials(name)}</span>
        </>
      )}
    </div>
  );
}

function ownerInitials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);

  if (words.length === 0) {
    return "HC";
  }

  return words.map((word) => word[0]?.toUpperCase() || "").join("");
}

function OverviewPanel({
  overview,
  loading,
  onRefresh,
  onOpenTab,
}: {
  overview: OwnerOverview | null;
  loading: boolean;
  onRefresh: () => void;
  onOpenTab: (tab: OwnerTab) => void;
}) {
  const data =
    overview ||
    ({
      customersToday: 0,
      customers7Days: 0,
      customers30Days: 0,
      pendingRequests: 0,
      pointsApprovedToday: 0,
      spinsToday: 0,
      unusedRewards: 0,
      inactiveCustomers: [],
    } satisfies OwnerOverview);

  return (
    <div className="panel overview-panel">
      <div className="dashboard-heading">
        <div>
          <p className="eyebrow">Hôm nay</p>
          <h2>Tổng quan</h2>
        </div>
        <button className="icon-text-button" disabled={loading} onClick={onRefresh}>
          <RefreshCcw size={18} aria-hidden="true" />
          {loading ? "Đang tải" : "Làm mới"}
        </button>
      </div>

      <div className="overview-grid">
        <OverviewMetric
          icon={<UsersRound size={21} />}
          label="Khách hôm nay"
          value={data.customersToday}
        />
        <OverviewMetric
          icon={<BarChart3 size={21} />}
          label="Khách 7 ngày"
          value={data.customers7Days}
        />
        <OverviewMetric
          icon={<BarChart3 size={21} />}
          label="Khách 30 ngày"
          value={data.customers30Days}
        />
        <OverviewMetric
          icon={<ClipboardCheck size={21} />}
          label="Chờ duyệt"
          value={data.pendingRequests}
        />
        <OverviewMetric
          icon={<CheckCircle2 size={21} />}
          label="Điểm đã cộng"
          value={data.pointsApprovedToday}
        />
        <OverviewMetric icon={<Gift size={21} />} label="Lượt quay" value={data.spinsToday} />
        <OverviewMetric
          icon={<TicketCheck size={21} />}
          label="Mã quà chưa dùng"
          value={data.unusedRewards}
        />
      </div>

      <div className="retention-panel">
        <div className="dashboard-heading">
          <div>
            <p className="eyebrow">Giữ chân khách</p>
            <h2>Khách lâu chưa quay lại</h2>
          </div>
          <button
            className="secondary-button compact"
            type="button"
            onClick={() => onOpenTab("customers")}
          >
            <Search size={18} aria-hidden="true" />
            Tìm khách
          </button>
        </div>

        {data.inactiveCustomers.length === 0 ? (
          <div className="empty-state compact-empty soft-empty">
            <UsersRound size={28} aria-hidden="true" />
            <strong>Chưa có khách cần nhắc lại</strong>
            <p>Khi có khách hơn 30 ngày chưa quay lại, danh sách sẽ hiện ở đây.</p>
          </div>
        ) : (
          <div className="retention-list">
            {data.inactiveCustomers.map((customer) => (
              <article className="retention-card" key={customer.id}>
                <div>
                  <strong>{customer.name}</strong>
                  <span>
                    {ownerPhoneLabel(customer)} · {customer.points} điểm
                  </span>
                </div>
                <div>
                  <strong>{formatInactiveDays(customer.daysSinceLastVisit)}</strong>
                  <span>{formatDateTime(customer.lastVisitAtMs) || "Chưa có lịch sử"}</span>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      <div className="owner-next-actions">
        <button type="button" onClick={() => onOpenTab("approvals")}>
          <ClipboardCheck size={20} aria-hidden="true" />
          <span>
            <strong>Duyệt điểm & ảnh</strong>
            <small>
              {data.pendingRequests > 0
                ? `${data.pendingRequests} khách đang chờ duyệt`
                : "Chụp bổ sung khi có yêu cầu mới"}
            </small>
          </span>
        </button>
        <button type="button" onClick={() => onOpenTab("redeem")}>
          <TicketCheck size={20} aria-hidden="true" />
          <span>
            <strong>Đổi mã quà</strong>
            <small>
              {data.unusedRewards > 0
                ? `${data.unusedRewards} mã chưa dùng`
                : "Sẵn sàng xác nhận mã mới"}
            </small>
          </span>
        </button>
        <button type="button" onClick={() => onOpenTab("wheel")}>
          <SlidersHorizontal size={20} aria-hidden="true" />
          <span>
            <strong>Cấu hình vòng quay</strong>
            <small>Đổi điểm quay và 6 ô thưởng</small>
          </span>
        </button>
        <button type="button" onClick={() => onOpenTab("branches")}>
          <QrCode size={20} aria-hidden="true" />
          <span>
            <strong>Chi nhánh & QR</strong>
            <small>QR chung cho salon và QR riêng từng chi nhánh</small>
          </span>
        </button>
        <button type="button" onClick={() => onOpenTab("staff")}>
          <UserPlus size={20} aria-hidden="true" />
          <span>
            <strong>Nhân viên</strong>
            <small>Thêm, tắt và cấp quyền đổi quà</small>
          </span>
        </button>
        <button type="button" onClick={() => onOpenTab("customers")}>
          <Search size={20} aria-hidden="true" />
          <span>
            <strong>Tìm khách</strong>
            <small>Tra điểm, lịch sử và mã quà chưa dùng</small>
          </span>
        </button>
      </div>
    </div>
  );
}

function OverviewMetric({ icon, label, value }: { icon: ReactNode; label: string; value: number }) {
  return (
    <div className="overview-metric">
      {icon}
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function formatInactiveDays(days: number) {
  if (days >= 999) {
    return "Chưa quay lại";
  }

  return `${days} ngày`;
}

function ownerPhoneLabel(customer: { phone?: string; phoneLast4: string }) {
  const digits = String(customer.phone || "").replace(/\D/g, "");

  if (digits.startsWith("84") && digits.length >= 10) {
    return `0${digits.slice(2)}`;
  }
  if (digits) {
    return digits;
  }

  return customer.phoneLast4 ? `******${customer.phoneLast4}` : "Chưa có SĐT";
}

function ApprovalsPanel({
  requests,
  busyId,
  photoBusyId,
  photoProgress,
  onApprove,
  onReject,
  onAddPhotos,
  onRemovePhoto,
  onCancelPhotoUpload,
}: {
  requests: PointRequest[];
  busyId: string;
  photoBusyId: string;
  photoProgress: number;
  onApprove: (request: PointRequest) => void;
  onReject: (request: PointRequest) => void;
  onAddPhotos: (request: PointRequest, files: File[]) => void | Promise<void>;
  onRemovePhoto: (request: PointRequest, photo: HaircutPhotoItem) => void | Promise<void>;
  onCancelPhotoUpload: () => void;
}) {
  return (
    <div className="ops-list">
      {requests.length === 0 ? (
        <div className="empty-state">
          <ClipboardCheck size={30} aria-hidden="true" />
          <strong>Chưa có yêu cầu cộng điểm</strong>
          <p>Khi nhân viên gửi yêu cầu, chủ salon có thể bổ sung ảnh rồi duyệt tại đây.</p>
        </div>
      ) : (
        requests.map((request) => (
          <article className="ops-card static-card approval-card" key={request.id}>
            <span className="ops-card-title">{request.customer?.name || "Khách hàng"}</span>
            <span>SĐT: {request.customer ? ownerPhoneLabel(request.customer) : "Chưa có"}</span>
            <span>Thợ: {request.staffName || "Nhân viên"}</span>
            <span>Chi nhánh: {request.branchName || "Chi nhánh"}</span>
            <p>{request.note || "Không có ghi chú"}</p>
            <HaircutPhotoCapture
              title="Ảnh khách sau cắt"
              photos={photoItemsFor(request)}
              consentGranted={request.customer?.allowPhoto === true}
              busy={photoBusyId === request.id}
              disabled={busyId === request.id || Boolean(photoBusyId)}
              disabledReason="Chụp hoặc chọn ảnh trước khi duyệt điểm."
              captureLabel={`Chụp ảnh kiểu tóc cho ${request.customer?.name || "khách hàng"}`}
              galleryLabel={`Chọn ảnh kiểu tóc cho ${request.customer?.name || "khách hàng"}`}
              maxPhotos={MAX_HAIRCUT_PHOTOS}
              progress={photoBusyId === request.id ? photoProgress : undefined}
              onCancelUpload={onCancelPhotoUpload}
              onFilesSelected={(files) => onAddPhotos(request, files)}
              onRemove={(photo) => onRemovePhoto(request, photo)}
            />
            <small>
              +{request.pointsAdded} điểm · {formatDateTime(request.createdAtMs)}
            </small>

            <div className="button-row">
              <button
                className="primary-button compact"
                disabled={busyId === request.id || photoBusyId === request.id}
                onClick={() => onApprove(request)}
              >
                <CheckCircle2 size={18} aria-hidden="true" />
                Duyệt
              </button>
              <button
                className="secondary-button"
                disabled={busyId === request.id || photoBusyId === request.id}
                onClick={() => onReject(request)}
              >
                <XCircle size={18} aria-hidden="true" />
                Từ chối
              </button>
            </div>
          </article>
        ))
      )}
    </div>
  );
}

function BranchesPanel({
  salonId,
  onMessage,
  onError,
  onConfirm,
}: {
  salonId: string;
  onMessage: (message: string) => void;
  onError: (message: string) => void;
  onConfirm: (request: ConfirmRequest) => void;
}) {
  const [branches, setBranches] = useState<SalonBranch[]>([]);
  const [salonQrUrl, setSalonQrUrl] = useState("");
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");

  useEffect(() => {
    refresh();
  }, [salonId]);

  async function refresh() {
    setLoading(true);
    try {
      const settings = await getBranchQrSettings(salonId);
      setSalonQrUrl(settings.salonQrUrl);
      setBranches(settings.branches);
      onError("");
    } catch (err) {
      onError(err instanceof Error ? err.message : "Không tải được danh sách chi nhánh");
    } finally {
      setLoading(false);
    }
  }

  async function addBranch() {
    setBusyId("new");
    onMessage("");
    onError("");

    try {
      const created = await createBranch({ salonId, name, address, phone });
      setName("");
      setAddress("");
      setPhone("");
      setBranches((current) =>
        [...current, created].sort((a, b) => a.name.localeCompare(b.name, "vi")),
      );
      onMessage("Đã tạo chi nhánh và QR riêng.");
    } catch (err) {
      onError(err instanceof Error ? err.message : "Không tạo được chi nhánh");
    } finally {
      setBusyId("");
    }
  }

  async function saveBranch(branch: SalonBranch, payload: Partial<SalonBranch>) {
    setBusyId(branch.id);
    onMessage("");
    onError("");

    try {
      const updated = await updateBranch({
        salonId,
        branchId: branch.id,
        name: payload.name,
        address: payload.address,
        phone: payload.phone,
        isActive: payload.isActive,
      });
      setBranches((current) =>
        current
          .map((item) => (item.id === branch.id ? updated : item))
          .sort((a, b) => a.name.localeCompare(b.name, "vi")),
      );
      onMessage("Đã cập nhật chi nhánh.");
    } catch (err) {
      onError(err instanceof Error ? err.message : "Không cập nhật được chi nhánh");
    } finally {
      setBusyId("");
    }
  }

  async function copyQr(url: string) {
    try {
      if (!navigator.clipboard) {
        throw new Error("clipboard unavailable");
      }
      await navigator.clipboard.writeText(url);
      onMessage("Đã sao chép liên kết QR.");
      onError("");
    } catch {
      onMessage("");
      onError("Thiết bị không cho phép sao chép liên kết. Hãy dùng nút Tải QR.");
    }
  }

  async function regenerateSalonQr() {
    setBusyId("salon-qr");
    try {
      setSalonQrUrl(await rotateSalonQr(salonId));
      onMessage("Đã tạo lại QR chung. QR chi nhánh vẫn giữ nguyên.");
    } catch (err) {
      onError(err instanceof Error ? err.message : "Không tạo lại được QR salon");
    } finally {
      setBusyId("");
    }
  }

  async function regenerateBranchQr(branch: SalonBranch) {
    setBusyId(branch.id);
    try {
      const qrUrl = await rotateBranchQr(salonId, branch.id);
      setBranches((current) =>
        current.map((item) => (item.id === branch.id ? { ...item, qrUrl } : item)),
      );
      onMessage("Đã tạo lại QR chi nhánh. QR chung của salon vẫn giữ nguyên.");
    } catch (err) {
      onError(err instanceof Error ? err.message : "Không tạo lại được QR chi nhánh");
    } finally {
      setBusyId("");
    }
  }

  async function migrateLegacyData() {
    setBusyId("migration");
    try {
      await migrateSalonBranches(salonId);
      await refresh();
      onMessage("Đã gắn dữ liệu cũ vào Chi nhánh chính. Có thể chạy lại mà không tạo trùng.");
    } catch (err) {
      onError(err instanceof Error ? err.message : "Không chuyển được dữ liệu cũ");
    } finally {
      setBusyId("");
    }
  }

  return (
    <div className="panel">
      <div className="section-heading">
        <QrCode size={22} aria-hidden="true" />
        <div>
          <h2>Chi nhánh và QR</h2>
          <p className="muted">Một QR chung cho salon và một QR riêng cho mỗi chi nhánh.</p>
        </div>
      </div>

      {salonQrUrl ? (
        <ManagedQrCard
          title="QR chung của salon"
          description="Khách quét để chọn chi nhánh; nếu chỉ có một chi nhánh, app tự chọn."
          qrUrl={salonQrUrl}
          active
          busy={busyId === "salon-qr"}
          onCopy={copyQr}
          onError={onError}
          onRegenerate={() =>
            onConfirm({
              title: "Tạo lại QR chung?",
              description: "QR chung cũ sẽ ngừng hoạt động. QR của từng chi nhánh không thay đổi.",
              confirmLabel: "Tạo QR chung mới",
              tone: "danger",
              onConfirm: regenerateSalonQr,
            })
          }
        />
      ) : null}

      <div className="staff-create-grid">
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Tên chi nhánh"
        />
        <input
          value={address}
          onChange={(event) => setAddress(event.target.value)}
          placeholder="Địa chỉ"
        />
        <input
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          placeholder="Số điện thoại"
        />
        <button
          className="primary-button"
          disabled={busyId === "new" || !name.trim()}
          onClick={addBranch}
        >
          <QrCode size={18} aria-hidden="true" />
          Thêm chi nhánh
        </button>
      </div>

      <button
        className="secondary-button"
        disabled={busyId === "migration"}
        onClick={migrateLegacyData}
      >
        <RefreshCcw size={18} aria-hidden="true" />
        Chuyển dữ liệu Gương 1 cũ
      </button>

      <div className="ops-list">
        {loading ? (
          <div className="empty-state compact-empty">
            <QrCode size={28} aria-hidden="true" />
            <strong>Đang tải chi nhánh</strong>
            <p>Danh sách sẽ hiện sau vài giây.</p>
          </div>
        ) : branches.length === 0 ? (
          <div className="empty-state compact-empty">
            <QrCode size={28} aria-hidden="true" />
            <strong>Chưa có chi nhánh</strong>
            <p>Tạo chi nhánh đầu tiên hoặc chuyển dữ liệu Gương 1 cũ.</p>
          </div>
        ) : (
          branches.map((branch) => (
            <ManagedQrCard
              key={branch.id}
              title={branch.name}
              description={branch.address || "Chưa có địa chỉ"}
              qrUrl={branch.qrUrl}
              active={branch.isActive}
              branch={branch}
              busy={busyId === branch.id}
              onCopy={copyQr}
              onError={onError}
              onSave={(payload) => saveBranch(branch, payload)}
              onToggle={() => saveBranch(branch, { isActive: !branch.isActive })}
              onRegenerate={() =>
                onConfirm({
                  title: "Tạo lại QR chi nhánh?",
                  description: `QR cũ của ${branch.name} sẽ ngừng hoạt động. QR chung của salon không thay đổi.`,
                  confirmLabel: "Tạo QR mới",
                  tone: "danger",
                  onConfirm: () => regenerateBranchQr(branch),
                })
              }
            />
          ))
        )}
      </div>
    </div>
  );
}

function ManagedQrCard({
  title,
  description,
  qrUrl,
  active,
  branch,
  busy,
  onCopy,
  onError,
  onSave,
  onToggle,
  onRegenerate,
}: {
  title: string;
  description: string;
  qrUrl: string;
  active: boolean;
  branch?: SalonBranch;
  busy: boolean;
  onCopy: (url: string) => void;
  onError: (message: string) => void;
  onSave?: (payload: Partial<SalonBranch>) => void;
  onToggle?: () => void;
  onRegenerate: () => void;
}) {
  const [name, setName] = useState(branch?.name || title);
  const [address, setAddress] = useState(branch?.address || "");
  const [phone, setPhone] = useState(branch?.phone || "");
  const [qrImageUrl, setQrImageUrl] = useState("");

  useEffect(() => {
    setName(branch?.name || title);
    setAddress(branch?.address || "");
    setPhone(branch?.phone || "");
  }, [branch?.address, branch?.name, branch?.phone, title]);

  useEffect(() => {
    let cancelled = false;

    QRCode.toDataURL(qrUrl, {
      width: 256,
      margin: 2,
      color: {
        dark: "#0b1712",
        light: "#ffffff",
      },
    })
      .then((imageUrl) => {
        if (!cancelled) {
          setQrImageUrl(imageUrl);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setQrImageUrl("");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [qrUrl]);

  function printQr() {
    if (!qrImageUrl) {
      return;
    }

    const printWindow = window.open("", "_blank", "width=420,height=620");

    if (!printWindow) {
      onError("Trình duyệt đang chặn cửa sổ in. Hãy cho phép cửa sổ bật lên rồi thử lại.");
      return;
    }

    printWindow.document.write(`
      <!doctype html>
      <html lang="vi">
        <head>
          <meta charset="utf-8" />
          <title>${escapeHtml(title)} - ${escapeHtml(MINI_APP_NAME)} QR</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 28px; color: #0b1712; text-align: center; }
            h1 { margin: 0 0 8px; font-size: 28px; }
            p { margin: 0 0 18px; color: #4c5a53; font-weight: 700; }
            img { width: 280px; height: 280px; }
          </style>
        </head>
        <body>
          <h1>${escapeHtml(title)}</h1>
          <p>Quét QR để check-in ${escapeHtml(MINI_APP_NAME)}</p>
          <img src="${qrImageUrl}" alt="" />
          <script>window.onload = () => window.print();</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  }

  return (
    <article className="ops-card static-card management-card">
      <div className="management-card-header">
        <span className="ops-card-title">{title}</span>
        <span className={active ? "pill" : "pill muted-pill"}>
          {active ? "Đang hoạt động" : "Đã khóa"}
        </span>
      </div>
      <div className="qr-preview-card">
        {qrImageUrl ? (
          <img className="qr-preview-image" src={qrImageUrl} alt="" />
        ) : (
          <div className="qr-preview-image qr-preview-loading">
            <QrCode size={42} aria-hidden="true" />
          </div>
        )}
        <div className="qr-print-meta">
          <strong>{title}</strong>
          <span>{description}</span>
        </div>
      </div>
      {branch ? (
        <div className="staff-edit-grid">
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Tên chi nhánh"
          />
          <input
            value={address}
            onChange={(event) => setAddress(event.target.value)}
            placeholder="Địa chỉ"
          />
          <input
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="Số điện thoại"
          />
        </div>
      ) : null}
      <div className="button-row wrap-row">
        {window.__haircutNativeShare ? (
          <button
            className="secondary-button"
            onClick={() => void window.__haircutNativeShare?.(qrUrl, title)}
          >
            <Share2 size={18} aria-hidden="true" />
            Chia sẻ QR
          </button>
        ) : null}
        <button className="secondary-button" onClick={() => onCopy(qrUrl)}>
          <Copy size={18} aria-hidden="true" />
          Sao chép liên kết
        </button>
        {qrImageUrl ? (
          <a
            className="secondary-button"
            href={qrImageUrl}
            download={`${safeFileName(title)}-qr.png`}
          >
            <Download size={18} aria-hidden="true" />
            Tải QR
          </a>
        ) : null}
        <button className="secondary-button" disabled={!qrImageUrl} onClick={printQr}>
          <Printer size={18} aria-hidden="true" />
          In QR
        </button>
        {branch && onSave ? (
          <button
            className="secondary-button"
            disabled={busy}
            onClick={() => onSave({ name, address, phone })}
          >
            <Save size={18} aria-hidden="true" />
            Lưu
          </button>
        ) : null}
        {branch && onToggle ? (
          <button className="secondary-button" disabled={busy} onClick={onToggle}>
            <Power size={18} aria-hidden="true" />
            {active ? "Khóa chi nhánh" : "Mở chi nhánh"}
          </button>
        ) : null}
        <button className="secondary-button" disabled={busy} onClick={onRegenerate}>
          <RefreshCcw size={18} aria-hidden="true" />
          Tạo QR mới
        </button>
      </div>
    </article>
  );
}

function ownerTabFromRoute(route: string): OwnerTab | null {
  if (route.startsWith("/approvals")) return "approvals";
  if (route.startsWith("/branches")) return "branches";
  if (route.startsWith("/staff")) return "staff";
  if (route.startsWith("/customers")) return "customers";
  if (route.startsWith("/wheel")) return "wheel";
  if (route.startsWith("/rewards")) return "redeem";
  if (route.startsWith("/settings") || route.startsWith("/delete-account")) return "settings";
  if (route.startsWith("/overview") || route.startsWith("/queue")) return "overview";
  return null;
}

function safeFileName(value: string) {
  return (
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase() || "haircut"
  );
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function StaffManagementPanel({
  salonId,
  onMessage,
  onError,
}: {
  salonId: string;
  onMessage: (message: string) => void;
  onError: (message: string) => void;
}) {
  const [staff, setStaff] = useState<StaffProfile[]>([]);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [canRedeemRewards, setCanRedeemRewards] = useState(false);
  const [branches, setBranches] = useState<SalonBranch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");

  useEffect(() => {
    setLoading(true);
    return listenStaffProfiles(
      salonId,
      (nextStaff) => {
        setStaff(nextStaff);
        setLoading(false);
        onError("");
      },
      (message) => {
        setLoading(false);
        onError(message);
      },
    );
  }, [salonId]);

  useEffect(() => {
    getBranchQrSettings(salonId)
      .then((settings) => {
        const activeBranches = settings.branches.filter((branch) => branch.isActive);
        setBranches(activeBranches);
        setSelectedBranchId((current) => current || activeBranches[0]?.id || "");
      })
      .catch((err) => onError(err instanceof Error ? err.message : "Không tải được chi nhánh"));
  }, [salonId]);

  async function addStaff() {
    setBusyId("new");
    onMessage("");
    onError("");

    try {
      const createdStaff = await createStaffProfile({
        salonId,
        email,
        name,
        phone,
        canRedeemRewards,
        branchIds: [selectedBranchId],
      });
      const createdUid = createdStaff.uid;
      if (createdUid) {
        const nextStaff: StaffProfile = {
          uid: createdUid,
          salonId,
          email,
          name,
          phone,
          role: "staff",
          isActive: true,
          canRedeemRewards,
          branchId: selectedBranchId,
          branchIds: [selectedBranchId],
          inviteStatus: "pending",
        };
        setStaff((current) =>
          [...current.filter((item) => item.uid !== createdUid), nextStaff].sort((a, b) =>
            a.name.localeCompare(b.name, "vi"),
          ),
        );
      }
      setEmail("");
      setName("");
      setPhone("");
      setCanRedeemRewards(false);
      onMessage(
        createdStaff.inviteEmailSent
          ? "Đã gửi email mời. Nhân viên tự đặt mật khẩu trong hộp thư của họ."
          : "Đã tạo tài khoản nhưng chưa gửi được email. Bấm Gửi lại email mời ở bên dưới.",
      );
    } catch (err) {
      onError(err instanceof Error ? err.message : "Không thêm được nhân viên");
    } finally {
      setBusyId("");
    }
  }

  async function resendInvite(staffMember: StaffProfile) {
    setBusyId(staffMember.uid);
    onMessage("");
    onError("");

    try {
      const sent = await sendStaffInviteEmail(staffMember.email);
      if (!sent) {
        throw new Error("Firebase chưa gửi được email mời. Kiểm tra mẫu email và tên miền Auth.");
      }
      onMessage(`Đã gửi lại email mời tới ${staffMember.email}.`);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Không gửi lại được email mời");
    } finally {
      setBusyId("");
    }
  }

  async function saveStaff(staffMember: StaffProfile, payload: Partial<StaffProfile>) {
    setBusyId(staffMember.uid);
    onMessage("");
    onError("");

    try {
      await updateStaffProfile({
        salonId,
        uid: staffMember.uid,
        name: payload.name,
        phone: payload.phone,
        isActive: payload.isActive,
        canRedeemRewards: payload.canRedeemRewards,
        branchIds: payload.branchIds,
      });
      setStaff((current) =>
        current
          .map((item) => (item.uid === staffMember.uid ? { ...item, ...payload } : item))
          .sort((a, b) => a.name.localeCompare(b.name, "vi")),
      );
      onMessage("Đã cập nhật nhân viên.");
    } catch (err) {
      onError(err instanceof Error ? err.message : "Không cập nhật được nhân viên");
    } finally {
      setBusyId("");
    }
  }

  return (
    <div className="panel">
      <div className="section-heading">
        <UserPlus size={22} aria-hidden="true" />
        <div>
          <h2>Quản lý nhân viên</h2>
          <p className="muted">Mời nhân viên bằng email để họ tự đặt mật khẩu.</p>
        </div>
      </div>

      <div className="staff-create-grid">
        <input
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="Email nhân viên"
        />
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Tên nhân viên"
        />
        <input
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          placeholder="SĐT nội bộ"
        />
        <select
          value={selectedBranchId}
          onChange={(event) => setSelectedBranchId(event.target.value)}
        >
          <option value="">Chọn chi nhánh làm việc</option>
          {branches.map((branch) => (
            <option key={branch.id} value={branch.id}>
              {branch.name}
            </option>
          ))}
        </select>
        <label className="toggle-row inline-toggle">
          <input
            type="checkbox"
            checked={canRedeemRewards}
            onChange={(event) => setCanRedeemRewards(event.target.checked)}
          />
          <span>Cho đổi mã quà</span>
        </label>
        <button
          className="primary-button"
          disabled={busyId === "new" || !email.trim() || !name.trim() || !selectedBranchId}
          onClick={addStaff}
        >
          <UserPlus size={18} aria-hidden="true" />
          Tạo lời mời
        </button>
      </div>

      <div className="ops-list">
        {loading ? (
          <div className="empty-state compact-empty">
            <UsersRound size={28} aria-hidden="true" />
            <strong>Đang tải nhân viên</strong>
            <p>Danh sách tài khoản sẽ hiện ở đây.</p>
          </div>
        ) : staff.length === 0 ? (
          <div className="empty-state compact-empty">
            <UsersRound size={28} aria-hidden="true" />
            <strong>Chưa có nhân viên</strong>
            <p>Thêm nhân viên để họ đăng nhập vào trang staff.</p>
          </div>
        ) : (
          staff.map((staffMember) => (
            <StaffCard
              key={staffMember.uid}
              staff={staffMember}
              branches={branches}
              busy={busyId === staffMember.uid}
              onSave={saveStaff}
              onRenewInvite={resendInvite}
            />
          ))
        )}
      </div>
    </div>
  );
}

function StaffCard({
  staff,
  branches,
  busy,
  onSave,
  onRenewInvite,
}: {
  staff: StaffProfile;
  branches: SalonBranch[];
  busy: boolean;
  onSave: (staff: StaffProfile, payload: Partial<StaffProfile>) => void;
  onRenewInvite: (staff: StaffProfile) => void;
}) {
  const [name, setName] = useState(staff.name);
  const [phone, setPhone] = useState(staff.phone);
  const [branchId, setBranchId] = useState(staff.branchId || staff.branchIds[0] || "");

  useEffect(() => {
    setName(staff.name);
    setPhone(staff.phone);
    setBranchId(staff.branchId || staff.branchIds[0] || "");
  }, [staff.branchId, staff.branchIds, staff.name, staff.phone]);

  return (
    <article className="ops-card static-card management-card">
      <div className="management-card-header">
        <span className="ops-card-title">{staff.name || staff.uid}</span>
        <span className={staff.isActive ? "pill" : "pill muted-pill"}>
          {staff.isActive ? "Đang hoạt động" : "Đã tắt"}
        </span>
      </div>
      {staff.email ? <span>{staff.email}</span> : null}
      <small>
        {staff.inviteStatus === "pending" ? "Chờ nhân viên đặt mật khẩu" : "Tài khoản đã kích hoạt"}
      </small>
      <div className="staff-edit-grid">
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Tên nhân viên"
        />
        <input
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          placeholder="SĐT nội bộ"
        />
        <select value={branchId} onChange={(event) => setBranchId(event.target.value)}>
          {branches.map((branch) => (
            <option key={branch.id} value={branch.id}>
              {branch.name}
            </option>
          ))}
        </select>
      </div>
      <div className="button-row wrap-row">
        <button
          className="secondary-button"
          disabled={busy}
          onClick={() => onSave(staff, { name, phone, branchId, branchIds: [branchId] })}
        >
          <Save size={18} aria-hidden="true" />
          Lưu
        </button>
        {staff.inviteStatus === "pending" ? (
          <button className="secondary-button" disabled={busy} onClick={() => onRenewInvite(staff)}>
            <RefreshCcw size={18} aria-hidden="true" />
            Gửi lại email mời
          </button>
        ) : null}
        <button
          className="secondary-button"
          disabled={busy}
          onClick={() => onSave(staff, { isActive: !staff.isActive })}
        >
          <Power size={18} aria-hidden="true" />
          {staff.isActive ? "Tắt" : "Bật"}
        </button>
        <button
          className="secondary-button"
          disabled={busy}
          onClick={() => onSave(staff, { canRedeemRewards: !staff.canRedeemRewards })}
        >
          <TicketCheck size={18} aria-hidden="true" />
          {staff.canRedeemRewards ? "Tắt đổi quà" : "Cho đổi quà"}
        </button>
      </div>
    </article>
  );
}

function CustomerSearchPanel({
  salonId,
  onMessage,
  onError,
  onConfirm,
}: {
  salonId: string;
  onMessage: (message: string) => void;
  onError: (message: string) => void;
  onConfirm: (request: ConfirmRequest) => void;
}) {
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<CustomerLookupResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyCustomerId, setBusyCustomerId] = useState("");
  const [detailsCustomerId, setDetailsCustomerId] = useState("");
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [searchedTerm, setSearchedTerm] = useState("");
  const compactTerm = term.trim().replace(/\s/g, "");
  const termDigits = compactTerm.replace(/\D/g, "");
  const isNumericTerm = compactTerm.length > 0 && termDigits.length === compactTerm.length;
  const canSearch = term.trim().length >= 2 && (!isNumericTerm || termDigits.length === 4);

  async function search(loadMore = false) {
    const normalizedTerm = term.trim();
    const append = loadMore && normalizedTerm === searchedTerm && Boolean(nextCursor);
    setLoading(true);
    onMessage("");
    onError("");

    try {
      const page = await searchSalonCustomers({
        salonId,
        term: normalizedTerm,
        cursor: append ? nextCursor : null,
        pageSize: 10,
      });
      setResults((current) => (append ? [...current, ...page.customers] : page.customers));
      setNextCursor(page.nextCursor);
      setSearchedTerm(normalizedTerm);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Không tìm được khách");
    } finally {
      setLoading(false);
    }
  }

  async function copyReward(code: string) {
    await navigator.clipboard.writeText(code);
    onMessage("Đã copy mã quà.");
  }

  async function loadCustomerDetails(customerId: string) {
    setDetailsCustomerId(customerId);
    onMessage("");
    onError("");
    try {
      const details = await getSalonCustomerDetails({ salonId, customerId });
      setResults((current) =>
        current.map((customer) => (customer.id === customerId ? details : customer)),
      );
    } catch (err) {
      onError(err instanceof Error ? err.message : "Không tải được hồ sơ khách");
    } finally {
      setDetailsCustomerId("");
    }
  }

  function deleteCustomer(customer: CustomerLookupResult) {
    onConfirm({
      title: "Xóa dữ liệu khách?",
      description: `Xóa toàn bộ hồ sơ, lịch sử, mã quà và ảnh đã lưu của ${customer.name}. Thao tác này không thể hoàn tác trong app.`,
      confirmLabel: "Xóa dữ liệu",
      tone: "danger",
      onConfirm: () => deleteCustomerAfterConfirm(customer),
    });
  }

  async function deleteCustomerAfterConfirm(customer: CustomerLookupResult) {
    setBusyCustomerId(customer.id);
    onMessage("");
    onError("");

    try {
      const result = await deleteCustomerData({ salonId, customerId: customer.id });
      setResults((current) => current.filter((item) => item.id !== customer.id));
      onMessage(
        `Đã xóa dữ liệu khách: ${result.deletedRecords} lịch sử, ${result.deletedRewards} mã quà, ${result.deletedStorageFiles} ảnh.`,
      );
    } catch (err) {
      onError(err instanceof Error ? err.message : "Không xóa được dữ liệu khách");
    } finally {
      setBusyCustomerId("");
    }
  }

  return (
    <div className="panel">
      <div className="section-heading">
        <Search size={22} aria-hidden="true" />
        <div>
          <h2>Tìm khách</h2>
          <p className="muted">
            Tìm theo tên, phần đầu một từ hoặc đúng 4 số cuối SĐT để xem điểm, lịch sử và mã quà.
          </p>
        </div>
      </div>

      <div className="inline-form">
        <input
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && canSearch) {
              void search(false);
            }
          }}
          placeholder="Ví dụ: Anh Tân hoặc 8761"
        />
        <button
          className="primary-button"
          disabled={loading || !canSearch}
          onClick={() => void search(false)}
        >
          <Search size={18} aria-hidden="true" />
          Tìm
        </button>
      </div>

      <div className="ops-list">
        {results.length === 0 ? (
          <div className="empty-state compact-empty">
            <Search size={28} aria-hidden="true" />
            <strong>{loading ? "Đang tìm khách" : "Chưa có kết quả"}</strong>
            <p>Nhập ít nhất 2 ký tự hoặc 4 số cuối SĐT để tìm nhanh.</p>
          </div>
        ) : (
          results.map((customer) => (
            <article className="ops-card static-card customer-result-card" key={customer.id}>
              <div className="management-card-header">
                <span className="ops-card-title">{customer.name}</span>
                <span className="pill">{customer.points} điểm</span>
              </div>
              <span>SĐT: {ownerPhoneLabel(customer)}</span>
              <span>Lần ghé gần nhất: {formatDateTime(customer.lastVisitAtMs) || "Chưa có"}</span>

              {customer.detailsLoaded ? (
                <div className="customer-insight-grid">
                  <div>
                    <strong>Lịch sử gần đây</strong>
                    {customer.recentRecords.length === 0 ? (
                      <small>Chưa có lịch sử</small>
                    ) : (
                      customer.recentRecords.map((record) => (
                        <small key={record.id}>
                          {formatDateTime(record.createdAtMs)} · {record.staffName || "Nhân viên"} ·{" "}
                          {record.note || "Không ghi chú"}
                        </small>
                      ))
                    )}
                  </div>
                  <div>
                    <strong>Mã quà chưa dùng</strong>
                    {customer.unusedRewards.length === 0 ? (
                      <small>Không có mã quà</small>
                    ) : (
                      customer.unusedRewards.map((reward) => (
                        <button
                          className="reward-code-button"
                          key={reward.id}
                          type="button"
                          onClick={() => copyReward(reward.rewardCode)}
                        >
                          <Gift size={16} aria-hidden="true" />
                          {reward.rewardName}: {reward.rewardCode}
                        </button>
                      ))
                    )}
                  </div>
                </div>
              ) : (
                <button
                  className="secondary-button"
                  type="button"
                  disabled={detailsCustomerId === customer.id}
                  onClick={() => void loadCustomerDetails(customer.id)}
                >
                  <UserRound size={18} aria-hidden="true" />
                  {detailsCustomerId === customer.id ? "Đang tải hồ sơ..." : "Xem hồ sơ chi tiết"}
                </button>
              )}

              <div className="button-row wrap-row">
                <button
                  className="secondary-button danger-button"
                  disabled={busyCustomerId === customer.id}
                  onClick={() => deleteCustomer(customer)}
                >
                  <Trash2 size={18} aria-hidden="true" />
                  {busyCustomerId === customer.id ? "Đang xóa..." : "Xóa dữ liệu khách"}
                </button>
              </div>
            </article>
          ))
        )}
      </div>
      {nextCursor && results.length > 0 ? (
        <button
          className="secondary-button customer-load-more"
          type="button"
          disabled={loading}
          onClick={() => void search(true)}
        >
          <RefreshCcw size={18} aria-hidden="true" />
          {loading ? "Đang tải..." : "Xem thêm khách"}
        </button>
      ) : null}
    </div>
  );
}

function WheelConfigPanel({
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

  return (
    <div className="panel">
      <div className="detail-stack">
        <div className="section-heading">
          <Settings2 size={22} aria-hidden="true" />
          <div>
            <h2>Cấu hình vòng quay</h2>
            <p className="muted">Chủ salon có thể đổi điểm cần quay và nội dung từng ô.</p>
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
            <div className="wheel-slot-row" key={index}>
              <span>{index + 1}</span>
              <input
                value={slot.label}
                maxLength={60}
                onChange={(event) => updateSlot(index, event.target.value)}
                placeholder={`Ô ${index + 1}`}
              />
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
