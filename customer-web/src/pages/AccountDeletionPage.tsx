import { BrandLogo } from "../components/BrandLogo";
import { AccountDeletionPanel } from "../components/AccountDeletionPanel";
import type { AppUser } from "../services/auth";

export function AccountDeletionPage({ currentUser }: { currentUser: AppUser }) {
  return (
    <section className="ops-page account-deletion-page">
      <header className="ops-topbar">
        <BrandLogo />
        <div>
          <p className="eyebrow">Quyền dữ liệu</p>
          <h1>Xóa tài khoản</h1>
          <span>{currentUser.name}</span>
        </div>
      </header>
      <AccountDeletionPanel currentUser={currentUser} />
      <p className="muted account-support">
        Cần hỗ trợ: {import.meta.env.VITE_SUPPORT_EMAIL || "tantrong1706@gmail.com"}
      </p>
    </section>
  );
}
