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
   questions (the old Saturdays, what he misses, what he loved). Voice-first is signposted;
   text is the working input.
2. **Character generation — the buddy.** A generative, non-human creature seeded from the
   dad's own answers (procedural SVG: body shape, palette, eyes, sprouts all vary). Named by
   the user; "spin up another" re-rolls.
3. **Daily submission — The Balance.** One entry a day: one thing lost, one thing gained.
   Not scored, no streaks.
4. **The Balance ledger.** Two columns filling over time, deliberately never equal.
5. **Observe / interact.** The buddy has its own quiet life doing lost-column things
   vicariously; poke it for small, low-stakes reactions.
6. **Insights.** After a few entries the app starts reflecting the ledger back —
   "a mirror, not a notification."
7. **The 5-minute rule, privacy-first** — no social layer, all data in `localStorage`.

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

1. The app **composes a bespoke Midjourney prompt** from the dad's onboarding answers —
   fixed art direction (non-human, fantastical, plucky charm, no race/body/age baggage,
   warm charcoal + amber world) with the personal material varying per dad.
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
