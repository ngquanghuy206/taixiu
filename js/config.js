// ═══════════════════════════════════════════════════════════
//  CONFIG — Tài Xỉu AI  |  v9 Fixed by Dzi
// ═══════════════════════════════════════════════════════════

// ── SUPABASE ────────────────────────────────────────────────
const SUPA_URL = "https://rspqnrvciwqudeterpbl.supabase.co";
const SUPA_KEY = "sb_publishable_DcRnyAQHhdAeqCEv8a5ELQ_k4hO9eSm";

const ADMIN_USER = "ngquanghuy206";
const ADMIN_PASS = "nqh300506";

// ── TÊN BẢNG SQL (v2 — tránh ghi đè data cũ) ───────────────
const DB_TABLES = {
  users:       "tx_users",
  ipmap:       "tx_ipmap",
  maintenance: "tx_maintenance",
  results:     "tx_results_v2",
  predictions: "tx_predictions_v2",
  history:     "tx_history_v2",
  verdicts:    "tx_verdicts_v2",
  bcrResults:  "bcr_results_v2",
  bcrVerdicts: "bcr_verdicts_v2",
};

// ── SẢNH TÀI XỈU ────────────────────────────────────────────
const APIS_TX = {
  sunwin: [
    { label: "Tai Xiu", display: "Tài Xỉu", url: "https://bracket-ellen-roads-prefer.trycloudflare.com/api/tx",      type: "normal" },
    { label: "Sicbo",   display: "Xúc Xắc", url: "https://afterwards-motels-honors-vendors.trycloudflare.com/api/sunsicbo", type: "md5" },
  ],
  xocdia88: [
    { label: "TX MD5",  url: "https://books-carlo-instruments-capture.trycloudflare.com/api/taixiu",   type: "md5" },
  ],
  hitclub: [
    { label: "TX MD5",  url: "https://letting-tackle-newton-oak.trycloudflare.com/api/tx",  type: "md5_hitclub" },
  ],
  lc79: [
    { label: "TX Thuong", url: "https://chance-compete-chambers-feelings.trycloudflare.com/api/tx",     type: "normal" },
    { label: "TX MD5",    url: "https://chance-compete-chambers-feelings.trycloudflare.com/api/txmd5",   type: "md5" },
    { label: "Xoc Dia",   url: "https://chance-compete-chambers-feelings.trycloudflare.com/api/xocdia",  type: "xocdia" },
  ],
  betvip: [
    { label: "TX Thuong", url: "https://plastic-diet-visits-opens.trycloudflare.com/api/tx",    type: "normal" },
    { label: "TX MD5",    url: "https://plastic-diet-visits-opens.trycloudflare.com/api/txmd5", type: "md5" },
  ],
  "789club": [
    { label: "Tai Xiu", url: "https://dependent-epinions-somebody-enclosed.trycloudflare.com/api/tx", type: "normal" },
  ],
  max789: [
    { label: "Tai Xiu", url: "https://cage-adjustment-whose-banner.trycloudflare.com/api/tx", type: "md5" },
  ],
  b52: [
    { label: "TX MD5",  url: "https://gold-ultra-fails-handles.trycloudflare.com/txmd5", type: "md5" },
  ],
  son789: [
    { label: "TX MD5",  url: "https://tanks-gates-subscription-hosting.trycloudflare.com/api/txmd5", type: "md5" },
  ],
  luck8: [
    { label: "TX MD5",  url: "https://heroes-presents-pound-tablet.trycloudflare.com/api/txmd5",  type: "md5" },
    { label: "Sicbo40", url: "https://heroes-presents-pound-tablet.trycloudflare.com/api/sicbo40", type: "normal" },
  ],
};

// ── SẢNH BACCARAT ────────────────────────────────────────────
const APIS_BCR = {
  bcr: [
    { label: "Baccarat", display: "Baccarat Sexy", url: "https://classic-watching-cup-representatives.trycloudflare.com/api/bcr", type: "bcr", game: "baccarat" },
  ],
};

// ── APIS (gộp — dùng nội bộ) ─────────────────────────────────
const APIS = { ...APIS_TX, ...APIS_BCR };

// ── PROXY ────────────────────────────────────────────────────
const PROXY_BASE = "https://fi10.bot-hosting.net:20259";

const LOBBY_URLS = {
  sunwin:   "https://sunwin.mw",
  xocdia88: "https://play.xocdia88.green",
  hitclub:  "https://v.hitclub.si/?a=hitclub",
  lc79:     "https://lc79c.bet",
  betvip:   "https://play.betvip.fit/?utm_source=seo",
  "789club":"https://789club.com",
  max789:   "https://max789.net",
  b52:      "https://b52.games",
  son789:   "https://son789.com",
  luck8:    "https://luck8.vip",
  bcr:      "#",
};

// ── MAINTENANCE (Supabase sync — fix: luôn fetch mới khi check) ─
let _maintCache    = null;
let _maintFetching = false;
let _maintLastFetch = 0;

async function getMaintenance(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && _maintCache !== null && now - _maintLastFetch < 10000) return _maintCache;
  if (_maintFetching) return _maintCache || {};
  _maintFetching = true;
  try {
    const r = await fetch(`${SUPA_URL}/rest/v1/${DB_TABLES.maintenance}?select=app,enabled`, { headers: _SH() });
    if (!r.ok) { _maintFetching = false; return _maintCache || {}; }
    const rows = await r.json();
    const m = {};
    rows.forEach(row => { if (row.enabled) m[row.app] = true; });
    _maintCache = m;
    _maintLastFetch = now;
    _maintFetching = false;
    return m;
  } catch { _maintFetching = false; return _maintCache || {}; }
}

async function saveMaintenance(app, enabled) {
  try {
    const r = await fetch(`${SUPA_URL}/rest/v1/${DB_TABLES.maintenance}`, {
      method: "POST",
      headers: { ..._SH(), "Prefer": "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify({ app, enabled, updated_at: new Date().toISOString() })
    });
    if (!r.ok) console.error("saveMaintenance lỗi:", await r.text());
    if (!_maintCache) _maintCache = {};
    if (enabled) _maintCache[app] = true;
    else delete _maintCache[app];
    _maintLastFetch = Date.now();
  } catch(e) { console.error("saveMaintenance exception:", e); }
}

async function isUnderMaintenance(app) {
  // Fix: luôn fetch fresh từ Supabase — không dùng cache
  try {
    const r = await fetch(`${SUPA_URL}/rest/v1/${DB_TABLES.maintenance}?app=eq.${encodeURIComponent(app)}&select=enabled`, { headers: _SH() });
    if (!r.ok) return false;
    const rows = await r.json();
    return !!(rows[0]?.enabled);
  } catch { return false; }
}

// ── BRAND DATA ────────────────────────────────────────────────
const BRAND_IMG = {
  sunwin:   "img/sunwin.jpg",
  xocdia88: "img/xocdia88.jpg",
  hitclub:  "img/hitclub.jpg",
  lc79:     "img/lc79.jpg",
  betvip:   "img/betvip.jpg",
  "789club":"img/789club.jpg",
  max789:   "img/max789.jpg",
  b52:      "img/b52.jpg",
  son789:   "img/son789.jpg",
  luck8:    "img/luck8.jpg",
  bcr:      "img/bcr.jpg",
};
const BRAND_EMOJI = {
  sunwin:"☀️", xocdia88:"🎯", hitclub:"🎪", lc79:"🎲", betvip:"💎",
  "789club":"7️⃣", max789:"🔥", b52:"✈️", son789:"🃏", luck8:"🍀", bcr:"🎴",
};
const BRAND_COLOR = {
  sunwin:"#FFD700", xocdia88:"#FF4500", hitclub:"#00CED1", lc79:"#7B68EE", betvip:"#FF69B4",
  "789club":"#FF6B35", max789:"#E74C3C", b52:"#3498DB", son789:"#2ECC71", luck8:"#F39C12", bcr:"#9B59B6",
};
const BRAND_GRADIENT = {
  sunwin:   "linear-gradient(135deg,#ff8c00,#ffd700)",
  xocdia88: "linear-gradient(135deg,#ff4500,#ff6b35)",
  hitclub:  "linear-gradient(135deg,#00ced1,#00fa9a)",
  lc79:     "linear-gradient(135deg,#7b68ee,#9370db)",
  betvip:   "linear-gradient(135deg,#ff69b4,#ff1493)",
  "789club":"linear-gradient(135deg,#ff6b35,#e74c3c)",
  max789:   "linear-gradient(135deg,#e74c3c,#c0392b)",
  b52:      "linear-gradient(135deg,#3498db,#2980b9)",
  son789:   "linear-gradient(135deg,#2ecc71,#27ae60)",
  luck8:    "linear-gradient(135deg,#f39c12,#e67e22)",
  bcr:      "linear-gradient(135deg,#9b59b6,#6c3483)",
};

const RE  = { "Tài":"🔴","Xỉu":"🔵","Chẵn":"🟢","Lẻ":"🟡","Cái":"🔴","Con":"🔵","Hòa":"🟡",
              "Tai":"🔴","Xiu":"🔵","Chan":"🟢","Le":"🟡","Cai":"🔴","Hoa":"🟡" };
const RCL = { "Tài":"tai","Xỉu":"xiu","Chẵn":"chan","Lẻ":"le","Cái":"tai","Con":"xiu","Hòa":"hoa",
              "Tai":"tai","Xiu":"xiu","Chan":"chan","Le":"le","Cai":"tai","Hoa":"hoa" };
// Chuẩn hoá kết quả từ DB (Python lưu không dấu) → hiển thị có dấu
function normalizeKq(kq) {
  const map = {"Tai":"Tài","Xiu":"Xỉu","Chan":"Chẵn","Le":"Lẻ","Cai":"Cái","Hoa":"Hòa"};
  return map[kq] || kq;
}
