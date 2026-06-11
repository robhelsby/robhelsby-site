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

  let state = load();

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return Object.assign(defaultState(), JSON.parse(raw));
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

  const PALETTES = [
    { a: "#8fae5f", b: "#55703a", glow: "#cfe39a" },   // moss
    { a: "#d98e5f", b: "#9c5532", glow: "#f5c9a4" },   // clay
    { a: "#8d7fc9", b: "#564a8e", glow: "#cfc6f0" },   // dusk
    { a: "#6fb3ae", b: "#3a6f6b", glow: "#b8e3df" },   // rockpool
    { a: "#c97f96", b: "#8a4a60", glow: "#efc1d0" },   // rhubarb
    { a: "#b8a14f", b: "#7a682c", glow: "#e8d99a" },   // gorse
  ];

  function genBuddyConfig(seedStr) {
    const rand = mulberry32(hashString(seedStr));
    const n = 8;
    const pts = [];
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * Math.PI * 2 - Math.PI / 2;
      const r = 58 * (0.78 + rand() * 0.5);
      pts.push({ x: 100 + Math.cos(ang) * r, y: 104 + Math.sin(ang) * r * 0.95 });
    }
    const eyeCount = rand() < 0.18 ? 1 : rand() < 0.85 ? 2 : 3;
    const eyes = [];
    const eyeR = 8 + rand() * 5;
    if (eyeCount === 1) {
      eyes.push({ x: 100, y: 86 + rand() * 10, r: eyeR + 3 });
    } else {
      const spread = 16 + rand() * 12;
      const ey = 84 + rand() * 12;
      eyes.push({ x: 100 - spread, y: ey, r: eyeR });
      eyes.push({ x: 100 + spread, y: ey, r: eyeR });
      if (eyeCount === 3) eyes.push({ x: 100, y: ey - 18, r: eyeR * 0.6 });
    }
    const sprouts = [];
    const sproutCount = 1 + Math.floor(rand() * 3);
    for (let i = 0; i < sproutCount; i++) {
      sprouts.push({
        x: 78 + rand() * 44,
        len: 16 + rand() * 18,
        sway: rand() * 10 - 5,
        tip: 3 + rand() * 3,
      });
    }
    const spots = [];
    const spotCount = 2 + Math.floor(rand() * 3);
    for (let i = 0; i < spotCount; i++) {
      spots.push({ x: 60 + rand() * 80, y: 110 + rand() * 40, r: 4 + rand() * 9 });
    }
    return {
      seed: seedStr,
      palette: Math.floor(rand() * PALETTES.length),
      pts,
      eyes,
      sprouts,
      spots,
      mouth: { y: (eyes[0] ? eyes[0].y : 90) + 22 + rand() * 8, w: 8 + rand() * 12, smile: rand() > 0.25 },
    };
  }

  function smoothClosedPath(pts) {
    const n = pts.length;
    let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)} `;
    for (let i = 0; i < n; i++) {
      const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
      const c1x = p1.x + (p2.x - p0.x) / 6, c1y = p1.y + (p2.y - p0.y) / 6;
      const c2x = p2.x - (p3.x - p1.x) / 6, c2y = p2.y - (p3.y - p1.y) / 6;
      d += `C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)} `;
    }
    return d + "Z";
  }

  function buddySVG(config, { small = false, reveal = false } = {}) {
    const pal = PALETTES[config.palette];
    const body = smoothClosedPath(config.pts);
    const uid = "b" + (hashString(config.seed) % 99999);

    const sprouts = config.sprouts.map((s) => {
      const topY = 104 - 60;
      return `
        <path d="M ${s.x} ${topY + 14} Q ${s.x + s.sway} ${topY - s.len / 2} ${s.x + s.sway * 1.6} ${topY - s.len}"
              fill="none" stroke="${pal.b}" stroke-width="3" stroke-linecap="round"/>
        <circle cx="${s.x + s.sway * 1.6}" cy="${topY - s.len}" r="${s.tip}" fill="${pal.glow}"/>`;
    }).join("");

    const spots = config.spots.map((s) =>
      `<circle cx="${s.x}" cy="${s.y}" r="${s.r}" fill="${pal.glow}" opacity="0.22"/>`).join("");

    const eyes = config.eyes.map((e) => `
      <g class="buddy-eye">
        <circle cx="${e.x}" cy="${e.y}" r="${e.r}" fill="#f7f3ea"/>
        <circle cx="${e.x}" cy="${e.y}" r="${(e.r * 0.45).toFixed(1)}" fill="#231d15"/>
        <circle cx="${(e.x + e.r * 0.18).toFixed(1)}" cy="${(e.y - e.r * 0.2).toFixed(1)}" r="${(e.r * 0.14).toFixed(1)}" fill="#fff"/>
      </g>`).join("");

    const m = config.mouth;
    const mouth = m.smile
      ? `<path d="M ${100 - m.w} ${m.y} Q 100 ${m.y + 9} ${100 + m.w} ${m.y}" fill="none" stroke="#231d15" stroke-width="2.6" stroke-linecap="round"/>`
      : `<circle cx="100" cy="${m.y + 2}" r="4" fill="#231d15"/>`;

    return `
      <svg class="buddy-svg ${small ? "buddy-svg--small" : ""} ${reveal ? "buddy-svg--reveal" : ""}"
           viewBox="0 0 200 200" role="img" aria-label="Your buddy" data-buddy>
        <defs>
          <radialGradient id="${uid}-g" cx="38%" cy="32%" r="75%">
            <stop offset="0%" stop-color="${pal.a}"/>
            <stop offset="100%" stop-color="${pal.b}"/>
          </radialGradient>
          <clipPath id="${uid}-c"><path d="${body}"/></clipPath>
        </defs>
        ${sprouts}
        <path d="${body}" fill="url(#${uid}-g)"/>
        <g clip-path="url(#${uid}-c)">${spots}</g>
        ${eyes}
        ${mouth}
      </svg>`;
  }

  // Render the buddy: Midjourney image if one has been plugged in, else the generative SVG stand-in.
  function buddyVisual(opts = {}) {
    const b = state.buddy;
    if (!b) return "";
    if (b.imageUrl) {
      const cls = `buddy-svg ${opts.small ? "buddy-svg--small" : ""} ${opts.reveal ? "buddy-svg--reveal" : ""}`;
      return `<img class="${cls}" src="${esc(b.imageUrl)}" alt="Your buddy" data-buddy />`;
    }
    return buddySVG(b.config, opts);
  }

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
            <p class="transcript is-empty" data-ref="transcript" aria-live="polite"></p>
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
          <textarea data-ref="ta" placeholder="${esc(opts.placeholder)}" maxlength="${maxLen}">${esc(value)}</textarea>
          ${notice ? `<p class="micro voice-notice">${esc(notice)}</p>` : ""}
          <button type="button" class="btn btn--primary" data-act="submit" ${value.trim() ? "" : "disabled"}>${esc(opts.submitLabel)}</button>
          <div class="voice-box__alts">
            ${Speech.supported() ? `<button type="button" class="btn btn--ghost btn--compact" data-act="toggle">Say it instead</button>` : ""}
            ${skipBtn}
          </div>
        </div>`;
    }

    function updateVoiceUI() {
      const status = $("[data-ref=status]");
      if (!status) return;
      const transcript = $("[data-ref=transcript]");
      const submit = $("[data-act=submit]");
      const mic = $("[data-act=mic]");
      const text = (value + (interim ? " " + interim : "")).trim();
      if (transcript) {
        transcript.textContent = text;
        transcript.classList.toggle("is-empty", !text);
      }
      if (listening) status.textContent = "Listening. Tap the square when you're done.";
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
        for (let i = ev.resultIndex; i < ev.results.length; i++) {
          const res = ev.results[i];
          if (res.isFinal) value = (value + " " + res[0].transcript).trim().slice(0, maxLen);
          else interim += res[0].transcript;
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

    function wireTextarea() {
      const ta = $("[data-ref=ta]");
      const submit = $("[data-act=submit]");
      if (!ta) return;
      ta.addEventListener("input", () => {
        value = ta.value;
        if (submit) submit.disabled = value.trim().length === 0;
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
    const sourceMaterial = [p.saturday, p.miss, p.love].filter(Boolean).join("; ")
      || "quiet Saturdays, music, the outdoors";
    return [
      "small fantastical abstract creature companion, non-human,",
      "no race, body type or age signifiers, plucky charm, strange but warm,",
      "soft rounded organic form, asymmetric blob body, simple expressive eyes,",
      "tiny glowing sprouts, subtle spots,",
      `personality and textures drawn from: ${sourceMaterial},`,
      "warm charcoal background #15120e, single amber accent light #e8923c,",
      "soft 3d render, character design sheet, centered portrait,",
      "its own quiet little world",
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
    "Making you something no one else has…",
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
    "It did a little wobble. For you.",
    "It's pretending it didn't like that. It did.",
    "It doesn't need anything. It's just glad you came.",
  ];

  function observeLines() {
    const p = state.profile;
    const name = state.buddy?.name || "Your buddy";
    const lines = [];
    if (p.miss) lines.push(`${name} spent the morning on “${p.miss}”. Someone had to keep it going.`);
    if (p.saturday) lines.push(`${name} had one of your old Saturdays today — “${p.saturday}”. It was thinking of you.`);
    if (p.love) lines.push(`${name} is minding “${p.love}” for you. That's its whole job, and it takes it seriously.`);
    lines.push(`${name} doesn't need feeding, winding or settling. It just notices when you're here.`);
    lines.push(`${name} has been pottering about, doing the lost-column things. Vicariously, you're having a great week.`);
    return lines;
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
          <div class="buddy-stage">${buddyVisual({ reveal: true })}</div>
          <h2 class="q-text" style="text-align:center">Made for you.<br/>Only you.</h2>
          <p class="q-sub" style="text-align:center">Built from what you told us — the Saturdays, the things you miss. It'll keep an eye on them while you're busy. Every one's different. This one's yours.</p>
          <p class="micro" style="text-align:center">Prototype note: in production this is a Midjourney render generated from your answers — the prompt's in the side panel.</p>
        </div>
        <div class="screen-footer">
          <div class="answer-box" style="margin-top:0">
            <input type="text" id="buddy-name" placeholder="Give it a name" maxlength="24" autocomplete="off"/>
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
        <div class="buddy-stage">${buddyVisual({ small: true })}</div>
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
          ${checkinCard}
          ${ins ? `
          <div class="card">
            <p class="card__kicker">Noticed</p>
            <p class="card__body" id="insight-line">${esc(ins)}</p>
            <p class="micro">No response required. It's a mirror, not a notification.</p>
          </div>` : ""}
          <div class="card" data-act="visit" style="cursor:pointer;align-items:center;text-align:center">
            <div class="buddy-stage">${buddyVisual({ small: true })}</div>
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
    wireBuddyPoke();
    maybeGenerateInsight();
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
    const name = esc(state.buddy?.name || "Your buddy");
    const obs = pick(observeLines(), new Date().getHours() + state.entries.length);
    return `
      <div class="screen" style="padding-top:10px;text-align:center">
        <h2 class="home-greeting" style="text-align:center">${name}</h2>
        <p class="micro">Observe, or interact. Both count. It doesn't need you — it just notices when you're there.</p>
        <div style="flex:1;display:flex;flex-direction:column;justify-content:center;gap:18px">
          <div class="buddy-stage">${buddyVisual()}</div>
          <p class="buddy-line" id="buddy-line">${esc(obs)}</p>
        </div>
        <div class="screen-footer" style="align-items:center">
          <p class="micro">Give it a poke. Low stakes. No objectives.</p>
          <button class="btn btn--quiet" data-act="reset-inline">Prototype v0.1 · start again</button>
        </div>
      </div>`;
  }

  function wireBuddyPoke() {
    const svg = app.querySelector("[data-buddy]");
    if (!svg) return;
    let pokes = 0;
    svg.addEventListener("click", () => {
      svg.classList.remove("is-poked");
      void svg.getBoundingClientRect(); // restart animation
      svg.classList.add("is-poked");
      const line = app.querySelector("#buddy-line");
      if (line) {
        pokes++;
        line.textContent = pick(POKE_LINES, pokes + new Date().getMinutes());
      }
    });
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
    if (mjFeedback) mjFeedback.textContent = "Back to the generative SVG stand-in.";
  });

  render();
})();
