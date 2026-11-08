import { useState } from "react";
import { SalonContactDetails } from "../../components/SalonContactDetails";
import type { SalonBranch } from "../../services/operations";
import type { SalonPublicDetails } from "../../services/types";

export type PreviewBranch = Pick<SalonBranch, "id" | "salonId" | "name" | "address" | "isActive">;

type Props = SalonPublicDetails & {
  salonId: string;
  branches: readonly PreviewBranch[];
  showAddress: boolean;
  showDirections: boolean;
};

export function SalonCustomerPreview({
  salonId,
  branches,
  salonName,
  showAddress,
  showDirections,
  ...contact
}: Props) {
  const [branchId, setBranchId] = useState("");
  const activeBranches = branches.filter((branch) => branch.salonId === salonId && branch.isActive);
  const branch = activeBranches.find((option) => option.id === branchId) ?? activeBranches[0];
  const branchAddress = showAddress ? branch?.address.trim() : undefined;

  return (
    <>
      <p className="muted">Xem thử theo các mục đang chỉnh. Bản xem trước không lưu thay đổi.</p>
      {activeBranches.length > 1 ? (
        <label className="field">
          <span>Chi nhánh xem trước</span>
          <select value={branch?.id} onChange={(event) => setBranchId(event.target.value)}>
            {activeBranches.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <div className="salon-preview-card">
        <strong>{salonName?.trim() || "Tên salon"}</strong>
        {branch ? <p>{branch.name}</p> : <p className="muted">Chưa có chi nhánh để xem trước.</p>}
        {branchAddress ? <p>{branchAddress}</p> : null}
        <SalonContactDetails
          {...contact}
          salonName={salonName}
          branchAddress={branchAddress}
          branchDirectionsEnabled={showDirections}
          preview
        />
      </div>
    </>
  );
}
