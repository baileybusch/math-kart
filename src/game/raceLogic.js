import { nearestOnLoop } from './trackMath.js';

/**
 * Pure race rules shared by RaceScene and the Node unit test (which drives
 * a simulated kart round every course to prove each checkpoint and the
 * finish line can actually be reached).
 */

export const CHECKPOINT_RADIUS = 135;
export const BOUNDS_MARGIN = 40;

export function kartStats(save) {
    return {
        maxSpeed: 300 + save.speedUpgrades * 30,
        acceleration: 230 + save.speedUpgrades * 20,
        turnSpeed: 2.6 + save.handlingUpgrades * 0.3
    };
}

/**
 * Simple kinematic driving (accelerate / brake / coast, slower off-road),
 * clamped to the course size. Mutates kart {x, y, rotation, speed, ...}.
 */
export function stepKart(kart, input, dt, width, height) {
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
    kart.x = Math.min(Math.max(kart.x, BOUNDS_MARGIN), width - BOUNDS_MARGIN);
    kart.y = Math.min(Math.max(kart.y, BOUNDS_MARGIN), height - BOUNDS_MARGIN);
}

/**
 * Updates the kart's distance along the loop and the lap. `race` holds
 * {lap, cpInLap}; `kart` holds {x, y, segHint, along, offRoad}. Returns true
 * when a lap was just completed. A lap only counts once every checkpoint in
 * it has been reached.
 */
export function updateProgress(race, kart, track) {
    const L = track.loop.total;
    const near = nearestOnLoop(track.loop, kart.x, kart.y, kart.segHint);
    kart.segHint = near.seg;
    kart.offRoad = near.dist > track.roadHalfWidth + 10;

    let along = near.along;
    const allCheckpointsDone = race.cpInLap >= track.checkpoints.length;
    if (race.cpInLap === 0 && along > L * 0.75) along -= L;
    if (allCheckpointsDone && along < L * 0.25) along += L;
    kart.along = along;

    if (allCheckpointsDone && along >= L) {
        race.lap++;
        race.cpInLap = 0;
        kart.along -= L;
        return true;
    }
    return false;
}

/** True when the kart is at the next checkpoint (caller advances cpInLap). */
export function reachedCheckpoint(race, kart, track) {
    if (race.cpInLap >= track.checkpoints.length) return false;
    const cp = track.checkpoints[race.cpInLap];
    const dx = kart.x - cp.x;
    const dy = kart.y - cp.y;
    return dx * dx + dy * dy < CHECKPOINT_RADIUS * CHECKPOINT_RADIUS;
}
