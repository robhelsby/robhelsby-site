/* ============================================================
   The Chief — character runtime (v3)
   A living, Oddballz-style creature: structured SVG rig driven
   by a requestAnimationFrame loop with spring physics, detailed
   tracking eyes, gesture recognition and autonomous behaviour.

   Exposed as window.AlrightChief:
     genConfig(seed)                -> per-user character config
     render(config, scene, opts)   -> static SVG string (small/reveal contexts)
     Rig                           -> live interactive character
   ============================================================ */

(() => {
  "use strict";

  /* ---------- seeded random ---------- */
  function hashString(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
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

  /* ---------- palette (from the reference sheets) ---------- */
  const INK = {
    line: "#0b0a10",
    fur: "#191621",
    furHi: "#39344a",
    sclera: "#f4f1e8",
    pupil: "#141118",
    pants: "#3f3b49",
    shoe: "#eeece6",
    sole: "#b5b2ab",
    mitt: "#7c5cbf",
    mittLo: "#5d4396",
    mittLine: "#3f2d68",
  };
  const HAT_COLS = [
    { name: "green", a: "#55b04b", b: "#3c8a35" },
    { name: "purple", a: "#7a5ec2", b: "#5c449c" },
    { name: "orange", a: "#e8813a", b: "#c05f1e" },
    { name: "blue", a: "#4f6fd8", b: "#3854b0" },
  ];
  const HOODIES = [
    { a: "#cfcdd6", b: "#aeacb9" },
    { a: "#e9e7ec", b: "#c6c4cd" },
    { a: "#b9b7c2", b: "#9896a4" },
  ];

  function genConfig(seedStr) {
    const rand = mulberry32(hashString(seedStr));
    return {
      chief: true, v2: true, v3: true, seed: seedStr,
      h: 0.94 + rand() * 0.12,
      w: 0.95 + rand() * 0.12,
      hat: Math.floor(rand() * 3),
      hatCol: Math.floor(rand() * 4),
      hoodie: Math.floor(rand() * 3),
      furSeed: Math.floor(rand() * 9999),
      eyeAsym: 0.9 + rand() * 0.2,   // one eye slightly bigger — character
    };
  }

  /* ---------- geometry constants ---------- */
  const CX = 110, GROUND = 225, HIP = 168, HEAD_CY = 84;

  let uidCounter = 0;

  function shaggyBlob(bx, by, r, rSeed, squashY = 1) {
    const rand = mulberry32(rSeed);
    const n = 22;
    let d = "";
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI * 2;
      const tuft = (i % 2 === 0 ? 1 : 0.9) + rand() * 0.08;
      const rr = r * tuft;
      const x = bx + Math.cos(a) * rr;
      const y = by + Math.sin(a) * rr * squashY;
      if (i === 0) d = `M ${x.toFixed(1)} ${y.toFixed(1)}`;
      else {
        const pa = ((i - 0.5) / n) * Math.PI * 2;
        d += ` Q ${(bx + Math.cos(pa) * r * 1.06).toFixed(1)} ${(by + Math.sin(pa) * r * 1.06 * squashY).toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)}`;
      }
    }
    return d + " Z";
  }

  /* ---------- activity props ---------- */
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
      <path d="M -4 -22 q 2.5 -4 0 -8" stroke="#9a9082" stroke-width="2.4" fill="none" stroke-linecap="round"/>
      <path d="M 4 -22 q -2.5 -4 0 -8" stroke="#9a9082" stroke-width="2.4" fill="none" stroke-linecap="round"/>`,
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
      <rect x="-9" y="-26" width="18" height="7" rx="2" fill="#3a3444" stroke="${INK.line}" stroke-width="2.5"/>
      <path d="M -9 -23 L -20 -28 M 9 -23 L 20 -28" stroke="${INK.line}" stroke-width="2.5" stroke-linecap="round"/>
      <ellipse cx="-20" cy="-28" rx="7" ry="2" fill="#9a93a6"/><ellipse cx="20" cy="-28" rx="7" ry="2" fill="#9a93a6"/>`,
    telescope: () => `
      <path d="M -14 -2 L 14 -30" stroke="#3a3444" stroke-width="7" stroke-linecap="round"/>
      <circle cx="14" cy="-30" r="4" fill="#5d7286" stroke="${INK.line}" stroke-width="2"/>
      <path d="M -14 -2 L -20 0 M -14 -2 L -8 0" stroke="${INK.line}" stroke-width="3" stroke-linecap="round"/>
      <circle cx="20" cy="-36" r="1.6" fill="#c9a04a"/><circle cx="26" cy="-30" r="1.2" fill="#f4efe6"/>`,
  };

  /* ============================================================
     buildChief — structured SVG with addressable parts.
     Every mutable part carries a class the rig can query:
       .p-root .p-figure .p-head .p-tail .p-armL .p-armR
       .p-legL .p-legR .p-eyeL .p-eyeR .p-pupilL .p-pupilR
       .p-lidL .p-lidR .p-lidBL .p-lidBR .p-mouth .p-fx .p-shadow
     ============================================================ */
  function buildChief(config, scene = { pose: "attentive" }, opts = {}) {
    const C = config;
    const hat = HAT_COLS[C.hatCol % 4];
    const hood = HOODIES[C.hoodie % 3];
    const pose = scene.pose || "attentive";
    const o = `stroke="${INK.line}" stroke-width="3.2" stroke-linejoin="round"`;
    const uid = "cf" + (++uidCounter) + "_" + (hashString(C.seed) % 9999);
    const headR = 34 * C.w;

    /* ----- detailed eyes: sclera + tracking pupil + expressive lids ----- */
    // mood presets: lid coverage (0 open - 1 closed), lid tilt (deg, +ve = outer edge down = sad), bottom lid raise
    const EYE_MOODS = {
      open:     { lid: 0.06, tilt: 0,   bot: 0 },
      wide:     { lid: 0,    tilt: 0,   bot: 0 },
      bored:    { lid: 0.52, tilt: -4,  bot: 0 },
      sad:      { lid: 0.38, tilt: 14,  bot: 0 },
      angry:    { lid: 0.35, tilt: -14, bot: 0 },
      happy:    { lid: 0.1,  tilt: 0,   bot: 0.45 },
      sleepy:   { lid: 0.72, tilt: 4,   bot: 0 },
      closed:   { lid: 1,    tilt: 0,   bot: 0 },
    };
    const eyeMood = scene.eyes || (
      pose === "sleep" ? "closed" :
      pose === "bored" ? "bored" :
      pose === "sad" || pose === "lonely" ? "sad" :
      pose === "despair" ? "closed" :
      pose === "rave" || pose === "excited" || pose === "joy" ? "happy" :
      pose === "inlove" ? "happy" : "open");
    const em = EYE_MOODS[eyeMood] || EYE_MOODS.open;

    function eye(side, ex, eyC) {
      const sgn = side === "L" ? -1 : 1;
      const rx = (side === "L" ? 10 : 10 * C.eyeAsym + 1.2) * C.w;
      const ry = side === "L" ? 13.5 : 13.5 * C.eyeAsym + 1.5;
      const x = ex + sgn * 16.5 * C.w;
      const pupilR = Math.min(rx, ry) * 0.42;
      const lidY = -ry * 2 + em.lid * ry * 2; // top lid rest position
      const heart = pose === "inlove";
      return `
        <g class="p-eye${side}" data-ex="${x}" data-ey="${eyC}" data-rx="${rx.toFixed(1)}" data-ry="${ry.toFixed(1)}">
          <clipPath id="${uid}-e${side}"><ellipse cx="${x}" cy="${eyC}" rx="${rx.toFixed(1)}" ry="${ry.toFixed(1)}"/></clipPath>
          <ellipse cx="${x}" cy="${eyC}" rx="${rx.toFixed(1)}" ry="${ry.toFixed(1)}" fill="${INK.sclera}"/>
          <g clip-path="url(#${uid}-e${side})">
            ${heart ? `
            <path class="p-pupil${side}" d="M ${x} ${eyC + 6} l -6.5 -7 a 4 4 0 0 1 6.5 -3 a 4 4 0 0 1 6.5 3 Z" fill="#d4587a"/>` : `
            <g class="p-pupil${side}">
              <circle cx="${x}" cy="${eyC + 1}" r="${pupilR.toFixed(1)}" fill="${INK.pupil}"/>
              <circle cx="${(x + pupilR * 0.35).toFixed(1)}" cy="${(eyC + 1 - pupilR * 0.4).toFixed(1)}" r="${(pupilR * 0.32).toFixed(1)}" fill="#ffffff"/>
              <circle cx="${(x - pupilR * 0.4).toFixed(1)}" cy="${(eyC + 1 + pupilR * 0.35).toFixed(1)}" r="${(pupilR * 0.14).toFixed(1)}" fill="#ffffff" opacity="0.7"/>
            </g>`}
            <g class="p-lid${side}" transform="translate(0 ${lidY.toFixed(1)}) rotate(${(em.tilt * sgn).toFixed(1)} ${x} ${eyC})">
              <rect x="${(x - rx - 4).toFixed(1)}" y="${(eyC - ry * 1.15).toFixed(1)}" width="${(rx * 2 + 8).toFixed(1)}" height="${(ry * 2.3).toFixed(1)}" fill="${INK.fur}"/>
            </g>
            <g class="p-lidB${side}" transform="translate(0 ${(ry * 2 - em.bot * ry * 1.6).toFixed(1)})">
              <ellipse cx="${x}" cy="${(eyC + ry * 0.9).toFixed(1)}" rx="${(rx + 4).toFixed(1)}" ry="${ry.toFixed(1)}" fill="${INK.fur}"/>
            </g>
          </g>
          <ellipse cx="${x}" cy="${eyC}" rx="${rx.toFixed(1)}" ry="${ry.toFixed(1)}" fill="none" stroke="${INK.fur}" stroke-width="1.6" opacity="0.9"/>
        </g>`;
    }

    const mouthSVG = () => {
      const my = HEAD_CY + 21;
      const kind = scene.mouth || (pose === "rave" || pose === "excited" ? "grin" : pose === "keepups" ? "smile" : "none");
      if (kind === "grin") return `<path class="p-mouth" d="M ${CX - 9} ${my} Q ${CX} ${my + 9} ${CX + 9} ${my}" fill="none" stroke="${INK.sclera}" stroke-width="3" stroke-linecap="round"/>`;
      if (kind === "smile") return `<path class="p-mouth" d="M ${CX - 6} ${my} Q ${CX} ${my + 5} ${CX + 6} ${my}" fill="none" stroke="${INK.sclera}" stroke-width="2.6" stroke-linecap="round"/>`;
      if (kind === "o") return `<circle class="p-mouth" cx="${CX}" cy="${my}" r="3.4" fill="none" stroke="${INK.sclera}" stroke-width="2.6"/>`;
      return `<g class="p-mouth"></g>`;
    };

    const patch = (px, py) => `
      <rect x="${px - 6}" y="${py - 5}" width="12" height="10" rx="2.5" fill="#efeade" stroke="${INK.line}" stroke-width="2"/>
      <text x="${px}" y="${py + 3}" font-size="8" font-weight="700" text-anchor="middle" fill="#3a3630" font-family="sans-serif">C</text>`;

    function hatSVG(hy) {
      switch (C.hat % 3) {
        case 0: return `
          <path d="M ${CX - 32} ${hy} L ${CX - 24} ${hy - 28} Q ${CX} ${hy - 38} ${CX + 24} ${hy - 28} L ${CX + 32} ${hy} Z" fill="${hat.a}" ${o}/>
          <ellipse cx="${CX}" cy="${hy}" rx="42" ry="9.5" fill="${hat.a}" ${o}/>
          <path d="M ${CX - 40} ${hy + 2.5} a 40 8.5 0 0 0 80 0" fill="${hat.b}" stroke="none" opacity="0.55"/>
          ${patch(CX, hy - 17)}`;
        case 1: return `
          <path d="M ${CX - 33} ${hy + 3} Q ${CX - 34} ${hy - 28} ${CX} ${hy - 29} Q ${CX + 34} ${hy - 28} ${CX + 33} ${hy + 3} Z" fill="${hat.a}" ${o}/>
          <path d="M ${CX + 22} ${hy - 4} q 26 -3 34 5 q -14 8 -35 4 Z" fill="${hat.b}" ${o}/>
          <path d="M ${CX - 33} ${hy + 3} q 33 8 66 0" stroke="${INK.line}" stroke-width="3" fill="none"/>
          ${patch(CX, hy - 12)}`;
        default: return `
          <path d="M ${CX - 32} ${hy + 3} Q ${CX} ${hy - 42} ${CX + 32} ${hy + 3} Z" fill="${hat.a}" ${o}/>
          <rect x="${CX - 34}" y="${hy - 4}" width="68" height="13" rx="6.5" fill="${hat.b}" ${o}/>
          ${patch(CX, hy + 2.5)}`;
      }
    }

    function mitten(x, y, sc = 1) {
      return `
        <circle cx="${x - 8 * sc}" cy="${y + 3 * sc}" r="${5 * sc}" fill="${INK.mitt}" stroke="${INK.mittLine}" stroke-width="2.4"/>
        <ellipse cx="${x}" cy="${y}" rx="${10.5 * sc}" ry="${11.5 * sc}" fill="${INK.mitt}" stroke="${INK.mittLine}" stroke-width="2.6"/>
        <path d="M ${x - 6 * sc} ${y + 4 * sc} q ${6 * sc} ${5 * sc} ${12 * sc} 0" stroke="${INK.mittLo}" stroke-width="2" fill="none" stroke-linecap="round"/>`;
    }
    const armPath = (x1, y1, mx, my, x2, y2) => `
      <path class="p-seg p-seg-ink" d="M ${x1} ${y1} Q ${mx} ${my} ${x2} ${y2}" stroke="${INK.line}" stroke-width="16.5" fill="none" stroke-linecap="round"/>
      <path class="p-seg p-seg-top" d="M ${x1} ${y1} Q ${mx} ${my} ${x2} ${y2}" stroke="${hood.a}" stroke-width="11.5" fill="none" stroke-linecap="round"/>`;
    // limb groups carry their rest geometry so the rig can re-pose them live
    const arm = (side, x1, y1, mx, my, x2, y2, mitX, mitY, sc) =>
      `<g class="p-arm${side} p-limb" data-ax="${x1}" data-ay="${y1}" data-cx="${mx}" data-cy="${my}" data-ex="${x2}" data-ey="${y2}" data-side="${side === "L" ? -1 : 1}">${armPath(x1, y1, mx, my, x2, y2)}<g class="p-end">${mitten(mitX !== undefined ? mitX : x2, mitY !== undefined ? mitY : y2 + 3, sc || 1)}</g></g>`;

    const legPath = (x, fromY, toY, bend = 0) => `
      <path class="p-seg p-seg-ink" d="M ${x} ${fromY} Q ${x + bend} ${(fromY + toY) / 2} ${x} ${toY}" stroke="${INK.line}" stroke-width="17" fill="none" stroke-linecap="round"/>
      <path class="p-seg p-seg-top" d="M ${x} ${fromY} Q ${x + bend} ${(fromY + toY) / 2} ${x} ${toY}" stroke="${INK.pants}" stroke-width="12" fill="none" stroke-linecap="round"/>`;
    function sneaker(x, y, flip = 1) {
      return `
        <path d="M ${x - 10 * flip} ${y - 9} q ${14 * flip} -3 ${20 * flip} 3 q ${3 * flip} 3 ${1 * flip} 6 l ${-24 * flip} 0 Z" fill="${INK.shoe}" ${o}/>
        <path d="M ${x - 11 * flip} ${y} l ${25 * flip} 0 q ${2 * flip} 4 ${-2 * flip} 5 l ${-22 * flip} 0 q ${-3 * flip} -2 ${-1 * flip} -5 Z" fill="${INK.sole}" stroke="${INK.line}" stroke-width="2.4"/>
        <path d="M ${x - 4 * flip} ${y - 8} l ${3 * flip} 6 M ${x + 1 * flip} ${y - 8.5} l ${3 * flip} 6" stroke="${hat.a}" stroke-width="2" stroke-linecap="round"/>`;
    }
    const leg = (side, x, bend, flip) =>
      `<g class="p-leg${side} p-limb" data-ax="${x}" data-ay="${HIP}" data-cx="${x + (bend || 0)}" data-cy="${(HIP + GROUND - 14) / 2}" data-ex="${x}" data-ey="${GROUND - 14}" data-side="${side === "L" ? -1 : 1}">${legPath(x, HIP, GROUND - 14, bend || 0)}<g class="p-end">${sneaker(x + (flip === -1 ? -1 : 3), GROUND - 2, flip || 1)}</g></g>`;

    function tailSVG(bx, by, dir = 1) {
      return `
        <g class="p-tail" data-px="${bx}" data-py="${by}">
          <path d="M ${bx} ${by}
                   q ${18 * dir} -6 ${26 * dir} -19
                   l ${-6 * dir} 2 q ${7 * dir} -9 ${8 * dir} -17
                   l ${-7 * dir} 4 q ${3 * dir} -8 ${0} -13
                   q ${-11 * dir} 10 ${-16 * dir} 21
                   q ${-5 * dir} 11 ${-7 * dir} 22 Z"
                fill="${INK.fur}" ${o}/>
          <path d="M ${bx + 8 * dir} ${by - 14} q ${8 * dir} -8 ${11 * dir} -18" stroke="${INK.furHi}" stroke-width="2.2" fill="none" stroke-linecap="round" opacity="0.55"/>
        </g>`;
    }

    function headSVG(hy = HEAD_CY, tilt = 0) {
      const blob = shaggyBlob(CX, hy, headR, C.furSeed, 1.02);
      return `
        <g class="p-head" ${tilt ? `transform="rotate(${tilt} ${CX} ${hy})"` : ""}>
          <path d="M ${CX - headR - 2} ${hy + 8} l -7 2 l 6 3 l -5 4 l 8 0 Z" fill="${INK.fur}" stroke="${INK.line}" stroke-width="2.4" stroke-linejoin="round"/>
          <path d="M ${CX + headR + 2} ${hy + 8} l 7 2 l -6 3 l 5 4 l -8 0 Z" fill="${INK.fur}" stroke="${INK.line}" stroke-width="2.4" stroke-linejoin="round"/>
          <path d="${blob}" fill="${INK.fur}" ${o}/>
          <path d="M ${CX - headR * 0.62} ${hy - headR * 0.5} Q ${CX - headR * 0.92} ${hy} ${CX - headR * 0.6} ${hy + headR * 0.5}" fill="none" stroke="${INK.furHi}" stroke-width="2.4" stroke-linecap="round" opacity="0.6"/>
          ${eye("L", CX, hy + 2)}
          ${eye("R", CX, hy + 2)}
          ${mouthSVG()}
          ${hatSVG(hy - headR * 0.78)}
        </g>`;
    }

    function torsoSVG(topY = 112, botY = 174) {
      const w = 40 * C.w;
      return `
        <g class="p-torso">
          <path d="M ${CX - w} ${botY}
                   Q ${CX - w - 4} ${topY + 10} ${CX - w * 0.55} ${topY}
                   Q ${CX} ${topY - 6} ${CX + w * 0.55} ${topY}
                   Q ${CX + w + 4} ${topY + 10} ${CX + w} ${botY}
                   Z" fill="${hood.a}" ${o}/>
          <path d="M ${CX - w * 0.55} ${topY + 2} Q ${CX} ${topY + 14} ${CX + w * 0.55} ${topY + 2}" fill="none" stroke="${hood.b}" stroke-width="3" stroke-linecap="round"/>
          <path d="M ${CX - 6} ${topY + 12} v 10 M ${CX + 6} ${topY + 12} v 10" stroke="${hood.b}" stroke-width="2.6" stroke-linecap="round"/>
          <path d="M ${CX - w * 0.6} ${botY - 16} q ${w * 0.6} 10 ${w * 1.2} 0" fill="none" stroke="${hood.b}" stroke-width="2.6" stroke-linecap="round"/>
        </g>`;
    }

    /* ----- assemble by pose ----- */
    const shadow = (rx = 58) => `<ellipse class="p-shadow" cx="${CX}" cy="${GROUND + 4}" rx="${rx}" ry="7" fill="#000" opacity="0.32"/>`;
    let scenery = "", figure = "", overlay = "";

    if (pose === "sleep") {
      scenery = `${shadow(72)}<rect x="38" y="205" width="150" height="17" rx="8" fill="#dedbe2" ${o}/>`;
      figure = `
        <path d="${shaggyBlob(74, 190, 30, C.furSeed, 0.94)}" fill="${INK.fur}" ${o}/>
        <path d="M 64 190 q 10 8 20 0 M 84 190 q 10 8 20 0" stroke="${INK.sclera}" stroke-width="2.8" fill="none" stroke-linecap="round" transform="translate(-6 0)"/>
        <path d="M 96 176 Q 150 162 182 186 Q 188 200 180 206 L 96 206 Q 88 192 96 176 Z" fill="#5d9a55" ${o}/>
        <path d="M 100 184 q 34 -8 72 6" stroke="#477a41" stroke-width="2.6" fill="none" stroke-linecap="round"/>
        ${tailSVG(184, 200, 1)}`;
      overlay = `<g class="p-fx">${[0, 1, 2].map((i) => `
        <text x="${150 + i * 14}" y="150" font-size="${14 + i * 5}" fill="#8f8a99" font-family="sans-serif">z
          <animate attributeName="y" values="155;128" dur="2.6s" begin="${-i * 0.85}s" repeatCount="indefinite"/>
          <animate attributeName="opacity" values="0;1;0" dur="2.6s" begin="${-i * 0.85}s" repeatCount="indefinite"/>
        </text>`).join("")}</g>`;
    } else if (pose === "keepups") {
      figure = `
        ${tailSVG(78, 158, -1)}
        ${leg("L", 96, 0, -1)}
        <g class="p-legR-kick">
          <animateTransform attributeName="transform" type="rotate" values="0 128 ${HIP}; 38 128 ${HIP}; 0 128 ${HIP}" keyTimes="0;0.5;1" dur="0.85s" repeatCount="indefinite"/>
          ${leg("R", 128, 10, 1)}
        </g>
        ${torsoSVG()}
        ${arm("L", 84, 126, 66, 145, 72, 162, 72, 165)}
        ${arm("R", 136, 126, 154, 142, 150, 158, 151, 160)}
        ${headSVG()}`;
      scenery = shadow(64);
      overlay = `
        <g class="p-fx">
          <g><animateTransform attributeName="transform" type="translate" values="0 0; 0 -54; 0 0" keyTimes="0;0.5;1" dur="0.85s" repeatCount="indefinite"/>
            <g><animateTransform attributeName="transform" type="rotate" values="0 163 ${GROUND - 13}; 360 163 ${GROUND - 13}" dur="1.7s" repeatCount="indefinite"/>
              <circle cx="163" cy="${GROUND - 13}" r="13" fill="#f5f2ea" ${o}/>
              <path d="M 163 ${GROUND - 19} l 5 3.6 -1.9 6 -6.2 0 -1.9 -6 Z" fill="#2b2833"/>
              <path d="M 163 ${GROUND - 19} l 0 -4.5 M 168 ${GROUND - 15.5} l 4.5 -1.8 M 166.2 ${GROUND - 9.5} l 2.6 3.6 M 159.8 ${GROUND - 9.5} l -2.6 3.6 M 158 ${GROUND - 15.5} l -4.5 -1.8" stroke="#2b2833" stroke-width="1.7"/>
            </g>
          </g>
        </g>`;
    } else if (pose === "rave") {
      const speaker = (sx) => `
        <rect x="${sx - 17}" y="${GROUND - 62}" width="34" height="62" rx="4" fill="#2c2834" ${o}/>
        <circle cx="${sx}" cy="${GROUND - 44}" r="10" fill="#413c4d" stroke="${INK.line}" stroke-width="2.6"/>
        <circle cx="${sx}" cy="${GROUND - 44}" r="4" fill="#191621"/>
        <circle cx="${sx}" cy="${GROUND - 16}" r="6.5" fill="#413c4d" stroke="${INK.line}" stroke-width="2.4"/>`;
      scenery = `${shadow(78)}${speaker(34)}${speaker(186)}`;
      figure = `
        ${tailSVG(140, 158, 1)}
        <g>
          <animateTransform attributeName="transform" type="translate" values="0 0; 0 -9; 0 0" dur="0.5s" repeatCount="indefinite"/>
          ${leg("L", 98, -6, -1)}
          ${leg("R", 122, 6, 1)}
          ${torsoSVG()}
          ${arm("L", 84, 124, 60, 102, 52, 84, 51, 79)}
          ${arm("R", 136, 124, 160, 102, 168, 84, 169, 79)}
          ${headSVG()}
        </g>`;
      overlay = `<g class="p-fx">${[["#59d24d", 60, 60, 0.5], ["#b06ee0", 96, 42, 0.62], ["#e8813a", 128, 44, 0.44], ["#ff6fa8", 162, 62, 0.56]].map(([col, lx, ly, dur]) => `
        <circle cx="${lx}" cy="${ly}" r="5.5" fill="${col}">
          <animate attributeName="opacity" values="0.15;1;0.15" dur="${dur}s" repeatCount="indefinite"/>
        </circle>`).join("")}</g>`;
    } else if (pose === "walking") {
      scenery = shadow(60);
      figure = `
        ${tailSVG(80, 158, -1)}
        <g><animateTransform attributeName="transform" type="rotate" values="-16 98 ${HIP}; 16 98 ${HIP}; -16 98 ${HIP}" dur="0.9s" repeatCount="indefinite"/>${leg("L", 98, 0, -1)}</g>
        <g><animateTransform attributeName="transform" type="rotate" values="16 122 ${HIP}; -16 122 ${HIP}; 16 122 ${HIP}" dur="0.9s" repeatCount="indefinite"/>${leg("R", 122, 0, 1)}</g>
        ${torsoSVG()}
        ${arm("L", 84, 126, 70, 148, 76, 166, 76, 169)}
        ${arm("R", 136, 126, 152, 144, 146, 160, 147, 163)}
        ${headSVG()}`;
    } else if (pose === "activity") {
      scenery = shadow(70);
      figure = `
        ${tailSVG(78, 158, -1)}
        ${leg("L", 98, 0, -1)}
        ${leg("R", 122, 0, 1)}
        ${torsoSVG()}
        ${arm("L", 84, 126, 66, 145, 72, 162, 72, 165)}
        ${arm("R", 136, 122, 158, 118, 166, 128, 167, 128)}
        ${headSVG()}`;
      overlay = scene.activity && PROPS[scene.activity.prop]
        ? `<g class="p-fx" transform="translate(188 ${GROUND - 2}) scale(1.25)">${PROPS[scene.activity.prop]()}</g>` : "";
    } else {
      // standing moods: bored | sad | despair | lonely | excited | inlove | attentive
      const tilt = pose === "sad" || pose === "despair" ? 5 : 0;
      let armsSVG;
      if (pose === "excited") {
        armsSVG = arm("L", 84, 124, 60, 102, 52, 84, 51, 79) + arm("R", 136, 124, 160, 102, 168, 84, 169, 79);
      } else if (pose === "attentive") {
        armsSVG = arm("L", 84, 126, 66, 145, 72, 162, 72, 165) + arm("R", 136, 126, 154, 142, 150, 158, 151, 160);
      } else if (pose === "despair") {
        armsSVG = `<g class="p-armL">${armPath(84, 122, 74, 88, 84, 62)}</g><g class="p-armR">${armPath(136, 122, 146, 88, 136, 62)}</g>`;
      } else if (pose === "inlove") {
        armsSVG = arm("L", 84, 126, 92, 148, 102, 150, 103, 151, 0.95) + arm("R", 136, 126, 128, 148, 118, 150, 117, 151, 0.95);
      } else {
        armsSVG = `<g class="p-armL">${armPath(84, 126, 74, 150, 96, 163)}</g><g class="p-armR">${armPath(136, 126, 146, 150, 124, 163)}</g>`;
      }
      const accents =
        pose === "inlove" ? `<g class="p-fx">${[[56, 66], [166, 58], [110, 22]].map(([hx, hy], i) => `
          <path d="M ${hx} ${hy} l -6 -7 a 3.8 3.8 0 0 1 6 -3 a 3.8 3.8 0 0 1 6 3 Z" fill="#d4587a">
            <animate attributeName="opacity" values="0.2;1;0.2" dur="${1.4 + i * 0.4}s" repeatCount="indefinite"/>
          </path>`).join("")}</g>`
        : pose === "excited" ? `<g class="p-fx">${[[64, 66], [156, 60], [110, 30]].map(([sx, sy], i) => `
          <path d="M ${sx} ${sy - 5} l 2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2 Z" fill="${hat.a}">
            <animate attributeName="opacity" values="0.2;1;0.2" dur="${0.9 + i * 0.3}s" repeatCount="indefinite"/>
          </path>`).join("")}</g>`
        : pose === "sad" ? `<g class="p-fx">
          <path d="M 146 92 q 5 8 0 13 q -5 -5 0 -13" fill="#7fa3c9">
            <animate attributeName="opacity" values="0.2;0.9;0.2" dur="2.2s" repeatCount="indefinite"/>
          </path></g>`
        : pose === "attentive" && scene.snapLine ? `<g class="p-fx"><text x="158" y="42" font-size="27" font-weight="700" fill="${hat.a}" font-family="sans-serif">!</text></g>`
        : pose === "lonely" ? `<g class="p-fx"><ellipse cx="${CX}" cy="${GROUND + 2}" rx="72" ry="9" fill="none" stroke="#57515f" stroke-width="2" stroke-dasharray="5 7"/></g>`
        : `<g class="p-fx"></g>`;
      scenery = shadow();
      figure = `
        ${tailSVG(pose === "sad" || pose === "despair" || pose === "lonely" ? 142 : 140, 158, 1)}
        ${leg("L", 98, 0, -1)}
        ${leg("R", 122, 0, 1)}
        ${torsoSVG()}
        ${armsSVG}
        ${headSVG(HEAD_CY, tilt)}
        ${pose === "despair" ? mitten(84, 60) + mitten(136, 60) : ""}`;
      overlay = accents;
    }

    // opts.world = {vw, vh, ox, oy}: embed the 220x240 art in a room-sized
    // viewBox so the chief has the whole screen to be dragged and thrown in.
    const world = opts.world;
    const vw = world ? world.vw : 220;
    const vh = world ? world.vh : 240;
    const ox = world ? world.ox : 0;
    const oy = world ? world.oy : 0;
    // opts.roomProps: activity props that live on his floor even when idle —
    // the room remembers what its owner is into. World mode only.
    let roomBits = "";
    if (world && Array.isArray(opts.roomProps) && opts.roomProps.length) {
      const floorY = oy + GROUND;
      const spots = [
        { x: vw * 0.13, s: 1.1 },
        { x: vw * 0.87, s: 1.0 },
      ];
      roomBits = `<g class="p-roomprops" pointer-events="none">` + opts.roomProps.slice(0, 2).map((name, i) => {
        if (!PROPS[name]) return "";
        const p = spots[i];
        return `<g transform="translate(${p.x.toFixed(0)} ${(floorY - 1).toFixed(0)}) scale(${p.s})" opacity="0.95">
          <ellipse cx="0" cy="2" rx="26" ry="5" fill="rgba(11,10,16,0.10)"/>
          ${PROPS[name]()}
        </g>`;
      }).join("") + `</g>`;
    }
    const body_ = `
        ${scenery}
        <g class="p-root"><g class="p-squash"><g class="p-figure">${figure}</g></g></g>
        ${overlay}`;
    return `
      <svg class="buddy-svg ${opts.small ? "buddy-svg--small" : ""} ${opts.reveal ? "buddy-svg--reveal" : ""} ${world ? "buddy-svg--room" : ""}"
           viewBox="0 0 ${vw.toFixed(0)} ${vh.toFixed(0)}" ${world ? 'preserveAspectRatio="xMidYMax meet"' : ""}
           role="img" aria-label="Your chief" data-buddy data-uid="${uid}"
           data-vw="${vw.toFixed(0)}" data-vh="${vh.toFixed(0)}" data-ox="${ox.toFixed(0)}" data-oy="${oy.toFixed(0)}">
        ${roomBits}${world ? `<g transform="translate(${ox.toFixed(0)} ${oy.toFixed(0)})">${body_}</g>` : body_}
      </svg>`;
  }

  /* ============================================================
     Rig — the living chief.
     Owns the SVG, a physics/behaviour loop, gesture recognition
     and the eye system. All transforms are set directly on
     part groups (no CSS transforms, no SMIL for the core rig —
     works everywhere, including iOS Safari).
     ============================================================ */

  class Rig {
    /**
     * host: element to mount into (the .buddy-holder)
     * config: chief config
     * scene: {pose, activity?, snapLine?}
     * cb: { onReact(type), onSnap() }  — reaction hooks for captions
     * opts: { roomProps? } — extra dressing for the room render
     */
    constructor(host, config, scene, cb = {}, opts = {}) {
      this.host = host;
      this.config = config;
      this.scene = scene || { pose: "attentive" };
      this.cb = cb;
      this.opts = opts;
      this.destroyed = false;

      // the room: a viewport-sized world so he can roam the whole screen.
      // Art is 220x240; size it to ~45% of the room height, centred, on the floor.
      const rect = host.getBoundingClientRect ? host.getBoundingClientRect() : { width: 220, height: 240 };
      const hw = rect.width || 220, hh = rect.height || 240;
      const vh = 240 / 0.45;
      const vw = Math.max(240, vh * (hw / Math.max(1, hh)));
      this.world = { vw, vh, ox: (vw - 220) / 2, oy: vh - 240 - 6 };
      // physics bounds for the root offset (px,py): walls and how high the hand can lift him
      this.bounds = {
        minX: -(this.world.ox + 20),
        maxX: this.world.ox + 20,
        minY: -(this.world.oy - 6),
      };

      host.innerHTML = buildChief(config, this.scene, { world: this.world, roomProps: opts.roomProps });
      this.svg = host.querySelector("svg");
      this.grab = {
        root: this.svg.querySelector(".p-root"),
        squash: this.svg.querySelector(".p-squash"),
        figure: this.svg.querySelector(".p-figure"),
        head: this.svg.querySelector(".p-head"),
        tail: this.svg.querySelector(".p-tail"),
        shadow: this.svg.querySelector(".p-shadow"),
        pupilL: this.svg.querySelector(".p-pupilL"),
        pupilR: this.svg.querySelector(".p-pupilR"),
        lidL: this.svg.querySelector(".p-lidL"),
        lidR: this.svg.querySelector(".p-lidR"),
        eyeL: this.svg.querySelector(".p-eyeL"),
        eyeR: this.svg.querySelector(".p-eyeR"),
      };
      // jointed limbs (arms + legs) the loop can re-pose
      this.limbs = [];
      const collect = (sel, isArm) => {
        const g = this.svg.querySelector(sel);
        if (!g || !g.dataset || g.dataset.ax === undefined) return;
        this.limbs.push({
          g, isArm,
          ax: +g.dataset.ax, ay: +g.dataset.ay,
          cx0: +g.dataset.cx, cy0: +g.dataset.cy,
          ex0: +g.dataset.ex, ey0: +g.dataset.ey,
          side: +g.dataset.side || 1,
          phase: Math.random() * Math.PI * 2,
          segs: (g.querySelectorAll ? Array.from(g.querySelectorAll(".p-seg")) : []),
          end: g.querySelector ? g.querySelector(".p-end") : null,
        });
      };
      collect(".p-armL", true); collect(".p-armR", true);
      collect(".p-legL", false); collect(".p-legR", false);
      this.limbT = 0;   // 0 = posed at rest, 1 = full ragdoll

      /* physics state */
      this.px = 0; this.py = 0;       // root offset
      this.vx = 0; this.vy = 0;
      this.rot = 0; this.rotV = 0;
      this.sx = 1; this.sy = 1;       // squash
      this.mode = "grounded";          // grounded | held | airborne
      this.holdDX = 0; this.holdDY = 0;
      this.tx = 0; this.ty = 0;        // hold target

      /* eyes */
      this.lookX = 0; this.lookY = 0;         // current pupil offset (unit)
      this.lookTX = 0; this.lookTY = 0;       // target
      this.blink = 0;                          // 0 open .. 1 closed (transient)
      this.blinkTimer = 1.5 + Math.random() * 3;
      this.wanderTimer = 1;

      /* behaviour */
      this.energy = 0.5;               // 0 drowsy .. 1 buzzing
      this.sinceTouch = 0;
      this.tailPhase = 0;
      this.breathPhase = 0;
      this.petScore = 0;
      this.reversals = 0;
      this.lastDirX = 0;

      /* pointer */
      this.pointer = null;             // {x,y} svg coords, or null
      this.press = null;               // active press info
      this.lastTap = -1e9;

      this._bind();
      // rebuild the room on viewport changes (rotation, resize)
      if (typeof window !== "undefined" && window.addEventListener) {
        this._onResize = () => {
          clearTimeout(this._resizeT);
          this._resizeT = setTimeout(() => {
            if (!this.destroyed && this.cb.onResize) this.cb.onResize();
          }, 200);
        };
        window.addEventListener("resize", this._onResize);
      }
      this._lastT = (typeof performance !== "undefined" ? performance.now() : Date.now());
      this._raf = null;
      this._tickBound = () => this._frame();
      this._frame();
    }

    destroy() {
      this.destroyed = true;
      if (this._onResize && typeof window !== "undefined" && window.removeEventListener) {
        window.removeEventListener("resize", this._onResize);
      }
      if (this._raf) (typeof cancelAnimationFrame !== "undefined" ? cancelAnimationFrame : clearTimeout)(this._raf);
    }

    /* ---------- coordinate helpers ---------- */
    _svgPoint(e) {
      const r = this.svg.getBoundingClientRect();
      const w = r.width || 1, h = r.height || 1;
      return { x: (e.clientX - r.left) / w * this.world.vw, y: (e.clientY - r.top) / h * this.world.vh };
    }

    /* ---------- gestures ---------- */
    _bind() {
      const svg = this.svg;
      svg.style.touchAction = "none";
      svg.style.cursor = "grab";

      svg.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        try { svg.setPointerCapture(e.pointerId); } catch (err) { /* ok */ }
        const p = this._svgPoint(e);
        this.pointer = p;
        this.press = {
          id: e.pointerId, x0: p.x, y0: p.y, x: p.x, y: p.y,
          t0: this._now(), moved: 0, path: 0, vx: 0, vy: 0, lastT: this._now(),
        };
        this.reversals = 0; this.lastDirX = 0; this.petScore = 0;
        this._poke("down");
      });

      svg.addEventListener("pointermove", (e) => {
        const p = this._svgPoint(e);
        this.pointer = p;
        const pr = this.press;
        if (!pr || e.pointerId !== pr.id) return;
        const now = this._now();
        const dt = Math.max(1, now - pr.lastT);
        const dx = p.x - pr.x, dy = p.y - pr.y;
        pr.vx = dx / dt * 1000; pr.vy = dy / dt * 1000;
        pr.path += Math.hypot(dx, dy);
        pr.moved = Math.hypot(p.x - pr.x0, p.y - pr.y0);
        // tickle: rapid direction reversals
        const dirX = Math.sign(dx);
        if (dirX !== 0 && this.lastDirX !== 0 && dirX !== this.lastDirX && Math.abs(dx) > 2) this.reversals++;
        if (dirX !== 0) this.lastDirX = dirX;
        pr.x = p.x; pr.y = p.y; pr.lastT = now;

        if (this.mode !== "held") {
          if (pr.moved > 26 || (pr.moved > 14 && Math.abs(pr.vy) > 500)) {
            // picked up by the scruff
            this.mode = "held";
            this.holdDX = 0; this.holdDY = 34;   // hangs below the grab point
            svg.style.cursor = "grabbing";
            this._react("grab");
          } else if (this.reversals >= 4 && now - pr.t0 < 900) {
            this._tickle();
            this.reversals = 0;
          } else if (pr.path > 46 && pr.moved < 30 && now - pr.t0 > 350) {
            // slow strokes that stay on him = petting
            this.petScore += pr.path;
            pr.path = 0;
            this._pet();
          }
        }
        if (this.mode === "held") {
          // hold target relative to home, clamped inside the room so he can
          // never be dragged out of view
          const B = this.bounds;
          this.tx = Math.max(B.minX, Math.min(B.maxX, p.x - (this.world.ox + 110) + this.holdDX));
          this.ty = Math.max(B.minY, Math.min(0, p.y - (this.world.oy + 84) + this.holdDY));
        }
      });

      const up = (e) => {
        const pr = this.press;
        if (!pr || (e.pointerId !== undefined && e.pointerId !== pr.id)) return;
        this.press = null;
        this.svg.style.cursor = "grab";
        const now = this._now();
        if (this.mode === "held") {
          const speed = Math.hypot(pr.vx, pr.vy);
          if (speed > 620) {
            this.mode = "airborne";
            this.vx = Math.max(-60, Math.min(60, pr.vx * 0.022)); this.vy = Math.max(-58, Math.min(30, pr.vy * 0.045));
            this._react("throw");
          } else {
            this.mode = "grounded";
            this._react("drop");
          }
          return;
        }
        // tap family
        if (pr.moved < 10 && now - pr.t0 < 400) {
          if (now - this.lastTap < 340) {
            this.lastTap = -1e9;
            this._spin();
          } else {
            this.lastTap = now;
            // snap him out of a scene first, then pokes
            if (this.scene.pose !== "attentive" && this.cb.onSnap) {
              this.cb.onSnap();
              return;
            }
            this._poke("tap", pr.y0 - this.world.oy - this.py);
          }
        }
      };
      svg.addEventListener("pointerup", up);
      svg.addEventListener("pointercancel", up);
      svg.addEventListener("pointerleave", () => { if (!this.press) this.pointer = null; });
    }

    _now() { return (typeof performance !== "undefined" ? performance.now() : Date.now()); }

    /* ---------- reactions ---------- */
    _react(type) {
      this.sinceTouch = 0;
      this.energy = Math.min(1, this.energy + (type === "pet" ? 0.08 : 0.18));
      if (this.cb.onReact) this.cb.onReact(type);
    }

    _poke(kind, y) {
      if (kind === "down") { this.sy = 0.94; this.sx = 1.05; return; }
      // squash by where he was poked
      if (y !== undefined && y < 115) { this.sy = 0.8; this.sx = 1.16; }       // head boop
      else if (y !== undefined && y > 185) { this.sy = 1.12; this.sx = 0.92; } // toe poke: jump!
      else { this.sy = 0.82; this.sx = 1.14; }
      this.blink = 1;
      this._react(y !== undefined && y > 185 ? "toes" : "poke");
    }

    _spin() {
      this.rotV += 900;
      this._react("spin");
    }

    _tickle() {
      this.rotV += (Math.random() > 0.5 ? 1 : -1) * 260;
      this.sy = 0.86; this.sx = 1.1;
      this._react("tickle");
    }

    _pet() {
      if (this.petScore > 130) {
        this.petScore = 0;
        this._hearts();
        this._react("pet");
      }
    }

    _hearts() {
      // spawn two floating hearts above him
      const fx = this.svg.querySelector(".p-fx");
      if (!fx) return;
      const NS = "http://www.w3.org/2000/svg";
      for (let i = 0; i < 2; i++) {
        const el = (typeof document !== "undefined") ? document.createElementNS(NS, "path") : null;
        if (!el) return;
        const hx = 92 + Math.random() * 40, hy = 52 + Math.random() * 10;
        el.setAttribute("d", `M ${hx} ${hy} l -5 -6 a 3.4 3.4 0 0 1 5 -2.6 a 3.4 3.4 0 0 1 5 2.6 Z`);
        el.setAttribute("fill", "#d4587a");
        fx.appendChild(el);
        const born = this._now();
        const fade = () => {
          const age = (this._now() - born) / 1200;
          if (age >= 1 || this.destroyed) { el.remove(); return; }
          el.setAttribute("opacity", String(1 - age));
          el.setAttribute("transform", `translate(${Math.sin(age * 6 + hx) * 4} ${-age * 26})`);
          if (typeof requestAnimationFrame !== "undefined") requestAnimationFrame(fade); else setTimeout(fade, 16);
        };
        fade();
      }
    }

    /* ---------- the loop ---------- */
    _frame() {
      if (this.destroyed) return;
      const now = this._lastNow = this._now();
      const dt = Math.min(0.05, (now - this._lastT) / 1000);
      this._lastT = now;
      this.tick(dt);
      const raf = (typeof requestAnimationFrame !== "undefined") ? requestAnimationFrame : (f) => setTimeout(f, 16);
      this._raf = raf(this._tickBound);
    }

    tick(dt) {
      const g = this.grab;
      this.sinceTouch += dt;
      this.tailPhase += dt * (2.2 + this.energy * 7);
      this.breathPhase += dt * 1.8;
      this.energy = Math.max(0, this.energy - dt * 0.02);

      /* --- physics --- */
      if (this.mode === "held") {
        // critically-damped-ish spring to the hand
        const k = 140, d = 16;
        this.vx += ((this.tx - this.px) * k - this.vx * d) * dt;
        this.vy += ((this.ty - this.py) * k - this.vy * d) * dt;
        this.px += this.vx * dt; this.py += this.vy * dt;
        // pendulum sway from horizontal motion
        const rotT = Math.max(-26, Math.min(26, this.vx * 0.09));
        this.rot += (rotT - this.rot) * Math.min(1, dt * 10);
        // stretched from the scruff
        this.sy += (1.1 - this.sy) * Math.min(1, dt * 8);
        this.sx += (0.93 - this.sx) * Math.min(1, dt * 8);
      } else if (this.mode === "airborne") {
        this.vy += 115 * dt;             // gravity — floaty, cartoon arcs
        this.px += this.vx * dt * 32;
        this.py += this.vy * dt * 32;
        this.rot += this.vx * dt * 16;
        // walls of the room
        if (this.px < this.bounds.minX) { this.px = this.bounds.minX; this.vx = Math.abs(this.vx) * 0.6; }
        if (this.px > this.bounds.maxX) { this.px = this.bounds.maxX; this.vx = -Math.abs(this.vx) * 0.6; }
        if (this.py < this.bounds.minY) { this.py = this.bounds.minY; this.vy = Math.abs(this.vy) * 0.5; }
        // floor
        if (this.py >= 0) {
          this.py = 0;
          // settle threshold must exceed one frame of gravity, or damping
          // re-fills each frame and he micro-bounces forever
          if (Math.abs(this.vy) > 115 * dt + 2.2) {
            this.vy = -Math.abs(this.vy) * 0.52;
            this.vx *= 0.72;
            this.sy = 0.72; this.sx = 1.24;   // impact squash
            this._react("bounce");
          } else {
            this.mode = "grounded";
            this.vx = 0; this.vy = 0;
            this._react("land");
          }
        }
      } else {
        // grounded: spring home
        const k = 30, d = 8;
        this.vx += ((0 - this.px) * k - this.vx * d) * dt;
        this.vy += ((0 - this.py) * k - this.vy * d) * dt;
        this.px += this.vx * dt; this.py += this.vy * dt;
        this.rot += (0 - this.rot) * Math.min(1, dt * 6);
      }

      /* rotation impulse (spin/tickle) */
      if (Math.abs(this.rotV) > 0.5) {
        this.rot += this.rotV * dt;
        this.rotV *= Math.pow(0.0016, dt);   // decay
        if (Math.abs(this.rotV) < 24 && this.mode === "grounded") {
          // settle rotation to nearest full turn
          this.rot = this.rot % 360;
          if (this.rot > 180) this.rot -= 360;
          if (this.rot < -180) this.rot += 360;
          this.rotV = 0;
        }
      }

      /* squash spring back */
      this.sx += (1 - this.sx) * Math.min(1, dt * 9);
      this.sy += (1 - this.sy) * Math.min(1, dt * 9);

      /* --- eyes --- */
      // where's he looking? pointer if present, else idle wander
      if (this.pointer) {
        const hx = this.world.ox + 110 + this.px;
        const hy = this.world.oy + 84 + this.py;
        this.lookTX = Math.max(-1, Math.min(1, (this.pointer.x - hx) / 90));
        this.lookTY = Math.max(-1, Math.min(1, (this.pointer.y - hy) / 100));
      } else {
        this.wanderTimer -= dt;
        if (this.wanderTimer <= 0) {
          this.wanderTimer = 1.2 + Math.random() * 2.6;
          this.lookTX = (Math.random() * 2 - 1) * 0.6;
          this.lookTY = (Math.random() * 2 - 1) * 0.4;
        }
      }
      this.lookX += (this.lookTX - this.lookX) * Math.min(1, dt * 10);
      this.lookY += (this.lookTY - this.lookY) * Math.min(1, dt * 10);

      // blink
      this.blinkTimer -= dt;
      if (this.blinkTimer <= 0) { this.blink = 1; this.blinkTimer = 2.2 + Math.random() * 3.4; }
      if (this.blink > 0) this.blink = Math.max(0, this.blink - dt * 7);

      // drowsiness when ignored (only in plain idle scenes)
      const idlePose = ["attentive", "bored", "excited"].includes(this.scene.pose);
      const drowse = idlePose ? Math.max(0, Math.min(0.65, (this.sinceTouch - 18) / 26)) : 0;

      /* --- write transforms --- */
      if (g.root) g.root.setAttribute("transform", `translate(${this.px.toFixed(1)} ${this.py.toFixed(1)}) rotate(${this.rot.toFixed(1)} 110 150)`);
      if (g.squash) {
        const breathe = 1 + Math.sin(this.breathPhase) * 0.012;
        g.squash.setAttribute("transform",
          `translate(110 ${GROUND}) scale(${this.sx.toFixed(3)} ${(this.sy * breathe).toFixed(3)}) translate(-110 -${GROUND})`);
      }
      /* --- jointed limbs: they go ragdoll when he's carried or thrown,
             flail mid-air, and ease back to the pose on landing --- */
      const limbTarget = (this.mode === "held" || this.mode === "airborne") ? 1 : 0;
      this.limbT += (limbTarget - this.limbT) * Math.min(1, dt * (limbTarget ? 9 : 5));
      if (this.limbs.length) {
        if (this.limbT > 0.015) { this._poseLimbs(dt); this._limbsDirty = true; }
        else if (this._limbsDirty) { this._restLimbs(); this._limbsDirty = false; }
      }

      if (g.tail && this.scene.pose !== "sleep") {
        const bx = +g.tail.dataset.px || 140, by = +g.tail.dataset.py || 158;
        const wag = Math.sin(this.tailPhase) * (7 + this.energy * 9);
        g.tail.setAttribute("transform", `rotate(${wag.toFixed(1)} ${bx} ${by})`);
      }
      const lookPx = this.lookX * 4.6, lookPy = this.lookY * 4.2;
      if (g.pupilL) g.pupilL.setAttribute("transform", `translate(${lookPx.toFixed(1)} ${lookPy.toFixed(1)})`);
      if (g.pupilR) g.pupilR.setAttribute("transform", `translate(${lookPx.toFixed(1)} ${lookPy.toFixed(1)})`);
      // lids: base mood position + drowse + blink override
      const lids = [[g.lidL, g.eyeL], [g.lidR, g.eyeR]];
      for (const [lid, eyeEl] of lids) {
        if (!lid || !eyeEl) continue;
        const ry = +eyeEl.dataset.ry || 13.5;
        const baseLid = +lid.dataset.baseLid || (lid.dataset.baseLid = String(this._baseLid(ry)));
        const cover = Math.max(this.blink, Math.min(1, (+baseLid) + drowse));
        const y = -ry * 2 + cover * ry * 2;
        const m = lid.getAttribute("transform") || "";
        const rot = (m.match(/rotate\([^)]*\)/) || [""])[0];
        lid.setAttribute("transform", `translate(0 ${y.toFixed(1)}) ${rot}`);
      }
      // shadow tracks height when airborne/held
      if (g.shadow) {
        const lift = Math.max(0, -this.py) / 120;
        g.shadow.setAttribute("opacity", String(Math.max(0.08, 0.32 - lift * 0.2)));
        g.shadow.setAttribute("transform", `translate(${(this.px * 0.7).toFixed(1)} 0) scale(${Math.max(0.5, 1 - lift * 0.45).toFixed(2)} 1)`);
      }
    }

    _poseLimbs(dt) {
      this._limbPhase = (this._limbPhase || 0) + dt * (this.mode === "airborne" ? 15 : 6.5);
      const rotRad = -this.rot * Math.PI / 180;   // limbs hang toward world-down
      const t = this.limbT;
      const flail = this.mode === "airborne" ? 0.55 : 0.15;
      const sway = Math.max(-0.5, Math.min(0.5, this.vx * 0.004));
      for (const L of this.limbs) {
        const len = Math.hypot(L.ex0 - L.ax, L.ey0 - L.ay);
        const hang = Math.PI / 2 + rotRad + sway
          + Math.sin(this._limbPhase + L.phase) * flail
          + (L.isArm ? L.side * 0.14 : L.side * 0.05);
        const dex = L.ax + Math.cos(hang) * len;
        const dey = L.ay + Math.sin(hang) * len;
        const ex = L.ex0 + (dex - L.ex0) * t;
        const ey = L.ey0 + (dey - L.ey0) * t;
        // knee/elbow bows perpendicular to the chain, with a little life
        const mx = (L.ax + ex) / 2, my = (L.ay + ey) / 2;
        const pang = Math.atan2(ey - L.ay, ex - L.ax) + Math.PI / 2;
        const bow = (L.isArm ? 7.5 : 6) * L.side + Math.sin(this._limbPhase * 0.7 + L.phase) * 3.5;
        const qx = (L.cx0 + (mx + Math.cos(pang) * bow - L.cx0) * t);
        const qy = (L.cy0 + (my + Math.sin(pang) * bow - L.cy0) * t);
        const d = `M ${L.ax} ${L.ay} Q ${qx.toFixed(1)} ${qy.toFixed(1)} ${ex.toFixed(1)} ${ey.toFixed(1)}`;
        for (const p of L.segs) p.setAttribute("d", d);
        if (L.end) L.end.setAttribute("transform", `translate(${(ex - L.ex0).toFixed(1)} ${(ey - L.ey0).toFixed(1)})`);
      }
    }

    _restLimbs() {
      for (const L of this.limbs) {
        const d = `M ${L.ax} ${L.ay} Q ${L.cx0} ${L.cy0} ${L.ex0} ${L.ey0}`;
        for (const p of L.segs) p.setAttribute("d", d);
        if (L.end) L.end.setAttribute("transform", "");
      }
    }

    _baseLid(ry) {
      const pose = this.scene.pose;
      if (pose === "bored") return 0.52;
      if (pose === "sad" || pose === "lonely") return 0.38;
      if (pose === "sleep" || pose === "despair") return 1;
      return 0.06;
    }
  }

  /* ---------- exports ---------- */
  const api = {
    genConfig,
    render: (config, scene, opts) => buildChief(config, scene, opts),
    Rig,
    PROPS,
    HAT_COLS,
    HAT_NAMES: ["bucket hat", "cap", "beanie"],
  };
  if (typeof window !== "undefined") window.AlrightChief = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
