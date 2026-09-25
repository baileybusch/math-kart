import { nearestOnLoop, pointAt, wrap } from './trackMath.js';
import { onBypass, surfaceAt, rampAt, bridgeOffset } from './features.js';

/**
 * Pure race rules shared by RaceScene and the Node unit test (which drives
 * a simulated kart round every course to prove each checkpoint and the
 * finish line can actually be reached).
 */

export const CHECKPOINT_RADIUS = 135;
export const BOUNDS_MARGIN = 40;
/** Top speed multipliers: grass, and wading through river water. */
export const OFFROAD_SPEED = 0.55;
export const WATER_SPEED = 0.4;
/** How fast the kart turns back toward the road while in the air (rad/s). */
export const LANDING_ASSIST = 1.6;
export const AI_WATER_SPEED = 0.5;

export function kartStats(save) {
    return {
        maxSpeed: 300 + save.speedUpgrades * 30,
        acceleration: 230 + save.speedUpgrades * 20,
        turnSpeed: 2.6 + save.handlingUpgrades * 0.3
    };
}

function angleDiff(a, b) {
    let d = a - b;
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    return d;
}

/** The top speed right now (grass, water, boost after a jump). */
export function speedCap(kart) {
    if (kart.air > 0) return Math.max(kart.maxSpeed, kart.boostCap || 0);
    if (kart.inWater) return kart.maxSpeed * WATER_SPEED;
    if (kart.boost > 0) return Math.max(kart.maxSpeed, kart.boostCap || 0);
    return kart.offRoad ? kart.maxSpeed * OFFROAD_SPEED : kart.maxSpeed;
}

/**
 * Simple kinematic driving (accelerate / brake / coast, slower off-road and
 * much slower in water), clamped to the course size. In the air the kart
 * keeps its speed, steers at half strength and gently lines itself up with
 * the road so landings are forgiving. Mutates kart {x, y, rotation, speed, ...}.
 */
export function stepKart(kart, input, dt, width, height) {
    const flying = kart.air > 0;
    if (flying) {
        kart.air = Math.max(0, kart.air - dt);
    } else if (input.forward) {
        if (kart.speed < kart.maxSpeed) kart.speed = Math.min(kart.speed + kart.acceleration * dt, kart.maxSpeed);
    } else if (input.backward) {
        kart.speed = Math.max(kart.speed - kart.acceleration * 1.6 * dt, -kart.maxSpeed * 0.4);
    } else {
        kart.speed *= Math.max(0, 1 - 1.6 * dt);
    }
    if (kart.boost > 0 && !flying) kart.boost = Math.max(0, kart.boost - dt);

    const cap = speedCap(kart);
    if (kart.speed > cap) kart.speed = Math.max(cap, kart.speed - (kart.inWater ? 900 : 500) * dt);

    const steer = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    if (steer !== 0) {
        const grip = 0.45 + 0.55 * Math.min(1, Math.abs(kart.speed) / 160);
        const dir = kart.speed < -5 ? -1 : 1;
        kart.rotation += steer * dir * kart.turnSpeed * grip * dt * (flying ? 0.5 : 1);
    }
    if (flying && typeof kart.roadHeading === 'number') {
        const diff = angleDiff(kart.roadHeading, kart.rotation);
        if (Math.abs(diff) < 1.3) {
            const step = LANDING_ASSIST * dt;
            kart.rotation += Math.max(-step, Math.min(step, diff));
        }
    }

    kart.x += Math.sin(kart.rotation) * kart.speed * dt;
    kart.y -= Math.cos(kart.rotation) * kart.speed * dt;
    kart.x = Math.min(Math.max(kart.x, BOUNDS_MARGIN), width - BOUNDS_MARGIN);
    kart.y = Math.min(Math.max(kart.y, BOUNDS_MARGIN), height - BOUNDS_MARGIN);
}

/** Starts a jump (or small hop for a bump) from ramp `r`. */
export function launch(kart, r) {
    kart.air = r.air;
    kart.airTotal = r.air;
    kart.airLift = r.lift;
    kart.boost = r.boostTime;
    kart.boostCap = kart.maxSpeed * r.boost;
    kart.speed = Math.min(Math.max(kart.speed, 0) * r.boost + r.add, kart.boostCap);
    kart.jumps = (kart.jumps || 0) + 1;
}

/** Height of the kart in the air, 0..1 (for the sprite and shadow). */
export function airHeight(kart) {
    if (!(kart.air > 0) || !kart.airTotal) return 0;
    const t = 1 - kart.air / kart.airTotal;
    return Math.sin(Math.PI * t) * (kart.airLift || 1);
}

/**
 * Water, bridge and ramps under the kart. Returns 'splash' when the kart
 * drives into water, 'jump' / 'bump' on take-off, or null.
 */
export function updateFeatures(kart, track) {
    const f = track.features;
    if (!f) return null;
    let event = null;
    const flying = kart.air > 0;
    const surface = flying ? null : surfaceAt(f, kart.x, kart.y);
    const wasWet = kart.inWater;
    kart.inWater = surface === 'water';
    kart.onBridge = surface === 'bridge';
    if (kart.inWater && !wasWet) {
        kart.splashes = (kart.splashes || 0) + 1;
        event = 'splash';
    }
    if (!flying) {
        const r = rampAt(f, kart.x, kart.y);
        if (r && r !== kart.lastRamp && kart.speed >= r.minSpeed) {
            launch(kart, r);
            event = r.kind;
        }
        kart.lastRamp = r;
    }
    return event;
}

/**
 * Updates the kart's distance along the loop and the lap. `race` holds
 * {lap, cpInLap}; `kart` holds {x, y, segHint, along, offRoad}. Returns true
 * when a lap was just completed. A lap only counts once every checkpoint in
 * it has been reached. The bridge side road counts as road.
 */
export function updateProgress(race, kart, track) {
    const L = track.loop.total;
    const near = nearestOnLoop(track.loop, kart.x, kart.y, kart.segHint);
    kart.segHint = near.seg;
    const seg = track.loop.segs[near.seg];
    kart.roadHeading = Math.atan2(seg.dx, -seg.dy);
    kart.offRoad = near.dist > track.roadHalfWidth + 10 && !onBypass(track.features, kart.x, kart.y);

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

/**
 * Computer kart: rides the loop in its own lane (swinging out over the
 * bridge if `useBridge`), slows in water, hops over ramps with a short
 * boost, and rubber-bands toward the player. Its speed never drops below
 * half, so it can't get stuck. Mutates ai {along, lane, wobble, air, boost,
 * wet, x, y, rotation}.
 */
export function stepAI(ai, track, dt, playerProgress) {
    const L = track.loop.total;
    const f = track.features;
    const gap = ai.along - playerProgress;
    let speed = ai.baseSpeed;
    if (gap > 700) speed *= 0.78;
    else if (gap > 350) speed *= 0.9;
    else if (gap < -900) speed *= 1.15;

    if (ai.air > 0) ai.air = Math.max(0, ai.air - dt);
    if (ai.boost > 0) {
        ai.boost = Math.max(0, ai.boost - dt);
        speed *= ai.boostMul || 1;
    }
    const wetTarget = ai.inWater ? AI_WATER_SPEED : 1;
    ai.wet = ai.wet === undefined ? 1 : ai.wet + (wetTarget - ai.wet) * Math.min(1, dt * 6);
    speed *= ai.wet;

    const before = ai.along;
    ai.along += speed * dt;
    ai.wobble = (ai.wobble || 0) + dt * 1.3;
    ai.speed = speed;

    if (f && ai.air <= 0) {
        for (let i = 0; i < f.ramps.length; i++) {
            const r = f.ramps[i];
            const a = wrap(before, L);
            const crossed = a < r.along ? a + (ai.along - before) >= r.along : a + (ai.along - before) >= r.along + L;
            if (crossed) {
                ai.air = r.air;
                ai.airTotal = r.air;
                ai.airLift = r.lift;
                ai.boost = r.boostTime;
                ai.boostMul = r.kind === 'jump' ? 1.15 : 1.05;
                ai.jumps = (ai.jumps || 0) + 1;
            }
        }
    }
    placeAI(ai, track);
    ai.inWater = ai.air > 0 ? false : surfaceAt(f, ai.x, ai.y) === 'water';
    if (ai.inWater) ai.wetFrames = (ai.wetFrames || 0) + 1;
}

function aiPosition(ai, track, along) {
    const p = pointAt(track.loop, along);
    let lane = ai.lane + Math.sin(ai.wobble || 0) * 14;
    if (ai.useBridge) lane += bridgeOffset(track.features, along, track.loop.total);
    return { x: p.x + p.normX * lane, y: p.y + p.normY * lane };
}

export function placeAI(ai, track) {
    const p = aiPosition(ai, track, ai.along);
    const q = aiPosition(ai, track, ai.along + 24);
    ai.x = p.x;
    ai.y = p.y;
    ai.rotation = Math.atan2(q.x - p.x, -(q.y - p.y));
}
