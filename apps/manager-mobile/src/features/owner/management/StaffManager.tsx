import { Mail, Plus, Power, RefreshCcw, Save, TicketCheck, UserPlus, UsersRound } from "lucide-react";
import { useEffect, useState } from "react";
import { EmptyState, InlineFeedback, LoadingState } from "../../../components/Feedback";
import { ActionRow, DetailHeader, Section } from "../../../components/ScreenPrimitives";
import {
  createStaffProfile,
  getBranchQrSettings,
  listenStaffProfiles,
  sendStaffInviteEmail,
  updateStaffProfile,
  type SalonBranch,
  type StaffProfile,
} from "../../../services/managerApi";

export function StaffManager({ salonId }: { salonId: string }) {
  const [staff, setStaff] = useState<StaffProfile[]>([]);
  const [branches, setBranches] = useState<SalonBranch[]>([]);
  const [selected, setSelected] = useState<StaffProfile | null>(null);
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    return listenStaffProfiles(
      salonId,
      (next) => {
        setStaff(next);
        setSelected((current) =>
          current ? next.find((item) => item.uid === current.uid) || null : null,
        );
        setLoading(false);
        setError("");
      },
      (nextError) => {
        setLoading(false);
        setError(nextError);
      },
    );
  }, [salonId]);

  useEffect(() => {
    void getBranchQrSettings(salonId)
      .then((result) => setBranches(result.branches.filter((branch) => branch.isActive)))
      .catch((caught) =>
        setError(caught instanceof Error ? caught.message : "Không tải được chi nhánh."),
      );
  }, [salonId]);

  function updateLocal(next: StaffProfile) {
    setStaff((current) =>
      current
        .map((item) => (item.uid === next.uid ? next : item))
        .sort((a, b) => a.name.localeCompare(b.name, "vi")),
    );
    setSelected(next);
  }

  if (selected) {
    return (
      <StaffDetail
        salonId={salonId}
        staff={selected}
        branches={branches}
        busy={busy === selected.uid}
        onBack={() => setSelected(null)}
        onBusy={setBusy}
        onChange={updateLocal}
        onMessage={setMessage}
        onError={setError}
      />
    );
  }

  return (
    <div className="manager-subscreen">
      <div className="manager-section-heading">
        <div>
          <h2>Nhân viên</h2>
          <p>Tạo tài khoản, phân chi nhánh và quyền đổi quà.</p>
        </div>
        <button
          className="manager-button primary compact"
          type="button"
          onClick={() => setCreating((value) => !value)}
        >
          <Plus aria-hidden="true" />
          Thêm
        </button>
      </div>

      {creating ? (
        <CreateStaffForm
          salonId={salonId}
          branches={branches}
          busy={busy === "new"}
          onBusy={setBusy}
          onCreated={(created) => {
            setStaff((current) =>
              [...current.filter((item) => item.uid !== created.uid), created].sort((a, b) =>
                a.name.localeCompare(b.name, "vi"),
              ),
            );
            setCreating(false);
          }}
          onMessage={setMessage}
          onError={setError}
        />
      ) : null}

      {loading ? (
        <LoadingState label="Đang tải nhân viên" />
      ) : staff.length === 0 ? (
        <EmptyState
          icon={<UsersRound aria-hidden="true" />}
          title="Chưa có nhân viên"
          description="Thêm nhân viên để họ nhận email đặt mật khẩu và đăng nhập Manager."
        />
      ) : (
        <div className="manager-action-list">
          {staff.map((member) => (
            <ActionRow
              key={member.uid}
              icon={UserPlus}
              title={member.name || "Nhân viên"}
              description={`${branchName(member, branches)} · ${
                member.inviteStatus === "pending" ? "Chờ đặt mật khẩu" : "Đã kích hoạt"
              }`}
              meta={
                <span className={member.isActive ? "manager-pill" : "manager-pill muted"}>
                  {member.isActive ? "Đang làm" : "Đã tắt"}
                </span>
              }
              onClick={() => setSelected(member)}
            />
          ))}
        </div>
      )}

      {message ? <InlineFeedback tone="success">{message}</InlineFeedback> : null}
      {error ? <InlineFeedback tone="error">{error}</InlineFeedback> : null}
    </div>
  );
}

function CreateStaffForm({
  salonId,
  branches,
  busy,
  onBusy,
  onCreated,
  onMessage,
  onError,
}: {
  salonId: string;
  branches: SalonBranch[];
  busy: boolean;
  onBusy: (value: string) => void;
  onCreated: (staff: StaffProfile) => void;
  onMessage: (value: string) => void;
  onError: (value: string) => void;
}) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [branchId, setBranchId] = useState(branches[0]?.id || "");
  const [canRedeem, setCanRedeem] = useState(false);

  useEffect(() => {
    if (!branchId && branches[0]) setBranchId(branches[0].id);
  }, [branchId, branches]);

  async function create() {
    onBusy("new");
    onMessage("");
    onError("");
    try {
      const result = await createStaffProfile({
        salonId,
        email,
        name,
        phone,
        canRedeemRewards: canRedeem,
        branchIds: [branchId],
      });
      onCreated({
        uid: result.uid,
        salonId,
        email: result.email,
        name,
        phone,
        role: "staff",
        isActive: true,
        canRedeemRewards: canRedeem,
        branchId,
        branchIds: [branchId],
        inviteStatus: "pending",
      });
      onMessage(
        result.inviteEmailSent
          ? "Đã gửi email mời. Nhân viên tự đặt mật khẩu trong hộp thư."
          : "Đã tạo tài khoản nhưng chưa gửi được email. Có thể gửi lại trong chi tiết nhân viên.",
      );
    } catch (caught) {
      onError(caught instanceof Error ? caught.message : "Không thêm được nhân viên.");
    } finally {
      onBusy("");
    }
  }

  return (
    <Section title="Tạo tài khoản nhân viên">
      <label className="manager-field">
        <span>Email nhân viên</span>
        <input
          type="email"
          inputMode="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </label>
      <label className="manager-field">
        <span>Tên nhân viên</span>
        <input value={name} onChange={(event) => setName(event.target.value)} />
      </label>
      <label className="manager-field">
        <span>SĐT nội bộ</span>
        <input inputMode="tel" value={phone} onChange={(event) => setPhone(event.target.value)} />
      </label>
      <label className="manager-field">
        <span>Chi nhánh làm việc</span>
        <select value={branchId} onChange={(event) => setBranchId(event.target.value)}>
          <option value="">Chọn chi nhánh</option>
          {branches.map((branch) => (
            <option key={branch.id} value={branch.id}>
              {branch.name}
            </option>
          ))}
        </select>
      </label>
      <label className="manager-toggle">
        <input
          type="checkbox"
          checked={canRedeem}
          onChange={(event) => setCanRedeem(event.target.checked)}
        />
        <span>Cho phép xác nhận mã quà</span>
      </label>
      <button
        className="manager-button primary wide"
        type="button"
        disabled={busy || !email.trim() || !name.trim() || !branchId}
        onClick={() => void create()}
      >
        <Mail aria-hidden="true" />
        {busy ? "Đang tạo..." : "Tạo và gửi email mời"}
      </button>
    </Section>
  );
}

function StaffDetail({
  salonId,
  staff,
  branches,
  busy,
  onBack,
  onBusy,
  onChange,
  onMessage,
  onError,
}: {
  salonId: string;
  staff: StaffProfile;
  branches: SalonBranch[];
  busy: boolean;
  onBack: () => void;
  onBusy: (value: string) => void;
  onChange: (staff: StaffProfile) => void;
  onMessage: (value: string) => void;
  onError: (value: string) => void;
}) {
  const [name, setName] = useState(staff.name);
  const [phone, setPhone] = useState(staff.phone);
  const [branchId, setBranchId] = useState(staff.branchId || staff.branchIds[0] || "");

  useEffect(() => {
    setName(staff.name);
    setPhone(staff.phone);
    setBranchId(staff.branchId || staff.branchIds[0] || "");
  }, [staff]);

  async function save(payload: Partial<StaffProfile>, success = "Đã cập nhật nhân viên.") {
    onBusy(staff.uid);
    onMessage("");
    onError("");
    try {
      await updateStaffProfile({
        salonId,
        uid: staff.uid,
        name: payload.name,
        phone: payload.phone,
        isActive: payload.isActive,
        canRedeemRewards: payload.canRedeemRewards,
        branchIds: payload.branchIds,
      });
      onChange({ ...staff, ...payload });
      onMessage(success);
    } catch (caught) {
      onError(caught instanceof Error ? caught.message : "Không cập nhật được nhân viên.");
    } finally {
      onBusy("");
    }
  }

  async function resend() {
    onBusy(staff.uid);
    onMessage("");
    onError("");
    try {
      if (!(await sendStaffInviteEmail(staff.email))) {
        throw new Error("Chưa gửi được email mời. Hãy kiểm tra cấu hình Firebase Auth.");
      }
      onMessage(`Đã gửi lại email mời tới ${staff.email}.`);
    } catch (caught) {
      onError(caught instanceof Error ? caught.message : "Không gửi lại được email.");
    } finally {
      onBusy("");
    }
  }

  return (
    <div className="manager-subscreen">
      <DetailHeader
        title={staff.name || "Nhân viên"}
        description={staff.email || "Tài khoản nhân viên"}
        onBack={onBack}
      />
      <Section title="Thông tin làm việc">
        <label className="manager-field">
          <span>Tên nhân viên</span>
          <input value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <label className="manager-field">
          <span>SĐT nội bộ</span>
          <input inputMode="tel" value={phone} onChange={(event) => setPhone(event.target.value)} />
        </label>
        <label className="manager-field">
          <span>Chi nhánh làm việc</span>
          <select value={branchId} onChange={(event) => setBranchId(event.target.value)}>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </select>
        </label>
        <button
          className="manager-button primary wide"
          type="button"
          disabled={busy || !name.trim() || !branchId}
          onClick={() =>
            void save({ name, phone, branchId, branchIds: [branchId] })
          }
        >
          <Save aria-hidden="true" />
          {busy ? "Đang lưu..." : "Lưu thông tin"}
        </button>
      </Section>

      <Section title="Quyền và trạng thái">
        <button
          className="manager-button secondary wide"
          type="button"
          disabled={busy}
          onClick={() =>
            void save(
              { canRedeemRewards: !staff.canRedeemRewards },
              staff.canRedeemRewards ? "Đã thu quyền đổi quà." : "Đã cấp quyền đổi quà.",
            )
          }
        >
          <TicketCheck aria-hidden="true" />
          {staff.canRedeemRewards ? "Thu quyền đổi quà" : "Cho phép đổi quà"}
        </button>
        <button
          className={staff.isActive ? "manager-button danger wide" : "manager-button primary wide"}
          type="button"
          disabled={busy}
          onClick={() =>
            void save(
              { isActive: !staff.isActive },
              staff.isActive ? "Đã tắt tài khoản nhân viên." : "Đã mở lại tài khoản.",
            )
          }
        >
          <Power aria-hidden="true" />
          {staff.isActive ? "Tắt tài khoản" : "Mở lại tài khoản"}
        </button>
      </Section>

      {staff.inviteStatus === "pending" ? (
        <Section title="Lời mời đăng nhập">
          <p className="manager-field-note">
            Nhân viên chưa đặt mật khẩu. Gửi lại email nếu họ chưa nhận được.
          </p>
          <button
            className="manager-button secondary wide"
            type="button"
            disabled={busy}
            onClick={() => void resend()}
          >
            <RefreshCcw aria-hidden="true" />
            {busy ? "Đang gửi..." : "Gửi lại email mời"}
          </button>
        </Section>
      ) : null}
    </div>
  );
}

function branchName(staff: StaffProfile, branches: SalonBranch[]) {
  const branchId = staff.branchId || staff.branchIds[0] || "";
  return branches.find((branch) => branch.id === branchId)?.name || "Chưa phân chi nhánh";
}
