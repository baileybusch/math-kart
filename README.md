# 🏎️ Math Kart - Racing & Learning Game

A kart racing game that teaches math through fun gameplay! Pick **Grade 3** (add, subtract, × ÷, units) or **Grade 7** (similar figures, scale factor, proportions), race go-karts, solve math problems at checkpoint stars, earn coins, and unlock upgrades.

## 🎮 PLAY NOW!

**🌐 Live Game (iPad/Browser):** https://baileybusch.github.io/math-kart/

> **Targets old iPad mini / iOS 12 Safari.** The primary device is an
> iPad mini 2 (A1489) that can't update past iOS 12. The production build is
> transpiled for Safari 11+/iOS 11+, uses the Canvas renderer on old iOS, and
> shows a readable "Math Kart couldn't start" card instead of a blank screen
> if anything goes wrong. It works on new phones, tablets and desktops too.

**Getting the latest version on the iPad:** open
`https://baileybusch.github.io/math-kart/?v=4` (any number you haven't used yet; use `?v=5` next time). If it still
looks old, go to Settings → Safari → Advanced → Website Data, delete
"github.io", and reopen. See [QUICKSTART.md](QUICKSTART.md) for more.

## 📱 Made for iPad

- **Big touch pedals**: steer ◀ ▶ bottom-left, GO / BRAKE bottom-right (multi-touch)
- **Big answer buttons and a big number keypad** (with `.`, `/` and ← backspace) in the Math Stop
- **Fixed 4:3 layout** that fills an iPad and scales down to fit phones and desktops
- **Works offline-friendly**: system fonts only, no external assets
- Keyboard controls on desktop

## 🎮 How to Play

### Quick Start (One Command)
```bash
npm install && npm run dev
```

Then open the URL shown (usually `http://localhost:5173/math-kart/`).

### Gameplay
1. **Menu**: tap **Grade 3** or **Grade 7** (the orange one is picked and is
   remembered next time), pick a track card, tap **START RACE**
2. **Race**: 2 laps. Follow the yellow arrow to the yellow ⭐ stars (3 per lap)
3. **Math Stop** at each star: everyone pauses while you answer. Some
   questions have answer buttons; others (about half in Grade 3, most in
   Grade 7) need the number typed on the keypad, then **CHECK**.
   - **SHOW HINT** reveals a helpful step (like "Scale factor = 20 ÷ 8 = 2.5")
     but costs half the reward.
   - After answering you see the coin change in green or red, plus the
     right answer and the working if you missed. Tap **KEEP RACING** (or wait).

   | Result | Coins |
   | --- | --- |
   | Right, no hint | **+6** |
   | Right, after a hint | **+3** |
   | Wrong, after a hint | **−4** |
   | Wrong, no hint (a guess) | **−8** |

   Coins never go below 0. Guessing loses coins on average, even on YES/NO
   questions, so reading the hint always beats a blind guess.
4. **Finish**: cross the checkered line after lap 2
   - 🥇 1st place: 50 coins
   - 🥈 2nd place: 30 coins
   - 🥉 3rd place: 15 coins
5. **Shop**: spend coins on
   - Speed upgrades (30 coins each, max 5 levels)
   - Steering upgrades (30 coins each, max 5 levels)
   - Desert Canyon track unlock (100 coins)
   - Kart paint (20 coins each)

### Controls
- **iPad/Tablet**: on-screen pedals (hold GO with one thumb, steer with the other); **II** pauses
- **Desktop**: Arrow Keys or WASD
- **Math Problems**: tap the answer button, or type on the keypad and tap CHECK (desktop: number keys, `.` `/`, Backspace, Enter)

## 🧮 Math Content

Pick the grade on the menu. Every problem is generated fresh each time.

## Grade 3

Three packs, mixed randomly at every star. About half are multiple choice
and half are typed on the keypad.

### 1. Addition & Subtraction with Units
- Simple addition (2-digit numbers)
- Simple subtraction
- Liquid volume conversions (mL ↔ L)
- Mass conversions (g ↔ kg)
- Length conversions (m ↔ cm)

### 2. Multiplication Facts (Beginner)
- Basic times tables (2-5 × 2-10)
- Multiply by 2, 5, 10

### 3. Division Facts (Beginner)
- Basic division (no remainders)
- Divide by 2, 5, 10

**Difficulty**: Gentle early-year 3rd grade level.

## Grade 7: Similar Figures

Modeled on a 7th-grade "Similar Figures" homework worksheet (7.2.8.B):

- **Similar or not?** Two triangles or two rectangles (sometimes one is
  turned on its side). YES / NO buttons. The hint lists the side ratios to
  compare; after answering, the working shows every ratio.
- **Find x** (typed): similar rectangles, right triangles, parallelograms and
  L-shapes with one missing side. The hint gives the scale factor.
- **Word problems** (typed): desks, photos, pools, kites, gardens, screens:
  "The student's desk is 30 in long and 18 in wide. The teacher's desk is
  similar and 50 in long. How wide is it?"
- **Is the drawing similar?** Flags, banners, posters and postcards (YES/NO).
- **Scale** (typed): maps (1 cm = 20 km), floor plans and 1-to-24 toy cars.

Scale factors are often clean decimals (1.5, 2.5, 1.8, 1.2) and about a
third of the non-whole answers repeat (like 20/3). Typed answers:

- Whole numbers and short decimals must be exact (`15`, `14.4`, `2.5`).
- Repeating answers accept the fraction (`20/3`) or a decimal with at least
  one place that is rounded or cut off: `6.7`, `6.6`, `6.67`, `6.66`, `6.667`
  are all right for 20/3; `7` and `6.5` are not.

## 🔧 Development

### Requirements
- Node.js 18+ (CI uses 20)
- Google Chrome or Chromium for the smoke test (set `CHROME_PATH` if it isn't in a standard place)

### Commands
```bash
npm install            # install dependencies (node_modules is git-ignored)
npm run dev            # dev server
npm run build          # production build -> dist/
npm run preview        # serve dist/ locally
npm run check:legacy   # assert dist/ JS is safe for iOS 12 Safari
npm run test:unit      # check generated math, typed-answer rules and coin rules (no browser)
npm run test:smoke     # boot dist/ in headless Chrome and play through it
npm test               # test:unit + build + check:legacy + test:smoke
```

### How the old-iPad build works
- `vite.config.js` uses `@vitejs/plugin-legacy` with `renderModernChunks: false`,
  so **every** browser gets one Babel-transpiled bundle (SystemJS + core-js
  polyfills, targets `defaults, safari >= 11, ios_saf >= 11`). There is no
  `<script type="module">` path; iOS 12 Safari would otherwise pick the
  modern chunk, which Vite's minifier fills with `??` / `?.`.
- `npm run check:legacy` tokenizes every shipped `.js` file and fails if it
  finds a `?.` or `??` token, requires all shipped JS to parse as ES2017, and
  requires the inline boot script in `index.html` to be ES5.
- `src/boot.js` picks the renderer: **Canvas** on iOS ≤ 12 or when WebGL is
  missing, `AUTO` elsewhere, and falls back to Canvas if WebGL fails at boot
  or loses its context. Override with `?renderer=canvas|webgl|auto`.
- `index.html` has an inline ES5 watchdog that shows "Math Kart couldn't
  start" plus a reason if a script fails to parse or download, or if the game
  hasn't reached the menu after 45 seconds.
- GitHub Actions (`.github/workflows/deploy.yml`) runs the unit test, legacy
  check and smoke test before every Pages deploy; `ci.yml` runs them on pull
  requests.

## 📦 Adding New Math Packs

Math code in `src/math/` has no Phaser dependency (use the helpers in
`random.js`), so `npm run test:unit` can check it in Node. A generator returns:

```javascript
{
    question: '12 × 3 = ?',
    answer: '36',                 // string; must be one of choices
    choices: ['33', '36', '39'],  // for multiple choice
    hint: 'Skip-count by 12 three times.',   // a step, not the answer
    explain: '12 × 3 = 36'        // shown after answering
}
```

For typed-only problems set `input: 'number'`, `answerValue: 36`,
`answerText: '36'` and optionally `unit: 'in'`, `allowFraction: true` and
`diagram: { shapes: [...] }` (see `src/ui/shapeDiagram.js`).

- **Grade 3 pack**: add it to `PACKS` in `src/math/mathPacks.js`.
  `getMixedProblem()` picks from every registered pack and `grades.js`
  shows about half of them on the keypad.
- **New grade**: add an entry to `GRADES` in `src/math/grades.js` and a
  branch in `getProblemForGrade()`. The menu picker lists every grade.

## 🗂️ Project Structure

```
math-kart/
├── index.html                  # Page shell + ES5 boot watchdog / error card
├── vite.config.js              # Legacy (iOS 12) build config
├── scripts/
│   ├── check-legacy-bundle.mjs # No ?. / ??, ES2017-only output check
│   ├── smoke-test.mjs          # Headless Chrome play-through (iPad iOS 12 profile)
│   └── unit-test.mjs           # Node checks of generated math and coin rules
├── src/
│   ├── main.js                 # Phaser config + boot
│   ├── boot.js                 # Renderer choice, Canvas fallback, boot status
│   ├── ui/
│   │   ├── theme.js            # Fonts, colors, buttons, kart drawing
│   │   ├── mathStop.js         # Math Stop modal: keypad, choices, hint, coin banner
│   │   └── shapeDiagram.js     # Labeled shape diagrams for Grade 7
│   ├── scenes/
│   │   ├── MenuScene.js        # Grade picker, track cards, START RACE, SHOP
│   │   ├── RaceScene.js        # Driving, laps, checkpoints, AI
│   │   ├── RaceHudScene.js     # HUD, touch pedals, Math Stop, pause, results
│   │   └── ShopScene.js        # Upgrades, paint, track unlock
│   ├── game/
│   │   ├── trackBuilder.js     # Track layouts and drawing
│   │   ├── trackMath.js        # Loop geometry (progress, nearest point)
│   │   └── AIKart.js           # Computer opponents
│   ├── math/
│   │   ├── grades.js           # Grade list + which problem/input mode to show
│   │   ├── mathPacks.js        # Grade 3 packs (add/sub/units, ×, ÷)
│   │   ├── similarFigures.js   # Grade 7 Similar Figures generator
│   │   ├── answerCheck.js      # Keypad editing + typed-answer tolerance
│   │   ├── scoring.js          # Coin rules (hint / no hint, right / wrong)
│   │   └── random.js           # Random helpers (no Phaser, unit-testable)
│   └── utils/
│       └── saveManager.js      # localStorage (safe in private browsing)
├── README.md
├── QUICKSTART.md               # Parent quick start + iPad troubleshooting
└── NOTES.md                    # Technical notes + manual iPad mini checklist
```

## 🧹 Reset Progress

- **iPad**: Settings → Safari → Advanced → Website Data → delete "github.io"
- **Computer**: open the browser console and run `localStorage.removeItem('mathKartSave')`, then refresh

## 🎯 Target Audience

Grade 3 (ages 7-9, early school year) and Grade 7 (similar figures unit).
Designed for parent-child play sessions; siblings can share one iPad and
switch grades on the menu (coins and upgrades are shared).

## 📄 License

Built as a prototype. No licensed Mario IP used - all original art & assets.

---

**Have fun racing and learning! 🏁**
