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

// ── LAUNCH APP ─────────────────────────────────────────────
function launchApp() {
  document.getElementById("auth-screen").style.display = "none";
  const app = document.getElementById("app");
  app.style.display = "flex";
  app.style.flexDirection = "column";
  document.getElementById("nav-admin").style.display = window._isAdmin ? "flex" : "none";
  document.getElementById("user-display").textContent = window._curUser;
  buildLobbies();
  showHome();
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
  ["home","game","admin"].forEach(p => {
    const el = document.getElementById("page-" + p);
    if (!el) return;
    if (p === "game") el.style.display = name === "game" ? "flex" : "none";
    else if (p === "admin") el.style.display = name === "admin" ? "block" : "none";
    else el.style.display = name === "home" ? "block" : "none";
  });
}

function showHome() {
  clearInterval(window._fetchTimer); window._fetchTimer = null;
  const iframe = document.getElementById("game-iframe");
  if (iframe) iframe.src = "about:blank";
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
  closeSidebar();
  renderUsers();
}

function goHome() { showHome(); }

// ── LOBBIES ────────────────────────────────────────────────
function buildLobbies() {
  const g = document.getElementById("lobby-grid");
  g.innerHTML = "";
  Object.entries(APIS).forEach(([app, apis]) => {
    const em   = BRAND_EMOJI[app] || "🎰";
    const grad = BRAND_GRADIENT[app] || "linear-gradient(135deg,#1e2d42,#0e1520)";
    const col  = BRAND_COLOR[app] || "#00d4ff";
    const c    = document.createElement("div");
    c.className = "lobby-card";
    c.innerHTML = `
      <div class="lobby-banner" style="background:${grad}">
        <div class="lobby-banner-inner">
          <div class="lobby-emoji">${em}</div>
          <div class="lobby-glow-ring" style="border-color:${col}40"></div>
        </div>
        <div class="lobby-badge">${apis.length} API</div>
        <div class="lobby-particles">
          <span></span><span></span><span></span>
        </div>
      </div>
      <div class="lobby-info">
        <div class="lobby-name">${app.toUpperCase()}</div>
        <div class="lobby-apis">${apis.map(a => a.label).join(" · ")}</div>
        <div class="lobby-enter" style="color:${col}">Vào sảnh →</div>
      </div>`;
    c.onclick = () => openGame(app);
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

  // show calc animation
  showCalcEffect();
}

// ── IFRAME LOAD ────────────────────────────────────────────
function openLobbyTab() {
  const url = document.getElementById("iframe-msg-url").textContent;
  if (url && url !== "about:blank") window.open(url, "_blank");
}

function loadIframe(app) {
  const iframe  = document.getElementById("game-iframe");
  const blocker = document.getElementById("iframe-blocker");
  const url     = LOBBY_URLS[app] || "about:blank";
  blocker.classList.add("hidden");
  document.getElementById("iframe-msg-url").textContent = url;
  iframe.src = url;
  iframe.onload = () => {
    try { const w = iframe.contentWindow; blocker.classList.add("hidden"); } 
    catch { blocker.classList.remove("hidden"); }
  };
  iframe.onerror = () => blocker.classList.remove("hidden");
  setTimeout(() => {
    try {
      if (!iframe.contentDocument || iframe.contentDocument.URL === "about:blank")
        blocker.classList.remove("hidden");
    } catch { blocker.classList.remove("hidden"); }
  }, 4000);
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
async function doFetch() {
  if (!window._curApp) return;
  const api = APIS[window._curApp][window._curApiIdx];
  try {
    const r = await fetch(api.url, { signal: AbortSignal.timeout(8000) });
    if (!r.ok) throw new Error();
    const data = await r.json();
    processData(data, window._curApp, api);
  } catch {
    document.getElementById("pred-body").innerHTML = `<div class="pred-loading">⚠️ Lỗi kết nối — thử lại...</div>`;
  }
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
  hist.slice(-14).forEach(r => {
    const k = getKq(r, isXD) || "?";
    const d = document.createElement("div");
    d.className = "h-dot " + (RCL[k] || "");
    d.textContent = RE[k] || "?";
    bar.appendChild(d);
  });
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
