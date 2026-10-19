// Browser-test adapter only. This file is not imported by the production app.
export async function searchSalonCustomers(input: unknown) {
  const response = await fetch("/__fixture/search", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return response.json();
}
