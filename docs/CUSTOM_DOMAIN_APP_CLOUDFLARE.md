# Custom domain `app.chhaircutsalon.cc`

## Source of truth

Cloudflare account inventory ngày 24/08/2026 xác nhận chỉ có một registered
domain:

- Domain: `chhaircutsalon.cc`
- Registrar: Cloudflare
- Registration status: Active
- Auto-renew: enabled
- Expiration: 15/08/2027
- DNS zone: active, Full setup
- Authoritative nameservers: `jasmine.ns.cloudflare.com`, `tony.ns.cloudflare.com`

`app.chhaircutsalon.cc` là customer web domain. Apex `chhaircutsalon.cc` được giữ
cho landing page tương lai. Task này không cấu hình `manager` hoặc `admin`.

## Phạm vi và rollback

- Custom domain gắn vào Firebase Hosting site `haircut-c7d12`.
- Hai domain mặc định `haircut-c7d12.web.app` và
  `haircut-c7d12.firebaseapp.com` tiếp tục hoạt động song song.
- Zalo Mini App vẫn dùng Mini App ID `2038116772828167300`; không deploy ZMP chỉ
  để thêm custom web domain.
- Record `gateway.chhaircutsalon.cc` của named Cloudflare Tunnel không bị sửa.

Nếu custom domain gặp sự cố, tắt/xóa riêng DNS record `app` sau khi xác nhận phạm
vi. Không disable Hosting site, không đổi nameserver và không xóa domain mặc định.

## Kiến trúc Hosting

`zalo-mini-app` build vào `zalo-mini-app/www`. Script deploy chép nội dung này
vào `firebase/public`, sau đó chỉ deploy Firebase Hosting. `firebase/firebase.json`
đặt rõ site `haircut-c7d12` và có SPA fallback `** -> /index.html`; không rewrite
Functions/API.

Asset dùng đường dẫn tương đối và Firebase SDK/Functions/Storage dùng HTTPS. CSP
dùng `'self'` cho origin hiện tại và whitelist hẹp cho Firebase, Google, Zalo và
Sentry; custom domain không cần mở rộng CSP hoặc CORS.

## Cloudflare conflict gate

Trước khi tạo record, kiểm tra DNS, Worker Routes và Redirect Rules:

- Không có A/AAAA/CNAME tên `app`.
- Không có Worker Route.
- Không có Redirect Rule đang chiếm `app.chhaircutsalon.cc`.
- Tạo record Firebase yêu cầu với Proxy status **DNS only** trong giai đoạn verify
  và cấp certificate.
- Không sửa MX, SPF, DKIM, DMARC, record email hoặc record Tunnel `gateway`.

Firebase Hosting đã cung cấp và Cloudflare đã lưu đúng record sau:

| Type  | Name/Host | Target/Value              | Proxy status | TTL  |
| ----- | --------- | ------------------------- | ------------ | ---- |
| CNAME | `app`     | `haircut-c7d12.web.app`   | DNS only     | Auto |

Cloudflare và Google public resolvers đều trả CNAME đúng. Firebase đã verify DNS,
cấp certificate và báo `Connected`; HTTP chuyển sang HTTPS và các SPA route chính
đều trả `200`.

## Firebase Authentication

`app.chhaircutsalon.cc` đã được thêm mà không xóa domain hiện tại tại:

**Firebase Console → Authentication → Settings → Authorized domains → Add domain**.

Điều này cần thiết cho owner/staff password-reset continue URL vì frontend tạo URL
từ `window.location.origin`. Giữ `localhost`, `haircut-c7d12.web.app` và
`haircut-c7d12.firebaseapp.com`. Production hiện chưa cấu hình web App Check site
key nên không cần thay đổi reCAPTCHA/App Check domain restrictions.

## SSL và xác minh

Sau khi DNS được Firebase xác minh, trạng thái có thể chuyển từ `Needs setup`
sang `Pending`/`Provisioning certificate` trước khi thành `Connected`. Firebase tự
cấp và gia hạn certificate. Không báo hoàn tất khi certificate còn pending.

Khi trạng thái là `Connected`, chạy:

```powershell
Resolve-DnsName app.chhaircutsalon.cc
curl.exe -I http://app.chhaircutsalon.cc/
curl.exe -I https://app.chhaircutsalon.cc/
curl.exe -I https://app.chhaircutsalon.cc/history
curl.exe -I https://app.chhaircutsalon.cc/wheel
curl.exe -I https://haircut-c7d12.web.app/
```

Xác nhận HTTP redirect sang HTTPS, HTTPS/SPA routes trả `200`, JS/CSS không lỗi,
console không có mixed-content/CSP error, Firebase session/Auth/Functions/Storage,
History, Wheel và ảnh đều hoạt động. Chạy thêm:

```powershell
.\scripts\check-production-readiness.ps1 -CheckLiveUrls
```
