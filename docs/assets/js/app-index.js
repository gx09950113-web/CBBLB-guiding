(() => {
  const audio = document.getElementById("bgm");
  const muteBtn = document.getElementById("muteBtn");
  const hint = document.getElementById("autoplayHint");

  // 你說「預設播放音量 15db」
  // Web Audio/HTMLAudio 的 volume 是 0~1 線性值，不是 dB。
  // 這裡用 0.15 當作「15% 音量」的合理對應（等同於偏小聲）。
  audio.volume = 0.15;

  function setMuted(isMuted) {
    audio.muted = isMuted;
    muteBtn.setAttribute("aria-pressed", String(isMuted));
    muteBtn.textContent = isMuted ? "🔇 聲音：關" : "🔊 聲音：開";
  }

  // 預設不靜音，嘗試自動播放
  setMuted(false);

  async function tryAutoplay() {
    try {
      await audio.play();
      hint.hidden = true;
    } catch (e) {
      // 自動播放被擋住：顯示提示
      hint.hidden = false;
    }
  }

  // 點按靜音按鈕：切換靜音；若還沒播放，順便嘗試播放
  muteBtn.addEventListener("click", async () => {
    const nextMuted = !audio.muted;
    setMuted(nextMuted);

    // 如果使用者剛互動，通常就允許播放了
    try {
      await audio.play();
      hint.hidden = true;
    } catch (e) {
      // 仍被擋也沒關係
      hint.hidden = false;
    }
  });

  // 使用者點任何地方，也嘗試解鎖播放（更符合手機實際狀況）
  document.addEventListener("pointerdown", async () => {
    if (audio.paused) {
      try {
        await audio.play();
        hint.hidden = true;
      } catch (e) {
        hint.hidden = false;
      }
    }
  }, { once: true });

  // 開始嘗試自動播放
  tryAutoplay();
})();
