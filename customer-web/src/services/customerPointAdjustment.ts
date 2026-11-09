import { callFunction } from "./firebase";

export type CustomerPointAdjustment = {
  salonId: string;
  customerId: string;
  expectedPoints: number;
  delta: number;
  reason: string;
  idempotencyKey: string;
};

export function adjustSalonCustomerPoints(input: CustomerPointAdjustment) {
  return callFunction<
    CustomerPointAdjustment,
    {
      pointsBefore: number;
      pointsAfter: number;
      currentPoints: number;
      alreadyProcessed: boolean;
    }
  >("adjustSalonCustomerPoints", input);
}
