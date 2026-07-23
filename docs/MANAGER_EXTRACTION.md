# Ranh giới HAIRCUT Manager

## Ranh giới hiện tại

- Manager chỉ đọc biến môi trường từ `apps/manager-mobile/.env*`.
- Firebase bootstrap riêng nằm tại `apps/manager-mobile/src/services/firebase.ts`.
- Manager có Auth gate, layout, navigation, component, Owner feature, Staff feature và stylesheet riêng.
- `main.tsx` chỉ nạp `manager.css`.
- Không import `zalo-mini-app/src/pages/*` hoặc `zalo-mini-app/src/styles/*`.
- Android/iOS dùng Application ID `vn.haircut.manager`; cấu hình Firebase native và signing không
  nằm trong Git.

## Phụ thuộc dùng chung có chủ đích

`apps/manager-mobile/src/services/managerApi.ts` là adapter tạm thời tới các service nghiệp vụ đã
được kiểm thử trong `zalo-mini-app/src/services`. Manager chỉ tái sử dụng API/service:

- Auth và role.
- Owner/staff operations.
- Ảnh kiểu tóc.
- Branding salon.
- Xóa tài khoản/salon.
- Cấu hình vòng quay.

Manager không import UI, CSS, SDK Zalo hoặc biến môi trường Zalo. Cách này giữ một nguồn business
logic trong khi tách hoàn toàn bề mặt Manager.

## Kiểm soát hồi quy

- `managerIsolation.test.ts` chặn import page/CSS của Zalo.
- `managerFeatureParity.test.ts` bảo vệ 81 vị trí chức năng.
- `ManagerLayout.test.tsx` bảo vệ đúng năm tab theo role.
- `managerScreens.test.tsx` bảo vệ cấu trúc thông tin chính.
- Manager build bằng package-lock và `.env` riêng.

## Bước tách tiếp theo

Khi có task riêng, chuyển service dùng chung thật sự sang `packages/firebase-client` và
`packages/business-rules`, từng module một. Không copy nguyên service và không tạo hai nguồn
nghiệp vụ song song.
