// ═══════════════════════════════════════════════════════════
//  SOUND SYSTEM v2 — TX·AI  |  by Nguyễn Quang Huy Dzi
//  - Nhạc nền YouTube (loop, persist qua tab)
//  - UI click sounds bằng Web Audio API
//  - 2 button riêng: Nhạc nền + Âm thanh UI
//  - Nút trong sidebar 3 gạch
// ═══════════════════════════════════════════════════════════

window.TxSound = (function () {
  const YT_VIDEO_ID   = "xjss230zIsE";
  const KEY_MUSIC     = "tx_music_on";
  const KEY_SFX       = "tx_sfx_on";

  let _musicOn = localStorage.getItem(KEY_MUSIC) !== "false";
  let _sfxOn   = localStorage.getItem(KEY_SFX)   !== "false";
  let _ytReady = false;
  let _player  = null;
  let _started = false;
  let _ctx     = null;

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

  /* ─── YOUTUBE ────────────────────────────── */
  function loadYTScript() {
    if (document.getElementById("yt-api-script")) return;
    const s = document.createElement("script");
    s.id = "yt-api-script"; s.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(s);
  }

  window.onYouTubeIframeAPIReady = function() { _ytReady = true; if (_started) createPlayer(); };

  function createPlayer() {
    const old = document.getElementById("yt-player-wrap");
    if (old) old.remove();
    const wrap = document.createElement("div");
    wrap.id = "yt-player-wrap";
    wrap.style.cssText = "position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;pointer-events:none;z-index:-1;overflow:hidden;";
    const inner = document.createElement("div"); inner.id = "yt-player-inner";
    wrap.appendChild(inner); document.body.appendChild(wrap);
    _player = new YT.Player("yt-player-inner", {
      videoId: YT_VIDEO_ID,
      playerVars: { autoplay:1, loop:1, playlist:YT_VIDEO_ID, controls:0, disablekb:1, fs:0, iv_load_policy:3, rel:0, modestbranding:1, mute:0, origin:location.origin },
      events: {
        onReady: function(e) {
          e.target.setVolume(55);
          if (_musicOn) {
            // Thử play, nếu bị block bởi autoplay policy thì unmute sau gesture
            try {
              e.target.playVideo();
              // iOS workaround: mute trước, play, rồi unmute ngay
              e.target.unMute();
            } catch(err) {}
            // Retry sau 1s nếu vẫn paused
            setTimeout(() => {
              try {
                if (e.target.getPlayerState && e.target.getPlayerState() !== 1) {
                  e.target.playVideo();
                }
              } catch(err2) {}
            }, 1000);
          } else {
            try { e.target.pauseVideo(); } catch(err) {}
          }
          updateSidebarBtns();
        },
        onStateChange: function(e) {
          if (e.data === YT.PlayerState.ENDED) { try { _player.seekTo(0); _player.playVideo(); } catch(err) {} }
          // Nếu bị pause không mong muốn và _musicOn = true, retry
          if (e.data === YT.PlayerState.PAUSED && _musicOn) {
            setTimeout(() => {
              try { if (_player && _musicOn) _player.playVideo(); } catch(err) {}
            }, 500);
          }
        },
        onError: function() { setTimeout(() => { if (_started && _musicOn) createPlayer(); }, 5000); }
      }
    });
  }

  function musicPlay()  { if (!_player) return; try { _player.playVideo();  } catch(e) {} }
  function musicPause() { if (!_player) return; try { _player.pauseVideo(); } catch(e) {} }

  /* ─── TOGGLES ────────────────────────────── */
  function toggleMusic() {
    _musicOn = !_musicOn;
    localStorage.setItem(KEY_MUSIC, _musicOn);
    if (_musicOn) { getCtx(); musicPlay(); } else musicPause();
    updateSidebarBtns();
    if (_sfxOn) Sounds.toggle();
  }

  function toggleSfx() {
    _sfxOn = !_sfxOn;
    localStorage.setItem(KEY_SFX, _sfxOn);
    updateSidebarBtns();
    if (_sfxOn) { getCtx(); Sounds.toggle(); }
  }

  /* ─── SIDEBAR BUTTONS ────────────────────── */
  function updateSidebarBtns() {
    const mBtn = document.getElementById("sidebar-music-btn");
    const sBtn = document.getElementById("sidebar-sfx-btn");
    const tBtn = document.getElementById("sidebar-tts-btn");
    if (mBtn) {
      mBtn.innerHTML = _musicOn
        ? `<span class="snav-icon">🎵</span><span class="snav-label">Nhạc Nền</span><span class="snav-toggle on">BẬT</span>`
        : `<span class="snav-icon">🎵</span><span class="snav-label">Nhạc Nền</span><span class="snav-toggle off">TẮT</span>`;
    }
    if (sBtn) {
      sBtn.innerHTML = _sfxOn
        ? `<span class="snav-icon">🔊</span><span class="snav-label">Âm Thanh</span><span class="snav-toggle on">BẬT</span>`
        : `<span class="snav-icon">🔇</span><span class="snav-label">Âm Thanh</span><span class="snav-toggle off">TẮT</span>`;
    }
    if (tBtn) {
      const ttsOn = window.TxTTS ? window.TxTTS.isOn() : true;
      tBtn.innerHTML = ttsOn
        ? `<span class="snav-icon">🗣️</span><span class="snav-label">Giọng Đọc AI</span><span class="snav-toggle on">BẬT</span>`
        : `<span class="snav-icon">🔕</span><span class="snav-label">Giọng Đọc AI</span><span class="snav-toggle off">TẮT</span>`;
    }
  }

  function toggleTts() {
    if (window.TxTTS) window.TxTTS.toggle();
    updateSidebarBtns();
    if (_sfxOn) Sounds.toggle();
  }

  function injectSidebarBtns() {
    if (document.getElementById("sidebar-music-btn")) return;
    const nav = document.querySelector(".sidebar-nav");
    if (!nav) return;
    // Thêm sound section vào trước logout
    const logoutItem = nav.querySelector(".nav-logout");

    const soundSection = document.createElement("div");
    soundSection.className = "sidebar-sound-section";
    soundSection.innerHTML = `
      <div class="sidebar-sound-title">⚙️ ÂM THANH</div>
      <button id="sidebar-music-btn" class="sidebar-sound-btn" onclick="TxSound.toggleMusic()"></button>
      <button id="sidebar-sfx-btn"   class="sidebar-sound-btn" onclick="TxSound.toggleSfx()"></button>
      <button id="sidebar-tts-btn"   class="sidebar-sound-btn" onclick="TxSound.toggleTts()"></button>
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
      if (t.closest("#sidebar-music-btn") || t.closest("#sidebar-sfx-btn")) return;
      if (t.matches(".auth-btn, #login-btn")) return;
      if (t.matches(".back-btn,.close-btn,.pred-close,.webview-btn-close,[onclick*='goHome']")) { Sounds.close(); return; }
      if (t.matches(".lobby-card,.lobby-mgr-card")) { Sounds.open(); return; }
      if (t.matches(".auth-sup-btn,.sup-btn,a[href]")) { Sounds.click(); return; }
      if (t.matches("button,.btn,[onclick],.api-tab,.nav-item,.ham-btn,.logout-btn,.captcha-choice-btn,.captcha-refresh,.open-hist-btn")) { Sounds.click(); return; }
    }, true);
  }

  /* ─── INIT ───────────────────────────────── */
  function startMusic() {
    if (_started) return;
    _started = true;
    // Resume AudioContext ngay (đang trong user gesture từ login click)
    const ctx = getCtx();
    if (ctx && ctx.state === "suspended") {
      ctx.resume().then(() => {
        // AudioContext đã unlock, load YouTube
        loadYTScript();
        if (_ytReady) createPlayer();
      }).catch(() => {
        loadYTScript();
        if (_ytReady) createPlayer();
      });
    } else {
      loadYTScript();
      if (_ytReady) createPlayer();
    }
    // Inject sidebar buttons sau khi DOM app ready
    setTimeout(injectSidebarBtns, 800);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", wireGlobalSounds);
  else wireGlobalSounds();

  // Resume nhạc khi quay lại tab / mở lại Safari
  document.addEventListener("visibilitychange", function() {
    if (document.visibilityState === "visible" && _started && _musicOn) {
      // Resume AudioContext nếu bị suspend
      const ctx = getCtx();
      if (ctx && ctx.state === "suspended") ctx.resume().catch(() => {});
      // Resume YouTube player
      setTimeout(() => {
        try {
          if (_player && _musicOn) {
            const state = _player.getPlayerState ? _player.getPlayerState() : -1;
            if (state !== 1) _player.playVideo();
          }
        } catch(e) {}
      }, 300);
    }
  });

  // iOS Safari: pageshow khi swipe back từ tab khác
  window.addEventListener("pageshow", function(e) {
    if (_started && _musicOn) {
      setTimeout(() => {
        try {
          const ctx = getCtx();
          if (ctx && ctx.state === "suspended") ctx.resume().catch(() => {});
          if (_player && _musicOn) {
            const state = _player.getPlayerState ? _player.getPlayerState() : -1;
            if (state !== 1) _player.playVideo();
          }
        } catch(err) {}
      }, 500);
    }
  });

  return {
    startMusic,
    toggleMusic,
    toggleSfx,
    toggleTts,
    isMusic: () => _musicOn,
    isSfx: () => _sfxOn,
    // backward compat
    toggle: toggleMusic,
    isOn: () => _musicOn,
    play: Sounds,
    getCtx,
    injectSidebarBtns,
    updateSidebarBtns,
  };
})();

// ═══════════════════════════════════════════════════════════
//  TEXT-TO-SPEECH — Giọng Google Tiếng Việt
//  Đọc kết quả dự đoán mới: "Dự đoán phiên 123 sẽ ra Tài"
// ═══════════════════════════════════════════════════════════
window.TxTTS = (function() {
  const KEY_TTS = "tx_tts_on";
  let _on = localStorage.getItem(KEY_TTS) !== "false";
  let _synth = window.speechSynthesis;
  let _voiceVI = null;
  let _lastSpoken = ""; // tránh đọc trùng

  // Load voice tiếng Việt
  function loadVoice() {
    if (!_synth) return;
    const tryLoad = () => {
      const voices = _synth.getVoices();
      // Ưu tiên Google Vietnamese
      _voiceVI = voices.find(v => v.lang === "vi-VN" && v.name.toLowerCase().includes("google"))
              || voices.find(v => v.lang === "vi-VN")
              || voices.find(v => v.lang.startsWith("vi"))
              || null;
    };
    tryLoad();
    if (_synth.onvoiceschanged !== undefined) _synth.onvoiceschanged = tryLoad;
  }

  function speak(text) {
    if (!_on || !_synth) return;
    if (text === _lastSpoken) return; // tránh đọc lại
    _lastSpoken = text;
    // Cancel giọng đang đọc
    try { _synth.cancel(); } catch(e) {}
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = "vi-VN";
    utter.rate = 0.95;
    utter.pitch = 1.05;
    utter.volume = 1;
    if (_voiceVI) utter.voice = _voiceVI;
    try { _synth.speak(utter); } catch(e) {}
  }

  // Đọc kết quả dự đoán: "Dự đoán phiên 2628447 sẽ ra Tài"
  function announcePredict(phien, result) {
    if (!phien || !result) return;
    const text = `Dự đoán phiên ${phien} sẽ ra ${result}`;
    speak(text);
  }

  // Đọc kết quả đúng/sai
  function announceVerdict(ok, pred, actual) {
    if (ok) speak(`Chính xác! Bot đoán đúng ${pred}`);
    else speak(`Sai rồi! Bot đoán ${pred}, kết quả thực tế là ${actual}`);
  }

  function toggle() {
    _on = !_on;
    localStorage.setItem(KEY_TTS, _on);
    if (_on) loadVoice();
    return _on;
  }

  function isOn() { return _on; }

  // Init
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", loadVoice);
  else loadVoice();

  return { speak, announcePredict, announceVerdict, toggle, isOn };
})();
