# ShogunHobbyShop — Admin v1

Bản này nâng `/admin/` thành CMS cơ bản, dùng Cloudflare Pages Functions + D1.

## Có gì
- Đăng nhập admin bằng `ADMIN_PASSWORD` (Cloudflare Secret)
- Dashboard thống kê
- Thêm / sửa / xóa sản phẩm
- Giá, tồn kho, danh mục, mô tả, ảnh URL, ẩn/hiện
- Thêm / sửa / xóa danh mục
- Chỉnh tên shop, tagline, hotline, Zalo, Facebook

## Cấu hình bắt buộc
Cloudflare Pages/Workers project → Settings → Variables and Secrets → Add secret:
- Name: `ADMIN_PASSWORD`
- Value: mật khẩu admin bạn tự đặt

Sau khi thêm secret, redeploy project.

## Upload lên GitHub
Copy/ghi đè các thư mục `admin/` và `functions/` trong repo hiện tại bằng bản này. Không cần tạo lại D1.

## R2
V1 chưa upload ảnh trực tiếp. Ô ảnh dùng URL. R2 sẽ làm ở bước tiếp theo.
