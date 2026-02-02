(() => {
  const BGM_KEY = "WTTF_ACTIVE_BGM";
  const CURRENT_BGM = "index";

  const audio = document.getElementById("bgm");
  const muteBtn = document.getElementById("muteBtn");
  const hint = document.getElementById("autoplayHint");

  if (!audio) return;

  // 預設音量
  audio.volume = 0.15;

  function setMuted(isMuted) {
    audio.muted = isMuted;
    if (muteBtn) {
      muteBtn.setAttribute("aria-pressed", String(isMuted));
      muteBtn.textContent = isMuted ? "🔇 聲音：關" : "🔊 聲音：開";
    }
  }

  // 預設不靜音
  setMuted(false);

  function shouldPlayHere() {
    const active = sessionStorage.getItem(BGM_KEY);
    // 如果目前 session 指定的是別頁音樂（例如 members），就不要在 index 播
    return !(active && active !== CURRENT_BGM);
  }

  async function tryPlay() {
    if (!shouldPlayHere()) {
      // 其他頁正在當 active，index 不介入
      audio.pause();
      if (hint) hint.hidden = true;
      return;
    }

    // 宣告：現在 active 是 index（只有確定要播時才寫）
    sessionStorage.setItem(BGM_KEY, CURRENT_BGM);

    try {
      await audio.play();
      if (hint) hint.hidden = true;
    } catch (e) {
      if (hint) hint.hidden = false;
    }
  }

  // mute 按鈕
  if (muteBtn) {
    muteBtn.addEventListener("click", async () => {
      setMuted(!audio.muted);

      // 使用者互動後通常可以播放
      await tryPlay();
    });
  }

  // 任何一次互動也嘗試解鎖播放（手機常用）
  document.addEventListener(
    "pointerdown",
    async () => {
      if (audio.paused) await tryPlay();
    },
    { once: true }
  );

  // ✅ 離開頁面（切分頁/切頁）就停，避免重疊
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) audio.pause();
    // 回到頁面時：看 shouldPlayHere 再決定要不要續播
    else tryPlay();
  });

  // 初次嘗試播放
  tryPlay();
})();
