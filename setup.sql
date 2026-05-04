-- =====================================================
-- SETUP SUPABASE CHO TOOL TÀI XỈU BY DZI
-- Chạy file này trong Supabase SQL Editor
-- =====================================================

-- ── BẢNG QUẢN LÝ TÀI KHOẢN USER ──────────────────────────
CREATE TABLE IF NOT EXISTS tx_users (
  username     text PRIMARY KEY,
  password     text NOT NULL,
  expires      timestamptz NOT NULL,
  max_devices  int DEFAULT 1,
  created_at   timestamptz DEFAULT now()
);

-- ── BẢNG QUẢN LÝ THIẾT BỊ (IP) ────────────────────────────
CREATE TABLE IF NOT EXISTS tx_ipmap (
  username  text PRIMARY KEY,
  devices   jsonb DEFAULT '[]'::jsonb,
  updated_at timestamptz DEFAULT now()
);

-- RLS cho tx_users và tx_ipmap
ALTER TABLE tx_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE tx_ipmap ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_all_users"  ON tx_users  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_ipmap"  ON tx_ipmap  FOR ALL USING (true) WITH CHECK (true);

-- Bảng lưu kết quả phiên realtime
CREATE TABLE IF NOT EXISTS tx_results (
  id            bigserial PRIMARY KEY,
  app           text NOT NULL,
  api_label     text NOT NULL,
  api_type      text NOT NULL,
  phien         text NOT NULL,
  ket_qua       text,
  tong          int,
  xuc_xac_1     int,
  xuc_xac_2     int,
  xuc_xac_3     int,
  md5_raw       text,
  ket_qua_truyen_thong text,
  ket_qua_chi_tiet     text,
  created_at    timestamptz DEFAULT now()
);

-- Bảng lưu dự đoán AI
CREATE TABLE IF NOT EXISTS tx_predictions (
  id            bigserial PRIMARY KEY,
  app           text NOT NULL,
  api_label     text NOT NULL,
  phien         text NOT NULL,
  du_doan       text NOT NULL,
  do_tin_cay    int,
  votes         int,
  total_methods int,
  ket_qua_thuc  text,
  dung_sai      text,
  created_at    timestamptz DEFAULT now()
);

-- Bảng lưu lịch sử 80 phiên gần nhất (dùng cho web hiển thị)
CREATE TABLE IF NOT EXISTS tx_history (
  id            bigserial PRIMARY KEY,
  app           text NOT NULL,
  api_label     text NOT NULL,
  history_json  jsonb NOT NULL,
  stats_json    jsonb,
  updated_at    timestamptz DEFAULT now(),
  UNIQUE(app, api_label)
);

-- Index để query nhanh
CREATE INDEX IF NOT EXISTS idx_tx_results_app ON tx_results(app, api_label, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tx_pred_app ON tx_predictions(app, api_label, created_at DESC);

-- Enable Realtime cho các bảng
ALTER PUBLICATION supabase_realtime ADD TABLE tx_results;
ALTER PUBLICATION supabase_realtime ADD TABLE tx_predictions;
ALTER PUBLICATION supabase_realtime ADD TABLE tx_history;

-- Row Level Security (cho phép đọc public, ghi cần secret key)
ALTER TABLE tx_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE tx_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE tx_history ENABLE ROW LEVEL SECURITY;

-- Policy: cho phép đọc tất cả (web dùng publishable key đọc được)
CREATE POLICY "allow_read_results" ON tx_results FOR SELECT USING (true);
CREATE POLICY "allow_read_predictions" ON tx_predictions FOR SELECT USING (true);
CREATE POLICY "allow_read_history" ON tx_history FOR SELECT USING (true);

-- Policy: cho phép insert/update (Python dùng secret key)
CREATE POLICY "allow_insert_results" ON tx_results FOR INSERT WITH CHECK (true);
CREATE POLICY "allow_insert_predictions" ON tx_predictions FOR INSERT WITH CHECK (true);
CREATE POLICY "allow_upsert_history" ON tx_history FOR ALL USING (true);

-- ── BẢNG BẢO TRÌ SẢNH (sync cho tất cả user) ──────────────
CREATE TABLE IF NOT EXISTS tx_maintenance (
  app      text PRIMARY KEY,
  enabled  boolean DEFAULT false,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE tx_maintenance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_maint" ON tx_maintenance FOR ALL USING (true) WITH CHECK (true);

-- Thêm dữ liệu mặc định (tất cả sảnh online)
INSERT INTO tx_maintenance (app, enabled) VALUES
  ('sunwin',   false),
  ('xocdia88', false),
  ('hitclub',  false),
  ('lc79',     false),
  ('betvip',   false)
ON CONFLICT (app) DO NOTHING;
