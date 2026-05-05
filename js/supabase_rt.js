// ═══════════════════════════════════════════════════════════
//  SUPABASE REALTIME — Tài Xỉu AI  |  by Dzi
//  Web nhận data realtime từ Python tool qua Supabase
// ═══════════════════════════════════════════════════════════

const SUPA_HEADERS = {
  "apikey":        SUPA_KEY,
  "Authorization": `Bearer ${SUPA_KEY}`,
  "Content-Type":  "application/json",
};

// ── State ────────────────────────────────────────────────────
let _supaClient   = null;
let _realtimeSubs = {};   // key: "app|label" → channel
let _onNewResult  = null; // callback khi có phiên mới
let _onNewPred    = null; // callback khi có dự đoán mới

// ── Load Supabase SDK ────────────────────────────────────────
async function supaLoadSDK() {
  if (window.supabase) return true;
  return new Promise(resolve => {
    // Timeout 6s — không block app nếu CDN chậm
    const timeout = setTimeout(() => {
      console.warn("[Supa] SDK load timeout — chạy không có realtime");
      resolve(false);
    }, 6000);
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js";
    s.onload = () => { clearTimeout(timeout); resolve(true); };
    s.onerror = () => { clearTimeout(timeout); resolve(false); };
    document.head.appendChild(s);
  });
}

async function supaInit() {
  if (_supaClient) return _supaClient;
  const ok = await supaLoadSDK();
  if (!ok) { console.error("Không load được Supabase SDK"); return null; }
  _supaClient = window.supabase.createClient(SUPA_URL, SUPA_KEY);
  return _supaClient;
}

// ── Fetch lịch sử gần nhất ──────────────────────────────────
async function supaFetchHistory(app, apiLabel) {
  try {
    const res = await fetch(
      `${SUPA_URL}/rest/v1/${DB_TABLES.history}?app=eq.${encodeURIComponent(app)}&api_label=eq.${encodeURIComponent(apiLabel)}&select=history_json,stats_json,updated_at`,
      { headers: SUPA_HEADERS }
    );
    const rows = await res.json();
    return rows[0] || null;
  } catch(e) {
    console.error("supaFetchHistory lỗi:", e);
    return null;
  }
}

// Fetch 30 phiên kết quả gần nhất
async function supaFetchResults(app, apiLabel, limit = 30) {
  try {
    const res = await fetch(
      `${SUPA_URL}/rest/v1/${DB_TABLES.results}?app=eq.${encodeURIComponent(app)}&api_label=eq.${encodeURIComponent(apiLabel)}&order=created_at.desc&limit=${limit}&select=*`,
      { headers: SUPA_HEADERS }
    );
    const rows = await res.json();
    return rows.reverse(); // cũ → mới
  } catch(e) {
    console.error("supaFetchResults lỗi:", e);
    return [];
  }
}

// Fetch dự đoán mới nhất
async function supaFetchLatestPred(app, apiLabel) {
  try {
    const res = await fetch(
      `${SUPA_URL}/rest/v1/${DB_TABLES.predictions}?app=eq.${encodeURIComponent(app)}&api_label=eq.${encodeURIComponent(apiLabel)}&order=created_at.desc&limit=1&select=*`,
      { headers: SUPA_HEADERS }
    );
    const rows = await res.json();
    return rows[0] || null;
  } catch(e) { return null; }
}

// Fetch tất cả sảnh — latest result mỗi sảnh (cho trang home)
async function supaFetchAllLatest() {
  try {
    const res = await fetch(
      `${SUPA_URL}/rest/v1/${DB_TABLES.history}?select=app,api_label,history_json,stats_json,updated_at`,
      { headers: SUPA_HEADERS }
    );
    return await res.json();
  } catch(e) { return []; }
}

// ── Subscribe Realtime ───────────────────────────────────────
async function supaSubscribeResults(app, apiLabel, onData) {
  const client = await supaInit();
  if (!client) return null;
  const key = `${app}|${apiLabel}`;
  if (_realtimeSubs[key]) {
    client.removeChannel(_realtimeSubs[key]);
  }
  const channel = client
    .channel(`tx_results_${app}_${apiLabel.replace(/\s/g,"_")}`)
    .on("postgres_changes", {
      event:  "INSERT",
      schema: "public",
      table:  DB_TABLES.results,
      filter: `app=eq.${app}`,
    }, payload => {
      const row = payload.new;
      if (row.api_label === apiLabel) onData(row);
    })
    .subscribe();
  _realtimeSubs[key] = channel;
  return channel;
}

async function supaSubscribePredictions(app, apiLabel, onData) {
  const client = await supaInit();
  if (!client) return null;
  const key = `pred_${app}|${apiLabel}`;
  if (_realtimeSubs[key]) {
    client.removeChannel(_realtimeSubs[key]);
  }
  const channel = client
    .channel(`tx_pred_${app}_${apiLabel.replace(/\s/g,"_")}`)
    .on("postgres_changes", {
      event:  "INSERT",
      schema: "public",
      table:  DB_TABLES.predictions,
      filter: `app=eq.${app}`,
    }, payload => {
      const row = payload.new;
      if (row.api_label === apiLabel) onData(row);
    })
    .subscribe();
  _realtimeSubs[key] = channel;
  return channel;
}

async function supaSubscribeHistory(app, apiLabel, onData) {
  const client = await supaInit();
  if (!client) return null;
  const key = `hist_${app}|${apiLabel}`;
  if (_realtimeSubs[key]) {
    client.removeChannel(_realtimeSubs[key]);
  }
  const channel = client
    .channel(`tx_hist_${app}_${apiLabel.replace(/\s/g,"_")}`)
    .on("postgres_changes", {
      event:  "UPDATE",
      schema: "public",
      table:  DB_TABLES.history,
      filter: `app=eq.${app}`,
    }, payload => {
      const row = payload.new;
      if (row.api_label === apiLabel) onData(row);
    })
    .subscribe();
  _realtimeSubs[key] = channel;
  return channel;
}

// Hủy tất cả subscription
async function supaUnsubscribeAll() {
  const client = await supaInit();
  if (!client) return;
  for (const ch of Object.values(_realtimeSubs)) {
    try { client.removeChannel(ch); } catch(e) {}
  }
  _realtimeSubs = {};
}

// ── Realtime Panel ───────────────────────────────────────────
// Khởi động realtime cho 1 sảnh/api đang xem
// Tự fetch history ban đầu rồi subscribe realtime
async function supaStartRealtimePanel(app, apiLabel, callbacks) {
  // callbacks: { onHistory, onNewResult, onNewPred, onConnected, onError }
  await supaUnsubscribeAll();

  // 1. Fetch history ban đầu
  const hist = await supaFetchHistory(app, apiLabel);
  if (hist) {
    callbacks.onHistory && callbacks.onHistory(hist);
  } else {
    // Thử fetch results trực tiếp
    const rows = await supaFetchResults(app, apiLabel);
    if (rows.length > 0) {
      callbacks.onHistory && callbacks.onHistory({ history_json: rows, stats_json: null });
    }
  }

  // 2. Fetch dự đoán mới nhất
  const pred = await supaFetchLatestPred(app, apiLabel);
  if (pred) callbacks.onNewPred && callbacks.onNewPred(pred);

  // 3. Subscribe realtime
  await supaSubscribeHistory(app, apiLabel, row => {
    callbacks.onHistory && callbacks.onHistory(row);
  });
  await supaSubscribePredictions(app, apiLabel, row => {
    callbacks.onNewPred && callbacks.onNewPred(row);
  });
  await supaSubscribeResults(app, apiLabel, row => {
    callbacks.onNewResult && callbacks.onNewResult(row);
  });

  callbacks.onConnected && callbacks.onConnected();
}
