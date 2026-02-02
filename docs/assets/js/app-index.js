(() => {
  const BGM_KEY = "WTTF_ACTIVE_BGM";
  const CURRENT_BGM = "index";

  const audio = document.getElementById("bgm");
  const muteBtn = document.getElementById("muteBtn");
  const hint = document.getElementById("autoplayHint");

  if (!audio) return;

  audio.volume = 0.15;
  audio.loop = true;
  audio.playsInline = true;

  function setMuted(isMuted) {
    audio.muted = isMuted;
    if (muteBtn) {
      muteBtn.setAttribute("aria-pressed", String(isMuted));
      muteBtn.textContent = isMuted ? "🔇 聲音：關" : "🔊 聲音：開";
    }
  }

  setMuted(false);

  // ✅ 回到 index：一律允許 index 成為 active（否則會被上一頁鎖死）
  function shouldPlayHere() {
    return true;
  }

  async function tryPlay() {
    if (!shouldPlayHere()) {
      audio.pause();
      if (hint) hint.hidden = true;
      return;
    }

    // 宣告：現在 active 是 index
    sessionStorage.setItem(BGM_KEY, CURRENT_BGM);

    try {
      await audio.play();
      if (hint) hint.hidden = true;
    } catch (e) {
      if (hint) hint.hidden = false;
    }
  }

  if (muteBtn) {
    muteBtn.addEventListener("click", async () => {
      setMuted(!audio.muted);
      await tryPlay(); // 互動後通常可解鎖播放
    });
  }

  // ✅ 互動解鎖：pointerdown + touchstart（iOS 更穩）
  document.addEventListener("pointerdown", async () => {
    if (audio.paused) await tryPlay();
  }, { once: true });

  document.addEventListener("touchstart", async () => {
    if (audio.paused) await tryPlay();
  }, { once: true, passive: true });

  // ✅ 切分頁/切頁：停/回來再播
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) audio.pause();
    else tryPlay();
  });

  window.addEventListener("pagehide", () => audio.pause());

  tryPlay();
})();
