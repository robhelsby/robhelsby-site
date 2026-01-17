(() => {
  // Copy email + auto-hide feedback
  const copyBtn = document.getElementById("copy-email");
  const feedback = document.getElementById("copy-feedback");
  let feedbackTimer;

  async function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return;
    }
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
  }

  function showFeedback(msg) {
    if (!feedback) return;
    feedback.textContent = msg;
    feedback.classList.add("is-visible");
    clearTimeout(feedbackTimer);
    feedbackTimer = setTimeout(() => {
      feedback.classList.remove("is-visible");
      setTimeout(() => (feedback.textContent = ""), 200);
    }, 3000);
  }

  if (copyBtn) {
    copyBtn.addEventListener("click", async () => {
      try {
        await copyText(copyBtn.getAttribute("data-copy") || "");
        showFeedback("Email copied");
      } catch {
        showFeedback("Copy failed");
      }
    });
  }

  // Ticker: tap/click toggles pause
  const ticker = document.getElementById("services-ticker");
  if (ticker) {
    ticker.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      ticker.classList.toggle("is-paused");
    });
  }

  // GIF: desktop hover follows cursor; mobile tap name toggles, tap anywhere hides (except ticker)
  const trigger = document.getElementById("name-trigger");
  const cursorEl = document.getElementById("cursor-gif");
  if (!trigger || !cursorEl) return;

  const body = document.body;
  const isTouch =
    "ontouchstart" in window ||
    navigator.maxTouchPoints > 0 ||
    navigator.msMaxTouchPoints > 0;

  let active = false;

  const showAt = (x, y) => {
    active = true;
    cursorEl.style.display = "block";
    cursorEl.style.left = `${x}px`;
    cursorEl.style.top = `${y}px`;
  };

  const hide = () => {
    active = false;
    cursorEl.style.display = "none";
    body.classList.remove("cursor-active");
  };

  const moveTo = (x, y) => {
    cursorEl.style.left = `${x}px`;
    cursorEl.style.top = `${y}px`;
  };

  if (!isTouch) {
    trigger.addEventListener("mouseenter", (e) => {
      active = true;
      body.classList.add("cursor-active");
      cursorEl.style.display = "block";
      moveTo(e.clientX, e.clientY);
    });
    trigger.addEventListener("mousemove", (e) => {
      if (!active) return;
      moveTo(e.clientX, e.clientY);
    });
    trigger.addEventListener("mouseleave", hide);
    return;
  }

  const onDocTapToHide = (e) => {
    if (!active) return;
    if (e.target.closest("#services-ticker")) return;
    if (e.target.closest("#name-trigger")) return;
    hide();
    document.removeEventListener("pointerdown", onDocTapToHide, true);
  };

  trigger.addEventListener("pointerdown", (e) => {
    e.preventDefault();

    if (active) {
      hide();
      document.removeEventListener("pointerdown", onDocTapToHide, true);
      return;
    }

    showAt(e.clientX || innerWidth / 2, e.clientY || innerHeight / 2);
    document.addEventListener("pointerdown", onDocTapToHide, true);
  });
})();