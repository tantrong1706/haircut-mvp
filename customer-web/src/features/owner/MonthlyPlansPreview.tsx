import "./monthlyPlansPreview.css";

// Presentation only: these proposed limits are not authorization or subscription state.
const plans = [
  { id: "plus", name: "Plus", audience: "Dành cho tiệm một chi nhánh", branchLimit: 1 },
  { id: "pro", name: "Pro", audience: "Dành cho salon nhiều chi nhánh", branchLimit: 3 },
] as const;

const sharedFeatures = [
  "Khách hàng và lịch sử",
  "Tích điểm",
  "Ảnh và ghi chú nội bộ",
  "Vòng quay và đổi quà",
  "OTP đăng nhập trong gói",
] as const;

export function MonthlyPlansPreview() {
  return (
    <section className="panel monthly-plans-preview" aria-labelledby="monthly-plans-title">
      <div className="dashboard-heading">
        <div>
          <p className="eyebrow">Plus & Pro · Phương án dự kiến</p>
          <h2 id="monthly-plans-title">Gói dịch vụ theo tháng</h2>
        </div>
        <span className="monthly-plan-cycle">Hằng tháng</span>
      </div>
      <p className="monthly-plans-intro">
        Hai gói theo quy mô salon, không mua thêm từng cụm 50 khách.
      </p>
      <div className="monthly-plans-grid">
        {plans.map((plan) => (
          <article
            className="monthly-plan-card"
            key={plan.id}
            aria-labelledby={`monthly-plan-${plan.id}`}
          >
            <header>
              <h3 id={`monthly-plan-${plan.id}`}>{plan.name}</h3>
              <p>{plan.audience}</p>
            </header>
            <p className="monthly-plan-price">
              <strong>Giá chưa công bố</strong>
              <span>/ tháng</span>
            </p>
            <dl>
              <div>
                <dt>Chi nhánh dự kiến</dt>
                <dd>
                  {plan.branchLimit === 1 ? "1 chi nhánh" : `Tối đa ${plan.branchLimit} chi nhánh`}
                </dd>
              </div>
            </dl>
          </article>
        ))}
      </div>
      <div className="monthly-plans-shared">
        <h3>Cả hai gói dự kiến bao gồm</h3>
        <ul>
          {sharedFeatures.map((feature) => (
            <li key={feature}>{feature}</li>
          ))}
        </ul>
      </div>
      <div className="monthly-plans-pending" role="note">
        <p>Hạn mức OTP, nhân viên, danh bạ và dung lượng ảnh chưa được chốt.</p>
        <p>
          Chưa mở đăng ký, thu phí hoặc áp dụng giới hạn mới. Quyền sử dụng và dữ liệu của salon
          hiện tại không thay đổi.
        </p>
        <p>Chính sách dự kiến: hết hạn gói không tự xóa điểm, ảnh hoặc lịch sử.</p>
      </div>
    </section>
  );
}
