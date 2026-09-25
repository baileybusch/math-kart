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

export function wrap(value, total) {
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
 * searched, which stops progress jumping to a parallel stretch of road (or
 * to the other road at a figure-8 crossing).
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

/** Distance from (x, y) to an open polyline of {x, y} points. */
export function distanceToPolyline(pts, x, y) {
    let best = Infinity;
    for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i];
        const b = pts[i + 1];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const l2 = dx * dx + dy * dy || 1;
        let t = ((x - a.x) * dx + (y - a.y) * dy) / l2;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const ex = x - (a.x + dx * t);
        const ey = y - (a.y + dy * t);
        const d = ex * ex + ey * ey;
        if (d < best) best = d;
    }
    return Math.sqrt(best);
}

/** Intersection point of segments ab and cd, or null. */
export function segmentIntersection(a, b, c, d) {
    const rx = b.x - a.x; const ry = b.y - a.y;
    const sx = d.x - c.x; const sy = d.y - c.y;
    const den = rx * sy - ry * sx;
    if (Math.abs(den) < 1e-9) return null;
    const t = ((c.x - a.x) * sy - (c.y - a.y) * sx) / den;
    const u = ((c.x - a.x) * ry - (c.y - a.y) * rx) / den;
    if (t < 0 || t > 1 || u < 0 || u > 1) return null;
    return { x: a.x + rx * t, y: a.y + ry * t, t, u };
}

/**
 * Turns a closed list of corners [x, y, radius?] into a smooth waypoint loop:
 * every corner becomes a circular arc (sampled every <= 15 degrees) of the
 * given radius, clamped so neighbouring arcs never overlap. Waypoint 0 is the
 * middle of the straight from corner 0 to corner 1 (the start line).
 */
export function roundedLoop(corners, defaultRadius) {
    const n = corners.length;
    const c = corners.map((p) => ({ x: p[0], y: p[1], r: p[2] || defaultRadius }));
    const arcs = c.map((p, i) => fillet(c[(i + n - 1) % n], p, c[(i + 1) % n]));
    const pts = [{ x: (c[0].x + c[1].x) / 2, y: (c[0].y + c[1].y) / 2 }];
    for (let k = 1; k <= n; k++) arcs[k % n].forEach((p) => pts.push(p));
    return pts.map((p) => ({ x: Math.round(p.x), y: Math.round(p.y) }));
}

/** Like roundedLoop but for an open path: the end points are kept as-is. */
export function roundedPath(points, radius) {
    const c = points.map((p) => ({ x: p.x, y: p.y, r: radius }));
    const out = [c[0]];
    for (let i = 1; i < c.length - 1; i++) fillet(c[i - 1], c[i], c[i + 1]).forEach((p) => out.push(p));
    out.push(c[c.length - 1]);
    return out;
}

/** Arc points replacing corner p (between a and b) with a radius p.r fillet. */
function fillet(a, p, b) {
    const l1 = Math.hypot(p.x - a.x, p.y - a.y);
    const l2 = Math.hypot(b.x - p.x, b.y - p.y);
    const d1 = { x: (p.x - a.x) / l1, y: (p.y - a.y) / l1 };
    const d2 = { x: (b.x - p.x) / l2, y: (b.y - p.y) / l2 };
    const cross = d1.x * d2.y - d1.y * d2.x;
    const turn = Math.atan2(cross, d1.x * d2.x + d1.y * d2.y);
    const abs = Math.abs(turn);
    if (abs < 0.01) return [{ x: p.x, y: p.y }];
    let t = p.r * Math.tan(abs / 2);
    t = Math.min(t, l1 * 0.49, l2 * 0.49);
    const r = t / Math.tan(abs / 2);
    const s = { x: p.x - d1.x * t, y: p.y - d1.y * t };
    const side = turn > 0 ? 1 : -1;
    const centre = { x: s.x - d1.y * r * side, y: s.y + d1.x * r * side };
    const a0 = Math.atan2(s.y - centre.y, s.x - centre.x);
    const steps = Math.max(1, Math.ceil(abs / (Math.PI / 12)));
    const out = [];
    for (let k = 0; k <= steps; k++) {
        const ang = a0 + (turn * k) / steps;
        out.push({ x: centre.x + Math.cos(ang) * r, y: centre.y + Math.sin(ang) * r });
    }
    return out;
}
