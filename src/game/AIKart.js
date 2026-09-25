import { stepAI, placeAI, airHeight } from './raceLogic.js';
import { drawKart } from '../ui/theme.js';

/**
 * AI Kart - rides along the track loop in its own lane (the movement rules
 * are stepAI in raceLogic.js, shared with the unit test). Progress is simply
 * the distance travelled, which makes race positions easy to compare.
 */
export default class AIKart {
    constructor(scene, track, opts) {
        this.scene = scene;
        this.track = track;
        this.name = opts.name;
        this.baseSpeed = opts.speed;
        this.lane = opts.lane || 0;
        this.along = opts.along || 0;
        this.useBridge = !!opts.useBridge;
        this.wobble = Math.random() * Math.PI * 2;
        this.air = 0;
        this.boost = 0;
        this.isPaused = true;
        this.finished = false;

        this.shadow = scene.add.ellipse(0, 0, 50, 34, 0x000000, 0.28).setVisible(false);
        this.sprite = drawKart(scene.add.graphics(), opts.color);
        this.place();
    }

    get progress() {
        return this.along;
    }

    place() {
        placeAI(this, this.track);
        this.draw();
    }

    draw() {
        const h = airHeight(this);
        this.sprite.x = this.x;
        this.sprite.y = this.y;
        this.sprite.rotation = this.rotation;
        this.sprite.setScale(1 + 0.35 * h);
        this.shadow.setVisible(h > 0.02);
        if (h > 0.02) this.shadow.setPosition(this.x + 14 * h, this.y + 34 * h).setScale(1 - 0.3 * h);
    }

    update(delta, playerProgress) {
        if (this.isPaused || this.finished) return;
        stepAI(this, this.track, delta / 1000, playerProgress);
        this.draw();
    }

    pause() {
        this.isPaused = true;
    }

    resume() {
        if (!this.finished) this.isPaused = false;
    }

    finish() {
        this.finished = true;
        this.isPaused = true;
        this.air = 0;
        this.draw();
    }
}
