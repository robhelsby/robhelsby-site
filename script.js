(() => {
  const neon = "#76FA4C";

  // -----------------------------
  // Copy email to clipboard
  // -----------------------------
  const copyBtn = document.getElementById("copy-email");
  const status = document.getElementById("copy-status");

  async function copyText(text) {
    // Prefer Clipboard API
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return;
    }

    // Fallback for older browsers
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
        copyBtn.classList.add("copied");
        setTimeout(() => copyBtn.classList.remove("copied"), 600);
      } catch {
        if (status) status.textContent = "Copy failed";
      }
    });
  }

  // -----------------------------
  // Cursor takeover (GIF follows pointer)
  // Desktop: hover
  // Touch: press + hold
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

  // Desktop hover behaviour
  if (!isTouch) {
    trigger.addEventListener("mouseenter", (e) => {
      show();
      moveTo(e.clientX, e.clientY);
    });

    trigger.addEventListener("mousemove", (e) => {
      if (!active) return;
      moveTo(e.clientX, e.clientY);
    });

    trigger.addEventListener("mouseleave", () => hide());
  }

  // Touch + hold behaviour
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

    const cancelHold = () => {
      if (holdTimer) clearTimeout(holdTimer);
      holdTimer = null;
      hide();
    };

    trigger.addEventListener("touchend", cancelHold);
    trigger.addEventListener("touchcancel", cancelHold);
  }
})();
