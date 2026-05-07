// ═══════════════════════════════════════════════════════════
//  APP LOGIC — Game View, Fetch, Render  |  Tài Xỉu AI
// ═══════════════════════════════════════════════════════════

// ── SAFETY: đảm bảo calcStreak luôn có dù algorithms.js chưa load
if (typeof calcStreak === 'undefined') {
  function calcStreak(r) {
    if (!r || r.length === 0) return 0;
    let s = 1;
    for (let i = r.length - 2; i >= 0; i--) {
      if (r[i] === r[r.length - 1]) s++;
      else break;
    }
    return s;
  }
}


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
    // Fetch TX stats từ tx_history_v2
    const rows = await supaFetchAllLatest();
    if (Array.isArray(rows)) {
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
    }
    // Fetch BCR verdicts từ bcr_verdicts_v2 để tính accuracy BCR per bàn
    try {
      const bcrRes = await fetch(
        `${SUPA_URL}/rest/v1/${DB_TABLES.bcrVerdicts}?select=app,ban,dung&order=updated_at.desc&limit=500`,
        { headers: _SH() }
      );
      if (bcrRes.ok) {
        const bcrRows = await bcrRes.json();
        if (Array.isArray(bcrRows)) {
          // FIX: tách stats theo từng bàn (ban) thay vì gom chung → tránh chồng kết quả
          if (!window._statData["bcr"]) window._statData["bcr"] = {};
          let totalD = 0, totalS = 0;
          bcrRows.forEach(row => {
            const banKey = "Ban_" + String(row.ban || "all");
            if (!window._statData["bcr"][banKey]) window._statData["bcr"][banKey] = { d: 0, s: 0 };
            const isDung = row.dung === true || row.dung === "true";
            const isSai  = row.dung === false || row.dung === "false";
            if (isDung) { window._statData["bcr"][banKey].d++; totalD++; }
            else if (isSai) { window._statData["bcr"][banKey].s++; totalS++; }
          });
          // Cũng lưu tổng vào "Baccarat" để badge lobby hiện được
          window._statData["bcr"]["Baccarat"] = { d: totalD, s: totalS };
        }
      }
    } catch(e2) { console.warn("preloadAllStats BCR lỗi:", e2); }
  } catch(e) { console.warn("preloadAllStats lỗi:", e); }

  // Fallback: tx_verdicts_v2 cho các sảnh chưa có stats_json trong history
  try {
    const vRes = await fetch(
      `${SUPA_URL}/rest/v1/${DB_TABLES.verdicts}?select=app,api_label,dung&order=created_at.desc&limit=2000`,
      { headers: _SH() }
    );
    if (vRes.ok) {
      const rows = await vRes.json();
      const counts = {};
      rows.forEach(r => {
        const k = r.app + "|" + r.api_label;
        if (!counts[k]) counts[k] = { app: r.app, label: r.api_label, d: 0, s: 0 };
        if (r.dung) counts[k].d++; else counts[k].s++;
      });
      Object.values(counts).forEach(({ app, label, d, s }) => {
        if (!window._statData[app]) window._statData[app] = {};
        // Chỉ override nếu chưa có hoặc tổng = 0
        const existing = window._statData[app][label];
        if (!existing || (existing.d + existing.s) === 0) {
          window._statData[app][label] = { d, s };
        }
      });
    }
  } catch(e2) { console.warn("preloadAllStats verdicts fallback lỗi:", e2); }
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
    // FIX LAG: defer preloadAllStats ra sau khi UI đã render xong (~300ms)
    // tránh block main thread ngay lúc login
    setTimeout(() => {
      preloadAllStats().then(() => {
        Object.keys(APIS).forEach(app => updateLobbyAccBadge(app));
      });
    }, 350);
  } catch(err) {
    console.error("[launchApp] Lỗi:", err);
    // Reset màn hình auth nếu launch thất bại
    document.getElementById("auth-screen").style.display = "flex";
    const appEl = document.getElementById("app");
    if (appEl) appEl.style.display = "none";
    throw err; // re-throw để doLogin() biết mà hiện lỗi
  }
}


// ── BCR BACCARAT TABLE PICKER ──────────────────────────────
window._bcrTablesData = [];
window._bcrPickerApp  = null;
window._bcrSelectedTable = null;
window._bcrRetryTimer = null; // track retry timeout để cancel khi thoát

async function openBcrTablePicker(app) {
  // Check maintenance first
  const underMaint = await isUnderMaintenance(app);
  if (underMaint) { showToast("🔧 Sảnh Baccarat đang bảo trì!", "warn"); return; }

  window._bcrPickerApp = app;
  const overlay = document.getElementById("bcr-picker-overlay");
  if (!overlay) { console.error("BCR picker overlay not found"); return; }

  overlay.classList.remove("hidden");
  const grid = document.getElementById("bcr-table-grid");
  const loading = document.getElementById("bcr-picker-loading");
  if (grid) grid.innerHTML = "";
  if (loading) loading.style.display = "flex";

  try {
    // Load từ Supabase bcr_results_v2 thay vì gọi API trực tiếp (tránh CORS)
    // order=updated_at.desc để lấy row mới nhất trước, sau đó deduplicate theo ban
    const res = await fetch(
      `${SUPA_URL}/rest/v1/${DB_TABLES.bcrResults}?app=eq.bcr&select=ban,ket_qua_moi_nhat,tong_phien,cai_count,con_count,hoa_count,good_road,results_raw,du_doan_tiep,do_tin_cay,updated_at&order=updated_at.desc&limit=200`,
      { headers: _SH() }
    );
    if (!res.ok) throw new Error("Supabase lỗi " + res.status);
    const rawRows = await res.json();

    // Deduplicate: chỉ giữ row mới nhất (updated_at lớn nhất) cho mỗi ban
    const seenBans = new Set();
    const rows = rawRows.filter(r => {
      const key = String(r.ban);
      if (seenBans.has(key)) return false;
      seenBans.add(key);
      return true;
    }).sort((a, b) => {
      // Sắp xếp theo số ban (numeric)
      const na = parseInt(a.ban) || 0, nb = parseInt(b.ban) || 0;
      return na - nb;
    });

    if (loading) loading.style.display = "none";
    if (!rows || !rows.length) {
      if (grid) grid.innerHTML = '<div class="bcr-empty">Không có bàn nào đang hoạt động</div>';
      return;
    }

    // Convert supabase rows → tables format
    const tables = rows.map(r => ({
      ban: r.ban,
      results: r.results_raw || "",
      good_road: r.good_road || "",
      du_doan_tiep: r.du_doan_tiep || "",
      do_tin_cay: r.do_tin_cay || 0,
      tong_phien: r.tong_phien || 0,
      cai_count: r.cai_count || 0,
      con_count: r.con_count || 0,
      hoa_count: r.hoa_count || 0,
    }));
    window._bcrTablesData = tables;
    renderBcrTableGrid(tables, grid);
  } catch(e) {
    if (loading) loading.style.display = "none";
    if (grid) grid.innerHTML = `<div class="bcr-empty">⚠️ Không thể tải danh sách bàn.<br/><small>${e.message}</small></div>`;
  }
}

function renderBcrTableGrid(tables, grid) {
  if (!grid) return;
  grid.innerHTML = "";
  tables.forEach(ban => {
    const banId   = ban.ban || ban.id || "?";
    const results = ban.results || ban.results_raw || "";
    const road    = ban.good_road || "";
    const seq     = [...results].filter(c => "PBT".includes(c));
    const total   = ban.tong_phien || seq.length;
    // Use pre-computed counts from Supabase if available
    const cai     = ban.cai_count !== undefined ? ban.cai_count : (results.split("B").length - 1);
    const con     = ban.con_count !== undefined ? ban.con_count : (results.split("P").length - 1);
    const hoa     = ban.hoa_count !== undefined ? ban.hoa_count : (results.split("T").length - 1);
    const caiPct  = total > 0 ? Math.round(cai / total * 100) : 0;
    const conPct  = total > 0 ? Math.round(con / total * 100) : 0;
    const hoaPct  = total > 0 ? Math.round(hoa / total * 100) : 0;
    // Python stores "Cai"/"Con"/"Hoa" — normalize to display
    const kqRaw   = ban.ket_qua_moi_nhat || (seq.length > 0 ? {"P":"Con","B":"Cái","T":"Hòa"}[seq[seq.length-1]] : "?");
    const lastKq  = {"Cai":"Cái","Con":"Con","Hoa":"Hòa"}[kqRaw] || kqRaw || "?";
    const lastEmoji = RE[lastKq] || "⬜";
    const lastCl  = RCL[lastKq] || "";

    // Recent 8 results
    const recent8 = seq.slice(-8).map(c => {
      const k = {"P":"Con","B":"Cái","T":"Hòa"}[c] || c;
      return `<span class="bcr-dot ${RCL[k]||""}">${RE[k]||"?"}</span>`;
    }).join("");

    // AI prediction badge
    const predRaw = ban.du_doan_tiep || "";
    const predDisp = {"Cai":"Cái","Con":"Con","Hoa":"Hòa"}[predRaw] || predRaw;
    const predConf = ban.do_tin_cay || 0;
    const predHtml = predDisp
      ? `<div class="bcr-table-pred">${RE[predDisp]||"🤖"} Dự đoán: <strong>${predDisp}</strong> <span style="opacity:.7">(${predConf}%)</span></div>`
      : "";

    const card = document.createElement("div");
    card.className = "bcr-table-card";
    card.dataset.banId = banId;
    card.innerHTML = `
      <div class="bcr-table-header">
        <div class="bcr-table-num">Bàn ${banId}</div>
        <div class="bcr-table-kq ${lastCl}">${lastEmoji} ${lastKq}</div>
      </div>
      <div class="bcr-table-recent">${recent8 || "<span style='opacity:.4'>Chưa có dữ liệu</span>"}</div>
      <div class="bcr-table-stats">
        <div class="bcr-stat-item tai"><span>🔴 Cái</span><strong>${caiPct}%</strong><small>(${cai})</small></div>
        <div class="bcr-stat-item xiu"><span>🔵 Con</span><strong>${conPct}%</strong><small>(${con})</small></div>
        <div class="bcr-stat-item hoa"><span>🟡 Hòa</span><strong>${hoaPct}%</strong><small>(${hoa})</small></div>
      </div>
      ${predHtml}
      <div class="bcr-table-road">🛤️ ${road || "—"}</div>
      <div class="bcr-table-total">📊 ${total} phiên</div>
      <button class="bcr-enter-btn" onclick="enterBcrTable('${banId}')">Vào Bàn ${banId} →</button>
    `;
    grid.appendChild(card);
  });
}

function closeBcrPicker() {
  const overlay = document.getElementById("bcr-picker-overlay");
  if (overlay) overlay.classList.add("hidden");
  window._bcrPickerApp = null;
}

async function enterBcrTable(banId) {
  const app = window._bcrPickerApp || "bcr";
  window._bcrSelectedTable = banId;
  closeBcrPicker();
  // Mở game view Baccarat cho bàn đã chọn
  await openBcrGame(app, banId);
}

async function openBcrGame(app, banId) {
  const underMaint = await isUnderMaintenance(app);
  if (underMaint) { showToast("🔧 Sảnh Baccarat đang bảo trì!", "warn"); return; }

  // Cancel timer cũ (TX hoặc BCR trước đó) trước khi start
  clearInterval(window._fetchTimer); window._fetchTimer = null;
  if (window._bcrRetryTimer) { clearTimeout(window._bcrRetryTimer); window._bcrRetryTimer = null; }

  window._curApp    = app;
  window._curApiIdx = 0;
  window._bcrSelectedTable = banId;

  if (!window._histData[app]) window._histData[app] = {};
  if (!window._statData[app]) window._statData[app] = {};
  if (!window._lastPhien[app]) window._lastPhien[app] = {};
  if (!window._pendingPred[app]) window._pendingPred[app] = {};

  const label = "Ban_" + String(banId); // FIX: tách stats theo từng bàn
  window._histData[app][label]    = window._histData[app][label] || [];
  window._statData[app][label]    = window._statData[app][label] || { d: 0, s: 0 };
  window._lastPhien[app][label]   = window._lastPhien[app][label] || null;
  window._pendingPred[app][label] = window._pendingPred[app][label] || null;

  setActivePage("game");
  const em = BRAND_EMOJI[app] || "🎴";
  document.getElementById("game-brand-tag").textContent = `${em} BCR — Bàn ${banId}`;
  document.getElementById("topbar-center").innerHTML    = `<span class="topbar-brand">${em} Baccarat — Bàn ${banId}</span>`;
  // Hiện loading spinner ngay trong pred-body
  const pbInit = document.getElementById("pred-body");
  if (pbInit) pbInit.innerHTML = `<div class="pred-loading"><span>🔄 Đang tải dữ liệu bàn ${banId}...</span></div>`;
  // Reset hub hist panel
  const hubInit = document.getElementById("hub-hist-panel");
  if (hubInit) hubInit.innerHTML = `<div class="hub-hist-empty">⏳ Đang tải dữ liệu...</div>`;
  // Reset pred-hist bar và summary (tránh hiện "Tài/Xỉu" cũ từ TX)
  const barInit = document.getElementById("pred-hist-bar");
  const phInit  = document.getElementById("pred-hist");
  if (barInit) barInit.innerHTML = "";
  if (phInit)  phInit.classList.add("hidden");
  const summaryInit = document.getElementById("pred-hist-summary");
  if (summaryInit) { summaryInit.innerHTML = ""; summaryInit.removeAttribute("data-mode"); }

  buildApiTabs();
  updateLobbyBtnLabel(app);
  openPred();
  closeSidebar();

  // Load BCR data for selected table
  doFetchBcr(app, banId);
  clearInterval(window._fetchTimer);
  window._fetchTimer = setInterval(() => doFetchBcr(app, banId), 15000);

  showCalcEffect();
}

async function doFetchBcr(app, banId) {
  // GUARD: nếu user đã thoát sang sảnh khác → không làm gì cả
  if (window._curApp !== app) return;
  if (window._bcrSelectedTable !== banId) return;
  const api = APIS[app]?.[0];
  if (!api) return;
  const pb = document.getElementById("pred-body");
  // Hiện loading spinner ngay
  if (pb && (pb.innerHTML.includes("Lỗi") || !pb.innerHTML.trim())) {
    if (pb) pb.innerHTML = `<div class="pred-loading"><span>🔄 Đang tải dữ liệu bàn ${banId}...</span></div>`;
  }
  // Thử fetch với retry (2 lần)
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      // Thử nhiều format ban ID: "C16", "16", "c16"
      const banVariants = [banId, banId.replace(/^C/i,""), "C"+banId.replace(/^C/i,"")];
      const banVariantsEnc = banVariants.map(b => encodeURIComponent(b)).join(",");
      const res = await fetch(
        `${SUPA_URL}/rest/v1/${DB_TABLES.bcrResults}?app=eq.bcr&ban=in.(${banVariantsEnc})&select=*&order=updated_at.desc&limit=1`,
        { headers: _SH() }
      );
      if (!res.ok) throw new Error("Supabase lỗi " + res.status);
      const rows = await res.json();
      const ban = rows?.[0];
      if (!ban) {
        // Fallback: lấy tất cả rồi tìm match
        const res2 = await fetch(
          `${SUPA_URL}/rest/v1/${DB_TABLES.bcrResults}?app=eq.bcr&select=ban,results_raw,good_road,du_doan_tiep,do_tin_cay,tong_phien,cai_count,con_count,hoa_count,updated_at&order=updated_at.desc&limit=200`,
          { headers: _SH() }
        );
        const rows2 = await res2.json();
        const fallbackBan = rows2?.find(r =>
          banVariants.some(v => String(r.ban).toLowerCase() === String(v).toLowerCase())
        );
        if (!fallbackBan) {
          if (pb) pb.innerHTML = `<div class="pred-loading">
            <span>⏳ Bàn ${banId} chưa có dữ liệu</span>
            <small style="opacity:.7;display:block;margin-top:6px">Bot chưa cập nhật bàn này.<br/>Hệ thống sẽ tự thử lại sau 10 giây...</small>
            <button onclick="doFetchBcr('${app}','${banId}')" style="margin-top:10px;padding:6px 18px;background:#7c3aed;border:none;border-radius:8px;color:#fff;cursor:pointer;font-size:13px">🔄 Thử lại ngay</button>
          </div>`;
          if (window._bcrRetryTimer) clearTimeout(window._bcrRetryTimer);
          window._bcrRetryTimer = setTimeout(() => doFetchBcr(app, banId), 10000);
          return;
        }
        return _processBcrBanData(app, api, banId, fallbackBan, pb);
      }
      return _processBcrBanData(app, api, banId, ban, pb);
    } catch(e) {
      if (attempt === 1) {
        if (pb) pb.innerHTML = `<div class="pred-loading">⚠️ Lỗi kết nối — đang thử lại...<br/><small>${e.message}</small></div>`;
        // retry sau 3s — lưu vào _bcrRetryTimer để có thể cancel khi thoát
        if (window._bcrRetryTimer) clearTimeout(window._bcrRetryTimer);
        window._bcrRetryTimer = setTimeout(() => doFetchBcr(app, banId), 3000);
      } else {
        await new Promise(r => setTimeout(r, 1500));
      }
    }
  }
}

function _processBcrBanData(app, api, banId, ban, pb) {
  const results = ban.results_raw || "";
  const road    = ban.good_road || "";
  const seq     = [...results].filter(c => "PBT".includes(c));
  const kqMap   = {"P":"Con","B":"Cái","T":"Hòa"};
  const fullSeq = seq.map(c => kqMap[c] || c);
  // FIX: dùng banId làm label key để tránh chồng kết quả giữa các bàn
  const label   = "Ban_" + String(banId);

  // Save history với phien ID thực
  if (!window._histData[app]) window._histData[app] = {};
  window._histData[app][label] = fullSeq.slice(-80).map((kq, i) => ({
    phien: String(i + 1), ket_qua: kq,
    xuc_xac_1: null, xuc_xac_2: null, xuc_xac_3: null
  }));

  // Update BCR stats (accuracy tracking)
  if (!window._statData[app]) window._statData[app] = {};
  if (!window._statData[app][label]) window._statData[app][label] = { d: 0, s: 0 };

  // FIX: tự tính đường đi nếu API không trả về
  const displayRoad = road || calcBcrRoad(fullSeq);
  renderBcrPredPanel(app, api, ban, fullSeq, displayRoad);
  renderHistBarBcr(app, api, fullSeq);
  // Cập nhật hub history panel (cột phải)
  renderHubHistBcr(app, api, fullSeq, ban);
}

function renderHistBarBcr(app, api, fullSeq) {
  const ph  = document.getElementById("pred-hist");
  const bar = document.getElementById("pred-hist-bar");
  if (!ph || !bar) return;
  if (!fullSeq.length) { ph.classList.add("hidden"); return; }
  ph.classList.remove("hidden");
  // Cập nhật label header cho BCR
  const lbl = ph.querySelector(".pred-hist-label");
  if (lbl) lbl.textContent = "Lịch sử Baccarat 14 phiên";
  bar.innerHTML = "";
  const recent = fullSeq.slice(-14);
  let cai = 0, con = 0;
  recent.forEach(kq => {
    if (!kq || kq === "?") return; // bỏ qua phiên chưa có data
    const d = document.createElement("div");
    const cls = RCL[kq] || "";
    d.className = "h-dot " + cls;
    d.title = kq;
    // Map emoji BCR: Cái=🔴, Con=🔵, Hòa=🟡
    const bcrEmoji = {"Cái":"🔴","Con":"🔵","Hòa":"🟡"};
    d.textContent = bcrEmoji[kq] || RE[kq] || "⬜";
    bar.appendChild(d);
    if (kq === "Cái") cai++;
    else if (kq === "Con") con++;
  });
  let summaryEl = document.getElementById("pred-hist-summary");
  if (!summaryEl) {
    summaryEl = document.createElement("div");
    summaryEl.id = "pred-hist-summary";
    summaryEl.className = "pred-hist-summary";
    ph.appendChild(summaryEl);
  }
  summaryEl.setAttribute("data-mode", "bcr");
  summaryEl.innerHTML = `<div class="hist-sum-row">
    <span class="hist-sum-item tai">🔴 Cái: <strong>${cai}</strong></span>
    <span class="hist-sum-sep">·</span>
    <span class="hist-sum-item xiu">🔵 Con: <strong>${con}</strong></span>
  </div>`;
}

function renderHubHistBcr(app, api, fullSeq, ban) {
  const panel = document.getElementById("hub-hist-panel");
  if (!panel) return;
  if (!fullSeq || !fullSeq.length) {
    panel.innerHTML = `<div class="hub-hist-empty">⏳ Đang chờ dữ liệu bàn...</div>`;
    return;
  }
  const recent = [...fullSeq].reverse().slice(0, 30);
  let html = "";
  const banId = ban?.ban || "?";
  recent.forEach((kq, i) => {
    const cl = RCL[kq] || "";
    const emoji = RE[kq] || "⬜";
    const phienNum = fullSeq.length - i;
    html += `
    <div class="hub-hist-row ${cl}">
      <div class="hub-hist-phien">#${phienNum}</div>
      <div class="hub-hist-dice" style="font-size:18px">🎴</div>
      <div class="hub-hist-kq">
        <span class="hub-kq-emoji">${emoji}</span>
        <span class="hub-kq-label">${kq}</span>
      </div>
    </div>`;
  });
  panel.innerHTML = html;
}

// ── TÍNH ĐƯỜNG ĐI BCR TỪ CHUỖI KẾT QUẢ ──────────────────
function calcBcrRoad(fullSeq) {
  const seq = fullSeq.filter(k => k === "Cái" || k === "Con");
  if (seq.length < 3) return "";

  // Tính streak cuối
  const last = seq[seq.length - 1];
  let streak = 1;
  for (let i = seq.length - 2; i >= 0; i--) {
    if (seq[i] === last) streak++;
    else break;
  }

  // Tính tỉ lệ xen kẽ 10 phiên gần nhất
  const recent = seq.slice(-10);
  let alt = 0;
  for (let i = 1; i < recent.length; i++) {
    if (recent[i] !== recent[i-1]) alt++;
  }
  const altRate = recent.length > 1 ? alt / (recent.length - 1) : 0;

  // Tính tỉ lệ cùng chiều 5 phiên gần nhất
  const r5 = seq.slice(-5);
  const dominantCount = r5.filter(x => x === last).length;

  if (streak >= 5) return `${streak} bệt ${last}`;
  if (streak >= 3) return `${streak} bệt ${last}`;
  if (altRate >= 0.7) return "Cầu 212 xen kẽ";
  if (dominantCount >= 4) return `Cầu nghiêng ${last}`;
  if (altRate >= 0.5) return "Cầu đơn";
  // Kiểm tra cầu 2-2 (từng cặp)
  const last4 = seq.slice(-4);
  if (last4.length === 4 && last4[0] === last4[1] && last4[2] === last4[3] && last4[0] !== last4[2]) {
    return "Cầu 2-2";
  }
  return `Đang theo dõi`;
}

function renderBcrPredPanel(app, api, ban, fullSeq, road) {
  const pb = document.getElementById("pred-body");
  if (!pb) return;
  const lb = ["Cái", "Con"];
  const rl = fullSeq.filter(k => lb.includes(k));
  // Tính ensemble nếu đủ data
  let best = null, conf = 0, votes = 0, total = 0;
  if (rl.length >= 5) {
    const _ep = typeof window.ensembleBCR === "function" ? window.ensembleBCR
              : typeof ensembleBCR === "function" ? ensembleBCR : null;
    if (_ep) try { ({ best, conf, votes, total } = _ep(rl, lb)); } catch(e) {}
  }
  // Fallback: lấy du_doan_tiep từ bot Python (Supabase) khi chưa đủ data
  if (!best && ban.du_doan_tiep) {
    const raw = ban.du_doan_tiep;
    best  = raw === "Cai" ? "Cái" : raw === "Con" ? "Con" : raw === "Hoa" ? "Hòa" : raw;
    conf  = ban.do_tin_cay || 0;
    votes = 0; total = 0;
  }

  const banId  = ban.ban || ban.id;
  // FIX: dùng banId-key để đọc stats riêng từng bàn, tránh chồng kết quả
  const banLabel = "Ban_" + String(banId);
  const st = window._statData[app]?.[banLabel] || { d: 0, s: 0 };
  const acc = st.d + st.s > 0 ? Math.round(st.d / (st.d + st.s) * 100) + "%" : "N/A";
  const lastKq = fullSeq[fullSeq.length - 1] || "?";
  // Use pre-computed counts from Supabase if available
  const rawStr = ban.results_raw || ban.results || "";
  const cai  = ban.cai_count !== undefined ? ban.cai_count : (rawStr.split("B").length - 1);
  const con  = ban.con_count !== undefined ? ban.con_count : (rawStr.split("P").length - 1);
  const hoa  = ban.hoa_count !== undefined ? ban.hoa_count : (rawStr.split("T").length - 1);
  const total_p = ban.tong_phien || fullSeq.length;
  const caiPct = total_p > 0 ? Math.round(cai/total_p*100) : 0;
  const conPct = total_p > 0 ? Math.round(con/total_p*100) : 0;
  const gameName = api.label || "Baccarat Sexy";

  if (!best) {
    pb.innerHTML = `
      <div class="supa-pred-badge">🎴 Bàn ${banId} — ${gameName}</div>
      <div class="bcr-quick-stats">
        <div class="bcr-qs-item"><span>🔴 Cái</span><strong style="color:#ef4444">${caiPct}%</strong><small>(${cai})</small></div>
        <div class="bcr-qs-item"><span>🔵 Con</span><strong style="color:#3b82f6">${conPct}%</strong><small>(${con})</small></div>
        <div class="bcr-qs-item"><span>🟡 Hòa</span><strong>${total_p > 0 ? Math.round(hoa/total_p*100) : 0}%</strong><small>(${hoa})</small></div>
      </div>
      <div class="pred-loading" style="margin-top:10px">
        <span>⏳ Thu thập dữ liệu (${rl.length}/5)...</span>
        <small style="display:block;opacity:.6;margin-top:4px">Bot đang cập nhật bàn này</small>
      </div>`;
    return;
  }
  const cl  = RCL[best] || "";
  const confColor = conf >= 70 ? "#22c55e" : conf >= 55 ? "#ffd700" : "#ef4444";
  const nextPhien = fullSeq.length + 1;

  pb.innerHTML = `
    <div class="supa-pred-badge">🎴 Bàn ${banId} — ${gameName}</div>
    <div class="bcr-quick-stats">
      <div class="bcr-qs-item"><span>🔴 Cái</span><strong style="color:#ef4444">${caiPct}%</strong><small>(${cai})</small></div>
      <div class="bcr-qs-item"><span>🔵 Con</span><strong style="color:#3b82f6">${conPct}%</strong><small>(${con})</small></div>
      <div class="bcr-qs-item"><span>🟡 Hòa</span><strong>${total_p > 0 ? Math.round(hoa/total_p*100) : 0}%</strong><small>(${hoa})</small></div>
    </div>
    <div class="bcr-road-tag" style="margin:6px 0;padding:6px 12px;background:rgba(155,89,182,0.15);border-left:3px solid #9b59b6;border-radius:6px;font-size:13px">🛤️ Đường đi: <strong style="color:#e2b3ff">${road || "Đang phân tích..."}</strong></div>
    <div class="pred-next-lbl">Dự đoán phiên #${nextPhien}</div>
    <div class="pred-emoji-big spin-on-change">${RE[best] || "?"}</div>
    <div class="pred-label ${cl}">${best}</div>
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
      <div class="pred-stat"><div class="pred-stat-val" style="color:var(--accent)">${votes}/${total}</div><div class="pred-stat-lbl">Đồng thuận</div></div>
      <div class="pred-stat"><div class="pred-stat-val">${acc}</div><div class="pred-stat-lbl">Chính xác</div></div>
      <div class="pred-stat"><div class="pred-stat-val" style="color:var(--green)">${st.d}</div><div class="pred-stat-lbl">✅ Đúng</div></div>
      <div class="pred-stat"><div class="pred-stat-val" style="color:var(--tai)">${st.s}</div><div class="pred-stat-lbl">❌ Sai</div></div>
    </div>
    <div class="algo-badge">🧠 ${total || 68} thuật toán · Ensemble AI</div>
    <button class="open-hist-btn" onclick="openHistModal('${app}','${banLabel}','${api.type}')">📋 Lịch Sử Dự Đoán</button>`;
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
    else if (p === "lobby-mgr") el.style.display = name === p ? "flex" : "none";
    else el.style.display = name === p ? "block" : "none";
  });
}

function showHome() {
  clearInterval(window._fetchTimer); window._fetchTimer = null;
  // Cancel BCR retry timer nếu đang pending
  if (window._bcrRetryTimer) { clearTimeout(window._bcrRetryTimer); window._bcrRetryTimer = null; }
  // FIX: cancel collecting retry khi thoát sảnh
  if (window._collectingRetry) { clearTimeout(window._collectingRetry); window._collectingRetry = null; }
  // Reset BCR state để không leak vào TX games
  window._bcrSelectedTable = null;
  window._bcrPickerApp = null;
  window._curApp = null;
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
  const maint = await getMaintenance(true);
  // Lấy tất cả sảnh từ APIS
  const allApps = Object.keys(APIS);
  allApps.forEach((app) => {
    const em      = BRAND_EMOJI[app] || "🎰";
    const grad    = BRAND_GRADIENT[app] || "linear-gradient(135deg,#1e2d42,#0e1520)";
    const isMaint = !!maint[app];
    const apis    = APIS[app] || [];
    const imgUrl  = (typeof BRAND_IMG !== "undefined" && BRAND_IMG[app]) ? BRAND_IMG[app] : "";
    const card = document.createElement("div");
    card.className = "lobby-mgr-card";
    card.innerHTML = `
      <div class="lmgr-banner" style="background:${grad}">
        ${imgUrl
          ? `<img src="${imgUrl}" class="lmgr-logo-img" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"/><div class="lmgr-emoji" style="display:none">${em}</div>`
          : `<div class="lmgr-emoji">${em}</div>`
        }
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
  // Force clear cache và refresh
  _maintCache = null;
  _maintLastFetch = 0;
  await renderLobbyManager();
  await buildLobbies(); // refresh home lobby grid
}

function goHome() { showHome(); }

// ── LOBBIES ────────────────────────────────────────────────
async function buildLobbies() {
  const g = document.getElementById("lobby-grid");
  if (!g) return;
  g.innerHTML = "";
  // Render ngay với maint={} (không đơ chờ fetch)
  _renderLobbyCards(g, {});
  // Fetch maintenance song song → update card sau
  getMaintenance(true).then(maint => _renderLobbyCards(g, maint)).catch(() => {});
}

function _makeLobbySectionHeader(title, icon, color) {
  const div = document.createElement("div");
  div.className = "lobby-section-header";
  div.innerHTML = `<span class="lobby-section-icon">${icon}</span><span class="lobby-section-title" style="color:${color}">${title}</span><div class="lobby-section-line" style="background:${color}40"></div>`;
  return div;
}

function _makelobbyCard(app, maint, idx) {
  const em      = BRAND_EMOJI[app] || "🎰";
  const grad    = BRAND_GRADIENT[app] || "linear-gradient(135deg,#1e2d42,#0e1520)";
  const col     = BRAND_COLOR[app] || "#00d4ff";
  const isMaint = !!maint[app];
  const c       = document.createElement("div");
  c.className   = "lobby-card" + (isMaint ? " lobby-maint" : "");
  c.dataset.app = app;
  const imgUrl  = (typeof BRAND_IMG !== "undefined" && BRAND_IMG[app]) ? BRAND_IMG[app] : "";
  const accHtml = getLobbyAccBadgeHtml(app);
  const isBcr   = APIS_BCR && APIS_BCR[app];
  c.innerHTML = `
    <div class="lobby-banner" style="background:${grad}">
      <div class="lobby-banner-inner">
        ${imgUrl ? `<img src="${imgUrl}" class="lobby-logo-img" onerror="this.style.display='none'"/>` : `<div class="lobby-emoji">${em}</div>`}
        <div class="lobby-glow-ring" style="border-color:${col}40"></div>
      </div>
      ${isMaint ? `<div class="lobby-maint-overlay"><span>🔧</span><span>BẢO TRÌ</span></div>` : ""}
      <div class="lobby-particles"><span></span><span></span><span></span></div>
      <div class="lobby-acc-badge" id="acc-badge-${app}">${accHtml}</div>
    </div>
    <div class="lobby-info">
      <div class="lobby-name">${app.toUpperCase()}</div>
      <div class="lobby-enter" style="color:${isMaint ? "#ff6b35" : col}">${isMaint ? "🔧 Đang bảo trì" : isBcr ? "🎴 Chọn bàn →" : "Vào sảnh →"}</div>
    </div>`;
  c.onclick = () => {
    if (isMaint) { showToast("🔧 Sảnh này đang bảo trì!", "warn"); return; }
    if (isBcr) { openBcrTablePicker(app); return; }
    openGame(app);
  };
  setTimeout(() => c.classList.add("visible"), 50 * idx);
  return c;
}

function _renderLobbyCards(g, maint) {
  g.innerHTML = "";
  const txApps  = Object.keys(APIS_TX);
  const bcrApps = Object.keys(APIS_BCR);

  // ── SECTION: SẢnh TÀI XỈU ──
  const txGrid = document.createElement("div");
  txGrid.className = "lobby-section";
  txGrid.appendChild(_makeLobbySectionHeader("Sảnh Tài Xỉu", "🎲", "#ffd700"));
  const txCards = document.createElement("div");
  txCards.className = "lobbies lobby-grid-inner";
  txApps.forEach((app, i) => txCards.appendChild(_makelobbyCard(app, maint, i)));
  txGrid.appendChild(txCards);
  g.appendChild(txGrid);

  // ── SECTION: SẢnh BACCARAT ──
  const bcrGrid = document.createElement("div");
  bcrGrid.className = "lobby-section";
  bcrGrid.appendChild(_makeLobbySectionHeader("Sảnh Baccarat Sexy", "🎴", "#9b59b6"));
  const bcrCards = document.createElement("div");
  bcrCards.className = "lobbies lobby-grid-inner";
  bcrApps.forEach((app, i) => bcrCards.appendChild(_makelobbyCard(app, maint, txApps.length + i)));
  bcrGrid.appendChild(bcrCards);
  g.appendChild(bcrGrid);
}

function getLobbyAccBadgeHtml(app) {
  let totalD = 0, totalS = 0;
  const appStat = window._statData?.[app];
  if (appStat) {
    // Gom tất cả labels (TX theo api.label, BCR theo banId hoặc "Baccarat")
    Object.values(appStat).forEach(st => {
      if (st && typeof st.d === "number") { totalD += st.d; totalS += st.s; }
    });
  }
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
async function openGame(app) {
  // Cancel BCR retry timer nếu đang pending — tránh leak doFetchBcr vào TX view
  if (window._bcrRetryTimer) { clearTimeout(window._bcrRetryTimer); window._bcrRetryTimer = null; }
  window._bcrSelectedTable = null;
  // FIX: luôn check maintenance realtime từ Supabase trước khi vào
  const underMaint = await isUnderMaintenance(app);
  if (underMaint) {
    showToast("🔧 Sảnh đang bảo trì — Vui lòng thử lại sau!", "warn");
    // Refresh lobby để cập nhật badge bảo trì
    getMaintenance(true).then(maint => _renderLobbyCards(document.getElementById("lobby-grid"), maint)).catch(() => {});
    return;
  }
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
  // Clear UI cũ trước khi load sảnh mới
  const pbClear = document.getElementById("pred-body");
  const hubClear = document.getElementById("hub-hist-panel");
  const barClear = document.getElementById("pred-hist-bar");
  const phClear  = document.getElementById("pred-hist");
  if (pbClear)  pbClear.innerHTML  = `<div class="pred-loading"><span>⏳ Đang tải dữ liệu...</span></div>`;
  if (hubClear) hubClear.innerHTML = `<div class="hub-hist-empty">⏳ Đang chờ dữ liệu từ sảnh...</div>`;
  if (barClear) barClear.innerHTML = "";
  if (phClear)  phClear.classList.add("hidden");
  // Clear BCR mode flag khi vào TX
  const sumClear = document.getElementById("pred-hist-summary");
  if (sumClear) { sumClear.innerHTML = ""; sumClear.removeAttribute("data-mode"); }

  doFetch();
  clearInterval(window._fetchTimer);
  // FIX: poll 5s khi mới vào (chờ bot đẩy đủ data), sau 60s đổi về 15s
  window._fetchTimer = setInterval(doFetch, 5000);
  setTimeout(() => {
    if (window._curApp === app && window._fetchTimer) {
      clearInterval(window._fetchTimer);
      window._fetchTimer = setInterval(doFetch, 15000);
    }
  }, 60000);

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
    t.textContent = a.display || a.label;
    t.onclick = () => switchApi(i);
    tc.appendChild(t);
  });
}

function switchApi(i) {
  window._curApiIdx = i;
  document.querySelectorAll(".api-tab").forEach((t, j) => t.classList.toggle("active", j === i));
  // Clear UI cũ
  const pbSw = document.getElementById("pred-body");
  const hubSw = document.getElementById("hub-hist-panel");
  const barSw = document.getElementById("pred-hist-bar");
  const phSw  = document.getElementById("pred-hist");
  if (pbSw)  pbSw.innerHTML  = `<div class="pred-loading"><span>⏳ Đang tải dữ liệu...</span></div>`;
  if (hubSw) hubSw.innerHTML = `<div class="hub-hist-empty">⏳ Đang chờ dữ liệu từ sảnh...</div>`;
  if (barSw) barSw.innerHTML = "";
  if (phSw)  phSw.classList.add("hidden");
  // Restart realtime subscription cho api tab mới
  const app = window._curApp;
  if (app && APIS[app]?.[i]) {
    // FIX: cancel collecting retry khi đổi tab
    if (window._collectingRetry) { clearTimeout(window._collectingRetry); window._collectingRetry = null; }
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

// ══════════════════════════════════════════════════════════
//  LOAD DATA + DỰ ĐOÁN — Nguồn chính: tx_history_v2 (bot.py)
//  Flow: history_json (100 phiên) → ensemble predict → render
// ══════════════════════════════════════════════════════════
function _dbg() {}

async function supaLoadFallback(app, api) {
  const pb = document.getElementById("pred-body");
  try {
    // B1: Lấy history từ tx_history_v2
    const hist = await supaFetchHistory(app, api.label);
    const hasHist = hist && hist.history_json && hist.history_json.length > 0;

    if (!hasHist) {
      // Fallback: tx_results_v2
      const rows = await supaFetchResults(app, api.label, 100);
      if (!rows || rows.length === 0) {
        if (pb) pb.innerHTML = `<div class="pred-loading"><span>⏳ Bot chưa đẩy dữ liệu lên</span><br><small style="opacity:.6">Kiểm tra tool đang chạy chưa?</small><br><button onclick="doFetch()" style="margin-top:8px;padding:5px 14px;background:#7c3aed;border:none;border-radius:8px;color:#fff;cursor:pointer">🔄 Thử lại</button></div>`;
        return;
      }
      window._histData[app][api.label] = rows.map(r => ({
        phien: r.phien,
        ket_qua: normalizeKq(r.ket_qua),
        tong: r.tong,
        xuc_xac_1: r.xuc_xac_1, xuc_xac_2: r.xuc_xac_2, xuc_xac_3: r.xuc_xac_3,
        ket_qua_truyen_thong: normalizeKq(r.ket_qua_truyen_thong || r.ket_qua),
        ket_qua_chi_tiet: r.ket_qua_chi_tiet || "",
      }));
    } else {
      window._histData[app][api.label] = hist.history_json.map(r => ({
        phien: r.phien,
        ket_qua: normalizeKq(r.ket_qua),
        tong: r.tong,
        xuc_xac_1: r.xuc_xac_1, xuc_xac_2: r.xuc_xac_2, xuc_xac_3: r.xuc_xac_3,
        ket_qua_truyen_thong: normalizeKq(r.ket_qua_truyen_thong || r.ket_qua),
        ket_qua_chi_tiet: r.ket_qua_chi_tiet || "",
      }));
      if (hist.stats_json) {
        window._statData[app][api.label] = {
          d: hist.stats_json.dung || 0,
          s: hist.stats_json.sai  || 0
        };
      }
    }

    const histArr = window._histData[app][api.label] || [];
    const lastRec = histArr[histArr.length - 1];
    if (lastRec) window._lastPhien[app][api.label] = lastRec.phien;

    // B2: Render lịch sử
    renderHistBar(app, api);
    renderHubHist(app, api);
    updateLobbyAccBadge(app);

    // B3: Restore verdicts → stats đúng/sai sau reload
    try {
      const vRes = await fetch(
        `${SUPA_URL}/rest/v1/${DB_TABLES.verdicts}?app=eq.${encodeURIComponent(app)}&api_label=eq.${encodeURIComponent(api.label)}&order=created_at.desc&limit=100&select=phien,du_doan,ket_qua_thuc_te,dung`,
        { headers: _SH() }
      );
      if (vRes.ok) {
        const verdicts = await vRes.json();
        if (Array.isArray(verdicts) && verdicts.length > 0) {
          const logKey = app + "_" + api.label;
          if (!window._predLog) window._predLog = {};
          window._predLog[logKey] = [...verdicts].reverse().map(v => ({
            phien: v.phien,
            pred:   normalizeKq(v.du_doan),
            actual: normalizeKq(v.ket_qua_thuc_te),
            ok:     v.dung
          }));
          if (!hasHist || !hist.stats_json) {
            window._statData[app][api.label] = {
              d: verdicts.filter(v => v.dung).length,
              s: verdicts.filter(v => !v.dung).length,
            };
          }
        }
      }
    } catch(ve) {}

    // B4: Lấy và hiển thị dự đoán từ cloud
    const pred = await supaFetchLatestPred(app, api.label);
    if (pred && pred.du_doan) {
      supaRenderCloudPred(pred, app, api);
      window._pendingPred[app][api.label] = {
        pred: normalizeKq(pred.du_doan),
        pendingPhien: pred.phien
      };
    } else {
      // Không có cloud pred → tính local ensemble
      renderPred(app, api, null);
    }

  } catch(err) {
    if (pb) pb.innerHTML = `<div class="pred-loading"><span>⚠️ Lỗi kết nối</span><br><small style="opacity:.6">${err.message}</small><br><button onclick="doFetch()" style="margin-top:8px;padding:5px 14px;background:#7c3aed;border:none;border-radius:8px;color:#fff;cursor:pointer">🔄 Thử lại</button></div>`;
    console.error("[supaLoadFallback]", err);
  }
}

// Hiển thị dự đoán từ Supabase cloud
function supaRenderCloudPred(pred, app, api) {
  const pb = document.getElementById("pred-body");
  if (!pb) return;
  const rawDuDoan = pred.du_doan || "";
  const duDoan    = normalizeKq(rawDuDoan) || rawDuDoan;
  const emoji     = RE[duDoan] || "⬜";
  const cl        = RCL[duDoan] || "";
  const conf      = pred.do_tin_cay || 0;
  const confColor = conf >= 70 ? "#22c55e" : conf >= 55 ? "#ffd700" : "#ef4444";
  const nextPhien = pred.phien ? (parseInt(pred.phien) + 1) : "?";
  const timeStr   = pred.created_at ? new Date(pred.created_at).toLocaleTimeString("vi-VN") : "";
  const st        = window._statData[app]?.[api?.label] || { d: 0, s: 0 };
  const acc       = (st.d + st.s > 0) ? Math.round(st.d / (st.d + st.s) * 100) + "%" : "—";

  pb.innerHTML = `
    <div class="supa-pred-block">
      <div class="robot-gif-wrap">
        <img src="https://media.giphy.com/media/3oKIPnAiaMCws8nOsE/giphy.gif" class="robot-gif" alt="AI"
          onerror="this.src='https://media.giphy.com/media/l0HlBO7eyXzSZkJri/giphy.gif'"/>
      </div>
      <div class="ai-typing-wrap"><div class="ai-typing-text" id="ai-typing-text"></div></div>
      <div class="supa-pred-badge">🤖 AI KING DZI</div>
      <div class="pred-next-lbl">Dự đoán phiên #${nextPhien}</div>
      <div class="pred-emoji-big spin-on-change">${emoji}</div>
      <div class="pred-label ${cl}">${duDoan}</div>
      <div class="conf-bar-wrap">
        <div class="conf-bar-bg">
          <div class="conf-bar-fill" style="width:${conf}%;background:linear-gradient(90deg,${confColor},${confColor}88)"></div>
        </div>
        <div class="conf-pct-row">
          <span>Độ tin cậy</span>
          <span style="color:${confColor};font-weight:700">${conf}%</span>
        </div>
      </div>
      <div class="pred-stats-row">
        <div class="pred-stat">
          <div class="pred-stat-val" style="color:var(--accent)">${pred.votes || 0}/${pred.total_methods || 17}</div>
          <div class="pred-stat-lbl">Đồng thuận</div>
        </div>
        <div class="pred-stat">
          <div class="pred-stat-val">${acc}</div>
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
      <div class="algo-badge">🧠 ${pred.total_methods || 17} thuật toán · Ensemble AI</div>
      <div class="supa-pred-time">⏰ ${timeStr}</div>
      <button class="open-hist-btn" onclick="openHistModal('${app}','${api ? api.label : ''}','${api ? api.type : ''}')">📋 Lịch Sử Dự Đoán</button>
    </div>`;
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
    const actualKq = normalizeKq(isXD ? row.ket_qua_truyen_thong : row.ket_qua);
    const rec = {
      phien: row.phien, ket_qua: normalizeKq(row.ket_qua), tong: row.tong,
      xuc_xac_1: row.xuc_xac_1, xuc_xac_2: row.xuc_xac_2, xuc_xac_3: row.xuc_xac_3,
      ket_qua_truyen_thong: row.ket_qua_truyen_thong,
      ket_qua_chi_tiet: row.ket_qua_chi_tiet,
    };
    if (!window._histData[app]?.[api.label]) return;
    window._histData[app][api.label].push(rec);
    if (window._histData[app][api.label].length > 100) window._histData[app][api.label].shift();
    _dbg(`🔔 Realtime phiên mới #${row.phien} → ${actualKq} (total hist: ${window._histData[app][api.label].length})`);

    // So sánh dự đoán đang pending vs kết quả vừa về
    const pp = window._pendingPred[app]?.[api.label];
    if (pp && actualKq) {
      // Đảm bảo cả 2 đã được normalize trước khi so sánh
      const ppPredNorm = normalizeKq(pp.pred) || pp.pred;
      const actualNorm = normalizeKq(actualKq) || actualKq;
      const ok = ppPredNorm === actualNorm;
      _dbg(`⚖️ Verdict: pred="${ppPredNorm}" vs actual="${actualNorm}" → ${ok ? "✅ ĐÚNG" : "❌ SAI"}`);
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
    renderHubHist(app, api);
    // FIX: gọi renderPred sau khi có phiên mới — để thoát khỏi "Thu thập (x/5)..."
    renderPred(app, api, null);
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
    const predNorm = normalizeKq(row.du_doan) || row.du_doan;
    window._pendingPred[app][api.label] = { pred: predNorm, pendingPhien: curPhien };
    _dbg(`🔔 Realtime pred mới: raw="${row.du_doan}" norm="${predNorm}" conf=${row.do_tin_cay}%`);
    // TTS đọc dự đoán realtime
    if (window.TxTTS && row.du_doan && row.phien) {
      const nextP = parseInt(row.phien) + 1;
      try { window.TxTTS.announcePredict(nextP, predNorm, app); } catch(e) {}
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
    const ppNorm  = normalizeKq(pp.pred) || pp.pred;
    const aqNorm  = normalizeKq(actualKq) || actualKq;
    const ok = ppNorm === aqNorm;
    _dbg(`⚖️ processData verdict: pred="${ppNorm}" actual="${aqNorm}" → ${ok ? "✅" : "❌"}`);
    if (ok) window._statData[app][label].d++;
    else    window._statData[app][label].s++;
    verdict = { ok, pred: ppNorm, actual: aqNorm };
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
    if (window._histData[app][label].length > 100) window._histData[app][label].shift();
    _dbg(`📝 processData: phiên mới #${phien} ${actualKq} (total: ${window._histData[app][label].length})`);
  }
  renderPred(app, api, verdict);
  renderHistBar(app, api);
}

function getKq(r, isXD) { const raw = isXD ? r.ket_qua_truyen_thong : r.ket_qua; return normalizeKq(raw); }

// ── RENDER HISTORY BAR ─────────────────────────────────────
function renderHistBar(app, api) {
  const isXD = api.type === "xocdia";
  const hist = window._histData[app]?.[api.label] || [];
  const ph   = document.getElementById("pred-hist");
  const bar  = document.getElementById("pred-hist-bar");
  if (!hist.length) { ph?.classList.add("hidden"); return; }
  ph?.classList.remove("hidden");
  // Cập nhật label header cho TX
  const lbl = ph?.querySelector(".pred-hist-label");
  if (lbl) lbl.textContent = isXD ? "Lịch sử Xóc Đĩa 14 phiên" : "Lịch sử 14 phiên";
  bar.innerHTML = "";
  
  const recent = hist.slice(-14);
  const lb = isXD ? ["Chẵn","Lẻ"] : ["Tài","Xỉu"];
  let tai = 0, xiu = 0;
  recent.forEach(r => {
    const k = getKq(r, isXD);
    if (!k || k === "?") return; // bỏ qua phiên chưa có kết quả
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
  // Nếu đang ở BCR mode thì không override summary
  if (summaryEl && summaryEl.getAttribute("data-mode") === "bcr") return;
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
  const FACE = { 1:"1", 2:"2", 3:"3", 4:"4", 5:"5", 6:"6" };
  let html = "";
  recent.forEach(r => {
    const kq = normalizeKq(isXD ? (r.ket_qua_truyen_thong || r.ket_qua) : r.ket_qua);
    const cl = RCL[kq] || "";
    const emoji = RE[kq] || "⬜";
    const d1 = r.xuc_xac_1 ? `<span class="dice-box">${r.xuc_xac_1}</span>` : "";
    const d2 = r.xuc_xac_2 ? `<span class="dice-box">${r.xuc_xac_2}</span>` : "";
    const d3 = r.xuc_xac_3 ? `<span class="dice-box">${r.xuc_xac_3}</span>` : "";
    const diceHtml = (d1||d2||d3) ? (d1+d2+d3) : `<span style="opacity:.35;font-size:11px">—</span>`;
    const tong = r.tong ? `Tổng: ${r.tong}` : "";
    const detail = r.ket_qua_chi_tiet || "";
    html += `
    <div class="hub-hist-row ${cl}">
      <div class="hub-hist-phien">#${r.phien}</div>
      <div class="hub-hist-dice">${diceHtml}</div>
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
  const results = hist.map(r => getKq(r, isXD)).filter(r => r && lb.includes(r));
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

  if (results.length < 3) {
    pb.innerHTML = `${verdictHtml}<div class="pred-loading"><div class="loading-orbit"><div class="orbit-ring"></div><div class="orbit-dot"></div></div><span>Thu thập dữ liệu (${results.length}/3)...</span><small style="display:block;opacity:.6;margin-top:6px">Bot đang đẩy dữ liệu lên — tự động cập nhật...</small></div>`;
    // FIX: auto-retry sau 5s thay vì chờ 15s timer hoặc user bấm
    if (!window._collectingRetry) {
      window._collectingRetry = setTimeout(() => {
        window._collectingRetry = null;
        if (window._curApp === app) doFetch();
      }, 5000);
    }
    return;
  }
  // Clear retry khi đã đủ data
  if (window._collectingRetry) { clearTimeout(window._collectingRetry); window._collectingRetry = null; }

    const _ep = typeof ensemblePredict === "function" ? ensemblePredict : (typeof window.ensemblePredict === "function" ? window.ensemblePredict : null);
  if (!_ep) { if (pb) pb.innerHTML = "<div class=\"pred-loading\">⚠️ Lỗi tải thuật toán AI. Vui lòng tải lại trang!</div>"; return; }
  const { best, conf, votes, total, topM, topAcc } = _ep(results, lb);
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
async function openHistModal(app, label, type) {
  const isXD = type === "xocdia";
  const hist = window._histData[app]?.[label] || [];
  const st   = window._statData[app]?.[label] || { d: 0, s: 0 };
  const logKey = app + "_" + label;

  // Nếu predLog rỗng → thử fetch verdicts từ Supabase
  if (!window._predLog) window._predLog = {};
  if (!window._predLog[logKey] || window._predLog[logKey].length === 0) {
    try {
      const table = (app === "bcr") ? DB_TABLES.bcrVerdicts : DB_TABLES.verdicts;
      const orderBy = (app === "bcr") ? "updated_at" : "created_at";
      const selectCols = (app === "bcr") ? "ban,du_doan,ket_qua_thuc_te,dung,updated_at" : "phien,du_doan,ket_qua_thuc_te,dung";
      // FIX: BCR filter theo ban cụ thể nếu label có dạng "Ban_C11"
      const bcrBanId = (app === "bcr" && label.startsWith("Ban_")) ? label.replace("Ban_", "") : null;
      const filterLabel = (app === "bcr") ? (bcrBanId ? `&ban=eq.${encodeURIComponent(bcrBanId)}` : "") : `&api_label=eq.${encodeURIComponent(label)}`;
      const vRes = await fetch(
        `${SUPA_URL}/rest/v1/${table}?app=eq.${encodeURIComponent(app)}${filterLabel}&order=${orderBy}.desc&limit=100&select=${selectCols}`,
        { headers: _SH() }
      );
      if (vRes.ok) {
        const rows = await vRes.json();
        if (Array.isArray(rows) && rows.length > 0) {
          window._predLog[logKey] = [...rows].reverse().map(v => ({
            phien:  String(v.phien || v.ban || "-"),
            pred:   normalizeKq(v.du_doan),
            actual: normalizeKq(v.ket_qua_thuc_te),
            ok:     v.dung
          }));
          // Update stats
          const d = rows.filter(v => v.dung).length;
          const s = rows.filter(v => !v.dung).length;
          if (d + s > 0) window._statData[app][label] = { d, s };
        }
      }
    } catch(e) {}
  }

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
