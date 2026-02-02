/* =========================================================
   WTTF - events.js
   - 讀取 data/events.json
   - 渲染階梯狀左右交錯卡片
   - 背景音樂預設播放、可靜音
   - 音樂切頁不重疊（簡易通用版）
========================================================= */

const EVENTS_JSON = "data/events.json";
const AUDIO_KEY = "wttf_active_bgm"; // 用來避免同一分頁切換造成多音軌

document.addEventListener("DOMContentLoaded", () => {
  const audio = document.getElementById("bgmEvents");
  const muteBtn = document.getElementById("muteBtnEvents");

  setupExclusiveBgm(audio, AUDIO_KEY);
  setupMuteButton(audio, muteBtn);

  loadAndRenderEvents();
});

/** 音樂：切頁不重疊（同網域同分頁） */
function setupExclusiveBgm(audioEl, storageKey) {
  // 先停掉頁面內其他 audio（保險）
  document.querySelectorAll("audio").forEach(a => {
    if (a !== audioEl) {
      try { a.pause(); } catch {}
      a.currentTime = 0;
    }
  });

  // -15 dB 轉成 HTMLAudioElement.volume (0~1)
  // dB = 20*log10(A) => A = 10^(dB/20)
  // -15dB => 約 0.1778
  audioEl.volume = 0.05;

  // 記錄目前這頁的 bgm（同一個 tab 切頁時避免殘留）
  try {
    sessionStorage.setItem(storageKey, location.pathname);
  } catch {}

  // 某些手機/瀏覽器會擋 autoplay：遇到就等使用者互動再播
  const tryPlay = () => audioEl.play().catch(() => {});
  tryPlay();

  // 回到此頁（bfcache）時確保不重疊
  window.addEventListener("pageshow", () => {
    // 如果 sessionStorage 記錄不是本頁，表示剛切回來或切頁流程怪異：重置播放狀態
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
  });
}

/** 靜音按鈕 */
function setupMuteButton(audioEl, btnEl) {
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

  grid.innerHTML = "";

  try {
    const res = await fetch(EVENTS_JSON, { cache: "no-store" });
    if (!res.ok) throw new Error("events.json 讀取失敗");
    const data = await res.json();

    const events = Array.isArray(data?.events) ? data.events : [];
    if (!events.length) {
      hint.hidden = false;
      return;
    }
    hint.hidden = true;

    const now = new Date();
    const normalized = events
      .map((e, idx) => normalizeEvent(e, idx))
      .filter(Boolean);

    // 讓「即將到來」排前面（依 startDate），沒有日期的排最後
    normalized.sort((a, b) => {
      const ad = a.startDate ? a.startDate.getTime() : Number.POSITIVE_INFINITY;
      const bd = b.startDate ? b.startDate.getTime() : Number.POSITIVE_INFINITY;
      return ad - bd;
    });

    const frag = document.createDocumentFragment();
    normalized.forEach((ev, i) => {
      const card = renderEventCard(ev, now, i);
      frag.appendChild(card);
    });
    grid.appendChild(frag);
  } catch (err) {
    hint.hidden = false;
    hint.textContent = "活動資料讀取失敗，請確認 data/events.json 是否存在。";
  }
}

/** 事件資料整理（允許你 JSON 欄位缺少） */
function normalizeEvent(raw, idx) {
  if (!raw || typeof raw !== "object") return null;

  const title = String(raw.title ?? raw.name ?? `活動 ${idx + 1}`);
  const desc = String(raw.description ?? raw.desc ?? "");
  const location = String(raw.location ?? raw.place ?? "");
  const link = raw.link ? String(raw.link) : "";
  const tag = raw.tag ? String(raw.tag) : "";

  const startDate = parseDateSafe(raw.start ?? raw.startDate ?? raw.date ?? "");
  const endDate = parseDateSafe(raw.end ?? raw.endDate ?? "");

  return { title, desc, location, link, tag, startDate, endDate };
}

/** 解析 YYYY-MM-DD 或 ISO */
function parseDateSafe(v) {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatDate(d) {
  if (!d) return "";
  // 以 zh-Hant 顯示日期
  try {
    return new Intl.DateTimeFormat("zh-Hant", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      weekday: "short"
    }).format(d);
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

/** 判斷狀態：過往 / 即將 / 進行中 */
function getStatus(ev, now) {
  const s = ev.startDate;
  const e = ev.endDate;

  if (s && s.getTime() > now.getTime()) return "upcoming";
  if (s && e && s.getTime() <= now.getTime() && now.getTime() <= e.getTime()) return "ongoing";
  if (s && s.getTime() <= now.getTime()) return "past";
  return "unknown";
}

function renderEventCard(ev, now, index) {
  const status = getStatus(ev, now);

  const article = document.createElement("article");
  article.className = `event-card status-${status}`;
  article.style.setProperty("--step", String(index)); // 給 CSS 做階梯位移用

  const header = document.createElement("div");
  header.className = "event-card__header";

  const h3 = document.createElement("h3");
  h3.className = "event-card__title";
  h3.textContent = ev.title;

  const badge = document.createElement("span");
  badge.className = "event-card__badge";
  badge.textContent =
    status === "upcoming" ? "即將到來" :
    status === "ongoing" ? "進行中" :
    status === "past" ? "既往活動" : "活動";

  header.appendChild(h3);
  header.appendChild(badge);

  const meta = document.createElement("div");
  meta.className = "event-card__meta";

  const dateText = [ev.startDate ? formatDate(ev.startDate) : "", ev.endDate ? formatDate(ev.endDate) : ""]
    .filter(Boolean)
    .join(" ～ ");

  if (dateText) {
    const p = document.createElement("p");
    p.className = "event-card__row";
    p.innerHTML = `<span class="k">日期</span><span class="v">${escapeHtml(dateText)}</span>`;
    meta.appendChild(p);
  }

  if (ev.location) {
    const p = document.createElement("p");
    p.className = "event-card__row";
    p.innerHTML = `<span class="k">地點</span><span class="v">${escapeHtml(ev.location)}</span>`;
    meta.appendChild(p);
  }

  if (ev.tag) {
    const p = document.createElement("p");
    p.className = "event-card__row";
    p.innerHTML = `<span class="k">分類</span><span class="v">${escapeHtml(ev.tag)}</span>`;
    meta.appendChild(p);
  }

  const body = document.createElement("div");
  body.className = "event-card__body";

  if (ev.desc) {
    const p = document.createElement("p");
    p.className = "event-card__desc";
    p.textContent = ev.desc;
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

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
