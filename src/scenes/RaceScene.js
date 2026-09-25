import Phaser from 'phaser';
import { getSaveData, updateSaveData } from '../utils/saveManager.js';
import { getProblemForGrade, getGrade } from '../math/grades.js';
import { coinDelta, coinRules, reviewBonus } from '../math/economy.js';
import { createTrack } from '../game/trackBuilder.js';
import { pointAt } from '../game/trackMath.js';
import {
    kartStats, stepKart, updateProgress, updateFeatures, reachedCheckpoint, airHeight
} from '../game/raceLogic.js';
import { courseStatus } from '../game/courses.js';
import AIKart from '../game/AIKart.js';
import { COLORS, FONT, drawKart, kartColor } from '../ui/theme.js';

export const LAPS = 2;

export default class RaceScene extends Phaser.Scene {
    constructor() {
        super({ key: 'RaceScene' });
    }

    init(data) {
        this.courseId = (data && data.course) || 'forest';
        if (courseStatus(this.courseId, getSaveData().unlockedCourses) !== 'unlocked') this.courseId = 'forest';
    }

    create() {
        const save = getSaveData();
        save.lastCourse = this.courseId;
        updateSaveData(save);

        this.coins = save.coins;
        this.grade = getGrade(save.grade).id;
        this.lap = 0;
        this.cpInLap = 0;
        this.raceStarted = false;
        this.raceFinished = false;
        this.isPaused = true;
        this.menuPaused = false;
        this.inMathStop = false;
        this.finishOrder = [];
        this.stats = { correct: 0, asked: 0, hints: 0 };
        // Every Math Stop this race, for the review on the results screen.
        // Lives only as long as this scene; nothing here is saved.
        this.stopLog = [];
        this.reviewClaimed = 0;
        this.shownTips = {};
        this.lastSplash = 0;
        this.hud = null;

        this.track = createTrack(this, this.courseId);
        const L = this.track.loop.total;
        this.trackLength = L;

        this.player = this.createPlayer(save);
        this.aiKarts = [
            new AIKart(this, this.track, { name: 'Zoom', color: COLORS.orange, speed: 225 * this.track.aiSpeed, lane: -48, along: -70, useBridge: true }),
            new AIKart(this, this.track, { name: 'Bolt', color: COLORS.blue, speed: 205 * this.track.aiSpeed, lane: 0, along: -170, useBridge: false })
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
        this.playerShadow = this.add.ellipse(0, 0, 50, 34, 0x000000, 0.28).setDepth(4).setVisible(false);
        const kart = drawKart(this.add.graphics(), kartColor(save.currentColor));
        kart.x = start.x + start.normX * 48;
        kart.y = start.y + start.normY * 48;
        kart.rotation = Math.atan2(start.dirX, -start.dirY);
        kart.setDepth(5);

        kart.speed = 0;
        Object.assign(kart, kartStats(save));
        kart.segHint = this.track.loop.segs.length - 1;
        kart.along = -70;
        kart.offRoad = false;
        kart.air = 0;
        kart.boost = 0;
        kart.inWater = false;
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
            this.handleFeatures(time);
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
        this.drawPlayerAir();
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
        stepKart(this.player, this.readControls(), delta / 1000, this.track.width, this.track.height);
    }

    trackPlayerProgress() {
        if (!updateProgress(this, this.player, this.track)) return;
        if (this.lap >= LAPS) {
            this.finishRace();
        } else if (this.hud) {
            this.hud.flashMessage('Lap ' + (this.lap + 1) + '!');
        }
    }

    handleFeatures(time) {
        const kart = this.player;
        const event = updateFeatures(kart, this.track);
        if (event === 'jump') {
            this.popText(kart.x, kart.y - 60, 'WHOOSH!', '#ff922b');
        } else if (event === 'bump') {
            this.popText(kart.x, kart.y - 50, 'Boing!', '#ffffff');
        } else if (event === 'splash') {
            this.tip('water', 'Splash! Water is slow. Try the bridge!');
        }
        if (kart.inWater && Math.abs(kart.speed) > 20 && time - this.lastSplash > 110) {
            this.lastSplash = time;
            this.splash(kart.x, kart.y);
        }
    }

    tip(key, message) {
        if (this.shownTips[key] || !this.hud) return;
        this.shownTips[key] = true;
        this.hud.flashTip(message);
    }

    popText(x, y, text, color) {
        const t = this.add.text(x, y, text, {
            fontFamily: FONT, fontSize: '40px', fontStyle: 'bold', color, stroke: '#1d2b53', strokeThickness: 7
        }).setOrigin(0.5).setDepth(8);
        this.tweens.add({ targets: t, y: y - 60, alpha: 0, duration: 700, ease: 'Cubic.easeOut', onComplete: () => t.destroy() });
    }

    splash(x, y) {
        for (let i = 0; i < 3; i++) {
            const a = Math.random() * Math.PI * 2;
            const drop = this.add.circle(x + Math.cos(a) * 22, y + Math.sin(a) * 22, 7 + Math.random() * 5, i ? 0xe7f5ff : 0x74c0fc, 0.95).setDepth(6);
            this.tweens.add({
                targets: drop,
                x: drop.x + Math.cos(a) * 40,
                y: drop.y + Math.sin(a) * 40,
                scale: 0.3,
                alpha: 0,
                duration: 420,
                onComplete: () => drop.destroy()
            });
        }
    }

    drawPlayerAir() {
        const kart = this.player;
        const h = airHeight(kart);
        kart.setScale(1 + 0.35 * h);
        this.playerShadow.setVisible(h > 0.02);
        if (h > 0.02) {
            this.playerShadow.setPosition(kart.x + 14 * h, kart.y + 34 * h);
            this.playerShadow.setScale(1 - 0.3 * h);
        }
    }

    nextTarget() {
        if (this.cpInLap < this.track.checkpoints.length) return this.track.checkpoints[this.cpInLap];
        const p = pointAt(this.track.loop, 0);
        return { x: p.x, y: p.y, isFinish: true };
    }

    checkCheckpoints() {
        if (this.raceFinished || !reachedCheckpoint(this, this.player, this.track)) return;
        this.cpInLap++;
        this.showMathStop();
    }

    showMathStop() {
        if (!this.hud || this.inMathStop || this.raceFinished) return;
        this.inMathStop = true;
        this.refreshPause();
        const grade = this.grade;
        const problem = getProblemForGrade(grade);
        const lap = this.lap + 1;
        const star = this.cpInLap;
        const label = getGrade(grade).label + ' \u2022 Lap ' + lap + ' \u2022 Star ' + star;
        let scored = false;
        this.hud.showMathProblem(problem, { subtitle: label, rules: coinRules(grade) }, (result) => {
            if (scored) return 0;
            scored = true;
            const delta = coinDelta(grade, result.correct, result.hintUsed);
            this.stats.asked++;
            if (result.correct) this.stats.correct++;
            if (result.hintUsed) this.stats.hints++;
            this.stopLog.push({ problem, correct: result.correct, hintUsed: result.hintUsed, given: result.given, delta, lap, star });
            this.coins = Math.max(0, this.coins + delta);
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

    mistakes() {
        return this.stopLog.filter((s) => !s.correct);
    }

    /** Coins the mistake review would pay right now (0 once claimed). */
    reviewBonusOnOffer() {
        if (!this.raceFinished || this.reviewClaimed) return 0;
        return reviewBonus(this.grade, this.mistakes().length);
    }

    /** Pays the review bonus once, and only after a finished race. */
    claimReviewBonus() {
        const bonus = this.reviewBonusOnOffer();
        if (!bonus) return 0;
        this.reviewClaimed = bonus;
        this.coins += bonus;
        this.persistCoins();
        return bonus;
    }

    finishRace() {
        if (this.raceFinished) return;
        this.raceFinished = true;
        this.refreshPause();

        const position = this.finishOrder.length + 1;
        const prize = this.track.prizes[position - 1] || 5;
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
