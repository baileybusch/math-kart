/**
 * Pure geometry helpers for closed-loop tracks (no Phaser dependency).
 * A track is a closed polyline of waypoints; "along" is the distance
 * travelled from waypoint 0 following the loop.
 */

export function buildLoop(points) {
    const segs = [];
    let total = 0;
    for (let i = 0; i < points.length; i++) {
        const a = points[i];
        const b = points[(i + 1) % points.length];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        segs.push({ ax: a.x, ay: a.y, dx: dx / len, dy: dy / len, len, start: total });
        total += len;
    }
    return { points, segs, total };
}

function wrap(value, total) {
    const v = value % total;
    return v < 0 ? v + total : v;
}

/** Position, heading and left-normal at a distance along the loop. */
export function pointAt(loop, along) {
    const d = wrap(along, loop.total);
    let seg = loop.segs[loop.segs.length - 1];
    for (let i = 0; i < loop.segs.length; i++) {
        const s = loop.segs[i];
        if (d < s.start + s.len) {
            seg = s;
            break;
        }
    }
    const t = d - seg.start;
    return {
        x: seg.ax + seg.dx * t,
        y: seg.ay + seg.dy * t,
        dirX: seg.dx,
        dirY: seg.dy,
        normX: -seg.dy,
        normY: seg.dx
    };
}

function projectOnSeg(seg, x, y) {
    let t = (x - seg.ax) * seg.dx + (y - seg.ay) * seg.dy;
    if (t < 0) t = 0;
    if (t > seg.len) t = seg.len;
    const px = seg.ax + seg.dx * t;
    const py = seg.ay + seg.dy * t;
    const ex = x - px;
    const ey = y - py;
    return { t, dist: Math.sqrt(ex * ex + ey * ey) };
}

/**
 * Closest point on the loop. When hintSeg is given only nearby segments are
 * searched, which stops progress jumping to a parallel stretch of road.
 */
export function nearestOnLoop(loop, x, y, hintSeg) {
    const n = loop.segs.length;
    let best = null;
    const check = (i) => {
        const seg = loop.segs[i];
        const p = projectOnSeg(seg, x, y);
        if (!best || p.dist < best.dist) {
            best = { seg: i, dist: p.dist, along: seg.start + p.t };
        }
    };
    if (typeof hintSeg === 'number') {
        for (let k = -2; k <= 3; k++) check(((hintSeg + k) % n + n) % n);
        if (best.dist < 320) return best;
        best = null;
    }
    for (let i = 0; i < n; i++) check(i);
    return best;
}

export function distanceToLoop(loop, x, y) {
    return nearestOnLoop(loop, x, y).dist;
}
