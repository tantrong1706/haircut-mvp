import { callFunction } from "./firebase";

export function createManualCustomer(input: {
  salonId: string;
  branchId?: string;
  name: string;
  phone?: string;
  operationId: string;
  startVisit?: boolean;
  allowPhoto?: boolean;
}) {
  return callFunction<typeof input, { customerId: string; sessionId?: string }>(
    "createManualCustomer",
    input,
  );
}
