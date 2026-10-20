# robhelsby.com

Personal site for Rob Helsby, Strategy & Experience Director, trading as Beyond the Studio Ltd.

A single, hand-built page: plain HTML, CSS and JavaScript with no framework and no build step. Edit a file, push it, and Netlify deploys it.

---

## What's in the repo

```
robhelsby-site/
├── index.html          The whole page
├── styles.css          All styles
├── script.js           All behaviour (slideshow, nav, carousels, etc.)
├── 404.html            "Page not found" page
├── _redirects          Netlify: old .co.uk domains → robhelsby.com
├── _headers            Netlify: caching and security headers
├── robots.txt          Lets search engines in, points to the sitemap
├── sitemap.xml         The one page, for search engines
├── fonts/
│   ├── PolySans-SlimWide.woff     Body text (weight 300)
│   └── PolySans-RelaxWide.woff    Emphasis (weight 500)
└── assets/images/
    ├── hero/           Hero slideshow
    ├── logos/          Client logos (ticker + case studies)
    ├── work/           Case study media, one folder per client
    ├── about/          Portrait + headshots/ (hover medley frames)
    ├── testimonials/   Testimonial photos
    └── site/           Footer glow, favicons, link-preview image
```

Paths in the code start with `/` (e.g. `/assets/images/hero/rh_hero_01.webp`), so they only work when the site is served from a web address: Netlify, staging, or a local server (see below). Opening `index.html` straight from your computer won't load everything.

---

## Previewing locally

From the repo folder:

```
python3 -m http.server 8000
```

Then open http://localhost:8000.

---

## Common updates

All of these are edits to `index.html` unless stated.

### Availability line
Search for `Taking on new clients for`. It sits above the hero headline.

### Hero slideshow
- **Files:** `assets/images/hero/rh_hero_01.webp` to `rh_hero_05.webp`, plus a `-1200` version of each (e.g. `rh_hero_01-1200.webp`) for phones.
- **Slide order:** the order of the `<img class="hero__slide">` tags. The first one uses `src`; the rest use `data-src` so they load one at a time.
- **Crop on phones:** `--focus: 72% 30%` on each image. This is the point the crop centres on (horizontal, then vertical). Move it towards the subject.
- **Timing:** in `script.js`, `INTERVAL_MS` (6 seconds) and `FADE_MS` (2.4 seconds; keep it in step with `--slide-fade` in `styles.css`).
- **Grade:** in `styles.css`, `--slide-filter` controls the greyscale and darkening.

### Client logos (ticker)
- **Files:** white on a transparent 160×107px canvas, in `assets/images/logos/`.
- **Order:** the order of the `<li class="ticker__item">` tags.
- **Optical size:** `style="--s: 0.83"` shrinks a heavy logo and `1.15` enlarges a light one. Leave it off for 1.
- **Speed:** in `script.js`, `TICKER_SPEED` (pixels per second).

### Case studies
Each case study is an `<article class="case">`. To change its media:

1. Export the image at **1600×900** and at **960×540**, as WebP, roughly 100–200KB and 30–90KB respectively. Name them `client-NN.webp` and `client-NN-960.webp` (e.g. `army-06.webp` and `army-06-960.webp`) and add them to that client's folder in `assets/images/work/`.
2. Copy an existing `<figure class="carousel__slide">` line and update the file names and the `alt` text, which should describe what the image shows.
   - **First slide in a carousel:** use `src` / `srcset`.
   - **Every other slide:** use `data-src` / `data-srcset`, so it loads only when needed.

The dots under each carousel are generated automatically from the number of slides.

**Video slides:** MP4 (H.264), 1280×720 or 1600×900, 5–30 second loops, no audio, ideally under 4MB, plus a 1600×900 poster image named `client-NN-poster.webp`. Videos play muted, only while their slide is showing. To strip audio and make a video start faster:

```
ffmpeg -i input.mp4 -c:v copy -an -movflags +faststart client-NN.mp4
```

**Case study logos** reuse the white ticker logos; the code recolours them to dark green, so there's no need for separate files.

### Headshot medley (hover on the portrait)
- **Files:** `assets/images/about/headshots/headshot-01.webp` to `headshot-24.webp`, 480×480.
- **To add or remove frames:** edit the `data-frames` list on `.portrait__reveal`.
- **Speed:** in `script.js`, `FRAME_MS` (0.5 seconds per face).

### Portrait and testimonial photo
- **Portrait:** `assets/images/about/portrait.webp`, 600×600.
- **Testimonial:** `assets/images/testimonials/<name>.webp`, 240×240.
- **Preparing the files:** export them clean, in colour or black and white. The two-colour dither is added in code (`--dither-ink`, `--dither-paper`, `--dither-gamma` and `--dither-static` in `styles.css` set the colours, brightness and how much the static moves).

### Services, prices and FAQs
- **Services:** the copy is in the `#services` section. Prices also appear in the FAQ answer "What is your pricing?", so update both.
- **FAQs:** each is a `<details class="faq__item">`. Copy one to add a question; the numbers are typed by hand, so renumber them after adding or removing one.

### Contact
- **Email:** appears in `href="mailto:…"` and `data-copy-email="…"` on `.contact__email`. Change both.
- **Calendly:** the link is in two places, the contact section and the last FAQ answer. `href` is the plain link (the fallback). `data-calendly` is the pop-up version with the site's colours.

### Colours and type
- **Tokens:** at the top of `styles.css` under `:root`:
  - `--ink` is the dark background.
  - `--paper` is the pink.
  - `--forest` is the text on pink.
  - `--green` is the accent.
- **Content column:** starts at column 5 of 12 on desktop, set by `--content-start`.

---

## Performance notes

- **After changing `styles.css` or `script.js`:** bump the `?v=` date at the end of their links in `index.html` (e.g. `?v=2026-10-16b` to `?v=2026-10-20`). That makes every browser fetch the new version instead of reusing a cached one.

Please keep these habits; they're why the page is fast.

- **Image formats and sizes:** use WebP and stick to the sizes above. Don't upload images straight from a design tool or camera.
- **Responsive versions:** every hero and case study image has a smaller version for phones (`-1200` / `-960`). Add both when adding an image.
- **Lazy loading:** anything below the first screen loads only when it's needed (the `data-src` pattern). Keep new slides on that pattern.
- **Caching:** `_headers` tells browsers to keep fonts for a year and images for a week. If you replace an image but keep its file name, returning visitors may see the old one for up to a week. Give it a new name (e.g. `army-02b.webp`) if it needs to change immediately.

---

## Accessibility

- **Text alternatives:** every case study image needs meaningful `alt` text. Decorative images (hero slides, headshot frames) use `alt=""` on purpose.
- **Reduced motion:** all motion respects the reduced-motion setting. The slideshow, ticker, zoom, photo static and marker loops either stop or stay still.
- **Pause control:** the button at the bottom right of the hero pauses the slideshow and ticker.

---

## Before launch

- [ ] Add the registered office address to the footer (Companies House requirement).
- [ ] Re-export the portrait at 600×600 and Claudia's photo at 240×240, keeping the same names.
- [ ] Check both case study videos play on iPhone Safari and desktop Chrome.
- [ ] Delete unused files: `assets/fav/`, `assets/images/rh-opengraph.jpg`, `assets/images/site/footer-glow.png`, `assets/images/about/headshots/rh-medley.gif`, and the placeholder files `gdgd` and `ysgs`.
- [ ] Check the link preview with LinkedIn's Post Inspector after launch.
