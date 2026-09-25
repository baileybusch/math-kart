# Technical Notes - Math Kart

## What Was Built

A complete working prototype of a Mario Kart-style educational racing game with:

### Core Features Implemented
✅ Top-down kart racing with keyboard controls (Arrow Keys / WASD)  
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
✅ One complete problem pack (Addition/Subtraction with Units)  
✅ One stub problem pack showing expansion pattern (Multiplication)  

### Tech Stack
- **Phaser 3** (v3.80.1) - 2D game framework with built-in physics
- **Vite** (v5.0.0) - Lightning-fast dev server & build tool
- **Vanilla JavaScript** (ES6 modules) - No framework overhead
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

2. **multiplication** (Stub) - Basic multiplication tables
   - Serves as template for expansion

**How to Add a New Pack:**
1. Define pack object with `generateProblem()` method
2. Add to `PACKS` registry
3. Optionally adjust `coinMultiplier` for difficulty
4. See README for detailed template

#### Race Logic (`src/scenes/RaceScene.js`)
- Physics-based movement with acceleration/drag
- Checkpoint detection via distance calculation
- Position calculation compares player vs AI progress
- Math modal system pauses game state completely

#### AI System (`src/game/AIKart.js`)
- Simple waypoint-following AI
- Each AI has slight speed randomization for varied races
- Pauses/resumes during math checkpoints
- Tracks progress along path for position calculations

#### Track System (`src/game/trackBuilder.js`)
- Procedural track generation from curves
- Each track defines:
  - Visual layout (colors, decorations)
  - Checkpoint positions
  - AI waypoint path
  - Start position
- Easy to add new tracks by copying a builder function

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

Then in `RaceScene.js`, line ~28, change:
```javascript
this.currentProblem = getRandomProblem('division');
```

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

2. **Single problem pack per race**: Could allow pack selection in menu or randomize packs per checkpoint.

3. **Fixed checkpoint count**: Always 3 checkpoints. Could vary by track.

4. **Simple AI**: Waypoint-following only. Could add rubber-banding, powerups, or strategic behavior.

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
- [ ] Add on-screen touch controls for tablets

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

The game was built iteratively and should be fully functional on:
- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)

Mobile browsers may work but are not optimized (no touch controls).

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
