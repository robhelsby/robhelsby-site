# Rendering the chief — pipeline options

Brief: match the reference art perfectly, at higher quality than the procedural SVG, and
find an alternative to Midjourney. This note separates the two things "Midjourney" was doing
and recommends a tool for each, then shows how they slot into the existing code.

## Two layers, don't conflate them

| Layer | Job | Midjourney's role | The problem |
|---|---|---|---|
| **Generation** | *Make* the character art | This is all MJ did | **Midjourney has no public API** — can't be called from a product |
| **Runtime** | *Display & animate* it in the app (idle → activity → poke → drag) | — | Static images can't pose/react; our SVG can but isn't on-model enough |

The chief needs both: on-model art, and a way to show him sleeping / on the bike / snapping
to attention when tapped. Pick a tool per layer.

## What's shipped now (prototype)

The reference sheets you supplied **are** a sprite atlas of exactly the states the engine
needs — the hobby sheets are activities, the mood sheets are an emotional ladder. So the
prototype now renders the chief from the **actual reference art**, background-keyed to
transparent PNGs in `assets/chief/` (22 sprites: 13 moods + 9 hobbies). This is the
highest-fidelity option available immediately because it *is* the reference.

`buddyVisual()` already resolves in priority order — **plugged-in render → reference sprite →
generative SVG fallback**. A production renderer (below) is a fourth tier dropped into the
same function; nothing else changes.

Limitations of static sprites: one fixed character (no per-dad variation in height/colour),
and only the ~22 captured states. That's what the production options solve.

## Runtime rendering — recommendation: **Rive**

| Tool | Tech | Fit for the chief | Notes |
|---|---|---|---|
| **Rive** ✅ | Vector + **state machine**, WASM/WebGL/Canvas | **Best.** Built for interactive characters: one artboard, inputs like `mood` (0–1), `activity` (enum), triggers `poke`/`grab`. Maps 1:1 onto our scene engine. | ~100KB runtime, 60fps, tiny files, runs in RN too. Design in the Rive editor. |
| **PixiJS** | WebGL 2D | Great if we have many sprites/particles or spritesheet animation; we'd hand-build the state logic | Mature, fast; more glue code than Rive |
| **Lottie** | Vector playback (After Effects/Bodymovin) | Good for scripted loops (sleeping, whistling) | **Not** a state machine — awkward for interactive poke/drag/branching |
| **Spine / DragonBones** | 2D skeletal mesh | Excellent squash-and-stretch dangle; game-grade | Licensing (Spine) / heavier toolchain |
| **Three.js / Babylon** | WebGL **3D** | Wrong tool — the style is flat 2D sticker art; 3D adds weight and a look we don't want | Only if the brand pivots to 3D |
| **Unity / Godot (WASM)** | Game engine → WebGL | Massive overkill: multi-MB payloads, slow cold start, awkward DOM/React integration | Not for a 5-minutes-a-day wellbeing app |

**Why Rive wins here:** the chief is a small interactive character with a handful of moods,
a set of activities, and direct manipulation (tap/drag). That is precisely Rive's state-machine
model. One `.riv` file (tens of KB) replaces 22 PNGs, animates between states, scales
crisply, and exposes inputs we already compute: feed `balanceScore()` into a `mood` input and
the artboard morphs from despair → content → in love; set an `activity` enum from
`learnedActivities()`; fire a `poke` trigger on tap.

```js
// Sketch — the 4th tier in buddyVisual(), same shape as the others:
import { Rive } from "@rive-app/canvas";
const r = new Rive({ src: "chief.riv", canvas, stateMachines: "Chief", autoplay: true });
r.on("load", () => {
  const i = r.stateMachineInputs("Chief");
  i.find(x => x.name === "mood").value = balanceScore();      // 0..1 → expression
  i.find(x => x.name === "activity").value = activityEnum();   // idle/gym/bike/...
});
canvas.addEventListener("click", () => i.find(x => x.name === "poke").fire());
```

## Generation — the actual Midjourney alternatives (these have APIs)

To generate **per-dad** chiefs on-model (vary hat/build/theme, per the earlier brief) without
a human in Midjourney:

| Option | API | How to stay on-model | Use when |
|---|---|---|---|
| **SDXL / FLUX + a LoRA** via **Fal.ai** or **Replicate** ✅ | Yes (REST) | Train a small LoRA on the reference sheet (~20–40 crops) so every generation is the chief. Prompt the variation (hat, colour, activity). | Unique avatar per user, generated server-side at signup |
| **Stable Diffusion (self-host)** | Yes (your infra) | Same LoRA approach; full control, no per-image cost | Volume / privacy / cost control |
| **One-time illustrated set + Rive rig** ✅ | n/a | An illustrator draws the canonical chief once; rig in Rive; variation via runtime colour/scale params | Highest quality, fully consistent, no model drift — pairs perfectly with the Rive recommendation |
| OpenAI `gpt-image` / Google Imagen | Yes | Harder to pin to an exact character without fine-tuning | Quick concepting, not production consistency |

**Recommended production pairing:** illustrate the chief once → build a **Rive** rig with
`mood` / `activity` inputs and runtime colour/height params for variation → drive it from the
engine already in this prototype. Reserve SDXL-LoRA (via Fal/Replicate) for the
"generate-a-unique-render-at-signup" path if per-dad bespoke art is wanted. Keep the bundled
reference sprites as the zero-dependency fallback.

The Midjourney-prompt button in the side panel remains useful for **concepting** new
states/variants offline; the resulting image can be plugged straight in via the "Use as chief"
field (the first render tier).
