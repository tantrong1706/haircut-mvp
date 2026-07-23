import { ExternalLink, LockKeyhole, LogOut, MapPin, ShieldCheck, UserRound } from "lucide-react";
import { useState } from "react";
import { AccountDeletion } from "../../components/AccountDeletion";
import { SecuritySettings } from "../../components/SecuritySettings";
import {
  ActionRow,
  DetailHeader,
  ScreenHeader,
  Section,
} from "../../components/ScreenPrimitives";
import { signOutOwnerStaff, type AppUser } from "../../services/managerApi";

type AccountSection = "profile" | "security" | "data" | "support";

export function StaffAccountScreen({
  user,
  branchName,
  nativeReady,
  biometricEnabled,
  online,
  onToggleBiometric,
}: {
  user: AppUser;
  branchName: string;
  nativeReady: boolean;
  biometricEnabled: boolean;
  online: boolean;
  onToggleBiometric: () => Promise<void>;
}) {
  const [section, setSection] = useState<AccountSection | null>(null);

  if (section) {
    const title = {
      profile: "Thông tin tài khoản",
      security: "Bảo mật thiết bị",
      data: "Dữ liệu và tài khoản",
      support: "Hỗ trợ và pháp lý",
    }[section];
    return (
      <div className="manager-screen">
        <DetailHeader title={title} onBack={() => setSection(null)} />
        {section === "profile" ? (
          <Section title={user.name || "Nhân viên"}>
            <dl className="manager-summary-list">
              <div>
                <dt>Vai trò</dt>
                <dd>Nhân viên</dd>
              </div>
              <div>
                <dt>Chi nhánh</dt>
                <dd>{branchName}</dd>
              </div>
              <div>
                <dt>Đổi quà</dt>
                <dd>{user.canRedeemRewards ? "Được phép" : "Chưa được phép"}</dd>
              </div>
            </dl>
            <p className="manager-field-note">
              Tên, chi nhánh và quyền do chủ salon quản lý.
            </p>
          </Section>
        ) : section === "security" ? (
          <SecuritySettings
            nativeReady={nativeReady}
            biometricEnabled={biometricEnabled}
            online={online}
            onToggleBiometric={onToggleBiometric}
          />
        ) : section === "data" ? (
          <AccountDeletion user={user} />
        ) : (
          <SupportLinks />
        )}
      </div>
    );
  }

  return (
    <div className="manager-screen">
      <ScreenHeader
        eyebrow="Cá nhân"
        title="Tài khoản"
        description={`${user.name || "Nhân viên"} · ${branchName}`}
      />
      <Section>
        <div className="manager-action-list">
          <ActionRow
            icon={UserRound}
            title="Thông tin tài khoản"
            description="Vai trò, chi nhánh và quyền hiện tại."
            onClick={() => setSection("profile")}
          />
          <ActionRow
            icon={LockKeyhole}
            title="Bảo mật thiết bị"
            description={biometricEnabled ? "Khóa sinh trắc học đang bật." : "Bảo vệ khi mở Manager."}
            onClick={() => setSection("security")}
          />
          <ActionRow
            icon={ShieldCheck}
            title="Dữ liệu và tài khoản"
            description="Yêu cầu xóa tài khoản cá nhân."
            onClick={() => setSection("data")}
          />
          <ActionRow
            icon={MapPin}
            title="Hỗ trợ và pháp lý"
            description="Quyền riêng tư, điều khoản và liên hệ."
            onClick={() => setSection("support")}
          />
        </div>
      </Section>
      <button
        className="manager-button secondary wide"
        type="button"
        onClick={() => void signOutOwnerStaff()}
      >
        <LogOut aria-hidden="true" />
        Đăng xuất
      </button>
    </div>
  );
}

function SupportLinks() {
  const email = String(import.meta.env.VITE_SUPPORT_EMAIL || "tantrong1706@gmail.com");
  const phone = String(import.meta.env.VITE_SUPPORT_PHONE || "0838098761");
  const publicWebUrl = String(
    import.meta.env.VITE_PUBLIC_WEB_URL || "https://haircut-c7d12.web.app",
  ).replace(/\/+$/, "");
  return (
    <Section title="Hỗ trợ và pháp lý">
      <div className="manager-link-list">
        <a href={`${publicWebUrl}/privacy`} target="_blank" rel="noreferrer">
          Chính sách quyền riêng tư <ExternalLink aria-hidden="true" />
        </a>
        <a href={`${publicWebUrl}/terms`} target="_blank" rel="noreferrer">
          Điều khoản sử dụng <ExternalLink aria-hidden="true" />
        </a>
        <a href={`mailto:${email}`}>
          Email: {email} <ExternalLink aria-hidden="true" />
        </a>
        <a href={`tel:${phone}`}>
          Điện thoại: {phone} <ExternalLink aria-hidden="true" />
        </a>
      </div>
    </Section>
  );
}
