// ═══════════════════════════════════════════════════════════
//  APP LOGIC — Game View, Fetch, Render  |  Tài Xỉu AI
// ═══════════════════════════════════════════════════════════

// ── STATE ──────────────────────────────────────────────────
window._histData    = {};
window._statData    = {};
window._lastPhien   = {};
window._pendingPred = {};
window._curApp      = null;
window._curApiIdx   = 0;
window._fetchTimer  = null;
window._predOpen    = true;


// ── TOPBAR COUNTDOWN (cho user thuê) ──────────────────────
function startTopbarCountdown(expireAt) {
  const update = () => {
    const left = expireAt - Date.now();
    const el = document.getElementById('topbar-expire');
    if (!el) return;
    if (left <= 0) { el.textContent = '⏰ Đã hết hạn'; el.style.color='#ef4444'; return; }
    const totalSec = Math.floor(left / 1000);
    const d = Math.floor(totalSec / 86400);
    const h = Math.floor((totalSec % 86400) / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    const hms = [h,m,s].map(v=>String(v).padStart(2,'0')).join(':');
    el.textContent = (d > 0 ? d + 'ngày ' : '') + hms;
    const warn = left < 3600000;
    el.style.color = warn ? '#ff6b35' : '#22c55e';
  };
  update();
  setInterval(update, 1000);
}

// ── LAUNCH APP ─────────────────────────────────────────────
function launchApp() {
  try {
    document.getElementById("auth-screen").style.display = "none";
    const app = document.getElementById("app");
    app.style.display = "flex";
    app.style.flexDirection = "column";

    const navAdmin   = document.getElementById("nav-admin");
    const navLobby   = document.getElementById("nav-lobby-mgr");
    if (navAdmin)  navAdmin.style.display  = window._isAdmin ? "flex" : "none";
    if (navLobby)  navLobby.style.display  = window._isAdmin ? "flex" : "none";

    const expireBox = document.getElementById("sidebar-expire");
    if (expireBox) expireBox.style.display = window._isAdmin ? "none" : "block";

    // Thông tin tài khoản topbar
    const userDisplayEl = document.getElementById("user-display");
    if (userDisplayEl) {
      const roleLabel = window._isAdmin ? "👑 ADMIN" : "🔑 Người dùng";
      userDisplayEl.innerHTML = `<span class="user-name-tag">${window._curUser || ""}</span><span class="user-role-tag">${roleLabel}</span>`;
    }

    // Thời gian sử dụng
    const tbExpire = document.getElementById("topbar-expire");
    if (tbExpire) {
      tbExpire.style.display = "block";
      if (window._isAdmin) {
        tbExpire.textContent = "♾️ Vĩnh viễn";
        tbExpire.style.color = "#ffd700";
      } else if (window._expireAt) {
        startTopbarCountdown(window._expireAt);
      }
    }

    buildLobbies();
    showHome();
  } catch(err) {
    console.error("[launchApp] Lỗi:", err);
    // Reset màn hình auth nếu launch thất bại
    document.getElementById("auth-screen").style.display = "flex";
    const appEl = document.getElementById("app");
    if (appEl) appEl.style.display = "none";
    throw err; // re-throw để doLogin() biết mà hiện lỗi
  }
}

// ── SIDEBAR ────────────────────────────────────────────────
function toggleSidebar() {
  document.getElementById("sidebar").classList.toggle("open");
  document.getElementById("overlay-bg").classList.toggle("open");
}
function closeSidebar() {
  document.getElementById("sidebar").classList.remove("open");
  document.getElementById("overlay-bg").classList.remove("open");
}

// ── PAGES ─────────────────────────────────────────────────
function setActivePage(name) {
  ["home","game","admin","lobby-mgr"].forEach(p => {
    const el = document.getElementById("page-" + p);
    if (!el) return;
    if (p === "game") el.style.display = name === "game" ? "flex" : "none";
    else el.style.display = name === p ? "block" : "none";
  });
}

function showHome() {
  clearInterval(window._fetchTimer); window._fetchTimer = null;
  if (window._adminTableTimer) { clearInterval(window._adminTableTimer); window._adminTableTimer = null; }
  const iframe = document.getElementById("game-iframe");
  if (iframe) iframe.src = "about:blank";
  document.getElementById("lobby-float-btn")?.classList.add("hidden");
  setActivePage("home");
  document.getElementById("topbar-center").innerHTML = "";
  document.getElementById("nav-home")?.classList.add("active");
  document.getElementById("nav-admin")?.classList.remove("active");
  closeSidebar();
}

function showAdmin() {
  clearInterval(window._fetchTimer); window._fetchTimer = null;
  setActivePage("admin");
  document.getElementById("topbar-center").innerHTML = "";
  document.getElementById("nav-home")?.classList.remove("active");
  document.getElementById("nav-admin")?.classList.add("active");
  document.getElementById("nav-lobby-mgr")?.classList.remove("active");
  closeSidebar();
  renderUsers();
}

// ── LOBBY MANAGER ─────────────────────────────────────────
function showLobbyManager() {
  clearInterval(window._fetchTimer); window._fetchTimer = null;
  setActivePage("lobby-mgr");
  document.getElementById("topbar-center").innerHTML = "";
  document.getElementById("nav-home")?.classList.remove("active");
  document.getElementById("nav-admin")?.classList.remove("active");
  document.getElementById("nav-lobby-mgr")?.classList.add("active");
  closeSidebar();
  renderLobbyManager();
}

function renderLobbyManager() {
  const g = document.getElementById("lobby-mgr-grid");
  if (!g) return;
  g.innerHTML = "";
  const maint = getMaintenance();
  // Lấy tất cả sảnh từ APIS (đảm bảo đủ 5)
  const allApps = Object.keys(APIS);
  allApps.forEach((app) => {
    const em      = BRAND_EMOJI[app] || "🎰";
    const grad    = BRAND_GRADIENT[app] || "linear-gradient(135deg,#1e2d42,#0e1520)";
    const isMaint = !!maint[app];
    const apis    = APIS[app] || [];
    const card = document.createElement("div");
    card.className = "lobby-mgr-card";
    card.innerHTML = `
      <div class="lmgr-banner" style="background:${grad}">
        <div class="lmgr-emoji">${em}</div>
        <div class="lmgr-status-badge ${isMaint ? "maint" : "online"}">${isMaint ? "🔧 BẢO TRÌ" : "✅ ONLINE"}</div>
      </div>
      <div class="lmgr-info">
        <div>
          <div class="lmgr-name">${app.toUpperCase()}</div>
          <div style="font-size:11px;color:var(--muted2);margin-top:2px">${apis.length} API</div>
        </div>
        <div class="lmgr-btns">
          ${isMaint
            ? `<button class="lmgr-btn cancel-maint" onclick="askMaintenance('${app}', false)">✅ Huỷ Bảo Trì</button>`
            : `<button class="lmgr-btn start-maint" onclick="askMaintenance('${app}', true)">🔧 Bảo Trì</button>`
          }
        </div>
      </div>`;
    g.appendChild(card);
  });
}

let _maintTarget = null;
let _maintAction = false;

function askMaintenance(app, enable) {
  _maintTarget = app;
  _maintAction = enable;
  const title  = enable ? "XÁC NHẬN BẢO TRÌ" : "HUỶ BẢO TRÌ";
  const body   = enable
    ? `Admin có chắc chắn muốn bảo trì sảnh <strong style="color:#ffd700">${app.toUpperCase()}</strong> không?<br/><br/>Người dùng sẽ không vào được sảnh này khi đang bảo trì.`
    : `Xác nhận huỷ bảo trì sảnh <strong style="color:#00d4ff">${app.toUpperCase()}</strong>?<br/><br/>Người dùng sẽ vào được sảnh bình thường sau khi huỷ.`;
  document.getElementById("maint-modal-title").textContent = title;
  document.getElementById("maint-modal-body").innerHTML   = body;
  const btn = document.getElementById("maint-confirm-btn");
  btn.textContent = enable ? "BẢO TRÌ NGAY" : "HUỶ BẢO TRÌ";
  btn.style.background = enable ? "linear-gradient(135deg,#ff6b35,#e74c3c)" : "linear-gradient(135deg,#00d4ff,#0099cc)";
  document.getElementById("maint-overlay").classList.remove("hidden");
}

function closeMaintModal() { document.getElementById("maint-overlay").classList.add("hidden"); }

function confirmMaintAction() {
  const maint = getMaintenance();
  if (_maintAction) {
    maint[_maintTarget] = true;
    showToast(`🔧 Sảnh ${_maintTarget.toUpperCase()} đang bảo trì`);
  } else {
    delete maint[_maintTarget];
    showToast(`✅ Sảnh ${_maintTarget.toUpperCase()} đã hoạt động trở lại`);
  }
  saveMaintenance(maint);
  closeMaintModal();
  renderLobbyManager();
  buildLobbies(); // refresh home lobby grid
}

function goHome() { showHome(); }

// ── LOBBIES ────────────────────────────────────────────────
function buildLobbies() {
  const g = document.getElementById("lobby-grid");
  if (!g) return;
  g.innerHTML = "";
  const maint = getMaintenance();
  Object.entries(APIS).forEach(([app, apis]) => {
    const em      = BRAND_EMOJI[app] || "🎰";
    const grad    = BRAND_GRADIENT[app] || "linear-gradient(135deg,#1e2d42,#0e1520)";
    const col     = BRAND_COLOR[app] || "#00d4ff";
    const isMaint = !!maint[app];
    const c       = document.createElement("div");
    c.className   = "lobby-card" + (isMaint ? " lobby-maint" : "");
    const imgUrl = (typeof BRAND_IMG !== "undefined" && BRAND_IMG[app]) ? BRAND_IMG[app] : "";
    c.innerHTML = `
      <div class="lobby-banner" style="background:${grad}">
        <div class="lobby-banner-inner">
          ${imgUrl ? `<img src="${imgUrl}" class="lobby-logo-img" onerror="this.style.display='none'"/>` : `<div class="lobby-emoji">${em}</div>`}
          <div class="lobby-glow-ring" style="border-color:${col}40"></div>
        </div>
        ${isMaint ? `<div class="lobby-maint-overlay"><span>🔧</span><span>BẢO TRÌ</span></div>` : ""}
        <div class="lobby-particles">
          <span></span><span></span><span></span>
        </div>
      </div>
      <div class="lobby-info">
        <div class="lobby-name">${app.toUpperCase()}</div>
        <div class="lobby-enter" style="color:${isMaint ? "#ff6b35" : col}">${isMaint ? "🔧 Đang bảo trì" : "Vào sảnh →"}</div>
      </div>`;
    c.onclick = () => isMaint ? showToast("🔧 Chức năng này đang được bảo trì!", "warn") : openGame(app);
    g.appendChild(c);
    // animate in
    setTimeout(() => c.classList.add("visible"), 50 * Object.keys(APIS).indexOf(app));
  });
}

// ── GAME ───────────────────────────────────────────────────
function openGame(app) {
  window._curApp    = app;
  window._curApiIdx = 0;

  if (!window._histData[app]) {
    window._histData[app] = {};
    APIS[app].forEach(a => { window._histData[app][a.label] = []; });
  }
  if (!window._statData[app]) {
    window._statData[app] = {};
    APIS[app].forEach(a => { window._statData[app][a.label] = { d: 0, s: 0 }; });
  }
  if (!window._lastPhien[app]) {
    window._lastPhien[app] = {};
    APIS[app].forEach(a => { window._lastPhien[app][a.label] = null; });
  }
  if (!window._pendingPred[app]) {
    window._pendingPred[app] = {};
    APIS[app].forEach(a => { window._pendingPred[app][a.label] = null; });
  }

  setActivePage("game");
  const em = BRAND_EMOJI[app] || "";
  document.getElementById("game-brand-tag").textContent = `${em} ${app.toUpperCase()}`;
  document.getElementById("topbar-center").innerHTML    = `<span class="topbar-brand">${em} ${app.toUpperCase()}</span>`;
  buildApiTabs();
  loadIframe(app);
  openPred();
  closeSidebar();
  doFetch();
  clearInterval(window._fetchTimer);
  window._fetchTimer = setInterval(doFetch, 15000);

  // Realtime từ Supabase — nhận data ngay cả khi API sảnh lỗi
  const curApi = APIS[app][window._curApiIdx];
  supaStartGameRealtime(app, curApi);

  // show calc animation
  showCalcEffect();
}

// ── IFRAME LOAD ────────────────────────────────────────────
// ── LOBBY POPUP WINDOW ────────────────────────────────────
window._lobbyPopup = null;

function openLobbyPopup() {
  const url = document.getElementById("iframe-msg-url").textContent;
  if (!url || url === "about:blank") return;
  // Tính toán kích thước cửa sổ popup
  const sw = window.screen.width;
  const sh = window.screen.height;
  const pw = Math.min(480, Math.floor(sw * 0.45));
  const ph = Math.min(sh, 820);
  const left = sw - pw;
  const top  = 0;
  window._lobbyPopup = window.open(
    url, "lobby_popup",
    `width=${pw},height=${ph},left=${left},top=${top},resizable=yes,scrollbars=yes`
  );
  if (!window._lobbyPopup || window._lobbyPopup.closed) {
    // Popup bị chặn → fallback mở tab mới
    openLobbyTab();
    return;
  }
  // Hiện nút float để refocus popup
  document.getElementById("lobby-float-btn")?.classList.remove("hidden");
  // Theo dõi nếu popup bị đóng
  const checkClosed = setInterval(() => {
    if (!window._lobbyPopup || window._lobbyPopup.closed) {
      clearInterval(checkClosed);
      window._lobbyPopup = null;
      document.getElementById("lobby-float-btn")?.classList.add("hidden");
    }
  }, 1000);
}

function refocusPopup() {
  if (window._lobbyPopup && !window._lobbyPopup.closed) {
    window._lobbyPopup.focus();
  } else {
    openLobbyPopup();
  }
}

function openLobbyTab() {
  const url = document.getElementById("iframe-msg-url").textContent;
  if (url && url !== "about:blank") window.open(url, "_blank");
}

function loadIframe(app) {
  const iframe  = document.getElementById("game-iframe");
  const blocker = document.getElementById("iframe-blocker");
  const floatBtn = document.getElementById("lobby-float-btn");
  const url     = LOBBY_URLS[app] || "about:blank";
  blocker.classList.add("hidden");
  floatBtn?.classList.add("hidden");
  document.getElementById("iframe-msg-url").textContent = url;
  iframe.src = url;
  iframe.onload = () => {
    try {
      // Nếu đọc được contentDocument thì iframe load OK
      const doc = iframe.contentDocument;
      if (doc && doc.location.href !== "about:blank") {
        blocker.classList.add("hidden");
      } else {
        blocker.classList.remove("hidden");
      }
    } catch {
      // Bị chặn cross-origin → hiện blocker
      blocker.classList.remove("hidden");
    }
  };
  iframe.onerror = () => blocker.classList.remove("hidden");
  // Timeout fallback: nếu 3.5s vẫn không load được
  setTimeout(() => {
    try {
      const doc = iframe.contentDocument;
      if (!doc || doc.URL === "about:blank" || doc.body === null) {
        blocker.classList.remove("hidden");
      }
    } catch {
      blocker.classList.remove("hidden");
    }
  }, 3500);
}

// ── API TABS ───────────────────────────────────────────────
function buildApiTabs() {
  const tc = document.getElementById("api-tabs");
  tc.innerHTML = "";
  APIS[window._curApp].forEach((a, i) => {
    const t = document.createElement("button");
    t.className = "api-tab" + (i === 0 ? " active" : "");
    t.textContent = a.label;
    t.onclick = () => switchApi(i);
    tc.appendChild(t);
  });
}

function switchApi(i) {
  window._curApiIdx = i;
  document.querySelectorAll(".api-tab").forEach((t, j) => t.classList.toggle("active", j === i));
  doFetch();
}

// ── PREDICTION PANEL ───────────────────────────────────────
function openPred()  { window._predOpen = true;  document.getElementById("pred-panel").classList.remove("hidden"); document.getElementById("pred-reopen").classList.add("hidden"); }
function closePred() { window._predOpen = false; document.getElementById("pred-panel").classList.add("hidden");    document.getElementById("pred-reopen").classList.remove("hidden"); }

// Draggable panel
(function() {
  let dragging = false, ox = 0, oy = 0, startR = 0, startT = 0;
  document.addEventListener("DOMContentLoaded", () => {
    const head  = document.getElementById("pred-head");
    const panel = document.getElementById("pred-panel");
    if (!head || !panel) return;
    head.addEventListener("mousedown", e => {
      dragging = true; ox = e.clientX; oy = e.clientY;
      const rect = panel.getBoundingClientRect();
      startR = window.innerWidth - rect.right; startT = rect.top;
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup",   onUp);
    });
    // Touch support
    head.addEventListener("touchstart", e => {
      const t = e.touches[0];
      dragging = true; ox = t.clientX; oy = t.clientY;
      const rect = panel.getBoundingClientRect();
      startR = window.innerWidth - rect.right; startT = rect.top;
    });
    document.addEventListener("touchmove", e => {
      if (!dragging) return;
      const t = e.touches[0];
      const dx = ox - t.clientX, dy = t.clientY - oy;
      panel.style.right = Math.max(0, startR + dx) + "px";
      panel.style.top   = Math.max(44, startT + dy) + "px";
    });
    document.addEventListener("touchend", () => { dragging = false; });
  });
  function onMove(e) {
    if (!dragging) return;
    const dx = ox - e.clientX, dy = e.clientY - oy;
    document.getElementById("pred-panel").style.right = Math.max(0, startR + dx) + "px";
    document.getElementById("pred-panel").style.top   = Math.max(44, startT + dy) + "px";
  }
  function onUp() { dragging = false; document.removeEventListener("mousemove", onMove); document.removeEventListener("mouseup", onUp); }
})();

// ── DATA FETCH ─────────────────────────────────────────────
window._fetchRetry = {};

// Danh sách CORS proxy fallback (thử lần lượt nếu bị block)
const CORS_PROXIES = [
  url => url,                                                          // 1. Thử trực tiếp
  url => `https://corsproxy.io/?${encodeURIComponent(url)}`,          // 2. corsproxy.io
  url => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`, // 3. allorigins
  url => `https://thingproxy.freeboard.io/fetch/${url}`,              // 4. thingproxy
];

async function fetchWithCors(url) {
  const key = "proxy_" + url;
  // Bắt đầu từ proxy đã thành công lần trước (nếu có)
  let startIdx = window._workingProxy?.[key] ?? 0;
  for (let i = startIdx; i < CORS_PROXIES.length; i++) {
    const proxied = CORS_PROXIES[i](url);
    try {
      const r = await fetch(proxied, { signal: AbortSignal.timeout(9000) });
      if (!r.ok) throw new Error("HTTP " + r.status);
      const data = await r.json();
      // Lưu proxy hoạt động để lần sau dùng trước
      if (!window._workingProxy) window._workingProxy = {};
      window._workingProxy[key] = i;
      return data;
    } catch(e) {
      if (i === CORS_PROXIES.length - 1) throw e; // hết proxy → throw
    }
  }
}

async function doFetch() {
  if (!window._curApp) return;
  const app = window._curApp;
  const api = APIS[app][window._curApiIdx];
  const key = app + "_" + window._curApiIdx;

  try {
    const data = await fetchWithCors(api.url);
    window._fetchRetry[key] = 0;
    processData(data, app, api);
  } catch(e) {
    window._fetchRetry[key] = (window._fetchRetry[key] || 0) + 1;
    const retries = window._fetchRetry[key];
    const pb = document.getElementById("pred-body");
    if (!pb) return;

    // ── Thử load data từ Supabase khi API lỗi ──
    supaLoadFallback(app, api);

    pb.innerHTML = `
      <div class="fetch-err-box">
        <div class="fetch-err-icon">⚠️</div>
        <div class="fetch-err-title">Lỗi kết nối API</div>
        <div class="fetch-err-sub">Đã thử ${CORS_PROXIES.length} phương thức kết nối...<br/>Lần ${retries} — Tự động thử lại sau 15 giây</div>
        <button class="fetch-retry-btn" onclick="doFetch()">🔄 Thử lại ngay</button>
        <div class="fetch-err-contact">Lỗi kéo dài? Liên hệ hỗ trợ:</div>
        <div class="fetch-err-btns">
          <a href="https://zalo.me/0993389813" target="_blank" class="ferr-btn ferr-zalo">💬 Zalo</a>
          <a href="https://t.me/knamknam06" target="_blank" class="ferr-btn ferr-tele">✈️ Telegram</a>
        </div>
        <div id="supa-fallback-status" class="supa-fallback-notice">☁️ Lấy dữ liệu từ AI KING DZI</div>
      </div>`;
  }
}

// Load dữ liệu từ Supabase khi API sảnh lỗi
async function supaLoadFallback(app, api) {
  const statusEl = () => document.getElementById("supa-fallback-status");
  try {
    const hist = await supaFetchHistory(app, api.label);
    if (!hist || !hist.history_json || hist.history_json.length === 0) {
      if (statusEl()) statusEl().textContent = "🤖 AI KING DZI chưa có dữ liệu cho sảnh này";
      return;
    }
    // Restore history vào state
    window._histData[app][api.label] = [...hist.history_json];
    if (hist.stats_json) {
      window._statData[app][api.label] = { d: hist.stats_json.dung || 0, s: hist.stats_json.sai || 0 };
    }
    const latestRec = hist.history_json[hist.history_json.length - 1];
    if (latestRec) {
      window._lastPhien[app][api.label] = latestRec.phien;
    }
    if (statusEl()) statusEl().textContent = `☁️ 🤖 AI KING DZI — ${hist.history_json.length} phiên — cập nhật: ${new Date(hist.updated_at).toLocaleTimeString("vi-VN")}`;

    // Render lịch sử từ cloud
    renderHistBar(app, api);

    // Fetch + hiển thị dự đoán mới nhất từ cloud
    const pred = await supaFetchLatestPred(app, api.label);
    if (pred) supaRenderCloudPred(pred, app, api);

  } catch(err) {
    if (statusEl()) statusEl().textContent = "🤖 Không kết nối được AI KING DZI";
  }
}

// Hiển thị dự đoán lấy từ Supabase cloud
function supaRenderCloudPred(pred, app, api) {
  const RE_LOCAL = { "Tài":"🔴","Xỉu":"🔵","Chẵn":"🟢","Lẻ":"🟡" };
  const pb = document.getElementById("pred-body");
  if (!pb) return;
  const emoji = RE_LOCAL[pred.du_doan] || "⬜";
  const barFilled = Math.round((pred.do_tin_cay || 0) / 10);
  const bar = "█".repeat(barFilled) + "░".repeat(10 - barFilled);
  const timeStr = new Date(pred.created_at).toLocaleTimeString("vi-VN");

  pb.innerHTML = `
    <div class="supa-pred-block">
      <div class="robot-gif-wrap">
        <img src="https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExcW9oaXVsa2M3bGE4NThpNGcwdmRyazZmaGZwenJ4dzgzNHZkcGt2aSZlcD12MV9naWZzX3NlYXJjaCZjdD1n/l0HlBO7eyXzSZkJri/giphy.gif" class="robot-gif" alt="AI Robot"/>
      </div>
      <div class="supa-pred-badge">🤖 AI KING DZI</div>
      <div class="supa-pred-phien">Phiên #${pred.phien}</div>
      <div class="dice-anim-row"><span class="dice-spin">🎲</span><span class="dice-spin" style="animation-delay:.15s">🎲</span><span class="dice-spin" style="animation-delay:.3s">🎲</span></div>
      <div class="supa-pred-result">${emoji} <span>${pred.du_doan}</span></div>
      <div class="supa-pred-bar">[${bar}] ${pred.do_tin_cay}%</div>
      <div class="supa-pred-votes">🗳️ ${pred.votes}/${pred.total_methods} phương pháp</div>
      <div class="supa-pred-time">⏰ ${timeStr}</div>

    </div>`;
}

// Subscribe realtime khi vào game — nhận data từ Python tool ngay lập tức
async function supaStartGameRealtime(app, api) {
  await supaSubscribeResults(app, api.label, row => {
    // Có phiên mới từ Python → cập nhật history và render
    if (window._lastPhien[app]?.[api.label] === row.phien) return;
    window._lastPhien[app][api.label] = row.phien;
    const rec = {
      phien: row.phien, ket_qua: row.ket_qua, tong: row.tong,
      xuc_xac_1: row.xuc_xac_1, xuc_xac_2: row.xuc_xac_2, xuc_xac_3: row.xuc_xac_3,
      ket_qua_truyen_thong: row.ket_qua_truyen_thong,
      ket_qua_chi_tiet: row.ket_qua_chi_tiet,
    };
    if (!window._histData[app]?.[api.label]) return;
    window._histData[app][api.label].push(rec);
    if (window._histData[app][api.label].length > 80) window._histData[app][api.label].shift();
    renderHistBar(app, api);
    showToast(`🤖 AI KING DZI — Phiên mới: #${row.phien} — ${row.ket_qua || row.ket_qua_truyen_thong || ""}`, "info");
  });

  await supaSubscribePredictions(app, api.label, row => {
    // Có dự đoán mới từ Python
    supaRenderCloudPred(row, app, api);
  });
}

function processData(data, app, api) {
  const label = api.label, type = api.type, isXD = type === "xocdia";
  const phien = data.phien; if (!phien) return;
  const actualKq = isXD ? data.ket_qua_truyen_thong : data.ket_qua;
  let verdict = null;
  const pp = window._pendingPred[app]?.[label];
  if (pp && actualKq) {
    const ok = pp.pred === actualKq;
    if (ok) window._statData[app][label].d++;
    else    window._statData[app][label].s++;
    verdict = { ok, pred: pp.pred, actual: actualKq };
    window._pendingPred[app][label] = null;
  }
  if (window._lastPhien[app]?.[label] !== phien) {
    window._lastPhien[app][label] = phien;
    const rec = { phien, ket_qua: data.ket_qua, tong: data.tong, xuc_xac_1: data.xuc_xac_1, xuc_xac_2: data.xuc_xac_2, xuc_xac_3: data.xuc_xac_3 };
    if (isXD) { rec.ket_qua_truyen_thong = data.ket_qua_truyen_thong; rec.ket_qua_chi_tiet = data.ket_qua_chi_tiet; }
    window._histData[app][label].push(rec);
    if (window._histData[app][label].length > 80) window._histData[app][label].shift();
  }
  renderPred(app, api, verdict);
  renderHistBar(app, api);
}

function getKq(r, isXD) { return isXD ? r.ket_qua_truyen_thong : r.ket_qua; }

// ── RENDER HISTORY BAR ─────────────────────────────────────
function renderHistBar(app, api) {
  const isXD = api.type === "xocdia";
  const hist = window._histData[app]?.[api.label] || [];
  const ph   = document.getElementById("pred-hist");
  const bar  = document.getElementById("pred-hist-bar");
  if (!hist.length) { ph?.classList.add("hidden"); return; }
  ph?.classList.remove("hidden"); bar.innerHTML = "";
  
  const recent = hist.slice(-14);
  const lb = isXD ? ["Chẵn","Lẻ"] : ["Tài","Xỉu"];
  let tai = 0, xiu = 0;
  recent.forEach(r => {
    const k = getKq(r, isXD) || "?";
    const d = document.createElement("div");
    d.className = "h-dot " + (RCL[k] || "");
    d.title = k + (r.phien ? " #" + r.phien : "");
    d.textContent = RE[k] || "?";
    bar.appendChild(d);
    if (k === lb[0]) tai++;
    else if (k === lb[1]) xiu++;
  });
  
  // Thêm summary lịch sử
  let summaryEl = document.getElementById("pred-hist-summary");
  if (!summaryEl) {
    summaryEl = document.createElement("div");
    summaryEl.id = "pred-hist-summary";
    summaryEl.className = "pred-hist-summary";
    ph.appendChild(summaryEl);
  }
  const taiLabel = lb[0]; const xiuLabel = lb[1];
  const taiEmoji = RE[taiLabel] || "🔴"; const xiuEmoji = RE[xiuLabel] || "🔵";
  summaryEl.innerHTML = `
    <div class="hist-sum-row">
      <span class="hist-sum-item tai">${taiEmoji} ${taiLabel}: <strong>${tai}</strong></span>
      <span class="hist-sum-sep">·</span>
      <span class="hist-sum-item xiu">${xiuEmoji} ${xiuLabel}: <strong>${xiu}</strong></span>
    </div>
    <div class="hist-chuc-mung" id="hist-chuc-mung"></div>
  `;
}

// ── RENDER PREDICTION ──────────────────────────────────────
function renderPred(app, api, verdict) {
  const isXD    = api.type === "xocdia";
  const hist    = window._histData[app]?.[api.label] || [];
  const lb      = isXD ? ["Chẵn", "Lẻ"] : ["Tài", "Xỉu"];
  const results = hist.map(r => getKq(r, isXD)).filter(r => lb.includes(r));
  const st      = window._statData[app]?.[api.label] || { d: 0, s: 0 };
  const streak  = calcStreak(results);
  const pb      = document.getElementById("pred-body");

  let verdictHtml = "";
  if (verdict) {
    const cls  = verdict.ok ? "dung" : "sai";
    const icon = verdict.ok ? "✅" : "❌";
    const msg  = verdict.ok
      ? `ĐÚNG! Đoán: ${verdict.pred}`
      : `SAI. Đoán ${verdict.pred} → ${verdict.actual}`;
    verdictHtml = `<div class="verdict-pill ${cls}">${icon} ${msg}</div>`;
    // Hiện chúc mừng trong lịch sử nếu đúng
    if (verdict.ok) {
      const cc = document.getElementById("hist-chuc-mung");
      if (cc) {
        cc.innerHTML = `<span class="congrats-blink">🎉 Chúc mừng! Bot đã đoán đúng phiên vừa rồi! 🎉</span>`;
        setTimeout(() => { if(cc) cc.innerHTML = ""; }, 5000);
      }
    }
  }

  if (results.length < 5) {
    pb.innerHTML = `${verdictHtml}<div class="pred-loading"><div class="loading-orbit"><div class="orbit-ring"></div><div class="orbit-dot"></div></div><span>Thu thập dữ liệu (${results.length}/5)...</span></div>`;
    return;
  }

  const { best, conf, votes, total, topM, topAcc } = ensemblePredict(results, lb);
  if (!best) { pb.innerHTML = `${verdictHtml}<div class="pred-loading">Không đủ dữ liệu</div>`; return; }

  window._pendingPred[app][api.label] = { pred: best };
  const cl          = RCL[best] || "";
  const acc         = st.d + st.s > 0 ? Math.round(st.d / (st.d + st.s) * 100) + "%" : "N/A";
  const streakLb    = results.length > 0 ? results[results.length - 1] : "?";
  const phienLabel  = hist.length > 0 ? "#" + hist[hist.length - 1].phien : "";
  const confColor   = conf >= 70 ? "#22c55e" : conf >= 55 ? "#ffd700" : "#ef4444";
  const votePct     = Math.round(votes / total * 100);
  const topLabel    = (typeof METHOD_NAMES !== "undefined" && METHOD_NAMES[topM]) || topM || "—";

  // AI Reasoning (port từ bot Discord)
  const aiReason = buildAIReasoning(results, lb, best, conf, votes, total);

  pb.innerHTML = `
    ${verdictHtml}
    <div class="pred-result">
      <div class="robot-gif-wrap">
        <img src="https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExcW9oaXVsa2M3bGE4NThpNGcwdmRyazZmaGZwenJ4dzgzNHZkcGt2aSZlcD12MV9naWZzX3NlYXJjaCZjdD1n/l0HlBO7eyXzSZkJri/giphy.gif" class="robot-gif" alt="AI Robot"/>
      </div>
      <div class="dice-anim-row">
        <span class="dice-spin">🎲</span><span class="dice-spin" style="animation-delay:.15s">🎲</span><span class="dice-spin" style="animation-delay:.3s">🎲</span>
      </div>
      <div class="pred-emoji-big spin-on-change">${RE[best] || "?"}</div>
      <div class="pred-label ${cl}">${best}</div>
      <div class="pred-sub-label">${phienLabel}</div>
    </div>
    <div class="conf-bar-wrap">
      <div class="conf-bar-bg">
        <div class="conf-bar-fill" style="width:${conf}%;background:linear-gradient(90deg,${confColor},${confColor}aa)"></div>
      </div>
      <div class="conf-pct-row">
        <span>Độ tin cậy</span>
        <span style="color:${confColor};font-weight:700">${conf}%</span>
      </div>
    </div>
    <div class="pred-stats-row">
      <div class="pred-stat">
        <div class="pred-stat-val" style="color:var(--accent)">${votes}/${total}</div>
        <div class="pred-stat-lbl">Đồng thuận</div>
      </div>
      <div class="pred-stat">
        <div class="pred-stat-val" style="color:${acc !== "N/A" && parseInt(acc) >= 55 ? "var(--green)" : "var(--text)"}">${acc}</div>
        <div class="pred-stat-lbl">Chính xác</div>
      </div>
      <div class="pred-stat">
        <div class="pred-stat-val" style="color:var(--green)">${st.d}</div>
        <div class="pred-stat-lbl">✅ Đúng</div>
      </div>
      <div class="pred-stat">
        <div class="pred-stat-val" style="color:var(--tai)">${st.s}</div>
        <div class="pred-stat-lbl">❌ Sai</div>
      </div>
    </div>
    <div class="streak-pill">🔁 Streak: <strong>${streak}</strong> phiên ${RE[streakLb] || ""} <em>${streakLb}</em></div>
    <div class="top-method-row">🏅 Leader: <strong>${topLabel}</strong> <span>${topAcc}%</span></div>
    <div class="ai-reason-block">${aiReason}</div>
    <div class="algo-badge">🧠 ${total} thuật toán · Ensemble AI · Backtest Weighted</div>`;
}

// ─── AI REASONING (port từ Discord bot) ──────────────────────
function buildAIReasoning(results, lb, best, conf, votes, total) {
  if (!results || results.length < 3) return "<div class='ai-line'>⏳ Đang thu thập dữ liệu...</div>";
  const other = lb.find(l => l !== best) || "?";
  const n = results.length;
  const lines = [];
  const streak = calcStreak(results);
  const last = results[results.length - 1];
  if (streak >= 7) lines.push(`🚨 <b>STREAK CỰC CAO ${streak}</b> phiên ${last} — đảo chiều rất lớn`);
  else if (streak >= 5) lines.push(`⚠️ Streak <b>${streak}</b> phiên ${last} — đảo chiều đang tăng`);
  else if (streak >= 4) lines.push(`📌 Streak <b>${streak}</b> — cảnh báo bão hòa`);
  else if (streak >= 3) lines.push(`🔎 Streak <b>${streak}</b> — bình thường`);
  else lines.push(`🔄 Streak ngắn (<b>${streak}</b>) — không có chuỗi nổi bật`);
  if (n >= 5) {
    const r5 = results.slice(-5);
    const cb = r5.filter(x => x === best).length;
    const co = r5.filter(x => x === other).length;
    if (cb >= 4) lines.push(`📊 <b>${best}</b> chiếm ${cb}/5 phiên — AI kỳ vọng cân bằng`);
    else if (co >= 4) lines.push(`📊 <b>${other}</b> ${co}/5 — AI dự <b>${best}</b> (mean reversion)`);
    else lines.push(`📊 5 phiên: <b>${best}=${cb}</b> vs ${other}=${co}`);
  }
  if (n >= 10) {
    const old5 = results.slice(-10,-5);
    const new5 = results.slice(-5);
    const delta = new5.filter(x=>x===best).length/5 - old5.filter(x=>x===best).length/5;
    if (delta > 0.25) lines.push(`📈 <b>Momentum tăng</b> +${Math.round(delta*100)}% → bullish`);
    else if (delta < -0.25) lines.push(`📉 <b>Momentum giảm</b> ${Math.round(delta*100)}% → AI chọn ngược`);
    else lines.push(`➡️ Momentum ${delta>=0?"+":""}${Math.round(delta*100)}% — trung tính`);
  }
  if (n >= 6) {
    const alt = results.slice(1).filter((v,i)=>v!==results[i]).length/(results.length-1);
    if (alt > 0.72) lines.push(`🔀 <b>Xen kẽ mạnh</b> ${Math.round(alt*100)}% — ưu tiên đảo chiều`);
    else if (alt < 0.32) lines.push(`🔒 <b>Cùng chiều</b> ${Math.round((1-alt)*100)}% — streak logic`);
    else lines.push(`⚖️ Xen kẽ ${Math.round(alt*100)}% — hỗn hợp`);
  }
  const votePct = Math.round(votes/total*100);
  if (votePct >= 75) lines.push(`🧩 <b>Đồng thuận rất cao ${votePct}%</b> — tín hiệu mạnh`);
  else if (votePct >= 60) lines.push(`🧩 Đồng thuận <b>${votePct}%</b> — đáng tin`);
  else if (votePct >= 50) lines.push(`🧩 Đồng thuận <b>${votePct}%</b> — vừa phải`);
  else lines.push(`⚡ Chia rẽ <b>${votePct}%</b> — thận trọng`);
  let conclude;
  if (conf >= 80 && votePct >= 70) conclude = `🔥 <b>CỰC CAO — ĐỀ XUẤT MẠNH: ${best.toUpperCase()}</b>`;
  else if (conf >= 65 && votePct >= 60) conclude = `✅ <b>AI tự tin: ${best.toUpperCase()}</b>`;
  else if (conf >= 55) conclude = `⚡ <b>${best.toUpperCase()}</b> — quản lý rủi ro`;
  else conclude = `🎲 <b>Tín hiệu yếu — ${best.toUpperCase()} nhưng thận trọng</b>`;
  return lines.map(l=>`<div class="ai-line">${l}</div>`).join("") + `<div class="ai-conclude">${conclude}</div>`;
}

// ── CALC EFFECT ────────────────────────────────────────────
function showCalcEffect() {
  const overlay = document.getElementById("calc-overlay");
  if (!overlay) return;
  const terms = [
    "Markov Chain v7","EMA α=0.3","MACD Signal","Bollinger Bands","Hurst Exponent",
    "Kalman Filter","Fibonacci Seq","Chi-Square","LZ Complexity","Pattern Match",
    "RSI Index","Autocorrelation","Golden Ratio","Ichimoku","Ensemble Vote"
  ];
  overlay.innerHTML = "";
  overlay.classList.remove("hidden");
  terms.forEach((t, i) => {
    const span = document.createElement("div");
    span.className = "calc-term";
    span.textContent = t;
    span.style.animationDelay = (i * 80) + "ms";
    overlay.appendChild(span);
  });
  setTimeout(() => overlay.classList.add("hidden"), 1800);
}
