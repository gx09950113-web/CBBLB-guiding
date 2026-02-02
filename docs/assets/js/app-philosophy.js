(() => {
  const audio = document.getElementById("bgm");
  const muteBtn = document.getElementById("muteBtn");
  const hint = document.getElementById("autoplayHint");

  // HTMLAudio 的 volume 是 0~1（不是 dB）
  // 這裡用 0.15 作為「小聲但聽得到」的預設
  audio.volume = 0.15;

  function setMuted(isMuted) {
    audio.muted = isMuted;
    muteBtn.setAttribute("aria-pressed", String(isMuted));
    muteBtn.textContent = isMuted ? "🔇 聲音：關" : "🔊 聲音：開";
  }

  // 預設開聲音，嘗試自動播放
  setMuted(false);

  async function tryAutoplay() {
    try {
      await audio.play();
      hint.hidden = true;
    } catch (e) {
      // 瀏覽器擋自動播放（常見）
      hint.hidden = false;
    }
  }

  // 點靜音鍵切換；同時嘗試播放（使用者互動通常可解鎖播放）
  muteBtn.addEventListener("click", async () => {
    setMuted(!audio.muted);
    try {
      await audio.play();
      hint.hidden = true;
    } catch (e) {
      hint.hidden = false;
    }
  });

  // 點一下頁面也嘗試解鎖播放（手機更穩）
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

  tryAutoplay();
})();
