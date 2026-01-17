/* =========================
SCRIPT.JS (FULL)
========================= */
(() => {
  // -----------------------------
  // Copy email to clipboard
  // -----------------------------
  const copyBtn = document.getElementById("copy-email");
  const status = document.getElementById("copy-status");

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

  if (copyBtn) {
    copyBtn.addEventListener("click", async () => {
      const text = copyBtn.getAttribute("data-copy") || "";
      try {
        await copyText(text);
        if (status) status.textContent = "Email copied";
      } catch {
        if (status) status.textContent = "Copy failed";
      }
    });
  }

  // -----------------------------
  // Cursor takeover GIF
  // -----------------------------
  const trigger = document.getElementById("name-trigger");
  const cursorEl = document.getElementById("cursor-gif");
  if (!trigger || !cursorEl) return;

  const body = document.body;
  const isTouch =
    "ontouchstart" in window ||
    navigator.maxTouchPoints > 0 ||
    navigator.msMaxTouchPoints > 0;

  let active = false;
  let holdTimer = null;

  const show = () => {
    if (active) return;
    active = true;
    cursorEl.style.display = "block";
    body.classList.add("cursor-active");
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

  // Desktop hover
  if (!isTouch) {
    trigger.addEventListener("mouseenter", (e) => {
      show();
      moveTo(e.clientX, e.clientY);
    });
    trigger.addEventListener("mousemove", (e) => {
      if (!active) return;
      moveTo(e.clientX, e.clientY);
    });
    trigger.addEventListener("mouseleave", hide);
  }

  // Touch + hold
  if (isTouch) {
    const HOLD_MS = 350;

    trigger.addEventListener("touchstart", (e) => {
      if (holdTimer) clearTimeout(holdTimer);
      holdTimer = setTimeout(() => {
        const t = e.touches && e.touches[0];
        if (!t) return;
        show();
        moveTo(t.clientX, t.clientY);
      }, HOLD_MS);
    }, { passive: true });

    trigger.addEventListener("touchmove", (e) => {
      if (!active) return;
      const t = e.touches && e.touches[0];
      if (!t) return;
      moveTo(t.clientX, t.clientY);
    }, { passive: true });

    const end = () => {
      if (holdTimer) clearTimeout(holdTimer);
      holdTimer = null;
      hide();
    };

    trigger.addEventListener("touchend", end);
    trigger.addEventListener("touchcancel", end);
  }

  // -----------------------------
  // Ticker pause on tap (touch)
  // -----------------------------
  const ticker = document.getElementById("services-ticker");
  if (ticker) {
    ticker.addEventListener("click", (e) => {
      // Prevent accidental text selection / double-tap zoom behaviour
      // Toggle paused state
      ticker.classList.toggle("is-paused");
    });

    // Optional: also allow keyboard users to pause via Enter/Space if you later add tabindex
    // ticker.setAttribute("tabindex", "0");
    // ticker.addEventListener("keydown", (e) => {
    //   if (e.key === "Enter" || e.key === " ") {
    //     e.preventDefault();
    //     ticker.classList.toggle("is-paused");
    //   }
    // });
  }
})();
