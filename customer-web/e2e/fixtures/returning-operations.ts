// Browser-test adapter only. This file is not imported by the production app.
export async function searchSalonCustomers(input: unknown) {
  const response = await fetch("/__fixture/search", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return response.json();
}
export async function getSalonCustomerDetails(input: { customerId: string }) {
  return { id: input.customerId, recentRecords: [] };
}
