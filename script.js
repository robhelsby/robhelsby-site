/* =========================================================
   Rob Helsby - Site script
   ========================================================= */
(() => {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const desktop = window.matchMedia("(min-width: 64em)");
  const hero = document.querySelector(".hero");

  /* ---------------------------------------------------------
     0. Hero load-in - headline rises in line by line
     --------------------------------------------------------- */
  const docEl = document.documentElement;

  // Wrap each word of the headline so lines can be staggered
  function splitHeadline(el) {
    const units = [];
    const wrap = () => {
      const span = document.createElement("span");
      span.className = "hw";
      units.push(span);
      return span;
    };

    function splitText(node) {
      const frag = document.createDocumentFragment();
      node.textContent.split(/([ \t\n\r]+)/).forEach((part, i) => {
        if (!part) return;
        if (/^[ \t\n\r]+$/.test(part)) {
          frag.appendChild(document.createTextNode(" "));
        } else if (i === 0 && part.startsWith("\u00a0") && units.length) {
          // Non-breaking space: keep this word glued to the one before (the "&")
          units[units.length - 1].appendChild(document.createTextNode(part));
        } else {
          wrap().textContent = part;
          frag.appendChild(units[units.length - 1]);
        }
      });
      node.replaceWith(frag);
    }

    [...el.childNodes].forEach((node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        splitText(node);
      } else if (node.classList?.contains("amp")) {
        const unit = wrap();
        node.replaceWith(unit);
        unit.appendChild(node);
      } else {
        [...node.childNodes].forEach((inner) => {
          if (inner.nodeType === Node.TEXT_NODE) splitText(inner);
        });
      }
    });

    // Number each word by the line it sits on
    let line = -1;
    let lastTop = null;
    units.forEach((unit) => {
      const top = unit.offsetTop;
      if (lastTop === null || Math.abs(top - lastTop) > 4) {
        line += 1;
        lastTop = top;
      }
      unit.style.setProperty("--line", line);
    });
    return line + 1;
  }

  if (docEl.classList.contains("intro")) {
    const title = document.querySelector(".hero__title");
    let started = false;
    const play = () => {
      if (started) return;
      started = true;
      const lines = title ? splitHeadline(title) : 4;
      docEl.style.setProperty("--intro-after", `${350 + lines * 110 + 250}ms`);
      requestAnimationFrame(() => docEl.classList.add("intro-play"));
    };
    // Wait for the fonts (so lines are measured correctly), but never longer than 0.8s
    Promise.race([
      document.fonts ? document.fonts.ready : Promise.resolve(),
      new Promise((resolve) => window.setTimeout(resolve, 800)),
    ]).then(play);
  }

  /* ---------------------------------------------------------
     1. Hero slideshow - crossfade + slow zoom every 6s
     --------------------------------------------------------- */
  const INTERVAL_MS = 6000;
  const FADE_MS = 2400; // match --slide-fade in CSS

  const slides = [...document.querySelectorAll(".hero__slide")];
  let current = Math.max(0, slides.findIndex((s) => s.classList.contains("is-active")));
  let timer = null;
  let heroVisible = true;
  let userPaused = false;

  function advance() {
    const prev = slides[current];
    const nextIndex = (current + 1) % slides.length;
    const next = slides[nextIndex];
    if (!next.complete || next.naturalWidth === 0) return; // not loaded yet, try next tick

    current = nextIndex;
    loadSlide((current + 1) % slides.length);
    slides.forEach((s) => s.classList.remove("is-prev"));
    prev.classList.remove("is-active");
    prev.classList.add("is-prev");
    next.classList.add("is-active");

    window.setTimeout(() => {
      if (!prev.classList.contains("is-active")) prev.classList.remove("is-prev");
    }, FADE_MS + 100);
  }

  // Only the first slide loads with the page. Each of the others is fetched
  // one slide ahead of time, so nobody downloads images they never see.
  function loadSlide(i) {
    const s = slides[i];
    if (!s || !s.dataset.src) return;
    if (s.dataset.srcset) s.srcset = s.dataset.srcset;
    s.src = s.dataset.src;
    s.removeAttribute("data-src");
    s.removeAttribute("data-srcset");
  }
  if (document.readyState === "complete") loadSlide(1);
  else window.addEventListener("load", () => loadSlide(1), { once: true });

  function syncSlideshow() {
    const shouldRun =
      slides.length > 1 && heroVisible && !userPaused && !document.hidden && !reduceMotion.matches;
    if (shouldRun && !timer) timer = window.setInterval(advance, INTERVAL_MS);
    if (!shouldRun && timer) {
      window.clearInterval(timer);
      timer = null;
    }
  }


  // Pause / play button
  const pauseBtn = document.querySelector(".hero__pause");
  pauseBtn?.addEventListener("click", () => {
    userPaused = !userPaused;
    hero.classList.toggle("is-paused", userPaused);
    pauseBtn.setAttribute("aria-label", userPaused ? "Play hero animation" : "Pause hero animation");
    syncSlideshow();
    syncTicker();
  });

  /* ---------------------------------------------------------
     2. Logo ticker - seamless loop at a constant speed
     --------------------------------------------------------- */
  const TICKER_SPEED = 45; // pixels per second

  const ticker = document.querySelector("[data-ticker]");
  const track = ticker?.querySelector(".ticker__track");
  const list = track?.querySelector(".ticker__list");
  const originals = list ? [...list.children] : [];

  // Paused when the hero is off screen or the pause button is on
  function syncTicker() {
    ticker?.classList.toggle("is-paused", !heroVisible || userPaused);
  }

  function buildTicker() {
    if (!ticker) return;
    track.querySelectorAll("[data-clone]").forEach((n) => n.remove());
    list.querySelectorAll("[data-fill]").forEach((n) => n.remove());

    let guard = 0;
    while (list.offsetWidth < ticker.clientWidth && guard++ < 10) {
      originals.forEach((item) => {
        const copy = item.cloneNode(true);
        copy.dataset.fill = "";
        copy.setAttribute("aria-hidden", "true");
        list.appendChild(copy);
      });
    }

    const clone = list.cloneNode(true);
    clone.dataset.clone = "";
    clone.setAttribute("aria-hidden", "true");
    clone.removeAttribute("aria-label");
    track.appendChild(clone);

    track.style.setProperty("--ticker-duration", `${list.offsetWidth / TICKER_SPEED}s`);
  }

  /* ---------------------------------------------------------
     3. Navigation
     --------------------------------------------------------- */
  const nav = document.querySelector(".site-nav");
  const navList = nav.querySelector(".site-nav__list");
  const navCurrent = nav.querySelector(".site-nav__current");
  const navLabel = nav.querySelector(".site-nav__label");
  const navToggle = nav.querySelector(".site-nav__toggle");
  const brand = document.querySelector(".brand");
  const footer = document.querySelector(".site-footer");

  const links = [...nav.querySelectorAll('a[href^="#"]')];
  const targets = links
    .map((a) => document.querySelector(a.getAttribute("href")))
    .filter(Boolean);
  const themed = [...document.querySelectorAll("main [data-theme]")];

  const COLLAPSE_AFTER_PX = 160; // scroll this far after opening the menu and it folds back to the label
  const SWAP_MS = 450;

  let mode = "links";     // mobile bar: "links" | "label"
  let expandedAt = null;  // scroll position when the menu button was tapped
  let pendingId = null;   // section a tapped link is scrolling towards
  let pendingTimer;
  let labelTimer;

  // Which themed section sits behind an element? ("light" or "dark")
  function themeUnder(el) {
    const r = el.getBoundingClientRect();
    const probe = r.top + r.height / 2;
    const under = themed.find((s) => {
      const b = s.getBoundingClientRect();
      return b.top <= probe && b.bottom > probe;
    });
    return under ? under.dataset.theme : "dark";
  }

  // Which nav section is the reader in?
  function currentSectionId() {
    const line = window.innerHeight * 0.4;
    let active = targets.find((t) => {
      const b = t.getBoundingClientRect();
      return b.top <= line && b.bottom > line;
    });
    const atBottom =
      window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
    if (atBottom) active = targets[targets.length - 1];
    return active ? active.id : null;
  }

  const linkFor = (id) => links.find((a) => a.hash === `#${id}`);

  // Mobile bar: fade one layer out upwards, the other in from below
  function show(el) {
    el.classList.remove("is-leaving");
    el.classList.add("is-shown");
  }
  function hide(el) {
    if (!el.classList.contains("is-shown")) return;
    el.classList.remove("is-shown");
    el.classList.add("is-leaving");
    window.setTimeout(() => {
      if (!el.classList.contains("is-shown")) el.classList.remove("is-leaving");
    }, SWAP_MS);
  }

  function setMode(next) {
    if (next === mode) return;
    mode = next;
    nav.dataset.mode = mode;
    if (mode === "label") {
      hide(navList);
      show(navCurrent);
      navToggle.setAttribute("aria-expanded", "false");
    } else {
      hide(navCurrent);
      show(navList);
      navToggle.setAttribute("aria-expanded", "true");
    }
  }

  // Swap the label text: old one out upwards, new one in from below
  function setLabel(text) {
    if (navLabel.dataset.text === text) return;
    navLabel.dataset.text = text;
    window.clearTimeout(labelTimer);

    const animate = mode === "label" && navLabel.textContent && !reduceMotion.matches;
    if (!animate) {
      navLabel.textContent = text;
      return;
    }
    navLabel.classList.add("is-out");
    labelTimer = window.setTimeout(() => {
      navLabel.textContent = text;
      navLabel.classList.remove("is-out");
      navLabel.classList.add("is-in");
      void navLabel.offsetWidth; // commit the start position
      navLabel.classList.remove("is-in");
    }, 250);
  }

  function clearPending() {
    pendingId = null;
    window.clearTimeout(pendingTimer);
  }

  // Mobile: tuck "Rob Helsby" away while scrolling down, bring it back on the way up
  const TUCK_THRESHOLD = 8; // px of scroll before it reacts, so small jitters are ignored
  let lastScrollY = window.scrollY;

  function updateBrandTuck() {
    if (!brand) return;
    const y = window.scrollY;
    if (desktop.matches) {
      brand.classList.remove("is-tucked");
    } else if (y > lastScrollY + TUCK_THRESHOLD) {
      brand.classList.add("is-tucked");
    } else if (y < lastScrollY - TUCK_THRESHOLD) {
      brand.classList.remove("is-tucked");
    } else {
      return; // not moved far enough yet: keep measuring from the same point
    }
    lastScrollY = y;
  }

  function updateNav() {
    // Colours
    nav.dataset.on = themeUnder(nav);
    if (brand) brand.dataset.on = themeUnder(brand);
    updateBrandTuck();

    // Active section (a tapped link wins until we arrive)
    let id = currentSectionId();
    if (pendingId) {
      if (id === pendingId) clearPending();
      else id = pendingId;
    }

    links.forEach((a) => {
      const isActive = !!id && a.hash === `#${id}`;
      a.classList.toggle("is-active", isActive);
      if (isActive) a.setAttribute("aria-current", "location");
      else a.removeAttribute("aria-current");
    });

    // Desktop: lift the rail so it never sits on top of the footer
    if (desktop.matches) {
      const overlap = footer ? Math.max(0, window.innerHeight - footer.getBoundingClientRect().top) : 0;
      nav.style.translate = overlap ? `0 ${-overlap}px` : "";
      return;
    }
    nav.style.translate = "";

    // Mobile bar state
    if (id) setLabel(linkFor(id).textContent.trim());
    if (expandedAt !== null && Math.abs(window.scrollY - expandedAt) > COLLAPSE_AFTER_PX) {
      expandedAt = null;
    }
    setMode(id && expandedAt === null ? "label" : "links");
  }

  let ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(() => {
      ticking = false;
      updateNav();
    });
  }

  // Menu button: back to the full set of links
  navToggle.addEventListener("click", (e) => {
    expandedAt = window.scrollY;
    setMode("links");
    if (e.detail === 0) links[0].focus({ preventScroll: true }); // keyboard users
  });

  // Tapping a link: show its label straight away rather than every section on the way
  links.forEach((a) =>
    a.addEventListener("click", () => {
      expandedAt = null;
      pendingId = a.hash.slice(1);
      window.clearTimeout(pendingTimer);
      pendingTimer = window.setTimeout(clearPending, 1500);
      onScroll();
    })
  );

  brand?.addEventListener("click", () => {
    clearPending();
    expandedAt = null;
  });

  /* ---------------------------------------------------------
     4. Media carousels - tap, drag or use the pips
     --------------------------------------------------------- */
  /* ---------------------------------------------------------
     Case study gallery - full-screen view of carousel media
     --------------------------------------------------------- */
  const gallery = (() => {
    const ICONS = {
      close: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 3.5l9 9M12.5 3.5l-9 9"/></svg>',
      prev: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10 3L5 8l5 5"/></svg>',
      next: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6 3l5 5-5 5"/></svg>',
    };
    let dialog, stage, counter;
    let slides = [];
    let index = 0;
    let label = "";
    let onClose = null;
    let swipeX = null;
    let swiped = false;
    let openedAt = 0;

    function build() {
      dialog = document.createElement("dialog");
      dialog.className = "gallery";
      dialog.innerHTML = `
        <div class="gallery__stage"></div>
        <p class="gallery__count" aria-live="polite"></p>
        <button class="gallery__btn gallery__close" type="button" aria-label="Close">${ICONS.close}</button>
        <button class="gallery__btn gallery__prev" type="button" aria-label="Previous">${ICONS.prev}</button>
        <button class="gallery__btn gallery__next" type="button" aria-label="Next">${ICONS.next}</button>`;
      document.body.appendChild(dialog);
      stage = dialog.querySelector(".gallery__stage");
      counter = dialog.querySelector(".gallery__count");

      dialog.querySelector(".gallery__close").addEventListener("click", () => dialog.close());
      dialog.querySelector(".gallery__prev").addEventListener("click", () => show(index - 1));
      dialog.querySelector(".gallery__next").addEventListener("click", () => show(index + 1));

      dialog.addEventListener("keydown", (e) => {
        if (e.key === "ArrowRight") { e.preventDefault(); show(index + 1); }
        if (e.key === "ArrowLeft") { e.preventDefault(); show(index - 1); }
      });

      // Clicking the dark area around the media closes it (but not straight after a swipe)
      dialog.addEventListener("click", (e) => {
        if (swiped) { swiped = false; return; }
        if (performance.now() - openedAt < 400) return; // the tap that opened it
        if (e.target === dialog || e.target === stage) dialog.close();
      });

      // Swipe left / right on touch
      stage.addEventListener("pointerdown", (e) => {
        if (e.pointerType !== "mouse") swipeX = { x: e.clientX, y: e.clientY };
      });
      stage.addEventListener("pointerup", (e) => {
        if (!swipeX) return;
        const dx = e.clientX - swipeX.x;
        const dy = e.clientY - swipeX.y;
        swipeX = null;
        if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
          swiped = true;
          show(index + (dx < 0 ? 1 : -1));
        }
      });
      stage.addEventListener("pointercancel", () => { swipeX = null; });

      dialog.addEventListener("close", () => {
        stage.replaceChildren();
        docEl.classList.remove("gallery-open");
        onClose?.(index);
      });
    }

    function media(s) {
      let el;
      if (s.type === "video") {
        el = document.createElement("video");
        el.src = s.src;
        if (s.poster) el.poster = s.poster;
        el.muted = true;
        el.loop = true;
        el.playsInline = true;
        el.setAttribute("aria-label", s.alt);
        if (reduceMotion.matches) el.controls = true;
        else el.autoplay = true;
      } else {
        el = new Image();
        el.src = s.src;
        el.alt = s.alt;
        el.decoding = "async";
      }
      el.className = "gallery__media";
      el.draggable = false;
      return el;
    }

    function show(i) {
      index = (i + slides.length) % slides.length;
      const el = media(slides[index]);
      stage.replaceChildren(el);
      if (el.tagName === "VIDEO" && el.autoplay) el.play().catch(() => {});
      counter.textContent = `${label} – ${index + 1} / ${slides.length}`;
      // Fetch the neighbours so moving on is instant
      [index + 1, index - 1].forEach((n) => {
        const s = slides[(n + slides.length) % slides.length];
        if (s.type === "image") new Image().src = s.src;
      });
    }

    function open(items, start, name, done) {
      if (!dialog) build();
      slides = items;
      label = name;
      onClose = done;
      docEl.classList.add("gallery-open");
      openedAt = performance.now();
      dialog.showModal();
      show(start);
    }

    return { open };
  })();

  function initCarousel(root) {
    const viewport = root.querySelector(".carousel__viewport");
    const track = root.querySelector(".carousel__track");
    const pipsWrap = root.querySelector(".carousel__pips");
    const items = [...track.querySelectorAll(".carousel__slide")];
    const count = items.length;
    const label = root.dataset.label || "Project";
    let index = 0;
    let inView = false;

    root.setAttribute("role", "region");
    root.setAttribute("aria-roledescription", "carousel");
    root.setAttribute("aria-label", `${label} project media`);

    items.forEach((item, i) => {
      item.setAttribute("role", "group");
      item.setAttribute("aria-roledescription", "slide");
      item.setAttribute("aria-label", `${i + 1} of ${count}`);
    });

    // One pip per slide, built automatically
    const pips = items.map((_, i) => {
      const pip = document.createElement("button");
      pip.type = "button";
      pip.className = "carousel__pip";
      pip.setAttribute("aria-label", `Show ${i + 1} of ${count}`);
      pip.addEventListener("click", () => goTo(i));
      pipsWrap.appendChild(pip);
      return pip;
    });

    if (count < 2) {
      pipsWrap.hidden = true;
      root.classList.add("is-single");
    } else {
      viewport.tabIndex = 0;
      viewport.setAttribute("aria-label", `${label} media. Use the arrow keys to browse, or Enter to enlarge.`);
    }

    // Only the visible slide's video plays, and only while on screen
    function syncVideos() {
      items.forEach((item, i) => {
        const video = item.querySelector("video");
        if (!video) return;
        if (i === index && inView && !reduceMotion.matches) video.play().catch(() => {});
        else video.pause();
      });
    }

    // Slides after the first carry data-src / data-poster until they're needed
    function hydrate(n) {
      const media = items[(n + count) % count]?.querySelector("img, video");
      if (!media) return;
      if (media.dataset.poster) {
        media.poster = media.dataset.poster;
        media.removeAttribute("data-poster");
      }
      if (media.dataset.srcset) {
        media.srcset = media.dataset.srcset;
        media.removeAttribute("data-srcset");
      }
      if (media.dataset.src) {
        media.src = media.dataset.src;
        media.removeAttribute("data-src");
      }
    }

    function goTo(i, animate = true) {
      index = (i + count) % count;
      hydrate(index);
      if (animate) hydrate(index + 1); // get the next one ready
      track.style.transition = animate ? "" : "none";
      track.style.transform = `translateX(${-index * 100}%)`;
      pips.forEach((pip, n) => pip.setAttribute("aria-current", n === index ? "true" : "false"));
      items.forEach((item, n) => item.setAttribute("aria-hidden", n === index ? "false" : "true"));
      syncVideos();
    }

    // Open the full-screen gallery at the current slide
    function enlarge() {
      const list = items.map((item) => {
        const m = item.querySelector("img, video");
        return {
          type: m.tagName === "VIDEO" ? "video" : "image",
          src: m.dataset.src || m.getAttribute("src"),          // the full 1600px file
          poster: m.dataset.poster || m.getAttribute("poster"),
          alt: m.getAttribute("alt") || m.getAttribute("aria-label") || "",
        };
      });
      items.forEach((item) => item.querySelector("video")?.pause());
      gallery.open(list, index, label, (last) => goTo(last, last !== index));
    }

    // Pointer handling: a tap opens the gallery, a horizontal drag swipes
    let pointerId = null;
    let startX = 0;
    let startY = 0;
    let startTime = 0;
    let dx = 0;
    let axis = null;

    viewport.addEventListener("pointerdown", (e) => {
      if (count < 2 || (e.pointerType === "mouse" && e.button !== 0)) return;
      pointerId = e.pointerId;
      startX = e.clientX;
      startY = e.clientY;
      startTime = performance.now();
      dx = 0;
      axis = null;
    });

    viewport.addEventListener("pointermove", (e) => {
      if (e.pointerId !== pointerId) return;
      const mx = e.clientX - startX;
      const my = e.clientY - startY;

      if (!axis) {
        if (Math.abs(mx) < 6 && Math.abs(my) < 6) return;
        axis = Math.abs(mx) > Math.abs(my) ? "x" : "y";
        if (axis === "x") {
          viewport.setPointerCapture(pointerId);
          viewport.classList.add("is-dragging");
          track.style.transition = "none";
        }
      }
      if (axis !== "x") return;

      dx = mx;
      const pastEdge = (index === 0 && dx > 0) || (index === count - 1 && dx < 0);
      const offset = pastEdge ? dx * 0.35 : dx; // resist at the ends
      track.style.transform = `translateX(calc(${-index * 100}% + ${offset}px))`;
    });

    function release(e, cancelled) {
      if (e.pointerId !== pointerId) return;
      pointerId = null;
      viewport.classList.remove("is-dragging");

      if (axis === "x") {
        const elapsed = performance.now() - startTime;
        const flick = Math.abs(dx) > 30 && Math.abs(dx) / elapsed > 0.5;
        const far = Math.abs(dx) > viewport.clientWidth * 0.2;
        if (!cancelled && (flick || far)) {
          const next = index + (dx < 0 ? 1 : -1);
          goTo(Math.min(count - 1, Math.max(0, next)));
        } else {
          goTo(index);
        }
      }
      dragged = axis === "x";
      axis = null;
    }

    // A tap or click (not the end of a drag) opens the gallery
    let dragged = false;
    viewport.addEventListener("click", () => {
      if (dragged) { dragged = false; return; }
      enlarge();
    });

    viewport.addEventListener("pointerup", (e) => release(e, false));
    viewport.addEventListener("pointercancel", (e) => release(e, true));

    viewport.addEventListener("keydown", (e) => {
      if (e.key === "ArrowRight") { e.preventDefault(); goTo(index + 1); }
      if (e.key === "ArrowLeft") { e.preventDefault(); goTo(index - 1); }
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); enlarge(); }
    });

    if ("IntersectionObserver" in window) {
      new IntersectionObserver(([entry]) => {
        inView = entry.isIntersecting;
        syncVideos();
      }, { threshold: 0.4 }).observe(viewport);
    }

    // "Drag" cursor that follows the mouse over the media
    if (count > 1 && window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
      const cursor = document.createElement("span");
      cursor.className = "carousel__cursor";
      cursor.setAttribute("aria-hidden", "true");
      cursor.textContent = "View";
      viewport.appendChild(cursor);
      root.classList.add("has-cursor");

      const place = (e) => {
        const r = viewport.getBoundingClientRect();
        cursor.style.translate = `${e.clientX - r.left}px ${e.clientY - r.top}px`;
      };
      viewport.addEventListener("pointerenter", (e) => {
        if (e.pointerType !== "mouse") return;
        place(e);
        viewport.classList.add("show-cursor");
      });
      viewport.addEventListener("pointermove", (e) => {
        if (e.pointerType === "mouse") place(e);
      });
      viewport.addEventListener("pointerleave", () => viewport.classList.remove("show-cursor"));
    }

    // As the carousel approaches, fetch the second slide so the first move is instant
    if ("IntersectionObserver" in window) {
      const near = new IntersectionObserver(([entry]) => {
        if (!entry.isIntersecting) return;
        hydrate(1);
        near.disconnect();
      }, { rootMargin: "300px 0px" });
      near.observe(viewport);
    } else {
      items.forEach((_, n) => hydrate(n));
    }
    viewport.addEventListener("pointerdown", () => { hydrate(index + 1); hydrate(index - 1); }, { passive: true });

    goTo(0, false);
  }

  document.querySelectorAll("[data-carousel]").forEach(initCarousel);

  /* ---------------------------------------------------------
     5. Portrait reveal - hover (mouse) or press and hold (touch)
     --------------------------------------------------------- */
  document.querySelectorAll("[data-portrait]").forEach((wrap) => {
    const card = wrap.querySelector(".portrait__reveal");
    if (!card) return;

    // Headshot frames, shown in a random order while the card is up
    const FRAME_MS = 500; // how long each headshot shows
    const frameImg = card.querySelector("img");
    const frames = (card.dataset.frames || "")
      .split(",")
      .map((f) => f.trim())
      .filter(Boolean);
    const ready = [];        // frames that have finished downloading
    const requested = new Set();
    let current = null;
    let frameTimer = null;

    function load(list) {
      list.forEach((src) => {
        if (requested.has(src)) return;
        requested.add(src);
        const img = new Image();
        img.onload = () => ready.push(src);
        img.src = src;
      });
    }

    // Only cycle through frames that are ready, so it never flashes blank
    function randomFrame() {
      const pool = ready.length ? ready : frames.slice(0, 1);
      if (!pool.length) return;
      let next = pool[Math.floor(Math.random() * pool.length)];
      if (pool.length > 1 && next === current) next = pool[(pool.indexOf(next) + 1) % pool.length];
      current = next;
      frameImg.src = next;
    }

    function startFrames() {
      randomFrame(); // a new face every time it appears
      window.clearInterval(frameTimer);
      if (frames.length > 1 && !reduceMotion.matches) {
        frameTimer = window.setInterval(randomFrame, FRAME_MS);
      }
    }
    function stopFrames() {
      window.clearInterval(frameTimer);
      frameTimer = null;
    }

    // A handful of frames load as the section approaches, so the first hover is
    // instant; the full set only downloads once someone actually interacts
    if ("IntersectionObserver" in window) {
      const io = new IntersectionObserver(([entry]) => {
        if (!entry.isIntersecting) return;
        load(frames.slice(0, 4));
        io.disconnect();
      }, { rootMargin: "600px 0px" });
      io.observe(wrap);
    } else {
      load(frames.slice(0, 4));
    }
    ["pointerenter", "pointerdown", "focusin"].forEach((type) =>
      wrap.addEventListener(type, () => load(frames), { once: true, passive: true })
    );

    let x = 0, y = 0;      // current card position
    let tx = 0, ty = 0;    // target position
    let raf = null;
    let hideTimer;
    let pressStart = 0;

    const apply = () => { card.style.translate = `${x}px ${y}px`; };

    function centre() {
      tx = (wrap.clientWidth - card.offsetWidth) / 2;
      ty = (wrap.clientHeight - card.offsetHeight) / 2;
    }

    // Ease the card towards the cursor
    function loop() {
      x += (tx - x) * 0.18;
      y += (ty - y) * 0.18;
      apply();
      raf = Math.abs(tx - x) > 0.1 || Math.abs(ty - y) > 0.1 ? requestAnimationFrame(loop) : null;
    }

    function aim(e, jump) {
      if (reduceMotion.matches) {
        centre();
      } else {
        const r = wrap.getBoundingClientRect();
        tx = e.clientX - r.left - card.offsetWidth / 2;
        ty = e.clientY - r.top - card.offsetHeight / 2;
      }
      if (jump) {
        x = tx; y = ty; apply();
      } else if (!raf) {
        raf = requestAnimationFrame(loop);
      }
    }

    function show() {
      window.clearTimeout(hideTimer);
      if (!wrap.classList.contains("is-revealed")) startFrames();
      wrap.classList.add("is-revealed");
    }
    function hide(delay = 0) {
      window.clearTimeout(hideTimer);
      hideTimer = window.setTimeout(() => {
        wrap.classList.remove("is-revealed");
        stopFrames(); // the last face stays put while the card fades out
      }, delay);
    }

    // Mouse: follow the cursor while hovering
    wrap.addEventListener("pointerenter", (e) => {
      if (e.pointerType !== "mouse") return;
      aim(e, true);
      show();
    });
    wrap.addEventListener("pointermove", (e) => {
      if (e.pointerType === "mouse") aim(e);
    });
    wrap.addEventListener("pointerleave", (e) => {
      if (e.pointerType === "mouse") hide();
    });

    // Touch and pen: show while pressed, centred over the photo
    wrap.addEventListener("pointerdown", (e) => {
      if (e.pointerType === "mouse") return;
      centre();
      x = tx; y = ty; apply();
      pressStart = performance.now();
      show();
    });
    wrap.addEventListener("pointerup", (e) => {
      if (e.pointerType === "mouse") return;
      const held = performance.now() - pressStart;
      hide(held < 400 ? 1200 : 0); // a quick tap still gets a proper look
    });
    wrap.addEventListener("pointercancel", () => hide()); // started scrolling
    wrap.addEventListener("contextmenu", (e) => e.preventDefault()); // no long-press menu
  });

  /* ---------------------------------------------------------
     Goals: hand-drawn marker loops around each key phrase
     --------------------------------------------------------- */
  const goals = document.querySelector(".goals");
  const marks = goals ? [...goals.querySelectorAll(".goal__mark")] : [];
  const SVG_NS = "http://www.w3.org/2000/svg";

  // Small repeatable wobble, so every loop is a little different but stable
  const wobble = (seed, i) => {
    const x = Math.sin(seed * 97.13 + i * 13.7) * 43758.5453;
    return (x - Math.floor(x)) * 2 - 1; // -1 to 1
  };

  // A loose loop that starts top right, goes round anticlockwise and
  // overshoots past where it began, like a quick circle with a marker
  function loopPath(W, H, seed) {
    const j = (i, amt) => wobble(seed, i) * amt;
    const p = (x, y, i) => `${(W * x + j(i, W * 0.015)).toFixed(1)} ${(H * y + j(i + 50, H * 0.04)).toFixed(1)}`;
    return [
      `M ${p(0.8, 0.12, 1)}`,
      `C ${p(0.55, 0.0, 2)}, ${p(0.12, 0.03, 3)}, ${p(0.035, 0.46, 4)}`,
      `C ${p(0.0, 0.8, 5)}, ${p(0.26, 0.99, 6)}, ${p(0.53, 0.96, 7)}`,
      `C ${p(0.83, 0.93, 8)}, ${p(1.0, 0.7, 9)}, ${p(0.97, 0.38, 10)}`,
      `C ${p(0.95, 0.12, 11)}, ${p(0.74, 0.03, 12)}, ${p(0.5, 0.06, 13)}`,
    ].join(" ");
  }

  function drawLoops() {
    marks.forEach((mark, n) => {
      mark.querySelector(".goal__loop")?.remove();
      const w = mark.offsetWidth;
      const h = mark.offsetHeight;
      if (!w || !h) return;

      const padX = Math.max(8, h * 0.32);
      const padY = h * 0.34;
      const W = w + padX * 2;
      const H = h + padY * 2;

      const svg = document.createElementNS(SVG_NS, "svg");
      svg.setAttribute("class", "goal__loop");
      svg.setAttribute("aria-hidden", "true");
      svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
      svg.setAttribute("width", W);
      svg.setAttribute("height", H);
      svg.style.left = `${-padX}px`;
      svg.style.top = `${-padY}px`;
      svg.style.rotate = `${(wobble(n + 1, 99) * 1.6).toFixed(2)}deg`;

      const path = document.createElementNS(SVG_NS, "path");
      path.setAttribute("d", loopPath(W, H, n + 1));
      svg.appendChild(path);
      mark.appendChild(svg);

      const len = Math.ceil(path.getTotalLength());
      path.style.strokeDasharray = `${len} ${len}`;
      path.style.setProperty("--loop-len", len);
    });
  }

  if (marks.length) {
    drawLoops();

    if ("IntersectionObserver" in window && !reduceMotion.matches) {
      goals.classList.add("will-reveal"); // without this the loops simply show
      const goalsObserver = new IntersectionObserver(([entry]) => {
        if (!entry.isIntersecting) return;
        goals.classList.add("is-inview");
        goalsObserver.disconnect();
      }, { threshold: 0.1 });   // start drawing as soon as the list comes into view
      goalsObserver.observe(goals);
    }

    // Redraw to the new size when fonts load or the width changes
    document.fonts?.ready.then(drawLoops);
    let loopWidth = window.innerWidth;
    window.addEventListener("resize", () => {
      if (window.innerWidth === loopWidth) return;
      loopWidth = window.innerWidth;
      window.clearTimeout(drawLoops.t);
      drawLoops.t = window.setTimeout(drawLoops, 150);
    });
  }

  /* ---------------------------------------------------------
     Calendly - pop-up booking, loaded only when it's needed
     --------------------------------------------------------- */
  const calendlyLinks = [...document.querySelectorAll("[data-calendly]")];
  let calendlyLoading = null;

  function loadCalendly() {
    if (window.Calendly) return Promise.resolve();
    if (calendlyLoading) return calendlyLoading;

    const css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = "https://assets.calendly.com/assets/external/widget.css";
    document.head.appendChild(css);

    calendlyLoading = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://assets.calendly.com/assets/external/widget.js";
      script.async = true;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
    return calendlyLoading;
  }

  calendlyLinks.forEach((link) => {
    // Start loading as soon as someone shows interest, so the pop-up opens quickly
    ["pointerenter", "focus", "touchstart"].forEach((type) =>
      link.addEventListener(type, () => loadCalendly().catch(() => {}), { once: true, passive: true })
    );

    link.addEventListener("click", (e) => {
      e.preventDefault();
      const fallback = () => window.open(link.href, "_blank", "noopener");
      const timeout = new Promise((_, reject) => window.setTimeout(reject, 5000));

      Promise.race([loadCalendly(), timeout])
        .then(() => window.Calendly.initPopupWidget({ url: link.dataset.calendly }))
        .catch(fallback); // blocked or slow to load: open Calendly in a new tab instead
    });
  });

  /* ---------------------------------------------------------
     6. Contact - click the email to copy it
     --------------------------------------------------------- */
  const emailLink = document.querySelector("[data-copy-email]");
  const emailHint = document.querySelector(".contact__hint");

  if (emailLink && emailHint) {
    const touch = window.matchMedia("(hover: none)").matches;
    const idleText = touch ? "Tap to copy" : "Click to copy";
    let resetTimer;
    emailHint.textContent = idleText;

    emailLink.addEventListener("click", async (e) => {
      if (!navigator.clipboard?.writeText) return; // no clipboard: open the mail app instead
      e.preventDefault();
      try {
        await navigator.clipboard.writeText(emailLink.dataset.copyEmail);
      } catch {
        window.location.href = emailLink.href; // copy blocked: fall back to mail app
        return;
      }
      emailHint.textContent = "Email address copied";
      emailHint.classList.add("is-copied");
      window.clearTimeout(resetTimer);
      resetTimer = window.setTimeout(() => {
        emailHint.classList.remove("is-copied");
        emailHint.textContent = idleText;
      }, 2500);
    });
  }

  /* ---------------------------------------------------------
     7. Wiring
     --------------------------------------------------------- */
  if ("IntersectionObserver" in window && hero) {
    new IntersectionObserver(([entry]) => {
      heroVisible = entry.isIntersecting;
      syncTicker();
      brand?.classList.toggle("is-visible", !heroVisible);
      syncSlideshow();
    }).observe(hero);
  }

  document.addEventListener("visibilitychange", syncSlideshow);
  reduceMotion.addEventListener("change", syncSlideshow);
  desktop.addEventListener("change", updateNav);
  window.addEventListener("scroll", onScroll, { passive: true });

  let lastWidth = window.innerWidth;
  let resizeTimer;
  window.addEventListener("resize", () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      if (window.innerWidth !== lastWidth) {
        lastWidth = window.innerWidth;
        buildTicker();
      }
      updateNav();
    }, 150);
  });

  buildTicker();
  updateNav();
  syncSlideshow();
  // Positions shift slightly once fonts and images arrive, so measure again
  window.addEventListener("load", updateNav, { once: true });
})();


/* ---------- Dithered photos ----------
   Redraws each <span class="dither"> image as a two-colour Floyd-Steinberg
   dither at one dot per CSS pixel, matching the image's object-fit crop.
   It "lives" like TV static: a handful of dither frames, each with a little
   random noise, are cut between about ten times a second while the photo is
   on screen. Reduced motion shows a single still frame.
   Colours, brightness and static strength come from CSS custom properties. */
(() => {
  const frames = document.querySelectorAll(".dither");
  if (!frames.length) return;

  const FRAME_COUNT = 8;   // distinct static frames to cycle between
  const TICK_MS = 100;     // how often the static jumps
  const still = window.matchMedia("(prefers-reduced-motion: reduce)");

  const rgb = (value) => {
    const probe = document.createElement("span");
    probe.style.color = value;
    document.body.appendChild(probe);
    const out = getComputedStyle(probe).color.match(/\d+/g).map(Number);
    probe.remove();
    return out;
  };

  // Greyscale, tone-stretched copy of the photo at display size
  function tones(img, w, h, gamma) {
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    // Reproduce object-fit: cover with the image's object-position
    const pos = getComputedStyle(img).objectPosition.split(" ").map((v) => parseFloat(v) / 100);
    const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
    const sw = w / scale, sh = h / scale;
    const sx = (img.naturalWidth - sw) * (isNaN(pos[0]) ? 0.5 : pos[0]);
    const sy = (img.naturalHeight - sh) * (isNaN(pos[1]) ? 0.5 : pos[1]);
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
    const px = ctx.getImageData(0, 0, w, h).data;
    const lum = new Float32Array(w * h);
    for (let i = 0; i < lum.length; i++) {
      lum[i] = (0.2126 * px[i * 4] + 0.7152 * px[i * 4 + 1] + 0.0722 * px[i * 4 + 2]) / 255;
    }
    // Stretch the tones to fill the range (ignoring the extreme 1%), then apply gamma
    const sorted = Float32Array.from(lum).sort();
    const lo = sorted[Math.floor(sorted.length * 0.01)];
    const hi = sorted[Math.floor(sorted.length * 0.99)];
    const range = Math.max(hi - lo, 0.01);
    for (let i = 0; i < lum.length; i++) {
      lum[i] = Math.pow(Math.min(Math.max((lum[i] - lo) / range, 0), 1), gamma);
    }
    return lum;
  }

  // One serpentine Floyd-Steinberg frame, with random noise added for static
  function dither(base, w, h, noise, ink, paper, out) {
    const lum = new Float32Array(base.length);
    for (let i = 0; i < lum.length; i++) lum[i] = base[i] + (Math.random() - 0.5) * noise;
    for (let y = 0; y < h; y++) {
      const ltr = y % 2 === 0;
      const d = ltr ? 1 : -1;
      for (let n = 0; n < w; n++) {
        const x = ltr ? n : w - 1 - n;
        const i = y * w + x;
        const val = lum[i] < 0.5 ? 0 : 1;
        const err = lum[i] - val;
        lum[i] = val;
        if (x + d >= 0 && x + d < w) lum[i + d] += err * 7 / 16;
        if (y + 1 < h) {
          if (x - d >= 0 && x - d < w) lum[i + w - d] += err * 3 / 16;
          lum[i + w] += err * 5 / 16;
          if (x + d >= 0 && x + d < w) lum[i + w + d] += err * 1 / 16;
        }
      }
    }
    const px = out.data;
    for (let i = 0; i < lum.length; i++) {
      const c = lum[i] ? paper : ink;
      px[i * 4] = c[0]; px[i * 4 + 1] = c[1]; px[i * 4 + 2] = c[2]; px[i * 4 + 3] = 255;
    }
    return out;
  }

  frames.forEach((frame) => {
    const img = frame.querySelector("img");
    if (!img) return;
    const canvas = document.createElement("canvas");
    canvas.setAttribute("aria-hidden", "true");
    frame.appendChild(canvas);
    const ctx = canvas.getContext("2d");

    let stack = [];       // prepared ImageData frames
    let shown = -1;
    let timer = null;
    let onScreen = false;
    let lastWidth = 0;

    function build() {
      const w = Math.round(img.clientWidth);
      const h = Math.round(img.clientHeight);
      if (!w || !h || !img.naturalWidth) return;
      lastWidth = w;
      const css = getComputedStyle(frame);
      const ink = rgb(css.getPropertyValue("--dither-ink").trim());
      const paper = rgb(css.getPropertyValue("--dither-paper").trim());
      const gamma = parseFloat(css.getPropertyValue("--dither-gamma")) || 1;
      const noise = parseFloat(css.getPropertyValue("--dither-static")) || 0;
      const base = tones(img, w, h, gamma);
      canvas.width = w; canvas.height = h;
      const count = still.matches || !noise ? 1 : FRAME_COUNT;
      stack = [];
      for (let k = 0; k < count; k++) {
        stack.push(dither(base, w, h, count > 1 ? noise : 0, ink, paper, ctx.createImageData(w, h)));
      }
      shown = 0;
      ctx.putImageData(stack[0], 0, 0);
      frame.classList.add("is-dithered");
      sync();
    }

    function tick() {
      // Hard cut to a different frame each time, like static
      let next = Math.floor(Math.random() * (stack.length - 1));
      if (next >= shown) next++;
      shown = next;
      ctx.putImageData(stack[shown], 0, 0);
    }

    function sync() {
      const run = onScreen && stack.length > 1 && !document.hidden;
      if (run && !timer) timer = window.setInterval(tick, TICK_MS);
      if (!run && timer) { window.clearInterval(timer); timer = null; }
    }

    if (img.complete && img.naturalWidth) build();
    else img.addEventListener("load", build, { once: true });

    new IntersectionObserver(([entry]) => { onScreen = entry.isIntersecting; sync(); }).observe(frame);
    document.addEventListener("visibilitychange", sync);
    still.addEventListener("change", build);
    // Rebuild when the displayed size changes, so dots stay one pixel each
    new ResizeObserver(() => {
      const w = Math.round(img.clientWidth);
      if (w && w !== lastWidth && img.complete && img.naturalWidth) build();
    }).observe(img);
  });
})();
