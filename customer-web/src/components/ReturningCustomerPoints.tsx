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
import { CustomerRewardActions } from "./CustomerRewardActions";
import { ManualCustomerForm } from "./ManualCustomerForm";

type Props = {
  salonId: string;
  branchId: string;
  branchName: string;
  pointPerVisit: number;
  canAward: boolean;
  canRedeem?: boolean;
  canCreateCustomer?: boolean;
};

export function ReturningCustomerPoints(props: Props) {
  // Remount on scope/permission change so an old selection cannot cross branches.
  return (
    <CustomerLookup
      key={`${props.salonId}:${props.branchId}:${props.canAward}:${props.canRedeem}`}
      {...props}
    />
  );
}

function CustomerLookup({
  salonId,
  branchId,
  branchName,
  pointPerVisit,
  canAward,
  canRedeem = false,
  canCreateCustomer = false,
}: Props) {
  const [term, setTerm] = useState("");
  const [verificationDigits, setVerificationDigits] = useState("");
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
  const trimmedTerm = term.trim();
  const digitsOnly = /^[\d\s]+$/.test(trimmedTerm);
  const lookupTerm = digitsOnly ? trimmedTerm.replace(/\s/g, "") : trimmedTerm;
  const suffixLookup = /^\d{4}$/.test(lookupTerm);
  const validLookup =
    suffixLookup || (!digitsOnly && lookupTerm.length >= 2 && /\p{L}/u.test(lookupTerm));
  const confirmedSuffix = suffixLookup ? lookupTerm : verificationDigits;
  const suffixMatches =
    /^\d{4}$/.test(confirmedSuffix) && selected?.customer.phoneLast4 === confirmedSuffix;
  useEffect(
    () => () => {
      revision.current += 1;
    },
    [],
  );

  async function findCustomers(event?: FormEvent, cursor?: string) {
    event?.preventDefault();
    if (!validLookup || !branchId || !(canAward || canRedeem) || searching || submitting.current)
      return;
    const current = ++revision.current;
    setSearching(true);
    setCompletedCustomer(null);
    setSelected(null);
    setVerificationDigits("");
    setError("");
    setMessage("");
    try {
      const result = await searchSalonCustomers({
        salonId,
        branchId,
        term: lookupTerm,
        cursor,
        pageSize: 10,
      });
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
    if (!selected || !suffixMatches || submitting.current || !canAward || !branchId) return;
    submitting.current = true;
    setBusy(true);
    setError("");
    const current = revision.current;
    try {
      const result = await awardReturningCustomerPoints({
        salonId,
        branchId,
        customerId: selected.customer.id,
        phoneLast4: confirmedSuffix,
        operationId: selected.operationId,
      });
      if (current !== revision.current) return;
      setMessage(
        `${result.alreadyProcessed ? "Lượt này đã được ghi nhận" : `Đã cộng ${result.pointsAdded} điểm`} cho ${selected.customer.name || "khách"}. Tổng: ${result.pointsAfter} điểm.`,
      );
      setCompletedCustomer({ ...selected.customer, points: result.pointsAfter });
      setSelected(null);
      setVerificationDigits("");
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
          <h2 id="returning-customer-title">
            {canRedeem
              ? canAward
                ? "Tìm khách để tích điểm hoặc dùng quà"
                : "Tìm khách để dùng quà"
              : "Tích điểm không cần quét QR"}
          </h2>
        </div>
        <UserRoundCheck size={24} aria-hidden="true" />
      </div>
      {canCreateCustomer && branchId ? (
        <ManualCustomerForm salonId={salonId} branchId={branchId} branchName={branchName} />
      ) : null}
      {!canAward && !canRedeem ? (
        <p>Chủ salon cần cấp quyền để tài khoản này tìm khách tích điểm hoặc dùng quà.</p>
      ) : !branchId ? (
        <p>Chọn chi nhánh hiện tại trước khi tìm khách.</p>
      ) : (
        <>
          <p>Nhập tên hoặc 4 số cuối điện thoại để tìm đúng khách tại {branchName}.</p>
          <form className="button-row wrap-row" onSubmit={findCustomers}>
            <label className="field">
              <span>Tên khách hoặc 4 số cuối điện thoại</span>
              <input
                value={term}
                inputMode="text"
                autoComplete="off"
                maxLength={80}
                disabled={busy}
                placeholder="Ví dụ: Anh Bình hoặc 5678"
                onChange={(event) => {
                  revision.current += 1;
                  setTerm(event.target.value);
                  setVerificationDigits("");
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
              disabled={busy || searching || !validLookup}
            >
              <Search size={18} aria-hidden="true" />
              {searching ? "Đang tìm..." : "Tìm khách"}
            </button>
          </form>
          {customers.length > 1 ? (
            <p>
              {suffixLookup ? "Nhiều khách trùng 4 số cuối." : "Nhiều khách khớp tên."} Hãy hỏi tên
              và chọn đúng người; nếu vẫn chưa phân biệt được, dùng QR của salon.
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
                  setVerificationDigits("");
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
                {canAward ? <p>Xác nhận khách đã sử dụng dịch vụ tại {branchName}.</p> : null}
                {canAward ? (
                  <SelectedCustomerHistory
                    key={`${branchId}:${selected.customer.id}`}
                    salonId={salonId}
                    branchId={branchId}
                    customerId={selected.customer.id}
                  />
                ) : null}
                {!suffixLookup ? (
                  <label className="field">
                    <span>Xác nhận 4 số cuối điện thoại</span>
                    <input
                      inputMode="numeric"
                      autoComplete="off"
                      maxLength={4}
                      disabled={busy}
                      value={verificationDigits}
                      placeholder="Nhập 4 số cuối khách đọc"
                      onChange={(event) =>
                        setVerificationDigits(event.target.value.replace(/\D/g, "").slice(0, 4))
                      }
                    />
                    {verificationDigits.length === 4 && !suffixMatches ? (
                      <small role="status">4 số cuối không khớp khách đã chọn.</small>
                    ) : null}
                  </label>
                ) : null}
                {canAward ? (
                  <button
                    type="button"
                    className="primary-button"
                    disabled={busy || searching || !suffixMatches}
                    onClick={() => void confirm()}
                  >
                    {busy ? "Đang cộng điểm..." : `Xác nhận cộng ${pointPerVisit} điểm`}
                  </button>
                ) : null}
                {canRedeem && suffixMatches ? (
                  <CustomerRewardActions
                    salonId={salonId}
                    branchId={branchId}
                    branchName={branchName}
                    customerId={selected.customer.id}
                    customerName={selected.customer.name}
                    verifiedPhoneLast4={confirmedSuffix}
                    disabled={busy || searching}
                  />
                ) : null}
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
