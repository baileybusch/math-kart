# 🏎️ Math Kart - Racing & Learning Game

A kart racing game that teaches math through fun gameplay! Pick your grade (Grade 3 or Grade 7), race go-karts, solve math problems at checkpoint stars, earn coins, and unlock upgrades.

## 🎮 PLAY NOW!

**🌐 Live Game (iPad/Browser):** https://baileybusch.github.io/math-kart/

> **Targets old iPad mini / iOS 12 Safari.** The primary device is an
> iPad mini 2 (A1489) that can't update past iOS 12. The production build is
> transpiled for Safari 11+/iOS 11+, uses the Canvas renderer on old iOS, and
> shows a readable "Math Kart couldn't start" card instead of a blank screen
> if anything goes wrong. It works on new phones, tablets and desktops too.

**Getting the latest version on the iPad:** open
`https://baileybusch.github.io/math-kart/?v=5` (any new number). If it still
looks old, go to Settings → Safari → Advanced → Website Data, delete
"github.io", and reopen. See [QUICKSTART.md](QUICKSTART.md) for more.

## 📱 Made for iPad

- **Big touch pedals**: steer ◀ ▶ bottom-left, GO / BRAKE bottom-right (multi-touch)
- **Big answer buttons and a number keypad** in the Math Stop
- **Scratch whiteboard**: draw with a finger to work things out
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
1. **Menu**: pick your **grade** (Grade 3 or Grade 7, remembered for next
   time), pick a track card (locked ones show their price), tap **START RACE**
2. **Race**: 2 laps. Follow the yellow arrow to the yellow ⭐ stars (3 per lap).
   Watch out for track features:
   - **Jump ramps** (orange with yellow chevrons) and **bumps** (sand dunes,
     logs, snow moguls): drive over them to hop into the air with a short
     speed boost. In the air you steer at half strength and the kart gently
     lines up with the road, so landings are easy
   - **Rivers**: the blue water across the road slows you to 40% of top
     speed. A white-arrowed side road with a yellow **BRIDGE** sign crosses
     the river on a wooden bridge at full speed
3. **Math Stop** at each star: everyone pauses while you answer
   - About half the questions need a **typed answer** on the big number
     keypad (with `.`, a `/` fraction key for Grade 7, and ⌫); the rest are
     big answer buttons
   - **Show hint** gives a useful step (like "Scale factor = 20 ÷ 8 = 2.5")
     but right answers then pay half
   - **Whiteboard** opens a full-screen scratch pad (pen, red pen, eraser,
     undo, clear, grid). **Done** goes back to the same question
   - After every answer you see the coin change (green or red) and how to
     solve it; after a miss the right answer is shown
4. **Coins per Math Stop** (never below 0):

   |                      | Grade 3 | Grade 7 |
   |----------------------|:-------:|:-------:|
   | Right, no hint       | +6      | +10     |
   | Right, with a hint   | +3      | +5      |
   | Wrong, with a hint   | −3      | −5      |
   | Wrong, no hint       | −6      | −10     |

   A wrong guess without a hint is the worst outcome on purpose; see
   [NOTES.md](NOTES.md#coins-hints-and-penalties) for why.
5. **Finish**: cross the checkered line after lap 2. Prizes depend on the
   track (harder tracks pay more, and the other karts are a bit faster).
   Every track has its own shape, length and features:

   | Track | Shape and length | Features | Unlock | Needs | 🥇 1st | 🥈 2nd | 🥉 3rd |
   |-------|------------------|----------|-------:|-------|------:|------:|------:|
   | Meadow Loop | wide, sweeping kidney, medium | creek + bridge | free | - | 50 | 30 | 15 |
   | Desert Canyon | long serpentine, longest | 2 jump ramps, 2 dunes | 100 | Meadow | 60 | 35 | 20 |
   | Pine Path | tight and twisty, long | river + bridge, 2 logs | 250 | Desert | 70 | 40 | 20 |
   | Snow Circuit | figure 8 (crosses itself) | 4 snow moguls | 450 | Pine | 80 | 45 | 25 |
   | Night City | short and blocky | 2 jump ramps | 700 | Snow | 90 | 50 | 30 |

6. **Review mistakes**: the results card lists how many Math Stops you
   missed. Tap **Review N mistakes** to step through each one: the question
   (and diagram), your answer, the right answer and how to solve it, with
   the whiteboard if you want it. Finish the review to earn **+3 coins per
   mistake (Grade 3) or +5 (Grade 7)**, once per finished race; the card
   then says "+N for reviewing mistakes". A perfect race says "Perfect —
   nothing to review!" and lets you look back at the questions (no bonus).
   See [NOTES.md](NOTES.md#review-mistakes-v5) for why these numbers.

7. **Shop**: spend coins on
   - Speed upgrades (30 coins each, max 5 levels)
   - Steering upgrades (30 coins each, max 5 levels)
   - The **Track Ladder**: unlock tracks in order (100 → 250 → 450 → 700)
   - Kart paint (20 coins each)

### Controls
- **iPad/Tablet**: on-screen pedals (hold GO with one thumb, steer with the other); **II** pauses
- **Desktop**: Arrow Keys or WASD
- **Math Problems**: tap/click an answer button, or type on the keypad
  (on a computer you can also type digits, `.`, `/`, Backspace and Enter;
  keys 1-3 pick an answer button)
- **Whiteboard**: draw with a finger or the mouse; **Done** (or Esc) closes it
- **Review mistakes**: **Next ▶** / **◀ Back** / **Close** (on a computer:
  → or Enter, and ←). Next unlocks after about a second on each new card
- **Jumps and water**: nothing extra to press. Hold GO over ramps; steer
  onto the bridge road to skip the slow water

## 🧮 Math Content

Pick a grade on the menu. Every problem is generated fresh each time.

### Grade 3 (add, subtract, units, × ÷)
Three packs, mixed at every star:
- **Addition & Subtraction with Units**: 2-digit add/subtract, mL ↔ L,
  g ↔ kg, m ↔ cm
- **Multiplication Facts**: times tables 2-5 × 2-10, ×2, ×5, ×10
- **Division Facts**: no remainders, ÷2, ÷5, ÷10

Hints break the problem into steps ("Add the tens first…", "Skip count
by 6…", "Draw 3 rows of 7 dots on the whiteboard").

### Grade 7: Similar Figures, ratios and proportions
Modeled on a 7th-grade "Similar Figures" homework sheet (7.2.8.B), with
shape diagrams drawn in the Math Stop:
- **Similar or not?** Two rectangles or triangles with labeled sides
  (Yes / No buttons). The hint gives one matching-side ratio to compare.
- **The figures are similar, find x**: rectangles, right triangles,
  parallelograms and L-shapes. Scale factors are mostly clean (1.5, 2, 2.5,
  1.8, 1.25…); some answers are repeating decimals like 6.666…
- **Word problems**: flag vs. drawing, poster vs. postcard (similar?),
  student vs. teacher desk, enlarged photos, and tree-shadow problems
  (find the missing length)
- **Scale factor** and **proportions** (`3/4 = x/20`)

Typed answers that repeat (like 20/3) accept anything rounded to tenths or
better (6.7, 6.67, 6.666) or the exact fraction `20/3`. Answers that end
(like 14.4) must be exact.

## 🔧 Development

### Requirements
- Node.js 18+ (CI uses 20)
- Google Chrome or Chromium for the smoke test (set `CHROME_PATH` if it isn't in a standard place)

### Commands
```bash
npm install            # install dependencies (node_modules is git-ignored)
npm run dev            # dev server
npm run test:unit      # generated problems, coin rules, track geometry, hazards, autopilot + AI laps
npm run tracks:preview # draw every track layout to track-preview/tracks.png
npm run build          # production build -> dist/
npm run preview        # serve dist/ locally
npm run check:legacy   # assert dist/ JS is safe for iOS 12 Safari
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
- The scratch whiteboard is a plain DOM `<canvas>` overlay using touch
  events with a mouse fallback (iOS 12 has no Pointer Events). Its touches
  never reach Phaser, so it can't press the race pedals.
- GitHub Actions (`.github/workflows/deploy.yml`) runs the unit test, legacy
  check and smoke test before every Pages deploy; `ci.yml` runs them on pull
  requests.

## 📦 Adding New Math Packs

Math packs are modular and don't depend on Phaser (so `npm run test:unit`
can check them in plain Node). Edit `src/math/mathPacks.js`:

```javascript
import { between, chance } from './random.js';
import { makeTyped } from './answers.js';

const myNewPack = {
    id: 'my-new-pack',           // Unique identifier
    name: 'My New Math Topic',   // Display name
    grade: 3,                    // Which grade uses it

    generateProblem() {
        const a = between(2, 9);
        const b = between(2, 9);
        const problem = {
            question: a + ' \u00D7 ' + b + ' = ?',
            answer: String(a * b),
            mode: 'choice',
            choices: [String(a * b), String(a * b + 1), String(a * b - 1)],
            hint: 'Skip count by ' + b + ', ' + a + ' times.',  // a step, not the answer
            explain: a + ' \u00D7 ' + b + ' = ' + a * b        // shown after answering
        };
        // Half the time, make the kid type it on the keypad instead.
        return chance(0.5) ? makeTyped(problem, a * b) : problem;
    }
};
```

Then register it in `PACKS` (same file) and add its id to a grade's `packs`
list in `src/math/grades.js`. Optional problem fields: `diagram` (two shapes
drawn side by side, see `src/ui/figureDiagram.js`), `unit` (shown after the
typed number) and `kind` (Grade 7 uses it to show `x =` in the answer box).
Run `npm run test:unit`: it generates thousands of problems per grade and
checks each one is self-consistent.

## 🗂️ Project Structure

```
math-kart/
├── index.html                  # Page shell + ES5 boot watchdog / error card
├── vite.config.js              # Legacy (iOS 12) build config
├── scripts/
│   ├── unit-test.mjs           # Math generators, answers, coins, tracks and hazards
│   ├── track-preview.mjs       # Draws every track layout (npm run tracks:preview)
│   ├── check-legacy-bundle.mjs # No ?. / ??, ES2017-only output check
│   └── smoke-test.mjs          # Headless Chrome play-through (iPad iOS 12 profile)
├── src/
│   ├── main.js                 # Phaser config + boot
│   ├── boot.js                 # Renderer choice, Canvas fallback, boot status
│   ├── ui/
│   │   ├── theme.js            # Fonts, colors, buttons, kart drawing
│   │   ├── mathStop.js         # Math Stop: keypad/choices, hint, coins
│   │   ├── reviewMistakes.js   # After-race review of missed Math Stops
│   │   ├── figureDiagram.js    # Shape diagrams for Grade 7
│   │   ├── coursePreview.js    # Track mini-maps for menu and shop cards
│   │   └── whiteboard.js       # Full-screen scratch pad (DOM canvas)
│   ├── scenes/
│   │   ├── MenuScene.js        # Grade picker, track cards, START RACE, SHOP
│   │   ├── RaceScene.js        # Driving, laps, checkpoints, AI
│   │   ├── RaceHudScene.js     # HUD, touch pedals, pause, results + review
│   │   └── ShopScene.js        # Upgrades, paint, track ladder
│   ├── game/
│   │   ├── courses.js          # 5 track layouts, prices, prizes, unlock ladder
│   │   ├── features.js         # Ramps, bumps, river, bridge road (shared with tests)
│   │   ├── raceLogic.js        # Kart + AI driving, water, jumps, laps (shared with tests)
│   │   ├── trackBuilder.js     # Track, river, bridge, ramp drawing and decorations
│   │   ├── trackMath.js        # Loop geometry (rounded corners, progress, nearest point)
│   │   └── AIKart.js           # Computer opponents
│   ├── math/
│   │   ├── grades.js           # Grade 3 / Grade 7 -> packs
│   │   ├── mathPacks.js        # Grade 3 packs + pack registry
│   │   ├── similarFigures.js   # Grade 7 Similar Figures pack
│   │   ├── answers.js          # Typed-answer parsing and tolerance
│   │   ├── economy.js          # Coin rules (hints, penalties, review bonus)
│   │   └── random.js           # RNG helpers
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
Designed for parent-child play sessions. Siblings at different levels can
share one iPad: each picks their grade on the menu (coins and shop items are
shared).

## 📄 License

Built as a prototype. No licensed Mario IP used - all original art & assets.

---

**Have fun racing and learning! 🏁**
