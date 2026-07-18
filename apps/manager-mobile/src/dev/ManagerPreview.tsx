import { useState } from "react";
import { ManagerLayout } from "../layouts/ManagerLayout";
import { type OwnerPrimaryTab, type StaffPrimaryTab } from "../navigation/managerNavigation";
import type {
  AppUser,
  OwnerOverview,
  PointRequest,
  SalonBranch,
  StaffSession,
} from "../services/managerApi";
import { OwnerApprovalsScreen } from "../features/owner/OwnerApprovalsScreen";
import { OwnerCustomersScreen } from "../features/owner/OwnerCustomersScreen";
import { OwnerManagementScreen } from "../features/owner/OwnerManagementScreen";
import { OwnerTodayScreen } from "../features/owner/OwnerTodayScreen";
import { StaffActiveScreen } from "../features/staff/StaffActiveScreen";
import { StaffQueueScreen } from "../features/staff/StaffQueueScreen";

const owner: AppUser = {
  uid: "preview-owner",
  salonId: "preview-salon",
  name: "Tấn Trọng",
  avatarUrl: "",
  role: "owner",
  isActive: true,
};

const staff: AppUser = {
  uid: "preview-staff",
  salonId: "preview-salon",
  name: "Minh Anh",
  avatarUrl: "",
  role: "staff",
  isActive: true,
  canRedeemRewards: true,
  branchId: "branch-main",
  branchIds: ["branch-main"],
};

const branches: SalonBranch[] = [
  {
    id: "branch-main",
    salonId: "preview-salon",
    name: "Chi nhánh trung tâm",
    address: "128 Nguyễn Văn Linh, Đà Nẵng",
    phone: "0838098761",
    qrUrl: "https://example.com/preview",
    isActive: true,
  },
  {
    id: "branch-two",
    salonId: "preview-salon",
    name: "Chi nhánh ven sông",
    address: "36 Bạch Đằng, Đà Nẵng",
    phone: "0838098761",
    qrUrl: "https://example.com/preview-two",
    isActive: true,
  },
];

const overview: OwnerOverview = {
  customersToday: 18,
  customers7Days: 96,
  customers30Days: 342,
  pendingRequests: 3,
  pointsApprovedToday: 14,
  spinsToday: 7,
  unusedRewards: 5,
  inactiveCustomers: [
    {
      id: "customer-1",
      name: "Anh Hoàng",
      phone: "0838098761",
      phoneLast4: "8761",
      points: 8,
      lastVisitAtMs: Date.now() - 36 * 24 * 60 * 60 * 1000,
      daysSinceLastVisit: 36,
    },
    {
      id: "customer-2",
      name: "Chị Ngọc",
      phone: "0905123456",
      phoneLast4: "3456",
      points: 4,
      lastVisitAtMs: Date.now() - 42 * 24 * 60 * 60 * 1000,
      daysSinceLastVisit: 42,
    },
  ],
};

const requests: PointRequest[] = [
  {
    id: "request-1",
    salonId: "preview-salon",
    branchId: "branch-main",
    branchName: "Chi nhánh trung tâm",
    sessionId: "session-1",
    customerId: "customer-1",
    staffName: "Minh Anh",
    note: "Fade thấp, giữ mái, tỉa gọn hai bên.",
    photoUrls: [],
    pointsAdded: 1,
    status: "pending",
    createdAtMs: Date.now() - 8 * 60 * 1000,
    customer: {
      id: "customer-1",
      name: "Anh Hoàng",
      phone: "0838098761",
      phoneLast4: "8761",
      points: 8,
      allowPhoto: true,
    },
  },
];

const sessions: StaffSession[] = [
  {
    id: "session-1",
    salonId: "preview-salon",
    branchId: "branch-main",
    branchName: "Chi nhánh trung tâm",
    branchAddress: "128 Nguyễn Văn Linh, Đà Nẵng",
    mirrorId: "",
    mirrorName: "",
    customerId: "customer-1",
    status: "waiting",
    assignedStaffId: "",
    assignedStaffName: "",
    claimedAtMs: null,
    createdAtMs: Date.now() - 4 * 60 * 1000,
    expiresAtMs: Date.now() + 60 * 60 * 1000,
    cancellationReason: "",
    customer: {
      id: "customer-1",
      name: "Anh Hoàng",
      phoneLast4: "8761",
      points: 8,
      allowPhoto: true,
    },
  },
  {
    id: "session-2",
    salonId: "preview-salon",
    branchId: "branch-main",
    branchName: "Chi nhánh trung tâm",
    branchAddress: "128 Nguyễn Văn Linh, Đà Nẵng",
    mirrorId: "",
    mirrorName: "",
    customerId: "customer-2",
    status: "serving",
    assignedStaffId: "preview-staff",
    assignedStaffName: "Minh Anh",
    claimedAtMs: Date.now() - 22 * 60 * 1000,
    createdAtMs: Date.now() - 28 * 60 * 1000,
    expiresAtMs: Date.now() + 60 * 60 * 1000,
    cancellationReason: "",
    customer: {
      id: "customer-2",
      name: "Chị Ngọc",
      phoneLast4: "3456",
      points: 4,
      allowPhoto: true,
    },
  },
  {
    id: "session-3",
    salonId: "preview-salon",
    branchId: "branch-main",
    branchName: "Chi nhánh trung tâm",
    branchAddress: "128 Nguyễn Văn Linh, Đà Nẵng",
    mirrorId: "",
    mirrorName: "",
    customerId: "customer-3",
    status: "pending_approval",
    assignedStaffId: "preview-staff",
    assignedStaffName: "Minh Anh",
    claimedAtMs: Date.now() - 40 * 60 * 1000,
    createdAtMs: Date.now() - 48 * 60 * 1000,
    expiresAtMs: null,
    cancellationReason: "",
    customer: {
      id: "customer-3",
      name: "Anh Nam",
      phoneLast4: "1122",
      points: 11,
      allowPhoto: false,
    },
  },
];

export function ManagerPreview({ scenario }: { scenario: string }) {
  if (scenario.startsWith("staff-")) return <StaffPreview scenario={scenario} />;
  return <OwnerPreview scenario={scenario} />;
}

function OwnerPreview({ scenario }: { scenario: string }) {
  const initialTab: OwnerPrimaryTab =
    scenario === "owner-customers"
      ? "customers"
      : scenario === "owner-approvals"
        ? "approvals"
        : scenario === "owner-management"
          ? "management"
          : "today";
  const [tab, setTab] = useState<OwnerPrimaryTab>(initialTab);
  const [branchFilter, setBranchFilter] = useState("all");
  const [previewRequests, setPreviewRequests] = useState(requests);

  return (
    <ManagerLayout
      user={owner}
      salonName="HAIRCUT Studio"
      activeOwnerTab={tab}
      onOwnerTabChange={setTab}
      badgeCounts={{ approvals: previewRequests.length }}
    >
      {tab === "today" ? (
        <OwnerTodayScreen
          overview={overview}
          sessions={sessions}
          loading={false}
          error=""
          branches={branches}
          branchFilter={branchFilter}
          onBranchFilterChange={setBranchFilter}
          onRefresh={() => undefined}
          onOpenTab={setTab}
          onOpenManagement={() => setTab("management")}
        />
      ) : tab === "customers" ? (
        <OwnerCustomersScreen
          salonId={owner.salonId}
          sessions={sessions}
          onConfirm={() => undefined}
        />
      ) : tab === "approvals" ? (
        <OwnerApprovalsScreen
          salonId={owner.salonId}
          requests={previewRequests}
          branches={branches}
          branchFilter={branchFilter}
          onBranchFilterChange={setBranchFilter}
          onRequestsChange={setPreviewRequests}
          onRefreshOverview={() => undefined}
          onConfirm={() => undefined}
        />
      ) : tab === "management" ? (
        <OwnerManagementScreen
          salonId={owner.salonId}
          initialSection={null}
          branchFilter={branchFilter}
          onBranchesChange={() => undefined}
          onConfirm={() => undefined}
          onOpenScanner={() => undefined}
          onOpenTab={setTab}
        />
      ) : (
        <OwnerTodayScreen
          overview={overview}
          sessions={sessions}
          loading={false}
          error=""
          branches={branches}
          branchFilter={branchFilter}
          onBranchFilterChange={setBranchFilter}
          onRefresh={() => undefined}
          onOpenTab={setTab}
          onOpenManagement={() => setTab("management")}
        />
      )}
    </ManagerLayout>
  );
}

function StaffPreview({ scenario }: { scenario: string }) {
  const initialTab: StaffPrimaryTab = scenario === "staff-active" ? "active" : "queue";
  const [tab, setTab] = useState<StaffPrimaryTab>(initialTab);
  const [branchFilter, setBranchFilter] = useState("branch-main");

  return (
    <ManagerLayout
      user={staff}
      salonName="HAIRCUT Studio"
      branchName="Chi nhánh trung tâm"
      activeStaffTab={tab}
      onStaffTabChange={setTab}
      badgeCounts={{ queue: 1, active: 1, history: 1 }}
    >
      {tab === "active" ? (
        <StaffActiveScreen
          sessions={sessions}
          currentUid={staff.uid}
          onOpenSession={() => undefined}
        />
      ) : (
        <StaffQueueScreen
          sessions={sessions}
          branches={branches}
          branchFilter={branchFilter}
          loading={false}
          error=""
          pointPerVisit={1}
          onBranchChange={setBranchFilter}
          onOpenSession={() => undefined}
          onRetry={() => undefined}
        />
      )}
    </ManagerLayout>
  );
}
