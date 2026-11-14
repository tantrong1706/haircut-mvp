import { defaultLuckyWheelConfig } from "../../src/services/types";
const salonId = "fixture-owner-salon-not-an-account-number";
const branches = [
  {
    id: "branch-fixture",
    salonId,
    name: "Chi nhánh Nguyễn Văn Linh",
    address: "Địa chỉ mẫu để kiểm thử cách xuống dòng trên điện thoại",
    phone: "",
    qrUrl: "https://example.test/checkin",
    isActive: true,
  },
];
export const getBranchQrSettings = async () => ({
  salonQrUrl: "https://example.test/checkin",
  branches,
});
export const getSalonProfile = async () => ({
  id: salonId,
  name: "CH Hair Studio",
  address: "Địa chỉ salon mẫu",
  phone: "",
  avatarUrl: "",
  pointPerVisit: 1,
  freeCustomerLimit: 50,
});
export const getLuckyWheelConfig = async () => structuredClone(defaultLuckyWheelConfig);
export const getOwnerOverview = async () => ({
  customersToday: 30,
  customers7Days: 128,
  customers30Days: 560,
  pendingRequests: 3,
  pointsApprovedToday: 24,
  spinsToday: 5,
  unusedRewards: 12,
  inactiveCustomers: [
    {
      id: "customer-fixture",
      name: "Khách hàng có tên dài Nguyễn Hoàng Minh",
      phoneLast4: "5678",
      points: 7,
      lastVisitAtMs: 1780000000000,
      daysSinceLastVisit: 40,
    },
  ],
});
export const listenPendingPointRequests = (
  _salon: string,
  _branch: string | null,
  next: (items: unknown[]) => void,
) => {
  next([
    {
      id: "request-fixture",
      salonId,
      branchId: "branch-fixture",
      branchName: branches[0].name,
      sessionId: "session-fixture",
      customerId: "customer-fixture",
      staffName: "Nhân viên mẫu",
      note: "Giữ form tóc, tỉa gọn hai bên.",
      photoUrls: [],
      photoPaths: [],
      photoReadUrls: {},
      pointsAdded: 1,
      status: "pending",
      createdAtMs: 1780000000000,
      customer: {
        id: "customer-fixture",
        name: "Khách hàng có tên dài Nguyễn Hoàng Minh",
        phoneLast4: "5678",
        points: 7,
        allowPhoto: false,
      },
    },
  ]);
  return () => undefined;
};
export const listenStaffProfiles = (_salon: string, next: (items: unknown[]) => void) => {
  next([]);
  return () => undefined;
};
export const searchSalonCustomers = async () => ({ customers: [], nextCursor: null });
const fixtureReward = { id: "fixture-reward", rewardName: "Gội đầu kiểm thử", expiresAtMs: null };
export const listRedeemableCustomerRewards = async (input: {
  customerId: string;
  branchId: string;
  phoneLast4: string;
}) => {
  if (
    input.customerId !== "customer-fixture" ||
    input.branchId !== "branch-fixture" ||
    input.phoneLast4 !== "5678"
  ) {
    throw new Error("Fixture reward identity mismatch");
  }
  return { rewards: [fixtureReward], nextCursor: null };
};
export const redeemCustomerReward = async (input: {
  rewardId: string;
  customerId: string;
  branchId: string;
  phoneLast4: string;
}) => {
  await listRedeemableCustomerRewards(input);
  if (input.rewardId !== fixtureReward.id) throw new Error("Fixture reward mismatch");
  return { rewardId: fixtureReward.id, alreadyRedeemed: false };
};
let directoryName = "Khách mẫu trong danh bạ";
export const adjustSalonCustomerPoints = async (input: {
  customerId: string;
  expectedPoints: number;
  delta: number;
  reason: string;
}) => {
  if (
    input.customerId !== "customer-fixture" ||
    input.expectedPoints !== 7 ||
    input.delta !== -2 ||
    !input.reason.trim()
  ) {
    throw new Error("Fixture point adjustment mismatch");
  }
  return { pointsBefore: 7, pointsAfter: 5, currentPoints: 5, alreadyProcessed: false };
};
export const updateCustomerName = async (input: {
  customerId: string;
  name: string;
  expectedName: string;
}) => {
  if (input.customerId !== "customer-fixture" || input.expectedName !== directoryName)
    throw new Error("Fixture blocks edits to other customers or stale names");
  directoryName = input.name.trim();
  return { customerId: input.customerId, name: directoryName };
};
const manualCustomers: Array<{
  id: string;
  name: string;
  phoneLast4: string;
  points: number;
  allowPhoto: boolean;
  detailsLoaded: boolean;
  recentRecords: [];
  unusedRewards: [];
}> = [];
export const createManualCustomer = async (input: {
  salonId: string;
  name: string;
  phone?: string;
}) => {
  if (input.salonId !== salonId) throw new Error("Fixture only accepts the expected salon");
  const id = `fixture-manual-${manualCustomers.length + 1}`;
  manualCustomers.push({
    id,
    name: input.name,
    phoneLast4: input.phone?.slice(-4) ?? "",
    points: 0,
    allowPhoto: false,
    detailsLoaded: false,
    recentRecords: [],
    unusedRewards: [],
  });
  return { customerId: id };
};
export const listSalonCustomerDirectory = async () => ({
  customers: [
    {
      id: "customer-fixture",
      name: directoryName,
      phoneLast4: "5678",
      points: 7,
      allowPhoto: false,
      detailsLoaded: false,
      recentRecords: [],
      unusedRewards: [],
    },
    ...manualCustomers,
  ],
  nextCursor: null,
  totalCount: 1 + manualCustomers.length,
});
// Only local text drafts are allowed; points/deletions stay blocked below.
export const savePendingVisitNote = async (input: { note: string }) => {
  if (input.note === "simulate-failure") throw new Error("Không lưu được ghi chú mẫu");
};
export const formatDateTime = () => "20/10/2026 · 09:30";
// All write actions are blocked in this browser-only fixture.
const noWrite = async () => {
  throw new Error("Fixture blocks all business writes");
};
export const awardReturningCustomerPoints = noWrite;
export const approvePointRequest = noWrite,
  createBranch = noWrite,
  createStaffProfile = noWrite,
  deleteCustomerData = noWrite,
  getSalonCustomerDetails = noWrite,
  migrateSalonBranches = noWrite,
  rejectPointRequest = noWrite,
  rotateBranchQr = noWrite,
  sendStaffInviteEmail = noWrite,
  saveLuckyWheelConfig = noWrite,
  updateBranch = noWrite,
  updatePendingPointRequestPhotos = noWrite,
  updateSalonProfile = noWrite,
  updateStaffProfile = noWrite,
  lookupRewardCode = noWrite,
  redeemRewardCode = noWrite,
  restoreRewardCode = noWrite;
