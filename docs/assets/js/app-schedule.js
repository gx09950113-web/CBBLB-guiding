/* =========================================================
   WTTF - schedule.js
   - 自動載入當月行程圖片：assets/img/Schedule/YYYYMM.png
   - 定時偵測月份變更：跨月自動切換（不用重整）
   - 手機：雙指 pinch 縮放 + 拖曳
   - PC：自動適應 + 滾輪縮放
   - BGM：預設播放、音量 0.05、靜音按鈕
   - 切頁不重疊：BroadcastChannel 通知其他頁停止
========================================================= */

(() => {
  const audio = document.getElementById("bgmSchedule");
  const muteBtn = document.getElementById("muteBtn");
  const resetZoomBtn = document.getElementById("resetZoomBtn");

  const img = document.getElementById("scheduleImg");
  const monthLabel = document.getElementById("monthLabel");

  const viewport = document.getElementById("viewport");
  const stage = document.getElementById("stage");

  /* ---------------------------
     0) 依月份自動更換圖片
  --------------------------- */
  function pad2(n){ return String(n).padStart(2, "0"); }

  function getYYYYMM(date = new Date()){
    const y = date.getFullYear();
    const m = pad2(date.getMonth() + 1);
    return `${y}${m}`;
  }

  function setScheduleImageByMonth(date = new Date()){
    const yyyymm = getYYYYMM(date);
    const src = `assets/img/Schedule/${yyyymm}.png`;
    img.src = src;

    // 顯示月份標籤：2026-02
    const y = yyyymm.slice(0, 4);
    const m = yyyymm.slice(4, 6);
    monthLabel.textContent = `${y}-${m} 行程表`;

    // 沒有該月圖檔時 fallback
    img.onerror = () => {
      const fallback = "assets/img/Schedule/202602.png";
      img.src = fallback;
      monthLabel.textContent = "行程表（預設圖）";
    };

    return yyyymm;
  }

  /* ---------------------------
     0.5) 定時偵測月份變更（跨月自動換圖）
     - 每 30 秒檢查一次（你可改）
     - 視窗回到前景時也會檢查一次
  --------------------------- */
  let currentYYYYMM = "";

  function setupMonthWatcher(){
    currentYYYYMM = setScheduleImageByMonth(new Date());

    const check = () => {
      const nowYYYYMM = getYYYYMM(new Date());
      if (nowYYYYMM !== currentYYYYMM) {
        currentYYYYMM = setScheduleImageByMonth(new Date());
        // 換月份時順便回到 100%（避免上個月放很大）
        resetTransform();
      }
    };

    // 定時檢查
    setInterval(check, 30 * 1000);

    // 回到分頁/視窗前景也檢查
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") check();
    });
  }

  /* ---------------------------
     1) BGM 切頁不重疊（BroadcastChannel）
  --------------------------- */
  const CHANNEL_NAME = "wttf-bgm";
  const pageId = `schedule-${Math.random().toString(16).slice(2)}`;
  let bc = null;

  function setupBgmChannel(){
    if (!("BroadcastChannel" in window)) return;

    bc = new BroadcastChannel(CHANNEL_NAME);

    bc.onmessage = (ev) => {
      const msg = ev?.data;
      if (!msg || msg.type !== "stop") return;
      if (msg.from === pageId) return;
      try { audio.pause(); } catch {}
    };

    // 本頁播放前先叫其他頁停
    bc.postMessage({ type: "stop", from: pageId });
  }

  /* ---------------------------
     2) BGM 初始化 + 靜音按鈕
  --------------------------- */
  function updateMuteUI(){
    const muted = audio.muted;
    muteBtn.setAttribute("aria-pressed", muted ? "true" : "false");
    muteBtn.textContent = muted ? "🔇" : "🔊";
  }

  async function tryAutoplay(){
    audio.volume = 0.05;

    try {
      await audio.play();
    } catch {
      const resume = async () => {
        try { await audio.play(); } catch {}
      };
      window.addEventListener("pointerdown", resume, { once: true });
    }
  }

  function setupMuteButton(){
    updateMuteUI();
    muteBtn.addEventListener("click", async () => {
      audio.muted = !audio.muted;
      updateMuteUI();

      if (!audio.muted) {
        try { await audio.play(); } catch {}
      }
    });
  }

  function setupPageLifecycle(){
    window.addEventListener("pagehide", () => {
      try { audio.pause(); } catch {}
      if (bc) {
        try { bc.postMessage({ type: "stop", from: pageId }); } catch {}
      }
    });
  }

  /* ---------------------------
     3) 圖片縮放/拖曳（Pointer Events）
  --------------------------- */
  const state = {
    scale: 1,
    minScale: 1,
    maxScale: 4,
    x: 0,
    y: 0,

    pointers: new Map(),
    startDist: 0,
    startScale: 1,
    lastPanX: 0,
    lastPanY: 0,
    isPanning: false
  };

  function clamp(v, min, max){ return Math.max(min, Math.min(max, v)); }

  function applyTransform(){
    stage.style.transform = `translate(${state.x}px, ${state.y}px) scale(${state.scale})`;
  }

  function resetTransform(){
    state.scale = 1;
    state.x = 0;
    state.y = 0;
    applyTransform();
  }

  function getDistance(a, b){
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.hypot(dx, dy);
  }

  function onPointerDown(e){
    viewport.setPointerCapture?.(e.pointerId);
    state.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (state.pointers.size === 1) {
      state.isPanning = true;
      state.lastPanX = e.clientX;
      state.lastPanY = e.clientY;
    }

    if (state.pointers.size === 2) {
      const pts = Array.from(state.pointers.values());
      state.startDist = getDistance(pts[0], pts[1]);
      state.startScale = state.scale;
      state.isPanning = false;
    }
  }

  function onPointerMove(e){
    if (!state.pointers.has(e.pointerId)) return;
    state.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (state.pointers.size === 1 && state.isPanning) {
      const dx = e.clientX - state.lastPanX;
      const dy = e.clientY - state.lastPanY;
      state.lastPanX = e.clientX;
      state.lastPanY = e.clientY;

      state.x += dx;
      state.y += dy;
      applyTransform();
      return;
    }

    if (state.pointers.size === 2) {
      const pts = Array.from(state.pointers.values());
      const dist = getDistance(pts[0], pts[1]);
      if (!state.startDist) return;

      const raw = (dist / state.startDist) * state.startScale;
      state.scale = clamp(raw, state.minScale, state.maxScale);
      applyTransform();
    }
  }

  function onPointerUp(e){
    state.pointers.delete(e.pointerId);

    if (state.pointers.size === 0) {
      state.isPanning = false;
      state.startDist = 0;
    }

    if (state.pointers.size === 1) {
      const only = Array.from(state.pointers.values())[0];
      state.isPanning = true;
      state.lastPanX = only.x;
      state.lastPanY = only.y;
      state.startDist = 0;
    }
  }

  function onWheel(e){
    e.preventDefault();
    const delta = -e.deltaY;
    const step = delta > 0 ? 0.08 : -0.08;
    state.scale = clamp(state.scale + step, state.minScale, state.maxScale);
    applyTransform();
  }

  function setupZoomAndPan(){
    resetTransform();

    viewport.addEventListener("pointerdown", onPointerDown);
    viewport.addEventListener("pointermove", onPointerMove);
    viewport.addEventListener("pointerup", onPointerUp);
    viewport.addEventListener("pointercancel", onPointerUp);

    viewport.addEventListener("wheel", onWheel, { passive: false });

    resetZoomBtn?.addEventListener("click", resetTransform);
  }

  /* ---------------------------
     init
  --------------------------- */
  function init(){
    setupMonthWatcher();     // ✅ 這裡包含第一次載入 setScheduleImageByMonth()
    setupBgmChannel();
    setupMuteButton();
    setupPageLifecycle();
    setupZoomAndPan();
    tryAutoplay();
  }

  init();
})();
