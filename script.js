(() => {
  // -----------------------------
  // Copy email + feedback (auto hide after 3s)
  // -----------------------------
  const copyBtn = document.getElementById("copy-email");
  const feedback = document.getElementById("copy-feedback");
  let feedbackTimer = null;

  async function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return;
    }
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "absolute";
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

    if (feedbackTimer) clearTimeout(feedbackTimer);
    feedbackTimer = setTimeout(() => {
      feedback.classList.remove("is-visible");
      setTimeout(() => { feedback.textContent = ""; }, 250);
    }, 3000);
  }

  if (copyBtn) {
    copyBtn.addEventListener("click", async () => {
      const text = copyBtn.getAttribute("data-copy") || "";
      try {
        await copyText(text);
        showFeedback("Email copied");
      } catch {
        showFeedback("Copy failed");
      }
    });
  }

  // -----------------------------
  // Cursor takeover GIF
  // Desktop: hover follows cursor
  // Touch: tap name toggles GIF, next tap anywhere hides it
  // -----------------------------
  const trigger = document.getElementById("name-trigger");
  const cursorEl = document.getElementById("cursor-gif");
  const body = document.body;

  if (trigger && cursorEl) {
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

    // Desktop behaviour
    if (!isTouch) {
      trigger.addEventListener("mouseenter", (e) => {
        active = true;
        body.classList.add("cursor-active");
        cursorEl.style.display = "block";
        cursorEl.style.left = `${e.clientX}px`;
        cursorEl.style.top = `${e.clientY}px`;
      });

      trigger.addEventListener("mousemove", (e) => {
        if (!active) return;
        cursorEl.style.left = `${e.clientX}px`;
        cursorEl.style.top = `${e.clientY}px`;
      });

      trigger.addEventListener("mouseleave", () => {
        hide();
      });
    }

    // Touch behaviour: tap name toggles, then tap anywhere hides
    if (isTouch) {
      const onDocTapToHide = () => {
        if (!active) return;
        hide();
        document.removeEventListener("touchstart", onDocTapToHide, true);
      };

      trigger.addEventListener("touchstart", (e) => {
        e.preventDefault();

        if (active) {
          hide();
          document.removeEventListener("touchstart", onDocTapToHide, true);
          return;
        }

        const t = e.touches && e.touches[0];
        const x = t ? t.clientX : (window.innerWidth / 2);
        const y = t ? t.clientY : (window.innerHeight / 2);

        showAt(x, y);

        // next tap anywhere hides
        document.addEventListener("touchstart", onDocTapToHide, true);
      }, { passive: false });
    }
  }

  // -----------------------------
  // Ticker pause on tap (mobile) / click (desktop)
  // -----------------------------
  const ticker = document.getElementById("services-ticker");
  if (ticker) {
    ticker.addEventListener("click", () => {
      ticker.classList.toggle("is-paused");
    });
  }
})();