import { callFunction } from "./firebase";

export type CustomerNameChange = {
  salonId: string;
  customerId: string;
  name: string;
  expectedName: string;
  pointRequestId?: string;
};

export async function updateCustomerName(input: CustomerNameChange) {
  const name = input.name.trim();
  if (!name || name.length > 80 || /\p{Cc}/u.test(name))
    throw new Error("Tên khách cần từ 1 đến 80 ký tự hợp lệ.");
  const result = await callFunction<CustomerNameChange, { customerId: string; name: string }>(
    "updateSalonCustomerName",
    {
      salonId: input.salonId,
      customerId: input.customerId,
      name,
      expectedName: input.expectedName,
      ...(input.pointRequestId === undefined ? {} : { pointRequestId: input.pointRequestId }),
    },
  );
  if (
    !result ||
    result.customerId !== input.customerId ||
    typeof result.name !== "string" ||
    !result.name.trim()
  )
    throw new Error("Máy chủ chưa xác nhận tên khách. Vui lòng tải lại và kiểm tra.");
  return result;
}
