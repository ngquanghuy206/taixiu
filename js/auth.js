// ═══════════════════════════════════════════════════════════
//  AUTH + DEVICE LOCK  |  Tài Xỉu AI  — data lưu Supabase
// ═══════════════════════════════════════════════════════════

const _SH = () => ({
  "apikey":        SUPA_KEY,
  "Authorization": `Bearer ${SUPA_KEY}`,
  "Content-Type":  "application/json",
});

// ── USERS (Supabase) ────────────────────────────────────────
async function getUsers() {
  try {
    const r = await fetch(`${SUPA_URL}/rest/v1/tx_users?select=*&order=created_at.asc`, { headers: _SH() });
    if (!r.ok) { console.error("getUsers lỗi:", await r.text()); return []; }
    return await r.json();
  } catch(e) { console.error("getUsers exception:", e); return []; }
}

async function saveUser(obj) {
  const r = await fetch(`${SUPA_URL}/rest/v1/tx_users`, {
    method: "POST",
    headers: { ..._SH(), "Prefer": "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify(obj),
  });
  if (!r.ok) console.error("saveUser lỗi:", await r.text());
}

async function deleteUser(username) {
  await fetch(`${SUPA_URL}/rest/v1/tx_users?username=eq.${encodeURIComponent(username)}`, {
    method: "DELETE", headers: _SH(),
  });
}

// ── IPMAP / DEVICE (Supabase) ───────────────────────────────
async function getDeviceList(username) {
  try {
    const r = await fetch(`${SUPA_URL}/rest/v1/tx_ipmap?username=eq.${encodeURIComponent(username)}&select=devices`, { headers: _SH() });
    if (!r.ok) return [];
    const rows = await r.json();
    return rows[0]?.devices || [];
  } catch { return []; }
}

async function saveDeviceList(username, devices) {
  const r = await fetch(`${SUPA_URL}/rest/v1/tx_ipmap`, {
    method: "POST",
    headers: { ..._SH(), "Prefer": "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify({ username, devices }),
  });
  if (!r.ok) console.error("saveDeviceList lỗi:", await r.text());
}

async function resetDeviceList(username) {
  await fetch(`${SUPA_URL}/rest/v1/tx_ipmap?username=eq.${encodeURIComponent(username)}`, {
    method: "DELETE", headers: _SH(),
  });
}

// ── LẤY IP THỰC ────────────────────────────────────────────
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

// ── COUNTDOWN TIMER ────────────────────────────────────────
window._expireTimer = null;
window._expireAt    = null;

function startExpireCountdown(expiresISO) {
  window._expireAt = new Date(expiresISO).getTime();
  if (window._expireTimer) clearInterval(window._expireTimer);
  window._expireTimer = setInterval(() => {
    const left = window._expireAt - Date.now();
    const el = document.getElementById("user-countdown");
    if (el) el.textContent = left > 0 ? formatTimeLeft(left) : "Đã hết hạn";
    if (left <= 0) {
      clearInterval(window._expireTimer);
      window._expireTimer = null;
      doLogout(true);
    }
  }, 1000);
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

  // Luôn reset nút nếu có lỗi bất kỳ
  try {
    // Admin bypass
    if (u === ADMIN_USER && p === ADMIN_PASS) {
      window._curUser  = u;
      window._isAdmin  = true;
      window._expireAt = null;
      getClientIP().then(ip => { window._clientIP = ip; }).catch(() => {});
      await animateLogin();
      btn.disabled = false;
      btn.innerHTML = "ĐĂNG NHẬP";
      try { launchApp(); } catch(err) {
        showAuthErr("⚠️ Lỗi khởi động app. Vui lòng thử lại!");
      }
      return;
    }

    // Lấy danh sách user từ Supabase (timeout 8s)
    let users = [];
    try {
      const ctrl = new AbortController();
      const tid  = setTimeout(() => ctrl.abort(), 8000);
      const r = await fetch(`${SUPA_URL}/rest/v1/tx_users?select=*`, {
        headers: _SH(), signal: ctrl.signal
      });
      clearTimeout(tid);
      if (r.ok) users = await r.json();
      else { showAuthErr("⚠️ Không kết nối được server. Thử lại!"); btn.disabled = false; btn.innerHTML = "ĐĂNG NHẬP"; return; }
    } catch(e) {
      showAuthErr("⚠️ Mất kết nối server. Kiểm tra mạng rồi thử lại!");
      btn.disabled = false; btn.innerHTML = "ĐĂNG NHẬP"; return;
    }

    const acc = users.find(x => x.username === u && x.password === p);

    if (!acc) {
      showAuthErr("Tài khoản hoặc mật khẩu không đúng ❌");
      btn.disabled = false; btn.innerHTML = "ĐĂNG NHẬP"; return;
    }
    if (new Date(acc.expires) < new Date()) {
      showAuthErr("Tài khoản đã hết hạn sử dụng ⏰\nVui lòng liên hệ admin để gia hạn.");
      btn.disabled = false; btn.innerHTML = "ĐĂNG NHẬP"; return;
    }

    // Device check
    const ip     = await getClientIP();
    const maxDev = acc.max_devices || 1;
    let devList  = await getDeviceList(u);
    if (!devList.includes(ip)) {
      if (devList.length >= maxDev) {
        showAuthErr(`⚠️ Tài khoản chỉ dùng được trên ${maxDev} thiết bị!\nLiên hệ admin để được hỗ trợ.`);
        btn.disabled = false; btn.innerHTML = "ĐĂNG NHẬP"; return;
      }
      devList.push(ip);
      await saveDeviceList(u, devList);
    }

    window._curUser     = u;
    window._isAdmin     = false;
    window._clientIP    = ip;
    window._userExpires = acc.expires;
    window._expireAt    = new Date(acc.expires).getTime();
    await animateLogin();
    btn.disabled = false;
    btn.innerHTML = "ĐĂNG NHẬP";
    try {
      launchApp();
      startExpireCountdown(acc.expires);
      const usedDev = devList.length;
      setTimeout(() => {
        showToast(`📱 Tài khoản dùng được tối đa ${maxDev} thiết bị · Đang dùng: ${usedDev}/${maxDev}`, "ok");
      }, 800);
    } catch(err) {
      console.error("[doLogin] launchApp lỗi:", err);
      showAuthErr("⚠️ Lỗi khởi động app. Vui lòng thử lại!");
    }

  } catch(err) {
    // Catch all — đảm bảo nút luôn được reset
    console.error("[doLogin] lỗi không xác định:", err);
    showAuthErr("⚠️ Lỗi không xác định. Vui lòng thử lại!");
    btn.disabled = false;
    btn.innerHTML = "ĐĂNG NHẬP";
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
  window._curUser  = null;
  window._isAdmin  = false;
  window._expireAt = null;
  document.getElementById("app").style.display = "none";
  document.getElementById("auth-screen").style.display = "flex";
  document.getElementById("inp-user").value = "";
  document.getElementById("inp-pass").value = "";
  document.getElementById("login-btn").disabled = false;
  document.getElementById("login-btn").innerHTML = "ĐĂNG NHẬP";
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
let _editIdx    = -1;
let _cachedUsers = [];

window._adminTableTimer = null;

async function renderUsers() {
  if (window._adminTableTimer) { clearInterval(window._adminTableTimer); window._adminTableTimer = null; }
  _cachedUsers = await getUsers();
  _doRenderUsers();
  window._adminTableTimer = setInterval(_doRenderUsers, 1000);
}

function _doRenderUsers() {
  const users = _cachedUsers;
  const tb = document.getElementById("user-list");
  if (!tb) { clearInterval(window._adminTableTimer); return; }
  tb.innerHTML = "";

  if (!users.length) {
    tb.innerHTML = `<tr><td colspan="5" class="empty-row">Chưa có tài khoản nào</td></tr>`;
    return;
  }

  users.forEach((u, i) => {
    const exp  = new Date(u.expires);
    const left = exp - new Date();
    const ok   = left > 0;
    const maxDev  = u.max_devices || 1;
    const timeStr = ok ? formatTimeLeft(left) : "—";
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><strong>${u.username}</strong></td>
      <td><span class="sbadge ${ok ? "active" : "expired"}">${ok ? "Hoạt động" : "Hết hạn"}</span></td>
      <td class="time-cell ${ok ? (left < 3600000 ? "time-danger" : left < 86400000 ? "time-warn" : "") : "time-expired"}">${timeStr}</td>
      <td style="text-align:center;font-size:12px;color:#ffd700">📱 ${maxDev}</td>
      <td class="actions-cell">
        <button class="act-btn edit" onclick="openEdit(${i})" title="Sửa">✏️</button>
        ${!ok ? `<button class="act-btn renew" onclick="openRenew(${i})" title="Gia hạn">🔁</button>` : ""}
        <button class="act-btn ip-reset" onclick="resetIP('${u.username}')" title="Reset thiết bị">🔄</button>
        <button class="act-btn del" onclick="delUser(${i})" title="Xoá">🗑️</button>
      </td>`;
    tb.appendChild(tr);
  });

  document.getElementById("user-count").textContent  = users.length;
  document.getElementById("active-count").textContent = users.filter(u => new Date(u.expires) > new Date()).length;
}

async function resetIP(username) {
  if (!confirm(`Reset thiết bị cho tài khoản "${username}"?\nSau khi reset, tài khoản có thể đăng nhập từ thiết bị mới.`)) return;
  await resetDeviceList(username);
  showToast(`✅ Đã reset thiết bị cho ${username}`);
}

function openCreate() {
  _editIdx = -1;
  document.getElementById("modal-title").textContent = "TẠO TÀI KHOẢN MỚI";
  document.getElementById("m-user").value    = "";
  document.getElementById("m-pass").value    = "";
  document.getElementById("m-days").value    = "30";
  document.getElementById("m-devices").value = "1";
  document.getElementById("m-orig-expires").value = "";
  document.getElementById("modal-overlay").classList.remove("hidden");
  setTimeout(() => document.getElementById("m-user").focus(), 100);
}

function openEdit(i) {
  _editIdx = i;
  const u = _cachedUsers[i];
  document.getElementById("modal-title").textContent = "CHỈNH SỬA TÀI KHOẢN";
  document.getElementById("m-user").value    = u.username;
  document.getElementById("m-pass").value    = u.password;
  document.getElementById("m-devices").value = u.max_devices || 1;
  document.getElementById("m-orig-expires").value = u.expires;
  const left = new Date(u.expires) - new Date();
  document.getElementById("m-days").value = left > 0 ? Math.round(left / 86400000) : 0;
  document.getElementById("modal-overlay").classList.remove("hidden");
}

function closeModal() { document.getElementById("modal-overlay").classList.add("hidden"); }

async function submitUser() {
  const u   = document.getElementById("m-user").value.trim();
  const p   = document.getElementById("m-pass").value.trim();
  const d   = parseInt(document.getElementById("m-days").value) || 30;
  const dev = parseInt(document.getElementById("m-devices").value) || 1;
  if (!u || !p) { showToast("⚠️ Vui lòng điền đầy đủ", "warn"); return; }

  let exp;
  if (_editIdx >= 0) {
    // Giữ expires gốc nếu admin không đổi số ngày
    const origExpires = document.getElementById("m-orig-expires").value;
    const origLeft    = new Date(origExpires) - new Date();
    const origDays    = origLeft > 0 ? Math.round(origLeft / 86400000) : 0;
    exp = (d !== origDays)
      ? new Date(Date.now() + d * 86400000).toISOString()
      : origExpires;
    showToast(`✅ Đã cập nhật tài khoản ${u}`);
  } else {
    exp = new Date(Date.now() + d * 86400000).toISOString();
    showToast(`✅ Đã tạo tài khoản ${u} · ${dev} thiết bị · ${d} ngày`);
  }

  await saveUser({ username: u, password: p, expires: exp, max_devices: dev });
  closeModal();
  _cachedUsers = await getUsers();
  _doRenderUsers();
}

async function delUser(i) {
  const u = _cachedUsers[i];
  if (!confirm(`Xoá tài khoản "${u.username}"?`)) return;
  await deleteUser(u.username);
  await resetDeviceList(u.username);
  showToast(`🗑️ Đã xoá ${u.username}`);
  _cachedUsers = await getUsers();
  _doRenderUsers();
}

function openRenew(i) {
  const u = _cachedUsers[i];
  document.getElementById("renew-title").textContent = `GIA HẠN — ${u.username.toUpperCase()}`;
  document.getElementById("renew-days").value = "30";
  document.getElementById("renew-overlay").dataset.idx = i;
  document.getElementById("renew-overlay").classList.remove("hidden");
  setTimeout(() => document.getElementById("renew-days").focus(), 100);
}

function closeRenewModal() { document.getElementById("renew-overlay").classList.add("hidden"); }

async function submitRenew() {
  const i = parseInt(document.getElementById("renew-overlay").dataset.idx);
  const d = parseInt(document.getElementById("renew-days").value) || 30;
  if (d < 1) { showToast("⚠️ Số ngày phải lớn hơn 0", "warn"); return; }
  const u = _cachedUsers[i];
  u.expires = new Date(Date.now() + d * 86400000).toISOString();
  await saveUser(u);
  closeRenewModal();
  showToast(`✅ Đã gia hạn ${u.username} thêm ${d} ngày`);
  _cachedUsers = await getUsers();
  _doRenderUsers();
}


function showToast(msg, type = "ok") {
  let t = document.getElementById("toast");
  if (!t) { t = document.createElement("div"); t.id = "toast"; document.body.appendChild(t); }
  t.textContent = msg;
  t.className = "toast show " + type;
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove("show"), 3000);
}
