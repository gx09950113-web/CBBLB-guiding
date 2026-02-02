/* =========================================================
   WTTF - app-events.js
   - JSON 路徑：assets/data/events.json
   - 完全配合你的 events.json 格式
   - 階梯狀左右交錯卡片
   - 背景音樂 -35dB
   - 切頁 / 切 tab / 背景 自動停止播放
========================================================= */

const EVENTS_JSON = new URL("assets/data/events.json", window.location.href).toString();
const AUDIO_KEY = "wttf_active_bgm_events";

document.addEventListener("DOMContentLoaded", () => {
  const audio = document.getElementById("bgmEvents");
  const muteBtn = document.getElementById("muteBtnEvents");

  setupExclusiveBgm(audio, AUDIO_KEY);
  setupMuteButton(audio, muteBtn);

  loadAndRenderEvents();
});

/* =========================
   BGM 控制
========================= */
function setupExclusiveBgm(audioEl, storageKey) {
  if (!audioEl) return;

  document.querySelectorAll("audio").forEach(a => {
    if (a !== audioEl) {
      try { a.pause(); } catch {}
      a.currentTime = 0;
    }
  });

  // -35 dB => 約 0.018
  audioEl.volume = 0.018;

  try { sessionStorage.setItem(storageKey, location.pathname); } catch {}

  const tryPlay = () => audioEl.play().catch(() => {});
  tryPlay();

  window.addEventListener("pageshow", tryPlay);

  window.addEventListener("pagehide", stopAudio);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stopAudio();
  });
  window.addEventListener("blur", stopAudio);

  function stopAudio(){
    try { audioEl.pause(); } catch {}
    audioEl.currentTime = 0;
  }
}

function setupMuteButton(audioEl, btnEl) {
  if (!audioEl || !btnEl) return;

  const sync = () => {
    btnEl.textContent = audioEl.muted ? "🔇" : "🔊";
    btnEl.setAttribute("aria-pressed", audioEl.muted);
  };

  btnEl.addEventListener("click", async () => {
    if (audioEl.paused) {
      try { await audioEl.play(); } catch {}
    }
    audioEl.muted = !audioEl.muted;
    sync();
  });

  sync();
}

/* =========================
   資料載入與渲染
========================= */
async function loadAndRenderEvents() {
  const grid = document.getElementById("eventsGrid");
  const hint = document.getElementById("eventsHint");

  grid.innerHTML = "";

  try {
    const res = await fetch(EVENTS_JSON, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();

    const list = Array.isArray(json.events) ? json.events : [];
    if (!list.length) throw new Error("Empty events");

    const now = new Date();
    const events = list
      .map((e, i) => normalizeEvent(e, i, now))
      .filter(Boolean)
      .sort(sortByStatusAndDate);

    events.forEach((ev, i) => {
      const card = renderEventCard(ev, i);
      grid.appendChild(card);
    });

    hint.hidden = true;
  } catch (err) {
    console.error("[events] load failed:", EVENTS_JSON, err);
    hint.hidden = false;
    hint.textContent = "活動資料讀取失敗，請確認 assets/data/events.json 是否存在。";
  }
}

/* =========================
   Event 正規化（配合你的 JSON）
========================= */
function normalizeEvent(raw, idx, now) {
  if (!raw) return null;

  const title = String(raw.title ?? `活動 ${idx + 1}`);
  const description = String(raw.description ?? "");
  const location = String(raw.location ?? "");
  const tag = String(raw.tag ?? "");

  const startRaw = String(raw.start ?? "");
  const endRaw = String(raw.end ?? "");

  const startDate = parseEventDate(startRaw, now);
  const endDate = parseEventDate(endRaw, now);

  const status = getStatus(startDate, endDate, now);

  return {
    title,
    description,
    location,
    tag,
    startRaw,
    endRaw,
    startDate,
    endDate,
    status
  };
}

/* =========================
   日期解析（支援「即日起」「UTC+8」）
========================= */
function parseEventDate(input, now) {
  const v = String(input || "").trim();
  if (!v) return null;

  if (v === "即日起" || v === "即日") return new Date(now);

  let s = v.replace(/\(UTC\+?8(?::00)?\)/gi, "+08:00");

  if (/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}/.test(s)) {
    s = s.replace(" ", "T");
  }

  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s)) {
    s += "+08:00";
  }

  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

/* =========================
   狀態與排序
========================= */
function getStatus(start, end, now) {
  if (!start && !end) return "unknown";
  if (start && !end) return start > now ? "upcoming" : "ongoing";
  if (!start && end) return now > end ? "past" : "ongoing";
  if (now < start) return "upcoming";
  if (now > end) return "past";
  return "ongoing";
}

function sortByStatusAndDate(a, b) {
  const p = s => s === "ongoing" ? 0 : s === "upcoming" ? 1 : s === "past" ? 2 : 3;
  const dp = p(a.status) - p(b.status);
  if (dp !== 0) return dp;

  const ad = a.startDate ? a.startDate.getTime() : Infinity;
  const bd = b.startDate ? b.startDate.getTime() : Infinity;
  return ad - bd;
}

/* =========================
   Render
========================= */
function renderEventCard(ev, index) {
  const el = document.createElement("article");
  el.className = `event-card status-${ev.status}`;
  el.style.setProperty("--step", index);

  el.innerHTML = `
    <div class="event-card__header">
      <h3 class="event-card__title">${escapeHtml(ev.title)}</h3>
      <span class="event-card__badge">${statusText(ev.status)}</span>
    </div>
    <div class="event-card__meta">
      ${makeRow("日期", displayDate(ev.startRaw, ev.startDate, ev.endRaw, ev.endDate))}
      ${ev.location ? makeRow("地點", ev.location) : ""}
      ${ev.tag ? makeRow("分類", ev.tag) : ""}
    </div>
    <div class="event-card__body">
      <p class="event-card__desc">${escapeHtml(ev.description)}</p>
    </div>
  `;
  return el;
}

function statusText(s){
  return s === "ongoing" ? "進行中"
       : s === "upcoming" ? "即將到來"
       : s === "past" ? "既往活動"
       : "預告";
}

function displayDate(sr, sd, er, ed){
  const s = sd ? formatDate(sd) : sr;
  const e = ed ? formatDate(ed) : er;
  return [s, e].filter(Boolean).join(" ～ ");
}

function formatDate(d){
  return new Intl.DateTimeFormat("zh-Hant", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    hour12: false
  }).format(d);
}

function makeRow(k, v){
  return `<p class="event-card__row"><span class="k">${k}</span><span class="v">${escapeHtml(v)}</span></p>`;
}

function escapeHtml(str){
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
