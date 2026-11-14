import { callFunction } from "./firebase";

export function createManualCustomer(input: {
  salonId: string;
  branchId?: string;
  name: string;
  phone?: string;
  operationId: string;
}) {
  return callFunction<typeof input, { customerId: string }>("createManualCustomer", input);
}
