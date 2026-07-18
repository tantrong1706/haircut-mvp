import {
  ClipboardCheck,
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
  searchSalonCustomers,
  type CustomerLookupResult,
  type StaffSession,
} from "../../services/managerApi";
import { ownerPhoneLabel } from "./ownerFormatters";

export function OwnerCustomersScreen({
  salonId,
  sessions,
  onConfirm,
}: {
  salonId: string;
  sessions: StaffSession[];
  onConfirm: (request: ConfirmDialogRequest) => void;
}) {
  const [mode, setMode] = useState<"operations" | "search">("operations");
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<CustomerLookupResult[]>([]);
  const [searched, setSearched] = useState(false);
  const [searchedTerm, setSearchedTerm] = useState("");
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
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
        title={mode === "operations" ? "Lượt khách hiện tại" : "Tìm và xem hồ sơ"}
        description={
          mode === "operations"
            ? "Theo dõi khách đang chờ, đang phục vụ và chờ duyệt."
            : "Tìm theo tên hoặc đúng 4 số cuối điện thoại."
        }
      />

      <div className="manager-segmented" aria-label="Chế độ xem khách">
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

                  <details>
                    <summary>Lịch sử gần đây ({customer.recentRecords.length})</summary>
                    {customer.recentRecords.length === 0 ? (
                      <p className="manager-field-note">Chưa có lịch sử.</p>
                    ) : (
                      <div className="manager-detail-list">
                        {customer.recentRecords.map((record) => (
                          <div key={record.id}>
                            <strong>{formatDateTime(record.createdAtMs) || "Chưa rõ thời gian"}</strong>
                            <span>
                              {record.staffName || "Nhân viên"} · +{record.pointsAdded} điểm
                            </span>
                            <small>{record.note || "Không có ghi chú"}</small>
                          </div>
                        ))}
                      </div>
                    )}
                  </details>

                  <details>
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
                        {session.customer
                          ? ownerPhoneLabel(session.customer)
                          : "Chưa có SĐT"}{" "}
                        ·{" "}
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
