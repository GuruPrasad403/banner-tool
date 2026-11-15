# XYZ HTML Banner Validator and Automated Screenshot Generator

Production-grade internal automation tool for validating HTML/CSS/JavaScript banner dimensions and generating frame-accurate screenshots with nested Important Safety Information (ISI) scroll engine support.

---

## Key Features

1. **Fixed-Frame + Nested ISI Scroll Engine**
   - Captures the complete banner frame (e.g., 300x250, 320x480).
   - Preserves fixed header and body copy alignment across every screenshot.
   - Systematically scrolls nested ISI containers (`overflow-y: auto/scroll`) from `scrollTop: 0` to `maxScrollTop` with zero coverage gaps.
2. **5-Tier Section Detection Engine**
   - Priority 1: User explicit config (`rootSelector`, `fixedSelectors`, `isiSelector`)
   - Priority 2: Semantic HTML attributes (`data-banner-section="header|body|isi"`)
   - Priority 3: Configurable selector patterns (`#header`, `.isi`, etc.)
   - Priority 4: Heuristic DOM scan (`overflow-y`, `scrollHeight > clientHeight`, ISI text keyword matching)
   - Priority 5: Diagnostic candidate inspection with confidence scoring.
3. **Modular Validation Rule Engine**
   - Dimension checking (exact & tolerance-based matching for width/height)
   - Horizontal overflow & page clipping detection
   - Fixed region stability verification (header/body displacement checks)
   - 100% ISI scroll coverage verification
   - Missing local asset auditing (CSS, JS, images, fonts)
4. **Professional UI & CLI Automation**
   - Sleek dark theme dashboard with live metrics, upload zone, interactive frame modal, and report viewer.
   - Command-line interface (`npm run validate`, `npm run capture`) for CI/CD pipelines.

---

## Technology Stack

- **Backend**: Node.js (ES Modules `"type": "module"`), Express.js, Puppeteer, Chromium
- **Frontend**: React 18, Vite, Tailwind CSS, Lucide React
- **Testing**: Vitest, Puppeteer Integration Tests
- **Utilities**: Adm-Zip, Commander, Multer, Cors, Zod

---

## Installation & Setup

1. **Clone or Navigate to Project**:
   ```bash
   cd c:\Users\GuruPrasad\Downloads\banner
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```

3. **Start Development Server** (Runs Express API on 3001 & Vite UI on 3000):
   ```bash
   # Terminal 1: Backend Express Server
   npm start

   # Terminal 2: Frontend Vite Development UI
   npm run dev
   ```

4. **Access Dashboard**:
   Open browser at `http://localhost:3000`

---

## CLI Usage

### Validate Banner Dimensions & Structure
```bash
npm run validate -- \
  --input ./fixtures/sample-banner-300x250/index.html \
  --width 300 \
  --height 250 \
  --root "#banner" \
  --isi "#isi-container"
```

### Capture Screenshots & Generate Reports
```bash
npm run capture -- \
  --input ./fixtures/sample-banner-300x250/index.html \
  --profile mobile-small \
  --output ./output \
  --scale 2 \
  --overlap 10 \
  --animation-delay 2000
```

---

## Capture Options

### Animation Delay (`animationDelay`)

Animated banners need time to play or finish their entrance animation before
being photographed; capturing at the fixed render-settle moment alone can
catch them mid-animation. The **animation delay** is an extra wait (in
milliseconds) applied once per job — after the page has loaded and rendering
has settled, and before the first screenshot is taken. Scroll steps are not
affected (they use the existing scroll-settle delay).

- **Default:** `2000` ms (`DEFAULT_CONFIG.defaultTimeouts.animationDelay` in
  `src/config/defaults.js`)
- **Dashboard:** "Animation Delay (ms)" field next to Device Scale Factor /
  Scroll Overlap
- **REST API:** `animationDelay` in the job config (create-job form field or
  the `config` object sent to the validate/capture endpoints)
- **CLI:** `--animation-delay <ms>` on both `validate` and `capture`
- Set to `0` to disable the extra wait. The value used for a job is recorded
  in `screenshot-manifest.json` under `captureSettings.animationDelayMs`.

### Slides-First Flow (`slidesDuration`)

Multi-slide banners follow a stricter capture order (the slides-first flow),
driven by the **slides duration** — the total time (in milliseconds) the
banner's slides need to play one full cycle:

1. The banner loads and the ISI container is pinned to `scrollTop 0`.
2. **All slides play fully** for `slidesDuration` ms — during this playback
   the ISI does **not** scroll (its `scrollTop` is sampled during the wait
   and logged as evidence).
3. When the slides finish, the banner is **frozen on the first slide**:
   every Web Animation is paused at `currentTime 0`, and a GSAP global
   timeline, if present, is paused at time 0 (best effort — if no animation
   can be frozen, a warning is logged and recorded in the manifest instead
   of silently pretending the freeze worked).
4. **Only then** does the ISI scroll, and screenshots are captured with the
   first slide held in the fixed frame throughout.

- **Default:** `0` ms = off (`DEFAULT_CONFIG.defaultTimeouts.slidesDuration`
  in `src/config/defaults.js`); behaviour is unchanged when unset.
- **Dashboard:** "Slides Duration (ms) — all slides play first, ISI scrolls
  after" field next to Animation Delay
- **REST API:** `slidesDuration` in the job config (create-job form field or
  the `config` object sent to the validate/capture endpoints)
- **CLI:** `--slides-duration <ms>` on both `validate` and `capture`
- The value used is recorded in `screenshot-manifest.json` under
  `captureSettings.slidesDurationMs`, together with the freeze result under
  `captureSettings.slidesFreeze` (`animationsFound` / `animationsPaused`,
  GSAP flags, and any warning).

---

## REST API Documentation

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/profiles` | List all configured banner profiles |
| `POST` | `/api/jobs` | Create validation job from uploaded HTML/ZIP or local path |
| `GET` | `/api/jobs/:jobId` | Get job metadata and status |
| `POST` | `/api/jobs/:jobId/validate` | Execute section detection and dimension validation |
| `POST` | `/api/jobs/:jobId/capture` | Execute nested ISI scrolling and screenshot generation |
| `GET` | `/api/jobs/:jobId/report` | Retrieve `validation-report.json` |
| `GET` | `/api/jobs/:jobId/screenshots` | Retrieve screenshot image list and summary URLs |

---

## Output Structure

```
output/
└── job_1727110000000_a1b2c/
    ├── validation-report.json
    ├── screenshot-manifest.json
    ├── summary.html
    └── screenshots/
        ├── 01-frame-isi-001.png
        ├── 02-frame-isi-002.png
        ├── 03-frame-isi-003.png
        └── 04-frame-isi-004.png
```

---

## Running Automated Tests

```bash
npm test
```

Executes:
- Unit tests for screenshot scroll planning, position calculations, path safety, and validation rules.
- End-to-end integration tests launching Puppeteer on banner test fixtures.

---

## Security Safeguards

- Zip extraction strictly enforces path traversal sanitization to prevent directory escape (`..`).
- Input processing uses isolated temporary directories cleaned up automatically.
- No arbitrary remote filesystem execution allowed through API parameters.
