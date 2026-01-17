(() => {
  const trigger = document.getElementById("name-trigger");
  const cursorEl = document.getElementById("cursor-gif");
  const ticker = document.getElementById("services-ticker");

  if (ticker) {
    ticker.addEventListener("click", () => {
      ticker.classList.toggle("is-paused");
    });
  }

  if (!trigger || !cursorEl) return;

  const isTouch =
    "ontouchstart" in window ||
    navigator.maxTouchPoints > 0 ||
    navigator.msMaxTouchPoints > 0;

  if (!isTouch) return;

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
    document.body.classList.remove("cursor-active");
  };

  const onDocTapToHide = (e) => {
    if (!active) return;
    if (e.target.closest("#services-ticker")) return;
    hide();
    document.removeEventListener("touchstart", onDocTapToHide, true);
  };

  trigger.addEventListener(
    "touchstart",
    (e) => {
      e.preventDefault();

      if (active) {
        hide();
        document.removeEventListener("touchstart", onDocTapToHide, true);
        return;
      }

      const t = e.touches && e.touches[0];
      showAt(t ? t.clientX : innerWidth / 2, t ? t.clientY : innerHeight / 2);
      document.addEventListener("touchstart", onDocTapToHide, true);
    },
    { passive: false }
  );
})();