import { callFunction } from "./firebase";
import type { CustomerSearchPage } from "./operations";

export function listSalonCustomerDirectory(input: { salonId: string; cursor?: string | null }) {
  return callFunction<
    { salonId: string; directory: true; pageSize: number; cursor?: string },
    CustomerSearchPage & { totalCount: number }
  >("searchSalonCustomers", {
    salonId: input.salonId,
    directory: true,
    pageSize: 10,
    ...(input.cursor ? { cursor: input.cursor } : {}),
  });
}

export async function savePendingVisitNote(input: {
  salonId: string;
  requestId: string;
  note: string;
}): Promise<void> {
  // Omit photo fields: a note is a patch, never a replacement of the photo list.
  await callFunction("updatePendingPointRequestPhotos", input);
}
