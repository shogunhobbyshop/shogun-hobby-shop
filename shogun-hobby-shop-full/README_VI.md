# ShogunHobbyShop — Cloudflare Starter

Đây là bộ khung demo để chạy website catalogue + trang admin.
Bản này dùng Cloudflare Pages Functions làm API và D1 làm database.

## Cấu trúc
- frontend/: website khách hàng
- admin/: trang quản trị
- functions/api/: backend API
- schema.sql: tạo database D1
- wrangler.toml: cấu hình Cloudflare

## Cách test local
Cần cài Node.js và Wrangler:
npm install -g wrangler

Sau đó:
wrangler pages dev frontend

Lưu ý: bản demo frontend hiện có dữ liệu mẫu local để bạn xem giao diện.
Khi kết nối D1, API sẽ trả dữ liệu thật.

## Deploy GitHub + Cloudflare
1. Tạo repository GitHub tên shogun-hobby-shop.
2. Upload toàn bộ thư mục này.
3. Cloudflare Dashboard → Workers & Pages → Create → Pages → Connect to Git.
4. Chọn repository.
5. Build command: để trống.
6. Build output directory: frontend
7. Deploy.
8. Tạo D1 database tên shogun_db.
9. Chạy schema.sql vào D1.
10. Gắn database binding tên DB cho Pages Functions.
11. Custom domain trỏ vào Pages.

## Giai đoạn tiếp theo
- Đăng nhập admin thật
- Upload ảnh lên R2
- CRUD sản phẩm qua D1
- CRUD danh mục
- Chỉnh banner/logo/màu sắc từ admin
- Phân quyền admin
