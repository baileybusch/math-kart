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
- `npm run test:unit`: plain Node. Generates 4000 problems per grade and
  checks every one (answer accepted, wrong choices rejected, diagram numbers
  really similar with x filled in, hints don't state the answer, desks are
  longer than wide...), plus typed-answer parsing/tolerance, the coin table,
  the review bonus, track geometry, ramp/river/bridge placement and physics,
  and autopilot and AI karts that must finish two laps of every track (see
  "Reachable checkpoints" below).
- `npm run tracks:preview`: draws every layout (road, river, bridge, ramps,
  stars, lap fractions) to `track-preview/tracks.png` for editing tracks.
- `npm run test:smoke`: serves `dist/` and drives headless Chrome with an
  "iPad iOS 12" profile (iPad iOS 12 UA, 1024x768 touch, WebGL disabled,
  `ResizeObserver`/`PointerEvent`/`structuredClone`/etc. deleted). It checks
  boot on Canvas, picking Grade 7, START RACE, two-finger driving, pause, a
  Math Stop (one answer only after a double tap), a typed Grade 7 answer, the
  whiteboard (two-finger drawing that never reaches the pedals, then Done back
  to the same question with the typed digits kept), a hint (+5 instead of
  +10), a wrong answer with no hint (−10, correct answer shown), no review
  bonus mid-race, finishing, the mistake review (Next locked for a moment,
  each card shows your answer and the right one, whiteboard, +5 per mistake
  paid once and saved), Race Again (empty review log), Quit, a shop
  purchase and the track ladder, plus one race on every track: the ford
  slows the kart to 40%, the bridge doesn't, a ramp launches it, and a
  perfect race says "nothing to review". Desktop checks WebGL boot, then (on
  Canvas, because CI has no GPU and software WebGL takes 10+ s to start a
  race) Grade 3 persistence, a keyboard-typed answer (+6) and drawing with
  the mouse. It also checks that
  the phone layout fits on screen and that a broken or missing bundle shows
  the error card.
- Headless Chrome is not Safari 12. The syntax check covers the parse error;
  the checklist below covers real-device behaviour.

### Manual checklist: iPad mini (iOS 12)
Do this after each deploy (wait ~1-2 minutes for the Pages action to finish).

1. [ ] Open `https://baileybusch.github.io/math-kart/?v=5` in Safari (use a
       new number after each later deploy: `?v=6`, `?v=7`, ...).
2. [ ] Within a few seconds you see the blue "MATH KART / Starting engines…"
       screen, then the menu. Never a dark blank page.
3. [ ] If instead you see "Math Kart couldn't start", note the grey details
       line, tap Try Again, and if needed clear Website Data (Settings → Safari
       → Advanced → Website Data → github.io → Delete).
4. [ ] Landscape: the menu fills the screen; title, grade cards, all five
       track cards, START RACE and SHOP are visible without scrolling or
       zooming. Locked tracks show a lock and a price; tapping one explains
       how to unlock it.
5. [ ] Tap **Grade 7** (it turns green), then the Meadow Loop card, then
       START RACE. The 3-2-1-GO countdown plays.
6. [ ] Hold GO with the right thumb and steer with the left thumb at the
       same time. The kart moves and turns smoothly (no big stutter).
7. [ ] Drive off the road: the kart slows down on the grass.
7a. [ ] Meadow Loop: on the long bottom straight, drive straight through the
        blue ford. Splashes appear, the kart slows right down and "Splash!
        Water is slow. Try the bridge!" shows once. Next lap follow the
        white arrows and the yellow BRIDGE sign onto the side road and over
        the wooden bridge: no slow-down. The water and bridge are easy to
        tell apart on the iPad mini screen.
7b. [ ] Desert Canyon or Night City: drive over an orange jump ramp while
        holding GO. The kart grows (it's in the air) with a shadow under it,
        "WHOOSH!" pops up, and it lands on the road without a crash, a bit
        faster than before. Bumps (dunes, logs, snow moguls) give a small
        "Boing!" hop.
8. [ ] Follow the yellow arrow to star 1. The Math Stop appears with a
       Grade 7 question and (usually) two shapes with labeled sides. The
       question and labels are readable without zooming.
9. [ ] On a keypad question: tap digits, `.` and ⌫; they show in the answer
       box. Tap Check twice quickly: only one result shows and coins change
       once. On a button question, a wrong tap turns red and the right answer
       turns green.
9a. [ ] Tap **Whiteboard**. Draw with one finger, then two fingers at once;
        try Red, Eraser, Undo, Clear and Grid. Tap **Done**: you're back on
        the same question and any digits you typed are still there. The kart
        didn't move while you drew.
9b. [ ] Tap **Show hint**: a yellow hint appears and the corner text says
        "Hint used: half coins, Right +5 Wrong −5". Answer right: "+5 coins"
        in green. On another star, answer wrong without a hint: "−10 coins"
        in red and "The answer is …" with the worked steps.
9c. [ ] Quit to Menu, tap **Grade 3**, race again: the Math Stops are Grade 3
        (+6 / −6). Close and reopen Safari: the grade you picked is still
        selected.
10. [ ] Tap II (pause) → Keep Racing resumes; II → Quit to Menu returns to
        the menu.
11. [ ] Finish a 2-lap race. The results card shows place, prize and
        "Math: X of 6 right" (plus hints used). Race Again, Shop and Menu all
        work.
11a. [ ] Finish a race with at least one wrong answer. The results card
         shows "Review N mistakes +B". Tap it: each card shows the question
         (and shapes), your answer in red, the right answer in green and how
         to solve it. Next is grey for about a second on each new card.
         Whiteboard opens and Done returns to the same card. On the last
         card tap "Done ✓ +B": the results say "+B for reviewing mistakes ✓"
         and the coin total went up by B (+3 per mistake in Grade 3, +5 in
         Grade 7). The review button doesn't come back.
11b. [ ] Finish a race with every answer right: "Perfect — nothing to
         review!" and a "Look back" button (no bonus).
11c. [ ] Quit a race from the pause menu after a wrong answer: no review,
         no bonus.
12. [ ] Shop: buy a paint color (if you have 20+ coins). The toast shows, coins
        go down, and the new color is used in the next race.
12a. [ ] Shop → Track Ladder: with 100+ coins unlock Desert Canyon; Pine Path
         turns green once you have 250. Later tracks say "After …". Back on
         the menu the new track card is unlocked; race it and check the
         1st-place prize matches the card (60 for Desert).
12b. [ ] Optional (to see every track): unlock them all, then race Pine
         Path, Snow Circuit and Night City once each. Stars and the finish
         line are reachable and each track looks and drives differently
         (Pine is twisty, Snow crosses itself in the middle, City is short).
         The menu mini-maps match the roads, rivers and ramps you drive.
13. [ ] Close Safari fully (swipe it away), reopen the link: coins and
        purchases are still there.
14. [ ] Rotate to portrait: the game shrinks to fit and still works.
15. [ ] Optional: open `?renderer=webgl` to compare. If it's blank or glitchy,
        stay on the default (Canvas).

## Grades, hints and the scratch whiteboard (v4)

### Grade select
- Two grade cards on the menu: **Grade 3** (the three existing packs) and
  **Grade 7** (Similar Figures). The choice is stored as `grade` in the
  existing `mathKartSave` object, so it gets the same iOS private-mode
  safety (in-memory fallback, best-effort `setItem`). Unknown values fall
  back to Grade 3. Coins and shop items are shared between grades.
- `src/math/grades.js` maps a grade to its packs; `RaceScene` asks for
  `getProblemForGrade(save.grade)` at every star.

### Grade 7: Similar Figures pack (`src/math/similarFigures.js`)
Rooted in the 7.2.8.B "Similar Figures" homework sheet. The problem *types*
come from the sheet; every problem is generated fresh, and no answers from a
filled-in sheet are used as keys.

| Type | Share | Answer | Example |
|------|------:|--------|---------|
| Similar or not? (rectangles, triangles) | 25% | Yes/No buttons | 4-6-8 vs 6-9-12 triangle |
| Find x (rectangle, right triangle, parallelogram, L-shape) | 40% | 80% typed | 8×6 and 20×x, x = 15 |
| Word problem: similar? (flag/drawing, poster/postcard, rug) | 8% | Yes/No | 60×36 flag vs 10×6 drawing |
| Word problem: find it (desks, enlarged photo, tree shadow) | 17% | 75% typed | 30×18 desk, 50 long, 30 wide |
| Scale factor from A to B | 5% | typed | 8×6 to 20×15, 2.5 |
| Proportion `a/b = x/d` | 5% | typed | 3/4 = x/20, 15 |

- Scale factors are drawn from a weighted list: halves, fifths and quarters
  (1.5, 2, 2.5, 3, 3.5, 4, 1.8, 1.25) give clean decimals; thirds (4/3, 5/3,
  7/3) give whole numbers or a repeating decimal. About 12% of typed Grade 7
  answers repeat (like 6.666…), always in thirds so they round sensibly.
- Diagrams: both shapes are drawn with correct proportions at a shared
  scale (the small one never shrinks below half its own fit size), the
  unknown side is a red **x** in a yellow bubble, and right angles are
  marked. Similar-or-not pairs are drawn with their real side lengths, so a
  non-similar pair looks a bit "off".
- Multiple-choice find-x wrong answers are the classic mistakes: adding
  the difference instead of multiplying, or using the scale factor upside
  down.

### Typed answers (`src/math/answers.js`)
- About 50% of Grade 3 and 55% of Grade 7 problems (80% of find-x) need a
  typed answer on the keypad: 0-9, `.`, `/` (Grade 7 only; greyed out for
  Grade 3), ⌫ and Check. Keys are 86×74 game px (≈ 86×74 pt on an iPad
  mini). On a computer, digits, `.`, `/`, Backspace and Enter also work.
- Neat answers (≤ 2 decimals, like 15, 14.4, 2.25) must be exact. Repeating
  answers accept anything within 0.05 (rounded to tenths or better): for
  20/3 that's 6.7, 6.67, 6.66, 6.666 or the fraction `20/3`, but not 6.6.
  Grade 7 keypad questions show a small tip: "round to 2 decimals (6.67) or
  type a fraction (20/3)".
- An empty or unfinished entry (`5/`) just shows "Type your answer first!"
  and costs nothing.

### Coins, hints and penalties
Coins per Math Stop (`src/math/economy.js`), never below 0:

|                      | Grade 3 | Grade 7 | Rule |
|----------------------|:-------:|:-------:|------|
| Right, no hint       | **+6**  | **+10** | +N |
| Right, with a hint   | +3      | +5      | +ceil(N/2) |
| Wrong, with a hint   | −3      | −5      | −ceil(N/2) |
| Wrong, no hint       | **−6**  | **−10** | −N |

Before this change it was +5 / −2 for everything.

- Why: a younger kid was tapping answers at random. At +5/−2 a random tap on
  a 3-button question was worth +0.33 coins on average, so guessing paid.
  Now a random Grade 3 tap averages −2 coins and a random Yes/No tap in
  Grade 7 averages 0, so asking for a hint (or using the whiteboard) is
  always the better move.
- Order: right > right with hint > 0 > wrong with hint > wrong with no hint.
  A right answer with a hint always beats any wrong answer, and a flat wrong
  guess without help is the worst outcome.
- Wrong after a hint: one simple rule, half the no-hint penalty.
- The Math Stop always shows the current stakes ("Right +10  Wrong −10 /
  With a hint: +5 / −5"). After the hint it switches to "Hint used: half
  coins / Right +5  Wrong −5" in orange.
- Grade 7 pays more because the problems take longer; race prizes (50/30/15)
  are unchanged.
- Hints give a useful step, not the answer: "Scale factor = 20 ÷ 8 = 2.5
  (big ÷ small). Now multiply 6 by 2.5.", "Compare matching sides, big ÷
  small. 12 ÷ 8 = 1.5. Do the other matching sides give the same number?",
  "Cross-multiply: 4 × x = 3 × 20…", "Add the tens first…", "Skip count by
  6…". The unit test checks that no hint states the final answer.

### After answering
- A big green/red coin change ("+10 coins" / "−10 coins") and a message;
  after a miss: "Not quite. The answer is x = 15." The hint box turns into
  "Here's how: 6 × 2.5 = 15, so x = 15" (green "How it works" on a right
  answer).
- **Keep Racing ▶** closes it right away; otherwise it closes by itself
  after 2.6 s (right) or 6 s (wrong).
- Double-submit guard: the Math Stop resolves once (`state.answered` is set
  before anything else, every key/button is locked), and `RaceScene` also
  ignores a second result for the same stop, so coins can't be awarded
  twice.

### Scratch whiteboard (`src/ui/whiteboard.js`)
- **Whiteboard** button on every Math Stop. Opens a full-screen DOM overlay
  (z-index above the game, below the error card) with a `<canvas>` and a
  toolbar: Pen (dark), Red, Eraser, Undo, Clear, Grid (light 40 px grid,
  on by default) and **Done ✓** (Esc also closes). The question text is
  shown in a corner pill.
- iOS 12: Canvas 2D line segments with round caps, `touchstart/move/end`
  listeners with `{ passive: false }` + `preventDefault` (no scrolling, no
  emulated mouse events), mouse fallback for computers, no Pointer Events,
  `ResizeObserver` or `OffscreenCanvas`. Backing store is capped at 2×
  device pixels. The eraser uses `destination-out`; the grid is a CSS
  background so erasing never removes it.
- Multi-touch: each finger draws its own stroke. The overlay stops touch and
  mouse events from bubbling to Phaser's window listeners, and the race is
  paused during Math Stops anyway, so drawing can't press GO or steer. The
  overlay is `display: none` when closed, so it can't eat race touches.
- The Math Stop stays open underneath, so typed digits, hint state and
  stakes are exactly as they were. Strokes are kept (and redrawn after a
  rotation/resize) until the next question, which starts with a clean pad.
  Nothing on the pad is graded.

## Review mistakes (v5)

After a **finished** race the results card offers a review of every Math
Stop the player got wrong in that race.

- **Flow:** results card → **Review N mistakes +B ▶** → one card per miss:
  the question (and the two shapes for Grade 7), "Your answer ✗" in red,
  "Right answer" in green, the coin change for that stop, and "Here's how:"
  with the worked steps and the hint. **Whiteboard** opens the same scratch
  pad as the Math Stop (Done returns to the card). **◀ Back**, **Next ▶**,
  **Close**; on a computer → / Enter and ← work too.
- **Bonus: +ceil(N/2) coins per mistake reviewed** (N = the Math Stop reward),
  so **+3 per mistake in Grade 3 and +5 in Grade 7**, the same as a right
  answer with a hint. It's paid when the player taps **Done ✓ +B** on the
  last card; the results card then shows "+B for reviewing mistakes ✓" and
  the updated total. Closing early pays nothing (the button stays so they
  can start again).
- **Why this number:** a miss is −6 / −10 (−3 / −5 with a hint), so a miss
  plus its review is still −3 / −5 (0 with a hint). Getting it right always
  beats getting it wrong and reviewing it, so missing on purpose never
  pays. Even six reviewed mistakes (+18 / +30) are less than the smallest
  1st prize (50), so racing well stays the main way to earn. Unit-tested in
  `npm run test:unit` ("review-mistakes bonus").
- **No farming:** the bonus is offered only after the finish line
  (`RaceScene.reviewBonusOnOffer()` is 0 mid-race), is paid at most once per
  race (`claimReviewBonus()`), and quitting from the pause menu throws the
  race away. Next is locked for 1.2 s on each new card (only the first time
  it's shown) so the bonus can't be collected by tapping through blind.
  One known edge: coins never go below 0, so a player at 0 coins loses
  nothing for a miss but still gets the review bonus. That's at most +18 /
  +30 a race, less than answering correctly.
- **Perfect race:** "Perfect — nothing to review! ★" plus an optional
  "Look back at all N questions" (same cards, marked ✓, no bonus).
- **Nothing is saved** except the coin total: the list of stops lives on the
  `RaceScene` and is gone after Race Again, Shop or Menu. The Math Stop now
  reports what was typed or tapped (`given`) so the card can show it.

## Track shapes and hazards (v5)

The five tracks were redesigned so each one drives differently. Course data
(`src/game/courses.js`) is now a closed list of corners `[x, y, radius?]`;
`roundedLoop()` in `trackMath.js` turns every corner into a circular arc, so
a track can be wide and sweeping (radius 330) or tight and technical (170).
Stars, ramps and the river are placed by lap fraction (0 = start line).

| # | Track (id) | Shape | Lap | 2 laps* | Features | Unlock | Prizes | Opponents |
|---|------------|-------|----:|--------:|----------|------:|--------|-----------|
| 1 | Meadow Loop (`forest`) | wide, sweeping, asymmetric kidney | 5,013 px | 34 s (32 via bridge) | creek + bridge | free | 50 / 30 / 15 | 100% |
| 2 | Desert Canyon (`desert`) | long serpentine (three long legs and two hairpins) | 7,718 px | 45 s | 2 jump ramps, 2 sand dunes | 100 | 60 / 35 / 20 | 104% |
| 3 | Pine Path (`pine`) | tight and twisty: V chicane, S-bends, a dip | 6,827 px | 43 s (41 via bridge) | river + bridge, 2 logs | 250 | 70 / 40 / 20 | 108% |
| 4 | Snow Circuit (`snow`) | figure 8 that crosses itself in the middle | 6,506 px | 40 s | 4 snow moguls (two on each diagonal) | 450 | 80 / 45 / 25 | 112% |
| 5 | Night City (`city`) | short, blocky city blocks with 90 degree corners | 4,708 px | 26 s | 2 jump ramps (one right after the start) | 700 | 90 / 50 / 30 | 115% |

\* Unit-test autopilot, base kart, no Math Stops. Lap lengths vary by 1.6×.

### Jumps and bumps (`src/game/features.js`, `raceLogic.js`)
- **Jump ramp** (Desert, City): an orange ramp with yellow chevrons across
  the whole road. Driving over it at 90+ px/s launches the kart for 0.75 s
  with a boost of up to 125% top speed (speed × 1.25 + 50) that fades over
  1.3 s. "WHOOSH!" pops up.
- **Bump** (Desert dunes, Pine logs, Snow moguls): a small 0.32 s hop and
  up to 110% top speed. "Boing!". Bumps on the same stretch are at least
  200 px apart so a fast kart lands between them.
- **In the air:** the kart keeps its speed (no grass or water slow-down),
  steers at half strength, and turns itself toward the road direction at
  up to 1.6 rad/s. That makes landings forgiving on the iPad: a kart
  knocked 0.5 rad off line lands pointing down the road (unit-tested).
  The kart sprite grows up to 35% with a shadow under it. No 3D, no
  crashes. Nothing new to press: just hold GO.
- Ramps only sit on straights with room to land (360 px after a jump) and
  away from stars, rivers and the figure-8 crossing (unit-tested).

### River, ford and bridge (Meadow, Pine)
- A river crosses the road once. On the road it's lighter blue with white
  ripples (the **ford**), with a blue **SPLASH!** sign before it. Driving
  through water caps speed at **40%** of top speed (grass is 55%) and
  sheds speed fast, with splashes. The first time each race a tip says
  "Splash! Water is slow. Try the bridge!".
- A **bridge road** forks off before the river (white arrows, a yellow
  **BRIDGE** sign with an arrow), runs 280 px to the side straight across
  the river on a wooden deck with rails, then rejoins. It counts as road,
  and there's no slow-down on the deck. It's a bit longer, but still faster:
  in the unit test the bridge route beats wading by about 1 s per crossing.
  Its bends are radius 150+ and the deck is straight.
- The river ends in a pond on one side and runs off the map on the other,
  so it only meets the road at the ford (unit-tested).

### AI karts and features
- Movement lives in `stepAI()` (`raceLogic.js`), shared with the unit test.
  **Zoom** (orange) always takes the bridge; **Bolt** (blue) wades through
  the ford at 50% speed. Both hop every ramp with a short 5-15% boost.
  AI karts ride the loop, so they can't get stuck: the unit test checks
  they always move forward, never drop below 40% speed and finish two laps
  on every track.

### Figure 8 (Snow Circuit)
- The road crosses itself at about 73 degrees (a flat crossroads, no
  collisions). Lap progress only searches road near the kart's last
  position, so driving through the crossing never jumps progress to the
  other road. Stars and moguls are kept 300-450+ px away from the crossing
  and every star can only be reached from its own road (unit-tested).

### Unlock ladder (unchanged)
- Meadow (free) → Desert (100) → Pine (250) → Snow (450) → Night City
  (700), each needing the one before. Prices and prizes are **not**
  rebalanced: most coins come from the six Math Stops per race (+36 /
  +60 when all are right) plus the prize, and every track still has six
  stops. Compared with v4 (33-37 s for two laps everywhere), Desert takes
  about 30% longer, Pine and Snow 15-20% longer, Meadow about the same and
  City about 30% less. That changes coins per minute a little but not the
  number of races needed to climb the ladder. Harder tracks still pay
  bigger prizes and have faster opponents.
- The shop's Track Ladder panel shows all four paid tracks: *Unlock 250*
  (green when you can afford it), *After Pine Path* (greyed out), or
  *Unlocked!*. Tapping a locked card on the menu says what to do.
- **Why escalate:** a typical race earns about 60-100 coins (prize + math +
  review). From zero, roughly 2 races to open Desert, about 4 more for
  Pine, 6 more for Snow and 8 more for Night City, plus 300 coins of
  speed/steering upgrades and 80 of paint.
- The starter's save id stays `forest` ("Meadow Loop" on screen). Unlocks
  are in the existing `unlockedCourses` array of `mathKartSave` (same
  private-mode-safe path). Unknown ids are dropped, and `RaceScene` falls
  back to Meadow Loop if asked for a locked track.
- **Menu and shop mini-maps** are drawn from the same geometry: the real
  road (including the bridge road), the river and pond, the Snow lake, and
  ramps as orange (jump) or brown (bump) dots. The menu still has five
  180×220 cards inside the fixed 1024×768 design space, so phones and iPads
  show them all.

### Reachable checkpoints (the old "fenced out" bug)
Kart driving, lap progress, checkpoint detection, water, ramps and AI
movement live in `src/game/raceLogic.js` / `features.js` and are used
unchanged by `RaceScene`, `AIKart` and `npm run test:unit`. For every track
the unit test checks:
- geometry: the road (and bridge road) stays 60+ px inside the course;
  separate stretches of road stay 250+ px apart except at the planned
  figure-8 crossing (which must be at 55+ degrees); no bend tighter than
  radius 140; the karts start on a straight;
- stars: spread round the lap, only reachable from their own road, and
  away from ramps, the river/bridge and the crossing;
- features: ramps on straights with room to land and 200+ px apart; the
  river crosses the road and the bridge road exactly once each, only meets
  the road at the ford, the pond is clear of roads, the bridge road is on a
  straight, has gentle bends, a straight deck and a visible island;
- driving: an autopilot (base kart, and a max-speed kart with no steering
  upgrades) must reach all 6 stars and finish two laps, never touch the
  course edge, stay on the road over 88% of the time, and take off from
  every ramp on both laps. On river tracks it gets wet in the ford both
  laps, while a second autopilot that follows the bridge road stays dry
  and finishes faster. Both AI karts finish two laps, hop every ramp, and
  one stays dry while the other wades;
- physics: the ford caps speed at 40%, the bridge deck doesn't slow you and
  counts as road, a jump lasts 0.75 s with a boost that wears off, a slow
  kart just rolls over a ramp, and landings are forgiving.

The smoke test also races every track on the iOS 12 profile (star 1 opens a
Math Stop, the ford slows the kart, the bridge doesn't, a ramp launches it,
the finish pays that track's prize) and walks the shop ladder.

### Adding a track
Add an entry to `COURSES` in `src/game/courses.js`: `corners` (a closed list
of `[x, y, radius?]`; corner 0 → corner 1 must be a straight, and the start
line is its midpoint; a corner in a straight line is fine for moving the
start), `radius`, `checkpoints` (three lap fractions), optional `ramps`
(`{ kind: 'jump' | 'bump', at }`), `river` (`{ at, side, width, near, far,
wiggle, pond, bridge: { offset, flat, ramp, radius } }`, on a straight of
about 1,150 px), `crossings` for a figure 8, plus palette, cost, prizes and
aiSpeed. Append its id to `COURSE_ORDER`, add a decorator in
`trackBuilder.js`, and run `npm run tracks:preview` (shows lap fractions)
and `npm run test:unit`, which says exactly what's wrong. The menu has room
for five cards; a sixth needs a second row or smaller cards.

## What Was Built

A complete working prototype of a Mario Kart-style educational racing game with:

### Core Features Implemented
✅ Top-down kart racing with keyboard controls (Arrow Keys / WASD)  
✅ **Touch controls for iPad/tablets** (on-screen buttons)  
✅ **Fixed 4:3 layout scaled to fit** any screen size  
✅ **5 race tracks on an unlock ladder** (Meadow, Desert, Pine, Snow, Night City), each with its own shape, length and features  
✅ **Jump ramps, bumps, rivers with a slow ford and a bridge road**  
✅ **After-race mistake review** with a small coin bonus  
✅ Math checkpoint system - racing pauses for problems  
✅ Correct/incorrect answer feedback with coin rewards/penalties  
✅ 2 AI opponent karts with waypoint navigation  
✅ Race finish with placement-based coin payouts per track (1st: 50 on Meadow up to 90 in Night City)  
✅ Shop/garage system with multiple upgrade paths:
  - Speed upgrades (5 levels)
  - Handling upgrades (5 levels)
  - Track ladder: Desert 100, Pine 250, Snow 450, Night City 700
  - 5 kart color options (20 coins each)
✅ localStorage persistence for all progress  
✅ Expandable math pack architecture  
✅ **Grade select** (Grade 3 / Grade 7) with four problem packs:
  1. **Addition/Subtraction with Units** (Grade 3, 5 problem types)
  2. **Multiplication Facts** (Grade 3, beginner)
  3. **Division Facts** (Grade 3, beginner)
  4. **Similar Figures & Proportions** (Grade 7, see above)
✅ **Typed answers, hints, steeper wrong-guess penalty, scratch whiteboard**
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
- `generateProblem()` returns structured problem data: `{ question, answer, mode, choices[] | value+tolerance, hint, explain, diagram? }`
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

3. **division** (Complete) - 4 problem types:
   - Basic division facts (no remainders)
   - Divide by 2
   - Divide by 5
   - Divide by 10

**How to Add a New Pack:**
1. Define pack object with `generateProblem()` method
2. Add to `PACKS` registry
3. Add its id to a grade in `src/math/grades.js`
4. Run `npm run test:unit`; see README for the full template

#### Race Logic (`src/scenes/RaceScene.js` + `RaceHudScene.js`)
- Simple kinematic driving (accelerate / brake / coast), slower on grass,
  much slower in river water; ramps and bumps launch the kart with a boost
- 2 laps x 3 checkpoint stars; the finish counts once all stars in the lap are done
- Progress = distance along the track loop, so positions compare fairly
- The HUD, touch pedals, Math Stop, pause, results and the mistake review
  run in a separate overlay scene that never scrolls with the camera

#### AI System (`src/game/AIKart.js`, `stepAI` in `raceLogic.js`)
- Rides the track loop in its own lane with a little wobble
- One AI kart takes the bridge, the other wades; both hop ramps
- Gentle rubber-banding keeps races close
- Pauses during countdown, Math Stops and pause

#### Track System (`src/game/trackBuilder.js`, `trackMath.js`)
- Each course is a closed list of rounded corners that becomes one loop of
  waypoints; the road art, AI path, checkpoints, features and progress
  tracking all come from it
- Checkpoints and features are lap fractions; decorations are seeded so
  they're the same every race and keep clear of the road, river and bridge
- Add a track by adding an entry to `COURSES` in `courses.js` (see "Adding a track" above)

#### Progression System
- Coins are the universal currency
- Multiple upgrade paths prevent linear progression
- The track ladder (100 / 250 / 450 / 700) provides medium- and long-term goals
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

`RaceScene.showMathStop()` calls `getProblemForGrade(grade)` at every star,
which picks one of that grade's packs at random. (The older examples in this
section predate typed answers and hints; follow the README template.)

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

2. **Grade-level selection only**: Kids pick Grade 3 or Grade 7; packs within a grade are mixed. Could allow picking single topics.

3. **Fixed checkpoint count**: Always 3 stars per lap, 2 laps. Could vary by track.
   Karts don't collide (they pass through each other, including at the
   Snow Circuit crossing).

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
- [x] Implement 2-3 more tracks (Pine Path, Snow Circuit, Night City)
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
  "unlockedCourses": ["forest", "desert", "pine"],
  "unlockedColors": ["red", "blue", "green"],
  "currentColor": "blue",
  "speedUpgrades": 2,
  "handlingUpgrades": 1,
  "difficulty": 1,
  "lastCourse": "forest",
  "grade": 7
}
```

## Credits

Built with Phaser 3 game engine (https://phaser.io)  
No licensed IP used - all original design  
Built by Cursor Cloud Agent for educational purposes
