# 🏎️ Math Kart - Racing & Learning Game

A kart racing game for 3rd graders that teaches math through fun gameplay! Race go-karts, solve math problems at checkpoint stars, earn coins, and unlock upgrades.

## 🎮 PLAY NOW!

**🌐 Live Game (iPad/Browser):** https://baileybusch.github.io/math-kart/

> **Targets old iPad mini / iOS 12 Safari.** The primary device is an
> iPad mini 2 (A1489) that can't update past iOS 12. The production build is
> transpiled for Safari 11+/iOS 11+, uses the Canvas renderer on old iOS, and
> shows a readable "Math Kart couldn't start" card instead of a blank screen
> if anything goes wrong. It works on new phones, tablets and desktops too.

**Getting the latest version on the iPad:** open
`https://baileybusch.github.io/math-kart/?v=3` (any new number). If it still
looks old, go to Settings → Safari → Advanced → Website Data, delete
"github.io", and reopen. See [QUICKSTART.md](QUICKSTART.md) for more.

## 📱 Made for iPad

- **Big touch pedals**: steer ◀ ▶ bottom-left, GO / BRAKE bottom-right (multi-touch)
- **Big answer buttons** in the Math Stop
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
1. **Menu**: pick a track card, tap **START RACE**
2. **Race**: 2 laps. Follow the yellow arrow to the yellow ⭐ stars (3 per lap)
3. **Math Stop** at each star: everyone pauses while you answer
   - ✅ Correct answer: +5 coins
   - ❌ Wrong answer: -2 coins (never below 0), and the right answer is shown
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
- **Math Problems**: tap/click the answer button

## 🧮 Math Content

**Three problem packs, mixed randomly at every star:**

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
npm run test:smoke     # boot dist/ in headless Chrome and play through it
npm test               # build + check:legacy + test:smoke
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
- GitHub Actions (`.github/workflows/deploy.yml`) runs the legacy check and
  smoke test before every Pages deploy; `ci.yml` runs them on pull requests.

## 📦 Adding New Math Packs

Math packs are modular. Edit `src/math/mathPacks.js` and add a pack:

```javascript
const myNewPack = {
    id: 'my-new-pack',           // Unique identifier
    name: 'My New Math Topic',   // Display name
    difficulty: 2,               // 1-5 scale
    coinMultiplier: 1.2,         // Bonus for harder topics

    generateProblem() {
        const a = Phaser.Math.Between(1, 10);
        const b = Phaser.Math.Between(1, 10);
        const answer = a * b;

        return {
            question: `${a} × ${b} = ?`,
            answer: answer.toString(),
            choices: this.generateChoices(answer)
        };
    },

    generateChoices(correctAnswer) {
        // 3 multiple choice options including the correct one
        const choices = [correctAnswer.toString()];

        while (choices.length < 3) {
            const wrong = correctAnswer + Phaser.Math.Between(-5, 5);
            if (wrong !== correctAnswer && !choices.includes(wrong.toString())) {
                choices.push(wrong.toString());
            }
        }

        return Phaser.Utils.Array.Shuffle(choices);
    }
};
```

Then register it in the `PACKS` object. `getMixedProblem()` (used by the race)
automatically picks from every registered pack:

```javascript
const PACKS = {
    'add-subtract-units': addSubtractUnitsPack,
    'multiplication': multiplicationPack,
    'division': divisionPack,
    'my-new-pack': myNewPack  // Add here!
};
```

## 🗂️ Project Structure

```
math-kart/
├── index.html                  # Page shell + ES5 boot watchdog / error card
├── vite.config.js              # Legacy (iOS 12) build config
├── scripts/
│   ├── check-legacy-bundle.mjs # No ?. / ??, ES2017-only output check
│   └── smoke-test.mjs          # Headless Chrome play-through (iPad iOS 12 profile)
├── src/
│   ├── main.js                 # Phaser config + boot
│   ├── boot.js                 # Renderer choice, Canvas fallback, boot status
│   ├── ui/theme.js             # Fonts, colors, buttons, kart drawing
│   ├── scenes/
│   │   ├── MenuScene.js        # Track cards, START RACE, SHOP
│   │   ├── RaceScene.js        # Driving, laps, checkpoints, AI
│   │   ├── RaceHudScene.js     # HUD, touch pedals, Math Stop, pause, results
│   │   └── ShopScene.js        # Upgrades, paint, track unlock
│   ├── game/
│   │   ├── trackBuilder.js     # Track layouts and drawing
│   │   ├── trackMath.js        # Loop geometry (progress, nearest point)
│   │   └── AIKart.js           # Computer opponents
│   ├── math/
│   │   └── mathPacks.js        # Expandable problem pack system
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

3rd graders (ages 7-9), early school year. Designed for parent-child play sessions.

## 📄 License

Built as a prototype. No licensed Mario IP used - all original art & assets.

---

**Have fun racing and learning! 🏁**
