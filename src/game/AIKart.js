import { pointAt } from './trackMath.js';
import { drawKart } from '../ui/theme.js';

/**
 * AI Kart - rides along the track loop in its own lane. Progress is simply
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
        this.wobble = Math.random() * Math.PI * 2;
        this.isPaused = true;
        this.finished = false;

        this.sprite = drawKart(scene.add.graphics(), opts.color);
        this.place();
    }

    get progress() {
        return this.along;
    }

    place() {
        const p = pointAt(this.track.loop, this.along);
        const lane = this.lane + Math.sin(this.wobble) * 14;
        this.sprite.x = p.x + p.normX * lane;
        this.sprite.y = p.y + p.normY * lane;
        this.sprite.rotation = Math.atan2(p.dirX, -p.dirY);
    }

    update(delta, playerProgress) {
        if (this.isPaused || this.finished) return;
        const dt = delta / 1000;

        // Gentle rubber-banding keeps races close for young drivers.
        const gap = this.along - playerProgress;
        let speed = this.baseSpeed;
        if (gap > 700) speed *= 0.78;
        else if (gap > 350) speed *= 0.9;
        else if (gap < -900) speed *= 1.15;

        this.along += speed * dt;
        this.wobble += dt * 1.3;
        this.place();
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
    }
}
