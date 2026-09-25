import Phaser from 'phaser';
import { getSaveData, updateSaveData } from '../utils/saveManager.js';
import { getRandomProblem } from '../math/mathPacks.js';
import { createTrack } from '../game/trackBuilder.js';
import AIKart from '../game/AIKart.js';

export default class RaceScene extends Phaser.Scene {
    constructor() {
        super({ key: 'RaceScene' });
        this.isPaused = false;
        this.checkpointsPassed = 0;
        this.totalCheckpoints = 3;
        this.raceFinished = false;
    }

    init(data) {
        this.courseId = data.course || 'forest';
    }

    create() {
        const save = getSaveData();
        this.coins = save.coins;
        this.currentProblem = null;
        this.checkpointsPassed = 0;
        this.raceFinished = false;
        this.isPaused = false;

        // Touch control state
        this.touchControls = {
            left: false,
            right: false,
            forward: false,
            backward: false
        };

        // Create track
        this.track = createTrack(this, this.courseId);
        
        // Create player kart
        this.player = this.createPlayerKart(200, 300, save);
        
        // Create AI karts
        this.aiKarts = [
            new AIKart(this, 180, 320, 0xFF6B6B, 'AI-1'),
            new AIKart(this, 220, 320, 0x4ECDC4, 'AI-2')
        ];

        // Camera follows player
        this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
        this.cameras.main.setBounds(0, 0, this.track.width, this.track.height);

        // UI
        this.createUI();

        // Touch controls for iPad
        this.createTouchControls();

        // Input
        this.cursors = this.input.keyboard.createCursorKeys();
        this.wasd = {
            up: this.input.keyboard.addKey('W'),
            down: this.input.keyboard.addKey('S'),
            left: this.input.keyboard.addKey('A'),
            right: this.input.keyboard.addKey('D')
        };
    }

    createPlayerKart(x, y, save) {
        const colorMap = {
            'red': 0xFF4444,
            'blue': 0x4444FF,
            'green': 0x44FF44,
            'yellow': 0xFFFF44,
            'purple': 0xFF44FF
        };
        const color = colorMap[save.currentColor] || 0xFF4444;

        const kart = this.add.rectangle(x, y, 40, 60, color)
            .setStrokeStyle(4, 0x000000);
        
        this.physics.add.existing(kart);
        kart.body.setCollideWorldBounds(true);
        kart.body.setMaxVelocity(300 + save.speedUpgrades * 30);
        kart.body.setDrag(100 + save.handlingUpgrades * 20);
        
        kart.speed = 0;
        kart.maxSpeed = 300 + save.speedUpgrades * 30;
        kart.acceleration = 200 + save.speedUpgrades * 20;
        kart.turnSpeed = 3 + save.handlingUpgrades * 0.5;
        kart.lap = 0;
        kart.progress = 0;

        return kart;
    }

    createUI() {
        const cam = this.cameras.main;
        
        // Coins display (fixed to camera)
        this.coinsText = this.add.text(20, 20, '', {
            fontSize: '32px',
            fontFamily: 'Arial',
            color: '#FFD700',
            stroke: '#000000',
            strokeThickness: 4
        }).setScrollFactor(0).setDepth(1000);
        this.updateCoinsDisplay();

        // Checkpoint progress
        this.checkpointText = this.add.text(20, 60, '', {
            fontSize: '28px',
            fontFamily: 'Arial',
            color: '#FFFFFF',
            stroke: '#000000',
            strokeThickness: 4
        }).setScrollFactor(0).setDepth(1000);
        this.updateCheckpointDisplay();

        // Position display
        this.positionText = this.add.text(cam.width - 20, 20, '', {
            fontSize: '36px',
            fontFamily: 'Arial',
            color: '#FFFFFF',
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(1, 0).setScrollFactor(0).setDepth(1000);
    }

    updateCoinsDisplay() {
        this.coinsText.setText(`💰 ${this.coins}`);
    }

    updateCheckpointDisplay() {
        this.checkpointText.setText(`📍 Checkpoint: ${this.checkpointsPassed}/${this.totalCheckpoints}`);
    }

    update(time, delta) {
        if (this.isPaused || this.raceFinished) return;

        // Player controls
        this.handlePlayerInput(delta);

        // Update AI
        this.aiKarts.forEach(ai => ai.update(delta, this.track.path));

        // Check checkpoints
        this.checkCheckpoints();

        // Update position display
        this.updatePositions();
    }

    handlePlayerInput(delta) {
        const kart = this.player;
        const dt = delta / 1000;

        // Check keyboard or touch for forward/backward
        const isForward = this.cursors.up.isDown || this.wasd.up.isDown || this.touchControls.forward;
        const isBackward = this.cursors.down.isDown || this.wasd.down.isDown || this.touchControls.backward;
        const isLeft = this.cursors.left.isDown || this.wasd.left.isDown || this.touchControls.left;
        const isRight = this.cursors.right.isDown || this.wasd.right.isDown || this.touchControls.right;

        // Forward/backward
        if (isForward) {
            kart.speed = Math.min(kart.speed + kart.acceleration * dt, kart.maxSpeed);
        } else if (isBackward) {
            kart.speed = Math.max(kart.speed - kart.acceleration * dt, -kart.maxSpeed * 0.5);
        } else {
            // Slow down
            kart.speed *= 0.97;
        }

        // Turning
        if (isLeft) {
            kart.rotation -= kart.turnSpeed * dt;
        }
        if (isRight) {
            kart.rotation += kart.turnSpeed * dt;
        }

        // Apply velocity
        const vx = Math.sin(kart.rotation) * kart.speed;
        const vy = -Math.cos(kart.rotation) * kart.speed;
        kart.body.setVelocity(vx, vy);
    }

    checkCheckpoints() {
        if (this.checkpointsPassed >= this.totalCheckpoints) {
            if (!this.raceFinished) {
                this.finishRace();
            }
            return;
        }

        const checkpoint = this.track.checkpoints[this.checkpointsPassed];
        const dist = Phaser.Math.Distance.Between(
            this.player.x, this.player.y,
            checkpoint.x, checkpoint.y
        );

        if (dist < 80) {
            this.checkpointsPassed++;
            this.updateCheckpointDisplay();
            
            if (this.checkpointsPassed < this.totalCheckpoints) {
                this.showMathProblem();
            } else {
                this.finishRace();
            }
        }
    }

    showMathProblem() {
        this.isPaused = true;
        this.player.body.setVelocity(0, 0);
        this.aiKarts.forEach(ai => ai.pause());

        // Randomly select from all available packs
        const packs = ['add-subtract-units', 'multiplication', 'division'];
        const randomPack = Phaser.Utils.Array.GetRandom(packs);
        this.currentProblem = getRandomProblem(randomPack);

        // Create modal backdrop
        const cam = this.cameras.main;
        const backdrop = this.add.rectangle(
            cam.scrollX + cam.width / 2,
            cam.scrollY + cam.height / 2,
            cam.width,
            cam.height,
            0x000000,
            0.7
        ).setScrollFactor(0).setDepth(2000);

        const modal = this.add.container(cam.scrollX + cam.width / 2, cam.scrollY + cam.height / 2)
            .setScrollFactor(0)
            .setDepth(2001);

        // Modal background
        const bg = this.add.rectangle(0, 0, 600, 400, 0xFFFFFF)
            .setStrokeStyle(8, 0x000000);
        modal.add(bg);

        // Problem text
        const problemText = this.add.text(0, -120, this.currentProblem.question, {
            fontSize: '36px',
            fontFamily: 'Arial',
            color: '#000000',
            align: 'center',
            wordWrap: { width: 550 }
        }).setOrigin(0.5);
        modal.add(problemText);

        // Answer buttons - bigger for touch
        const answers = this.currentProblem.choices;
        const buttonY = 40;
        const spacing = 120;

        answers.forEach((answer, index) => {
            const x = (index - 1) * spacing;
            
            const btn = this.add.rectangle(x, buttonY, 100, 80, 0x4CAF50)
                .setStrokeStyle(4, 0x000000)
                .setInteractive({ useHandCursor: true });

            const text = this.add.text(x, buttonY, answer, {
                fontSize: '36px',
                fontFamily: 'Arial',
                color: '#FFFFFF',
                stroke: '#000000',
                strokeThickness: 4
            }).setOrigin(0.5);

            btn.on('pointerdown', () => {
                this.checkAnswer(answer, modal, backdrop);
            });

            btn.on('pointerover', () => btn.setFillStyle(0x66BB6A));
            btn.on('pointerout', () => btn.setFillStyle(0x4CAF50));

            modal.add([btn, text]);
        });

        this.mathModal = { modal, backdrop };
    }

    checkAnswer(selectedAnswer, modal, backdrop) {
        const correct = selectedAnswer === this.currentProblem.answer;
        
        // Feedback
        const feedbackColor = correct ? '#00FF00' : '#FF0000';
        const feedbackText = correct ? '✅ CORRECT! +5 coins!' : '❌ Wrong! -2 coins';
        
        const feedback = this.add.text(
            modal.x,
            modal.y + 150,
            feedbackText,
            {
                fontSize: '32px',
                fontFamily: 'Arial',
                color: feedbackColor,
                stroke: '#000000',
                strokeThickness: 4
            }
        ).setOrigin(0.5).setScrollFactor(0).setDepth(2002);

        if (correct) {
            this.coins += 5;
        } else {
            this.coins = Math.max(0, this.coins - 2);
        }
        this.updateCoinsDisplay();

        // Close modal after delay
        this.time.delayedCall(correct ? 1000 : 2000, () => {
            modal.destroy();
            backdrop.destroy();
            feedback.destroy();
            this.isPaused = false;
            this.aiKarts.forEach(ai => ai.resume());
        });
    }

    finishRace() {
        this.raceFinished = true;
        this.player.body.setVelocity(0, 0);
        this.aiKarts.forEach(ai => ai.stop());

        // Determine position
        const position = this.calculatePosition();
        const prizes = [50, 30, 15, 5];
        const prize = prizes[position - 1] || 0;
        this.coins += prize;

        // Save progress
        const save = getSaveData();
        save.coins = this.coins;
        updateSaveData(save);

        // Results modal
        const cam = this.cameras.main;
        const backdrop = this.add.rectangle(
            cam.scrollX + cam.width / 2,
            cam.scrollY + cam.height / 2,
            cam.width,
            cam.height,
            0x000000,
            0.8
        ).setScrollFactor(0).setDepth(3000);

        const modal = this.add.container(cam.scrollX + cam.width / 2, cam.scrollY + cam.height / 2)
            .setScrollFactor(0)
            .setDepth(3001);

        const bg = this.add.rectangle(0, 0, 700, 500, 0xFFD700)
            .setStrokeStyle(10, 0xFF4500);
        modal.add(bg);

        const positionEmojis = ['🥇', '🥈', '🥉', '4️⃣'];
        const emoji = positionEmojis[position - 1] || '🏁';

        modal.add(this.add.text(0, -150, `${emoji} ${position}${this.getOrdinalSuffix(position)} PLACE! ${emoji}`, {
            fontSize: '48px',
            fontFamily: 'Arial',
            color: '#000000',
            stroke: '#FFFFFF',
            strokeThickness: 4
        }).setOrigin(0.5));

        modal.add(this.add.text(0, -50, `Prize: ${prize} coins 💰`, {
            fontSize: '36px',
            fontFamily: 'Arial',
            color: '#000000',
            stroke: '#FFFFFF',
            strokeThickness: 3
        }).setOrigin(0.5));

        modal.add(this.add.text(0, 20, `Total Coins: ${this.coins} 💰`, {
            fontSize: '32px',
            fontFamily: 'Arial',
            color: '#000000',
            stroke: '#FFFFFF',
            strokeThickness: 3
        }).setOrigin(0.5));

        // Back button
        const backBtn = this.add.rectangle(0, 120, 250, 60, 0x4CAF50)
            .setStrokeStyle(4, 0x000000)
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => {
                this.scene.start('MenuScene');
            })
            .on('pointerover', () => backBtn.setFillStyle(0x66BB6A))
            .on('pointerout', () => backBtn.setFillStyle(0x4CAF50));

        modal.add(backBtn);
        modal.add(this.add.text(0, 120, 'BACK TO MENU', {
            fontSize: '28px',
            fontFamily: 'Arial',
            color: '#FFFFFF',
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(0.5));
    }

    calculatePosition() {
        const racers = [
            { name: 'Player', progress: this.checkpointsPassed + (this.track.checkpoints[0] ? 
                1 - Phaser.Math.Distance.Between(this.player.x, this.player.y, 
                    this.track.checkpoints[Math.min(this.checkpointsPassed, this.track.checkpoints.length - 1)].x,
                    this.track.checkpoints[Math.min(this.checkpointsPassed, this.track.checkpoints.length - 1)].y) / 1000 : 0)
            },
            ...this.aiKarts.map(ai => ({ name: ai.name, progress: ai.checkpointIndex + ai.pathProgress }))
        ];

        racers.sort((a, b) => b.progress - a.progress);
        return racers.findIndex(r => r.name === 'Player') + 1;
    }

    updatePositions() {
        const position = this.calculatePosition();
        this.positionText.setText(`Position: ${position}${this.getOrdinalSuffix(position)}`);
    }

    createTouchControls() {
        const cam = this.cameras.main;
        const buttonSize = 80;
        const buttonAlpha = 0.6;

        // Left steering button
        const leftBtn = this.add.circle(100, cam.height - 100, buttonSize / 2, 0x4CAF50, buttonAlpha)
            .setScrollFactor(0)
            .setDepth(1000)
            .setInteractive();

        this.add.text(100, cam.height - 100, '←', {
            fontSize: '48px',
            fontFamily: 'Arial',
            color: '#FFFFFF'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(1001);

        leftBtn.on('pointerdown', () => { this.touchControls.left = true; });
        leftBtn.on('pointerup', () => { this.touchControls.left = false; });
        leftBtn.on('pointerout', () => { this.touchControls.left = false; });

        // Right steering button
        const rightBtn = this.add.circle(220, cam.height - 100, buttonSize / 2, 0x4CAF50, buttonAlpha)
            .setScrollFactor(0)
            .setDepth(1000)
            .setInteractive();

        this.add.text(220, cam.height - 100, '→', {
            fontSize: '48px',
            fontFamily: 'Arial',
            color: '#FFFFFF'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(1001);

        rightBtn.on('pointerdown', () => { this.touchControls.right = true; });
        rightBtn.on('pointerup', () => { this.touchControls.right = false; });
        rightBtn.on('pointerout', () => { this.touchControls.right = false; });

        // Forward/Gas button
        const forwardBtn = this.add.circle(cam.width - 100, cam.height - 100, buttonSize / 2, 0xFF9800, buttonAlpha)
            .setScrollFactor(0)
            .setDepth(1000)
            .setInteractive();

        this.add.text(cam.width - 100, cam.height - 100, '↑', {
            fontSize: '48px',
            fontFamily: 'Arial',
            color: '#FFFFFF'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(1001);

        forwardBtn.on('pointerdown', () => { this.touchControls.forward = true; });
        forwardBtn.on('pointerup', () => { this.touchControls.forward = false; });
        forwardBtn.on('pointerout', () => { this.touchControls.forward = false; });

        // Backward/Brake button
        const backwardBtn = this.add.circle(cam.width - 220, cam.height - 100, buttonSize / 2, 0xF44336, buttonAlpha)
            .setScrollFactor(0)
            .setDepth(1000)
            .setInteractive();

        this.add.text(cam.width - 220, cam.height - 100, '↓', {
            fontSize: '48px',
            fontFamily: 'Arial',
            color: '#FFFFFF'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(1001);

        backwardBtn.on('pointerdown', () => { this.touchControls.backward = true; });
        backwardBtn.on('pointerup', () => { this.touchControls.backward = false; });
        backwardBtn.on('pointerout', () => { this.touchControls.backward = false; });

        // Store references for cleanup
        this.touchButtons = [leftBtn, rightBtn, forwardBtn, backwardBtn];
    }

    getOrdinalSuffix(num) {
        const j = num % 10;
        const k = num % 100;
        if (j === 1 && k !== 11) return 'st';
        if (j === 2 && k !== 12) return 'nd';
        if (j === 3 && k !== 13) return 'rd';
        return 'th';
    }
}
