/* ============================================================
   Alright Chief — first-pass prototype, v0.1
   A transition app for new dads. One check-in a day:
   one thing lost, one thing gained. Plus a small strange
   creature that keeps your old Saturdays warm for you.

   All state lives in localStorage. No backend, no tracking.
   ============================================================ */

(() => {
  "use strict";

  const STORAGE_KEY = "alrightchief_v01";
  const app = document.getElementById("app");

  /* ----------------------------------------------------------
     State
     ---------------------------------------------------------- */

  const defaultState = () => ({
    stage: "welcome",          // welcome | onboarding | generating | naming | settled | app
    obStep: 0,
    tab: "today",              // today | balance | buddy
    checkin: null,             // { step: 'lost'|'gained'|'done', lost: '' }
    profile: {},               // babyAge, which, home, saturday, miss, love
    buddy: null,               // { config, name, imageUrl? } — imageUrl set when a Midjourney render is plugged in
    entries: [],               // { dateKey, iso, lost, gained }
    llmInsight: null,          // { dateKey, count, text } — daily cached Claude insight
    inputMode: null,           // 'voice' | 'text' — user's last-used input mode; voice is the default
  });

  // Declared here, initialised at the bottom of the module — load() can run a
  // config migration that needs the const tables defined further down.
  let state;

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const s = Object.assign(defaultState(), JSON.parse(raw));
        // Older saves used the abstract-blob buddy; rebuild him as a chief from the same seed.
        if (s.buddy && s.buddy.config && !s.buddy.config.chief) {
          s.buddy.config = genBuddyConfig(s.buddy.config.seed || "chief-" + Date.now());
        }
        return s;
      }
    } catch (e) { /* fresh start */ }
    return defaultState();
  }

  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { /* private mode */ }
  }

  function set(patch) {
    Object.assign(state, patch);
    save();
    render();
  }

  /* ----------------------------------------------------------
     Small helpers
     ---------------------------------------------------------- */

  const esc = (s) =>
    String(s ?? "").replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const dateKey = (d = new Date()) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  const fmtShort = (iso) =>
    new Date(iso).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });

  const todayEntry = () => state.entries.find((e) => e.dateKey === dateKey());

  const pick = (arr, n) => arr[Math.abs(n) % arr.length];

  function greeting() {
    const h = new Date().getHours();
    if (h < 5) return "Late one, chief.";
    if (h < 12) return "Morning, chief.";
    if (h < 18) return "Afternoon, chief.";
    return "Evening, chief.";
  }

  /* ----------------------------------------------------------
     Generative buddy
     Seeded from the dad's own answers — every buddy is unique,
     produced by a system, not picked from a shelf.
     ---------------------------------------------------------- */

  function hashString(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function mulberry32(seed) {
    let a = seed;
    return () => {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ----------------------------------------------------------
     The chief — generative mascot, drawn to the reference sheet:
     a small bean-shaped fella, matte black body, big plain white
     oval eyes, purple mitten hands, stubby legs in chunky shoes,
     always in a hat. Variation lives in height, roundness, hat
     style and clothing theme; the silhouette never changes.
     ---------------------------------------------------------- */

  const THEMES = [
    { name: "olive",   hat: "#6f7d44", band: "#49542e", accent: "#c9a04a" },
    { name: "stone",   hat: "#8a8f98", band: "#5d626b", accent: "#b05a3c" },
    { name: "tan",     hat: "#c4a878", band: "#8a6d4f", accent: "#5d7286" },
    { name: "slate",   hat: "#5d7286", band: "#41525f", accent: "#c9a04a" },
    { name: "plum",    hat: "#7a5a8a", band: "#564063", accent: "#6f7d44" },
    { name: "rust",    hat: "#b05a3c", band: "#7e3f29", accent: "#5d7286" },
  ];

  const HAT_NAMES = ["bucket hat", "beanie", "flat cap", "wide-brim sun hat"];

  const INK = {
    body: "#211d27",    // matte black, a touch of plum so it reads on the dark bg
    line: "#0a0810",
    rim: "#4a4356",
    eye: "#f4efe6",
    hand: "#8d63b8",
    handLine: "#5d3f7e",
    shoe: "#2e2937",
    sole: "#56505f",
  };

  function genBuddyConfig(seedStr) {
    const rand = mulberry32(hashString(seedStr));
    return {
      chief: true,
      seed: seedStr,
      h: 0.85 + rand() * 0.3,       // height
      w: 0.85 + rand() * 0.3,       // roundness
      eye: 0.85 + rand() * 0.35,    // eye size
      legLen: 0.8 + rand() * 0.55,  // leg length
      tilt: rand() * 8 - 4,         // eye tilt, a bit of attitude
      hat: Math.floor(rand() * 4),  // bucket | beanie | flat cap | sun hat
      theme: Math.floor(rand() * THEMES.length),
    };
  }

  /* ---------- Activity props (drawn anchored at bottom-centre, origin = ground) ---------- */

  const PROPS = {
    dumbbell: () => `
      <rect x="-21" y="-12" width="42" height="5" rx="2.5" fill="#777e88" stroke="${INK.line}" stroke-width="2.5"/>
      <circle cx="-19" cy="-9.5" r="9" fill="#3a3f47" stroke="${INK.line}" stroke-width="2.5"/>
      <circle cx="19" cy="-9.5" r="9" fill="#3a3f47" stroke="${INK.line}" stroke-width="2.5"/>`,
    football: () => `
      <circle cx="0" cy="-9" r="9" fill="#ece6da" stroke="${INK.line}" stroke-width="2.5"/>
      <path d="M 0 -12 l 3.4 2.4 -1.3 4 -4.2 0 -1.3 -4 Z" fill="#262229"/>`,
    bike: () => `
      <circle cx="-15" cy="-10" r="10" fill="none" stroke="#9a93a6" stroke-width="2.6"/>
      <circle cx="15" cy="-10" r="10" fill="none" stroke="#9a93a6" stroke-width="2.6"/>
      <path d="M -15 -10 L -6 -24 L 8 -24 L 15 -10 L 0 -10 L -6 -24 M 0 -10 L -15 -10" fill="none" stroke="#b05a3c" stroke-width="2.6" stroke-linejoin="round"/>
      <path d="M -8 -27 h 5 M 8 -24 l 3 -4 h 3" stroke="${INK.line}" stroke-width="2.4" fill="none" stroke-linecap="round"/>`,
    vinyl: () => `
      <rect x="-18" y="-13" width="36" height="13" rx="2" fill="#4a4453" stroke="${INK.line}" stroke-width="2.5"/>
      <circle cx="-4" cy="-6.5" r="5.5" fill="#16131b" stroke="${INK.line}" stroke-width="2"/>
      <circle cx="-4" cy="-6.5" r="1.6" fill="#c9a04a"/>
      <path d="M 10 -10 l 4 5" stroke="#cfc8bb" stroke-width="2" stroke-linecap="round"/>`,
    pint: () => `
      <path d="M -7 -20 L -5 0 L 5 0 L 7 -20 Z" fill="#c9802f" stroke="${INK.line}" stroke-width="2.5" stroke-linejoin="round"/>
      <rect x="-8" y="-25" width="16" height="6" rx="3" fill="#f0ead9" stroke="${INK.line}" stroke-width="2.5"/>`,
    tv: () => `
      <path d="M -8 0 l -3 4 M 8 0 l 3 4" stroke="${INK.line}" stroke-width="2.5" stroke-linecap="round"/>
      <rect x="-17" y="-24" width="34" height="24" rx="3" fill="#3a3540" stroke="${INK.line}" stroke-width="2.5"/>
      <rect x="-13" y="-20" width="26" height="14" rx="1.5" fill="#7fb3ae"/>
      <path d="M -4 -24 l -5 -7 M 4 -24 l 5 -7" stroke="${INK.line}" stroke-width="2" stroke-linecap="round"/>`,
    controller: () => `
      <rect x="-15" y="-13" width="30" height="13" rx="6.5" fill="#4a4453" stroke="${INK.line}" stroke-width="2.5"/>
      <circle cx="7" cy="-8.5" r="2" fill="#c9a04a"/>
      <circle cx="10.5" cy="-5.5" r="2" fill="#b05a3c"/>
      <path d="M -10 -6.5 h 6 M -7 -9.5 v 6" stroke="#9a93a6" stroke-width="2" stroke-linecap="round"/>`,
    book: () => `
      <path d="M -14 -6 Q -7 -12 0 -7 Q 7 -12 14 -6 L 14 -1 Q 7 -6 0 -1 Q -7 -6 -14 -1 Z" fill="#ece6da" stroke="${INK.line}" stroke-width="2.5" stroke-linejoin="round"/>
      <path d="M 0 -7 L 0 -1" stroke="${INK.line}" stroke-width="1.6"/>`,
    fishing: () => `
      <ellipse cx="8" cy="0" rx="16" ry="3.5" fill="#5d7286" opacity="0.5"/>
      <path d="M -18 -2 L 12 -34" stroke="#8a6d4f" stroke-width="2.8" stroke-linecap="round"/>
      <path d="M 12 -34 q 5 16 -2 28" stroke="#cfc8bb" stroke-width="1.5" fill="none"/>
      <circle cx="10" cy="-6" r="2.2" fill="#b05a3c"/>`,
    coffee: () => `
      <rect x="-8" y="-13" width="16" height="13" rx="2" fill="#ece6da" stroke="${INK.line}" stroke-width="2.5"/>
      <path d="M 8 -10 q 7 2.5 0 6" stroke="${INK.line}" stroke-width="2.5" fill="none"/>
      <path d="M -3 -17 q 2 -3 0 -6" stroke="#9a9082" stroke-width="2" fill="none" stroke-linecap="round" class="chief-float f2"/>
      <path d="M 3 -17 q -2 -3 0 -6" stroke="#9a9082" stroke-width="2" fill="none" stroke-linecap="round" class="chief-float f3"/>`,
    golf: () => `
      <path d="M 8 -32 V 0" stroke="#8a8f98" stroke-width="2.5" stroke-linecap="round"/>
      <path d="M 8 -32 l 12 4.5 -12 4.5 Z" fill="#b05a3c" stroke="${INK.line}" stroke-width="2"/>
      <circle cx="-9" cy="-3" r="3" fill="#ece6da" stroke="${INK.line}" stroke-width="2"/>`,
    pan: () => `
      <ellipse cx="-3" cy="-5" rx="13" ry="5" fill="#3a3540" stroke="${INK.line}" stroke-width="2.5"/>
      <path d="M 10 -6 L 21 -9" stroke="#3a3540" stroke-width="4" stroke-linecap="round"/>
      <path d="M -7 -12 q 2 -3 0 -6 M 1 -12 q 2 -3 0 -6" stroke="#9a9082" stroke-width="2" fill="none" stroke-linecap="round" class="chief-float f2"/>`,
    trainers: () => `
      <path d="M -16 0 L -16 -5 Q -8 -8 -2 -4 L 4 -1 Q 5 0 3 0 Z" fill="#ece6da" stroke="${INK.line}" stroke-width="2.2" stroke-linejoin="round"/>
      <path d="M 2 0 L 2 -5 Q 10 -8 16 -4 L 21 -1 Q 22 0 20 0 Z" fill="#b05a3c" stroke="${INK.line}" stroke-width="2.2" stroke-linejoin="round"/>`,
  };

  /* ---------- Activities the chief can learn from what the dad tells the app ----------
     Each maps to a reference-art sprite (assets/chief/<sprite>.png). The `prop` is the
     fallback drawn on the SVG chief when sprite art can't load. ---------- */

  const ACTIVITIES = [
    { id: "music", sprite: "vinyl", prop: "vinyl", doing: "back in the records", quip: "Filed exactly how you left them.",
      keywords: ["music", "gig", "gigs", "record", "records", "vinyl", "band", "guitar", "dj", "album", "albums", "spotify"] },
    { id: "gaming", sprite: "gamer", prop: "controller", doing: "getting a few rounds in", quip: "Your save file's safe with him.",
      keywords: ["gaming", "video game", "video games", "playstation", "xbox", "console", "games", "fifa"] },
    { id: "fishing", sprite: "fisher", prop: "fishing", doing: "down at the water", quip: "Nothing's biting. He doesn't mind.",
      keywords: ["fishing", "fish", "angling", "carp", "fly fishing"] },
    { id: "coffee", sprite: "coffee", prop: "coffee", doing: "grinding a proper coffee", quip: "Drinking it while it's hot. Imagine.",
      keywords: ["coffee", "espresso", "flat white", "barista", "beans", "cafetiere"] },
    { id: "pint", sprite: "brewer", prop: "pint", doing: "tending the home-brew", quip: "He got a batch on. It's nearly ready.",
      keywords: ["pub", "pint", "beer", "brewery", "brewing", "ale", "lads", "homebrew", "home brew"] },
    { id: "gardening", sprite: "gardener", prop: "pan", doing: "out in the garden", quip: "Tomatoes are coming along. Yours.",
      keywords: ["garden", "gardening", "allotment", "plants", "growing", "veg", "vegetables"] },
    { id: "mechanic", sprite: "mechanic", prop: "controller", doing: "elbow-deep in the engine", quip: "He'll have it running by the weekend.",
      keywords: ["motorbike", "motorcycle", "car", "cars", "mechanic", "engine", "garage", "tinkering"] },
    { id: "drone", sprite: "drone", prop: "controller", doing: "flying the drone", quip: "Got the landing down. Mostly.",
      keywords: ["drone", "drones", "flying", "rc", "quadcopter"] },
    { id: "astronomy", sprite: "astronomer", prop: "golf", doing: "out under the stars", quip: "Found something. He'll show you.",
      keywords: ["astronomy", "stars", "stargazing", "telescope", "space", "planets"] },
  ];

  // Everything the dad has told the app — onboarding plus both ledger columns —
  // fuels what the chief gets up to.
  function learnedActivities() {
    const p = state.profile || {};
    const sources = [p.saturday, p.miss, p.love]
      .concat(state.entries.flatMap((e) => [e.lost, e.gained]))
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return ACTIVITIES.filter((a) =>
      a.keywords.some((k) => new RegExp(`\\b${k.replace(/[-\s]/g, "[-\\s]")}\\b`).test(sources)));
  }

  /* ---------- Drawing the chief ---------- */

  function chiefSVG(config, scene = { pose: "attentive" }, { small = false, reveal = false } = {}) {
    const t = THEMES[config.theme % THEMES.length];
    const pose = scene.pose || "attentive";
    const isActivity = pose === "activity" && scene.activity;

    const cx = isActivity ? 76 : 100;
    const cy = 98;
    const rx = 40 * config.w;
    const ry = 50 * config.h;
    const top = cy - ry;
    const bottom = cy + ry;
    const legLen = 12 * config.legLen;
    const footY = bottom + legLen;
    const groundY = footY + 6;
    const o = `stroke="${INK.line}" stroke-width="3"`;

    /* legs + shoes */
    const legDX = rx * 0.38;
    const legs = [-1, 1].map((s) => `
      <path d="M ${cx + s * legDX} ${bottom - 6} V ${footY - 3}" stroke="${INK.body}" stroke-width="7" stroke-linecap="round"/>
      <ellipse cx="${cx + s * legDX + s * 3}" cy="${footY}" rx="10" ry="5.5" fill="${INK.shoe}" ${o}/>
      <path d="M ${cx + s * legDX - 7 + s * 3} ${footY + 2.5} h 14" stroke="${INK.sole}" stroke-width="2"/>`).join("");

    /* body */
    const body = `
      <ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${INK.body}" ${o}/>
      <path d="M ${cx - rx * 0.55} ${cy - ry * 0.62} Q ${cx - rx * 0.85} ${cy - ry * 0.18} ${cx - rx * 0.62} ${cy + ry * 0.35}"
            fill="none" stroke="${INK.rim}" stroke-width="2.5" stroke-linecap="round" opacity="0.55"/>`;

    /* eyes */
    const eyeY = cy - ry * 0.26;
    const eyeDX = rx * 0.42;
    const eyeRX = 8.5 * config.eye;
    const eyeRY = 12 * config.eye;
    let eyes = "";
    if (pose === "sleep") {
      eyes = [-1, 1].map((s) => `
        <path d="M ${cx + s * eyeDX - eyeRX} ${eyeY} q ${eyeRX} ${eyeRY * 0.65} ${eyeRX * 2} 0"
              stroke="${INK.eye}" stroke-width="2.8" fill="none" stroke-linecap="round"/>`).join("");
    } else {
      const lidH = pose === "bored" ? eyeRY * 0.9 : 0;
      eyes = [-1, 1].map((s) => `
        <g class="${pose === "bored" ? "" : "chief-eye"}" transform="rotate(${(config.tilt * s).toFixed(1)} ${cx + s * eyeDX} ${eyeY})">
          <ellipse cx="${cx + s * eyeDX}" cy="${eyeY}" rx="${eyeRX.toFixed(1)}" ry="${eyeRY.toFixed(1)}" fill="${INK.eye}"/>
          ${lidH ? `<path d="M ${cx + s * eyeDX - eyeRX - 1} ${eyeY - eyeRY - 1} h ${eyeRX * 2 + 2} v ${lidH} h ${-(eyeRX * 2 + 2)} Z" fill="${INK.body}"/>` : ""}
        </g>`).join("");
    }

    /* hands — purple mittens; crossed when idling, raised toward the prop when busy */
    const handR = 9.5;
    let hands = "";
    if (pose === "bored" || pose === "sleep") {
      hands = `
        <ellipse cx="${cx - 8}" cy="${cy + ry * 0.34}" rx="${handR + 2}" ry="${handR - 1}" fill="${INK.hand}" stroke="${INK.handLine}" stroke-width="2.5"/>
        <ellipse cx="${cx + 9}" cy="${cy + ry * 0.3}" rx="${handR + 2}" ry="${handR - 1}" fill="${INK.hand}" stroke="${INK.handLine}" stroke-width="2.5"/>`;
    } else if (isActivity) {
      hands = `
        <ellipse cx="${cx - rx - 4}" cy="${cy + ry * 0.22}" rx="${handR}" ry="${handR + 1}" fill="${INK.hand}" stroke="${INK.handLine}" stroke-width="2.5"/>
        <ellipse cx="${cx + rx + 7}" cy="${cy - ry * 0.12}" rx="${handR}" ry="${handR + 1}" fill="${INK.hand}" stroke="${INK.handLine}" stroke-width="2.5"/>`;
    } else {
      hands = [-1, 1].map((s) => `
        <ellipse cx="${cx + s * (rx + 4)}" cy="${cy + ry * 0.22}" rx="${handR}" ry="${handR + 1}" fill="${INK.hand}" stroke="${INK.handLine}" stroke-width="2.5"/>`).join("");
    }

    /* hat */
    const hy = top + 7;
    let hat = "";
    switch (config.hat % 4) {
      case 0: /* bucket */
        hat = `
          <path d="M ${cx - 21} ${hy} L ${cx - 15} ${hy - 19} Q ${cx} ${hy - 26} ${cx + 15} ${hy - 19} L ${cx + 21} ${hy} Z" fill="${t.hat}" ${o} stroke-linejoin="round"/>
          <path d="M ${cx - 16} ${hy - 7} h 32" stroke="${t.band}" stroke-width="4"/>
          <ellipse cx="${cx}" cy="${hy}" rx="29" ry="6.5" fill="${t.hat}" ${o}/>`;
        break;
      case 1: /* beanie */
        hat = `
          <circle cx="${cx}" cy="${hy - 22}" r="4.5" fill="${t.band}" ${o}/>
          <path d="M ${cx - 23} ${hy} Q ${cx} ${hy - 42} ${cx + 23} ${hy} Z" fill="${t.hat}" ${o} stroke-linejoin="round"/>
          <rect x="${cx - 24}" y="${hy - 6}" width="48" height="9" rx="4.5" fill="${t.band}" ${o}/>`;
        break;
      case 2: /* flat cap */
        hat = `
          <path d="M ${cx - 22} ${hy} Q ${cx - 18} ${hy - 18} ${cx + 2} ${hy - 17} Q ${cx + 20} ${hy - 16} ${cx + 22} ${hy} Z" fill="${t.hat}" ${o} stroke-linejoin="round"/>
          <path d="M ${cx + 10} ${hy} q 14 -3 20 1 q -8 4 -20 2 Z" fill="${t.band}" ${o} stroke-linejoin="round"/>`;
        break;
      default: /* sun hat */
        hat = `
          <path d="M ${cx - 17} ${hy - 3} L ${cx - 13} ${hy - 18} Q ${cx} ${hy - 23} ${cx + 13} ${hy - 18} L ${cx + 17} ${hy - 3} Z" fill="${t.hat}" ${o} stroke-linejoin="round"/>
          <path d="M ${cx - 14} ${hy - 8} h 28" stroke="${t.band}" stroke-width="4.5"/>
          <ellipse cx="${cx}" cy="${hy - 2}" rx="35" ry="7.5" fill="${t.hat}" ${o}/>`;
    }

    /* pose extras */
    let extras = "";
    if (pose === "sleep") {
      extras = `
        <text x="${cx + rx * 0.75}" y="${top - 2}" font-size="13" fill="#9a9082" class="chief-float f1">z</text>
        <text x="${cx + rx * 0.95}" y="${top - 10}" font-size="16" fill="#9a9082" class="chief-float f2">z</text>
        <text x="${cx + rx * 1.2}" y="${top - 20}" font-size="20" fill="#9a9082" class="chief-float f3">Z</text>`;
    } else if (pose === "whistle") {
      extras = `
        <circle cx="${cx}" cy="${eyeY + eyeRY + 10}" r="3.4" fill="none" stroke="${INK.eye}" stroke-width="2.4"/>
        <text x="${cx + rx * 0.8}" y="${eyeY - 4}" font-size="15" fill="${t.accent}" class="chief-float f1">&#9834;</text>
        <text x="${cx + rx * 1.1}" y="${eyeY - 16}" font-size="13" fill="${t.accent}" class="chief-float f3">&#9835;</text>`;
    } else if (pose === "attentive" && scene.snapLine) {
      extras = `<text x="${cx + rx * 0.85}" y="${top - 8}" font-size="24" font-weight="700" fill="${t.accent}" class="chief-snap">!</text>`;
    }

    /* activity prop, sat on the ground beside him */
    const prop = isActivity && PROPS[scene.activity.prop]
      ? `<g transform="translate(150 ${groundY - 1}) scale(1.45)">${PROPS[scene.activity.prop]()}</g>`
      : "";

    return `
      <svg class="buddy-svg ${small ? "buddy-svg--small" : ""} ${reveal ? "buddy-svg--reveal" : ""}"
           viewBox="0 0 200 200" role="img" aria-label="Your chief" data-buddy>
        <ellipse cx="${isActivity ? 110 : cx}" cy="${groundY + 2}" rx="${isActivity ? 78 : rx * 1.25}" ry="6" fill="#000" opacity="0.28"/>
        ${prop}
        ${legs}
        ${body}
        ${eyes}
        ${hat}
        ${hands}
        ${extras}
      </svg>`;
  }

  /* ---------- Reference-art sprites (the high-fidelity render path) ----------
     The chief is drawn from the bundled reference sheets. A scene resolves to one
     sprite; the generative SVG is the fallback when art can't load. ---------- */

  const SPRITE_BASE = "assets/chief/";

  // Mood ladder, low → high, matched to the reference mood sheets. The chief's
  // resting expression is chosen from here by his balance score (see progress engine).
  const MOOD_LADDER = ["despair", "lonely", "sad", "slumped", "bored", "content", "fulfilled", "connected", "joy", "inlove"];

  function moodSprite(score) {
    const i = Math.min(MOOD_LADDER.length - 1, Math.max(0, Math.round(score * (MOOD_LADDER.length - 1))));
    return MOOD_LADDER[i];
  }

  // Resolve a scene to a sprite name.
  function spriteFor(scene) {
    if (!scene) return moodSprite(balanceScore());
    switch (scene.pose) {
      case "activity": return scene.activity && scene.activity.sprite;
      case "sleep": return "sleeping";
      case "walking": return "walking";
      case "whistle": return "content";
      case "excited": return "excited";
      case "joy": return "joy";
      case "bored": return moodSprite(balanceScore());      // resting mood reflects progress
      case "attentive": return balanceScore() >= 0.5 ? "content" : "walking";
      default: return moodSprite(balanceScore());
    }
  }

  // Render the chief. Priority: Midjourney render (if plugged in) → reference sprite → generative SVG.
  function buddyVisual(opts = {}, scene) {
    const b = state.buddy;
    if (!b) return "";
    const cls = `buddy-svg ${opts.small ? "buddy-svg--small" : ""} ${opts.reveal ? "buddy-svg--reveal" : ""}`;
    if (b.imageUrl) {
      return `<img class="${cls}" src="${esc(b.imageUrl)}" alt="Your chief" data-buddy draggable="false" />`;
    }
    if (!b.useSvg) {
      const name = spriteFor(scene) || moodSprite(balanceScore());
      // onerror falls back to the generative SVG so the prototype never shows a broken image
      return `<img class="${cls} chief-sprite" src="${SPRITE_BASE}${name}.png" alt="Your chief — ${name}" data-buddy draggable="false"
                   onerror="this.outerHTML=window.__chiefSvgFallback ? window.__chiefSvgFallback() : ''" />`;
    }
    return chiefSVG(b.config, scene || { pose: "attentive" }, opts);
  }

  // Exposed so a sprite that fails to load can swap itself for the SVG chief.
  window.__chiefSvgFallback = () => state.buddy ? chiefSVG(state.buddy.config, { pose: "attentive" }, {}) : "";

  /* ----------------------------------------------------------
     Voice-first input — Web Speech API
     Voice is the primary interface; text is a fully considered
     fallback, not a consolation prize. The component renders a
     tap-to-talk mic with a live transcript, defaults to voice
     when the browser supports it, and remembers whichever mode
     the dad last chose. Mic denied or unsupported → text.
     ---------------------------------------------------------- */

  const Speech = (() => {
    const Ctor = globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition || null;
    return { Ctor, supported: () => !!Ctor };
  })();

  const MIC_ICON = `
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true">
      <path d="M12 2a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3z"/>
      <path d="M19 11a7 7 0 0 1-14 0"/><path d="M12 18v4"/>
    </svg>`;

  const STOP_ICON = `
    <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <rect x="6.5" y="6.5" width="11" height="11" rx="2.5"/>
    </svg>`;

  // Set once mic trouble is seen this visit, so later inputs open in text mode.
  let voiceTrouble = false;

  // Spoken command that wipes the current entry: "let's reset" / "lets reset"
  const RESET_COMMAND = /\blet'?s\s+reset\b/i;

  // Mounts a voice-first answer input into `mount`.
  // opts: { placeholder, submitLabel, maxLength, onSubmit(value), onSkip?, skipLabel? }
  function createAnswerInput(mount, opts) {
    let mode = state.inputMode || (Speech.supported() && !voiceTrouble ? "voice" : "text");
    if (mode === "voice" && !Speech.supported()) mode = "text";
    let value = "";
    let interim = "";
    let rec = null;
    let listening = false;
    let notice = "";
    let watchdog = null;
    let gotSignal = false;
    let flash = "";
    let flashTimer = null;
    const maxLen = opts.maxLength || 160;

    const $ = (sel) => mount.querySelector(sel);

    function html() {
      const skipBtn = opts.onSkip
        ? `<button type="button" class="btn btn--quiet" data-act="skip">${esc(opts.skipLabel || "Skip this one")}</button>`
        : "";
      if (mode === "voice") {
        return `
          <div class="voice-box">
            <button type="button" class="mic-btn" data-act="mic" aria-label="Tap to talk">${MIC_ICON}</button>
            <p class="voice-status" data-ref="status"></p>
            <div class="transcript-wrap" data-ref="wrap">
              <p class="transcript is-empty" data-ref="transcript" aria-live="polite"></p>
              <button type="button" class="input-clear" data-act="clear" aria-label="Clear and start again">&times;</button>
            </div>
            <p class="micro voice-hint">Misheard? Tap &times; or say &ldquo;let's reset&rdquo; to wipe it and go again.</p>
            ${notice ? `<p class="micro voice-notice">${esc(notice)}</p>` : ""}
            <button type="button" class="btn btn--primary" data-act="submit" disabled>${esc(opts.submitLabel)}</button>
            <div class="voice-box__alts">
              <button type="button" class="btn btn--ghost btn--compact" data-act="toggle">Rather type it?</button>
              ${skipBtn}
            </div>
          </div>`;
      }
      return `
        <div class="answer-box">
          <div class="transcript-wrap ${value.trim() ? "has-content" : ""}" data-ref="wrap">
            <textarea data-ref="ta" placeholder="${esc(opts.placeholder)}" maxlength="${maxLen}">${esc(value)}</textarea>
            <button type="button" class="input-clear" data-act="clear" aria-label="Clear and start again">&times;</button>
          </div>
          ${notice ? `<p class="micro voice-notice">${esc(notice)}</p>` : ""}
          <button type="button" class="btn btn--primary" data-act="submit" ${value.trim() ? "" : "disabled"}>${esc(opts.submitLabel)}</button>
          <div class="voice-box__alts">
            ${Speech.supported() ? `<button type="button" class="btn btn--ghost btn--compact" data-act="toggle">Say it instead</button>` : ""}
            ${skipBtn}
          </div>
        </div>`;
    }

    function flashStatus(msg) {
      flash = msg;
      if (flashTimer) clearTimeout(flashTimer);
      flashTimer = setTimeout(() => { flash = ""; updateVoiceUI(); }, 2200);
    }

    function updateVoiceUI() {
      const status = $("[data-ref=status]");
      if (!status) return;
      const transcript = $("[data-ref=transcript]");
      const submit = $("[data-act=submit]");
      const mic = $("[data-act=mic]");
      const wrap = $("[data-ref=wrap]");
      const text = (value + (interim ? " " + interim : "")).trim();
      if (transcript) {
        transcript.textContent = text;
        transcript.classList.toggle("is-empty", !text);
      }
      if (wrap) wrap.classList.toggle("has-content", !!text);
      if (flash) status.textContent = flash;
      else if (listening) status.textContent = "Listening. Tap the square when you're done.";
      else if (value.trim()) status.textContent = "Tap the mic to add more, or send it.";
      else status.textContent = "Tap the mic and just say it.";
      if (mic) {
        mic.classList.toggle("is-listening", listening);
        mic.innerHTML = listening ? STOP_ICON : MIC_ICON;
        mic.setAttribute("aria-label", listening ? "Stop listening" : "Tap to talk");
      }
      if (submit) submit.disabled = value.trim().length === 0;
    }

    function clearWatchdog() {
      if (watchdog) { clearTimeout(watchdog); watchdog = null; }
    }

    function stopListening() {
      clearWatchdog();
      listening = false;
      if (rec) {
        try { rec.onend = null; rec.onerror = null; rec.stop(); } catch (e) { /* already stopped */ }
        rec = null;
      }
    }

    // Fatal mic problem: keep whatever was transcribed and drop to text.
    function failToText(message) {
      stopListening();
      voiceTrouble = true;
      mode = "text";
      state.inputMode = "text";
      save();
      notice = message;
      renderInput();
    }

    function handleError(code) {
      clearWatchdog();
      listening = false;
      interim = "";
      if (code === "not-allowed" || code === "service-not-allowed") {
        failToText("Couldn't get permission for the mic — no drama, type it instead.");
      } else if (code === "audio-capture" || code === "network") {
        failToText("The mic's not playing ball on this device — type it for now.");
      } else if (code === "no-speech") {
        notice = "Didn't catch anything. Give it another go, or type it.";
        renderInput();
      } else if (code === "aborted") {
        updateVoiceUI();
      } else {
        notice = "That didn't take. One more go, or type it instead.";
        renderInput();
      }
    }

    function startListening() {
      notice = "";
      gotSignal = false;
      let r;
      try {
        r = new Speech.Ctor();
        r.lang = "en-GB";
        r.continuous = true;
        r.interimResults = true;
      } catch (e) {
        failToText("Voice isn't available in this browser — typing it is.");
        return;
      }
      r.onstart = () => { gotSignal = true; };
      r.onaudiostart = () => { gotSignal = true; };
      r.onresult = (ev) => {
        gotSignal = true;
        interim = "";
        let resetHeard = false;
        for (let i = ev.resultIndex; i < ev.results.length; i++) {
          const res = ev.results[i];
          if (res.isFinal) {
            const chunk = res[0].transcript;
            if (RESET_COMMAND.test(chunk)) resetHeard = true;
            else value = (value + " " + chunk).trim().slice(0, maxLen);
          } else {
            interim += res[0].transcript;
          }
        }
        if (resetHeard) {
          value = "";
          interim = "";
          flashStatus("Cleared, chief. Off you go again.");
        }
        updateVoiceUI();
      };
      r.onend = () => {
        clearWatchdog();
        listening = false;
        interim = "";
        rec = null;
        updateVoiceUI();
      };
      r.onerror = (ev) => handleError(ev && ev.error);
      try {
        r.start();
        rec = r;
        listening = true;
      } catch (e) {
        failToText("The mic wouldn't start here — type it instead.");
        return;
      }
      // If nothing comes back at all (some in-app browsers and iOS setups
      // fail silently), bail out to text rather than looking dead.
      watchdog = setTimeout(() => {
        if (!gotSignal) failToText("The mic's not picking anything up here — type it for now.");
      }, 7000);
      updateVoiceUI();
    }

    function doSubmit() {
      if (mode === "text") {
        const ta = $("[data-ref=ta]");
        if (ta) value = ta.value;
      }
      const val = value.trim();
      if (!val) return;
      stopListening();
      opts.onSubmit(val);
    }

    function switchMode() {
      if (mode === "text") {
        const ta = $("[data-ref=ta]");
        if (ta) value = ta.value; // carry typed text into voice mode and back
      }
      stopListening();
      mode = mode === "voice" ? "text" : "voice";
      state.inputMode = mode;
      save();
      notice = "";
      renderInput();
    }

    function clearEntry() {
      value = "";
      interim = "";
      if (mode === "text") {
        const ta = $("[data-ref=ta]");
        const submit = $("[data-act=submit]");
        const wrap = $("[data-ref=wrap]");
        if (ta) { ta.value = ""; ta.focus(); }
        if (submit) submit.disabled = true;
        if (wrap) wrap.classList.remove("has-content");
      } else {
        flashStatus("Cleared, chief. Off you go again.");
        updateVoiceUI();
      }
    }

    function wireTextarea() {
      const ta = $("[data-ref=ta]");
      const submit = $("[data-act=submit]");
      const wrap = $("[data-ref=wrap]");
      if (!ta) return;
      ta.addEventListener("input", () => {
        value = ta.value;
        if (submit) submit.disabled = value.trim().length === 0;
        if (wrap) wrap.classList.toggle("has-content", value.trim().length > 0);
      });
      ta.focus();
    }

    function renderInput() {
      mount.innerHTML = html();
      if (mode === "voice") updateVoiceUI();
      else wireTextarea();
    }

    // One delegated listener on the mount: buttons keep working no matter
    // what state the recogniser is in — the exits can never be lost.
    mount.addEventListener("click", (ev) => {
      const btn = ev.target.closest("[data-act]");
      if (!btn || !mount.contains(btn)) return;
      switch (btn.dataset.act) {
        case "mic":
          if (listening) { stopListening(); updateVoiceUI(); }
          else startListening();
          break;
        case "submit": doSubmit(); break;
        case "toggle": switchMode(); break;
        case "clear": clearEntry(); break;
        case "skip":
          stopListening();
          if (opts.onSkip) opts.onSkip();
          break;
      }
    });

    renderInput();
  }

  /* ----------------------------------------------------------
     LLM language interface — Claude powers the conversational
     voice live when a key is connected. Every LLM moment has a
     scripted fallback so the prototype always works; generated
     copy is swapped in when it arrives.
     ---------------------------------------------------------- */

  const VOICE_SYSTEM = `You are the voice of Alright Chief, a transition app for new dads who want to feel like themselves while becoming the father their family needs.

Voice: British, casual, direct, down-to-earth. Like an older brother or a good mate who can tell when something is slightly off and cares enough to ask properly. Masculine without being macho. Supportive without being soft. Funny without being try-hard. Warm but not soft. Honest but not heavy.

Hard rules:
- One or two short sentences, never more.
- No emoji. No exclamation marks. No corporate self-help wellness language. No cheesy dad cliches or lad culture.
- Never cheerleady. Never scored or gamified language (no streaks, points, "crushing it").
- Acknowledge loss without dwelling. You can love your kid completely and still miss a Saturday morning — both are true.
- Address the user as "chief" sparingly, at most once.
- British English spelling.`;

  const LLM = {
    model: "claude-opus-4-8",
    storageKey: "alrightchief_api_key",
    getKey() {
      try { return localStorage.getItem(this.storageKey) || ""; } catch (e) { return ""; }
    },
    setKey(k) {
      try {
        if (k) localStorage.setItem(this.storageKey, k);
        else localStorage.removeItem(this.storageKey);
      } catch (e) { /* private mode */ }
      updateLLMStatus();
    },
    enabled() { return this.getKey().length > 0; },

    async ask(prompt, maxTokens = 200) {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": this.getKey(),
          "anthropic-version": "2023-06-01",
          // Required opt-in for direct browser (CORS) calls to the Claude API
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: maxTokens,
          system: VOICE_SYSTEM,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      if (!res.ok) throw new Error(`Claude API ${res.status}`);
      const data = await res.json();
      if (data.stop_reason === "refusal") throw new Error("refusal");
      const block = (data.content || []).find((b) => b.type === "text");
      return block ? block.text.trim() : "";
    },
  };

  function updateLLMStatus() {
    const el = document.getElementById("llm-status");
    if (el) el.textContent = LLM.enabled() ? "Claude connected" : "scripted fallback";
  }

  // Swap generated copy into a live element if the user is still on that screen.
  function swapIn(elId, promise) {
    if (!LLM.enabled()) return;
    promise.then((text) => {
      const el = document.getElementById(elId);
      if (el && text) {
        el.textContent = text;
        el.classList.add("llm-swap");
      }
    }).catch(() => { /* scripted fallback already showing */ });
  }

  function profileSummary() {
    const p = state.profile;
    return `Baby: ${p.babyAge || "unknown age"}. ${p.which || ""}. Home: ${p.home || "unknown"}.
A good Saturday before the baby: "${p.saturday || "—"}".
Something he misses: "${p.miss || "—"}".
Something he wants his kid to know he loved: "${p.love || "—"}".`;
  }

  function llmAck(question, answer) {
    return LLM.ask(
      `During onboarding the app asked a new dad: "${question}"
He answered: "${answer}"
Write one short, warm acknowledgement in the Alright Chief voice before the next question. React to what he actually said. No question back.`,
      100
    );
  }

  function llmReflection(lost, gained) {
    return LLM.ask(
      `Context about this dad:
${profileSummary()}

He just made today's entry in his two-column ledger.
Lost column: "${lost}"
Gained column: "${gained}"
Write one short closing line in the Alright Chief voice. Hold both sides honestly — don't fix the imbalance, just notice it.`,
      120
    );
  }

  function llmInsight() {
    const lines = state.entries
      .map((e) => `${e.dateKey} — lost: "${e.lost}" / gained: "${e.gained}"`)
      .join("\n");
    return LLM.ask(
      `Context about this dad:
${profileSummary()}

His ledger so far (oldest first):
${lines}

Write one observation in the Alright Chief voice that connects the lost and gained columns over time — a mirror, not advice. Reference specific entries. Two sentences maximum, no response required from him.`,
      180
    );
  }

  // Daily insight cache so we don't call the API on every render.
  function cachedLLMInsight() {
    const c = state.llmInsight;
    if (c && c.dateKey === dateKey() && c.count === state.entries.length) return c.text;
    return null;
  }

  let insightInFlight = false;
  function maybeGenerateInsight() {
    if (!LLM.enabled() || state.entries.length < 4) return;
    if (cachedLLMInsight() || insightInFlight) return;
    insightInFlight = true;
    llmInsight().then((text) => {
      insightInFlight = false;
      if (!text) return;
      state.llmInsight = { dateKey: dateKey(), count: state.entries.length, text };
      save();
      const el = document.getElementById("insight-line");
      if (el) { el.textContent = text; el.classList.add("llm-swap"); }
    }).catch(() => { insightInFlight = false; });
  }

  /* ----------------------------------------------------------
     Avatar pipeline — Midjourney
     Midjourney has no public API, so the pipeline is:
     1. The app composes a bespoke character prompt from the
        dad's own answers (consistent art direction, personal
        details vary) — one prompt per dad, every buddy unique.
     2. The prompt goes to Midjourney (design team / batch job).
     3. The rendered image comes back in as the buddy.
     The generative SVG creature is the live in-app stand-in.
     ---------------------------------------------------------- */

  function midjourneyPrompt() {
    const p = state.profile;
    const cfg = state.buddy?.config;
    const t = cfg ? THEMES[cfg.theme % THEMES.length] : THEMES[0];
    const hat = cfg ? HAT_NAMES[cfg.hat % 4] : HAT_NAMES[0];
    const learned = learnedActivities();
    const activity = learned.length
      ? learned[Math.floor(Math.random() * learned.length)].doing
      : "standing about contentedly, arms crossed";
    const sourceMaterial = [p.saturday, p.miss, p.love].filter(Boolean).join("; ")
      || "quiet Saturdays, music, the outdoors";
    return [
      "small round bean-shaped mascot character, matte black body,",
      "large plain white oval eyes, no mouth, no nose,",
      "stubby little legs with chunky dark shoes, purple mitten hands,",
      `wearing a ${t.name} ${hat},`,
      `caught ${activity},`,
      `the scene is built from his owner's life: ${sourceMaterial},`,
      "thick clean cartoon outlines, flat colours, sticker-style character sheet,",
      "deadpan and friendly, consistent character design,",
      "warm charcoal background #15120e, single amber accent light #e8923c",
      "--ar 1:1 --style raw --v 6",
    ].join(" ");
  }

  /* ----------------------------------------------------------
     Copy — the Alright Chief voice (scripted fallback).
     British. Older brother. Warm, never cheerleady.
     ---------------------------------------------------------- */

  const OB_QUESTIONS = [
    {
      key: "babyAge", type: "chips", kicker: "First things first",
      text: "Before we get started — how old is your little one?",
      options: ["Still on the way", "0–3 months", "3–12 months", "1–2 years", "Older than that"],
    },
    {
      key: "which", type: "chips", kicker: "The dad admin",
      text: "First time, or have you done this before?",
      options: ["First time", "Second", "Third or more"],
    },
    {
      key: "home", type: "chips", kicker: "The dad admin",
      text: "And who's holding the fort with you?",
      options: ["Me and my partner", "Co-parenting", "Just me"],
    },
    { type: "pivot" },
    {
      key: "saturday", type: "text", kicker: "Now the important bit — you",
      text: "What did a good Saturday look like, before all this?",
      sub: "Doesn't have to be impressive. It has to be true.",
      placeholder: "Long ride out. Record shops. The match with the lads. Absolutely nothing…",
    },
    {
      key: "miss", type: "text", kicker: "Now the important bit — you",
      text: "What's something you haven't done in months that you miss?",
      sub: "Be honest. Nobody's marking this.",
      placeholder: "Go on…",
    },
    {
      key: "love", type: "text", kicker: "Last one",
      text: "What do you want your kid to know you loved?",
      sub: "The thing that's yours. The thing worth keeping hold of.",
      placeholder: "Music. The hills. Cooking properly. Your team…",
    },
  ];

  const GEN_LINES = [
    "Right. Give us a second, chief…",
    "Taking what you told us…",
    "The Saturdays. The things you miss…",
    "Making you someone no one else has…",
  ];

  const DONE_LINES = [
    "That's your five minutes, chief. Off you go.",
    "Done. The ledger's a day richer. So are you, probably.",
    "Good. Honest counts double round here.",
    "That's it. We don't want any more of your day.",
  ];

  const LOST_PROMPTS = [
    { q: "What's one thing in your lost column today?", sub: "Something you missed, skipped, or didn't get to finish. It counts." },
    { q: "Go on then — what got squeezed out today?", sub: "The half-watched film. The gym session that didn't happen. Name it." },
    { q: "What did today cost you?", sub: "You can love your kid completely and still miss a Saturday morning. Both are true." },
  ];

  const GAINED_PROMPTS = [
    { q: "And one for the gained column?", sub: "Doesn't need to be big. Fragments count." },
    { q: "Now the other side — what did today give you?", sub: "Small is fine. Small is the whole point." },
    { q: "And what landed in the gained column?", sub: "Most apps only show you the gain. We hold both. But this side matters too." },
  ];

  const POKE_LINES = [
    "Oi.",
    "Heh.",
    "Steady on, chief.",
    "He did a little wobble. For you.",
    "He's pretending he didn't like that. He did.",
    "He doesn't need anything. He's just glad you came.",
  ];

  const GRAB_LINES = [
    "Oi. Mind the hat.",
    "Picked up like a kitten. He permits this.",
    "He's dangling. He's fine. Probably.",
    "Careful — that hat is his whole look.",
  ];

  const DROP_LINES = [
    "Landed. Dignity mostly intact.",
    "He bounced. He liked it, and will deny it.",
    "Down safe. He's pretending that never happened.",
    "Solid landing. He gives it a seven.",
  ];

  const SPIN_LINES = [
    "A spin. Bold.",
    "Whee. He said nothing of the sort.",
    "He's seeing stars. Give him a second.",
  ];

  const SNAP_LINES = [
    "Eh? Oh. It's you.",
    "He was miles away. He's back now.",
    "Snapped out of it. He'll deny he was bored.",
    "You have his full attention. Briefly.",
  ];

  /* ---------- What's he up to when you visit ---------- */

  // null = roll a fresh scene next time the buddy tab opens
  let buddyScene = null;

  function rollScene() {
    const learned = learnedActivities();
    if (learned.length && Math.random() < 0.6) {
      return { pose: "activity", activity: learned[Math.floor(Math.random() * learned.length)] };
    }
    const idles = ["bored", "sleep", "whistle", "walking"];
    return { pose: idles[Math.floor(Math.random() * idles.length)] };
  }

  function sceneCaption(scene) {
    const name = state.buddy?.name || "Your chief";
    switch (scene.pose) {
      case "activity":
        return `${name} is ${scene.activity.doing}. ${scene.activity.quip}`;
      case "sleep":
        return `${name}'s asleep on his feet. Long day of doing your old Saturdays.`;
      case "whistle":
        return `${name}'s whistling something. Sounds suspiciously like the good old days.`;
      case "walking":
        return `${name}'s having a wander. No particular place to be, which is the point.`;
      case "bored": {
        const s = balanceScore();
        if (s < 0.35) return `${name}'s a bit flat today — same as your lost column lately. Early days.`;
        if (s >= 0.7) return `${name} looks properly settled. Funny, so do your last few entries.`;
        return `${name} is just standing about. He was like that when you got here.`;
      }
      default:
        return scene.snapLine || `All yours, chief. He's paying attention.`;
    }
  }

  function observeLines() {
    const p = state.profile;
    const name = state.buddy?.name || "Your chief";
    const lines = [];
    if (p.miss) lines.push(`${name} got “${p.miss}” in earlier. Someone had to keep it going.`);
    if (p.saturday) lines.push(`${name} had one of your old Saturdays — “${p.saturday}”. He was thinking of you.`);
    if (p.love) lines.push(`${name} is keeping “${p.love}” warm for you. He takes the job seriously.`);
    lines.push(`${name} doesn't need feeding, winding or settling. He just notices when you check in.`);
    lines.push(`${name} has been doing the lost-column things all week. Vicariously, you're flying.`);
    return lines;
  }

  /* ----------------------------------------------------------
     Progress engine — the transition, made visible
     Tags every ledger entry by theme and tracks how the
     lost-column complaints (missing freedom: nights out, sleep,
     training, time to himself) fade, while the gained-column
     reflections (connection, patience, presence, purpose,
     partnership) grow. Drives the welcome message, the push
     notifications, and the chief's resting mood.
     ---------------------------------------------------------- */

  const LOST_THEMES = [
    { id: "going-out", label: "going out", keywords: ["going out", "night out", "nights out", "pub", "pint", "drinks", "mates", "lads", "party", "social", "spontaneous", "spontaneity"] },
    { id: "sleep", label: "sleep", keywords: ["sleep", "lie-in", "lie in", "tired", "knackered", "exhausted", "rest", "nap", "shattered"] },
    { id: "training", label: "training", keywords: ["gym", "training", "workout", "run", "running", "football", "five-a-side", "five a side", "fitness", "exercise", "ride", "bike"] },
    { id: "time", label: "time to himself", keywords: ["time to myself", "me time", "headspace", "head straight", "quiet", "alone", "my own time", "space", "freedom"] },
    { id: "hobbies", label: "his own things", keywords: ["hobby", "hobbies", "music", "gaming", "reading", "fishing", "film", "films", "records"] },
  ];

  const GAINED_THEMES = [
    { id: "connection", label: "connection", keywords: ["smile", "smiled", "laugh", "laughed", "bond", "close", "cuddle", "chest", "love", "giggle"] },
    { id: "patience", label: "patience", keywords: ["patience", "patient", "calm", "calmer", "slower", "steady", "steadier"] },
    { id: "presence", label: "being present", keywords: ["present", "moment", "noticing", "noticed", "park", "walk", "here and now", "slow down"] },
    { id: "purpose", label: "purpose", keywords: ["protect", "protecting", "provide", "worth", "matters", "reason", "proud", "something worth"] },
    { id: "partnership", label: "teamwork at home", keywords: ["team", "sarah", "partner", "wife", "together", "shared", "us", "we"] },
    { id: "perspective", label: "perspective", keywords: ["understand", "perspective", "care less", "priorities", "my dad", "own dad", "grown"] },
  ];

  function tagThemes(text, themes) {
    const t = (text || "").toLowerCase();
    return themes.filter((th) => th.keywords.some((k) => t.includes(k))).map((th) => th.id);
  }

  // 0 (still raw, complaint-heavy) → 1 (settled, balanced). Heuristic, recency-weighted.
  function balanceScore() {
    const es = state.entries;
    if (!es.length) return 0.45;
    const n = es.length;
    const half = Math.max(1, Math.floor(n / 2));
    const early = es.slice(0, half);
    const recent = es.slice(-half);
    const lostDen = (a) => a.reduce((s, e) => s + tagThemes(e.lost, LOST_THEMES).length, 0) / a.length;
    const gainDen = (a) => a.reduce((s, e) => s + tagThemes(e.gained, GAINED_THEMES).length, 0) / a.length;
    const lostDrop = lostDen(early) - lostDen(recent);
    const gainRise = gainDen(recent) - gainDen(early);
    let s = 0.5 + 0.26 * lostDrop + 0.26 * gainRise + 0.18 * gainDen(recent) - 0.16 * lostDen(recent);
    s += Math.min(0.08, n * 0.004); // honest, sustained engagement earns a little confidence
    return Math.max(0, Math.min(1, s));
  }

  // Find the lost theme that's faded most and the gained theme that's risen most,
  // with real example phrases and a rough timeframe — the raw material for copy.
  function progressReport() {
    const es = state.entries;
    if (es.length < 5) return null;
    const n = es.length;
    const half = Math.max(1, Math.floor(n / 2));
    const early = es.slice(0, half);
    const recent = es.slice(-half);
    const weeks = Math.max(2, Math.round((new Date(es[n - 1].iso) - new Date(es[0].iso)) / 6048e5));

    const countIn = (arr, id, themes, side) =>
      arr.filter((e) => tagThemes(e[side], themes).includes(id)).length;

    let declined = null;
    for (const th of LOST_THEMES) {
      const e0 = countIn(early, th.id, LOST_THEMES, "lost");
      const e1 = countIn(recent, th.id, LOST_THEMES, "lost");
      if (e0 - e1 > (declined ? declined.drop : 0)) {
        const ex = early.find((e) => tagThemes(e.lost, LOST_THEMES).includes(th.id));
        declined = { theme: th, drop: e0 - e1, early: e0, recent: e1, example: ex && ex.lost };
      }
    }
    let risen = null;
    for (const th of GAINED_THEMES) {
      const g0 = countIn(early, th.id, GAINED_THEMES, "gained");
      const g1 = countIn(recent, th.id, GAINED_THEMES, "gained");
      if (g1 - g0 >= (risen ? risen.rise : 0)) {
        const ex = [...recent].reverse().find((e) => tagThemes(e.gained, GAINED_THEMES).includes(th.id));
        risen = { theme: th, rise: g1 - g0, recent: g1, example: ex && ex.gained };
      }
    }
    return { weeks, declined, risen, score: balanceScore(), entries: n };
  }

  // The welcome-back line: scripted from the report (Claude rewrites it live when connected).
  function progressGreeting() {
    const r = progressReport();
    if (!r) return null;
    const d = r.declined, g = r.risen;
    if (d && d.drop > 0 && d.example) {
      const recentBit = d.recent === 0
        ? `the last few weeks, not once`
        : `lately, ${d.recent === 1 ? "just once" : "barely"}`;
      const gainBit = g && g.example ? ` Meanwhile the gained side keeps turning up things like “${g.example}”.` : "";
      return `${r.weeks} weeks ago, ${d.theme.label} was in your lost column most weeks — “${d.example}”. ${capitalise(recentBit)}.${gainBit}`;
    }
    if (g && g.example && g.recent > 0) {
      return `Quietly, the gained column is doing the talking now — “${g.example}”. That wasn't there when you started.`;
    }
    return null;
  }

  const capitalise = (s) => s ? s[0].toUpperCase() + s.slice(1) : s;

  // Short nudges for notifications, drawn from the same signal.
  function progressNudges() {
    const r = progressReport();
    const name = state.buddy?.name || "your chief";
    const out = [];
    if (r && r.declined && r.declined.drop > 0) {
      out.push(`You've barely mentioned missing ${r.declined.theme.label} lately. Quietly, that's huge.`);
    }
    if (r && r.risen && r.risen.example) {
      out.push(`Your gained column's filling up — “${r.risen.example}”. Worth a look back at week one.`);
    }
    out.push(`${capitalise(name)} hasn't seen you today. Thirty seconds: one lost, one gained.`);
    out.push(`Five minutes, chief. One thing lost, one thing gained. Then we're out of your way.`);
    return out;
  }

  /* ---------- Push notifications (Web Notifications API) ----------
     In production these are scheduled server-side via the Push API + a service
     worker. In the prototype the same copy is delivered on demand (and a demo
     nudge a few seconds after you enable them) so the behaviour is real. ---------- */

  const Notify = {
    supported: () => typeof window !== "undefined" && "Notification" in window,
    permission: () => (Notify.supported() ? Notification.permission : "unsupported"),
    async request() {
      if (!Notify.supported()) return "unsupported";
      const p = await Notification.requestPermission();
      updateNotifyStatus();
      return p;
    },
    show(title, body) {
      if (!Notify.supported() || Notification.permission !== "granted") return false;
      const mood = state.buddy && !state.buddy.useSvg ? SPRITE_BASE + moodSprite(balanceScore()) + ".png" : undefined;
      try { new Notification(title, { body, icon: mood, badge: mood }); return true; } catch (e) { return false; }
    },
  };

  function updateNotifyStatus() {
    const el = document.getElementById("notify-status");
    if (!el) return;
    const p = Notify.permission();
    el.textContent = p === "granted" ? "on" : p === "denied" ? "blocked in browser" : p === "unsupported" ? "not supported here" : "off";
  }

  // Fire a progress nudge now (and via Claude when connected).
  async function sendProgressNudge() {
    const title = "Alright Chief";
    let body = pick(progressNudges(), Date.now());
    if (LLM.enabled()) {
      const r = progressReport();
      try {
        body = await LLM.ask(
          `Write a single short push notification (max ~16 words) in the Alright Chief voice that nudges this new dad and hints at his progress.${r ? "\nProgress so far: " + JSON.stringify({ weeks: r.weeks, faded: r.declined && r.declined.theme.label, growing: r.risen && r.risen.theme.label }) : ""}`,
          60
        ) || body;
      } catch (e) { /* scripted nudge */ }
    }
    return Notify.show(title, body);
  }

  function insight() {
    const generated = cachedLLMInsight();
    if (generated) return generated;
    const es = state.entries;
    if (es.length < 4) return null;
    const first = es[0];
    const last = es[es.length - 1];
    const weeks = Math.max(1, Math.round((new Date(last.iso) - new Date(first.iso)) / 6048e5));
    const variants = [
      `When you started this ledger, the lost column had “${first.lost}”. This week, the gained column has “${last.gained}”. Look at that.`,
      `${es.length} entries in. The lost column hasn't emptied — it won't, and we won't pretend otherwise. But read the gained column back sometime. It's telling a story you couldn't see while you were living it.`,
      `${weeks > 1 ? weeks + " weeks ago" : "When you started"}, you were losing “${first.lost}”. Lately you're gaining things like “${last.gained}”. Nobody's keeping score. But somebody noticed.`,
    ];
    return pick(variants, es.length);
  }

  /* ----------------------------------------------------------
     Screens
     ---------------------------------------------------------- */

  function render() {
    switch (state.stage) {
      case "welcome": return renderWelcome();
      case "onboarding": return renderOnboarding();
      case "generating": return renderGenerating();
      case "naming": return renderNaming();
      case "settled": return renderSettled();
      case "app": return renderApp();
      default: return renderWelcome();
    }
  }

  function renderWelcome() {
    app.innerHTML = `
      <div class="screen welcome">
        <div class="welcome__top">
          <div class="welcome__mark">ALRIGHT CHIEF</div>
          <h1 class="display fade-line">Alright,<br/>chief?</h1>
          <p class="lede fade-line">It's a casual question. It's also the real one.</p>
          <p class="lede fade-line">Becoming a dad changes everything — your routine, your freedom, your sense of self. This is five minutes a day for keeping hold of who you are while you grow into the father your family needs.</p>
        </div>
        <div class="welcome__bottom">
          <button class="btn btn--primary" data-act="start">Let's get set up</button>
          <p class="micro" style="text-align:center">Six questions, about two minutes. Then we stay out of your way.</p>
        </div>
      </div>`;
    on("[data-act=start]", () => set({ stage: "onboarding", obStep: 0 }));
  }

  function renderOnboarding() {
    const step = state.obStep;
    const q = OB_QUESTIONS[step];
    const answerable = OB_QUESTIONS.filter((x) => x.type !== "pivot").length;
    const answeredSoFar = OB_QUESTIONS.slice(0, step).filter((x) => x.type !== "pivot").length;
    const stepsHTML = Array.from({ length: answerable }, (_, i) =>
      `<span class="convo__step ${i < answeredSoFar ? "is-done" : ""}"></span>`).join("");

    if (q.type === "pivot") {
      app.innerHTML = `
        <div class="screen convo">
          <div class="convo__header">
            <span class="wordmark" style="font-size:14px;color:var(--accent)">Alright Chief</span>
            <span class="convo__steps">${stepsHTML}</span>
          </div>
          <div class="convo__body" style="justify-content:center">
            <p class="q-kicker fade-line">Right, that's the dad admin done</p>
            <h2 class="q-text fade-line">Now the more important part. You.</h2>
            <p class="q-sub fade-line">Three questions about the bloke who was here before the baby. Being asked is half the point.</p>
          </div>
          <div class="screen-footer">
            <button class="btn btn--primary" data-act="next">Go on then</button>
          </div>
        </div>`;
      on("[data-act=next]", () => set({ obStep: step + 1 }));
      return;
    }

    const chips = q.type === "chips"
      ? `<div class="chips">${q.options.map((o) => `<button class="chip" data-opt="${esc(o)}">${esc(o)}</button>`).join("")}</div>`
      : "";

    const textbox = q.type === "text" ? `<div id="answer-mount"></div>` : "";

    app.innerHTML = `
      <div class="screen convo">
        <div class="convo__header">
          <span class="wordmark" style="font-size:14px;color:var(--accent)">Alright Chief</span>
          <span class="convo__steps">${stepsHTML}</span>
        </div>
        <div class="convo__body">
          <p class="ack-line" id="ack-line"></p>
          <p class="q-kicker">${esc(q.kicker)}</p>
          <h2 class="q-text">${esc(q.text)}</h2>
          ${q.sub ? `<p class="q-sub">${esc(q.sub)}</p>` : ""}
          ${chips}${textbox}
        </div>
      </div>`;

    const advance = (value) => {
      state.profile[q.key] = value;
      // Claude reacts to what he actually wrote — appears above the next question
      const ackPromise = q.type === "text" && value && LLM.enabled()
        ? llmAck(q.text, value)
        : null;
      const next = step + 1;
      if (next >= OB_QUESTIONS.length) {
        set({ stage: "generating" });
      } else {
        set({ obStep: next });
      }
      if (ackPromise) swapIn("ack-line", ackPromise);
    };

    if (q.type === "chips") {
      app.querySelectorAll(".chip").forEach((c) =>
        c.addEventListener("click", () => advance(c.dataset.opt)));
    } else {
      createAnswerInput(app.querySelector("#answer-mount"), {
        placeholder: q.placeholder,
        submitLabel: "Next",
        maxLength: 160,
        onSubmit: advance,
        onSkip: () => advance(""),
      });
    }
  }

  function renderGenerating() {
    app.innerHTML = `
      <div class="screen genscreen">
        <div class="gen-orb"></div>
        <p class="lede" id="gen-line">${GEN_LINES[0]}</p>
      </div>`;
    let i = 0;
    const lineEl = app.querySelector("#gen-line");
    const tick = setInterval(() => {
      i++;
      if (i < GEN_LINES.length) {
        lineEl.textContent = GEN_LINES[i];
      } else {
        clearInterval(tick);
        const seed = JSON.stringify(state.profile) + "|" + Date.now();
        state.buddy = { config: genBuddyConfig(seed), name: "" };
        set({ stage: "naming" });
      }
    }, 950);
  }

  function renderNaming() {
    app.innerHTML = `
      <div class="screen" style="gap:16px">
        <div style="flex:1;display:flex;flex-direction:column;justify-content:center;gap:16px;text-align:center">
          <div class="buddy-stage">${buddyVisual({ reveal: true }, { pose: "excited" })}</div>
          <h2 class="q-text" style="text-align:center">Your chief.<br/>No one else's.</h2>
          <p class="q-sub" style="text-align:center">He's listening to what you tell us — the Saturdays, the things you miss — and he'll keep them running while you're busy. The hat, the build, the colours: every chief comes out a bit different. What are you calling him?</p>
          <p class="micro" style="text-align:center">Prototype note: in production this is a Midjourney render in the house style, generated from your answers — the prompt's in the side panel.</p>
        </div>
        <div class="screen-footer">
          <div class="answer-box" style="margin-top:0">
            <input type="text" id="buddy-name" placeholder="Give him a name" maxlength="24" autocomplete="off"/>
            <button class="btn btn--primary" data-act="name" disabled>That's the one</button>
            <button class="btn btn--quiet" data-act="reroll">Not right? Spin up another</button>
          </div>
        </div>
      </div>`;

    const input = app.querySelector("#buddy-name");
    const btn = app.querySelector("[data-act=name]");
    input.addEventListener("input", () => { btn.disabled = input.value.trim().length === 0; });
    btn.addEventListener("click", () => {
      state.buddy.name = input.value.trim();
      set({ stage: "settled" });
    });
    on("[data-act=reroll]", () => {
      const seed = JSON.stringify(state.profile) + "|" + Date.now() + Math.random();
      state.buddy.config = genBuddyConfig(seed);
      render();
    });
  }

  function renderSettled() {
    const name = esc(state.buddy.name);
    app.innerHTML = `
      <div class="screen donescreen">
        <div class="buddy-stage">${buddyVisual({ small: true }, { pose: "joy" })}</div>
        <h2 class="q-text">Good name.<br/>${name} agrees.</h2>
        <p class="q-sub" style="max-width:280px">From here it's one entry a day. One thing lost, one thing gained. Not scored, not streaked, never more than five minutes. That's the deal.</p>
        <div class="screen-footer" style="width:100%">
          <button class="btn btn--primary" data-act="enter">Take me in</button>
        </div>
      </div>`;
    on("[data-act=enter]", () => set({ stage: "app", tab: "today", checkin: null }));
  }

  /* ---------- The app proper ---------- */

  function renderApp() {
    if (state.checkin) return renderCheckin();

    // Away from his screen, the chief gets back to whatever he was doing.
    if (state.tab !== "buddy") buddyScene = null;

    const tabContent =
      state.tab === "balance" ? balanceTab() :
      state.tab === "buddy" ? buddyTab() :
      todayTab();

    const buddyName = esc(state.buddy?.name || "Buddy");

    app.innerHTML = `
      <div class="appbar">
        <span class="wordmark">Alright Chief</span>
        <span class="date">${fmtShort(new Date().toISOString())}</span>
      </div>
      ${tabContent}
      <nav class="tabbar">
        ${tabBtn("today", "Today", `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1"/></svg>`)}
        ${tabBtn("balance", "The Balance", `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M7 4v16M17 9v11"/><path d="M4 20h16"/></svg>`)}
        ${tabBtn("buddy", buddyName, `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3c4.5 0 8 3.2 8 7.6 0 4.8-3.7 8.4-8 8.4s-8-3.6-8-8.4C4 6.2 7.5 3 12 3z"/><circle cx="9.5" cy="10.5" r="0.8" fill="currentColor"/><circle cx="14.5" cy="10.5" r="0.8" fill="currentColor"/><path d="M10 14.2c1.2 1 2.8 1 4 0"/></svg>`)}
      </nav>`;

    app.querySelectorAll(".tab").forEach((t) =>
      t.addEventListener("click", () => set({ tab: t.dataset.tab })));

    wireTab();
  }

  function tabBtn(id, label, icon) {
    return `<button class="tab ${state.tab === id ? "is-active" : ""}" data-tab="${id}">${icon}<span>${label}</span></button>`;
  }

  function todayTab() {
    const done = todayEntry();
    const name = esc(state.buddy?.name || "Your buddy");
    const obs = pick(observeLines(), new Date().getDate() + state.entries.length);
    const ins = insight();
    const welcome = progressGreeting();
    const score = balanceScore();
    const pct = Math.round(score * 100);

    const welcomeCard = welcome ? `
      <div class="card card--accent">
        <p class="card__kicker">Welcome back, chief</p>
        <p class="card__body" id="welcome-line">${esc(welcome)}</p>
        <div class="balance-meter" aria-label="Your balance, ${pct}%">
          <div class="balance-meter__fill" style="width:${pct}%"></div>
        </div>
        <p class="micro">Where you are on the way to feeling like yourself again. It only moves when you're honest.</p>
      </div>` : "";

    const checkinCard = done ? `
      <div class="card">
        <p class="card__kicker">Today · done</p>
        <p class="card__title">That's today sorted.</p>
        <p class="card__body">Lost: “${esc(done.lost)}”<br/>Gained: “${esc(done.gained)}”</p>
        <p class="micro">Entry #${state.entries.length} in the ledger. See you tomorrow — we don't do streaks, so relax.</p>
      </div>` : `
      <div class="card card--accent">
        <p class="card__kicker">Today's two</p>
        <p class="card__title">One thing lost.<br/>One thing gained.</p>
        <p class="card__body">Thirty seconds of honesty, then we'll leave you alone.</p>
        <button class="btn btn--primary" data-act="checkin" style="margin-top:6px">Do today's entry</button>
      </div>`;

    return `
      <div class="screen" style="padding-top:10px">
        <h2 class="home-greeting">${greeting()}</h2>
        <div class="home-stack">
          ${welcomeCard}
          ${checkinCard}
          ${ins ? `
          <div class="card">
            <p class="card__kicker">Noticed</p>
            <p class="card__body" id="insight-line">${esc(ins)}</p>
            <p class="micro">No response required. It's a mirror, not a notification.</p>
          </div>` : ""}
          <div class="card" data-act="visit" style="cursor:pointer;align-items:center;text-align:center">
            <div class="buddy-stage">${buddyVisual({ small: true }, { pose: "bored" })}</div>
            <p class="card__body">${esc(obs)}</p>
            <p class="micro">Tap to visit ${name}</p>
          </div>
        </div>
        <div class="screen-footer">
          <p class="micro" style="text-align:center">Private by design. No feed, no sharing, no comparison.</p>
        </div>
      </div>`;
  }

  function wireTab() {
    on("[data-act=checkin]", () => set({ checkin: { step: "lost", lost: "" } }));
    on("[data-act=visit]", () => set({ tab: "buddy" }));
    on("[data-act=reset-inline]", resetPrototype);
    wireBuddyInteractions();
    maybeGenerateInsight();
    // Claude rewrites the welcome-back line live when connected
    const r = progressReport();
    if (r && LLM.enabled() && document.getElementById("welcome-line")) {
      swapIn("welcome-line", LLM.ask(
        `Write the welcome-back line (1–2 sentences, Alright Chief voice) for a dad opening the app. Reflect his progress so he can see how far he's come. Data: ${JSON.stringify({ weeks: r.weeks, fadingComplaint: r.declined && r.declined.theme.label, earlyExample: r.declined && r.declined.example, growing: r.risen && r.risen.theme.label, recentGain: r.risen && r.risen.example })}`,
        140
      ));
    }
  }

  function balanceTab() {
    const es = [...state.entries].reverse();
    const ins = insight();

    if (es.length === 0) {
      return `
        <div class="screen" style="padding-top:10px">
          <h2 class="home-greeting">The Balance</h2>
          <p class="lede" style="margin-top:4px">A living ledger of the transition. Two columns, filling slowly.</p>
          <div class="ledger-empty">
            <p>Nothing here yet — that's fine, you've been busy.</p>
            <p style="margin-top:10px">Do today's entry and the ledger starts building. Week by week it becomes a portrait of where you are.</p>
          </div>
        </div>`;
    }

    const lostCol = es.map((e) => `
      <div class="entry entry--lost">${esc(e.lost)}<time>${fmtShort(e.iso)}</time></div>`).join("");
    const gainCol = es.map((e) => `
      <div class="entry entry--gained">${esc(e.gained)}<time>${fmtShort(e.iso)}</time></div>`).join("");

    return `
      <div class="screen" style="padding-top:10px">
        <h2 class="home-greeting">The Balance</h2>
        <p class="micro" style="margin-top:2px">Never perfectly balanced. That would be dishonest.</p>
        ${ins ? `
        <div class="card" style="margin-top:16px">
          <p class="card__kicker">Noticed</p>
          <p class="card__body" id="insight-line">${esc(ins)}</p>
        </div>` : ""}
        <div class="ledger">
          <div class="ledger__col">
            <div class="ledger__head checkin-side--lost">Lost <span class="ledger__count">${es.length}</span></div>
            ${lostCol}
          </div>
          <div class="ledger__col">
            <div class="ledger__head checkin-side--gained">Gained <span class="ledger__count">${es.length}</span></div>
            ${gainCol}
          </div>
        </div>
        <div class="screen-footer">
          <p class="micro" style="text-align:center">The imbalance is the point. Some weeks one side is heavier. The app doesn't fix it — it shows you where you are.</p>
        </div>
      </div>`;
  }

  function buddyTab() {
    const name = esc(state.buddy?.name || "Your chief");
    if (!buddyScene) buddyScene = rollScene();
    return `
      <div class="screen" style="padding-top:10px;text-align:center">
        <h2 class="home-greeting" style="text-align:center">${name}</h2>
        <p class="micro">Observe, or interact. Both count. He doesn't need you — he just notices when you're there.</p>
        <div style="flex:1;display:flex;flex-direction:column;justify-content:center;gap:18px">
          <div class="buddy-stage"><div class="buddy-holder" data-holder>${buddyVisual({}, buddyScene)}</div></div>
          <p class="buddy-line" id="buddy-line">${esc(sceneCaption(buddyScene))}</p>
        </div>
        <div class="screen-footer" style="align-items:center">
          <p class="micro">Tap to snap him out of whatever he's doing. Double-tap for a spin. Drag to pick him up by the scruff.</p>
          <button class="btn btn--quiet" data-act="reset-inline">Prototype v0.1 · start again</button>
        </div>
      </div>`;
  }

  // Oddballz-style handling: tap to poke, double-tap to spin, press-and-drag
  // to pick it up by the scruff and dangle it. It sways as you move, then
  // drops back with a bounce. Only the big buddy (inside [data-holder]) is
  // grabbable — the small one on Today just opens the buddy tab.
  function wireBuddyInteractions() {
    const svg = app.querySelector("[data-buddy]");
    const holder = app.querySelector("[data-holder]");
    if (!svg || !holder) return;

    let pokes = 0;
    const react = (pool, n) => {
      const line = app.querySelector("#buddy-line");
      if (line) line.textContent = pick(pool, n);
    };

    const poke = () => {
      svg.classList.remove("is-poked");
      void svg.getBoundingClientRect(); // restart animation
      svg.classList.add("is-poked");
      pokes++;
      react(POKE_LINES, pokes + new Date().getMinutes());
    };

    const spin = () => {
      svg.classList.remove("is-poked");
      svg.classList.add("is-spinning");
      svg.addEventListener("animationend", () => svg.classList.remove("is-spinning"), { once: true });
      react(SPIN_LINES, Date.now());
    };

    let pointerId = null;
    let startX = 0, startY = 0, lastX = 0;
    let sway = 0;
    let dragging = false;
    let lastTap = 0;

    svg.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      pointerId = e.pointerId;
      try { svg.setPointerCapture(pointerId); } catch (err) { /* not supported */ }
      startX = e.clientX;
      startY = e.clientY;
      lastX = e.clientX;
      dragging = false;
      sway = 0;
    });

    svg.addEventListener("pointermove", (e) => {
      if (pointerId === null || e.pointerId !== pointerId) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (!dragging && Math.hypot(dx, dy) > 10) {
        dragging = true;
        svg.classList.add("is-grabbed");
        holder.classList.add("is-held");
        react(GRAB_LINES, Date.now());
      }
      if (dragging) {
        // dangle physics: it swings with the horizontal motion, then settles
        sway = Math.max(-22, Math.min(22, sway * 0.82 + (e.clientX - lastX) * 1.4));
        lastX = e.clientX;
        holder.style.transform = `translate(${dx}px, ${dy}px) rotate(${sway.toFixed(1)}deg)`;
      }
    });

    const release = (e) => {
      if (pointerId === null || (e.pointerId !== undefined && e.pointerId !== pointerId)) return;
      pointerId = null;
      if (dragging) {
        dragging = false;
        svg.classList.remove("is-grabbed");
        holder.classList.remove("is-held");
        holder.classList.add("is-dropping");
        holder.style.transform = "";
        setTimeout(() => holder.classList.remove("is-dropping"), 650);
        react(DROP_LINES, Date.now());
      } else {
        // Mid-activity or mid-nap: the first tap snaps him out of it.
        if (buddyScene && buddyScene.pose !== "attentive") {
          buddyScene = { pose: "attentive", snapLine: pick(SNAP_LINES, Date.now()) };
          render();
          return;
        }
        const now = Date.now();
        if (now - lastTap < 350) {
          lastTap = 0;
          spin();
        } else {
          lastTap = now;
          poke();
        }
      }
    };
    svg.addEventListener("pointerup", release);
    svg.addEventListener("pointercancel", release);
  }

  /* ---------- Daily check-in flow ---------- */

  function renderCheckin() {
    const c = state.checkin;
    const dayN = state.entries.length;

    if (c.step === "done") {
      const name = esc(state.buddy?.name || "your buddy");
      app.innerHTML = `
        <div class="screen donescreen">
          <div class="done-tick">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12.5 9.5 18 20 6.5"/></svg>
          </div>
          <h2 class="q-text" id="done-line">${esc(pick(DONE_LINES, dayN))}</h2>
          <p class="q-sub" style="max-width:270px">Not scored. Not streaked. Just noticed.</p>
          <div class="screen-footer" style="width:100%">
            <button class="btn btn--primary" data-act="see-buddy">Go and see ${name}</button>
            <button class="btn btn--quiet" data-act="home">Back to today</button>
          </div>
        </div>`;
      on("[data-act=see-buddy]", () => set({ checkin: null, tab: "buddy" }));
      on("[data-act=home]", () => set({ checkin: null, tab: "today" }));
      // Claude reflects on the actual entry — swaps in over the scripted line
      const today = todayEntry();
      if (today && LLM.enabled()) swapIn("done-line", llmReflection(today.lost, today.gained));
      return;
    }

    const isLost = c.step === "lost";
    const prompt = isLost ? pick(LOST_PROMPTS, dayN) : pick(GAINED_PROMPTS, dayN);

    app.innerHTML = `
      <div class="screen convo">
        <div class="convo__header">
          <button class="btn btn--quiet" data-act="cancel" style="padding-left:0">← Not now</button>
          <span class="micro">${isLost ? "1 of 2" : "2 of 2"}</span>
        </div>
        <div class="convo__body">
          <p class="checkin-side ${isLost ? "checkin-side--lost" : "checkin-side--gained"}">${isLost ? "The lost column" : "The gained column"}</p>
          <h2 class="q-text">${esc(prompt.q)}</h2>
          <p class="q-sub">${esc(prompt.sub)}</p>
          <div id="answer-mount"></div>
        </div>
      </div>`;

    // Wire the escape hatch before anything else so the screen can always be left
    on("[data-act=cancel]", () => set({ checkin: null }));

    createAnswerInput(app.querySelector("#answer-mount"), {
      placeholder: isLost ? "e.g. a lie-in. A whole film. A clear head." : "e.g. patience you didn't know you had.",
      submitLabel: isLost ? "Next" : "Put it in the ledger",
      maxLength: 140,
      onSubmit: (val) => {
        if (isLost) {
          state.checkin = { step: "gained", lost: val };
          set({});
        } else {
          state.entries.push({
            dateKey: dateKey(),
            iso: new Date().toISOString(),
            lost: state.checkin.lost,
            gained: val,
          });
          state.checkin = { step: "done" };
          set({});
        }
      },
    });
  }

  /* ----------------------------------------------------------
     Demo data & reset (stage-side controls)
     ---------------------------------------------------------- */

  function seedDemo() {
    const profile = {
      babyAge: "3–12 months",
      which: "First time",
      home: "Me and my partner",
      saturday: "Long ride out on the bike, then the match with the lads",
      miss: "Five-a-side on Thursdays",
      love: "Music — gigs, the record collection",
    };
    const pairs = [
      ["A full night's sleep", "He smiled at me. An actual smile."],
      ["Finishing a film in one sitting", "A reason to leave work on time"],
      ["Gym session — cut short again", "Patience I didn't know I had"],
      ["Spontaneous pint with Dan", "A new kind of Saturday morning"],
      ["Sunday lie-in", "Bath time is somehow the best bit of the day"],
      ["A clear head after work", "First proper laugh. Unreal."],
      ["Five-a-side, again", "Walked to the park. Left the phone."],
      ["Reading more than two pages", "He fell asleep on my chest"],
      ["Watching the match start to finish", "Feeling like a team with Sarah"],
      ["An evening that was actually mine", "Caring less about things that don't matter"],
      ["Long ride out on the bike", "Something worth protecting"],
      ["Quiet. Just quiet.", "Started to understand my own dad a bit"],
    ];
    const dayOffsets = [63, 58, 51, 45, 38, 32, 26, 20, 14, 9, 4, 1];
    const entries = pairs.map(([lost, gained], i) => {
      const d = new Date();
      d.setDate(d.getDate() - dayOffsets[i]);
      d.setHours(21, 14, 0, 0);
      return { dateKey: dateKey(d), iso: d.toISOString(), lost, gained };
    });

    state = Object.assign(defaultState(), {
      stage: "app",
      tab: "today",
      profile,
      buddy: { config: genBuddyConfig("alright-chief-demo-buddy-04"), name: "Trevor" },
      entries,
    });
    save();
    render();
  }

  function resetPrototype() {
    localStorage.removeItem(STORAGE_KEY);
    state = defaultState();
    render();
  }

  /* ----------------------------------------------------------
     Wiring
     ---------------------------------------------------------- */

  function on(sel, fn) {
    const node = app.querySelector(sel);
    if (node) node.addEventListener("click", fn);
  }

  const seedBtn = document.getElementById("seed-demo");
  const resetBtn = document.getElementById("reset-proto");
  if (seedBtn) seedBtn.addEventListener("click", seedDemo);
  if (resetBtn) resetBtn.addEventListener("click", resetPrototype);

  // Language interface controls (Claude)
  const keyInput = document.getElementById("api-key-input");
  const saveKey = document.getElementById("save-key");
  const clearKey = document.getElementById("clear-key");
  if (saveKey) saveKey.addEventListener("click", () => {
    LLM.setKey(keyInput.value.trim());
    keyInput.value = "";
  });
  if (clearKey) clearKey.addEventListener("click", () => LLM.setKey(""));
  updateLLMStatus();

  // Avatar pipeline controls (Midjourney)
  const mjFeedback = document.getElementById("mj-feedback");
  const mjUrl = document.getElementById("mj-url");
  const copyMJ = document.getElementById("copy-mj");
  const applyMJ = document.getElementById("apply-mj");
  const clearMJ = document.getElementById("clear-mj");

  if (copyMJ) copyMJ.addEventListener("click", async () => {
    const prompt = midjourneyPrompt();
    try {
      await navigator.clipboard.writeText(prompt);
      if (mjFeedback) mjFeedback.textContent = "Prompt copied — built from this dad's own answers.";
    } catch (e) {
      if (mjFeedback) mjFeedback.textContent = prompt;
    }
  });
  if (applyMJ) applyMJ.addEventListener("click", () => {
    const url = mjUrl.value.trim();
    if (!url || !state.buddy) {
      if (mjFeedback) mjFeedback.textContent = state.buddy ? "Paste an image URL first." : "Finish onboarding first — the buddy doesn't exist yet.";
      return;
    }
    state.buddy.imageUrl = url;
    save();
    render();
    if (mjFeedback) mjFeedback.textContent = "Midjourney render is now the buddy.";
  });
  if (clearMJ) clearMJ.addEventListener("click", () => {
    if (!state.buddy) return;
    delete state.buddy.imageUrl;
    save();
    render();
    if (mjFeedback) mjFeedback.textContent = "Back to the reference-art chief.";
  });

  // Render mode toggle (reference sprites ↔ generative SVG)
  const toggleRender = document.getElementById("toggle-render");
  if (toggleRender) toggleRender.addEventListener("click", () => {
    if (!state.buddy) return;
    state.buddy.useSvg = !state.buddy.useSvg;
    toggleRender.textContent = state.buddy.useSvg ? "Use reference art" : "Use generative SVG";
    save();
    render();
  });

  // Progress & notifications
  const enableNotify = document.getElementById("enable-notify");
  const sendNudge = document.getElementById("send-nudge");
  if (enableNotify) enableNotify.addEventListener("click", async () => {
    const p = await Notify.request();
    if (p === "granted") {
      Notify.show("Alright Chief", "Notifications on. We'll only ever nudge — never nag.");
      // demo: a progress nudge a few seconds later so the behaviour is visible
      setTimeout(() => { sendProgressNudge(); }, 6000);
    }
  });
  if (sendNudge) sendNudge.addEventListener("click", async () => {
    if (Notify.permission() !== "granted") { await Notify.request(); }
    sendProgressNudge();
  });
  updateNotifyStatus();

  state = load();
  render();
})();
