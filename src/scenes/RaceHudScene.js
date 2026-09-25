import Phaser from 'phaser';
import {
    GAME_WIDTH, GAME_HEIGHT, COLORS, INK, textStyle, addTitle, drawPanel,
    createButton, createCoinPill, ordinal
} from '../ui/theme.js';
import { LAPS } from './RaceScene.js';
import { showMathStop } from '../ui/mathStop.js';
import { showReview } from '../ui/reviewMistakes.js';
import { closeWhiteboard } from '../ui/whiteboard.js';

const W = GAME_WIDTH;
const H = GAME_HEIGHT;
const MEDAL_COLORS = [0xffd43b, 0xdee2e6, 0xe8a060];
// Results card centre and button offsets (the smoke test taps these).
export const RESULTS = { x: W / 2, y: H / 2 + 10, reviewDy: 42, buttonsDy: 226 };

/**
 * Everything drawn on top of the race: HUD, touch pedals, countdown, math
 * stops, pause and results. Runs as its own scene so nothing here scrolls
 * with the race camera.
 */
export default class RaceHudScene extends Phaser.Scene {
    constructor() {
        super({ key: 'RaceHudScene' });
    }

    init(data) {
        this.race = data.race;
    }

    create() {
        this.race.hud = this;
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            if (this.race && this.race.hud === this) this.race.hud = null;
            closeWhiteboard();
        });

        this.controls = { left: false, right: false, forward: false, backward: false };
        this.modalOpen = false;
        this.whiteboardOpen = false;
        this.math = null;
        this.lastCoins = null;
        this.lastPosition = null;

        this.createTopBar();
        this.touchEnabled = !!(this.sys.game.device.input.touch);
        this.createPedals();
        if (!this.touchEnabled) this.showKeyboardHint();
        this.runCountdown();
    }

    // ---------------------------------------------------------------- HUD

    createTopBar() {
        this.coinPill = createCoinPill(this, 112, 48, this.race.coins);

        const g = this.add.graphics();
        g.fillStyle(COLORS.ink, 0.9);
        g.fillRoundedRect(W / 2 - 170, 16, 340, 64, 32);
        g.lineStyle(4, COLORS.white, 1);
        g.strokeRoundedRect(W / 2 - 170, 16, 340, 64, 32);
        this.lapText = this.add.text(W / 2 - 88, 48, '', textStyle(28, '#ffffff')).setOrigin(0.5);

        this.cpStars = this.race.track.checkpoints.map((cp, i) => {
            return this.add.star(W / 2 + 40 + i * 50, 48, 5, 10, 21, COLORS.grayDark).setStrokeStyle(3, COLORS.white);
        });

        this.positionBadge = this.add.graphics();
        this.positionText = this.add.text(836, 46, '', textStyle(30, INK)).setOrigin(0.5);

        this.pauseBtn = createButton(this, 962, 46, {
            width: 76, height: 64, radius: 20, label: 'II', fontSize: 30,
            color: COLORS.purple,
            onTap: () => this.openPause()
        });
    }

    updateTopBar() {
        const race = this.race;
        if (race.coins !== this.lastCoins) {
            this.lastCoins = race.coins;
            this.coinPill.setValue(race.coins);
        }
        this.lapText.setText('LAP ' + Math.min(race.lap + 1, LAPS) + '/' + LAPS);
        this.cpStars.forEach((star, i) => {
            star.setFillStyle(i < race.cpInLap || race.raceFinished ? COLORS.yellow : COLORS.grayDark);
        });

        const pos = race.currentPosition();
        if (pos !== this.lastPosition) {
            this.lastPosition = pos;
            const g = this.positionBadge;
            g.clear();
            g.fillStyle(COLORS.ink, 1);
            g.fillCircle(836, 52, 42);
            g.fillStyle(MEDAL_COLORS[pos - 1] || COLORS.white, 1);
            g.fillCircle(836, 48, 40);
            g.lineStyle(4, COLORS.ink, 1);
            g.strokeCircle(836, 48, 40);
            this.positionText.setText(ordinal(pos));
        }
    }

    // ------------------------------------------------------------- pedals

    createPedals() {
        this.pedals = [
            { key: 'left', x: 108, y: 664, r: 74, color: COLORS.blue, icon: 'left' },
            { key: 'right', x: 272, y: 664, r: 74, color: COLORS.blue, icon: 'right' },
            { key: 'backward', x: 764, y: 690, r: 56, color: COLORS.red, label: 'BRAKE' },
            { key: 'forward', x: 922, y: 652, r: 86, color: COLORS.green, label: 'GO' }
        ];
        if (!this.touchEnabled) return;
        this.pedals.forEach((p) => {
            p.g = this.add.graphics();
            if (p.label) {
                this.add.text(p.x, p.y - 2, p.label, textStyle(p.r > 60 ? 44 : 24, '#ffffff', {
                    stroke: INK, strokeThickness: 6
                })).setOrigin(0.5);
            }
            this.paintPedal(p, false);
        });
    }

    paintPedal(p, down) {
        const g = p.g;
        g.clear();
        g.fillStyle(COLORS.ink, 0.6);
        g.fillCircle(p.x, p.y + 6, p.r);
        g.fillStyle(p.color, down ? 1 : 0.8);
        g.fillCircle(p.x, p.y + (down ? 4 : 0), p.r);
        g.lineStyle(6, COLORS.white, down ? 1 : 0.9);
        g.strokeCircle(p.x, p.y + (down ? 4 : 0), p.r);
        if (p.icon) {
            const dir = p.icon === 'left' ? -1 : 1;
            const cy = p.y + (down ? 4 : 0);
            g.fillStyle(COLORS.white, 1);
            g.fillTriangle(p.x + dir * 30, cy, p.x - dir * 20, cy - 32, p.x - dir * 20, cy + 32);
        }
        p.down = down;
    }

    pollPedals() {
        const next = { left: false, right: false, forward: false, backward: false };
        if (this.touchEnabled && !this.modalOpen) {
            const pointers = this.input.manager.pointers;
            for (let i = 0; i < pointers.length; i++) {
                const ptr = pointers[i];
                if (!ptr || !ptr.isDown) continue;
                for (let j = 0; j < this.pedals.length; j++) {
                    const p = this.pedals[j];
                    const dx = ptr.x - p.x;
                    const dy = ptr.y - p.y;
                    const reach = p.r + 22;
                    if (dx * dx + dy * dy <= reach * reach) next[p.key] = true;
                }
            }
        }
        this.pedals.forEach((p) => {
            if (p.g && p.down !== next[p.key]) this.paintPedal(p, next[p.key]);
        });
        this.controls = next;
    }

    showKeyboardHint() {
        const hint = this.add.text(W / 2, H - 50, 'Drive with the ARROW keys', textStyle(28, '#ffffff', {
            stroke: INK, strokeThickness: 6
        })).setOrigin(0.5);
        this.tweens.add({ targets: hint, alpha: 0, delay: 5000, duration: 800 });
    }

    // ---------------------------------------------------------- countdown

    runCountdown() {
        const steps = ['3', '2', '1', 'GO!'];
        const text = addTitle(this, W / 2, H / 2 - 40, '', 150);
        steps.forEach((label, i) => {
            this.time.delayedCall(i * 750, () => {
                text.setText(label);
                text.setColor(label === 'GO!' ? '#51cf66' : '#ffd43b');
                text.setScale(1.5).setAlpha(1);
                this.tweens.add({ targets: text, scale: 1, duration: 300, ease: 'Back.easeOut' });
                if (label === 'GO!') {
                    this.race.startRace();
                    this.tweens.add({ targets: text, alpha: 0, delay: 450, duration: 300 });
                }
            });
        });
    }

    flashMessage(message) {
        const text = addTitle(this, W / 2, H / 2 - 120, message, 84);
        text.setScale(0.5);
        this.tweens.add({ targets: text, scale: 1, duration: 280, ease: 'Back.easeOut' });
        this.tweens.add({ targets: text, alpha: 0, delay: 1100, duration: 400, onComplete: () => text.destroy() });
    }

    flashTip(message) {
        const t = this.add.text(W / 2, 128, message, textStyle(30, '#ffffff', {
            stroke: INK, strokeThickness: 7
        })).setOrigin(0.5).setDepth(50);
        this.tweens.add({ targets: t, alpha: 0, delay: 2400, duration: 500, onComplete: () => t.destroy() });
    }

    // -------------------------------------------------------------- modals

    openModal(depth) {
        this.modalOpen = true;
        const layer = this.add.container(0, 0).setDepth(depth || 100);
        const backdrop = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.5).setInteractive();
        layer.add(backdrop);
        return layer;
    }

    closeModal(layer, done) {
        this.tweens.add({
            targets: layer,
            alpha: 0,
            duration: 180,
            onComplete: () => {
                layer.destroy();
                this.modalOpen = false;
                if (done) done();
            }
        });
    }

    showMathProblem(problem, opts, onAnswer, onClose) {
        return showMathStop(this, problem, opts, onAnswer, onClose);
    }

    burstStars(parent, x, y) {
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            const star = this.add.star(x, y, 5, 8, 18, COLORS.yellow).setStrokeStyle(3, COLORS.ink);
            parent.add(star);
            this.tweens.add({
                targets: star,
                x: x + Math.cos(angle) * 150,
                y: y + Math.sin(angle) * 110,
                alpha: 0,
                duration: 700,
                ease: 'Cubic.easeOut',
                onComplete: () => star.destroy()
            });
        }
    }

    openPause() {
        if (this.modalOpen || !this.race.raceStarted || this.race.raceFinished) return;
        this.race.setMenuPaused(true);
        const layer = this.openModal(200);
        const g = this.add.graphics();
        drawPanel(g, W / 2 - 260, H / 2 - 200, 520, 400, COLORS.white, 34);
        layer.add(g);
        layer.add(addTitle(this, W / 2, H / 2 - 130, 'PAUSED', 64));
        layer.add(createButton(this, W / 2, H / 2 - 5, {
            width: 380, height: 100, label: 'Keep Racing', color: COLORS.green,
            onTap: () => this.closeModal(layer, () => this.race.setMenuPaused(false))
        }));
        layer.add(createButton(this, W / 2, H / 2 + 120, {
            width: 380, height: 90, label: 'Quit to Menu', fontSize: 34, color: COLORS.red,
            onTap: () => this.leaveTo('MenuScene')
        }));
    }

    showResults(result) {
        this.results = result;
        this.resultsLayer = this.openModal(300);
        this.renderResults(true);
    }

    renderResults(animate) {
        const result = this.results;
        const race = this.race;
        const layer = this.resultsLayer;
        if (this.resultsPanel) this.resultsPanel.destroy();
        const panel = this.add.container(RESULTS.x, RESULTS.y);
        this.resultsPanel = panel;
        layer.add(panel);

        const g = this.add.graphics();
        drawPanel(g, -400, -312, 800, 600, COLORS.white, 36);
        panel.add(g);

        const medal = MEDAL_COLORS[result.position - 1] || COLORS.skyLight;
        panel.add(this.add.star(0, -232, 5, 36, 74, medal).setStrokeStyle(6, COLORS.ink));
        panel.add(this.add.text(0, -227, String(result.position), textStyle(42, INK)).setOrigin(0.5));

        const headline = result.position === 1 ? 'You WON!' : 'You finished ' + ordinal(result.position) + '!';
        panel.add(addTitle(this, 0, -130, headline, 60));

        panel.add(this.add.text(0, -62, '+' + result.prize + ' prize coins', textStyle(34, '#e67700')).setOrigin(0.5));
        const hints = result.stats.hints;
        const mathLine = 'Math: ' + result.stats.correct + ' of ' + result.stats.asked + ' right' +
            (hints ? '  (' + hints + (hints === 1 ? ' hint)' : ' hints)') : '');
        panel.add(this.add.text(0, -16, mathLine, textStyle(30, INK)).setOrigin(0.5));

        const mistakes = race.mistakes();
        const bonus = race.reviewBonusOnOffer();
        if (race.reviewClaimed) {
            panel.add(this.add.text(0, 50, '+' + race.reviewClaimed + ' for reviewing mistakes \u2713', textStyle(32, '#2b8a3e')).setOrigin(0.5));
            panel.add(this.add.text(0, 92, 'Nice work checking your answers!', textStyle(20, '#868e96')).setOrigin(0.5));
        } else if (mistakes.length) {
            const n = mistakes.length;
            panel.add(createButton(this, 0, RESULTS.reviewDy, {
                width: 560, height: 82, radius: 28, fontSize: 32, color: COLORS.orange,
                label: 'Review ' + n + (n === 1 ? ' mistake' : ' mistakes') + '  +' + bonus + ' \u25B6',
                onTap: () => this.openReview('mistakes')
            }));
            panel.add(this.add.text(0, 108, 'See the right answers and earn +' + bonus + ' coins', textStyle(19, '#868e96')).setOrigin(0.5));
        } else if (race.stopLog.length) {
            panel.add(this.add.text(0, 36, 'Perfect \u2014 nothing to review! \u2605', textStyle(32, '#2b8a3e')).setOrigin(0.5));
            panel.add(createButton(this, 0, 94, {
                width: 420, height: 60, radius: 22, fontSize: 24, color: COLORS.blue,
                label: race.stopLog.length === 1 ? 'Look back at the question' : 'Look back at all ' + race.stopLog.length + ' questions',
                onTap: () => this.openReview('all')
            }));
        }
        panel.add(this.add.text(0, 152, 'Total coins: ' + race.coins, textStyle(28, '#495057')).setOrigin(0.5));

        panel.add(createButton(this, -250, RESULTS.buttonsDy, {
            width: 220, height: 92, label: 'Race Again', fontSize: 32, color: COLORS.green,
            onTap: () => this.leaveTo('RaceScene', { course: result.course })
        }));
        panel.add(createButton(this, 0, RESULTS.buttonsDy, {
            width: 220, height: 92, label: 'Shop', fontSize: 36, color: COLORS.purple,
            onTap: () => this.leaveTo('ShopScene')
        }));
        panel.add(createButton(this, 250, RESULTS.buttonsDy, {
            width: 220, height: 92, label: 'Menu', fontSize: 36, color: COLORS.blue,
            onTap: () => this.leaveTo('MenuScene')
        }));

        if (animate) {
            panel.setScale(0.7);
            this.tweens.add({ targets: panel, scale: 1, duration: 300, ease: 'Back.easeOut' });
        }
    }

    openReview(mode) {
        if (this.review && !this.review.closed) return;
        const race = this.race;
        const stops = mode === 'mistakes' ? race.mistakes() : race.stopLog.slice();
        if (!stops.length) return;
        const bonus = mode === 'mistakes' ? race.reviewBonusOnOffer() : 0;
        showReview(this, stops, { mode, bonus }, (completed) => {
            if (completed && mode === 'mistakes') {
                const paid = race.claimReviewBonus();
                if (paid) {
                    this.renderResults(false);
                    this.flashMessage('+' + paid + ' coins!');
                    return;
                }
            }
            this.renderResults(false);
        });
    }

    leaveTo(key, data) {
        if (key !== 'RaceScene') this.scene.stop('RaceScene');
        this.scene.start(key, data);
    }

    update() {
        this.pollPedals();
        this.updateTopBar();
    }
}
