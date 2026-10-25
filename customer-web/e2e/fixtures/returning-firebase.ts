// Browser-test transport only; there is no Firebase project or credential in this harness.
export const getFirebaseAuth = () => null;
export const getFirebaseStorage = () => null;
export async function callFunction(name: string, input: unknown) {
  const response = await fetch(`/__fixture/${name}`, {
    method: "POST",
    body: JSON.stringify(input),
  });
  if (!response.ok) throw new Error("Kết nối bị gián đoạn. Vui lòng thử lại.");
  return response.json();
}
