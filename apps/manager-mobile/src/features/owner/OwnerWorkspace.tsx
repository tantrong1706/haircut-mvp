import { ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { ConfirmDialog, type ConfirmDialogRequest } from "../../components/ConfirmDialog";
import { ErrorState } from "../../components/Feedback";
import { useManagerNative } from "../../hooks/useManagerNative";
import { ManagerLayout } from "../../layouts/ManagerLayout";
import {
  ownerTabFromRoute,
  type OwnerManagementSection,
  type OwnerPrimaryTab,
} from "../../navigation/managerNavigation";
import {
  getBranchQrSettings,
  getOwnerOverview,
  getSalonProfile,
  listenActiveSessions,
  listenPendingPointRequests,
  type AppUser,
  type OwnerOverview,
  type PointRequest,
  type SalonBranch,
  type SalonProfile,
  type StaffSession,
} from "../../services/managerApi";
import { trackEvent } from "../../services/monitoring";
import { useManagerFeatures } from "../useManagerFeatures";
import { OwnerApprovalsScreen } from "./OwnerApprovalsScreen";
import { OwnerCustomersScreen } from "./OwnerCustomersScreen";
import { OwnerManagementScreen } from "./OwnerManagementScreen";
import { OwnerSettingsScreen } from "./OwnerSettingsScreen";
import { OwnerTodayScreen } from "./OwnerTodayScreen";

export function OwnerWorkspace({ currentUser }: { currentUser: AppUser }) {
  const salonId = currentUser.salonId.trim();
  const [user, setUser] = useState(currentUser);
  const [activeTab, setActiveTab] = useState<OwnerPrimaryTab>("today");
  const [managementSection, setManagementSection] = useState<OwnerManagementSection | null>(null);
  const [branchFilter, setBranchFilter] = useState("all");
  const [branches, setBranches] = useState<SalonBranch[]>([]);
  const [profile, setProfile] = useState<SalonProfile | null>(null);
  const [overview, setOverview] = useState<OwnerOverview | null>(null);
  const [requests, setRequests] = useState<PointRequest[]>([]);
  const [sessions, setSessions] = useState<StaffSession[]>([]);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [overviewError, setOverviewError] = useState("");
  const [confirm, setConfirm] = useState<ConfirmDialogRequest | null>(null);
  const [confirming, setConfirming] = useState(false);
  const native = useManagerNative();
  const managerFeatures = useManagerFeatures(profile);

  const refreshOverview = useCallback(
    async (silent = false) => {
      if (!salonId) return;
      if (!silent) setOverviewLoading(true);
      setOverviewError("");
      try {
        setOverview(await getOwnerOverview(salonId, branchFilter === "all" ? null : branchFilter));
      } catch (caught) {
        setOverviewError(caught instanceof Error ? caught.message : "Không tải được tổng quan.");
      } finally {
        if (!silent) setOverviewLoading(false);
      }
    },
    [branchFilter, salonId],
  );

  useEffect(() => {
    setUser(currentUser);
  }, [currentUser]);

  useEffect(() => {
    const navigate = (event: Event) => {
      const route = String((event as CustomEvent<string>).detail || "");
      const tab = ownerTabFromRoute(route);
      if (tab) setActiveTab(tab);
      const normalized = route.toLowerCase();
      if (normalized.includes("reward")) setManagementSection("redeem");
      else if (normalized.includes("branch") || normalized.includes("qr")) {
        setManagementSection("branches");
      } else if (normalized.includes("staff")) setManagementSection("staff");
      else if (normalized.includes("wheel")) setManagementSection("wheel");
      else if (normalized.includes("audit")) setManagementSection("audit");
    };
    window.addEventListener("haircut:navigate", navigate);
    return () => window.removeEventListener("haircut:navigate", navigate);
  }, []);

  useEffect(() => {
    if (!salonId) return;
    void Promise.all([getSalonProfile(salonId), getBranchQrSettings(salonId)])
      .then(([nextProfile, qrSettings]) => {
        setProfile(nextProfile);
        setBranches(qrSettings.branches);
      })
      .catch((caught) =>
        setOverviewError(caught instanceof Error ? caught.message : "Không tải được salon."),
      );
  }, [salonId]);

  useEffect(() => {
    if (!salonId) return;
    void refreshOverview();
    const refreshVisible = () => {
      if (document.visibilityState === "visible") void refreshOverview(true);
    };
    const timer = window.setInterval(refreshVisible, 60_000);
    window.addEventListener("focus", refreshVisible);
    document.addEventListener("visibilitychange", refreshVisible);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refreshVisible);
      document.removeEventListener("visibilitychange", refreshVisible);
    };
  }, [refreshOverview, salonId]);

  useEffect(() => {
    if (!salonId) return undefined;
    return listenPendingPointRequests(
      salonId,
      branchFilter === "all" ? null : branchFilter,
      (next) => {
        setRequests(next);
        setOverview((current) =>
          current ? { ...current, pendingRequests: next.length } : current,
        );
      },
      setOverviewError,
    );
  }, [branchFilter, salonId]);

  useEffect(() => {
    if (!salonId) return undefined;
    return listenActiveSessions(
      salonId,
      branchFilter === "all" ? null : [branchFilter],
      (next) => {
        setSessions(next);
        setOverviewError("");
      },
      setOverviewError,
    );
  }, [branchFilter, salonId]);

  useEffect(() => {
    trackEvent("manager_owner_tab_opened", { salon_id: salonId, tab: activeTab });
  }, [activeTab, salonId]);

  function openManagement(section: OwnerManagementSection) {
    setManagementSection(section);
    setActiveTab("management");
  }

  async function runConfirm() {
    if (!confirm) return;
    setConfirming(true);
    try {
      await confirm.onConfirm();
      setConfirm(null);
    } finally {
      setConfirming(false);
    }
  }

  if (!salonId) {
    return (
      <main className="manager-startup-error">
        <ShieldCheck aria-hidden="true" />
        <h1>Tài khoản chưa có salon</h1>
        <p>Đăng xuất rồi đăng nhập lại để hoàn tất hồ sơ salon.</p>
      </main>
    );
  }

  if (managerFeatures.isEnabled("maintenanceMode")) {
    return (
      <main className="manager-startup-error">
        <ShieldCheck aria-hidden="true" />
        <h1>HAIRCUT Manager đang bảo trì</h1>
        <p>Các thao tác quản lý đang tạm ngừng để bảo vệ dữ liệu. Vui lòng thử lại sau.</p>
      </main>
    );
  }

  return (
    <ManagerLayout
      user={user}
      salonName={profile?.name || "Salon của bạn"}
      activeOwnerTab={activeTab}
      onOwnerTabChange={(tab) => {
        setActiveTab(tab);
        if (tab !== "management") setManagementSection(null);
      }}
      badgeCounts={{ approvals: requests.length }}
    >
      {activeTab === "today" ? (
        <OwnerTodayScreen
          overview={overview}
          sessions={sessions}
          loading={overviewLoading}
          error={overviewError}
          branches={branches}
          branchFilter={branchFilter}
          onBranchFilterChange={setBranchFilter}
          onRefresh={() => void refreshOverview()}
          onOpenTab={setActiveTab}
          onOpenManagement={openManagement}
        />
      ) : activeTab === "customers" ? (
        <OwnerCustomersScreen
          salonId={salonId}
          sessions={sessions}
          branchId={branchFilter === "all" ? null : branchFilter}
          onConfirm={setConfirm}
        />
      ) : activeTab === "approvals" ? (
        <OwnerApprovalsScreen
          salonId={salonId}
          requests={requests}
          branches={branches}
          branchFilter={branchFilter}
          onBranchFilterChange={setBranchFilter}
          onRequestsChange={setRequests}
          onRefreshOverview={() => void refreshOverview(true)}
          onConfirm={setConfirm}
          pointApprovalEnabled={managerFeatures.isEnabled("pointApprovalEnabled")}
          photoUploadEnabled={managerFeatures.isEnabled("photoUploadEnabled")}
        />
      ) : activeTab === "management" ? (
        <OwnerManagementScreen
          salonId={salonId}
          initialSection={managementSection}
          branchFilter={branchFilter}
          onBranchesChange={setBranches}
          onConfirm={setConfirm}
          onOpenScanner={() => void native.scanReward()}
          onOpenTab={setActiveTab}
          features={managerFeatures.features}
        />
      ) : profile ? (
        <OwnerSettingsScreen
          user={user}
          profile={profile}
          biometricEnabled={native.biometricEnabled}
          nativeReady={native.nativeReady}
          online={native.online}
          onProfileChange={setProfile}
          onOwnerAvatarChange={(avatarUrl) => setUser((current) => ({ ...current, avatarUrl }))}
          onToggleBiometric={native.toggleBiometric}
        />
      ) : (
        <div className="manager-screen">
          <ErrorState
            description={overviewError || "Không tải được cấu hình salon."}
            onRetry={() =>
              void getSalonProfile(salonId)
                .then(setProfile)
                .catch((caught) =>
                  setOverviewError(
                    caught instanceof Error ? caught.message : "Không tải được salon.",
                  ),
                )
            }
          />
        </div>
      )}

      <ConfirmDialog
        request={confirm}
        busy={confirming}
        onCancel={() => {
          if (!confirming) setConfirm(null);
        }}
        onConfirm={() => void runConfirm()}
      />
    </ManagerLayout>
  );
}
