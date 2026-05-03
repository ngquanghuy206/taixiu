# 🎰 Tài Xỉu AI — Tool Dự Đoán
**by Nguyễn Quang Huy Dzi**

## 📁 Cấu Trúc File

```
taixiu/
├── index.html          ← Trang chính (mở file này)
├── css/
│   └── styles.css      ← Toàn bộ giao diện
└── js/
    ├── config.js       ← Cấu hình API + sảnh game
    ├── auth.js         ← Đăng nhập, IP lock, quản lý tài khoản
    ├── algorithms.js   ← 42 thuật toán dự đoán AI
    └── app.js          ← Logic chính, fetch data, render
```

## ✅ Tính Năng

- **42 thuật toán AI**: Markov, EMA, MACD, Bollinger, Kalman, Fibonacci, RSI, LZ Complexity...
- **Iframe sảnh game**: Mở web sảnh ngay trong tool, panel dự đoán nổi bên trên
- **IP Lock**: 1 tài khoản = 1 IP. Đăng nhập thiết bị khác → báo lỗi
- **Admin panel**: Tạo/sửa/xóa tài khoản, reset IP, xem trạng thái
- **Panel draggable**: Kéo panel dự đoán tới bất kỳ góc nào
- **Hiệu ứng đẹp**: Robot, grid animation, orbit loader, calc terms flash

## 🔐 Tài Khoản Admin
- User: `ngquanghuy206`
- Pass: `nqh300506`

## ⚙️ Đổi API / Sảnh

Mở `js/config.js` → sửa `APIS` và `LOBBY_URLS`

## 🚀 Sử Dụng

Mở `index.html` bằng trình duyệt (Chrome/Edge) — không cần server.

> **Lưu ý**: Một số sảnh có X-Frame-Options nên không nhúng được iframe → tool sẽ hiển thị thông báo + URL để mở tab mới.
