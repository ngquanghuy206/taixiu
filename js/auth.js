// ═══════════════════════════════════════════════════════════
//  AUTH + IP LOCK  |  Tài Xỉu AI
// ═══════════════════════════════════════════════════════════

// Lấy/lưu users từ localStorage
function getUsers()   { return JSON.parse(localStorage.getItem("tx_users") || "[]"); }
function saveUsers(u) { localStorage.setItem("tx_users", JSON.stringify(u)); }

// Lấy IP thực của người dùng (async)
async function getClientIP() {
  try {
    const r = await fetch("https://api.ipify.org?format=json", { signal: AbortSignal.timeout(2500) });
    const d = await r.json();
    return d.ip || "unknown";
  } catch {
    const fp = navigator.userAgent + screen.width + screen.height + navigator.language;
    return "fp_" + btoa(fp).slice(0, 16);
  }
}

// Lấy bản đồ IP đã bind { username: ip }
function getIPMap()   { return JSON.parse(localStorage.getItem("tx_ipmap") || "{}"); }
function saveIPMap(m) { localStorage.setItem("tx_ipmap", JSON.stringify(m)); }

// ── FORMAT THỜI GIAN CÒN LẠI ──────────────────────────────
function formatTimeLeft(ms) {
  if (ms <= 0) return "00:00:00";
  const totalSec = Math.floor(ms / 1000);
  const d = Math.floor(totalSec / 86400);
  const h = Math.floor((totalSec % 86400) / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const hms = [h,m,s].map(v => String(v).padStart(2,"0")).join(":");
  return d > 0 ? `${d} ngày ${hms}` : hms;
}

// ── COUNTDOWN TIMER (chạy khi user đang dùng) ─────────────
window._expireTimer = null;
window._expireAt    = null;

function startExpireCountdown(expiresISO) {
  window._expireAt = new Date(expiresISO).getTime();
  if (window._expireTimer) clearInterval(window._expireTimer);
  window._expireTimer = setInterval(() => {
    const left = window._expireAt - Date.now();
    // Cập nhật sidebar
    const el = document.getElementById("user-countdown");
    if (el) el.textContent = left > 0 ? formatTimeLeft(left) : "Đã hết hạn";
    // Tự đăng xuất khi hết hạn
    if (left <= 0) {
      clearInterval(window._expireTimer);
      window._expireTimer = null;
      doLogout(true); // true = expired
    }
  }, 1000);
  // Cập nhật ngay lần đầu
  const el = document.getElementById("user-countdown");
  if (el) el.textContent = formatTimeLeft(window._expireAt - Date.now());
}

function stopExpireCountdown() {
  if (window._expireTimer) { clearInterval(window._expireTimer); window._expireTimer = null; }
  window._expireAt = null;
}

// ── ĐĂNG NHẬP ──────────────────────────────────────────────
async function doLogin() {
  const u   = document.getElementById("inp-user").value.trim();
  const p   = document.getElementById("inp-pass").value.trim();
  const btn = document.getElementById("login-btn");

  if (!u || !p) { showAuthErr("Vui lòng nhập đầy đủ thông tin"); return; }

  btn.disabled = true;
  btn.innerHTML = `<span class="btn-spin"></span> Đang xác thực...`;

  // Admin bypass
  if (u === ADMIN_USER && p === ADMIN_PASS) {
    window._curUser  = u;
    window._isAdmin  = true;
    window._expireAt = null;
    // Không await getClientIP (có thể chậm) — lấy sau
    getClientIP().then(ip => { window._clientIP = ip; }).catch(() => {});
    await animateLogin();
    btn.disabled = false;
    btn.innerHTML = "ĐĂNG NHẬP";
    try {
      launchApp();
    } catch(err) {
      console.error("[doLogin admin] launchApp lỗi:", err);
      showAuthErr("⚠️ Lỗi khởi động app. Vui lòng thử lại!");
    }
    return;

  }

  const users = getUsers();
  const acc   = users.find(x => x.username === u && x.password === p);

  if (!acc) {
    showAuthErr("Tài khoản hoặc mật khẩu không đúng ❌");
    btn.disabled = false; btn.innerHTML = "ĐĂNG NHẬP"; return;
  }
  if (new Date(acc.expires) < new Date()) {
    showAuthErr("Tài khoản đã hết hạn sử dụng ⏰\nVui lòng liên hệ admin để gia hạn.");
    btn.disabled = false; btn.innerHTML = "ĐĂNG NHẬP"; return;
  }

  // IP / Device check — hỗ trợ maxDevices
  const ip      = await getClientIP();
  const ipMap   = getIPMap();
  const maxDev  = acc.maxDevices || 1;
  // ipMap[u] có thể là string (cũ) hoặc array (mới)
  let devList = ipMap[u];
  if (!devList) devList = [];
  else if (typeof devList === "string") devList = [devList]; // migrate data cũ
  if (!devList.includes(ip)) {
    if (devList.length >= maxDev) {
      showAuthErr(`⚠️ Tài khoản chỉ dùng được trên ${maxDev} thiết bị!\nLiên hệ admin để được hỗ trợ.`);
      btn.disabled = false; btn.innerHTML = "ĐĂNG NHẬP"; return;
    }
    devList.push(ip);
    ipMap[u] = devList;
    saveIPMap(ipMap);
  }

  window._curUser  = u;
  window._isAdmin  = false;
  window._clientIP = ip;
  window._userExpires = acc.expires;
  // Phải set _expireAt TRƯỚC launchApp() để topbar countdown hoạt động
  window._expireAt = new Date(acc.expires).getTime();
  await animateLogin();
  // Reset button trước khi launch (phòng lỗi launchApp làm đơ UI)
  btn.disabled = false;
  btn.innerHTML = "ĐĂNG NHẬP";
  try {
    launchApp();
    startExpireCountdown(acc.expires);
    // Thông báo thiết bị sau khi vào app
    const usedDev = devList.length;
    setTimeout(() => {
      showToast(`📱 Tài khoản này được dùng tối đa ${maxDev} thiết bị · Đang dùng: ${usedDev}/${maxDev}`, "ok");
    }, 800);
  } catch(err) {
    console.error("[doLogin] launchApp lỗi:", err);
    showAuthErr("⚠️ Lỗi khởi động app. Vui lòng thử lại!");
  }
}

function showAuthErr(msg) {
  const el = document.getElementById("auth-err");
  el.textContent = msg;
  el.style.opacity = "0";
  el.style.transform = "translateY(-6px)";
  requestAnimationFrame(() => {
    el.style.transition = "all .3s";
    el.style.opacity = "1";
    el.style.transform = "translateY(0)";
  });
}

async function animateLogin() {
  return new Promise(res => {
    document.getElementById("login-btn").innerHTML = `✅ Thành công!`;
    setTimeout(res, 700);
  });
}

function doLogout(expired = false) {
  stopExpireCountdown();
  if (window._fetchTimer) { clearInterval(window._fetchTimer); window._fetchTimer = null; }
  const iframe = document.getElementById("game-iframe");
  if (iframe) iframe.src = "about:blank";
  window._curUser = null;
  window._isAdmin = false;
  window._expireAt = null;
  document.getElementById("app").style.display = "none";
  document.getElementById("auth-screen").style.display = "flex";
  document.getElementById("inp-user").value = "";
  document.getElementById("inp-pass").value = "";
  document.getElementById("login-btn").disabled = false;
  document.getElementById("login-btn").innerHTML = "ĐĂNG NHẬP";
  // Reset topbar
  const ud = document.getElementById("user-display");
  if (ud) ud.innerHTML = "";
  const te = document.getElementById("topbar-expire");
  if (te) { te.style.display = "none"; te.textContent = ""; }
  if (expired) {
    showAuthErr("⏰ Tài khoản đã hết hạn sử dụng.\nVui lòng liên hệ admin để gia hạn.");
  } else {
    document.getElementById("auth-err").textContent = "";
  }
}

// ── ADMIN: QUẢN LÝ USER ────────────────────────────────────
let _editIdx = -1;

// Live countdown interval cho bảng admin
window._adminTableTimer = null;

function renderUsers() {
  if (window._adminTableTimer) { clearInterval(window._adminTableTimer); window._adminTableTimer = null; }
  _doRenderUsers();
  // Cập nhật countdown mỗi giây
  window._adminTableTimer = setInterval(_doRenderUsers, 1000);
}

function _doRenderUsers() {
  const users = getUsers();
  const tb = document.getElementById("user-list");
  if (!tb) { clearInterval(window._adminTableTimer); return; }
  tb.innerHTML = "";

  if (!users.length) {
    tb.innerHTML = `<tr><td colspan="6" class="empty-row">Chưa có tài khoản nào</td></tr>`;
    return;
  }

  users.forEach((u, i) => {
    const exp   = new Date(u.expires);
    const left  = exp - new Date();
    const ok    = left > 0;
    const ipMap   = getIPMap();
    let devList   = ipMap[u.username];
    if (typeof devList === "string") devList = [devList];
    const usedDev = Array.isArray(devList) ? devList.length : 0;
    const maxDev  = u.maxDevices || 1;
    const timeStr = ok ? formatTimeLeft(left) : "—";
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><strong>${u.username}</strong></td>
      <td><span class="sbadge ${ok ? "active" : "expired"}">${ok ? "Hoạt động" : "Hết hạn"}</span></td>
      <td class="time-cell ${ok ? (left < 3600000 ? "time-danger" : left < 86400000 ? "time-warn" : "") : "time-expired"}">${timeStr}</td>
      <td style="text-align:center;font-size:12px"><span style="color:${usedDev>=maxDev?"#ef4444":"#22c55e"}">${usedDev}</span>/<span style="color:#ffd700">${maxDev}</span> 📱</td>
      <td class="actions-cell">
        <button class="act-btn edit" onclick="openEdit(${i})" title="Sửa">✏️</button>
        ${!ok ? `<button class="act-btn renew" onclick="openRenew(${i})" title="Gia hạn">🔁</button>` : ""}
        <button class="act-btn ip-reset" onclick="resetIP('${u.username}')" title="Reset thiết bị">🔄</button>
        <button class="act-btn del" onclick="delUser(${i})" title="Xoá">🗑️</button>
      </td>`;
    tb.appendChild(tr);
  });

  document.getElementById("user-count").textContent = users.length;
  document.getElementById("active-count").textContent = users.filter(u => new Date(u.expires) > new Date()).length;
}

function resetIP(username) {
  const ipMap   = getIPMap();
  const devList = ipMap[username];
  const count   = Array.isArray(devList) ? devList.length : (devList ? 1 : 0);
  if (!confirm(`Reset thiết bị cho tài khoản "${username}"?\nHiện đang bind ${count} thiết bị.\nSau khi reset, tài khoản có thể đăng nhập từ thiết bị mới.`)) return;
  delete ipMap[username];
  saveIPMap(ipMap);
  showToast(`✅ Đã reset thiết bị cho ${username}`);
  renderUsers();
}

function openCreate() {
  _editIdx = -1;
  document.getElementById("modal-title").textContent = "TẠO TÀI KHOẢN MỚI";
  document.getElementById("m-user").value = "";
  document.getElementById("m-pass").value = "";
  document.getElementById("m-days").value = "30";
  document.getElementById("m-devices").value = "1";
  document.getElementById("m-orig-expires").value = "";
  document.getElementById("modal-overlay").classList.remove("hidden");
  setTimeout(() => document.getElementById("m-user").focus(), 100);
}

function openEdit(i) {
  _editIdx = i;
  const u = getUsers()[i];
  document.getElementById("modal-title").textContent = "CHỈNH SỬA TÀI KHOẢN";
  document.getElementById("m-user").value = u.username;
  document.getElementById("m-pass").value = u.password;
  // Lưu expires gốc vào hidden field để không bị tính lại sai
  document.getElementById("m-orig-expires").value = u.expires;
  // Hiển thị số ngày còn lại thực tế (không được tính lại khi submit)
  const left = new Date(u.expires) - new Date();
  const d = left > 0 ? Math.round(left / 86400000) : 0;
  document.getElementById("m-days").value = d;
  document.getElementById("modal-overlay").classList.remove("hidden");
}

function closeModal() { document.getElementById("modal-overlay").classList.add("hidden"); }

function submitUser() {
  const u = document.getElementById("m-user").value.trim();
  const p = document.getElementById("m-pass").value.trim();
  const d = parseInt(document.getElementById("m-days").value) || 30;
  if (!u || !p) { showToast("⚠️ Vui lòng điền đầy đủ", "warn"); return; }
  const users = getUsers();
  if (_editIdx >= 0) {
    // Khi EDIT: giữ nguyên expires gốc, không tính lại từ Date.now()
    // Chỉ tính lại nếu admin thay đổi số ngày khác với ngày còn lại hiện tại
    const origExpires = document.getElementById("m-orig-expires").value;
    const origLeft    = new Date(origExpires) - new Date();
    const origDays    = origLeft > 0 ? Math.round(origLeft / 86400000) : 0;
    const exp = (d !== origDays)
      ? new Date(Date.now() + d * 86400000).toISOString()  // admin đổi số ngày → tính lại
      : origExpires;                                         // giữ nguyên expires gốc
    const maxDevices = parseInt(document.getElementById("m-devices").value) || 1;
    users[_editIdx] = { ...users[_editIdx], username: u, password: p, expires: exp, maxDevices };
    showToast(`✅ Đã cập nhật tài khoản ${u}`);
  } else {
    if (users.find(x => x.username === u)) { showToast("⚠️ Tài khoản đã tồn tại!", "warn"); return; }
    const exp = new Date(Date.now() + d * 86400000).toISOString();
    const maxDevices = parseInt(document.getElementById("m-devices").value) || 1;
    users.push({ username: u, password: p, expires: exp, maxDevices });
    showToast(`✅ Đã tạo tài khoản ${u} · ${maxDevices} thiết bị · ${d} ngày`);
  }
  saveUsers(users);
  closeModal();
  renderUsers();
}

function delUser(i) {
  const u = getUsers()[i];
  if (!confirm(`Xoá tài khoản "${u.username}"?`)) return;
  const users = getUsers();
  users.splice(i, 1);
  saveUsers(users);
  const ipMap = getIPMap();
  delete ipMap[u.username];
  saveIPMap(ipMap);
  showToast(`🗑️ Đã xoá ${u.username}`);
  renderUsers();
}

function openRenew(i) {
  const u = getUsers()[i];
  document.getElementById("renew-title").textContent = `GIA HẠN — ${u.username.toUpperCase()}`;
  document.getElementById("renew-days").value = "30";
  document.getElementById("renew-overlay").dataset.idx = i;
  document.getElementById("renew-overlay").classList.remove("hidden");
  setTimeout(() => document.getElementById("renew-days").focus(), 100);
}

function closeRenewModal() { document.getElementById("renew-overlay").classList.add("hidden"); }

function submitRenew() {
  const i = parseInt(document.getElementById("renew-overlay").dataset.idx);
  const d = parseInt(document.getElementById("renew-days").value) || 30;
  if (d < 1) { showToast("⚠️ Số ngày phải lớn hơn 0", "warn"); return; }
  const users = getUsers();
  const u = users[i];
  // Gia hạn từ thời điểm hiện tại
  u.expires = new Date(Date.now() + d * 86400000).toISOString();
  saveUsers(users);
  closeRenewModal();
  showToast(`✅ Đã gia hạn ${u.username} thêm ${d} ngày`);
  renderUsers();
}

function showToast(msg, type = "ok") {
  let t = document.getElementById("toast");
  if (!t) { t = document.createElement("div"); t.id = "toast"; document.body.appendChild(t); }
  t.textContent = msg;
  t.className = "toast show " + type;
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove("show"), 3000);
}
