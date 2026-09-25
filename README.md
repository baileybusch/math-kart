# 🏎️ Math Kart - Racing & Learning Game

A Mario Kart-style racing game for 3rd graders that teaches math through fun gameplay! Race go-karts, solve math problems at checkpoints, earn coins, and unlock upgrades.

## 🎮 PLAY NOW!

**🌐 Live Game (iPad/Browser):** https://baileybusch.github.io/math-kart/

✨ **iPad Optimized!** Works great on iPad Safari with touch controls. No installation needed — just open the link and play!

## 📱 Perfect for iPad

- **Touch controls** for easy gameplay on tablets
- **Big, tap-friendly buttons** for math answers
- **Responsive design** fits any screen size
- **Full-screen mode** on iOS Safari
- Works on desktop browsers too with keyboard controls

## 🎮 How to Play

### Quick Start (One Command)
```bash
npm install && npm run dev
```

Then open your browser to the URL shown (usually `http://localhost:5173`)

### Gameplay
1. **Race**: Use Arrow Keys or WASD to drive your kart around the track
2. **Checkpoints**: When you reach a yellow checkpoint, solve a math problem
   - ✅ Correct answer: Earn 5 coins and continue racing
   - ❌ Wrong answer: Lose 2 coins (never below 0) and continue after a short delay
3. **Finish**: Cross 3 checkpoints to finish the race
   - 🥇 1st place: 50 coins
   - 🥈 2nd place: 30 coins
   - 🥉 3rd place: 15 coins
4. **Shop**: Spend coins on:
   - Speed upgrades (30 coins each, max 5 levels)
   - Handling upgrades (30 coins each, max 5 levels)
   - Desert Track unlock (100 coins)
   - Kart color customization (20 coins each)

### Controls
- **iPad/Tablet**: Tap the on-screen buttons
  - Left/Right arrows: Steer
  - Up arrow: Gas
  - Down arrow: Brake
- **Desktop**: Arrow Keys or WASD
- **Math Problems**: Tap/Click the correct answer button

## 🧮 Math Content

**Three complete problem packs included from day one:**

### 1. Addition & Subtraction with Units
- Simple addition (2-digit numbers)
- Simple subtraction
- Liquid volume conversions (mL ↔ L)
- Mass conversions (g ↔ kg)  
- Length conversions (m ↔ cm)

### 2. Multiplication Facts (Beginner)
- Basic times tables (2-5 × 2-10)
- Multiply by 2
- Multiply by 5
- Multiply by 10
- **Coin multiplier: 1.3×** (earn more for harder problems!)

### 3. Division Facts (Beginner)
- Basic division (no remainders)
- Divide by 2
- Divide by 5
- Divide by 10
- **Coin multiplier: 1.4×** (earn even more!)

**Difficulty**: Gentle early-year 3rd grade level. Problems randomly mix from all three packs during races.

## 🎨 Features

- **2 Race Tracks**: Forest (starter) and Desert (unlockable)
- **AI Opponents**: Race against 2 computer-controlled karts
- **Persistent Progress**: All coins and unlocks saved automatically (localStorage)
- **Expandable Math System**: Easy to add new problem packs (see below)
- **Kid-Friendly Design**: Bright colors, big readable text, encouraging feedback

## 🔧 Development Setup

### Requirements
- Node.js (v16 or higher recommended)
- Modern web browser

### Installation
```bash
npm install
```

### Run Development Server
```bash
npm run dev
```

### Build for Production
```bash
npm run build
npm run preview
```

## 📦 Adding New Math Packs

Math packs are modular! Here's how to add a new one:

### 1. Edit `src/math/mathPacks.js`

Add your pack following this template:

```javascript
const myNewPack = {
    id: 'my-new-pack',           // Unique identifier
    name: 'My New Math Topic',   // Display name
    difficulty: 2,               // 1-5 scale
    coinMultiplier: 1.2,         // Bonus for harder topics
    
    generateProblem() {
        // Your problem generation logic
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
        // Generate 3 multiple choice options including the correct one
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

### 2. Register in the PACKS object

```javascript
const PACKS = {
    'add-subtract-units': addSubtractUnitsPack,
    'multiplication': multiplicationPack,
    'my-new-pack': myNewPack  // Add here!
};
```

### 3. Use in Race Scene

In `src/scenes/RaceScene.js`, change the pack used:

```javascript
this.currentProblem = getRandomProblem('my-new-pack');
```

## 🗂️ Project Structure

```
math-kart/
├── index.html              # Entry HTML
├── package.json            # Dependencies
├── src/
│   ├── main.js            # Game initialization
│   ├── scenes/
│   │   ├── MenuScene.js   # Main menu & course selection
│   │   ├── RaceScene.js   # Racing gameplay & math checkpoints
│   │   └── ShopScene.js   # Upgrades & unlockables
│   ├── game/
│   │   ├── trackBuilder.js # Track layouts & checkpoints
│   │   └── AIKart.js      # Computer opponent AI
│   ├── math/
│   │   └── mathPacks.js   # Expandable problem pack system
│   └── utils/
│       └── saveManager.js # localStorage persistence
├── README.md              # This file
└── NOTES.md              # Technical notes & next steps
```

## 🧹 Reset Progress

To clear all saved progress and start fresh, open browser console (F12) and run:
```javascript
localStorage.removeItem('mathKartSave');
```
Then refresh the page.

## 🎯 Target Audience

3rd graders (ages 7-9), early school year. Designed for parent-child play sessions.

## 📄 License

Built as a prototype. No licensed Mario IP used - all original art & assets.

---

**Have fun racing and learning! 🏁**
