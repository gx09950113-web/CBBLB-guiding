(() => {
  const audio = document.getElementById("bgm");
  const btnMute = document.getElementById("btnMute");
  const tapToPlay = document.getElementById("tapToPlay");

  if (!audio || !btnMute) return;

  // 你指定「預設播放音量 15db」
  // 以一般網頁音量理解：-15 dB（衰減 15 dB）≈ 10^(-15/20) ≈ 0.178
  const gainMinus15dB = Math.pow(10, -15 / 20);
  audio.volume = gainMinus15dB;

  const setBtnLabel = () => {
    // muted 或音量 0 都視為靜音
    const muted = audio.muted || audio.volume === 0;
    btnMute.textContent = muted ? "🔇 靜音中" : "🔊 音樂";
  };

  const tryAutoplay = async () => {
    try {
      // iOS / Chrome 等可能會擋
      await audio.play();
      tapToPlay.hidden = true;
      setBtnLabel();
    } catch (err) {
      // 自動播放被擋 → 顯示提示
      tapToPlay.hidden = false;
      setBtnLabel();
    }
  };

  // 靜音切換
  btnMute.addEventListener("click", async () => {
    audio.muted = !audio.muted;

    // 如果剛好被擋，這次點擊是「使用者互動」，通常可以成功播放
    if (!audio.muted) {
      try {
        await audio.play();
        tapToPlay.hidden = true;
      } catch (e) {
        tapToPlay.hidden = false;
      }
    }

    setBtnLabel();
  });

  // 若被擋，點任意處也能啟動
  const unlock = async () => {
    try {
      await audio.play();
      tapToPlay.hidden = true;
      document.removeEventListener("click", unlock);
      document.removeEventListener("touchstart", unlock);
    } catch (e) {
      // 仍被擋就保持提示
      tapToPlay.hidden = false;
    }
    setBtnLabel();
  };

  document.addEventListener("click", unlock, { passive: true });
  document.addEventListener("touchstart", unlock, { passive: true });

  // 首次嘗試
  setBtnLabel();
  tryAutoplay();
})();
