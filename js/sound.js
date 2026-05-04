// ═══════════════════════════════════════════════════════════
//  SOUND SYSTEM — TX·AI  |  by Nguyễn Quang Huy Dzi
//  - Nhạc nền YouTube (loop tự động)
//  - UI click sounds bằng Web Audio API
//  - Nút bật/tắt persistent
// ═══════════════════════════════════════════════════════════

window.TxSound = (function () {
  /* ─── CONFIG ─────────────────────────────────────── */
  const YT_VIDEO_ID = "xjss230zIsE";          // youtu.be/xjss230zIsE
  const STORAGE_KEY  = "tx_sound_on";

  /* ─── STATE ──────────────────────────────────────── */
  let _on       = localStorage.getItem(STORAGE_KEY) !== "false"; // default ON
  let _ytReady  = false;
  let _player   = null;
  let _started  = false;  // đã khởi động bởi launchApp
  let _ctx      = null;   // AudioContext cho UI sounds
  let _btnEl    = null;   // nút float

  /* ─── WEB AUDIO CONTEXT ──────────────────────────── */
  function getCtx() {
    if (!_ctx) {
      try { _ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e) {}
    }
    if (_ctx && _ctx.state === "suspended") { try { _ctx.resume(); } catch(e) {} }
    return _ctx;
  }

  /* ─── UI SOUND GENERATORS ────────────────────────── */
  function playTone(freq, type, duration, gain, delay) {
    const ctx = getCtx(); if (!ctx || !_on) return;
    try {
      const osc = ctx.createOscillator();
      const env = ctx.createGain();
      osc.connect(env); env.connect(ctx.destination);
      osc.type = type; osc.frequency.value = freq;
      const t = ctx.currentTime + (delay || 0);
      env.gain.setValueAtTime(gain, t);
      env.gain.exponentialRampToValueAtTime(0.0001, t + duration);
      osc.start(t); osc.stop(t + duration + 0.05);
    } catch(e) {}
  }

  function playNoise(duration, gain) {
    const ctx = getCtx(); if (!ctx || !_on) return;
    try {
      const buf = ctx.createBuffer(1, ctx.sampleRate * duration, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1);
      const src  = ctx.createBufferSource();
      const filt = ctx.createBiquadFilter();
      const env  = ctx.createGain();
      src.buffer = buf;
      filt.type  = "bandpass"; filt.frequency.value = 1200; filt.Q.value = 0.5;
      src.connect(filt); filt.connect(env); env.connect(ctx.destination);
      const t = ctx.currentTime;
      env.gain.setValueAtTime(gain, t);
      env.gain.exponentialRampToValueAtTime(0.0001, t + duration);
      src.start(t); src.stop(t + duration + 0.05);
    } catch(e) {}
  }

  /* Public UI sounds */
  const Sounds = {
    click:   () => { playTone(880,  "sine",     0.08, 0.18); playTone(1320, "sine", 0.06, 0.10, 0.04); },
    open:    () => { playTone(523,  "sine",     0.12, 0.15); playTone(659,  "sine", 0.10, 0.12, 0.06); playTone(784, "sine", 0.08, 0.10, 0.12); },
    close:   () => { playTone(784,  "sine",     0.08, 0.12); playTone(523,  "sine", 0.06, 0.10, 0.08); },
    success: () => { playTone(523,  "sine",     0.10, 0.15); playTone(659,  "sine", 0.08, 0.13, 0.08); playTone(1047,"sine", 0.12, 0.18, 0.16); },
    error:   () => { playTone(220,  "sawtooth", 0.10, 0.20); playTone(180,  "sawtooth", 0.08, 0.15, 0.1); },
    toggle:  () => { playTone(1046, "sine",     0.06, 0.12); playNoise(0.04, 0.06); },
    login:   () => {
      [0, 0.1, 0.2, 0.32].forEach((d, i) => {
        const freqs = [523, 659, 784, 1047];
        playTone(freqs[i], "sine", 0.14, 0.16, d);
      });
    },
    notify:  () => { playTone(1046, "sine", 0.06, 0.10); playTone(1318, "sine", 0.05, 0.08, 0.09); },
    dice:    () => { playNoise(0.12, 0.20); playTone(440, "triangle", 0.06, 0.10, 0.05); },
  };

  /* ─── YOUTUBE IFRAME API ─────────────────────────── */
  function loadYTScript() {
    if (document.getElementById("yt-api-script")) return;
    const s = document.createElement("script");
    s.id  = "yt-api-script";
    s.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(s);
  }

  // YouTube callback (global)
  window.onYouTubeIframeAPIReady = function () {
    _ytReady = true;
    if (_started) createPlayer();
  };

  function createPlayer() {
    // Remove old iframe container nếu có
    const old = document.getElementById("yt-player-wrap");
    if (old) old.remove();

    const wrap = document.createElement("div");
    wrap.id = "yt-player-wrap";
    wrap.style.cssText = "position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;pointer-events:none;z-index:-1;overflow:hidden;";
    const inner = document.createElement("div");
    inner.id = "yt-player-inner";
    wrap.appendChild(inner);
    document.body.appendChild(wrap);

    _player = new YT.Player("yt-player-inner", {
      videoId: YT_VIDEO_ID,
      playerVars: {
        autoplay: 1,
        loop:     1,
        playlist: YT_VIDEO_ID,
        controls: 0,
        disablekb: 1,
        fs: 0,
        iv_load_policy: 3,
        rel: 0,
        modestbranding: 1,
        origin: location.origin,
      },
      events: {
        onReady: function (e) {
          e.target.setVolume(55);
          if (_on) {
            try { e.target.playVideo(); } catch(err) {}
          } else {
            try { e.target.pauseVideo(); } catch(err) {}
          }
          updateBtn();
        },
        onStateChange: function (e) {
          // Tự loop khi kết thúc (dự phòng ngoài playlist loop)
          if (e.data === YT.PlayerState.ENDED) {
            try { _player.seekTo(0); _player.playVideo(); } catch(err) {}
          }
        },
        onError: function () {
          console.warn("[TxSound] YouTube player error — retry in 5s");
          setTimeout(() => { if (_started && _on) createPlayer(); }, 5000);
        },
      },
    });
  }

  /* ─── MUSIC CONTROL ──────────────────────────────── */
  function musicPlay() {
    if (!_player) return;
    try { _player.playVideo(); } catch(e) {}
  }
  function musicPause() {
    if (!_player) return;
    try { _player.pauseVideo(); } catch(e) {}
  }

  /* ─── TOGGLE ─────────────────────────────────────── */
  function toggle() {
    _on = !_on;
    localStorage.setItem(STORAGE_KEY, _on ? "true" : "false");
    if (_on) {
      // Resume AudioContext
      getCtx();
      musicPlay();
      Sounds.toggle();
    } else {
      musicPause();
    }
    updateBtn();
  }

  /* ─── FLOAT BUTTON ───────────────────────────────── */
  function createBtn() {
    if (document.getElementById("sound-toggle-btn")) return;
    const btn = document.createElement("button");
    btn.id = "sound-toggle-btn";
    btn.onclick = function(e) { e.stopPropagation(); toggle(); };
    btn.title = "Bật/Tắt âm nhạc";
    document.body.appendChild(btn);
    _btnEl = btn;
    updateBtn();
  }

  function updateBtn() {
    if (!_btnEl) return;
    _btnEl.innerHTML = _on
      ? `<span class="stb-icon">🎵</span><span class="stb-bar b1"></span><span class="stb-bar b2"></span><span class="stb-bar b3"></span>`
      : `<span class="stb-icon">🔇</span>`;
    _btnEl.classList.toggle("stb-muted", !_on);
    _btnEl.setAttribute("aria-label", _on ? "Tắt nhạc" : "Bật nhạc");
  }

  /* ─── PUBLIC INIT ────────────────────────────────── */
  function startMusic() {
    if (_started) return;
    _started = true;
    loadYTScript();
    if (_ytReady) createPlayer();
    createBtn();
  }

  /* ─── AUTO-WIRE CLICK SOUNDS ─────────────────────── */
  function wireGlobalSounds() {
    document.addEventListener("click", function(e) {
      if (!_on) return;
      const t = e.target;
      // Jangan wire sound-toggle-btn sendiri (sudah pakai toggle())
      if (t.id === "sound-toggle-btn" || t.closest("#sound-toggle-btn")) return;

      if (t.matches(".auth-btn, #login-btn")) { /* played in login flow */ return; }
      if (t.matches(".back-btn, .close-btn, .pred-close, .webview-btn-close, [onclick*=\"goHome\"]")) { Sounds.close(); return; }
      if (t.matches(".lobby-card, .lobby-mgr-card")) { Sounds.open(); return; }
      if (t.matches(".auth-sup-btn, .sup-btn, a[href]")) { Sounds.click(); return; }
      if (t.matches("button, .btn, [onclick], .api-tab, .nav-item, .ham-btn, .logout-btn, .captcha-choice-btn, .captcha-refresh, .open-hist-btn")) {
        Sounds.click(); return;
      }
    }, true);
  }

  /* ─── AUTO-WIRE on load ────────────────────────────── */
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wireGlobalSounds);
  else wireGlobalSounds();

  /* ─── EXPOSE ─────────────────────────────────────── */
  return {
    startMusic,
    toggle,
    isOn: () => _on,
    play: Sounds,
    getCtx,
  };
})();
