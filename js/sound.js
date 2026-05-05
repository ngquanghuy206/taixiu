// ═══════════════════════════════════════════════════════════
//  SOUND SYSTEM v2 — TX·AI  |  by Nguyễn Quang Huy Dzi
//  - UI click sounds bằng Web Audio API
//  - 2 button riêng: Âm thanh UI
//  - Nút trong sidebar 3 gạch
// ═══════════════════════════════════════════════════════════

window.TxSound = (function () {
  const KEY_SFX = "tx_sfx_on";

  let _sfxOn = localStorage.getItem(KEY_SFX) !== "false";
  let _ctx   = null;

  /* ─── WEB AUDIO ──────────────────────────── */
  function getCtx() {
    if (!_ctx) try { _ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e) {}
    if (_ctx && _ctx.state === "suspended") try { _ctx.resume(); } catch(e) {}
    return _ctx;
  }

  function playTone(freq, type, duration, gain, delay) {
    const ctx = getCtx(); if (!ctx || !_sfxOn) return;
    try {
      const osc = ctx.createOscillator(), env = ctx.createGain();
      osc.connect(env); env.connect(ctx.destination);
      osc.type = type; osc.frequency.value = freq;
      const t = ctx.currentTime + (delay || 0);
      env.gain.setValueAtTime(gain, t);
      env.gain.exponentialRampToValueAtTime(0.0001, t + duration);
      osc.start(t); osc.stop(t + duration + 0.05);
    } catch(e) {}
  }

  function playNoise(duration, gain) {
    const ctx = getCtx(); if (!ctx || !_sfxOn) return;
    try {
      const buf = ctx.createBuffer(1, ctx.sampleRate * duration, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      const src = ctx.createBufferSource(), filt = ctx.createBiquadFilter(), env = ctx.createGain();
      src.buffer = buf; filt.type = "bandpass"; filt.frequency.value = 1200; filt.Q.value = 0.5;
      src.connect(filt); filt.connect(env); env.connect(ctx.destination);
      const t = ctx.currentTime;
      env.gain.setValueAtTime(gain, t);
      env.gain.exponentialRampToValueAtTime(0.0001, t + duration);
      src.start(t); src.stop(t + duration + 0.05);
    } catch(e) {}
  }

  const Sounds = {
    click:   () => { playTone(880,  "sine",     0.08, 0.18); playTone(1320,"sine", 0.06, 0.10, 0.04); },
    open:    () => { playTone(523,  "sine",     0.12, 0.15); playTone(659, "sine", 0.10, 0.12, 0.06); playTone(784,"sine",0.08,0.10,0.12); },
    close:   () => { playTone(784,  "sine",     0.08, 0.12); playTone(523, "sine", 0.06, 0.10, 0.08); },
    success: () => { playTone(523,  "sine",     0.10, 0.15); playTone(659, "sine", 0.08, 0.13, 0.08); playTone(1047,"sine",0.12,0.18,0.16); },
    error:   () => { playTone(220,  "sawtooth", 0.10, 0.20); playTone(180, "sawtooth",0.08,0.15,0.1); },
    toggle:  () => { playTone(1046, "sine",     0.06, 0.12); playNoise(0.04, 0.06); },
    login:   () => { [0,0.1,0.2,0.32].forEach((d,i) => playTone([523,659,784,1047][i],"sine",0.14,0.16,d)); },
    notify:  () => { playTone(1046, "sine", 0.06, 0.10); playTone(1318,"sine",0.05,0.08,0.09); },
    dice:    () => { playNoise(0.12, 0.20); playTone(440,"triangle",0.06,0.10,0.05); },
  };

  /* ─── TOGGLES ────────────────────────────── */
  function toggleSfx() {
    _sfxOn = !_sfxOn;
    localStorage.setItem(KEY_SFX, _sfxOn);
    updateSidebarBtns();
    if (_sfxOn) { getCtx(); Sounds.toggle(); }
  }

  /* ─── SIDEBAR BUTTONS ────────────────────── */
  function updateSidebarBtns() {
    const sBtn = document.getElementById("sidebar-sfx-btn");
    if (sBtn) {
      sBtn.innerHTML = _sfxOn
        ? `<span class="snav-icon">🔊</span><span class="snav-label">Âm Thanh</span><span class="snav-toggle on">BẬT</span>`
        : `<span class="snav-icon">🔇</span><span class="snav-label">Âm Thanh</span><span class="snav-toggle off">TẮT</span>`;
    }
  }

  function injectSidebarBtns() {
    if (document.getElementById("sidebar-sfx-btn")) return;
    const nav = document.querySelector(".sidebar-nav");
    if (!nav) return;
    const logoutItem = nav.querySelector(".nav-logout");

    const soundSection = document.createElement("div");
    soundSection.className = "sidebar-sound-section";
    soundSection.innerHTML = `
      <div class="sidebar-sound-title">⚙️ ÂM THANH</div>
      <button id="sidebar-sfx-btn" class="sidebar-sound-btn" onclick="TxSound.toggleSfx()"></button>
    `;
    if (logoutItem) nav.insertBefore(soundSection, logoutItem);
    else nav.appendChild(soundSection);
    updateSidebarBtns();
  }

  /* ─── GLOBAL CLICK SOUND ─────────────────── */
  function wireGlobalSounds() {
    document.addEventListener("click", function(e) {
      if (!_sfxOn) return;
      const t = e.target;
      if (t.closest("#sidebar-sfx-btn")) return;
      if (t.matches(".auth-btn, #login-btn")) return;
      if (t.matches(".back-btn,.close-btn,.pred-close,.webview-btn-close,[onclick*='goHome']")) { Sounds.close(); return; }
      if (t.matches(".lobby-card,.lobby-mgr-card")) { Sounds.open(); return; }
      if (t.matches(".auth-sup-btn,.sup-btn,a[href]")) { Sounds.click(); return; }
      if (t.matches("button,.btn,[onclick],.api-tab,.nav-item,.ham-btn,.logout-btn,.captcha-choice-btn,.captcha-refresh,.open-hist-btn")) { Sounds.click(); return; }
    }, true);
  }

  /* ─── INIT ───────────────────────────────── */
  function startMusic() {
    // Nhạc nền đã bị tắt — chỉ inject sidebar buttons
    setTimeout(injectSidebarBtns, 800);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", wireGlobalSounds);
  else wireGlobalSounds();

  return {
    startMusic,
    toggleMusic: () => {},   // no-op (đã xóa nhạc nền)
    toggleSfx,
    toggleTts: () => {},     // no-op (đã xóa TTS)
    isMusic: () => false,
    isSfx: () => _sfxOn,
    toggle: () => {},
    isOn: () => false,
    play: Sounds,
    getCtx,
    injectSidebarBtns,
    updateSidebarBtns,
  };
})();

// TxTTS stub — giọng đọc AI đã bị tắt
window.TxTTS = (function() {
  return {
    speak:           () => {},
    announcePredict: () => {},
    announceVerdict: () => {},
    toggle:          () => false,
    isOn:            () => false,
    setApp:          () => {},
    getAppName:      () => "",
  };
})();
