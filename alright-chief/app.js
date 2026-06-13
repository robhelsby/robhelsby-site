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

  // Palette taken from the reference art: matte near-black body, thick black
  // outline, off-white eyes, purple mitten hands, dark chunky shoes.
  const INK = {
    body: "#231f29",
    bodyLo: "#191620",
    line: "#0c0a11",
    rim: "#4c4557",
    eye: "#f4efe6",
    pupil: "#1a1620",
    hand: "#8d63b8",
    handLo: "#6f4c95",
    handLine: "#4a3268",
    shoe: "#2a2633",
    sole: "#5b5566",
  };

  function genBuddyConfig(seedStr) {
    const rand = mulberry32(hashString(seedStr));
    return {
      chief: true,
      seed: seedStr,
      h: 0.9 + rand() * 0.22,        // body height
      w: 0.9 + rand() * 0.2,         // body width
      eye: 0.9 + rand() * 0.25,      // eye size
      eyeGap: 0.9 + rand() * 0.3,    // spacing
      legLen: 0.85 + rand() * 0.4,   // leg length
      hat: Math.floor(rand() * 4),   // bucket | beanie | flat cap | sun hat
      theme: Math.floor(rand() * THEMES.length),
    };
  }

  /* ---------- Activity props (drawn at the chief's side, origin = ground) ---------- */

  const PROPS = {
    vinyl: () => `
      <rect x="-22" y="-15" width="44" height="15" rx="2.5" fill="#3a3444" stroke="${INK.line}" stroke-width="3"/>
      <circle cx="-5" cy="-7.5" r="6.5" fill="#15121b" stroke="${INK.line}" stroke-width="2"/>
      <circle cx="-5" cy="-7.5" r="1.8" fill="#c9a04a"/>
      <path d="M 9 -11 l 6 4" stroke="#cfc8bb" stroke-width="2.2" stroke-linecap="round"/>`,
    controller: () => `
      <rect x="-18" y="-15" width="36" height="15" rx="7.5" fill="#3a3444" stroke="${INK.line}" stroke-width="3"/>
      <circle cx="8" cy="-9.5" r="2.4" fill="#c9a04a"/><circle cx="12" cy="-6" r="2.4" fill="#b05a3c"/>
      <path d="M -11 -7.5 h 7 M -7.5 -11 v 7" stroke="#9a93a6" stroke-width="2.4" stroke-linecap="round"/>`,
    fishing: () => `
      <ellipse cx="6" cy="0" rx="22" ry="4" fill="#5d7286" opacity="0.45"/>
      <path d="M -22 -4 L 16 -44" stroke="#8a6d4f" stroke-width="3.4" stroke-linecap="round"/>
      <path d="M 16 -44 q 7 22 -3 38" stroke="#cfc8bb" stroke-width="1.8" fill="none"/>
      <circle cx="13" cy="-8" r="2.6" fill="#b05a3c"/>`,
    coffee: () => `
      <rect x="-11" y="-17" width="22" height="17" rx="2.5" fill="#ece6da" stroke="${INK.line}" stroke-width="3"/>
      <path d="M 11 -13 q 9 3 0 8" stroke="${INK.line}" stroke-width="3" fill="none"/>
      <path d="M -4 -22 q 2.5 -4 0 -8" stroke="#9a9082" stroke-width="2.4" fill="none" stroke-linecap="round" class="chief-float f2"/>
      <path d="M 4 -22 q -2.5 -4 0 -8" stroke="#9a9082" stroke-width="2.4" fill="none" stroke-linecap="round" class="chief-float f3"/>`,
    pint: () => `
      <path d="M -9 -26 L -6 0 L 6 0 L 9 -26 Z" fill="#c9802f" stroke="${INK.line}" stroke-width="3" stroke-linejoin="round"/>
      <rect x="-10" y="-31" width="20" height="7" rx="3.5" fill="#f0ead9" stroke="${INK.line}" stroke-width="3"/>`,
    plant: () => `
      <rect x="-16" y="-12" width="32" height="12" rx="2" fill="#7e5a3c" stroke="${INK.line}" stroke-width="3"/>
      <path d="M -8 -12 q -3 -14 2 -18 M 0 -12 q 0 -16 0 -20 M 8 -12 q 3 -14 -2 -18" stroke="#6f7d44" stroke-width="3.2" fill="none" stroke-linecap="round"/>
      <circle cx="-6" cy="-30" r="3" fill="#b05a3c"/><circle cx="8" cy="-30" r="3" fill="#c9a04a"/>`,
    engine: () => `
      <rect x="-18" y="-18" width="36" height="18" rx="2.5" fill="#3a3444" stroke="${INK.line}" stroke-width="3"/>
      <circle cx="-6" cy="-9" r="5.5" fill="#5b5566" stroke="${INK.line}" stroke-width="2"/>
      <rect x="4" y="-15" width="9" height="11" rx="1.5" fill="#5b5566" stroke="${INK.line}" stroke-width="2"/>`,
    drone: () => `
      <g class="chief-float f1">
        <rect x="-9" y="-26" width="18" height="7" rx="2" fill="#3a3444" stroke="${INK.line}" stroke-width="2.5"/>
        <path d="M -9 -23 L -20 -28 M 9 -23 L 20 -28" stroke="${INK.line}" stroke-width="2.5" stroke-linecap="round"/>
        <ellipse cx="-20" cy="-28" rx="7" ry="2" fill="#9a93a6"/><ellipse cx="20" cy="-28" rx="7" ry="2" fill="#9a93a6"/>
      </g>`,
    telescope: () => `
      <path d="M -14 -2 L 14 -30" stroke="#3a3444" stroke-width="7" stroke-linecap="round"/>
      <circle cx="14" cy="-30" r="4" fill="#5d7286" stroke="${INK.line}" stroke-width="2"/>
      <path d="M -14 -2 L -20 0 M -14 -2 L -8 0" stroke="${INK.line}" stroke-width="3" stroke-linecap="round"/>
      <circle cx="20" cy="-36" r="1.6" fill="#c9a04a" class="chief-float f2"/>
      <circle cx="26" cy="-30" r="1.2" fill="#f4efe6" class="chief-float f3"/>`,
  };

  /* ---------- Activities the chief can learn from what the dad tells the app ----------
     Each maps to a reference-art sprite (assets/chief/<sprite>.png). The `prop` is the
     fallback drawn on the SVG chief when sprite art can't load. ---------- */

  const ACTIVITIES = [
    { id: "music", sprite: "music", prop: "vinyl", doing: "spinning some records", quip: "Filed exactly how you left them.",
      keywords: ["music", "gig", "gigs", "record", "records", "vinyl", "dj", "album", "albums", "spotify"] },
    { id: "guitar", sprite: "guitar", prop: "vinyl", doing: "having a play", quip: "Still knows your three chords.",
      keywords: ["guitar", "band", "play guitar", "strum", "bass"] },
    { id: "gaming", sprite: "gaming", prop: "controller", doing: "getting a few rounds in", quip: "Your save file's safe with him.",
      keywords: ["gaming", "video game", "video games", "playstation", "xbox", "console", "games", "fifa", "controller"] },
    { id: "fishing", sprite: "fishing", prop: "fishing", doing: "down at the water", quip: "Nothing's biting. He doesn't mind.",
      keywords: ["fishing", "fish", "angling", "carp"] },
    { id: "cycling", sprite: "cycling", prop: "fishing", doing: "out on the bike", quip: "Your long route. No punctures yet.",
      keywords: ["bike", "cycling", "cycle", "ride", "riding", "bicycle"] },
    { id: "football", sprite: "football", prop: "controller", doing: "having a kickabout", quip: "First touch needs work. So did yours.",
      keywords: ["football", "five-a-side", "five a side", "footy", "soccer", "match"] },
    { id: "basketball", sprite: "basketball", prop: "controller", doing: "shooting hoops", quip: "Still got the jump shot.",
      keywords: ["basketball", "hoops", "nba"] },
    { id: "golf", sprite: "golf", prop: "vinyl", doing: "on the back nine", quip: "Still playing off your handicap.",
      keywords: ["golf", "driving range", "tee off"] },
    { id: "tennis", sprite: "tennis", prop: "controller", doing: "having a knock", quip: "Backhand's coming along.",
      keywords: ["tennis", "racket", "padel", "squash"] },
    { id: "boxing", sprite: "boxing", prop: "controller", doing: "working the bag", quip: "Getting it all out. Good.",
      keywords: ["boxing", "box", "bag work", "sparring", "gym", "weights", "workout", "training", "fitness"] },
    { id: "running", sprite: "skateboarding", prop: "controller", doing: "out moving", quip: "Your pace. Showing off.",
      keywords: ["running", "run", "parkrun", "jog", "skate", "skateboard", "skateboarding"] },
    { id: "cooking", sprite: "cooking", prop: "vinyl", doing: "doing something on the BBQ", quip: "Low and slow. Nobody grabbing his leg.",
      keywords: ["cooking", "cook", "baking", "kitchen", "bbq", "barbecue", "grill"] },
    { id: "brewing", sprite: "brewing", prop: "pint", doing: "tending the home-brew", quip: "A batch on. Nearly ready.",
      keywords: ["pub", "pint", "beer", "brewery", "brewing", "ale", "homebrew", "home brew", "lads"] },
    { id: "reading", sprite: "reading", prop: "vinyl", doing: "feet up with a book", quip: "Past the bit where you fell asleep.",
      keywords: ["reading", "read a book", "book", "books", "novel", "relax"] },
    { id: "photography", sprite: "photography", prop: "vinyl", doing: "out with the camera", quip: "Got the light just right.",
      keywords: ["photography", "photo", "photos", "camera", "shooting"] },
    { id: "gardening", sprite: "gardening", prop: "plant", doing: "out in the garden", quip: "Tomatoes coming along. Yours.",
      keywords: ["garden", "gardening", "allotment", "plants", "growing", "veg", "vegetables"] },
    { id: "woodwork", sprite: "woodwork", prop: "engine", doing: "at the workbench", quip: "Measured twice. Obviously.",
      keywords: ["woodwork", "carpentry", "diy", "whittling", "building", "joinery", "shed"] },
    { id: "drawing", sprite: "drawing", prop: "vinyl", doing: "sketching something", quip: "Your old sketchbook habit, alive and well.",
      keywords: ["drawing", "draw", "sketch", "illustration", "art", "painting", "paint"] },
    { id: "motorbikes", sprite: "motorbikes", prop: "engine", doing: "out on the bike", quip: "Helmet on, head clear.",
      keywords: ["motorbike", "motorcycle", "biking"] },
    { id: "car", sprite: "car", prop: "engine", doing: "under the bonnet", quip: "He'll have it running by the weekend.",
      keywords: ["car", "cars", "mechanic", "engine", "garage", "tinkering", "restoring"] },
    { id: "hiking", sprite: "hiking", prop: "plant", doing: "up a hill somewhere", quip: "Took the long way. On purpose.",
      keywords: ["hiking", "hike", "walking", "walks", "hills", "trail", "outdoors", "mountains"] },
    { id: "camping", sprite: "camping", prop: "plant", doing: "set up camp", quip: "Fire's going. Phone's off.",
      keywords: ["camping", "camp", "tent", "wild camping"] },
    { id: "surfing", sprite: "surfing", prop: "fishing", doing: "out in the surf", quip: "Caught a few. Salt in everything.",
      keywords: ["surf", "surfing", "waves", "bodyboard"] },
    { id: "podcasting", sprite: "podcasting", prop: "controller", doing: "recording something", quip: "Mic on. Opinions ready.",
      keywords: ["podcast", "podcasting", "recording"] },
    { id: "writing", sprite: "writing", prop: "vinyl", doing: "journaling", quip: "Getting it down on paper. Like this, really.",
      keywords: ["writing", "write", "journal", "journaling", "diary", "blog"] },
    { id: "travel", sprite: "travel", prop: "plant", doing: "planning a trip", quip: "Map out, somewhere new circled.",
      keywords: ["travel", "trip", "holiday", "adventure", "explore"] },
    { id: "dancing", sprite: "dancing", prop: "vinyl", doing: "having a dance", quip: "No one watching. The best kind.",
      keywords: ["dancing", "dance"] },
    { id: "language", sprite: "language", prop: "vinyl", doing: "learning a language", quip: "Three words in. Committed.",
      keywords: ["language", "languages", "learning", "duolingo", "spanish", "french"] },
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

  /* ---------- Drawing the chief — faithful to the reference, fully animated ----------
     A single vector character: matte-black bean body with a thick outline, big white
     oval eyes, purple mitten hands, chunky shoes, hatted. He breathes and blinks on
     idle; expression and arm pose change with mood and activity; he squishes when
     poked, spins on double-tap, and dangles when picked up by the scruff. ---------- */

  // A scene resolves to an expression + arm pose + optional prop + accents.
  function resolveScene(scene) {
    const s = scene || { pose: "attentive" };
    switch (s.pose) {
      case "activity":
        return { expr: "open", arms: "toProp", prop: s.activity && s.activity.prop, accent: null };
      case "sleep":    return { expr: "sleeping", arms: "rest", accent: "zzz" };
      case "walking":  return { expr: "open", arms: "swing", accent: null, walk: true };
      case "whistle":  return { expr: "whistle", arms: "sides", accent: "notes" };
      case "excited":  return { expr: "excited", arms: "up", accent: "sparkle" };
      case "joy":      return { expr: "joy", arms: "up", accent: "sparkle" };
      case "attentive":return { expr: "wide", arms: "sides", accent: s.snapLine ? "snap" : null };
      case "bored":    return moodScene(currentMood());
      default:
        // a direct mood name
        if (MOODS[s.pose]) return moodScene(s.pose);
        return { expr: "open", arms: "sides", accent: null };
    }
  }

  // expression + arms + accent for each mood name
  const MOODS = {
    despair:   { expr: "shut",     arms: "onHead", accent: "rain" },
    lonely:    { expr: "sad",      arms: "sides",  accent: null, small: true },
    sad:       { expr: "sad",      arms: "sides",  accent: null },
    slumped:   { expr: "halflid",  arms: "sides",  accent: null, slump: true },
    bored:     { expr: "halflid",  arms: "crossed",accent: null },
    content:   { expr: "open",     arms: "crossed",accent: null },
    fulfilled: { expr: "soft",     arms: "crossed",accent: "sparkle" },
    connected: { expr: "soft",     arms: "heart",  accent: "hearts" },
    joy:       { expr: "joy",      arms: "up",     accent: "sparkle" },
    inlove:    { expr: "heart",    arms: "heart",  accent: "hearts" },
  };
  const moodScene = (name) => Object.assign({ name }, MOODS[name] || MOODS.content);

  function chiefSVG(config, scene, { small = false, reveal = false } = {}) {
    const t = THEMES[config.theme % THEMES.length];
    const r = resolveScene(scene);
    const shrink = r.small ? 0.7 : 1;

    // geometry
    const bx = 100, by = 124;
    const rx = 40 * config.w * shrink;
    const ry = 50 * config.h * shrink;
    const top = by - ry, bottom = by + ry;
    const legLen = 13 * config.legLen;
    const footY = bottom + legLen;
    const groundY = footY + 7;
    const o = `stroke="${INK.line}" stroke-width="3" stroke-linejoin="round"`;
    const uid = "c" + (hashString(config.seed) % 99999);

    /* legs + chunky shoes */
    const legDX = rx * 0.4;
    const stride = r.walk ? 5 : 0;
    const legs = [-1, 1].map((sgn, i) => {
      const lx = bx + sgn * legDX;
      const dy = r.walk ? (i === 0 ? -3 : 0) : 0;
      return `
        <path d="M ${lx} ${bottom - 8} V ${footY - 4 + dy}" stroke="${INK.body}" stroke-width="9" stroke-linecap="round"/>
        <path d="M ${lx - 11 + sgn * stride} ${footY + dy} h 21 a 6 6 0 0 1 6 6 h -27 Z"
              fill="${INK.shoe}" ${o}/>
        <path d="M ${lx - 11 + sgn * stride} ${footY + 6 + dy} h 27" stroke="${INK.sole}" stroke-width="2.5"/>`;
    }).join("");

    /* arms + mitten hands */
    const mitten = (mx, my, sc = 1) => `
      <g class="chief-mitt">
        <ellipse cx="${mx}" cy="${my}" rx="${(10 * sc).toFixed(1)}" ry="${(11 * sc).toFixed(1)}" fill="${INK.hand}" stroke="${INK.handLine}" stroke-width="2.6"/>
        <path d="M ${mx} ${my} a ${10 * sc} ${11 * sc} 0 0 0 0 ${11 * sc}" fill="${INK.handLo}" opacity="0.5"/>
        <circle cx="${(mx - 8 * sc).toFixed(1)}" cy="${(my + 2).toFixed(1)}" r="${(4 * sc).toFixed(1)}" fill="${INK.hand}" stroke="${INK.handLine}" stroke-width="2.2"/>
      </g>`;
    const arm = (x1, y1, x2, y2) => `<path d="M ${x1} ${y1} Q ${(x1 + x2) / 2} ${(y1 + y2) / 2 + 4} ${x2} ${y2}" stroke="${INK.body}" stroke-width="8" stroke-linecap="round" fill="none"/>`;
    const sh = (sgn) => [bx + sgn * rx * 0.66, by - ry * 0.08]; // shoulder

    function arms() {
      const L = sh(-1), R = sh(1);
      switch (r.arms) {
        case "crossed":
          return arm(...L, bx + 9, by + ry * 0.30) + arm(...R, bx - 9, by + ry * 0.24)
            + mitten(bx + 11, by + ry * 0.30) + mitten(bx - 11, by + ry * 0.24);
        case "up":
          return arm(...L, bx - rx * 0.74, by - ry * 0.62) + arm(...R, bx + rx * 0.74, by - ry * 0.62)
            + mitten(bx - rx * 0.74, by - ry * 0.66) + mitten(bx + rx * 0.74, by - ry * 0.66);
        case "onHead":
          return arm(...L, bx - rx * 0.5, top + 6) + arm(...R, bx + rx * 0.5, top + 6)
            + mitten(bx - rx * 0.5, top + 4) + mitten(bx + rx * 0.5, top + 4);
        case "heart":
          return arm(...L, bx - 7, by - ry * 0.04) + arm(...R, bx + 7, by - ry * 0.04)
            + mitten(bx - 7, by - ry * 0.04, 0.95) + mitten(bx + 7, by - ry * 0.04, 0.95);
        case "toProp":
          return arm(...L, bx - rx - 3, by + ry * 0.22) + arm(...R, bx + rx + 6, by - ry * 0.02)
            + mitten(bx - rx - 3, by + ry * 0.22) + mitten(bx + rx + 7, by - ry * 0.02);
        case "swing":
          return arm(...L, bx - rx - 3, by + ry * 0.02) + arm(...R, bx + rx + 2, by + ry * 0.34)
            + mitten(bx - rx - 4, by + ry * 0.02) + mitten(bx + rx + 3, by + ry * 0.34);
        case "rest":
          return mitten(bx - rx * 0.55, by + ry * 0.46, 0.9) + mitten(bx + rx * 0.55, by + ry * 0.46, 0.9);
        default: /* sides */
          return arm(...L, bx - rx - 2, by + ry * 0.2) + arm(...R, bx + rx + 2, by + ry * 0.2)
            + mitten(bx - rx - 3, by + ry * 0.2) + mitten(bx + rx + 3, by + ry * 0.2);
      }
    }

    /* body */
    const body = `
      <defs>
        <linearGradient id="${uid}-b" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${INK.body}"/><stop offset="100%" stop-color="${INK.bodyLo}"/>
        </linearGradient>
      </defs>
      <ellipse cx="${bx}" cy="${by}" rx="${rx.toFixed(1)}" ry="${ry.toFixed(1)}" fill="url(#${uid}-b)" ${o}/>
      <path d="M ${bx - rx * 0.55} ${by - ry * 0.6} Q ${bx - rx * 0.9} ${by - ry * 0.1} ${bx - rx * 0.62} ${by + ry * 0.4}"
            fill="none" stroke="${INK.rim}" stroke-width="2.6" stroke-linecap="round" opacity="0.6"/>`;

    /* eyes / expression */
    const ey = by - ry * 0.26;
    const edx = rx * 0.4 * config.eyeGap;
    const erx = 9 * config.eye, ery = 12.5 * config.eye;
    const pupilOff = r.expr === "sad" ? ery * 0.42 : 0;
    let face = "";
    const openEye = (sgn, lid = 0) => {
      const x = bx + sgn * edx;
      return `<g class="chief-eye">
        <ellipse cx="${x}" cy="${ey}" rx="${erx.toFixed(1)}" ry="${ery.toFixed(1)}" fill="${INK.eye}"/>
        <circle cx="${(x + sgn * 1).toFixed(1)}" cy="${(ey + pupilOff).toFixed(1)}" r="${(erx * 0.5).toFixed(1)}" fill="${INK.pupil}"/>
        <circle cx="${(x + sgn * 1 + 2).toFixed(1)}" cy="${(ey + pupilOff - 2).toFixed(1)}" r="1.6" fill="#fff"/>
        ${lid ? `<path d="M ${x - erx - 1} ${ey - ery - 1} h ${erx * 2 + 2} v ${lid} h ${-(erx * 2 + 2)} Z" fill="${INK.body}"/>` : ""}
      </g>`;
    };
    const arcEye = (sgn, up) => {
      const x = bx + sgn * edx;
      return up
        ? `<path d="M ${x - erx} ${ey + 2} Q ${x} ${ey - ery} ${x + erx} ${ey + 2}" stroke="${INK.pupil}" stroke-width="3.4" fill="none" stroke-linecap="round"/>`
        : `<path d="M ${x - erx} ${ey - 2} Q ${x} ${ey + ery * 0.7} ${x + erx} ${ey - 2}" stroke="${INK.pupil}" stroke-width="3" fill="none" stroke-linecap="round"/>`;
    };
    const heartEye = (sgn) => {
      const x = bx + sgn * edx;
      return `<g class="chief-eye"><ellipse cx="${x}" cy="${ey}" rx="${erx}" ry="${ery}" fill="${INK.eye}"/>
        <path d="M ${x} ${ey + 4} l -4 -5 a 2.6 2.6 0 0 1 4 -2 a 2.6 2.6 0 0 1 4 2 Z" fill="#c4476a"/></g>`;
    };
    const sadEye = (sgn) => {
      const x = bx + sgn * edx;
      return `<g class="chief-eye"><ellipse cx="${x}" cy="${ey}" rx="${erx}" ry="${ery}" fill="${INK.eye}"/>
        <circle cx="${x}" cy="${ey + ery * 0.42}" r="${(erx * 0.5).toFixed(1)}" fill="${INK.pupil}"/>
        <path d="M ${x - erx - 1} ${ey - ery * 0.7} q ${erx} ${-ery * 0.5} ${erx * 2} ${ery * 0.2}" stroke="${INK.body}" stroke-width="4" fill="none" stroke-linecap="round"/></g>`;
    };

    switch (r.expr) {
      case "sleeping": face = [-1, 1].map((s) => { const x = bx + s * edx; return `<path d="M ${x - erx} ${ey} q ${erx} ${ery * 0.6} ${erx * 2} 0" stroke="${INK.eye}" stroke-width="3" fill="none" stroke-linecap="round"/>`; }).join(""); break;
      case "shut":   face = [-1, 1].map((s) => arcEye(s, false)).join(""); break;
      case "joy":    face = [-1, 1].map((s) => arcEye(s, true)).join(""); break;
      case "halflid":face = [-1, 1].map((s) => openEye(s, ery * 0.95)).join(""); break;
      case "soft":   face = [-1, 1].map((s) => openEye(s, ery * 0.45)).join(""); break;
      case "sad":    face = [-1, 1].map((s) => sadEye(s)).join(""); break;
      case "heart":  face = [-1, 1].map((s) => heartEye(s)).join(""); break;
      case "wide":   face = [-1, 1].map((s) => openEye(s, 0)).join("") + `<ellipse cx="${bx}" cy="${ey + ery + 7}" rx="3.4" ry="4.4" fill="${INK.pupil}"/>`; break;
      case "whistle":face = [-1, 1].map((s) => openEye(s, 0)).join("") + `<circle cx="${bx + edx * 0.5}" cy="${ey + ery + 8}" r="3.2" fill="none" stroke="${INK.pupil}" stroke-width="2.4"/>`; break;
      case "excited":face = [-1, 1].map((s) => openEye(s, 0)).join(""); break;
      default:       face = [-1, 1].map((s) => openEye(s, 0)).join(""); // open
    }

    /* hat */
    const hy = top + 8;
    let hat = "";
    switch (config.hat % 4) {
      case 0: hat = `
        <path d="M ${bx - 22} ${hy} L ${bx - 16} ${hy - 20} Q ${bx} ${hy - 27} ${bx + 16} ${hy - 20} L ${bx + 22} ${hy} Z" fill="${t.hat}" ${o}/>
        <path d="M ${bx - 17} ${hy - 7} h 34" stroke="${t.band}" stroke-width="4.5"/>
        <ellipse cx="${bx}" cy="${hy}" rx="30" ry="7" fill="${t.hat}" ${o}/>`; break;
      case 1: hat = `
        <circle cx="${bx}" cy="${hy - 24}" r="5" fill="${t.band}" ${o}/>
        <path d="M ${bx - 24} ${hy} Q ${bx} ${hy - 44} ${bx + 24} ${hy} Z" fill="${t.hat}" ${o}/>
        <rect x="${bx - 25}" y="${hy - 6}" width="50" height="10" rx="5" fill="${t.band}" ${o}/>`; break;
      case 2: hat = `
        <path d="M ${bx - 23} ${hy} Q ${bx - 19} ${hy - 19} ${bx + 2} ${hy - 18} Q ${bx + 21} ${hy - 17} ${bx + 23} ${hy} Z" fill="${t.hat}" ${o}/>
        <path d="M ${bx + 10} ${hy} q 15 -3 22 1 q -9 5 -22 2 Z" fill="${t.band}" ${o}/>`; break;
      default: hat = `
        <path d="M ${bx - 18} ${hy - 3} L ${bx - 14} ${hy - 19} Q ${bx} ${hy - 24} ${bx + 14} ${hy - 19} L ${bx + 18} ${hy - 3} Z" fill="${t.hat}" ${o}/>
        <path d="M ${bx - 15} ${hy - 8} h 30" stroke="${t.band}" stroke-width="5"/>
        <ellipse cx="${bx}" cy="${hy - 2}" rx="37" ry="8" fill="${t.hat}" ${o}/>`;
    }

    /* accents */
    let accent = "";
    const A = r.accent;
    if (A === "zzz") accent = `
      <text x="${bx + rx * 0.7}" y="${top - 2}" font-size="14" fill="#9a9082" class="chief-float f1">z</text>
      <text x="${bx + rx * 0.95}" y="${top - 12}" font-size="18" fill="#9a9082" class="chief-float f2">z</text>
      <text x="${bx + rx * 1.25}" y="${top - 24}" font-size="23" fill="#9a9082" class="chief-float f3">Z</text>`;
    else if (A === "notes") accent = `
      <text x="${bx + rx * 0.8}" y="${ey - 6}" font-size="17" fill="${t.accent}" class="chief-float f1">&#9834;</text>
      <text x="${bx + rx * 1.1}" y="${ey - 20}" font-size="14" fill="${t.accent}" class="chief-float f3">&#9835;</text>`;
    else if (A === "hearts") accent = [0, 1, 2].map((i) => `
      <path d="M ${bx + (i - 1) * 26} ${top - 4 - i * 6} l -5 -6 a 3.2 3.2 0 0 1 5 -2.4 a 3.2 3.2 0 0 1 5 2.4 Z" fill="#c4476a" class="chief-float f${i + 1}"/>`).join("");
    else if (A === "sparkle") accent = [[-rx, -ry * 0.4], [rx, -ry * 0.2], [rx * 0.3, -ry - 6]].map(([dx, dy], i) => `
      <path d="M ${bx + dx} ${by + dy - 4} l 1.6 4 4 1.6 -4 1.6 -1.6 4 -1.6 -4 -4 -1.6 4 -1.6 Z" fill="${t.accent}" class="chief-float f${i + 1}"/>`).join("");
    else if (A === "rain") accent = [[-rx * 0.5, 0], [0, ry * 0.1], [rx * 0.5, 0]].map(([dx, dy], i) => `
      <path d="M ${bx + dx} ${top - 8 + dy} q 3 6 0 9 q -3 -3 0 -9" fill="#5d7286" opacity="0.7" class="chief-float f${i + 1}"/>`).join("");
    else if (A === "snap") accent = `<text x="${bx + rx * 0.85}" y="${top - 6}" font-size="26" font-weight="700" fill="${t.accent}" class="chief-snap">!</text>`;

    /* prop (activity), to his side, on the ground */
    const prop = r.prop && PROPS[r.prop]
      ? `<g transform="translate(${bx + rx + 34} ${groundY - 2}) scale(1.15)">${PROPS[r.prop]()}</g>`
      : "";

    const idleCls = r.expr === "sleeping" ? "chief-breathe" : "chief-idle";

    return `
      <svg class="buddy-svg ${small ? "buddy-svg--small" : ""} ${reveal ? "buddy-svg--reveal" : ""}"
           viewBox="0 0 200 230" role="img" aria-label="Your chief" data-buddy>
        <ellipse cx="${bx}" cy="${groundY + 3}" rx="${rx * 1.2}" ry="6.5" fill="#000" opacity="0.3" class="chief-shadow"/>
        ${prop}
        <g class="${idleCls}">
          ${legs}
          ${body}
          ${face}
          ${hat}
          ${arms()}
          ${accent}
        </g>
      </svg>`;
  }

  /* ---------- Render layer & honest mood ----------
     Primary renderer is the reference-art sprite set (the chief you designed),
     made interactive: it breathes on idle, squishes when poked, spins on
     double-tap, dangles when picked up, and swaps pose for mood/activity. The
     animated generative SVG is the fallback (and an optional mode via the side
     panel). A plugged-in render (Midjourney etc.) always wins. ---------- */

  const SPRITE_BASE = "assets/chief/";
  // The shipped sprite set (from the reference sheets).
  const SPRITE_NAMES = [
    "sleeping","bored","walking","despair","sad","excited","lonely","inlove",
    "fishing","hiking","camping","motorbikes","car","football","basketball","surfing",
    "skateboarding","boxing","photography","cooking","reading","vinyl","brewing","offroad",
    "golf","tennis","painting","writing","podcasting","dancing","language","travel",
    "music","cycling","gaming","relaxing","drawing","guitar","woodwork","gardening",
  ];
  // Moods the art can show, low → high. Honest: it leans low when the lost side is heavy.
  const MOOD_SET = ["despair", "sad", "lonely", "bored", "excited", "inlove"];

  // The chief's current expression reflects honest recent weather — it can sit low
  // when the lost column is heavy, and is NOT a one-way "settled" score.
  function currentMood() {
    const w = balanceWeights();
    if (w.entries === 0) return "bored";
    const t = w.tilt; // -1 (lost-heavy) .. +1 (gained-heavy)
    if (t <= -0.5) return "despair";
    if (t <= -0.25) return "sad";
    if (t < 0.25) return "bored";
    if (t < 0.55) return "excited";
    return w.connection ? "inlove" : "excited";
  }

  function spriteFor(scene) {
    const s = scene || {};
    switch (s.pose) {
      case "activity": return s.activity && s.activity.sprite;
      case "sleep": return "sleeping";
      case "walking": return "walking";
      case "whistle": return "bored";
      case "excited": return "excited";
      case "joy": return "excited";
      case "attentive": return "bored";
      case "bored": return currentMood();
      default: return SPRITE_NAMES.includes(s.pose) ? s.pose : currentMood();
    }
  }

  function buddyVisual(opts = {}, scene) {
    const b = state.buddy;
    if (!b) return "";
    const cls = `buddy-svg ${opts.small ? "buddy-svg--small" : ""} ${opts.reveal ? "buddy-svg--reveal" : ""}`;
    if (b.imageUrl) {
      return `<img class="${cls}" src="${esc(b.imageUrl)}" alt="Your chief" data-buddy draggable="false" />`;
    }
    if (b.useSprite === true) {        // reference photo art is opt-in; the drawn chief is default
      let name = spriteFor(scene);
      if (!SPRITE_NAMES.includes(name)) name = "bored";
      return `<img class="${cls} chief-sprite" src="${SPRITE_BASE}${name}.png" alt="Your chief — ${name}" data-buddy draggable="false"
                   onerror="this.onerror=null;this.outerHTML=window.__chiefSvgFallback ? window.__chiefSvgFallback() : ''" />`;
    }
    return chiefSVG(b.config, scene, opts);
  }

  // Exposed so a failed sprite load swaps in the animated SVG chief.
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

  // In-app, mobile-reachable way to connect Claude (the side panel is desktop-only).
  function openConnectSheet() {
    if (document.getElementById("connect-sheet")) return;
    const on = LLM.enabled();
    const wrap = document.createElement("div");
    wrap.id = "connect-sheet";
    wrap.className = "connect-sheet";
    wrap.innerHTML = `
      <div class="connect-card" role="dialog" aria-label="Connect Claude">
        <h3>Connect Claude</h3>
        <p>Paste your Anthropic API key. It's stored only in this browser and sent straight to Claude — it powers the voice, the welcome lines, and weighing each entry by how much it genuinely means.</p>
        <input type="password" id="cs-key" placeholder="sk-ant-…" autocomplete="off" autocapitalize="off" spellcheck="false" />
        <p class="micro" id="cs-status">${on ? "Claude is connected." : ""}</p>
        <button class="btn btn--primary" data-cs="save" type="button">${on ? "Update key" : "Connect"}</button>
        ${on ? `<button class="btn btn--ghost" data-cs="clear" type="button">Disconnect</button>` : ""}
        <button class="btn btn--quiet" data-cs="cancel" type="button">Close</button>
        <p class="micro">Get a key at console.anthropic.com. For this prototype the key lives only on your device; a production app would route calls through a backend so no key ever ships to the client.</p>
      </div>`;
    document.body.appendChild(wrap);
    const close = () => wrap.remove();
    const keyEl = wrap.querySelector("#cs-key");
    const statusEl = wrap.querySelector("#cs-status");
    wrap.addEventListener("click", (e) => { if (e.target === wrap) close(); });
    wrap.querySelector("[data-cs=cancel]").addEventListener("click", close);
    const clr = wrap.querySelector("[data-cs=clear]");
    if (clr) clr.addEventListener("click", () => { LLM.setKey(""); close(); render(); });
    wrap.querySelector("[data-cs=save]").addEventListener("click", () => {
      const v = keyEl.value.trim();
      if (!v) { statusEl.textContent = "Paste a key first."; return; }
      if (!/^sk-ant-/.test(v)) { statusEl.textContent = "That doesn't look like an Anthropic key (sk-ant-…). Connecting anyway."; }
      LLM.setKey(v);
      close();
      render();
    });
    keyEl.focus();
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

  const clamp01 = (v) => Math.max(0, Math.min(1, typeof v === "number" ? v : 0));

  // Let Claude judge how MEANINGFUL each side of each entry genuinely is, and store the
  // weights on the entry (e.lw / e.gw). The Balance then reflects significance, not
  // keyword counts or length. Runs once per entry; scripted heuristic until then.
  let weighInFlight = false;
  function maybeWeighEntries() {
    if (!LLM.enabled() || weighInFlight) return;
    const todo = state.entries.filter((e) => typeof e.lw !== "number").slice(-10);
    if (!todo.length) return;
    weighInFlight = true;
    const list = todo.map((e, i) => `${i + 1}. lost: "${(e.lost || "").replace(/"/g, "'")}" | gained: "${(e.gained || "").replace(/"/g, "'")}"`).join("\n");
    LLM.ask(
      `You weigh a new dad's daily ledger. For each entry, judge how emotionally MEANINGFUL the lost item and the gained item genuinely are to his sense of self, his family, and his transition into fatherhood. Judge depth and significance — NOT length, and NOT whether it sounds positive. A profound loss can far outweigh a trivial gain, and a small gain can outweigh a minor gripe. Score the lost item 0.0–1.0 and the gained item 0.0–1.0, independently.
Return ONLY a JSON array, one object per entry in order: [{"lost":0.0,"gained":0.0}, ...]

${list}`,
      500
    ).then((txt) => {
      weighInFlight = false;
      let arr;
      try { arr = JSON.parse((txt.match(/\[[\s\S]*\]/) || [])[0]); } catch (e) { return; }
      if (!Array.isArray(arr)) return;
      todo.forEach((e, i) => {
        if (arr[i] && typeof arr[i] === "object") { e.lw = clamp01(arr[i].lost); e.gw = clamp01(arr[i].gained); }
      });
      save();
      render();
    }).catch(() => { weighInFlight = false; });
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
        const t = balanceWeights().tilt;
        if (t <= -0.3) return `${name}'s a bit flat today — your lost column's been heavy lately. That's honest, not a failing.`;
        if (t >= 0.4) return `${name} looks lighter today. So do your last few gained entries.`;
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

  // Heuristic significance of one side of an entry (0..1), used until the LLM has
  // judged it. Deliberately NOT biased toward either column.
  function heuristicIntensity(text, themes) {
    if (!text || !text.trim()) return 0;
    const hits = tagThemes(text, themes).length;
    return Math.min(1, 0.42 + 0.2 * hits + Math.min(0.34, text.trim().length / 170));
  }

  // How much each side of an entry actually weighs. When Claude is connected it judges
  // the genuine MEANING of the lost and gained items (e.lw / e.gw, 0..1 each); otherwise
  // the heuristic stands in. A profound loss can outweigh a small gain, and vice versa.
  function entryWeight(e) {
    return {
      lost: typeof e.lw === "number" ? e.lw : heuristicIntensity(e.lost, LOST_THEMES),
      gained: typeof e.gw === "number" ? e.gw : heuristicIntensity(e.gained, GAINED_THEMES),
      judged: typeof e.lw === "number",
    };
  }

  // The Balance, measured honestly: lost and gained are weighed the SAME way and by how
  // much each entry genuinely means (LLM-judged when available). `tilt` is symmetric:
  // negative = the lost side is heavier lately (entirely valid), positive = the gained
  // side is. It is weather, not a score, and moves both ways.
  function balanceWeights() {
    const es = state.entries;
    if (!es.length) return { lost: 0, gained: 0, tilt: 0, entries: 0, connection: false, judged: false };
    const K = Math.min(es.length, 10);
    const recent = es.slice(-K);
    let lost = 0, gained = 0, conn = 0, judged = false;
    for (const e of recent) {
      const w = entryWeight(e);
      lost += w.lost;
      gained += w.gained;
      if (w.judged) judged = true;
      if (tagThemes(e.gained, GAINED_THEMES).some((id) => id === "connection" || id === "partnership")) conn++;
    }
    const L = Math.min(1, lost / recent.length), G = Math.min(1, gained / recent.length);
    return { lost: L, gained: G, tilt: Math.max(-1, Math.min(1, G - L)), entries: es.length, connection: conn >= Math.max(2, K * 0.4), judged };
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
    return { weeks, declined, risen, tilt: balanceWeights().tilt, entries: n };
  }

  // The welcome-back line. Honest by design: it reflects how a theme has CHANGED over
  // time (which is real), and is just as willing to say "this is still hard" as
  // "this has eased". It never frames a heavy lost column as failing.
  function progressGreeting() {
    const r = progressReport();
    if (!r) return null;
    const d = r.declined, g = r.risen;
    // a specific lost theme genuinely eased — name the change, don't oversell it
    if (d && d.drop > 0 && d.example) {
      const recentBit = d.recent === 0 ? "the last few weeks, not once" : "lately, less often";
      const gainBit = g && g.example ? ` The gained side's been saying other things — “${g.example}”.` : "";
      return `${r.weeks} weeks ago, ${d.theme.label} was in your lost column most weeks — “${d.example}”. ${capitalise(recentBit)}. Not gone. Quieter.${gainBit}`;
    }
    // a lost theme is STILL recurring — say so honestly, no false progress
    if (d && d.recent >= 2 && d.example) {
      return `${capitalise(d.theme.label)} is still in your lost column most weeks — “${d.example}”. That's allowed. You're not behind, you're in it.`;
    }
    if (g && g.example && g.recent > 0) {
      return `The gained column's started saying things it couldn't at the start — “${g.example}”. Both columns still run. That's the point.`;
    }
    return null;
  }

  // Honest one-line read of where the Balance sits this stretch — leans either way.
  function balanceRead(w) {
    const t = w.tilt;
    if (w.entries === 0) return "Nothing weighed yet. Put a day down and the Balance starts to show.";
    if (t <= -0.45) return "Heavy on the lost side this stretch. Some weeks just are — nothing here needs fixing.";
    if (t <= -0.18) return "Leaning lost lately. That's honest. Keep putting it down.";
    if (t < 0.18) return "Pretty even right now. Both true at once.";
    if (t < 0.5) return "The gained side's carrying a bit more this stretch.";
    return "Gained's overflowing lately. Enjoy it — it won't always, and that's fine too.";
  }

  const capitalise = (s) => s ? s[0].toUpperCase() + s.slice(1) : s;

  // Short nudges for notifications, drawn from the same signal.
  function progressNudges() {
    const r = progressReport();
    const name = state.buddy?.name || "your chief";
    const out = [];
    if (r && r.declined && r.declined.drop > 0) {
      out.push(`${capitalise(r.declined.theme.label)} has come up less lately. Worth a look at where you started.`);
    } else if (r && r.declined && r.declined.recent >= 2) {
      out.push(`${capitalise(r.declined.theme.label)}'s still heavy this week. It's allowed to be. Put today down anyway.`);
    }
    if (r && r.risen && r.risen.example) {
      out.push(`The gained column said something new — “${r.risen.example}”. Both columns still run.`);
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
      const mood = state.buddy && state.buddy.useSprite ? SPRITE_BASE + currentMood() + ".png" : undefined;
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
        <button class="appbar__connect ${LLM.enabled() ? "is-on" : ""}" data-act="connect" type="button">${LLM.enabled() ? "Claude ✓" : "Connect Claude"}</button>
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

    const welcomeCard = welcome ? `
      <div class="card card--accent">
        <p class="card__kicker">Welcome back, chief</p>
        <p class="card__body" id="welcome-line">${esc(welcome)}</p>
        <p class="micro">Not a score. A mirror — both columns still run, and that's the point.</p>
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
    maybeWeighEntries();
    app.querySelectorAll("[data-act=connect]").forEach((b) => b.addEventListener("click", openConnectSheet));
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

    // Honest weigh: two sides, each filling to its real recent weight. Lost is allowed
    // to be the heavier side — nothing here trends "up". Not a score; a mirror.
    const w = balanceWeights();
    const lostH = Math.round(8 + w.lost * 92);
    const gainH = Math.round(8 + w.gained * 92);
    const lean = w.tilt < -0.1 ? "leans lost" : w.tilt > 0.1 ? "leans gained" : "fairly even";

    return `
      <div class="screen" style="padding-top:10px">
        <h2 class="home-greeting">The Balance</h2>
        <p class="micro" style="margin-top:2px">Never perfectly balanced. That would be dishonest.</p>
        <div class="weigh" aria-label="This stretch ${lean}">
          <div class="weigh__col">
            <div class="weigh__track"><div class="weigh__fill weigh__fill--lost" style="height:${lostH}%"></div></div>
            <span class="weigh__tag checkin-side--lost">Lost</span>
          </div>
          <div class="weigh__fulcrum"></div>
          <div class="weigh__col">
            <div class="weigh__track"><div class="weigh__fill weigh__fill--gained" style="height:${gainH}%"></div></div>
            <span class="weigh__tag checkin-side--gained">Gained</span>
          </div>
        </div>
        <p class="balance-read">${esc(balanceRead(w))}</p>
        <p class="micro" style="text-align:center">${w.judged ? "Weighed by how much each entry actually means — not by which column it's in." : LLM.enabled() ? "Weighing each entry by meaning…" : `<button class="linklike" data-act="connect" type="button">Connect Claude</button> to weigh each entry by how much it genuinely means.`}</p>
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
      // drop the class once the squish finishes so idle breathing resumes
      svg.addEventListener("animationend", () => svg.classList.remove("is-poked"), { once: true });
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

  // Render mode toggle (reference art ↔ generative SVG). Reference art is the default.
  const toggleRender = document.getElementById("toggle-render");
  if (toggleRender) {
    const syncLabel = () => {
      const spriteMode = state && state.buddy && state.buddy.useSprite === true;
      toggleRender.textContent = spriteMode ? "Use the drawn chief" : "Use reference photo art";
    };
    toggleRender.addEventListener("click", () => {
      if (!state.buddy) return;
      state.buddy.useSprite = state.buddy.useSprite === true ? false : true;
      save();
      render();
      syncLabel();
    });
    syncLabel();
  }

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
