import { ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useManagerNative } from "../../hooks/useManagerNative";
import { ManagerLayout } from "../../layouts/ManagerLayout";
import {
  staffTabAfterSessionStatus,
  staffTabFromRoute,
  type StaffPrimaryTab,
} from "../../navigation/managerNavigation";
import {
  getBranchQrSettings,
  getSalonProfile,
  listenActiveSessions,
  type AppUser,
  type SalonBranch,
  type StaffSession,
  type UploadedHaircutPhoto,
} from "../../services/managerApi";
import { trackEvent } from "../../services/monitoring";
import { useManagerFeatures } from "../useManagerFeatures";
import { StaffAccountScreen } from "./StaffAccountScreen";
import { StaffActiveScreen } from "./StaffActiveScreen";
import { StaffHistoryScreen } from "./StaffHistoryScreen";
import { StaffQueueScreen } from "./StaffQueueScreen";
import { StaffRewardsScreen } from "./StaffRewardsScreen";
import { StaffSessionDetail } from "./StaffSessionDetail";

export function StaffWorkspace({ currentUser }: { currentUser: AppUser }) {
  const salonId = currentUser.salonId.trim();
  const assignedBranchIds = useMemo(
    () =>
      Array.from(
        new Set(
          [currentUser.branchId, ...(currentUser.branchIds || [])].filter(
            (value): value is string => Boolean(value),
          ),
        ),
      ),
    [currentUser.branchId, currentUser.branchIds],
  );
  const [activeTab, setActiveTab] = useState<StaffPrimaryTab>("queue");
  const [sessions, setSessions] = useState<StaffSession[]>([]);
  const [branches, setBranches] = useState<SalonBranch[]>([]);
  const [branchFilter, setBranchFilter] = useState(assignedBranchIds[0] || "");
  const [selectedId, setSelectedId] = useState("");
  const [pointPerVisit, setPointPerVisit] = useState(1);
  const [salonName, setSalonName] = useState("");
  const [salonProfile, setSalonProfile] = useState<Awaited<
    ReturnType<typeof getSalonProfile>
  > | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retryKey, setRetryKey] = useState(0);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [photos, setPhotos] = useState<Record<string, UploadedHaircutPhoto[]>>({});
  const native = useManagerNative();
  const managerFeatures = useManagerFeatures(salonProfile);

  const selectedSession = sessions.find((session) => session.id === selectedId) || null;
  const branchName =
    branches.find((branch) => branch.id === branchFilter)?.name || "Chi nhánh được phân công";
  const waitingCount = sessions.filter((session) => session.status === "waiting").length;
  const activeCount = sessions.filter(
    (session) => session.status === "serving" && session.assignedStaffId === currentUser.uid,
  ).length;
  const pendingCount = sessions.filter(
    (session) =>
      session.status === "pending_approval" &&
      (!session.assignedStaffId || session.assignedStaffId === currentUser.uid),
  ).length;

  useEffect(() => {
    const navigate = (event: Event) => {
      const route = String((event as CustomEvent<string>).detail || "");
      const tab = staffTabFromRoute(route);
      if (tab) setActiveTab(tab);
    };
    window.addEventListener("haircut:navigate", navigate);
    return () => window.removeEventListener("haircut:navigate", navigate);
  }, []);

  useEffect(() => {
    if (!salonId) return;
    void Promise.all([getBranchQrSettings(salonId), getSalonProfile(salonId)])
      .then(([settings, profile]) => {
        const allowed = new Set(assignedBranchIds);
        const accessible = settings.branches.filter(
          (branch) => branch.isActive && allowed.has(branch.id),
        );
        setBranches(accessible);
        setBranchFilter((current) =>
          accessible.some((branch) => branch.id === current)
            ? current
            : accessible[0]?.id || assignedBranchIds[0] || "",
        );
        setPointPerVisit(Math.max(1, Math.floor(profile.pointPerVisit || 1)));
        setSalonName(profile.name);
        setSalonProfile(profile);
      })
      .catch((caught) =>
        setError(caught instanceof Error ? caught.message : "Không tải được cấu hình nhân viên."),
      );
  }, [assignedBranchIds.join("|"), salonId]);

  useEffect(() => {
    if (!salonId || !branchFilter) {
      setLoading(false);
      setSessions([]);
      if (salonId) setError("Tài khoản chưa được phân công chi nhánh đang hoạt động.");
      return;
    }
    setLoading(true);
    setError("");
    return listenActiveSessions(
      salonId,
      [branchFilter],
      (next) => {
        setSessions(next);
        setLoading(false);
        setError("");
      },
      (nextError) => {
        setLoading(false);
        setError(nextError);
      },
    );
  }, [branchFilter, retryKey, salonId]);

  useEffect(() => {
    setSelectedId("");
  }, [activeTab, branchFilter]);

  useEffect(() => {
    trackEvent("manager_staff_tab_opened", { salon_id: salonId, tab: activeTab });
  }, [activeTab, salonId]);

  function openSession(session: StaffSession) {
    setSelectedId(session.id);
  }

  function updateSession(next: StaffSession) {
    setSessions((current) => current.map((session) => (session.id === next.id ? next : session)));
    setSelectedId(next.id);
    setActiveTab(staffTabAfterSessionStatus(next.status));
    if (next.status === "pending_approval") {
      window.setTimeout(() => setSelectedId(""), 0);
    }
  }

  function removeSession(sessionId: string) {
    setSessions((current) => current.filter((session) => session.id !== sessionId));
    setNotes((current) => {
      const next = { ...current };
      delete next[sessionId];
      return next;
    });
    setPhotos((current) => {
      const next = { ...current };
      delete next[sessionId];
      return next;
    });
    setSelectedId("");
    setActiveTab("queue");
  }

  if (!salonId) {
    return (
      <main className="manager-startup-error">
        <ShieldCheck aria-hidden="true" />
        <h1>Tài khoản chưa có salon</h1>
        <p>Vui lòng liên hệ chủ salon để kiểm tra phân quyền.</p>
      </main>
    );
  }

  if (managerFeatures.isEnabled("maintenanceMode")) {
    return (
      <main className="manager-startup-error">
        <ShieldCheck aria-hidden="true" />
        <h1>HAIRCUT Manager đang bảo trì</h1>
        <p>Hàng chờ và thao tác nhân viên đang tạm ngừng. Vui lòng thử lại sau.</p>
      </main>
    );
  }

  return (
    <ManagerLayout
      user={currentUser}
      salonName={salonName || "Salon của bạn"}
      branchName={branchName}
      activeStaffTab={activeTab}
      onStaffTabChange={setActiveTab}
      badgeCounts={{ queue: waitingCount, active: activeCount, history: pendingCount }}
    >
      {selectedSession ? (
        <StaffSessionDetail
          user={currentUser}
          session={selectedSession}
          pointPerVisit={pointPerVisit}
          photos={photos[selectedSession.id] || []}
          note={notes[selectedSession.id] || ""}
          onBack={() => setSelectedId("")}
          onSessionChange={updateSession}
          onSessionRemove={removeSession}
          onPhotosChange={(next) =>
            setPhotos((current) => ({ ...current, [selectedSession.id]: next }))
          }
          onNoteChange={(next) =>
            setNotes((current) => ({ ...current, [selectedSession.id]: next }))
          }
          photoUploadEnabled={managerFeatures.isEnabled("photoUploadEnabled")}
          pointApprovalEnabled={managerFeatures.isEnabled("pointApprovalEnabled")}
        />
      ) : activeTab === "queue" ? (
        <StaffQueueScreen
          sessions={sessions}
          branches={branches}
          branchFilter={branchFilter}
          loading={loading}
          error={error}
          pointPerVisit={pointPerVisit}
          onBranchChange={setBranchFilter}
          onOpenSession={openSession}
          onRetry={() => setRetryKey((value) => value + 1)}
        />
      ) : activeTab === "active" ? (
        <StaffActiveScreen
          sessions={sessions}
          currentUid={currentUser.uid}
          onOpenSession={openSession}
        />
      ) : activeTab === "rewards" ? (
        <StaffRewardsScreen
          salonId={salonId}
          branchId={branchFilter || undefined}
          pointPerVisit={pointPerVisit}
          canRedeem={
            currentUser.canRedeemRewards === true &&
            managerFeatures.isEnabled("rewardRedeemEnabled")
          }
          rewardRedeemEnabled={managerFeatures.isEnabled("rewardRedeemEnabled")}
          pointApprovalEnabled={managerFeatures.isEnabled("pointApprovalEnabled")}
          scanning={native.scanning}
          onOpenScanner={() => void native.scanReward()}
          onOpenActive={() => setActiveTab("active")}
        />
      ) : activeTab === "history" ? (
        <StaffHistoryScreen salonId={salonId} branchId={branchFilter} />
      ) : (
        <StaffAccountScreen
          user={currentUser}
          branchName={branchName}
          nativeReady={native.nativeReady}
          biometricEnabled={native.biometricEnabled}
          online={native.online}
          onToggleBiometric={native.toggleBiometric}
        />
      )}
    </ManagerLayout>
  );
}
