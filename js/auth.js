// ═══════════════════════════════════════════════════════════
//  AUTH + IP LOCK  |  Tài Xỉu AI
// ═══════════════════════════════════════════════════════════

// Lấy/lưu users từ localStorage
function getUsers()   { return JSON.parse(localStorage.getItem("tx_users") || "[]"); }
function saveUsers(u) { localStorage.setItem("tx_users", JSON.stringify(u)); }

// Lấy IP thực của người dùng (async)
async function getClientIP() {
  try {
    const r = await fetch("https://api.ipify.org?format=json", { signal: AbortSignal.timeout(4000) });
    const d = await r.json();
    return d.ip || "unknown";
  } catch {
    // fallback: tạo fingerprint từ trình duyệt
    const fp = navigator.userAgent + screen.width + screen.height + navigator.language;
    return "fp_" + btoa(fp).slice(0, 16);
  }
}

// Lấy bản đồ IP đã bind { username: ip }
function getIPMap()   { return JSON.parse(localStorage.getItem("tx_ipmap") || "{}"); }
function saveIPMap(m) { localStorage.setItem("tx_ipmap", JSON.stringify(m)); }

// ── ĐĂNG NHẬP ──────────────────────────────────────────────
async function doLogin() {
  const u   = document.getElementById("inp-user").value.trim();
  const p   = document.getElementById("inp-pass").value.trim();
  const err = document.getElementById("auth-err");
  const btn = document.getElementById("login-btn");

  if (!u || !p) { showAuthErr("Vui lòng nhập đầy đủ thông tin"); return; }

  btn.disabled = true;
  btn.innerHTML = `<span class="btn-spin"></span> Đang xác thực...`;

  // Admin bypass IP check
  if (u === ADMIN_USER && p === ADMIN_PASS) {
    window._curUser  = u;
    window._isAdmin  = true;
    window._clientIP = await getClientIP();
    await animateLogin();
    launchApp();
    return;
  }

  const users = getUsers();
  const acc   = users.find(x => x.username === u && x.password === p);

  if (!acc) {
    showAuthErr("Tài khoản hoặc mật khẩu không đúng ❌");
    btn.disabled = false;
    btn.innerHTML = "ĐĂNG NHẬP";
    return;
  }
  if (new Date(acc.expires) < new Date()) {
    showAuthErr("Tài khoản đã hết hạn ⏰");
    btn.disabled = false;
    btn.innerHTML = "ĐĂNG NHẬP";
    return;
  }

  // IP check
  const ip    = await getClientIP();
  const ipMap = getIPMap();

  if (ipMap[u] && ipMap[u] !== ip) {
    showAuthErr(`⚠️ Tài khoản này đang được sử dụng trên thiết bị khác!\nIP đã đăng ký: ${ipMap[u].slice(0,8)}...`);
    btn.disabled = false;
    btn.innerHTML = "ĐĂNG NHẬP";
    return;
  }

  // Bind IP nếu chưa có
  if (!ipMap[u]) { ipMap[u] = ip; saveIPMap(ipMap); }

  window._curUser  = u;
  window._isAdmin  = false;
  window._clientIP = ip;
  await animateLogin();
  launchApp();
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

function doLogout() {
  if (window._fetchTimer) { clearInterval(window._fetchTimer); window._fetchTimer = null; }
  const iframe = document.getElementById("game-iframe");
  if (iframe) iframe.src = "about:blank";
  window._curUser = null;
  window._isAdmin = false;
  document.getElementById("app").style.display = "none";
  document.getElementById("auth-screen").style.display = "flex";
  document.getElementById("inp-user").value = "";
  document.getElementById("inp-pass").value = "";
  document.getElementById("auth-err").textContent = "";
  document.getElementById("login-btn").disabled = false;
  document.getElementById("login-btn").innerHTML = "ĐĂNG NHẬP";
}

// ── ADMIN: QUẢN LÝ USER ────────────────────────────────────
let _editIdx = -1;

function renderUsers() {
  const users = getUsers();
  const ipMap = getIPMap();
  const tb = document.getElementById("user-list");
  tb.innerHTML = "";

  if (!users.length) {
    tb.innerHTML = `<tr><td colspan="5" class="empty-row">Chưa có tài khoản nào</td></tr>`;
    return;
  }

  users.forEach((u, i) => {
    const exp   = new Date(u.expires);
    const ok    = exp > new Date();
    const days  = Math.max(0, Math.ceil((exp - new Date()) / 86400000));
    const boundIP = ipMap[u.username] || "—";
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><strong>${u.username}</strong></td>
      <td><span class="sbadge ${ok ? "active" : "expired"}">${ok ? "Hoạt động" : "Hết hạn"}</span></td>
      <td>${ok ? days + " ngày" : "—"}</td>
      <td class="ip-cell" title="${boundIP}">${boundIP === "—" ? "—" : boundIP.slice(0,12)+"..."}</td>
      <td class="actions-cell">
        <button class="act-btn edit" onclick="openEdit(${i})" title="Sửa">✏️</button>
        <button class="act-btn ip-reset" onclick="resetIP('${u.username}')" title="Reset IP">🔄</button>
        <button class="act-btn del" onclick="delUser(${i})" title="Xoá">🗑️</button>
      </td>`;
    tb.appendChild(tr);
  });

  document.getElementById("user-count").textContent = users.length;
  document.getElementById("active-count").textContent = users.filter(u => new Date(u.expires) > new Date()).length;
}

function resetIP(username) {
  if (!confirm(`Reset IP cho tài khoản "${username}"?\nTài khoản này sẽ có thể đăng nhập từ thiết bị mới.`)) return;
  const ipMap = getIPMap();
  delete ipMap[username];
  saveIPMap(ipMap);
  showToast(`✅ Đã reset IP cho ${username}`);
  renderUsers();
}

function openCreate() {
  _editIdx = -1;
  document.getElementById("modal-title").textContent = "TẠO TÀI KHOẢN MỚI";
  document.getElementById("m-user").value = "";
  document.getElementById("m-pass").value = "";
  document.getElementById("m-days").value = "30";
  document.getElementById("modal-overlay").classList.remove("hidden");
  setTimeout(() => document.getElementById("m-user").focus(), 100);
}

function openEdit(i) {
  _editIdx = i;
  const u = getUsers()[i];
  document.getElementById("modal-title").textContent = "CHỈNH SỬA TÀI KHOẢN";
  document.getElementById("m-user").value = u.username;
  document.getElementById("m-pass").value = u.password;
  const d = Math.max(1, Math.round((new Date(u.expires) - new Date()) / 86400000));
  document.getElementById("m-days").value = d;
  document.getElementById("modal-overlay").classList.remove("hidden");
}

function closeModal() { document.getElementById("modal-overlay").classList.add("hidden"); }

function submitUser() {
  const u = document.getElementById("m-user").value.trim();
  const p = document.getElementById("m-pass").value.trim();
  const d = parseInt(document.getElementById("m-days").value) || 30;
  if (!u || !p) { showToast("⚠️ Vui lòng điền đầy đủ", "warn"); return; }
  const exp   = new Date(Date.now() + d * 86400000).toISOString();
  const users = getUsers();
  if (_editIdx >= 0) {
    users[_editIdx] = { username: u, password: p, expires: exp };
    showToast(`✅ Đã cập nhật tài khoản ${u}`);
  } else {
    if (users.find(x => x.username === u)) { showToast("⚠️ Tài khoản đã tồn tại!", "warn"); return; }
    users.push({ username: u, password: p, expires: exp });
    showToast(`✅ Đã tạo tài khoản ${u}`);
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
  // xóa IP binding
  const ipMap = getIPMap();
  delete ipMap[u.username];
  saveIPMap(ipMap);
  showToast(`🗑️ Đã xoá ${u.username}`);
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
