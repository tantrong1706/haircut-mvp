import {
  ClipboardCheck,
  CalendarClock,
  Copy,
  Gift,
  RefreshCcw,
  Search,
  Trash2,
  UserRoundCheck,
  UsersRound,
} from "lucide-react";
import { useState } from "react";
import { type ConfirmDialogRequest } from "../../components/ConfirmDialog";
import { EmptyState, InlineFeedback } from "../../components/Feedback";
import { ScreenHeader, Section } from "../../components/ScreenPrimitives";
import {
  deleteCustomerData,
  formatDateTime,
  getManagerSessionHistory,
  getSalonCustomerDetails,
  searchSalonCustomers,
  type CustomerLookupResult,
  type ManagerSessionHistoryItem,
  type StaffSession,
} from "../../services/managerApi";
import { ownerPhoneLabel } from "./ownerFormatters";

export function OwnerCustomersScreen({
  salonId,
  sessions,
  branchId,
  onConfirm,
}: {
  salonId: string;
  sessions: StaffSession[];
  branchId?: string | null;
  onConfirm: (request: ConfirmDialogRequest) => void;
}) {
  const [mode, setMode] = useState<"operations" | "history" | "search">("operations");
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<CustomerLookupResult[]>([]);
  const [searched, setSearched] = useState(false);
  const [searchedTerm, setSearchedTerm] = useState("");
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [detailsId, setDetailsId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [sessionHistory, setSessionHistory] = useState<ManagerSessionHistoryItem[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [historyBranchId, setHistoryBranchId] = useState("");
  const compact = term.trim().replace(/\s/g, "");
  const digits = compact.replace(/\D/g, "");
  const numeric = compact.length > 0 && digits.length === compact.length;
  const canSearch = term.trim().length >= 2 && (!numeric || digits.length === 4);

  async function search(loadMore = false) {
    const normalized = term.trim();
    const append = loadMore && normalized === searchedTerm && Boolean(nextCursor);
    setLoading(true);
    setMessage("");
    setError("");
    try {
      const page = await searchSalonCustomers({
        salonId,
        term: normalized,
        cursor: append ? nextCursor : null,
        pageSize: 10,
      });
      setResults((current) => (append ? [...current, ...page.customers] : page.customers));
      setNextCursor(page.nextCursor);
      setSearchedTerm(normalized);
      setSearched(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không tìm được khách.");
    } finally {
      setLoading(false);
    }
  }

  async function loadCustomerDetails(customerId: string) {
    setDetailsId(customerId);
    setMessage("");
    setError("");
    try {
      const details = await getSalonCustomerDetails({
        salonId,
        customerId,
        branchId: branchId || undefined,
      });
      setResults((current) =>
        current.map((customer) => (customer.id === customerId ? details : customer)),
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không tải được hồ sơ khách.");
    } finally {
      setDetailsId("");
    }
  }

  async function openHistory(force = false) {
    setMode("history");
    const requestedBranchId = branchId || "";
    if (historyLoaded && historyBranchId === requestedBranchId && !force) return;
    setLoading(true);
    setError("");
    try {
      const result = await getManagerSessionHistory({ salonId, branchId, limit: 50 });
      setSessionHistory(result.sessions);
      setHistoryLoaded(true);
      setHistoryBranchId(requestedBranchId);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không tải được lịch sử lượt khách.");
    } finally {
      setLoading(false);
    }
  }

  async function removeCustomer(customer: CustomerLookupResult) {
    setBusyId(customer.id);
    setMessage("");
    setError("");
    try {
      const result = await deleteCustomerData({ salonId, customerId: customer.id });
      setResults((current) => current.filter((item) => item.id !== customer.id));
      setMessage(
        `Đã xóa ${result.deletedRecords} lịch sử, ${result.deletedRewards} mã quà và ${result.deletedStorageFiles} ảnh.`,
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không xóa được dữ liệu khách.");
    } finally {
      setBusyId("");
    }
  }

  return (
    <div className="manager-screen">
      <ScreenHeader
        eyebrow="Khách hàng"
        title={
          mode === "operations"
            ? "Lượt khách hiện tại"
            : mode === "history"
              ? "Lịch sử lượt khách"
              : "Tìm và xem hồ sơ"
        }
        description={
          mode === "operations"
            ? "Theo dõi khách đang chờ, đang phục vụ và chờ duyệt."
            : mode === "history"
              ? "Xem lượt hoàn tất, lượt hủy và khách không đến."
              : "Tìm theo tên hoặc đúng 4 số cuối điện thoại."
        }
      />

      <div className="manager-segmented three" aria-label="Chế độ xem khách">
        <button
          type="button"
          className={mode === "operations" ? "active" : ""}
          aria-pressed={mode === "operations"}
          onClick={() => setMode("operations")}
        >
          <UsersRound aria-hidden="true" />
          Lượt hiện tại
        </button>
        <button
          type="button"
          className={mode === "history" ? "active" : ""}
          aria-pressed={mode === "history"}
          onClick={() => void openHistory()}
        >
          <CalendarClock aria-hidden="true" />
          Lịch sử
        </button>
        <button
          type="button"
          className={mode === "search" ? "active" : ""}
          aria-pressed={mode === "search"}
          onClick={() => setMode("search")}
        >
          <Search aria-hidden="true" />
          Tìm khách
        </button>
      </div>

      {mode === "operations" ? (
        <OwnerSessionGroups sessions={sessions} />
      ) : mode === "history" ? (
        <OwnerSessionHistory
          sessions={sessionHistory}
          loading={loading}
          error={error}
          onRetry={() => void openHistory(true)}
        />
      ) : (
        <>
          <Section>
            <div className="manager-search-row">
              <label className="manager-field">
                <span className="sr-only">Tên hoặc 4 số cuối điện thoại</span>
                <input
                  value={term}
                  placeholder="Ví dụ: Anh Tân hoặc 8761"
                  onChange={(event) => setTerm(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && canSearch) void search(false);
                  }}
                />
              </label>
              <button
                className="manager-button primary"
                type="button"
                disabled={loading || !canSearch}
                onClick={() => void search(false)}
              >
                <Search aria-hidden="true" />
                {loading ? "Đang tìm..." : "Tìm"}
              </button>
            </div>
            <p className="manager-field-note">Số điện thoại chỉ tìm bằng đúng 4 số cuối.</p>
          </Section>

          {!searched && results.length === 0 ? (
            <EmptyState
              icon={<Search aria-hidden="true" />}
              title="Sẵn sàng tìm khách"
              description="Nhập ít nhất 2 ký tự tên hoặc 4 số cuối điện thoại."
            />
          ) : results.length === 0 && !loading ? (
            <EmptyState
              icon={<UsersRound aria-hidden="true" />}
              title="Không tìm thấy khách"
              description="Kiểm tra lại tên hoặc 4 số cuối rồi thử lại."
            />
          ) : (
            <div className="manager-list customer-list">
              {results.map((customer) => (
                <article className="manager-customer-card" key={customer.id}>
                  <div className="manager-card-heading">
                    <div>
                      <strong>{customer.name}</strong>
                      <span>{ownerPhoneLabel(customer)}</span>
                    </div>
                    <span className="manager-pill">{customer.points} điểm</span>
                  </div>
                  <dl className="manager-summary-list">
                    <div>
                      <dt>Lần ghé gần nhất</dt>
                      <dd>{formatDateTime(customer.lastVisitAtMs) || "Chưa có"}</dd>
                    </div>
                  </dl>

                  {!customer.detailsLoaded ? (
                    <button
                      className="manager-button secondary"
                      type="button"
                      disabled={detailsId === customer.id}
                      onClick={() => void loadCustomerDetails(customer.id)}
                    >
                      <UserRoundCheck aria-hidden="true" />
                      {detailsId === customer.id
                        ? "Đang tải hồ sơ..."
                        : "Xem hồ sơ chi tiết"}
                    </button>
                  ) : null}

                  <details hidden={!customer.detailsLoaded}>
                    <summary>Lịch sử gần đây ({customer.recentRecords.length})</summary>
                    {customer.recentRecords.length === 0 ? (
                      <p className="manager-field-note">Chưa có lịch sử.</p>
                    ) : (
                      <div className="manager-detail-list">
                        {customer.recentRecords.map((record) => (
                          <div key={record.id}>
                            <strong>
                              {formatDateTime(record.createdAtMs) || "Chưa rõ thời gian"}
                            </strong>
                            <span>
                              {record.staffName || "Nhân viên"} · +{record.pointsAdded} điểm
                            </span>
                            {record.branchName ? <small>{record.branchName}</small> : null}
                            <small>{record.note || "Không có ghi chú"}</small>
                            {record.photoUrls.length > 0 ? (
                              <div className="manager-photo-grid">
                                {record.photoUrls.map((url) => (
                                  <figure key={url}>
                                    <img
                                      src={url}
                                      alt={`Kiểu tóc của ${customer.name}`}
                                      loading="lazy"
                                    />
                                  </figure>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    )}
                  </details>

                  <details hidden={!customer.detailsLoaded}>
                    <summary>Chi nhánh từng ghé ({customer.branchVisits.length})</summary>
                    {customer.branchVisits.length === 0 ? (
                      <p className="manager-field-note">Chưa có dữ liệu chi nhánh.</p>
                    ) : (
                      <div className="manager-detail-list">
                        {customer.branchVisits.map((visit) => (
                          <div key={visit.branchId}>
                            <strong>{visit.branchName}</strong>
                            <span>Lần gần nhất: {formatDateTime(visit.lastVisitAtMs)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </details>

                  <details hidden={!customer.detailsLoaded}>
                    <summary>Lịch sử quà ({customer.rewardHistory.length})</summary>
                    {customer.rewardHistory.length === 0 ? (
                      <p className="manager-field-note">Khách chưa có lịch sử quà.</p>
                    ) : (
                      <div className="manager-detail-list">
                        {customer.rewardHistory.map((reward) => (
                          <div key={reward.id}>
                            <strong>{reward.rewardName || "Phần quà"}</strong>
                            <span>
                              {reward.status === "unused"
                                ? "Chưa dùng"
                                : reward.status === "used"
                                  ? "Đã dùng"
                                  : reward.status === "revoked"
                                    ? "Đã hủy"
                                    : "Hết hạn"}
                              {reward.rewardCode ? ` · ${reward.rewardCode}` : ""}
                            </span>
                            <small>{formatDateTime(reward.usedAtMs || reward.createdAtMs)}</small>
                          </div>
                        ))}
                      </div>
                    )}
                  </details>

                  <details hidden={!customer.detailsLoaded}>
                    <summary>Mã quà chưa dùng ({customer.unusedRewards.length})</summary>
                    {customer.unusedRewards.length === 0 ? (
                      <p className="manager-field-note">Khách chưa có mã quà.</p>
                    ) : (
                      <div className="manager-detail-list">
                        {customer.unusedRewards.map((reward) => (
                          <button
                            className="manager-reward-row"
                            type="button"
                            key={reward.id}
                            onClick={() =>
                              void navigator.clipboard
                                .writeText(reward.rewardCode)
                                .then(() => setMessage("Đã sao chép mã quà."))
                                .catch(() => setError("Thiết bị không cho phép sao chép."))
                            }
                          >
                            <Gift aria-hidden="true" />
                            <span>
                              <strong>{reward.rewardName}</strong>
                              <small>{reward.rewardCode}</small>
                            </span>
                            <Copy aria-hidden="true" />
                          </button>
                        ))}
                      </div>
                    )}
                  </details>

                  <button
                    className="manager-button danger subtle"
                    type="button"
                    disabled={busyId === customer.id}
                    onClick={() =>
                      onConfirm({
                        title: "Xóa toàn bộ dữ liệu khách?",
                        description: `Hồ sơ, lịch sử, mã quà và ảnh của ${customer.name} sẽ bị xóa. Thao tác không thể hoàn tác trong ứng dụng.`,
                        confirmLabel: "Xóa dữ liệu khách",
                        tone: "danger",
                        onConfirm: () => removeCustomer(customer),
                      })
                    }
                  >
                    <Trash2 aria-hidden="true" />
                    {busyId === customer.id ? "Đang xóa..." : "Xóa dữ liệu khách"}
                  </button>
                </article>
              ))}
            </div>
          )}

          {nextCursor && results.length > 0 ? (
            <button
              className="manager-button secondary manager-load-more"
              type="button"
              disabled={loading}
              onClick={() => void search(true)}
            >
              <RefreshCcw aria-hidden="true" />
              {loading ? "Đang tải..." : "Xem thêm khách"}
            </button>
          ) : null}
          {message ? <InlineFeedback tone="success">{message}</InlineFeedback> : null}
          {error ? <InlineFeedback tone="error">{error}</InlineFeedback> : null}
        </>
      )}
    </div>
  );
}

function OwnerSessionHistory({
  sessions,
  loading,
  error,
  onRetry,
}: {
  sessions: ManagerSessionHistoryItem[];
  loading: boolean;
  error: string;
  onRetry: () => void;
}) {
  if (loading) {
    return <p className="manager-field-note">Đang tải lịch sử lượt khách...</p>;
  }
  if (error) {
    return (
      <InlineFeedback
        tone="error"
        action={
          <button type="button" onClick={onRetry}>
            <RefreshCcw aria-hidden="true" />
            Thử lại
          </button>
        }
      >
        {error}
      </InlineFeedback>
    );
  }
  if (sessions.length === 0) {
    return (
      <EmptyState
        icon={<CalendarClock aria-hidden="true" />}
        title="Chưa có lịch sử lượt khách"
        description="Lượt hoàn tất hoặc bị hủy sẽ xuất hiện tại đây."
      />
    );
  }

  return (
    <Section title={`${sessions.length} lượt gần nhất`}>
      <div className="manager-list">
        {sessions.map((session) => (
          <article className="manager-list-item" key={session.id}>
            <span className="manager-action-icon">
              <CalendarClock aria-hidden="true" />
            </span>
            <div className="manager-list-main">
              <strong>{session.customer?.name || "Khách hàng"}</strong>
              <span>
                {session.branchName || "Chi nhánh"} ·{" "}
                {session.assignedStaffName || "Chưa rõ nhân viên"}
              </span>
            </div>
            <div className="manager-list-meta">
              <strong>
                {session.status === "completed"
                  ? "Hoàn tất"
                  : session.cancellationReason === "no_show"
                    ? "Không đến"
                    : "Đã hủy"}
              </strong>
              <span>
                {formatDateTime(
                  session.completedAtMs || session.cancelledAtMs || session.createdAtMs,
                )}
              </span>
            </div>
          </article>
        ))}
      </div>
    </Section>
  );
}

function OwnerSessionGroups({ sessions }: { sessions: StaffSession[] }) {
  const groups = [
    {
      status: "waiting" as const,
      title: "Đang chờ",
      empty: "Hiện chưa có khách đang chờ.",
      icon: UsersRound,
    },
    {
      status: "serving" as const,
      title: "Đang phục vụ",
      empty: "Hiện chưa có khách đang phục vụ.",
      icon: UserRoundCheck,
    },
    {
      status: "pending_approval" as const,
      title: "Chờ duyệt",
      empty: "Hiện chưa có lượt chờ duyệt.",
      icon: ClipboardCheck,
    },
  ];

  return (
    <div className="manager-session-groups">
      {groups.map((group) => {
        const matching = sessions.filter((session) => session.status === group.status);
        const Icon = group.icon;
        return (
          <Section key={group.status} title={`${group.title} (${matching.length})`}>
            {matching.length === 0 ? (
              <p className="manager-field-note">{group.empty}</p>
            ) : (
              <div className="manager-list">
                {matching.map((session) => (
                  <article className="manager-list-item" key={session.id}>
                    <span className="manager-action-icon">
                      <Icon aria-hidden="true" />
                    </span>
                    <div className="manager-list-main">
                      <strong>{session.customer?.name || "Khách hàng"}</strong>
                      <span>
                        {session.customer ? ownerPhoneLabel(session.customer) : "Chưa có SĐT"} ·{" "}
                        {session.branchName || "Chi nhánh"}
                      </span>
                    </div>
                    <div className="manager-list-meta">
                      <strong>{group.title}</strong>
                      <span>{formatDateTime(session.createdAtMs) || "Vừa tạo"}</span>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </Section>
        );
      })}
    </div>
  );
}
