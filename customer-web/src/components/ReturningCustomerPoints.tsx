import { useEffect, useRef, useState, type FormEvent } from "react";
import { Search, UserRoundCheck } from "lucide-react";
import {
  searchSalonCustomers,
  getSalonCustomerDetails,
  type CustomerLookupResult,
} from "../services/operations";
import { awardReturningCustomerPoints } from "../services/returningCustomerPoints";
import { SalonVisitDetails } from "./SalonVisitDetails";
import { SalonHaircutHistory } from "./SalonHaircutHistory";

type Props = {
  salonId: string;
  branchId: string;
  branchName: string;
  pointPerVisit: number;
  canAward: boolean;
};

export function ReturningCustomerPoints(props: Props) {
  // Remount on scope/permission change so an old selection cannot cross branches.
  return <CustomerLookup key={`${props.salonId}:${props.branchId}:${props.canAward}`} {...props} />;
}

function CustomerLookup({ salonId, branchId, branchName, pointPerVisit, canAward }: Props) {
  const [term, setTerm] = useState("");
  const [customers, setCustomers] = useState<CustomerLookupResult[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<{
    customer: CustomerLookupResult;
    operationId: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [completedCustomer, setCompletedCustomer] = useState<CustomerLookupResult | null>(null);
  const submitting = useRef(false);
  const revision = useRef(0);
  useEffect(
    () => () => {
      revision.current += 1;
    },
    [],
  );

  async function findCustomers(event?: FormEvent, cursor?: string) {
    event?.preventDefault();
    if (!/^\d{4}$/.test(term) || !branchId || !canAward || searching || submitting.current) return;
    const current = ++revision.current;
    setSearching(true);
    setCompletedCustomer(null);
    setSelected(null);
    setError("");
    setMessage("");
    try {
      const result = await searchSalonCustomers({ salonId, branchId, term, cursor, pageSize: 10 });
      if (current !== revision.current) return;
      setCustomers((items) => (cursor ? [...items, ...result.customers] : result.customers));
      setNextCursor(result.nextCursor);
      setSearched(true);
    } catch (err) {
      if (current !== revision.current) return;
      setCustomers([]);
      setNextCursor(null);
      setError(err instanceof Error ? err.message : "Chưa tìm được khách. Vui lòng thử lại.");
    } finally {
      if (current === revision.current) setSearching(false);
    }
  }

  async function confirm() {
    if (!selected || submitting.current || !canAward || !branchId) return;
    submitting.current = true;
    setBusy(true);
    setError("");
    const current = revision.current;
    try {
      const result = await awardReturningCustomerPoints({
        salonId,
        branchId,
        customerId: selected.customer.id,
        phoneLast4: term,
        operationId: selected.operationId,
      });
      if (current !== revision.current) return;
      setMessage(
        `${result.alreadyProcessed ? "Lượt này đã được ghi nhận" : `Đã cộng ${result.pointsAdded} điểm`} cho ${selected.customer.name || "khách"}. Tổng: ${result.pointsAfter} điểm.`,
      );
      setCompletedCustomer({ ...selected.customer, points: result.pointsAfter });
      setSelected(null);
      setCustomers([]);
      setNextCursor(null);
      setSearched(false);
      setTerm("");
    } catch (err) {
      if (current === revision.current)
        setError(err instanceof Error ? err.message : "Chưa xác nhận được. Vui lòng thử lại.");
    } finally {
      submitting.current = false;
      if (current === revision.current) setBusy(false);
    }
  }

  return (
    <section className="panel returning-customer-panel" aria-labelledby="returning-customer-title">
      <div className="detail-heading">
        <div>
          <p className="eyebrow">Khách quen</p>
          <h2 id="returning-customer-title">Tích điểm không cần quét QR</h2>
        </div>
        <UserRoundCheck size={24} aria-hidden="true" />
      </div>
      {!canAward ? (
        <p>Chủ salon cần cấp quyền cộng điểm trực tiếp cho tài khoản này.</p>
      ) : !branchId ? (
        <p>Chọn chi nhánh hiện tại trước khi tìm khách.</p>
      ) : (
        <>
          <p>Nhập 4 số cuối, đối chiếu tên với khách rồi xác nhận lượt cắt tại {branchName}.</p>
          <form className="button-row wrap-row" onSubmit={findCustomers}>
            <label className="field">
              <span>4 số cuối điện thoại</span>
              <input
                value={term}
                inputMode="numeric"
                autoComplete="off"
                maxLength={4}
                pattern="[0-9]{4}"
                disabled={busy}
                placeholder="Ví dụ: 5678"
                onChange={(event) => {
                  revision.current += 1;
                  setTerm(event.target.value.replace(/\D/g, "").slice(0, 4));
                  setSelected(null);
                  setCompletedCustomer(null);
                  setCustomers([]);
                  setSearched(false);
                  setNextCursor(null);
                  setSearching(false);
                  setError("");
                  setMessage("");
                }}
              />
            </label>
            <button
              className="secondary-button"
              type="submit"
              disabled={busy || searching || !/^\d{4}$/.test(term)}
            >
              <Search size={18} aria-hidden="true" />
              {searching ? "Đang tìm..." : "Tìm khách"}
            </button>
          </form>
          {customers.length > 1 ? (
            <p>
              Nhiều khách trùng 4 số cuối. Hãy hỏi tên và chọn đúng người; nếu vẫn chưa phân biệt
              được, dùng QR của salon.
            </p>
          ) : null}
          {searched && customers.length === 0 ? (
            <p>Chưa tìm thấy khách. Khách mới vui lòng quét QR và đăng ký một lần.</p>
          ) : null}
          <div className="returning-customer-results">
            {customers.map((customer) => (
              <button
                type="button"
                key={customer.id}
                className={`ops-card${selected?.customer.id === customer.id ? " active" : ""}`}
                disabled={busy || searching}
                aria-pressed={selected?.customer.id === customer.id}
                aria-label={`Chọn ${customer.name || "Khách hàng"}, đuôi ${customer.phoneLast4}, ${customer.points} điểm`}
                onClick={() => {
                  setSelected({ customer, operationId: crypto.randomUUID() });
                  setError("");
                }}
              >
                <strong>{customer.name || "Khách hàng"}</strong>
                <span>
                  ******{customer.phoneLast4} · {customer.points} điểm
                </span>
                {customer.lastVisitAtMs ? (
                  <small>
                    Lần gần nhất: {new Date(customer.lastVisitAtMs).toLocaleDateString("vi-VN")}
                  </small>
                ) : null}
              </button>
            ))}
          </div>
          {nextCursor ? (
            <button
              type="button"
              className="secondary-button"
              disabled={busy || searching}
              onClick={() => void findCustomers(undefined, nextCursor)}
            >
              Xem thêm khách
            </button>
          ) : null}
          {selected ? (
            <div className="service-state-card">
              <div>
                <strong>
                  {selected.customer.name || "Khách hàng"} · ******{selected.customer.phoneLast4}
                </strong>
                <p>Xác nhận khách đã sử dụng dịch vụ tại {branchName}.</p>
                <SelectedCustomerHistory
                  key={`${branchId}:${selected.customer.id}`}
                  salonId={salonId}
                  branchId={branchId}
                  customerId={selected.customer.id}
                />
                <button
                  type="button"
                  className="primary-button"
                  disabled={busy || searching}
                  onClick={() => void confirm()}
                >
                  {busy ? "Đang cộng điểm..." : `Xác nhận cộng ${pointPerVisit} điểm`}
                </button>
              </div>
            </div>
          ) : null}
        </>
      )}
      {message ? (
        <p className="alert success" role="status">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="alert error" role="alert">
          {error}
        </p>
      ) : null}
      {completedCustomer ? (
        <div className="service-state-card">
          <strong>
            {completedCustomer.name || "Khách hàng"} · {completedCustomer.points} điểm
          </strong>
          <SalonVisitDetails salonId={salonId} customerId={completedCustomer.id} />
        </div>
      ) : null}
    </section>
  );
}

function SelectedCustomerHistory({
  salonId,
  branchId,
  customerId,
}: {
  salonId: string;
  branchId: string;
  customerId: string;
}) {
  const [records, setRecords] = useState<CustomerLookupResult["recentRecords"]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setStatus("loading");
    setRecords([]);
    void getSalonCustomerDetails({ salonId, branchId, customerId })
      .then((result) => {
        if (active) {
          setRecords(result.recentRecords || []);
          setStatus("ready");
        }
      })
      .catch(() => {
        if (active) setStatus("error");
      });
    return () => {
      active = false;
    };
  }, [salonId, branchId, customerId, attempt]);
  if (status === "loading") return <p>Đang tải lịch sử của khách...</p>;
  if (status === "error")
    return (
      <p>
        Chưa tải được lịch sử.{" "}
        <button
          className="secondary-button"
          type="button"
          onClick={() => setAttempt((value) => value + 1)}
        >
          Tải lại lịch sử
        </button>
      </p>
    );
  return <SalonHaircutHistory records={records} />;
}
