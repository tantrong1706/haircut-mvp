import { useState } from "react";
import { ArrowUpRight, Building2, Search } from "lucide-react";
import type { AdminSalon } from "../services/adminApi";
import { StatusBadge } from "./AdminSections";

export function SalonDirectory({
  salons,
  selectedId,
  onSelect,
}: {
  salons: AdminSalon[];
  selectedId?: string;
  onSelect: (salon: AdminSalon) => void;
}) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const filtered = salons.filter(
    (salon) =>
      `${salon.name} ${salon.id}`
        .toLocaleLowerCase("vi")
        .includes(search.trim().toLocaleLowerCase("vi")) &&
      (status === "all" || salon.status === status),
  );
  return (
    <section className="salon-directory surface" aria-labelledby="salon-directory-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Salon đang quản lý</p>
          <h2 id="salon-directory-title">Danh sách salon</h2>
        </div>
        <span className="quiet-label">Đã tải {salons.length}</span>
      </div>
      <div className="salon-filters">
        <label>
          Tìm trong salon đã tải
          <div className="input-with-icon">
            <Search aria-hidden="true" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Tên hoặc mã salon"
            />
          </div>
        </label>
        <label>
          Trạng thái
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="all">Tất cả</option>
            <option value="active">Hoạt động</option>
            <option value="suspended">Đang khóa</option>
            <option value="pending_deletion">Chờ xóa</option>
          </select>
        </label>
      </div>
      <p className="directory-scope">Bộ lọc chỉ áp dụng cho {salons.length} salon đã tải.</p>
      {filtered.length ? (
        <ul className="salon-list">
          {filtered.map((salon) => (
            <li key={salon.id}>
              <button
                className={`salon-option${selectedId === salon.id ? " selected" : ""}`}
                aria-label={`Kiểm tra ${salon.name}`}
                aria-pressed={selectedId === salon.id}
                onClick={() => onSelect(salon)}
              >
                <span className="salon-option-top">
                  <strong>{salon.name}</strong>
                  <ArrowUpRight aria-hidden="true" />
                </span>
                <span className="salon-option-meta">
                  <StatusBadge status={salon.status} />
                  <span>{salon.customerCount} khách</span>
                </span>
                <code>{salon.id}</code>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="empty">
          <Building2 aria-hidden="true" />
          <p>
            {salons.length ? "Không có salon khớp bộ lọc trong dữ liệu đã tải." : "Chưa có salon"}
          </p>
        </div>
      )}
    </section>
  );
}
