(() => {
  // ================================
  // Global BGM Guard（切頁不重疊）
  // Philosophy 版
  // ================================
  const BGM_KEY = "WTTF_ACTIVE_BGM";
  const CURRENT_BGM = "philosophy";

  // ✅ 這裡請確保你的 philosophy.html 裡 audio 的 id 叫 bgmPhilosophy
  // 例如：
  // <audio id="bgmPhilosophy" preload="auto" loop playsinline>
  //   <source src="assets/sounds/philosophy.mp3" type="audio/mpeg" />
  // </audio>
  const audio = document.getElementById("bgmPhilosophy");
  const muteBtn = document.getElementById("muteBtn");
  const hint = document.getElementById("autoplayHint");

  if (!audio) return;

  // HTMLAudio 的 volume 是 0~1（不是 dB）
  audio.volume = 0.15;

  function setMuted(isMuted) {
    audio.muted = isMuted;
    if (muteBtn) {
      muteBtn.setAttribute("aria-pressed", String(isMuted));
      muteBtn.textContent = isMuted ? "🔇 聲音：關" : "🔊 聲音：開";
    }
  }

  // 預設開聲音
  setMuted(false);

  function shouldPlayHere() {
    const active = sessionStorage.getItem(BGM_KEY);
    // 如果 session 指定的是別頁（例如 members），philosophy 不介入播放
    return !(active && active !== CURRENT_BGM);
  }

  async function tryAutoplay() {
    // ✅ 不該在 philosophy 播就停掉（也不顯示 hint）
    if (!shouldPlayHere()) {
      audio.pause();
      if (hint) hint.hidden = true;
      return;
    }

    // ✅ 只有在確定要由 philosophy 播時才宣告 active=philosophy
    sessionStorage.setItem(BGM_KEY, CURRENT_BGM);

    try {
      await audio.play();
      if (hint) hint.hidden = true;
    } catch (e) {
      // 瀏覽器擋自動播放（常見）
      if (hint) hint.hidden = false;
    }
  }

  // 點靜音鍵切換；同時嘗試播放（使用者互動通常可解鎖播放）
  if (muteBtn) {
    muteBtn.addEventListener("click", async () => {
      setMuted(!audio.muted);
      await tryAutoplay();
    });
  }

  // 點一下頁面也嘗試解鎖播放（手機更穩）
  document.addEventListener(
    "pointerdown",
    async () => {
      if (audio.paused) await tryAutoplay();
    },
    { once: true }
  );

  // ✅ iOS/部分手機更穩：補 touchstart
  document.addEventListener(
    "touchstart",
    async () => {
      if (audio.paused) await tryAutoplay();
    },
    { once: true, passive: true }
  );

  // ✅ 切頁/切分頁：離開就停，避免重疊
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      audio.pause();
    } else {
      tryAutoplay();
    }
  });

  // ✅ 手機切頁更穩：離開頁面就停
  window.addEventListener("pagehide", () => audio.pause());

  tryAutoplay();
})();
