import { browserLocalPersistence, setPersistence, type Auth } from "firebase/auth";

export async function prepareOwnerStaffPersistence(auth: Auth) {
  try {
    // Firebase owns the saved session; never persist the email/password ourselves.
    // This instance is separate from the customer Phone Auth instance.
    await setPersistence(auth, browserLocalPersistence);
  } catch {
    throw new Error(
      "Trình duyệt chưa cho phép lưu phiên đăng nhập. Hãy mở bằng Safari hoặc Chrome ở chế độ thường và cho phép lưu dữ liệu trang web.",
    );
  }
}
