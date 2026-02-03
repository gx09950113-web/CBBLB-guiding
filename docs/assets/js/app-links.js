/* =========================================================
   WTTF - app-links.js
   - 讀取 JSON 渲染外部連結卡片
   - Links BGM：預設播放 + 可靜音
   - 切頁不重疊：用 localStorage + storage event 協調
========================================================= */

(() => {
  const DATA_URL = "assets/data/links/links.json";

  // ===== DOM =====
  const grid = document.getElementById("linksGrid");
  const hint = document.getElementById("linksHint");

  const audio = document.getElementById("bgmLinks");
  const muteBtn = document.getElementById("muteBtnLinks");

  // ===== BGM: 基本參數（「5分貝」用低音量近似）=====
  // 瀏覽器音量是 0~1，這裡用偏小值模擬「5db 很小聲」
  const DEFAULT_VOLUME = 0.18;

  // ===== 切頁不重疊 key =====
  const STORAGE_KEY = "WTTF_ACTIVE_BGM"; // value: unique page token
  const MY_TOKEN = `links_${Date.now()}_${Math.random().toString(16).slice(2)}`;

  // ===== 小工具 =====
  const safeText = (s) => (typeof s === "string" ? s : "");
  const safeUrl = (s) => (typeof s === "string" ? s : "");

  function setHint(msg) {
    if (!hint) return;
    if (!msg) {
      hint.hidden = true;
      hint.textContent = "";
      return;
    }
    hint.hidden = false;
    hint.textContent = msg;
  }

  // ===== Render =====
  function renderLinks(items) {
    if (!grid) return;

    grid.innerHTML = "";

    if (!Array.isArray(items) || items.length === 0) {
      setHint("目前沒有外部連結資料（links.json 為空或尚未建立）。");
      return;
    }

    setHint("");

    const frag = document.createDocumentFragment();

    items.forEach((it) => {
      const title = safeText(it.title || it.text || "未命名連結");
      const url = safeUrl(it.url || it.href || "");
      const desc = safeText(it.description || it.desc || "");
      const tag = safeText(it.tag || "");

      const card = document.createElement("article");
      card.className = "link-card";
      card.tabIndex = 0;

      const a = document.createElement("a");
      a.className = "link-card__a";
      a.href = url || "#";
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.ariaLabel = title;

      const h = document.createElement("h3");
      h.className = "link-card__title";
      h.textContent = title;

      const p = document.createElement("p");
      p.className = "link-card__desc";
      p.textContent = desc;

      const meta = document.createElement("div");
      meta.className = "link-card__meta";

      if (tag) {
        const pill = document.createElement("span");
        pill.className = "pill";
        pill.textContent = tag;
        meta.appendChild(pill);
      }

      const urlTxt = document.createElement("span");
      urlTxt.className = "link-card__url";
      urlTxt.textContent = url ? url.replace(/^https?:\/\//, "") : "（未提供網址）";
      meta.appendChild(urlTxt);

      a.appendChild(h);
      if (desc) a.appendChild(p);
      a.appendChild(meta);

      card.appendChild(a);

      // 鍵盤可用性：Enter 也能開新分頁
      card.addEventListener("keydown", (e) => {
        if (e.key === "Enter") a.click();
      });

      frag.appendChild(card);
    });

    grid.appendChild(frag);
  }

  async function loadLinks() {
    try {
      setHint("載入中…");
      const res = await fetch(DATA_URL, { cache: "no-store" });
      if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
      const data = await res.json();

      // 允許兩種格式：
      // 1) { "links": [ ... ] }
      // 2) [ ... ]
      const items = Array.isArray(data) ? data : (data && Array.isArray(data.links) ? data.links : []);
      renderLinks(items);
    } catch (err) {
      console.error(err);
      setHint("讀取 links.json 失敗：請確認檔案路徑與 JSON 格式是否正確。");
      renderLinks([]);
    }
  }

  // ===== BGM: 切頁不重疊 =====
  function becomeActiveBgmOwner() {
    try {
      localStorage.setItem(STORAGE_KEY, MY_TOKEN);
    } catch (_) {}
  }

  function isActiveOwner() {
    try {
      return localStorage.getItem(STORAGE_KEY) === MY_TOKEN;
    } catch (_) {
      return true; // localStorage 失效就退化為本頁自己控
    }
  }

  function enforceSingleBgm() {
    if (!audio) return;
    if (!isActiveOwner()) {
      audio.pause();
    }
  }

  // 當其他頁面宣告成為 active owner，本頁就停
  window.addEventListener("storage", (e) => {
    if (e.key !== STORAGE_KEY) return;
    enforceSingleBgm();
  });

  // 本頁一顯示就搶 owner；隱藏就不搶（但不強制釋放，避免來回閃）
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      becomeActiveBgmOwner();
      // 若靜音狀態允許，就嘗試播放
      if (audio && !audio.muted) audio.play().catch(()=>{});
    } else {
      // 避免背景頁還在響
      if (audio) audio.pause();
    }
  });

  // ===== BGM: 靜音按鈕 =====
  function updateMuteUi() {
    if (!muteBtn || !audio) return;
    const muted = audio.muted || audio.volume === 0;
    muteBtn.setAttribute("aria-pressed", muted ? "true" : "false");
    muteBtn.textContent = muted ? "🔊 取消靜音" : "🔇 靜音";
  }

  function initAudio() {
    if (!audio) return;

    audio.volume = DEFAULT_VOLUME;

    // 進頁先宣告本頁為 active，確保別頁停下來
    becomeActiveBgmOwner();
    enforceSingleBgm();

    // 嘗試 autoplay（可能會被瀏覽器擋）
    audio.play().catch(() => { /* ignore */ });

    updateMuteUi();

    if (muteBtn) {
      muteBtn.addEventListener("click", async () => {
        // 點擊代表使用者手勢：順便把 owner 搶回來
        becomeActiveBgmOwner();

        if (!audio.muted && audio.volume > 0) {
          audio.muted = true;
          audio.pause();
        } else {
          audio.muted = false;
          audio.volume = DEFAULT_VOLUME;
          try { await audio.play(); } catch (_) {}
        }
        updateMuteUi();
      });
    }
  }

  // ===== 一些本頁建議樣式（若 style.css 沒有這些 class，會退化但仍可用）=====
  // 你若想把這些寫進 style.css，也可以照 class 名貼上。
  function injectMinimalStylesIfNeeded() {
    const needed = ["links-grid","link-card","bottom-nav","nav-item","is-current","site-footer","pill"];
    const exists = needed.some(cls => document.querySelector(`.${cls}`));
    // 若你已經在 style.css 做了同名 class，可直接刪掉這段
    // 這段只補最基本排版，不影響你既有主題風格
    if (!exists) return;

    const css = `
      .container{ width:min(1100px, calc(100% - 28px)); margin:0 auto; padding: 160px 0 90px; }
      .page-head{ text-align:center; margin-bottom: 18px; }
      .page-title{ font-size: 28px; margin: 0 0 8px; }
      .page-subtitle{ opacity:.85; margin: 0; }
      .hint{ text-align:center; opacity:.9; margin: 16px 0 0; }

      .links-grid{
        display:grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 14px;
        margin-top: 18px;
      }
      @media (max-width: 980px){
        .links-grid{ grid-template-columns: repeat(2, minmax(0, 1fr)); }
      }
      @media (max-width: 560px){
        .links-grid{ grid-template-columns: 1fr; }
      }

      .link-card{
        background: rgba(0,0,0,.45);
        border: 1px solid rgba(255,255,255,.18);
        border-radius: 16px;
        box-shadow: 0 10px 24px rgba(0,0,0,.35);
        overflow:hidden;
        transform: translateY(0);
        transition: transform .18s ease, box-shadow .18s ease, border-color .18s ease;
      }
      .link-card:hover, .link-card:focus-within{
        transform: translateY(-4px);
        border-color: rgba(255,255,255,.28);
        box-shadow: 0 16px 30px rgba(0,0,0,.45);
      }
      .link-card__a{
        display:block;
        padding: 14px 14px 12px;
        color: inherit;
        text-decoration: none;
      }
      .link-card__title{ margin:0 0 8px; font-size: 18px; }
      .link-card__desc{ margin:0 0 10px; opacity:.9; line-height: 1.5; }
      .link-card__meta{
        display:flex;
        align-items:center;
        justify-content: space-between;
        gap:10px;
        opacity:.9;
        font-size: 12px;
      }
      .pill{
        display:inline-flex;
        align-items:center;
        padding: 3px 10px;
        border-radius: 999px;
        background: rgba(255,255,255,.12);
        border: 1px solid rgba(255,255,255,.16);
        white-space: nowrap;
      }
      .link-card__url{
        overflow:hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        max-width: 60%;
      }

      .bottom-nav{
        position: fixed;
        left: 50%;
        transform: translateX(-50%);
        bottom: 14px;
        display:flex;
        gap: 10px;
        padding: 10px 12px;
        border-radius: 999px;
        background: rgba(0,0,0,.55);
        border: 1px solid rgba(255,255,255,.16);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        z-index: 50;
        flex-wrap: wrap;
        justify-content: center;
        max-width: min(1100px, calc(100% - 24px));
      }
      .nav-item{
        color: inherit;
        text-decoration:none;
        padding: 8px 10px;
        border-radius: 999px;
        border: 1px solid transparent;
        background: rgba(255,255,255,.06);
        font-size: 14px;
        white-space: nowrap;
      }
      .nav-item:hover{ background: rgba(255,255,255,.12); }
      .nav-item.is-current{
        background: rgba(255,255,255,.18);
        border-color: rgba(255,255,255,.22);
      }

      .site-footer{
        text-align:center;
        padding: 22px 0 110px;
        opacity:.85;
      }
    `;
    const style = document.createElement("style");
    style.textContent = css;
    document.head.appendChild(style);
  }

  // ===== init =====
  loadLinks();
  initAudio();
  injectMinimalStylesIfNeeded();
})();
