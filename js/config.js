// ═══════════════════════════════════════════════════════════
//  CONFIG — Tài Xỉu AI  |  by Nguyễn Quang Huy Dzi
// ═══════════════════════════════════════════════════════════

// ── SUPABASE ────────────────────────────────────────────────
const SUPA_URL = "https://rspqnrvciwqudeterpbl.supabase.co";
const SUPA_KEY = "sb_publishable_DcRnyAQHhdAeqCEv8a5ELQ_k4hO9eSm";

const ADMIN_USER = "ngquanghuy206";
const ADMIN_PASS = "nqh300506";

const APIS = {
  sunwin:   [{ label:"Tài Xỉu",   url:"https://markers-amenities-vertex-gratuit.trycloudflare.com/api/tx",     type:"normal" }],
  xocdia88: [{ label:"TX MD5",    url:"https://acres-scientists-balanced-paso.trycloudflare.com/api/taixiu",   type:"md5" }],
  hitclub:  [{ label:"TX MD5",    url:"https://nirvana-corners-discussing-treating.trycloudflare.com/api/tx",  type:"md5_hitclub" }],
  lc79:     [
    { label:"TX Thường", url:"https://living-telecommunications-start-consoles.trycloudflare.com/api/tx",      type:"normal" },
    { label:"TX MD5",    url:"https://living-telecommunications-start-consoles.trycloudflare.com/api/txmd5",   type:"md5" },
    { label:"Xóc Đĩa",  url:"https://living-telecommunications-start-consoles.trycloudflare.com/api/xocdia",  type:"xocdia" },
  ],
  betvip:   [
    { label:"TX Thường", url:"https://wide-epic-steve-file.trycloudflare.com/api/tx",    type:"normal" },
    { label:"TX MD5",    url:"https://wide-epic-steve-file.trycloudflare.com/api/txmd5", type:"md5" },
  ],
};

const LOBBY_URLS = {
  sunwin:   "https://sunwin.mw",
  xocdia88: "https://play.xocdia88.green",
  hitclub:  "https://v.hitclub.si/?a=hitclub",
  lc79:     "https://lc79c.bet",
  betvip:   "https://play.betvip.fit/?utm_source=seo&utm_campaign=betvip.mobi&utm_medium=betvip.mobi&utm_term=betvip.mobi",
};

// ── MAINTENANCE STATE ───────────────────────────────────────
function getMaintenance() { return JSON.parse(localStorage.getItem("tx_maintenance") || "{}"); }
function saveMaintenance(m) { localStorage.setItem("tx_maintenance", JSON.stringify(m)); }
function isUnderMaintenance(app) { return !!getMaintenance()[app]; }

// Logo ảnh thật từ thư mục img/
const BRAND_IMG = {
  sunwin:   "img/sunwin.jpg",
  xocdia88: "img/xocdia88.jpg",
  hitclub:  "img/hitclub.jpg",
  lc79:     "img/lc79.jpg",
  betvip:   "img/betvip.jpg",
};
const BRAND_EMOJI = { sunwin:"☀️", xocdia88:"🎯", hitclub:"🎪", lc79:"🎲", betvip:"💎" };
const BRAND_COLOR = { sunwin:"#FFD700", xocdia88:"#FF4500", hitclub:"#00CED1", lc79:"#7B68EE", betvip:"#FF69B4" };
const BRAND_GRADIENT = {
  sunwin:   "linear-gradient(135deg,#ff8c00,#ffd700)",
  xocdia88: "linear-gradient(135deg,#ff4500,#ff6b35)",
  hitclub:  "linear-gradient(135deg,#00ced1,#00fa9a)",
  lc79:     "linear-gradient(135deg,#7b68ee,#9370db)",
  betvip:   "linear-gradient(135deg,#ff69b4,#ff1493)",
};

const RE  = { "Tài":"🔴","Xỉu":"🔵","Chẵn":"🟢","Lẻ":"🟡" };
const RCL = { "Tài":"tai","Xỉu":"xiu","Chẵn":"chan","Lẻ":"le" };
