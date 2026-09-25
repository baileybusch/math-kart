import { pointAt, wrap, distanceToPolyline, roundedPath } from './trackMath.js';

/**
 * Track features built from course data (no Phaser, so the Node unit test
 * uses exactly what the game uses):
 *   - ramps: a big jump ramp or a small bump across the road. Driving over
 *     one at speed launches the kart briefly into the air with a boost.
 *   - river: a stream that crosses the road once, running `near` px off
 *     one side (usually off the map) and `far` px on the bridge side, where
 *     it ends in a pond. Driving through the water (the "ford") slows the
 *     kart right down.
 *   - bridge: a side road that leaves the main road before the river,
 *     crosses it on a wooden bridge and rejoins after. Full speed.
 * Positions are given as a fraction of the lap so layouts stay easy to edit.
 */

// air: seconds off the ground; boost: top-speed multiplier for boostTime
// seconds after take-off; minSpeed: slower than this you just roll over it.
export const RAMP_TYPES = {
    jump: { depth: 84, air: 0.75, lift: 1, boost: 1.25, boostTime: 1.3, add: 50, minSpeed: 90 },
    bump: { depth: 54, air: 0.32, lift: 0.45, boost: 1.1, boostTime: 0.6, add: 15, minSpeed: 60 }
};

function sampleRiver(loop, spec, hw) {
    const at = spec.at * loop.total;
    const c = pointAt(loop, at);
    const side = spec.side;
    const pts = [];
    const near = spec.near;
    const far = spec.far;
    const wiggle = spec.wiggle || 0;
    // Meander between the road and the bridge but cross both square-on.
    const period = spec.bridge ? spec.bridge.offset : 240;
    for (let t = -near; t <= far + 0.1; t += 40) {
        const m = wiggle * Math.sin(Math.PI * t / period);
        pts.push({
            x: c.x + c.normX * side * t + c.dirX * m,
            y: c.y + c.normY * side * t + c.dirY * m
        });
    }
    const end = pts[pts.length - 1];
    const pond = spec.pond ? { x: end.x + c.normX * side * spec.pond * 0.4, y: end.y + c.normY * side * spec.pond * 0.4, r: spec.pond } : null;
    return { at, cx: c.x, cy: c.y, dirX: c.dirX, dirY: c.dirY, width: spec.width, points: pts, pond, roadHalfWidth: hw, bbox: bboxOf(pts, spec.width / 2 + (pond ? pond.r : 0) + 20) };
}

function resample(pts, step) {
    const out = [pts[0]];
    for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1];
        const b = pts[i];
        const len = Math.hypot(b.x - a.x, b.y - a.y);
        const n = Math.max(1, Math.round(len / step));
        for (let k = 1; k <= n; k++) out.push({ x: a.x + ((b.x - a.x) * k) / n, y: a.y + ((b.y - a.y) * k) / n });
    }
    return out;
}

/**
 * The bridge road as a clear fork: it leaves the main road at an angle,
 * runs parallel to it (`offset` px to the side) straight across the river,
 * then rejoins. Built in road-aligned (s, off) coordinates around the ford,
 * so it needs a straight stretch of main road (the unit test checks).
 */
function sampleBridge(river, spec, side) {
    const flat = spec.flat;
    const ends = flat + spec.ramp;
    const lead = 150;
    const frame = resample(roundedPath([
        { x: -ends - lead, y: 0 }, { x: -ends, y: 0 }, { x: -flat, y: spec.offset },
        { x: flat, y: spec.offset }, { x: ends, y: 0 }, { x: ends + lead, y: 0 }
    ], spec.radius), 20);
    let first = frame.findIndex((p) => p.y > 0.5);
    let last = frame.length - 1;
    while (last > 0 && frame[last].y <= 0.5) last--;
    first = Math.max(0, first - 1);
    last = Math.min(frame.length - 1, last + 1);
    const profile = frame.slice(first, last + 1).map((p) => ({ s: p.x, off: p.y }));
    const nx = -river.dirY * side;
    const ny = river.dirX * side;
    const pts = profile.map((p) => ({
        x: river.cx + river.dirX * p.s + nx * p.off,
        y: river.cy + river.dirY * p.s + ny * p.off,
        s: p.s,
        off: p.off
    }));
    const wet = (p) => distanceToPolyline(river.points, p.x, p.y) < river.width / 2 + 18;
    const deck = pts.filter(wet);
    const s0 = profile[0].s;
    const s1 = profile[profile.length - 1].s;
    return {
        from: river.at + s0,
        to: river.at + s1,
        half: (s1 - s0) / 2,
        offset: spec.offset,
        flat,
        ramp: spec.ramp,
        radius: spec.radius,
        side,
        profile,
        points: pts,
        deck,
        bbox: bboxOf(pts, 140)
    };
}

function bboxOf(pts, pad) {
    let x0 = Infinity; let y0 = Infinity; let x1 = -Infinity; let y1 = -Infinity;
    pts.forEach((p) => {
        x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x);
        y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y);
    });
    return { x0: x0 - pad, y0: y0 - pad, x1: x1 + pad, y1: y1 + pad };
}

function inBox(b, x, y) {
    return x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1;
}

export function buildFeatures(course, loop, roadWidth) {
    const hw = roadWidth / 2;
    const ramps = (course.ramps || []).map((r, i) => {
        const along = r.at * loop.total;
        const p = pointAt(loop, along);
        const type = RAMP_TYPES[r.kind] ? r.kind : 'bump';
        return Object.assign({ id: i, kind: type, along, x: p.x, y: p.y, dirX: p.dirX, dirY: p.dirY, halfWidth: hw + 6 }, RAMP_TYPES[type]);
    });
    let river = null;
    let bridge = null;
    if (course.river) {
        river = sampleRiver(loop, course.river, hw);
        if (course.river.bridge) bridge = sampleBridge(river, course.river.bridge, course.river.side);
    }
    return { ramps, river, bridge, roadHalfWidth: hw };
}

/** True when (x, y) is on the bridge side road (the bypass). */
export function onBypass(features, x, y) {
    const b = features && features.bridge;
    if (!b || !inBox(b.bbox, x, y)) return false;
    return distanceToPolyline(b.points, x, y) <= features.roadHalfWidth + 10;
}

export function inRiver(features, x, y) {
    const r = features && features.river;
    if (!r || !inBox(r.bbox, x, y)) return false;
    if (r.pond) {
        const dx = x - r.pond.x;
        const dy = y - r.pond.y;
        if (dx * dx + dy * dy < r.pond.r * r.pond.r) return true;
    }
    return distanceToPolyline(r.points, x, y) < r.width / 2;
}

/** 'water', 'bridge' (over the river on the bridge deck) or null. */
export function surfaceAt(features, x, y) {
    if (!inRiver(features, x, y)) return null;
    return onBypass(features, x, y) ? 'bridge' : 'water';
}

/** The ramp under (x, y), if any. */
export function rampAt(features, x, y) {
    const ramps = features ? features.ramps : [];
    for (let i = 0; i < ramps.length; i++) {
        const r = ramps[i];
        const dx = x - r.x;
        const dy = y - r.y;
        const along = dx * r.dirX + dy * r.dirY;
        const across = -dx * r.dirY + dy * r.dirX;
        if (Math.abs(along) <= r.depth / 2 && Math.abs(across) <= r.halfWidth) return r;
    }
    return null;
}

/**
 * Sideways offset (along the road's normal) of the bridge side road at a
 * distance along the lap: 0 away from the river, `offset` at the river.
 */
export function bridgeOffset(features, along, total) {
    const b = features && features.bridge;
    if (!b) return 0;
    const s = wrap(along - features.river.at + total / 2, total) - total / 2;
    const prof = b.profile;
    if (s <= prof[0].s || s >= prof[prof.length - 1].s) return 0;
    let i = 1;
    while (prof[i].s < s) i++;
    const a = prof[i - 1];
    const c = prof[i];
    const t = (s - a.s) / (c.s - a.s || 1);
    return b.side * (a.off + (c.off - a.off) * t);
}
