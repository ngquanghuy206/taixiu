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
window._topbarTimer = null;

function startTopbarCountdown(expireAt) {
  // Clear interval cũ trước khi tạo mới — tránh leak interval mỗi lần login
  if (window._topbarTimer) { clearInterval(window._topbarTimer); window._topbarTimer = null; }
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
  window._topbarTimer = setInterval(update, 1000);
}

// ── LAUNCH APP ─────────────────────────────────────────────
// ── PRELOAD STATS CHO TẤT CẢ SẢNH (badge %) ──────────────
async function preloadAllStats() {
  try {
    const rows = await supaFetchAllLatest();
    if (!Array.isArray(rows)) return;
    rows.forEach(row => {
      if (!row.stats_json) return;
      const app   = row.app;
      const label = row.api_label;
      if (!window._statData[app]) window._statData[app] = {};
      window._statData[app][label] = {
        d: row.stats_json.dung || 0,
        s: row.stats_json.sai  || 0
      };
    });
  } catch(e) { console.warn("preloadAllStats lỗi:", e); }
}

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

    showHome();
    // Khởi động nhạc nền — gọi ngay (vẫn trong context của login gesture)
    if (window.TxSound) {
      try { window.TxSound.startMusic(); } catch(e) {}
    }
    // Render lobby ngay — không chờ preloadAllStats
    buildLobbies();
    // Preload stats song song → chỉ update badge % sau khi xong, không block UI
    preloadAllStats().then(() => {
      Object.keys(APIS).forEach(app => updateLobbyAccBadge(app));
    });
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
  // Inject sound controls if not yet added
  if (window.TxSound) setTimeout(() => { try { window.TxSound.injectSidebarBtns(); window.TxSound.updateSidebarBtns(); } catch(e) {} }, 50);
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
  renderLobbyManager(); // async — intentional fire-and-forget for UI
}

async function renderLobbyManager() {
  const g = document.getElementById("lobby-mgr-grid");
  if (!g) return;
  g.innerHTML = "";
  const maint = await getMaintenance();
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

async function confirmMaintAction() {
  const btn = document.getElementById("maint-confirm-btn");
  btn.disabled = true;
  if (_maintAction) {
    await saveMaintenance(_maintTarget, true);
    showToast(`🔧 Sảnh ${_maintTarget.toUpperCase()} đang bảo trì`);
  } else {
    await saveMaintenance(_maintTarget, false);
    showToast(`✅ Sảnh ${_maintTarget.toUpperCase()} đã hoạt động trở lại`);
  }
  btn.disabled = false;
  closeMaintModal();
  await renderLobbyManager();
  await buildLobbies(); // refresh home lobby grid
}

function goHome() { showHome(); }

// ── LOBBIES ────────────────────────────────────────────────
async function buildLobbies() {
  const g = document.getElementById("lobby-grid");
  if (!g) return;
  g.innerHTML = "";
  // Render ngay với maint = {} (không đơ chờ fetch)
  _renderLobbyCards(g, {});
  // Fetch maintenance song song → update card sau
  getMaintenance().then(maint => _renderLobbyCards(g, maint)).catch(() => {});
}

function _renderLobbyCards(g, maint) {
  g.innerHTML = "";
  Object.entries(APIS).forEach(([app, apis]) => {
    const em      = BRAND_EMOJI[app] || "🎰";
    const grad    = BRAND_GRADIENT[app] || "linear-gradient(135deg,#1e2d42,#0e1520)";
    const col     = BRAND_COLOR[app] || "#00d4ff";
    const isMaint = !!maint[app];
    const c       = document.createElement("div");
    c.className   = "lobby-card" + (isMaint ? " lobby-maint" : "");
    c.dataset.app = app;
    const imgUrl = (typeof BRAND_IMG !== "undefined" && BRAND_IMG[app]) ? BRAND_IMG[app] : "";
    // Tính % chính xác từ statData
    const accHtml = getLobbyAccBadgeHtml(app);
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
        <div class="lobby-acc-badge" id="acc-badge-${app}">${accHtml}</div>
      </div>
      <div class="lobby-info">
        <div class="lobby-name">${app.toUpperCase()}</div>
        <div class="lobby-enter" style="color:${isMaint ? "#ff6b35" : col}">${isMaint ? "🔧 Đang bảo trì" : "Vào sảnh →"}</div>
      </div>`;
    c.onclick = () => isMaint ? showToast("🔧 Chức năng này đang được bảo trì!", "warn") : openGame(app);
    g.appendChild(c);
    setTimeout(() => c.classList.add("visible"), 50 * Object.keys(APIS).indexOf(app));
  });
}

function getLobbyAccBadgeHtml(app) {
  const apis = APIS[app] || [];
  let totalD = 0, totalS = 0;
  apis.forEach(a => {
    const st = window._statData?.[app]?.[a.label] || { d: 0, s: 0 };
    totalD += st.d; totalS += st.s;
  });
  const total = totalD + totalS;
  if (total === 0) return "";
  const acc = Math.round(totalD / total * 100);
  const color = acc >= 60 ? "#22c55e" : acc >= 50 ? "#ffd700" : "#ef4444";
  return `<span style="color:${color};font-weight:900;font-family:'Orbitron',monospace;font-size:11px">${acc}%</span>`;
}

function updateLobbyAccBadge(app) {
  const el = document.getElementById("acc-badge-" + app);
  if (!el) return;
  el.innerHTML = getLobbyAccBadgeHtml(app);
}

// ── GAME ───────────────────────────────────────────────────
function openGame(app) {
  window._curApp    = app;
  window._curApiIdx = 0;
  // Thông báo cho TTS biết sảnh đang xem để tránh đọc nhầm sảnh
  if (window.TxTTS) try { window.TxTTS.setApp(app); } catch(e) {}

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
  // KHÔNG tự mở sảnh — user bấm nút "Vào Sảnh Game" mới mở
  // Cập nhật tên nút sảnh
  updateLobbyBtnLabel(app);
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

// ── WEBVIEW MODAL ─────────────────────────────────────────
window._webviewUrl = "";

function openWebview(app) {
  const rawUrl = LOBBY_URLS[app] || "";
  if (!rawUrl) return;
  // Dùng proxy nếu đã cấu hình PROXY_BASE
  const url = (typeof PROXY_BASE !== "undefined" && PROXY_BASE)
    ? `${PROXY_BASE}/proxy?url=${encodeURIComponent(rawUrl)}`
    : rawUrl;
  window._webviewUrl = rawUrl; // nút "mở tab ngoài" vẫn dùng URL gốc
  window._webviewProxyUrl = url;
  const em   = BRAND_EMOJI[app] || "🎮";
  const name = app.toUpperCase();
  document.getElementById("webview-title").textContent = `${em} ${name}`;

  const overlay  = document.getElementById("webview-overlay");
  const iframe   = document.getElementById("webview-iframe");
  const loading  = document.getElementById("webview-loading");
  const blocked  = document.getElementById("webview-blocked");

  // Reset state
  blocked.classList.add("hidden");
  loading.style.display = "flex";
  iframe.src = "about:blank";
  overlay.classList.remove("hidden");
  document.body.style.overflow = "hidden";

  // Load iframe qua proxy
  const hasProxyWV = (typeof PROXY_BASE !== "undefined" && PROXY_BASE);
  setTimeout(() => {
    iframe.src = window._webviewProxyUrl || url;

    iframe.onload = () => {
      loading.style.display = "none";
      try {
        const doc = iframe.contentDocument;
        if (!doc || doc.URL === "about:blank") {
          // Nếu có proxy → chờ cross-origin exception ở catch
          if (!hasProxyWV) blocked.classList.remove("hidden");
        } else {
          blocked.classList.add("hidden"); // load OK
        }
      } catch {
        // cross-origin = proxy đang chạy bình thường → ẩn blocked
        loading.style.display = "none";
        blocked.classList.add("hidden");
      }
    };

    iframe.onerror = () => {
      loading.style.display = "none";
      blocked.classList.remove("hidden");
    };

    // Timeout 8s
    setTimeout(() => {
      if (loading.style.display !== "none") {
        loading.style.display = "none";
        try {
          const doc = iframe.contentDocument;
          if (!doc || doc.URL === "about:blank" || doc.body === null) {
            if (!hasProxyWV) blocked.classList.remove("hidden");
          }
        } catch {
          // cross-origin = proxy OK
          blocked.classList.add("hidden");
        }
      }
    }, 8000);
  }, 300);
}

function closeWebview() {
  const overlay = document.getElementById("webview-overlay");
  const iframe  = document.getElementById("webview-iframe");
  overlay.classList.add("hidden");
  iframe.src = "about:blank";
  document.body.style.overflow = "";
  window._webviewUrl = "";
}

function openWebviewExternal() {
  if (window._webviewUrl) window.open(window._webviewUrl, "_blank");
}

// ── MỞ POPUP WINDOW SẢN TRỰC TIẾP ────────────────────────
function openLobbyWindowFor(app) {
  const url = LOBBY_URLS[app];
  if (!url) return;
  window._curLobbyUrl = url;
  window._curApp = app;

  // Kích thước popup thông minh
  const sw = window.screen.width, sh = window.screen.height;
  const pw = Math.min(500, Math.round(sw * 0.45));
  const ph = Math.min(900, Math.round(sh * 0.92));
  const px = Math.round(sw * 0.54);
  const py = Math.round((sh - ph) / 2);
  const features = `width=${pw},height=${ph},left=${px},top=${py},resizable=yes,scrollbars=yes`;

  if (window._lobbyWin && !window._lobbyWin.closed) {
    window._lobbyWin.location.href = url;
    window._lobbyWin.focus();
  } else {
    window._lobbyWin = window.open(url, "lobby_win", features);
  }

  // Hiện float button
  const floatBtn = document.getElementById("lobby-float-btn");
  if (floatBtn) floatBtn.classList.remove("hidden");

  // Theo dõi popup đóng
  clearInterval(window._lobbyWinTracker);
  window._lobbyWinTracker = setInterval(() => {
    if (!window._lobbyWin || window._lobbyWin.closed) {
      clearInterval(window._lobbyWinTracker);
      window._lobbyWin = null;
      // Không ẩn float — để user mở lại dễ
    }
  }, 1000);
}

function updateLobbyBtnLabel(app) {
  const btn = document.querySelector(".game-lobby-btn");
  if (!btn) return;
  const em   = (typeof BRAND_EMOJI !== "undefined" && BRAND_EMOJI[app]) || "🎮";
  const name = app ? app.toUpperCase() : "SẢNH";
  btn.innerHTML = `${em} <span>Vào ${name}</span>`;
}

function refocusLobbyWindow() {
  if (window._lobbyWin && !window._lobbyWin.closed) {
    window._lobbyWin.focus();
  } else if (window._curApp && LOBBY_URLS[window._curApp]) {
    openLobbyWindowFor(window._curApp);
  }
}

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
  const iframe   = document.getElementById("game-iframe");
  const blocker  = document.getElementById("iframe-blocker");
  const floatBtn = document.getElementById("lobby-float-btn");
  const rawUrl   = LOBBY_URLS[app] || "about:blank";
  const hasProxy = (typeof PROXY_BASE !== "undefined" && PROXY_BASE && rawUrl !== "about:blank");
  const proxyUrl = hasProxy
    ? `${PROXY_BASE}/proxy?url=${encodeURIComponent(rawUrl)}`
    : rawUrl;

  // Ẩn blocker ngay — proxy sẽ bypass X-Frame-Options
  blocker.classList.add("hidden");
  floatBtn?.classList.add("hidden");
  document.getElementById("iframe-msg-url").textContent = rawUrl;

  iframe.src = "about:blank";
  setTimeout(() => {
    iframe.src = proxyUrl;

    iframe.onload = () => {
      try {
        const doc = iframe.contentDocument;
        if (!doc || doc.URL === "about:blank") {
          // Proxy load xong nhưng about:blank — chờ thêm
        } else {
          blocker.classList.add("hidden");
        }
      } catch {
        // cross-origin exception = proxy đang chạy bình thường → ẩn blocker
        blocker.classList.add("hidden");
      }
    };

    iframe.onerror = () => { blocker.classList.remove("hidden"); };

    // Timeout 8s
    setTimeout(() => {
      try {
        const doc = iframe.contentDocument;
        if (!doc || doc.URL === "about:blank" || doc.body === null) {
          if (!hasProxy) blocker.classList.remove("hidden");
        }
      } catch {
        blocker.classList.add("hidden"); // cross-origin = proxy OK
      }
    }, 8000);
  }, 300);
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
  // Restart realtime subscription cho api tab mới
  const app = window._curApp;
  if (app && APIS[app]?.[i]) {
    supaUnsubscribeAll().then(() => supaStartGameRealtime(app, APIS[app][i]));
  }
  doFetch();
}

// ── PREDICTION PANEL ───────────────────────────────────────
function openPred() {
  window._predOpen = true;
  document.getElementById("pred-panel").classList.remove("hidden");
  document.getElementById("pred-reopen").classList.add("hidden");
}
function closePred() {
  window._predOpen = false;
  document.getElementById("pred-panel").classList.add("hidden");
  document.getElementById("pred-reopen").classList.remove("hidden");
}
function togglePredCollapse() {
  const panel = document.getElementById("pred-panel");
  const btn   = document.getElementById("pred-toggle-btn");
  const collapsed = panel.classList.toggle("collapsed");
  if (btn) btn.textContent = collapsed ? "▸" : "▾";
}

// Draggable panel — fixed position, drag anywhere on screen
(function() {
  let dragging = false, ox = 0, oy = 0, startX = 0, startY = 0;
  document.addEventListener("DOMContentLoaded", () => {
    const head  = document.getElementById("pred-head");
    const panel = document.getElementById("pred-panel");
    if (!head || !panel) return;

    function startDrag(cx, cy) {
      dragging = true; ox = cx; oy = cy;
      const rect = panel.getBoundingClientRect();
      startX = rect.left; startY = rect.top;
      // Switch to left/top positioning for easier math
      panel.style.right  = "auto";
      panel.style.bottom = "auto";
      panel.style.left   = startX + "px";
      panel.style.top    = startY + "px";
    }
    function moveDrag(cx, cy) {
      if (!dragging) return;
      const dx = cx - ox, dy = cy - oy;
      const W  = window.innerWidth, H = window.innerHeight;
      const pw = panel.offsetWidth,  ph = panel.offsetHeight;
      const nx = Math.max(0, Math.min(W - pw, startX + dx));
      const ny = Math.max(0, Math.min(H - ph, startY + dy));
      panel.style.left = nx + "px";
      panel.style.top  = ny + "px";
    }

    head.addEventListener("mousedown", e => { startDrag(e.clientX, e.clientY); document.addEventListener("mousemove", onMove); document.addEventListener("mouseup", onUp); });
    head.addEventListener("touchstart", e => { e.preventDefault(); const t = e.touches[0]; startDrag(t.clientX, t.clientY); }, { passive: false });
    document.addEventListener("touchmove", e => { if (!dragging) return; e.preventDefault(); const t = e.touches[0]; moveDrag(t.clientX, t.clientY); }, { passive: false });
    document.addEventListener("touchend", () => { dragging = false; });
  });
  function onMove(e) { moveDrag(e.clientX, e.clientY); }
  function onUp() { dragging = false; document.removeEventListener("mousemove", onMove); document.removeEventListener("mouseup", onUp); }
})();

// ── DATA FETCH — Chỉ lấy từ Supabase database ─────────────
async function doFetch() {
  if (!window._curApp) return;
  const app = window._curApp;
  const api = APIS[app][window._curApiIdx];
  await supaLoadFallback(app, api);
}

// Load dữ liệu từ Supabase database
async function supaLoadFallback(app, api) {
  const pb = document.getElementById("pred-body");
  try {
    const hist = await supaFetchHistory(app, api.label);
    if (!hist || !hist.history_json || hist.history_json.length === 0) {
      if (pb) pb.innerHTML = `<div class="pred-loading"><span>☁️ Đang tải dữ liệu từ AI KING DZI...</span></div>`;
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

    // Render lịch sử từ cloud
    renderHistBar(app, api);

    // Fetch + hiển thị dự đoán mới nhất từ cloud
    const pred = await supaFetchLatestPred(app, api.label);
    if (pred) supaRenderCloudPred(pred, app, api);

  } catch(err) {
    if (pb) pb.innerHTML = `<div class="pred-loading"><span>⚠️ Không kết nối được AI KING DZI</span></div>`;
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
  const nextPhien = pred.phien ? (parseInt(pred.phien) + 1) : "?";
  const appLabel = app && api ? app + "_" + api.label : "";

  pb.innerHTML = `
    <div class="supa-pred-block">
      <div class="robot-gif-wrap">
        <img src="https://media.giphy.com/media/3oKIPnAiaMCws8nOsE/giphy.gif" class="robot-gif" alt="AI Robot"
          onerror="this.src='https://media.giphy.com/media/l0HlBO7eyXzSZkJri/giphy.gif'"/>
      </div>
      <div class="ai-typing-wrap"><div class="ai-typing-text" id="ai-typing-text"></div></div>
      <div class="supa-pred-badge">🤖 AI KING DZI</div>
      <div class="pred-next-lbl">Dự đoán phiên sau là</div>
      <div class="pred-next-num">#${nextPhien}</div>
      <div class="dice-anim-row"><span class="dice-spin">🎲</span><span class="dice-spin" style="animation-delay:.15s">🎲</span><span class="dice-spin" style="animation-delay:.3s">🎲</span></div>
      <div class="supa-pred-result">${emoji} <span>${pred.du_doan}</span></div>
      <div class="supa-pred-bar">[${bar}] ${pred.do_tin_cay}%</div>
      <div class="supa-pred-votes">🗳️ ${pred.votes}/${pred.total_methods} phương pháp</div>
      <div class="supa-pred-time">⏰ ${timeStr}</div>
      <button class="open-hist-btn" onclick="openHistModal('${app}','${api ? api.label : ''}','${api ? api.type : ''}')">📋 Lịch Sử Dự Đoán</button>
    </div>`;
  // Khởi động typing animation "đang suy nghĩ"
  startAITyping("thinking");
}

// Subscribe realtime khi vào game — nhận data từ Python tool ngay lập tức
async function supaStartGameRealtime(app, api) {
  await supaSubscribeResults(app, api.label, row => {
    // ── GUARD: chỉ xử lý khi đúng sảnh + api đang xem ──
    if (window._curApp !== app) return;
    if (APIS[app]?.[window._curApiIdx]?.label !== api.label) return;
    // Có phiên mới từ Python → cập nhật history và render
    if (window._lastPhien[app]?.[api.label] === row.phien) return;
    window._lastPhien[app][api.label] = row.phien;
    const isXD = api.type === "xocdia";
    const actualKq = isXD ? row.ket_qua_truyen_thong : row.ket_qua;
    const rec = {
      phien: row.phien, ket_qua: row.ket_qua, tong: row.tong,
      xuc_xac_1: row.xuc_xac_1, xuc_xac_2: row.xuc_xac_2, xuc_xac_3: row.xuc_xac_3,
      ket_qua_truyen_thong: row.ket_qua_truyen_thong,
      ket_qua_chi_tiet: row.ket_qua_chi_tiet,
    };
    if (!window._histData[app]?.[api.label]) return;
    window._histData[app][api.label].push(rec);
    if (window._histData[app][api.label].length > 80) window._histData[app][api.label].shift();

    // So sánh dự đoán đang pending vs kết quả vừa về
    const pp = window._pendingPred[app]?.[api.label];
    if (pp && actualKq) {
      const ok = pp.pred === actualKq;
      if (!window._statData[app]) window._statData[app] = {};
      if (!window._statData[app][api.label]) window._statData[app][api.label] = { d: 0, s: 0 };
      if (ok) window._statData[app][api.label].d++;
      else    window._statData[app][api.label].s++;
      // Ghi predLog
      const logKey = app + "_" + api.label;
      if (!window._predLog) window._predLog = {};
      if (!window._predLog[logKey]) window._predLog[logKey] = [];
      const pendingPhien = pp.pendingPhien || row.phien;
      if (!window._predLog[logKey].find(r => r.phien === pendingPhien)) {
        window._predLog[logKey].push({ phien: pendingPhien, pred: pp.pred, actual: actualKq, ok });
        if (window._predLog[logKey].length > 100) window._predLog[logKey].shift();
      }
      window._pendingPred[app][api.label] = null;
      // TTS đọc kết quả đúng/sai
      if (window.TxTTS) { try { window.TxTTS.announceVerdict(ok, pp.pred, actualKq, app); } catch(e) {} }
      // Sound feedback
      if (window.TxSound) { try { ok ? window.TxSound.play.success() : window.TxSound.play.error(); } catch(e) {} }
      // Typing animation
      startAITyping(ok ? "correct" : "wrong");
      // Cập nhật % trên lobby card
      updateLobbyAccBadge(app);
    }

    renderHistBar(app, api);
    showToast(`🤖 AI KING DZI — Phiên mới: #${row.phien} — ${actualKq || ""}`, "info");
    if (window.TxSound) { try { window.TxSound.play.dice(); } catch(e) {} }
  });

  await supaSubscribePredictions(app, api.label, row => {
    // ── GUARD: chỉ xử lý khi đúng sảnh + api đang xem ──
    if (window._curApp !== app) return;
    if (APIS[app]?.[window._curApiIdx]?.label !== api.label) return;
    // Có dự đoán mới từ Python → lưu pending và render
    if (!window._pendingPred[app]) window._pendingPred[app] = {};
    // Lấy phiên hiện tại để track
    const hist = window._histData[app]?.[api.label] || [];
    const curPhien = hist.length > 0 ? hist[hist.length - 1].phien : row.phien;
    window._pendingPred[app][api.label] = { pred: row.du_doan, pendingPhien: curPhien };
    // TTS đọc dự đoán realtime
    if (window.TxTTS && row.du_doan && row.phien) {
      const nextP = parseInt(row.phien) + 1;
      try { window.TxTTS.announcePredict(nextP, row.du_doan, app); } catch(e) {}
    }
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
    // Lưu vào predLog
    const logKey = app + "_" + label;
    if (!window._predLog) window._predLog = {};
    if (!window._predLog[logKey]) window._predLog[logKey] = [];
    if (!window._predLog[logKey].find(r => r.phien === pp.pendingPhien)) {
      window._predLog[logKey].push({ phien: pp.pendingPhien || phien, pred: pp.pred, actual: actualKq, ok });
      if (window._predLog[logKey].length > 100) window._predLog[logKey].shift();
    }
    // Typing animation theo kết quả
    startAITyping(ok ? "correct" : "wrong");
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
  // Cập nhật cột phải hub
  if (app && api) renderHubHist(app, api);
}

// ── RENDER HUB HISTORY PANEL (cột phải) ───────────────────
function renderHubHist(app, api) {
  const panel = document.getElementById("hub-hist-panel");
  if (!panel) return;
  const isXD = api.type === "xocdia";
  const hist = window._histData[app]?.[api.label] || [];
  if (!hist.length) {
    panel.innerHTML = `<div class="hub-hist-empty">⏳ Đang chờ dữ liệu từ sảnh...</div>`;
    return;
  }
  const recent = [...hist].reverse().slice(0, 30);
  const FACE = { 1:"⚀", 2:"⚁", 3:"⚂", 4:"⚃", 5:"⚄", 6:"⚅" };
  let html = "";
  recent.forEach(r => {
    const kq = isXD ? (r.ket_qua_truyen_thong || r.ket_qua) : r.ket_qua;
    const cl = RCL[kq] || "";
    const emoji = RE[kq] || "⬜";
    const d1 = FACE[r.xuc_xac_1] || "🎲";
    const d2 = FACE[r.xuc_xac_2] || "🎲";
    const d3 = FACE[r.xuc_xac_3] || "🎲";
    const tong = r.tong ? `Tổng: ${r.tong}` : "";
    const detail = r.ket_qua_chi_tiet || "";
    html += `
    <div class="hub-hist-row ${cl}">
      <div class="hub-hist-phien">#${r.phien}</div>
      <div class="hub-hist-dice">${d1}${d2}${d3}</div>
      <div class="hub-hist-kq">
        <span class="hub-kq-emoji">${emoji}</span>
        <span class="hub-kq-label">${kq || "?"}</span>
        ${tong ? `<span class="hub-kq-tong">${tong}</span>` : ""}
        ${detail ? `<span class="hub-kq-detail">${detail}</span>` : ""}
      </div>
    </div>`;
  });
  panel.innerHTML = html;
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
    // Sound feedback
    if (window.TxSound) { try { verdict.ok ? window.TxSound.play.success() : window.TxSound.play.error(); } catch(e) {} }
    // TTS đọc kết quả đúng/sai
    if (window.TxTTS) { try { window.TxTTS.announceVerdict(verdict.ok, verdict.pred, verdict.actual, app); } catch(e) {} }
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

  const curPhien = hist.length > 0 ? hist[hist.length - 1].phien : "?";
  const nextPhien = curPhien !== "?" ? (parseInt(curPhien) + 1) : "?";
  window._pendingPred[app][api.label] = { pred: best, pendingPhien: curPhien };
  // TTS đọc dự đoán mới
  if (window.TxTTS) {
    try { window.TxTTS.announcePredict(nextPhien, best, app); } catch(e) {}
  }
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
        <img src="https://media.giphy.com/media/3oKIPnAiaMCws8nOsE/giphy.gif" class="robot-gif" alt="AI Robot"
          onerror="this.src='https://media.giphy.com/media/l0HlBO7eyXzSZkJri/giphy.gif'"/>
      </div>
      <div class="ai-typing-wrap"><div class="ai-typing-text" id="ai-typing-text"></div></div>
      <div class="pred-next-lbl">Dự đoán phiên sau là</div>
      <div class="pred-next-num">#${nextPhien}</div>
      <div class="dice-anim-row">
        <span class="dice-spin">🎲</span><span class="dice-spin" style="animation-delay:.15s">🎲</span><span class="dice-spin" style="animation-delay:.3s">🎲</span>
      </div>
      <div class="pred-emoji-big spin-on-change">${RE[best] || "?"}</div>
      <div class="pred-label ${cl}">${best}</div>
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
    <div class="algo-badge">🧠 ${total} thuật toán · Ensemble AI · Backtest Weighted</div>
    <button class="open-hist-btn" onclick="openHistModal('${app}','${api.label}','${api.type}')">📋 Lịch Sử Dự Đoán</button>`;
  // Typing animation: đang suy nghĩ (trừ khi vừa có verdict thì đã set rồi)
  if (!verdict) startAITyping("thinking");
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

// ── AI TYPING ANIMATION ─────────────────────────────────────
window._typingTimer = null;
const AI_MESSAGES = {
  thinking: [
    "🤖 Bot AI King Dzi đang suy nghĩ...",
    "🧠 Bot AI King Dzi đang phân tích kết quả phiên sau...",
    "⚙️ Bot AI King Dzi đang tính toán xác suất...",
    "🔍 Bot AI King Dzi đang tìm pattern...",
    "📊 Bot AI King Dzi đang xử lý 42 thuật toán...",
  ],
  result: [
    "📢 Bot AI King Dzi báo kết quả phiên sau là...",
    "🎯 Bot AI King Dzi đã phân tích xong!",
    "🤖 Bot AI King Dzi dự đoán chính xác phiên sau:",
  ],
  correct: [
    "🎉 Bot AI King Dzi đã dự đoán chính xác! Quá tuyệt vời!",
    "✅ Bot AI King Dzi đúng rồi! Xuất sắc!",
    "🏆 Bot AI King Dzi thắng! Bạn theo dõi chưa?",
  ],
  wrong: [
    "🥲🥲 Bot AI King Dzi đã trả lời sai rồi... Mình xin lỗi nhé",
    "😔 Bot AI King Dzi đoán sai lần này... Cố lên!",
    "🙏 Bot AI King Dzi xin lỗi bạn nhé, lần sau sẽ cố hơn!",
  ],
};

function startAITyping(state) {
  if (window._typingTimer) clearTimeout(window._typingTimer);
  const el = document.getElementById("ai-typing-text");
  if (!el) return;
  const msgs = AI_MESSAGES[state] || AI_MESSAGES.thinking;
  const msg = msgs[Math.floor(Math.random() * msgs.length)];
  el.className = "ai-typing-text " + state;
  let i = 0;
  el.textContent = "";
  const cursor = document.createElement("span");
  cursor.className = "ai-typing-cursor";
  el.appendChild(cursor);

  function typeNext() {
    if (i < msg.length) {
      el.insertBefore(document.createTextNode(msg[i]), cursor);
      i++;
      window._typingTimer = setTimeout(typeNext, 28);
    } else {
      // Sau khi gõ xong, nếu là thinking thì loop sang msg khác sau 4s
      if (state === "thinking") {
        window._typingTimer = setTimeout(() => startAITyping("thinking"), 4000);
      } else if (state === "result") {
        window._typingTimer = setTimeout(() => startAITyping("thinking"), 5000);
      }
      // correct/wrong: dừng lại, không loop
    }
  }
  typeNext();
}

// ── HIST MODAL ──────────────────────────────────────────────
function openHistModal(app, label, type) {
  const isXD = type === "xocdia";
  const hist = window._histData[app]?.[label] || [];
  const st   = window._statData[app]?.[label] || { d: 0, s: 0 };
  const logKey = app + "_" + label;
  const log = (window._predLog && window._predLog[logKey]) || [];
  const acc = st.d + st.s > 0 ? Math.round(st.d / (st.d + st.s) * 100) : 0;
  const accColor = acc >= 60 ? "var(--green)" : acc >= 50 ? "var(--gold)" : "var(--tai)";

  document.getElementById("hist-modal-title").textContent = `📋 ${app.toUpperCase()} · ${label}`;
  document.getElementById("hist-modal-stats").innerHTML = `
    <div class="hms-item"><div class="hms-val" style="color:var(--accent)">${hist.length}</div><div class="hms-lbl">Phiên</div></div>
    <div class="hms-item"><div class="hms-val" style="color:var(--green)">${st.d}</div><div class="hms-lbl">✅ Đúng</div></div>
    <div class="hms-item"><div class="hms-val" style="color:var(--tai)">${st.s}</div><div class="hms-lbl">❌ Sai</div></div>
    <div class="hms-item"><div class="hms-val" style="color:${accColor}">${acc}%</div><div class="hms-lbl">Chính xác</div></div>`;

  // Build log map
  const logMap = {};
  log.forEach(r => logMap[r.phien] = r);

  const tbody = document.getElementById("hist-tbl-body");
  tbody.innerHTML = "";
  const recent = [...hist].reverse().slice(0, 60);
  if (!recent.length) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:var(--muted);padding:22px">Chưa có dữ liệu</td></tr>`;
  } else {
    recent.forEach(rec => {
      const kq = (isXD ? rec.ket_qua_truyen_thong : rec.ket_qua) || "?";
      const kqCls = "ht-" + (RCL[kq] || "");
      const logRec = logMap[rec.phien];
      let predHtml = `<span class="ht-pending">—</span>`;
      let resHtml  = `<span class="ht-pending">—</span>`;
      if (logRec) {
        predHtml = `<span class="ht-pred ${RCL[logRec.pred] || ''}">${RE[logRec.pred] || ""} ${logRec.pred}</span>`;
        resHtml  = logRec.ok
          ? `<span class="ht-dung">✅ Đúng</span>`
          : `<span class="ht-sai">❌ Sai</span>`;
      }
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><span class="ht-phien">#${rec.phien}</span></td>
        <td><span class="${kqCls}">${RE[kq] || ""} ${kq}</span></td>
        <td>${predHtml}</td>
        <td>${resHtml}</td>`;
      tbody.appendChild(tr);
    });
  }
  document.getElementById("hist-modal-overlay").classList.remove("hidden");
}

function closeHistModal() {
  document.getElementById("hist-modal-overlay").classList.add("hidden");
}

// ── TRIGGER HIST MODAL (từ button trên đầu pred block) ──────
function triggerHistModal() {
  const app = window._curApp;
  if (!app) return;
  const apis = (typeof APIS !== "undefined") ? APIS[app] : null;
  if (!apis || !apis.length) return;
  const api = apis[window._curApiIdx || 0];
  if (!api) return;
  openHistModal(app, api.label, api.type);
}
