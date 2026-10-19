import { callFunction } from "./firebase";

export type ReturningCustomerAwardInput = {
  salonId: string;
  branchId: string;
  customerId: string;
  phoneLast4: string;
  operationId: string;
};

export function awardReturningCustomerPoints(input: ReturningCustomerAwardInput) {
  // No direct Firestore fallback: only the authenticated server may change points.
  return callFunction<
    ReturningCustomerAwardInput,
    {
      requestId: string;
      alreadyProcessed: boolean;
      pointsAdded: number;
      pointsAfter: number;
    }
  >("awardReturningCustomerPoints", input);
}
