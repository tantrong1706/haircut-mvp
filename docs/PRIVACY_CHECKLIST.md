# Checklist Quyền Riêng Tư

Ứng dụng lưu tên khách, số điện thoại tùy chọn, lịch sử cắt tóc, ảnh kiểu tóc và mã quà. Cần xem đây là dữ liệu nhạy cảm của khách hàng.

## Đồng ý của khách

Câu hỏi nên rõ ràng:

```text
Salon có được lưu ảnh kiểu tóc để lần sau phục vụ tốt hơn không?
```

Lựa chọn:

- Đồng ý
- Không đồng ý

Nếu khách không đồng ý:

- Không chụp ảnh.
- Không upload ảnh.
- Chỉ lưu ghi chú cơ bản và điểm.

## Số điện thoại

Không nên xin số điện thoại ngay nếu chưa cần. Luồng tốt cho MVP:

1. Dùng Zalo user ID và tên hiển thị trước.
2. Xin số điện thoại sau khi giải thích rằng số điện thoại giúp salon phân biệt khách trùng tên.
3. Nhân viên chỉ thấy 4 số cuối.

## Quyền của nhân viên

Nhân viên nên thấy:

- Tên khách.
- 4 số cuối điện thoại.
- Điểm.
- Lịch sử của khách đang phục vụ.

Nhân viên không nên thấy:

- Số điện thoại đầy đủ mặc định.
- Export toàn bộ khách.
- Cài đặt salon.
- Cấu hình vòng quay.
- Công cụ xóa dữ liệu thô.

## Yêu cầu xóa dữ liệu

Khách nên có quyền yêu cầu:

- Xóa ảnh kiểu tóc đã lưu.
- Xóa hồ sơ khách.
- Rút lại đồng ý lưu ảnh.

## Trang công khai

Trang chính sách hiện tại:

```text
https://haircut-c7d12.web.app/privacy
```

## Storage

Chưa triển khai Storage nếu project chưa nâng Blaze. Khi bật upload ảnh, cần rules riêng cho ảnh theo `salonId`, `customerId` và quyền chủ salon/nhân viên.
