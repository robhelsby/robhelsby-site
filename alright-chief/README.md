# Alright Chief — first-pass prototype (v0.1)

A clickable prototype of the **Still Me** app concept, named **Alright Chief** for this version.
Built from the Still Me workshop brief (Beyond the Studio) with the Alright Chief strategy doc
setting the wider tone and positioning.

> A transition app for new dads who want to feel like themselves while becoming the father
> their family needs.

## Run it

It's a static site — no build step, no dependencies.

```sh
# from the repo root
python3 -m http.server 8000
# open http://localhost:8000/alright-chief/
```

Or deploy with the rest of the site; it lives entirely under `/alright-chief/`.

## What's in the prototype

Mapped to the product shape in the workshop brief:

1. **Onboarding — conversational, one question at a time.** Three "dad admin" questions
   (baby's age, first/second, who's at home), then the pivot to three genuinely personal
   questions (the old Saturdays, what he misses, what he loved). Voice-first input with a
   text fallback (see below).
2. **Character — the chief.** Rendered from the **actual reference art** (background-keyed
   sprites in `assets/chief/`): bean-shaped matte-black body, white oval eyes, purple mitten
   hands, hatted. 22 sprites — a mood ladder (despair → content → in love) and nine hobbies.
   A generative SVG version is the fallback (toggle in the side panel) and powers the
   Midjourney-prompt path. See `RENDER_PIPELINE.md` for the production options (Rive / WebGL /
   SDXL) and why a 3D game engine is the wrong tool for this flat 2D style.
3. **Daily submission — The Balance.** One entry a day: one thing lost, one thing gained.
   Not scored, no streaks. Spoken by default, typed if preferred.
4. **The Balance ledger.** Two columns filling over time, deliberately never equal.
5. **Observe / interact.** The chief listens to everything the dad tells the app —
   onboarding answers and both ledger columns — and learns activities from it (gym,
   five-a-side, the bike, vinyl, a quiet pint, films, gaming, reading, fishing, coffee,
   golf, cooking, running). When you visit he's usually mid-something: one of *your*
   activities with its prop, or a generic idle — standing about bored, asleep on his
   feet, whistling. **Tap him to snap him out of it** (startled "!", deadpan line),
   then interactions are Oddballz-style: tap to poke, double-tap to spin, press-and-drag
   to pick him up by the scruff — he dangles and sways, then drops back with a bounce.
6. **Insights.** After a few entries the app starts reflecting the ledger back —
   "a mirror, not a notification."
7. **Progress — the transition made visible.** A progress engine tags every ledger entry by
   theme and tracks how the lost-column complaints (missing nights out, sleep, training, time
   to himself) fade while the gained-column reflections (connection, patience, presence,
   purpose, partnership) grow. This drives three things: a **welcome-back message** on the
   Today screen that quantifies the shift ("Six weeks ago *going out* was in your lost column
   most weeks — lately, not once. Meanwhile the gained side keeps turning up things like…"),
   a **balance meter**, and **push notifications** (Web Notifications API; enable + fire a
   nudge from the side panel). The chief's resting **mood sprite** is chosen by the same
   balance score — he literally looks more settled as the dad becomes more balanced. Claude
   rewrites the welcome line and nudges live when connected.
8. **The 5-minute rule, privacy-first** — no social layer, all data in `localStorage`.

## Voice-first input

The lost/gained check-in and the personal onboarding questions default to a **tap-to-talk
voice interface** built on the browser's Web Speech API (`SpeechRecognition`, `en-GB`):

- Tap the mic, say it, watch the live transcript land; tap again to stop, add more, or send.
- **Editing a misheard entry:** an &times; button on the transcript (and the text field)
  wipes it, or just say **"let's reset"** and the entry clears verbally.
- **"Rather type it?"** switches to the text input (and **"Say it instead"** switches back) —
  text is a fully considered fallback, not a consolation prize. The last-used mode is
  remembered.
- If speech recognition isn't supported (e.g. Firefox) or mic access is denied, the
  component falls back to text automatically. Voice works best in Chrome/Edge/Safari over
  HTTPS or localhost.

## LLM language interface (Claude)

The conversational voice is designed to be generated live by Claude. The prototype calls the
Claude Messages API (`claude-opus-4-8`) **directly from the browser** using the
`anthropic-dangerous-direct-browser-access` CORS opt-in — fine for a prototype; in production
this goes through a thin backend so the key never ships to the client.

- Connect a key in the **side panel** (desktop). It's stored in `localStorage` only.
- LLM-powered moments, each with an instant scripted fallback (the prototype fully works
  without a key):
  - **Onboarding acknowledgements** — Claude reacts to what the dad actually wrote before
    the next question.
  - **Post-check-in reflection** — a closing line generated from today's lost/gained pair.
  - **Insights** — generated from the whole ledger + profile, cached once per day.
- The voice is constrained by a system prompt encoding the brand: British, older-brother,
  warm-not-soft, no wellness language, no cheerleading, one or two sentences max.

## Avatar pipeline (Midjourney)

Midjourney has no public API, so the pipeline is structured as:

1. The app **composes a bespoke Midjourney prompt** in the house character style —
   bean-shaped matte-black mascot, white oval eyes, purple mitten hands, his generated
   hat and theme — caught doing an activity learned from the dad's own answers.
   *Copy it from the side panel.*
2. The prompt is rendered in Midjourney (design partner / batch job in production).
3. The resulting image is **plugged back in as the buddy** — paste the image URL in the
   side panel and it replaces the SVG everywhere (reveal, home, buddy screen).

The procedural SVG creature is the live in-app stand-in so the experience is complete
without the render.

## Prototype controls (side panel, desktop)

- **Load demo data** — a "month three" account (profile, named buddy, 12 ledger entries)
  so insights and the ledger can be seen without 12 real days.
- **Reset prototype** — wipes all local state.

## Files

| File | Purpose |
|---|---|
| `index.html` | Phone frame + side panel |
| `styles.css` | All styling (Bricolage Grotesque display / Inter body, dark warm palette) |
| `app.js` | State, screens, generative buddy, LLM layer, Midjourney pipeline |
