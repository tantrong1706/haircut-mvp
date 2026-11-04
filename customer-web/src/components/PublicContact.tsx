import { publicContact } from "../config/publicContact";

export function PublicContact() {
  const { email } = publicContact();
  if (!email) return <p>Vui lòng liên hệ trực tiếp salon đã phục vụ để được hỗ trợ.</p>;
  return (
    <p>
      Email hỗ trợ: <a href={`mailto:${email}`}>{email}</a>
    </p>
  );
}
