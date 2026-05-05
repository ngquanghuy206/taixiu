# Tài Xỉu AI — v9 Fixed

## Thay đổi v9
- ✅ **Tên bảng SQL v2**: Toàn bộ bảng lịch sử đổi thành `_v2` suffix (tx_results_v2, tx_predictions_v2, tx_history_v2, tx_verdicts_v2, bcr_results_v2, bcr_verdicts_v2) — tránh ghi đè data cũ
- ✅ **Fix Admin Bảo Trì**: User vào sảnh luôn fetch Supabase realtime — không dùng cache cũ, đảm bảo hiện bảo trì ngay
- ✅ **Chia 2 khu Lobby**: Sảnh Tài Xỉu (trên) và Sảnh Baccarat (dưới)
- ✅ **Sảnh Mới**: 789club, max789, b52, son789, luck8 thêm vào cả web và tool
- ✅ **Baccarat Chọn Bàn**: Bấm vào sảnh BCR → popup danh sách bàn kèm % Cái/Con từng bàn, recent kết quả, đường đi
- ✅ **Logo sảnh mới**: Lấy từ thư mục `img/` (thêm file .jpg tương ứng)

## Cài đặt
1. Chạy `setup.sql` trong Supabase SQL Editor (tạo bảng _v2)
2. Chạy `tooltruyendatalenweb_v9.py` để sync data lên Supabase
3. Deploy thư mục web lên hosting

## Thêm logo sảnh mới
Đặt file ảnh vào thư mục `img/`:
- `789club.jpg`, `max789.jpg`, `b52.jpg`, `son789.jpg`, `luck8.jpg`, `bcr.jpg`
