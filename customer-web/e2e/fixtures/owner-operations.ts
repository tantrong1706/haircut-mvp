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
export const listSalonCustomerDirectory = async () => ({
  customers: [
    {
      id: "customer-fixture",
      name: "Khách mẫu trong danh bạ",
      phoneLast4: "5678",
      points: 7,
      allowPhoto: false,
      detailsLoaded: false,
      recentRecords: [],
      unusedRewards: [],
    },
  ],
  nextCursor: null,
  totalCount: 1,
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
