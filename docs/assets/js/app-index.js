(() => {
  const BGM_KEY = "WTTF_ACTIVE_BGM";
  const CURRENT_BGM = "index";

  const audio = document.getElementById("bgmMembers");
  if (!audio) return;

  // 固定設定：音量 0.15、不提供關閉
  audio.volume = 0.15;
  audio.loop = true;

  // members 進來就宣告：此頁是 active
  sessionStorage.setItem(BGM_KEY, CURRENT_BGM);

  async function tryPlay() {
    try {
      await audio.play();
    } catch (e) {
      // 自動播放被擋：此頁不顯示提示
      // 等使用者點分類/卡片時通常就會解鎖
    }
  }

  // 手機更穩：第一次互動時確保播放
  document.addEventListener(
    "pointerdown",
    async () => {
      if (audio.paused) await tryPlay();
    },
    { once: true }
  );

  // 切頁/切分頁：離開就停，避免重疊
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      audio.pause();
    } else {
      sessionStorage.setItem(BGM_KEY, CURRENT_BGM);
      tryPlay();
    }
  });

  // 初次嘗試播放
  tryPlay();
})();
