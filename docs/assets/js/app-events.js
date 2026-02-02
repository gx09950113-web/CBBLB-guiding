/* =========================================================
   WTTF - events.js (re-designed for your JSON schema)
   JSON example:
   {
     "events":[
       { "title": "...", "description": "...", "start": "即日起", "end": "2026-02-15 22:00(UTC+8)", "location": "...", "tag": "抽獎" }
     ]
   }

   - 讀取 data/events.json
   - 渲染階梯狀左右交錯卡片
   - 背景音樂預設播放、可靜音
   - 音樂切頁不重疊 + 離開分頁自動停止（tab/background）
   - 音量 -35dB
========================================================= */

const EVENTS_JSON = "data/events.json";
const AUDIO_KEY = "wttf_active_bgm_events";

document.addEventListener("DOMContentLoaded", () => {
  const audio = document.getElementById("bgmEvents");
  const muteBtn = document.getElementById("muteBtnEvents");

  setupExclusiveBgm(audio, AUDIO_KEY);
  setupMuteButton(audio, muteBtn);

  loadAndRenderEvents();
});

/** 音樂：切頁不重疊 + 離開分頁停止 */
function setupExclusiveBgm(audioEl, storageKey) {
  if (!audioEl) return;

  // 先停掉頁面內其他 audio（保險）
  document.querySelectorAll("audio").forEach(a => {
    if (a !== audioEl) {
      try { a.pause(); } catch {}
      a.currentTime = 0;
    }
  });

  // -35 dB => A = 10^(dB/20) = 10^(-35/20) ≈ 0.0178
  audioEl.volume = 0.018;

  // 記錄目前這頁的 bgm（同一個 tab 切頁時避免殘留）
  try { sessionStorage.setItem(storageKey, location.pathname); } catch {}

  const tryPlay = () => audioEl.play().catch(() => {});
  tryPlay();

  window.addEventListener("pageshow", () => {
    let active = "";
    try { active = sessionStorage.getItem(storageKey) || ""; } catch {}
    if (active && active !== location.pathname) {
      try { audioEl.pause(); } catch {}
      audioEl.currentTime = 0;
      try { sessionStorage.setItem(storageKey, location.pathname); } catch {}
    }
    tryPlay();
  });

  // 離開頁面就停止（避免某些情境 audio 還在）
  window.addEventListener("pagehide", () => {
    try { audioEl.pause(); } catch {}
    audioEl.currentTime = 0;
  });

  // ✅ 離開分頁/切到背景：停止 + 歸零
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      try { audioEl.pause(); } catch {}
      audioEl.currentTime = 0;
    }
  });

  // ✅ 視窗失焦保險（桌面切換視窗）
  window.addEventListener("blur", () => {
    try { audioEl.pause(); } catch {}
    audioEl.currentTime = 0;
  });
}

/** 靜音按鈕 */
function setupMuteButton(audioEl, btnEl) {
  if (!audioEl || !btnEl) return;

  const sync = () => {
    const muted = audioEl.muted;
    btnEl.setAttribute("aria-pressed", muted ? "true" : "false");
    btnEl.textContent = muted ? "🔇" : "🔊";
  };

  btnEl.addEventListener("click", async () => {
    // 若 autoplay 被擋，點擊時順便觸發播放
    if (audioEl.paused) {
      try { await audioEl.play(); } catch {}
    }
    audioEl.muted = !audioEl.muted;
    sync();
  });

  sync();
}

/** 載入並渲染 */
async function loadAndRenderEvents() {
  const grid = document.getElementById("eventsGrid");
  const hint = document.getElementById("eventsHint");

  if (!grid) return;
  grid.innerHTML = "";

  try {
    const res = await fetch(EVENTS_JSON, { cache: "no-store" });
    if (!res.ok) throw new Error("events.json 讀取失敗");
    const data = await res.json();

    const list = Array.isArray(data?.events) ? data.events : [];
    if (!list.length) {
      if (hint) {
        hint.hidden = false;
        hint.textContent = "目前沒有活動資料。";
      }
      return;
    }
    if (hint) hint.hidden = true;

    const now = new Date();
    const normalized = list
      .map((e, idx) => normalizeEventForYourJson(e, idx, now))
      .filter(Boolean);

    // 排序：進行中 -> 即將 -> 既往 -> 未知
    normalized.sort((a, b) => {
      const pa = getPriority(a.status);
      const pb = getPriority(b.status);
      if (pa !== pb) return pa - pb;

      // 同狀態再以 startDate（有的排前面）
      const ad = a.startDate ? a.startDate.getTime() : Number.POSITIVE_INFINITY;
      const bd = b.startDate ? b.startDate.getTime() : Number.POSITIVE_INFINITY;
      return ad - bd;
    });

    const frag = document.createDocumentFragment();
    normalized.forEach((ev, i) => frag.appendChild(renderEventCard(ev, i)));
    grid.appendChild(frag);
  } catch (err) {
    if (hint) {
      hint.hidden = false;
      hint.textContent = "活動資料讀取失敗，請確認 data/events.json 是否存在且格式正確。";
    }
  }
}

function getPriority(status) {
  return status === "ongoing" ? 0
    : status === "upcoming" ? 1
    : status === "past" ? 2
    : 3; // unknown
}

/** ✅ 針對你 JSON 格式的整理 */
function normalizeEventForYourJson(raw, idx, now) {
  if (!raw || typeof raw !== "object") return null;

  const title = String(raw.title ?? `活動 ${idx + 1}`);
  const description = String(raw.description ?? "");
  const location = String(raw.location ?? "");
  const tag = String(raw.tag ?? "");
  const link = raw.link ? String(raw.link) : "";

  const startRaw = String(raw.start ?? "");
  const endRaw = String(raw.end ?? "");

  const startDate = parseEventDate(startRaw, now);
  const endDate = parseEventDate(endRaw, now);

  const status = getStatus({ startDate, endDate, startRaw, endRaw }, now);

  return {
    title,
    description,
    location,
    tag,
    link,
    startRaw,
    endRaw,
    startDate,
    endDate,
    status
  };
}

/**
 * 解析你 events.json 的時間格式：
 * - "即日起" => now
 * - "2026-02-15 22:00(UTC+8)" => 轉成 ISO with +08:00
 * - "2026-02-15 22:00" (沒時區) => 當作 +08:00
 * - 空字串 => null
 */
function parseEventDate(input, now) {
  const v = String(input || "").trim();
  if (!v) return null;

  if (v === "即日起" || v === "即日" || v === "現在") {
    return new Date(now.getTime());
  }

  // 轉換 "(UTC+8)" / "(UTC+8:00)" -> "+08:00"
  let s = v.replace(/\(UTC\+?8(?::00)?\)/gi, "+08:00");

  // "YYYY-MM-DD HH:mm" -> "YYYY-MM-DDTHH:mm"
  // "YYYY-MM-DD HH:mm+08:00" -> "YYYY-MM-DDTHH:mm+08:00"
  if (/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}/.test(s)) {
    s = s.replace(" ", "T");
  }

  // 若是 "YYYY-MM-DDTHH:mm" 沒有時區，預設補 +08:00
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s)) {
    s = `${s}+08:00`;
  }

  // 若是只有日期 "YYYY-MM-DD" 也可解析（預設當地 00:00）
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** 狀態：過往 / 即將 / 進行中 / 未知 */
function getStatus(ev, now) {
  const s = ev.startDate;
  const e = ev.endDate;

  // start/end 都沒有 => unknown（像「敬請期待」）
  if (!s && !e) return "unknown";

  // 有 start，沒 end：start <= now => ongoing；start > now => upcoming
  if (s && !e) return s.getTime() > now.getTime() ? "upcoming" : "ongoing";

  // 沒 start，有 end：now <= end => ongoing；now > end => past
  if (!s && e) return now.getTime() > e.getTime() ? "past" : "ongoing";

  // start/end 都有
  if (s && e) {
    if (now.getTime() < s.getTime()) return "upcoming";
    if (now.getTime() > e.getTime()) return "past";
    return "ongoing";
  }

  return "unknown";
}

/** 顯示用：有解析到就顯示格式化日期，解析不到就回傳原字串 */
function displayDate(raw, dateObj) {
  const rawText = String(raw || "").trim();
  if (dateObj) return formatDate(dateObj);
  return rawText; // 例如：你真的想顯示「即日起」
}

function formatDate(d) {
  try {
    return new Intl.DateTimeFormat("zh-Hant", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      weekday: "short",
      hour12: false
    }).format(d);
  } catch {
    return d.toISOString();
  }
}

function renderEventCard(ev, index) {
  const article = document.createElement("article");
  article.className = `event-card status-${ev.status}`;
  article.style.setProperty("--step", String(index));

  const header = document.createElement("div");
  header.className = "event-card__header";

  const h3 = document.createElement("h3");
  h3.className = "event-card__title";
  h3.textContent = ev.title;

  const badge = document.createElement("span");
  badge.className = "event-card__badge";
  badge.textContent =
    ev.status === "upcoming" ? "即將到來" :
    ev.status === "ongoing" ? "進行中" :
    ev.status === "past" ? "既往活動" : "預告";

  header.appendChild(h3);
  header.appendChild(badge);

  const meta = document.createElement("div");
  meta.className = "event-card__meta";

  const startText = displayDate(ev.startRaw, ev.startDate);
  const endText = displayDate(ev.endRaw, ev.endDate);

  const dateText = [startText, endText].filter(Boolean).join(" ～ ");
  if (dateText) meta.appendChild(makeRow("日期", dateText));
  if (ev.location) meta.appendChild(makeRow("地點", ev.location));
  if (ev.tag) meta.appendChild(makeRow("分類", ev.tag));

  const body = document.createElement("div");
  body.className = "event-card__body";

  if (ev.description) {
    const p = document.createElement("p");
    p.className = "event-card__desc";
    p.textContent = ev.description;
    body.appendChild(p);
  }

  if (ev.link) {
    const a = document.createElement("a");
    a.className = "event-card__link";
    a.href = ev.link;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.textContent = "查看詳情 →";
    body.appendChild(a);
  }

  article.appendChild(header);
  article.appendChild(meta);
  article.appendChild(body);

  return article;
}

function makeRow(k, v) {
  const p = document.createElement("p");
  p.className = "event-card__row";
  p.innerHTML = `<span class="k">${escapeHtml(k)}</span><span class="v">${escapeHtml(v)}</span>`;
  return p;
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
