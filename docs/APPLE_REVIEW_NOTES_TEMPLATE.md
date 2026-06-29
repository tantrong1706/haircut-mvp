# Template Review Notes Cho App Store Connect

Điền thông tin thật trước khi submit. Không để placeholder trong bản gửi Apple.

```text
App này dành cho chủ salon và nhân viên salon tóc dùng để quản lý khách quét QR, ghi chú kiểu tóc, gửi/duyệt điểm thưởng và đổi mã quà.

Demo accounts:

Owner:
Email: owner-demo@yourdomain.com
Password: <password>

Staff:
Email: staff-demo@yourdomain.com
Password: <password>

Sample customer QR/web flow:
https://haircut-c7d12.web.app/?salonId=demo-salon&mirrorId=demo-mirror-1&qrToken=demo-token

Suggested review flow:
1. Login as Staff, open customer queue.
2. Open sample QR URL in browser to create a customer session if needed.
3. In Staff app, select the customer, add haircut note, submit point request.
4. Login as Owner, open Dashboard and Approvals.
5. Approve or reject the point request.
6. Open Wheel Config and update reward settings.
7. Test Redeem Reward Code with a sample unused code if available.

Backend services are live during review. Please contact <support email> if the demo account needs reset.
```

## Checklist Trước Khi Dán

- Demo owner đăng nhập được.
- Demo staff đăng nhập được.
- Sample QR tạo được customer session.
- Có sẵn ít nhất một khách, một point request và một mã quà mẫu nếu muốn reviewer test nhanh.
- Backend đã deploy Functions.
- Firestore rules production đã khóa và flow vẫn pass.
- Email support là email thật có người theo dõi trong thời gian review.
