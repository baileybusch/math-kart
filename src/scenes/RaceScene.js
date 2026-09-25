import Phaser from 'phaser';
import { getSaveData, updateSaveData } from '../utils/saveManager.js';
import { getProblemForGrade, normalizeGrade } from '../math/grades.js';
import { coinDelta, applyCoins } from '../math/scoring.js';
import { createTrack } from '../game/trackBuilder.js';
import { nearestOnLoop, pointAt } from '../game/trackMath.js';
import AIKart from '../game/AIKart.js';
import { COLORS, drawKart, kartColor } from '../ui/theme.js';

export const LAPS = 2;
export const PRIZES = [50, 30, 15];

// Smoke tests set window.__mathKartForce = { kind, input, pack } to pick the
// next Math Stop's problem type. Used once, then cleared.
function takeForcedProblem() {
    if (typeof window === 'undefined' || !window.__mathKartForce) return null;
    const force = window.__mathKartForce;
    window.__mathKartForce = null;
    return force;
}

export default class RaceScene extends Phaser.Scene {
    constructor() {
        super({ key: 'RaceScene' });
    }

    init(data) {
        this.courseId = (data && data.course) || 'forest';
    }

    create() {
        const save = getSaveData();
        save.lastCourse = this.courseId;
        updateSaveData(save);

        this.coins = save.coins;
        this.grade = normalizeGrade(save.grade);
        this.lap = 0;
        this.cpInLap = 0;
        this.raceStarted = false;
        this.raceFinished = false;
        this.isPaused = true;
        this.menuPaused = false;
        this.inMathStop = false;
        this.finishOrder = [];
        this.stats = { correct: 0, asked: 0, hints: 0 };
        this.hud = null;

        this.track = createTrack(this, this.courseId);
        const L = this.track.loop.total;
        this.trackLength = L;

        this.player = this.createPlayer(save);
        this.aiKarts = [
            new AIKart(this, this.track, { name: 'Zoom', color: COLORS.orange, speed: 225, lane: -48, along: -70 }),
            new AIKart(this, this.track, { name: 'Bolt', color: COLORS.blue, speed: 205, lane: 0, along: -170 })
        ];

        this.arrow = this.add.graphics();
        this.arrow.fillStyle(COLORS.yellow, 1);
        this.arrow.lineStyle(5, COLORS.ink, 1);
        this.arrow.beginPath();
        this.arrow.moveTo(0, -42);
        this.arrow.lineTo(32, 18);
        this.arrow.lineTo(0, 4);
        this.arrow.lineTo(-32, 18);
        this.arrow.closePath();
        this.arrow.fillPath();
        this.arrow.strokePath();

        const cam = this.cameras.main;
        cam.setBounds(0, 0, this.track.width, this.track.height);
        cam.startFollow(this.player, true, 0.12, 0.12);
        cam.setRoundPixels(true);

        this.cursors = this.input.keyboard ? this.input.keyboard.createCursorKeys() : null;
        this.wasd = this.input.keyboard ? this.input.keyboard.addKeys('W,A,S,D') : null;

        // The HUD scene owns leaving the race (it stops this scene itself).
        this.scene.launch('RaceHudScene', { race: this });
        this.updateArrow();
    }

    createPlayer(save) {
        const start = pointAt(this.track.loop, -70);
        const kart = drawKart(this.add.graphics(), kartColor(save.currentColor));
        kart.x = start.x + start.normX * 48;
        kart.y = start.y + start.normY * 48;
        kart.rotation = Math.atan2(start.dirX, -start.dirY);
        kart.setDepth(5);

        kart.speed = 0;
        kart.maxSpeed = 300 + save.speedUpgrades * 30;
        kart.acceleration = 230 + save.speedUpgrades * 20;
        kart.turnSpeed = 2.6 + save.handlingUpgrades * 0.3;
        kart.segHint = this.track.loop.segs.length - 1;
        kart.along = -70;
        kart.offRoad = false;
        return kart;
    }

    // Called by the HUD once the 3-2-1 countdown ends.
    startRace() {
        this.raceStarted = true;
        this.isPaused = false;
        this.aiKarts.forEach((ai) => ai.resume());
    }

    setMenuPaused(paused) {
        this.menuPaused = paused;
        this.refreshPause();
    }

    refreshPause() {
        const paused = this.menuPaused || this.inMathStop || !this.raceStarted || this.raceFinished;
        this.isPaused = paused;
        this.aiKarts.forEach((ai) => (paused ? ai.pause() : ai.resume()));
        if (paused) this.player.speed = 0;
    }

    get playerProgress() {
        return this.lap * this.trackLength + this.player.along;
    }

    update(time, delta) {
        const dt = Math.min(delta, 50);
        if (!this.isPaused) {
            this.drivePlayer(dt);
            this.trackPlayerProgress();
            const progress = this.playerProgress;
            this.aiKarts.forEach((ai) => {
                ai.update(dt, progress);
                if (!ai.finished && ai.progress >= LAPS * this.trackLength) {
                    ai.finish();
                    this.finishOrder.push(ai.name);
                }
            });
            this.checkCheckpoints();
        }
        this.updateArrow();
    }

    readControls() {
        const touch = this.hud ? this.hud.controls : {};
        const c = this.cursors;
        const k = this.wasd;
        return {
            forward: !!(touch.forward || (c && c.up.isDown) || (k && k.W.isDown)),
            backward: !!(touch.backward || (c && c.down.isDown) || (k && k.S.isDown)),
            left: !!(touch.left || (c && c.left.isDown) || (k && k.A.isDown)),
            right: !!(touch.right || (c && c.right.isDown) || (k && k.D.isDown))
        };
    }

    drivePlayer(delta) {
        const kart = this.player;
        const dt = delta / 1000;
        const input = this.readControls();

        if (input.forward) {
            kart.speed = Math.min(kart.speed + kart.acceleration * dt, kart.maxSpeed);
        } else if (input.backward) {
            kart.speed = Math.max(kart.speed - kart.acceleration * 1.6 * dt, -kart.maxSpeed * 0.4);
        } else {
            kart.speed *= Math.max(0, 1 - 1.6 * dt);
        }

        const cap = kart.offRoad ? kart.maxSpeed * 0.55 : kart.maxSpeed;
        if (kart.speed > cap) kart.speed = Math.max(cap, kart.speed - 500 * dt);

        const steer = (input.right ? 1 : 0) - (input.left ? 1 : 0);
        if (steer !== 0) {
            const grip = 0.45 + 0.55 * Math.min(1, Math.abs(kart.speed) / 160);
            const dir = kart.speed < -5 ? -1 : 1;
            kart.rotation += steer * dir * kart.turnSpeed * grip * dt;
        }

        kart.x += Math.sin(kart.rotation) * kart.speed * dt;
        kart.y -= Math.cos(kart.rotation) * kart.speed * dt;
        kart.x = Phaser.Math.Clamp(kart.x, 40, this.track.width - 40);
        kart.y = Phaser.Math.Clamp(kart.y, 40, this.track.height - 40);
    }

    trackPlayerProgress() {
        const kart = this.player;
        const L = this.trackLength;
        const near = nearestOnLoop(this.track.loop, kart.x, kart.y, kart.segHint);
        kart.segHint = near.seg;
        kart.offRoad = near.dist > this.track.roadHalfWidth + 10;

        let along = near.along;
        const allCheckpointsDone = this.cpInLap >= this.track.checkpoints.length;
        if (this.cpInLap === 0 && along > L * 0.75) along -= L;
        if (allCheckpointsDone && along < L * 0.25) along += L;
        kart.along = along;

        if (allCheckpointsDone && along >= L) {
            this.lap++;
            this.cpInLap = 0;
            kart.along -= L;
            if (this.lap >= LAPS) {
                this.finishRace();
            } else if (this.hud) {
                this.hud.flashMessage('Lap ' + (this.lap + 1) + '!');
            }
        }
    }

    nextTarget() {
        if (this.cpInLap < this.track.checkpoints.length) return this.track.checkpoints[this.cpInLap];
        const p = pointAt(this.track.loop, 0);
        return { x: p.x, y: p.y, isFinish: true };
    }

    checkCheckpoints() {
        if (this.raceFinished || this.cpInLap >= this.track.checkpoints.length) return;
        const cp = this.track.checkpoints[this.cpInLap];
        const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, cp.x, cp.y);
        if (dist < 135) {
            this.cpInLap++;
            this.showMathStop();
        }
    }

    showMathStop() {
        if (!this.hud) return;
        this.inMathStop = true;
        this.refreshPause();
        const problem = getProblemForGrade(this.grade, takeForcedProblem());
        const label = 'Grade ' + this.grade + ' \u2022 Lap ' + (this.lap + 1) + ' \u2022 Star ' + this.cpInLap;
        let scored = false;
        this.hud.showMathProblem(problem, label, (result) => {
            const delta = coinDelta(result.correct, result.hintUsed);
            if (scored) return delta;
            scored = true;
            this.stats.asked++;
            if (result.correct) this.stats.correct++;
            if (result.hintUsed) this.stats.hints++;
            this.coins = applyCoins(this.coins, delta);
            this.persistCoins();
            return delta;
        }, () => {
            this.inMathStop = false;
            this.refreshPause();
        });
    }

    persistCoins() {
        const save = getSaveData();
        save.coins = this.coins;
        updateSaveData(save);
    }

    finishRace() {
        if (this.raceFinished) return;
        this.raceFinished = true;
        this.refreshPause();

        const position = this.finishOrder.length + 1;
        const prize = PRIZES[position - 1] || 5;
        this.coins += prize;
        this.persistCoins();

        if (this.hud) {
            this.hud.showResults({ position, prize, coins: this.coins, stats: this.stats, course: this.courseId });
        }
    }

    currentPosition() {
        if (this.raceFinished) return this.finishOrder.length + 1;
        const mine = this.playerProgress;
        let ahead = 0;
        this.aiKarts.forEach((ai) => {
            if (ai.finished || ai.progress > mine) ahead++;
        });
        return ahead + 1;
    }

    updateArrow() {
        const target = this.nextTarget();
        const kart = this.player;
        const dx = target.x - kart.x;
        const dy = target.y - kart.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const show = !this.raceFinished && dist > 220;
        this.arrow.setVisible(show);
        if (!show) return;
        const angle = Math.atan2(dy, dx);
        this.arrow.x = kart.x + Math.cos(angle) * 115;
        this.arrow.y = kart.y + Math.sin(angle) * 115;
        this.arrow.rotation = angle + Math.PI / 2;
        this.arrow.setDepth(6);
    }
}
