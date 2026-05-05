-- =====================================================
-- SETUP SUPABASE — TOOL TÀI XỈU AI v9  by Dzi
-- CHẠY FILE NÀY TRONG SUPABASE SQL EDITOR
-- ⚠️ Dùng bảng _v2 để tránh ghi đè data cũ
-- =====================================================

-- ── USER & AUTH (dùng chung với v1, không tạo lại) ─────────
CREATE TABLE IF NOT EXISTS tx_users (
  username    text PRIMARY KEY,
  password    text NOT NULL,
  expires     timestamptz NOT NULL,
  max_devices int DEFAULT 1,
  created_at  timestamptz DEFAULT now()
);
CREATE TABLE IF NOT EXISTS tx_ipmap (
  username   text PRIMARY KEY,
  devices    jsonb DEFAULT '[]'::jsonb,
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE tx_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE tx_ipmap ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "allow_all_users" ON tx_users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "allow_all_ipmap" ON tx_ipmap FOR ALL USING (true) WITH CHECK (true);

-- ── BẢO TRÌ (dùng chung — không tạo lại nếu đã có) ────────
CREATE TABLE IF NOT EXISTS tx_maintenance (
  app        text PRIMARY KEY,
  enabled    boolean DEFAULT false,
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE tx_maintenance ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "allow_all_maint" ON tx_maintenance FOR ALL USING (true) WITH CHECK (true);

-- Thêm tất cả sảnh mới vào bảo trì (ON CONFLICT DO NOTHING)
INSERT INTO tx_maintenance (app, enabled) VALUES
  ('sunwin',   false), ('xocdia88', false), ('hitclub',  false),
  ('lc79',     false), ('betvip',   false), ('789club',  false),
  ('max789',   false), ('b52',      false), ('son789',   false),
  ('luck8',    false), ('bcr',      false)
ON CONFLICT (app) DO NOTHING;

-- ── KẾT QUẢ PHIÊN v2 ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tx_results_v2 (
  id            bigserial PRIMARY KEY,
  app           text NOT NULL,
  api_label     text NOT NULL,
  api_type      text NOT NULL,
  game          text DEFAULT 'taixiu',
  phien         text NOT NULL,
  ket_qua       text,
  tong          int,
  xuc_xac_1     int,
  xuc_xac_2     int,
  xuc_xac_3     int,
  xuc_xac_list  jsonb,
  md5_raw       text,
  md5_enc       text,
  thoi_gian     text,
  ket_qua_truyen_thong text,
  ket_qua_chi_tiet     text,
  betting_nguoi_tai    int,
  betting_nguoi_xiu    int,
  betting_tien_tai     text,
  betting_tien_xiu     text,
  betting_tong_nguoi   int,
  betting_tong_tien    text,
  betting_trang_thai   text,
  dem_nguoc            int,
  jackpot              text,
  phien_cuoc           text,
  created_at    timestamptz DEFAULT now()
);

-- ── DỰ ĐOÁN AI v2 ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tx_predictions_v2 (
  id            bigserial PRIMARY KEY,
  app           text NOT NULL,
  api_label     text NOT NULL,
  game          text DEFAULT 'taixiu',
  phien         text NOT NULL,
  du_doan       text NOT NULL,
  do_tin_cay    int,
  votes         int,
  total_methods int,
  created_at    timestamptz DEFAULT now()
);

-- ── LỊCH SỬ v2 (web đọc để hiển thị) ───────────────────────
CREATE TABLE IF NOT EXISTS tx_history_v2 (
  id           bigserial PRIMARY KEY,
  app          text NOT NULL,
  api_label    text NOT NULL,
  history_json jsonb NOT NULL,
  stats_json   jsonb,
  updated_at   timestamptz DEFAULT now(),
  UNIQUE(app, api_label)
);

-- ── VERDICTS v2 (kiểm tra đúng/sai) ─────────────────────────
CREATE TABLE IF NOT EXISTS tx_verdicts_v2 (
  id               bigserial PRIMARY KEY,
  app              text NOT NULL,
  api_label        text NOT NULL,
  game             text DEFAULT 'taixiu',
  phien            text,
  du_doan          text,
  ket_qua_thuc_te  text,
  dung             boolean,
  updated_at       timestamptz DEFAULT now()
);

-- ── BACCARAT RESULTS v2 ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS bcr_results_v2 (
  id               bigserial PRIMARY KEY,
  app              text DEFAULT 'bcr',
  ban              text NOT NULL,
  ket_qua_moi_nhat text,
  tong_phien       int,
  cai_count        int,
  con_count        int,
  hoa_count        int,
  good_road        text,
  results_raw      text,
  du_doan_tiep     text,
  do_tin_cay       int,
  updated_at       timestamptz DEFAULT now(),
  UNIQUE(app, ban)
);

-- ⚠️ Migration: nếu bảng đã tồn tại, thêm UNIQUE constraint và xoá duplicate rows cũ
-- Chạy 2 câu này trên Supabase SQL editor nếu bảng đã có data:
-- DELETE FROM bcr_results_v2 WHERE id NOT IN (SELECT MAX(id) FROM bcr_results_v2 GROUP BY app, ban);
-- ALTER TABLE bcr_results_v2 ADD CONSTRAINT bcr_results_v2_app_ban_unique UNIQUE (app, ban);

-- ── BACCARAT VERDICTS v2 ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS bcr_verdicts_v2 (
  id               bigserial PRIMARY KEY,
  app              text DEFAULT 'bcr',
  ban              text NOT NULL,
  du_doan          text,
  ket_qua_thuc_te  text,
  dung             boolean,
  updated_at       timestamptz DEFAULT now()
);

-- ── INDEX ──────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_tx_results_v2_app    ON tx_results_v2(app, api_label, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tx_pred_v2_app       ON tx_predictions_v2(app, api_label, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tx_history_v2_app    ON tx_history_v2(app, api_label);
CREATE INDEX IF NOT EXISTS idx_bcr_results_v2_ban   ON bcr_results_v2(ban, updated_at DESC);

-- ── REALTIME ──────────────────────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE tx_results_v2;
ALTER PUBLICATION supabase_realtime ADD TABLE tx_predictions_v2;
ALTER PUBLICATION supabase_realtime ADD TABLE tx_history_v2;

-- ── RLS ────────────────────────────────────────────────────────
ALTER TABLE tx_results_v2     ENABLE ROW LEVEL SECURITY;
ALTER TABLE tx_predictions_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE tx_history_v2     ENABLE ROW LEVEL SECURITY;
ALTER TABLE tx_verdicts_v2    ENABLE ROW LEVEL SECURITY;
ALTER TABLE bcr_results_v2    ENABLE ROW LEVEL SECURITY;
ALTER TABLE bcr_verdicts_v2   ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "allow_read_results_v2"      ON tx_results_v2     FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "allow_read_pred_v2"         ON tx_predictions_v2 FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "allow_read_hist_v2"         ON tx_history_v2     FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "allow_insert_results_v2"    ON tx_results_v2     FOR INSERT WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "allow_insert_pred_v2"       ON tx_predictions_v2 FOR INSERT WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "allow_all_hist_v2"          ON tx_history_v2     FOR ALL USING (true);
CREATE POLICY IF NOT EXISTS "allow_all_verdicts_v2"      ON tx_verdicts_v2    FOR ALL USING (true);
CREATE POLICY IF NOT EXISTS "allow_all_bcr_results_v2"   ON bcr_results_v2    FOR ALL USING (true);
CREATE POLICY IF NOT EXISTS "allow_all_bcr_verdicts_v2"  ON bcr_verdicts_v2   FOR ALL USING (true);
