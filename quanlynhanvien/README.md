# Quản lý nhân viên - bản hoàn thiện

## Đã hoàn thiện
- Đăng nhập Firebase Authentication + phân quyền Admin / Trưởng phòng / Nhân viên.
- Portal nhân viên: hồ sơ, cập nhật hồ sơ, check-in/check-out, lịch sử chấm công, gửi đơn nghỉ phép, xem lương.
- Portal trưởng phòng: quản lý nhân sự theo đúng phòng ban, thêm/sửa/xóa, chấm công phòng, duyệt/từ chối nghỉ phép, báo cáo.
- Portal Admin: danh sách nhân viên, phòng ban, chấm công, bảng lương, tài khoản, báo cáo.
- Tính lương thống nhất: lương cơ bản / 22 × ngày công + phụ cấp + tăng ca; tăng ca 200.000đ/giờ cho nhân viên và 300.000đ/giờ cho trưởng phòng.
- Tìm kiếm/lọc nhân viên, trạng thái đơn nghỉ phép, email đặt lại mật khẩu.

## Firebase
Dự án đang dùng Firebase project đã có trong `js/firebase.js`. Firestore cần các collection:
- `users` (document id = Firebase Auth UID, có `role`, `name`, `email`, `department`)
- `employees`
- `departments`
- `attendance`
- `leaves`

## Lưu ý
Tạo tài khoản Firebase Authentication cho nhân viên vẫn nên thực hiện bằng Firebase Admin SDK/Cloud Function hoặc Firebase Console. Front-end không tự tạo user Auth để tránh làm đăng xuất tài khoản quản trị hiện tại.
