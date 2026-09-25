# Technical Notes - Math Kart

## Old iPad mini / iOS 12 support

**Primary device:** iPad mini 2 (A1489), stuck on iOS 12 Safari.

### What was wrong
1. **Blank dark screen on the iPad mini.** The first build shipped one
   `<script type="module">` bundle. Phaser's own source is ES5-safe, but Vite's
   default esbuild minify target (safari14) rewrote
   `(pma === undefined || pma === null) ? true : pma` into `pma??!0`. `??`
   only exists from Safari 13.1, so iOS 12 threw a SyntaxError while parsing
   the whole file. No game code ran, leaving just the `#1a1a2e` page
   background. (The bundle also used optional `catch {}` binding. It had no
   real `?.` expressions; `?.` substrings only appeared inside strings and
   regexes.)
2. **"Looks like a screenshot" on a newer phone.** The canvas was sized to the
   viewport (e.g. 585x390 on a phone in landscape) but every scene was laid
   out for 1200x800, so the course buttons were off-canvas and nothing on
   screen could be tapped.
3. **Races couldn't be finished anywhere.** Arcade physics world bounds
   defaulted to the game size while tracks were 2400x1600, so karts were
   fenced out of checkpoints 1 and 2.
4. Only one touch pointer was enabled, so holding GO while steering didn't
   work. Answer buttons could be tapped more than once per question.
   `localStorage` writes threw in iOS private browsing.

### What changed
- `@vitejs/plugin-legacy` with `renderModernChunks: false`: every browser
  loads the same Babel-transpiled SystemJS bundle plus core-js polyfills
  (targets `defaults, safari >= 11, ios_saf >= 11`).
- `scripts/check-legacy-bundle.mjs` (`npm run check:legacy`) fails the build if
  any shipped JS has a `?.`/`??` token or doesn't parse as ES2017, or if
  `index.html` still relies on module scripts. Run against the old live
  bundle, it reports the `pma=m??!0` token.
- Renderer: Canvas on iOS ≤ 12 / no WebGL, `AUTO` elsewhere. If WebGL boot
  throws, the game retries on Canvas; on `webglcontextlost` it reloads on
  Canvas. `?renderer=canvas|webgl|auto` overrides.
- An inline ES5 watchdog in `index.html` shows a "Math Kart couldn't start"
  card (with a reason and a Try Again button) on script parse errors, failed
  downloads, unhandled rejections or a 45 s boot timeout. After boot, runtime
  errors show "Math Kart hit a bump!".
- Fixed 1024x768 design resolution with `Scale.FIT`; four active pointers;
  no Arcade physics (karts move with simple kinematics clamped to the track
  size); audio disabled (unused, and iOS 12 WebAudio is fragile).
- Only Graphics/Shape/Text primitives, so Canvas and WebGL look the same.
  No gradients, shaders, blend modes, pointer events or ResizeObserver.

### Automated checks
- `npm run build`: production build
- `npm run check:legacy`: syntax gate described above
- `npm run test:smoke`: serves `dist/` and drives headless Chrome with an
  "iPad iOS 12" profile (iPad iOS 12 UA, 1024x768 touch, WebGL disabled,
  `ResizeObserver`/`PointerEvent`/`structuredClone`/etc. deleted). It checks
  boot on Canvas, START RACE, two-finger driving, pause, a Math Stop
  (one answer only), finishing, Race Again, Quit, and a shop purchase. It also
  checks that the phone layout fits on screen and that a broken or missing
  bundle shows the error card.
- Headless Chrome is not Safari 12. The syntax check covers the parse error;
  the checklist below covers real-device behaviour.

### Manual checklist: iPad mini (iOS 12)
Do this after each deploy (wait ~1-2 minutes for the Pages action to finish).

1. [ ] Open `https://baileybusch.github.io/math-kart/?v=<new number>` in Safari.
2. [ ] Within a few seconds you see the blue "MATH KART / Starting engines…"
       screen, then the menu. Never a dark blank page.
3. [ ] If instead you see "Math Kart couldn't start", note the grey details
       line, tap Try Again, and if needed clear Website Data (Settings → Safari
       → Advanced → Website Data → github.io → Delete).
4. [ ] Landscape: the menu fills the screen; title, both track cards,
       START RACE and SHOP are visible without scrolling or zooming.
5. [ ] Tap the Forest card, then START RACE. The 3-2-1-GO countdown plays.
6. [ ] Hold GO with the right thumb and steer with the left thumb at the
       same time. The kart moves and turns smoothly (no big stutter).
7. [ ] Drive off the road: the kart slows down on the grass.
8. [ ] Follow the yellow arrow to star 1. The Math Stop appears, the question
       fits on one line, and the answer buttons are easy to tap.
9. [ ] Tap an answer twice quickly. Only one result shows; coins change once.
       On a wrong answer, the right answer turns green.
10. [ ] Tap II (pause) → Keep Racing resumes; II → Quit to Menu returns to
        the menu.
11. [ ] Finish a 2-lap race. The results card shows place, prize and
        "Math: X of 6 right". Race Again, Shop and Menu all work.
12. [ ] Shop: buy a paint color (if you have 20+ coins). The toast shows, coins
        go down, and the new color is used in the next race.
13. [ ] Close Safari fully (swipe it away), reopen the link: coins and
        purchases are still there.
14. [ ] Rotate to portrait: the game shrinks to fit and still works.
15. [ ] Optional: open `?renderer=webgl` to compare. If it's blank or glitchy,
        stay on the default (Canvas).

## What Was Built

A complete working prototype of a Mario Kart-style educational racing game with:

### Core Features Implemented
✅ Top-down kart racing with keyboard controls (Arrow Keys / WASD)  
✅ **Touch controls for iPad/tablets** (on-screen buttons)  
✅ **Fixed 4:3 layout scaled to fit** any screen size  
✅ 2 complete race tracks (Forest and Desert)  
✅ Math checkpoint system - racing pauses for problems  
✅ Correct/incorrect answer feedback with coin rewards/penalties  
✅ 2 AI opponent karts with waypoint navigation  
✅ Race finish with placement-based coin payouts (1st: 50, 2nd: 30, 3rd: 15, 4th: 5)  
✅ Shop/garage system with multiple upgrade paths:
  - Speed upgrades (5 levels)
  - Handling upgrades (5 levels)
  - Desert track unlock (100 coins)
  - 5 kart color options (20 coins each)
✅ localStorage persistence for all progress  
✅ Expandable math pack architecture  
✅ **Three complete problem packs:**
  1. **Addition/Subtraction with Units** (complete, 5 problem types)
  2. **Multiplication Facts** (complete, beginner 3rd grade)
  3. **Division Facts** (complete, beginner 3rd grade)
✅ **GitHub Pages deployment** with live URL  

### Tech Stack
- **Phaser 3** (v3.90 via lockfile) - 2D game framework, Canvas renderer on old iOS
- **Vite 5** + **@vitejs/plugin-legacy** - builds one Babel-transpiled bundle for iOS 11+ Safari
- **Vanilla JavaScript** (ES modules in source, SystemJS in production) - No framework overhead
- **localStorage API** - Progress persistence

### Architecture Highlights

#### Math Pack System (`src/math/mathPacks.js`)
The pack system is designed for easy expansion:
- Each pack is a self-contained object with id, name, difficulty, and generation logic
- `generateProblem()` returns structured problem data: `{ question, answer, choices[] }`
- Central registry (`PACKS` object) makes adding new packs trivial
- Problems are randomly generated each time for variety

**Included Packs:**
1. **add-subtract-units** (Complete) - 5 problem types:
   - Simple addition (2-digit)
   - Simple subtraction (2-digit)
   - mL to L conversions
   - Grams to kg conversions
   - Meters to cm conversions

2. **multiplication** (Complete) - 4 problem types:
   - Basic multiplication facts (2-5 × 2-10)
   - Multiply by 2
   - Multiply by 5
   - Multiply by 10
   - Coin multiplier: 1.3× for harder content

3. **division** (Complete) - 4 problem types:
   - Basic division facts (no remainders)
   - Divide by 2
   - Divide by 5
   - Divide by 10
   - Coin multiplier: 1.4× for harder content

**How to Add a New Pack:**
1. Define pack object with `generateProblem()` method
2. Add to `PACKS` registry
3. Optionally adjust `coinMultiplier` for difficulty
4. See README for detailed template

#### Race Logic (`src/scenes/RaceScene.js` + `RaceHudScene.js`)
- Simple kinematic driving (accelerate / brake / coast), slower on grass
- 2 laps x 3 checkpoint stars; the finish counts once all stars in the lap are done
- Progress = distance along the track loop, so positions compare fairly
- The HUD, touch pedals, Math Stop, pause and results run in a separate
  overlay scene that never scrolls with the camera

#### AI System (`src/game/AIKart.js`)
- Rides the track loop in its own lane with a little wobble
- Gentle rubber-banding keeps races close
- Pauses during countdown, Math Stops and pause

#### Track System (`src/game/trackBuilder.js`, `trackMath.js`)
- Each course is one closed loop of waypoints; the road art, AI path,
  checkpoints and progress tracking all come from it
- Checkpoints are waypoint indexes; decorations are seeded so they're the same every race
- Add a track by adding an entry to `COURSES`

#### Progression System
- Coins are the universal currency
- Multiple upgrade paths prevent linear progression
- Desert track unlock provides a medium-term goal (100 coins)
- Speed/handling upgrades offer incremental improvements
- Colors provide cosmetic customization
- All progress persists across sessions

## How to Extend Math Packs

### Example: Adding Division Pack

```javascript
const divisionPack = {
    id: 'division',
    name: 'Division Practice',
    difficulty: 3,
    coinMultiplier: 1.8,
    
    generateProblem() {
        // Ensure clean division for 3rd grade
        const divisor = Phaser.Math.Between(2, 10);
        const quotient = Phaser.Math.Between(2, 12);
        const dividend = divisor * quotient;
        
        return {
            question: `${dividend} ÷ ${divisor} = ?`,
            answer: quotient.toString(),
            choices: this.generateChoices(quotient, 3)
        };
    },
    
    generateChoices(correctAnswer, spread) {
        const choices = [correctAnswer.toString()];
        
        while (choices.length < 3) {
            const wrong = Math.max(1, correctAnswer + Phaser.Math.Between(-spread, spread));
            if (!choices.includes(wrong.toString())) {
                choices.push(wrong.toString());
            }
        }
        
        return Phaser.Utils.Array.Shuffle(choices);
    }
};

// Add to PACKS
const PACKS = {
    'add-subtract-units': addSubtractUnitsPack,
    'multiplication': multiplicationPack,
    'division': divisionPack  // <-- Register here
};
```

Registered packs are picked automatically by `getMixedProblem()`, which
`RaceScene.showMathStop()` calls at every star.

### Example: Adding Fractions Pack

```javascript
const fractionsPack = {
    id: 'fractions',
    name: 'Simple Fractions',
    difficulty: 2,
    coinMultiplier: 1.5,
    
    generateProblem() {
        const wholes = Phaser.Math.Between(1, 5);
        const numerator = Phaser.Math.Between(1, 7);
        const denominator = Phaser.Math.Between(numerator + 1, 8);
        
        return {
            question: `What fraction? ${numerator}/${denominator}`,
            answer: `${numerator}/${denominator}`,
            choices: [
                `${numerator}/${denominator}`,
                `${numerator + 1}/${denominator}`,
                `${numerator}/${denominator + 1}`
            ]
        };
    }
};
```

## Known Limitations

1. **No difficulty scaling**: Currently uses hardcoded difficulty. Could add dynamic difficulty based on performance.

2. **No pack selection**: Packs are mixed randomly at every star. Could allow pack selection in the menu.

3. **Fixed checkpoint count**: Always 3 stars per lap, 2 laps. Could vary by track.

4. **Simple AI**: Rides a fixed lane with rubber-banding. Could add powerups or strategic behavior.

5. **No sound/music**: Would significantly enhance kid appeal.

6. **No powerups**: Classic kart racing feature not implemented.

7. **Single-player only**: No local multiplayer or online play.

8. **Basic graphics**: Using Phaser rectangles/circles. Could use sprite art for more polish.

9. **No problem history**: Could track which problem types are struggled with for adaptive learning.

10. **No parental dashboard**: Could add progress tracking, problem logs, time limits.

## Suggested Next Steps

### Short Term (Quick Wins)
- [ ] Add sound effects (correct/wrong answer, race finish)
- [ ] Add background music toggle
- [ ] Implement 2-3 more math packs (multiplication, division, fractions)
- [ ] Add a "random pack" mode that mixes problems
### Medium Term (Enhanced Gameplay)
- [ ] Add powerup items on track (speed boost, shield, etc.)
- [ ] Implement 2-3 more tracks
- [ ] Add difficulty selector in menu (Easy/Medium/Hard affects AI speed)
- [ ] Add "Time Trial" mode (no AI, just beat your best time)
- [ ] Add animated sprites instead of rectangles
- [ ] Add particle effects (dust clouds, sparkles on correct answers)

### Long Term (Major Features)
- [ ] Local multiplayer (split-screen or shared keyboard)
- [ ] Adaptive difficulty system that learns from mistakes
- [ ] Parent dashboard with progress reports
- [ ] More sophisticated AI with racing lines
- [ ] Track editor
- [ ] Custom character/kart selection
- [ ] Achievement system
- [ ] Export progress reports as PDF

### Learning Content Expansion
Based on California 3rd Grade Math Standards:

- [ ] **Number Sense**: Place value to 10,000s
- [ ] **Operations**: Multi-digit multiplication (2×2, 3×1)
- [ ] **Division**: Division with remainders
- [ ] **Fractions**: Comparing, equivalent fractions
- [ ] **Measurement**: Time (clock reading), temperature
- [ ] **Geometry**: Area, perimeter
- [ ] **Data**: Reading graphs, charts
- [ ] **Money**: Making change, adding prices
- [ ] **Word Problems**: Multi-step problems with units

## Testing Notes

Primary target is iOS 12 Safari on an iPad mini 2 (see the checklist at the
top). The build also targets current Chrome/Edge/Firefox/Safari and mobile
Safari/Chrome; touch controls appear on any touch device.

## Performance

The game runs at 60 FPS on any modern computer. The Phaser engine handles the physics and rendering efficiently. No optimization needed for this scale.

## Save Data Format

Stored in `localStorage` under key `mathKartSave`:

```json
{
  "coins": 150,
  "unlockedCourses": ["forest", "desert"],
  "unlockedColors": ["red", "blue", "green"],
  "currentColor": "blue",
  "speedUpgrades": 2,
  "handlingUpgrades": 1,
  "difficulty": 1
}
```

## Credits

Built with Phaser 3 game engine (https://phaser.io)  
No licensed IP used - all original design  
Built by Cursor Cloud Agent for educational purposes
