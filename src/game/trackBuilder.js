import Phaser from 'phaser';
import { pointAt, distanceToLoop, distanceToPolyline } from './trackMath.js';
import { getCourse, courseGeometry, ROAD_WIDTH } from './courses.js';
import { FONT, COLORS } from '../ui/theme.js';

/**
 * Track Builder - draws a course from its waypoint loop and features
 * (course data lives in courses.js, features in features.js). The same loop
 * drives the road art, AI karts, checkpoints and race progress.
 *
 * Only Graphics/Shape/Text primitives are used so the Canvas renderer (old
 * iPads) and WebGL look the same.
 */

export { ROAD_WIDTH };

const HW = ROAD_WIDTH / 2;
const WATER = 0x339af0;
const WATER_LIGHT = 0x74c0fc;
const BANKS = { forest: 0xb5a47a, pine: 0x7a6040 };
const BUMP_LOOKS = { desert: 'dune', pine: 'log', snow: 'mogul' };

export function getCourseInfo(courseId) {
    const c = getCourse(courseId);
    return { id: c.id, name: c.name };
}

export function createTrack(scene, courseId) {
    const course = getCourse(courseId);
    const geo = courseGeometry(course.id);
    const points = geo.points;
    const loop = geo.loop;
    const f = geo.features;
    const pal = course.palette;
    const rng = new Phaser.Math.RandomDataGenerator([course.id]);

    scene.cameras.main.setBackgroundColor(pal.ground);

    const blocked = (x, y, pad) => {
        if (distanceToLoop(loop, x, y) < HW + pad) return true;
        if (f.bridge && distanceToPolyline(f.bridge.points, x, y) < HW + pad) return true;
        if (f.river) {
            if (distanceToPolyline(f.river.points, x, y) < f.river.width / 2 + pad) return true;
            const pond = f.river.pond;
            if (pond && Math.hypot(x - pond.x, y - pond.y) < pond.r + pad) return true;
        }
        const lake = course.lake;
        if (lake && ((x - lake.x) * (x - lake.x)) / ((lake.rx + pad) * (lake.rx + pad)) + ((y - lake.y) * (y - lake.y)) / ((lake.ry + pad) * (lake.ry + pad)) < 1) return true;
        return false;
    };
    const area = { width: course.width, height: course.height, scale: (course.width * course.height) / (2400 * 1600), blocked };

    const decor = scene.add.graphics();
    DECORATORS[course.id](decor, rng, area, loop, course);

    const road = scene.add.graphics();
    if (f.river) drawRiver(road, f.river, BANKS[course.id] || 0x8d7b68, true);
    const layers = [[ROAD_WIDTH + 26, pal.edge], [ROAD_WIDTH, pal.road]];
    layers.forEach(([w, color]) => {
        drawRoadLayer(road, points, w, color, true);
        if (f.bridge) drawRoadLayer(road, f.bridge.points, w, color, false);
    });
    if (course.id === 'city') drawLaneDashes(road, loop, 0xf8f9fa);
    if (f.river) {
        drawRiver(road, f.river, 0, false);
        drawFord(road, f.river);
        if (f.bridge) {
            drawBridge(road, f.bridge);
            drawBridgeSigns(scene, loop, f, course);
        }
    }
    f.ramps.forEach((r) => drawRamp(scene, r, BUMP_LOOKS[course.id]));

    drawStartLine(scene, loop);

    const checkpoints = geo.checkpoints.map((cp) => {
        cp.marker = drawCheckpoint(scene, cp);
        return cp;
    });

    return {
        id: course.id,
        name: course.name,
        width: course.width,
        height: course.height,
        prizes: course.prizes,
        aiSpeed: course.aiSpeed,
        loop,
        checkpoints,
        features: f,
        roadHalfWidth: geo.roadHalfWidth
    };
}

/**
 * Round joints so thick lines have no notches, only where the line bends
 * (every circle is redrawn each frame on the Canvas renderer).
 */
function fillJoints(g, pts, width, color, alpha, closed) {
    const n = pts.length;
    g.fillStyle(color, alpha);
    for (let i = 0; i < n; i++) {
        const a = pts[(i + n - 1) % n];
        const p = pts[i];
        const b = pts[(i + 1) % n];
        const end = !closed && (i === 0 || i === n - 1);
        const turn = Math.abs(Math.atan2((p.x - a.x) * (b.y - p.y) - (p.y - a.y) * (b.x - p.x), (p.x - a.x) * (b.x - p.x) + (p.y - a.y) * (b.y - p.y)));
        if (end || turn > 0.07) g.fillCircle(p.x, p.y, width / 2);
    }
}

function drawRoadLayer(g, points, width, color, closed) {
    g.lineStyle(width, color, 1);
    g.beginPath();
    g.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) g.lineTo(points[i].x, points[i].y);
    if (closed) g.closePath();
    g.strokePath();
    fillJoints(g, points, width, color, 1, closed);
}

function drawLaneDashes(g, loop, color) {
    for (let d = 0; d < loop.total; d += 90) {
        const p = pointAt(loop, d);
        const q = pointAt(loop, d + 40);
        g.lineStyle(8, color, 0.8);
        g.lineBetween(p.x, p.y, q.x, q.y);
    }
}

function strokePolyline(g, pts, width, color, alpha) {
    g.lineStyle(width, color, alpha);
    g.beginPath();
    g.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y);
    g.strokePath();
    fillJoints(g, pts, width, color, alpha, false);
}

/** Muddy banks go under the road; the water itself goes over it. */
function drawRiver(g, river, bankColor, banks) {
    const pts = river.points;
    if (banks) {
        strokePolyline(g, pts, river.width + 34, bankColor, 1);
        if (river.pond) {
            g.fillStyle(bankColor, 1);
            g.fillCircle(river.pond.x, river.pond.y, river.pond.r + 17);
        }
        return;
    }
    strokePolyline(g, pts, river.width, WATER, 1);
    strokePolyline(g, pts, river.width * 0.45, 0x4dabf7, 1);
    if (river.pond) {
        g.fillStyle(WATER, 1);
        g.fillCircle(river.pond.x, river.pond.y, river.pond.r);
        g.fillStyle(0x4dabf7, 1);
        g.fillCircle(river.pond.x - 10, river.pond.y - 8, river.pond.r * 0.6);
        g.fillStyle(0x2b8a3e, 1);
        g.fillCircle(river.pond.x + river.pond.r * 0.45, river.pond.y + river.pond.r * 0.2, 16);
        g.fillCircle(river.pond.x - river.pond.r * 0.4, river.pond.y + river.pond.r * 0.4, 12);
    }
    g.lineStyle(4, 0xe7f5ff, 0.85);
    for (let i = 1; i < pts.length - 1; i += 2) {
        const a = pts[i - 1];
        const b = pts[i + 1];
        const dx = b.x - a.x; const dy = b.y - a.y;
        const len = Math.hypot(dx, dy) || 1;
        const nx = -dy / len; const ny = dx / len;
        const side = (i % 4 === 1 ? 1 : -1) * river.width * 0.22;
        const cx = pts[i].x + nx * side;
        const cy = pts[i].y + ny * side;
        g.lineBetween(cx - (dx / len) * 14, cy - (dy / len) * 14, cx + (dx / len) * 14, cy + (dy / len) * 14);
    }
}

/** Lighter, rippled water where the river runs over the road. */
function drawFord(g, river) {
    const d = { x: river.dirX, y: river.dirY };
    const n = { x: -d.y, y: d.x };
    const half = river.width / 2 - 6;
    const across = HW + 13;
    const corner = (a, b) => ({ x: river.cx + d.x * a + n.x * b, y: river.cy + d.y * a + n.y * b });
    g.fillStyle(WATER_LIGHT, 0.55);
    g.fillPoints([corner(-half, -across), corner(half, -across), corner(half, across), corner(-half, across)], true);
    g.lineStyle(5, 0xffffff, 0.9);
    for (let k = -1; k <= 1; k++) {
        const a = k * half * 0.55;
        for (let s = -across + 10; s < across - 30; s += 44) {
            const p = corner(a - 8, s);
            const q = corner(a + 8, s + 22);
            const r = corner(a - 8, s + 44);
            g.beginPath();
            g.moveTo(p.x, p.y);
            g.lineTo(q.x, q.y);
            g.lineTo(r.x, r.y);
            g.strokePath();
        }
    }
}

function drawBridge(g, bridge) {
    const deck = bridge.deck;
    if (deck.length < 2) return;
    const a = deck[0];
    const b = deck[deck.length - 1];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const dx = (b.x - a.x) / len; const dy = (b.y - a.y) / len;
    const nx = -dy; const ny = dx;
    const w = ROAD_WIDTH / 2 + 10;
    const ext = 14;
    const at = (along, across) => ({ x: a.x + dx * along + nx * across, y: a.y + dy * along + ny * across });
    const rect = (s0, s1, c0, c1) => [at(s0, c0), at(s1, c0), at(s1, c1), at(s0, c1)];
    g.fillStyle(0x000000, 0.28);
    g.fillPoints(rect(-ext, len + ext, -w - 4, w + 14).map((p) => ({ x: p.x + 10, y: p.y + 12 })), true);
    g.fillStyle(0xb07845, 1);
    g.fillPoints(rect(-ext, len + ext, -w, w), true);
    g.lineStyle(4, 0x7a4f2a, 1);
    for (let t = -ext + 8; t < len + ext; t += 17) {
        const p = at(t, -w);
        const q = at(t, w);
        g.lineBetween(p.x, p.y, q.x, q.y);
    }
    [-1, 1].forEach((side) => {
        g.fillStyle(0x5c3a1e, 1);
        g.fillPoints(rect(-ext - 6, len + ext + 6, side * w - 7, side * w + 7), true);
        g.fillStyle(0x3e2512, 1);
        for (let t = -ext - 6; t <= len + ext + 6; t += (len + 2 * ext + 12) / 4) {
            const p = at(t, side * w);
            g.fillCircle(p.x, p.y, 10);
        }
    });
}

function sign(scene, x, y, text, fill, arrowAngle) {
    const c = scene.add.container(x, y);
    const g = scene.add.graphics();
    g.fillStyle(0x5c3a1e, 1);
    g.fillRect(-5, 10, 10, 46);
    g.fillStyle(0x1d2b53, 1);
    g.fillRoundedRect(-82, -38, 164, 58, 14);
    g.fillStyle(fill, 1);
    g.fillRoundedRect(-78, -34, 156, 50, 12);
    c.add(g);
    c.add(scene.add.text(arrowAngle === undefined ? 0 : -16, -9, text, {
        fontFamily: FONT, fontSize: '24px', fontStyle: 'bold', color: '#1d2b53'
    }).setOrigin(0.5));
    if (arrowAngle !== undefined) {
        const a = scene.add.graphics({ x: 56, y: -9 });
        a.fillStyle(0x1d2b53, 1);
        a.fillTriangle(16, 0, -10, -14, -10, 14);
        a.fillRect(-18, -5, 12, 10);
        a.rotation = arrowAngle;
        c.add(a);
    }
    return c;
}

/** Painted arrows onto the bridge road plus two upright signs. */
function drawBridgeSigns(scene, loop, f, course) {
    const b = f.bridge;
    const river = f.river;
    const g = scene.add.graphics();
    const at = (s) => b.points.reduce((best, p) => (Math.abs(p.s - s) < Math.abs(best.s - s) ? p : best), b.points[0]);
    [0.8, 0.45].forEach((u) => {
        const p = at(-(b.flat + b.ramp * u));
        const q = at(-(b.flat + b.ramp * u) + 30);
        const ang = Math.atan2(q.y - p.y, q.x - p.x);
        const c = Math.cos(ang); const s = Math.sin(ang);
        const tip = (x, y) => ({ x: p.x + c * x - s * y, y: p.y + s * x + c * y });
        g.fillStyle(0xffffff, 0.9);
        g.fillPoints([tip(34, 0), tip(-10, -34), tip(-10, -14), tip(-34, -14), tip(-34, 14), tip(-10, 14), tip(-10, 34)], true);
    });
    const clampX = (x) => Math.max(110, Math.min(course.width - 110, x));
    const clampY = (y) => Math.max(60, Math.min(course.height - 80, y));
    const fork = at(-(b.flat + b.ramp * 0.6));
    const next = at(-(b.flat + b.ramp * 0.3));
    const main = pointAt(loop, river.at - b.flat - b.ramp * 0.45);
    const out = b.side * (b.offset * 0.55 + HW + 110);
    sign(scene, clampX(main.x + main.normX * out), clampY(main.y + main.normY * out), 'BRIDGE', COLORS.yellow,
        Math.atan2(next.y - fork.y, next.x - fork.x));
    const wet = pointAt(loop, river.at - river.width / 2 - 260);
    const away = -b.side * (HW + 100);
    sign(scene, clampX(wet.x + wet.normX * away), clampY(wet.y + wet.normY * away), 'SPLASH!', 0x74c0fc);
}

/** Jump ramps are orange with chevrons; bumps are themed mounds. */
function drawRamp(scene, r, look) {
    const g = scene.add.graphics({ x: r.x, y: r.y });
    g.rotation = Math.atan2(r.dirY, r.dirX);
    const d = r.depth / 2;
    const w = r.halfWidth;
    if (r.kind === 'jump') {
        g.fillStyle(0x000000, 0.3);
        g.fillRect(d, -w, 16, w * 2);
        g.fillStyle(0xe8590c, 1);
        g.fillRect(-d, -w, r.depth, w * 2);
        g.fillStyle(0xff922b, 1);
        g.fillRect(-d, -w, r.depth * 0.6, w * 2);
        g.fillStyle(0xffd43b, 1);
        for (let y = -w + 24; y < w - 20; y += 52) {
            g.fillTriangle(-d + 16, y - 16, -d + 16, y + 16, d - 12, y);
        }
        g.lineStyle(4, COLORS.ink, 1);
        g.strokeRect(-d, -w, r.depth, w * 2);
        return;
    }
    if (look === 'log') {
        g.fillStyle(0x000000, 0.25);
        g.fillRoundedRect(-d + 8, -w, r.depth, w * 2, 18);
        g.fillStyle(0x7a5536, 1);
        g.fillRoundedRect(-d, -w, r.depth, w * 2, 18);
        g.lineStyle(3, 0x5c3a1e, 1);
        g.lineBetween(-d + 10, -w + 20, -d + 10, w - 20);
        g.lineBetween(d - 12, -w + 30, d - 12, w - 30);
        [-w + 6, w - 6].forEach((y) => {
            g.fillStyle(0xd9b98c, 1);
            g.fillCircle(0, y, d - 2);
            g.lineStyle(3, 0x7a5536, 1);
            g.strokeCircle(0, y, d * 0.5);
        });
        return;
    }
    const looks = {
        dune: [0xd9a860, 0xf5d69a],
        mogul: [0xb6cde0, 0xffffff]
    };
    const col = looks[look] || [0x6d4c41, 0x8d6e63];
    const n = 4;
    const lump = (w * 2 - 20) / n;
    for (let i = 0; i < n; i++) {
        const y = -w + 10 + lump * (i + 0.5);
        g.fillStyle(0x000000, 0.18);
        g.fillEllipse(8, y + 4, r.depth, lump);
        g.fillStyle(col[0], 1);
        g.fillEllipse(0, y, r.depth, lump);
        g.fillStyle(col[1], 1);
        g.fillEllipse(-6, y - 4, r.depth * 0.5, lump * 0.55);
    }
}

function drawStartLine(scene, loop) {
    const p = pointAt(loop, 0);
    const g = scene.add.graphics({ x: p.x, y: p.y });
    const size = 24;
    const cols = Math.ceil(ROAD_WIDTH / size);
    for (let row = 0; row < 2; row++) {
        for (let col = 0; col < cols; col++) {
            g.fillStyle((row + col) % 2 === 0 ? 0xffffff : 0x212529, 1);
            g.fillRect(-(cols * size) / 2 + col * size, -size + row * size, size, size);
        }
    }
    g.rotation = Math.atan2(p.dirY, p.dirX) + Math.PI / 2;
}

function drawCheckpoint(scene, cp) {
    const container = scene.add.container(cp.x, cp.y);
    const ring = scene.add.circle(0, 0, 78, COLORS.yellow, 0.35).setStrokeStyle(8, COLORS.white, 0.95);
    const star = scene.add.star(0, 0, 5, 26, 56, COLORS.yellow).setStrokeStyle(5, COLORS.ink);
    const label = scene.add.text(0, 4, cp.label, {
        fontFamily: FONT,
        fontSize: '34px',
        fontStyle: 'bold',
        color: '#1d2b53'
    }).setOrigin(0.5);
    container.add([ring, star, label]);
    scene.tweens.add({
        targets: ring,
        scale: 1.15,
        duration: 600,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
    });
    return { container, ring, star };
}

function scatter(rng, area, count, clearance, draw) {
    const target = Math.round(count * area.scale);
    let placed = 0;
    let tries = 0;
    while (placed < target && tries < target * 20) {
        tries++;
        const x = rng.between(60, area.width - 60);
        const y = rng.between(60, area.height - 60);
        if (area.blocked(x, y, clearance)) continue;
        draw(x, y);
        placed++;
    }
}

function decorateForest(g, rng, area) {
    scatter(rng, area, 40, 18, (x, y) => {
        g.fillStyle(0xffffff, 0.5);
        g.fillCircle(x, y, 4);
        g.fillStyle([0xff6b6b, 0xffd43b, 0xcc5de8][rng.between(0, 2)], 1);
        g.fillCircle(x, y, 3);
    });
    scatter(rng, area, 34, 70, (x, y) => {
        const r = rng.between(34, 56);
        g.fillStyle(0x000000, 0.15);
        g.fillCircle(x + 8, y + 10, r);
        g.fillStyle(0x2b8a3e, 1);
        g.fillCircle(x, y, r);
        g.fillStyle(0x40c057, 1);
        g.fillCircle(x - r * 0.25, y - r * 0.25, r * 0.6);
    });
}

function decorateDesert(g, rng, area) {
    scatter(rng, area, 26, 30, (x, y) => {
        const r = rng.between(14, 30);
        g.fillStyle(0xc9a26b, 1);
        g.fillEllipse(x, y, r * 2.2, r * 1.5);
    });
    scatter(rng, area, 26, 60, (x, y) => {
        const h = rng.between(50, 80);
        g.fillStyle(0x000000, 0.12);
        g.fillEllipse(x + 10, y + h / 2, 40, 16);
        g.fillStyle(0x2f9e44, 1);
        g.fillRoundedRect(x - 10, y - h / 2, 20, h, 10);
        g.fillRoundedRect(x - 28, y - 8, 14, 26, 7);
        g.fillRoundedRect(x + 14, y - 20, 14, 26, 7);
        g.fillRect(x - 20, y + 10, 12, 8);
        g.fillRect(x + 8, y - 2, 12, 8);
    });
}

function pineTree(g, x, y, size, color, snow) {
    g.fillStyle(0x000000, 0.18);
    g.fillEllipse(x + 10, y + size * 0.55, size * 1.3, size * 0.4);
    g.fillStyle(0x6b4f3a, 1);
    g.fillRect(x - 5, y + size * 0.25, 10, size * 0.35);
    for (let i = 0; i < 3; i++) {
        const w = size * (0.95 - i * 0.22);
        const top = y - size * 0.75 + i * size * 0.28;
        g.fillStyle(color, 1);
        g.fillTriangle(x, top - size * 0.2, x - w / 2, top + size * 0.35, x + w / 2, top + size * 0.35);
        if (snow) {
            g.fillStyle(0xffffff, 1);
            g.fillTriangle(x, top - size * 0.2, x - w * 0.2, top, x + w * 0.2, top);
        }
    }
}

function decoratePine(g, rng, area) {
    scatter(rng, area, 30, 22, (x, y) => {
        g.fillStyle(0x245f38, 1);
        g.fillEllipse(x, y, rng.between(30, 60), rng.between(16, 26));
    });
    scatter(rng, area, 12, 40, (x, y) => {
        g.fillStyle(0x7a5536, 1);
        g.fillRoundedRect(x - 36, y - 10, 72, 20, 10);
        g.fillStyle(0xd9b98c, 1);
        g.fillCircle(x + 32, y, 9);
        g.lineStyle(2, 0x7a5536, 1);
        g.strokeCircle(x + 32, y, 5);
    });
    scatter(rng, area, 14, 26, (x, y) => {
        g.fillStyle(0xf8f9fa, 1);
        g.fillRect(x - 3, y, 6, 10);
        g.fillStyle(0xe03131, 1);
        g.fillEllipse(x, y, 20, 12);
        g.fillStyle(0xffffff, 1);
        g.fillCircle(x - 4, y - 2, 2);
        g.fillCircle(x + 4, y - 1, 2);
    });
    scatter(rng, area, 56, 60, (x, y) => {
        pineTree(g, x, y, rng.between(56, 84), rng.between(0, 1) ? 0x14532d : 0x1e6b3a, false);
    });
}

function decorateSnow(g, rng, area, loop, course) {
    const lake = course.lake;
    g.fillStyle(0x3b5b7a, 0.25);
    g.fillEllipse(lake.x + 10, lake.y + 10, lake.rx * 2 + 20, lake.ry * 2 + 20);
    g.fillStyle(0xa5d8ff, 1);
    g.fillEllipse(lake.x, lake.y, lake.rx * 2, lake.ry * 2);
    g.fillStyle(0xd0ebff, 1);
    g.fillEllipse(lake.x - lake.rx * 0.25, lake.y - lake.ry * 0.3, lake.rx * 0.9, lake.ry * 0.6);
    g.lineStyle(4, 0xffffff, 0.9);
    g.lineBetween(lake.x - lake.rx * 0.6, lake.y + lake.ry * 0.3, lake.x - lake.rx * 0.3, lake.y + lake.ry * 0.15);
    g.lineBetween(lake.x + lake.rx * 0.2, lake.y - lake.ry * 0.4, lake.x + lake.rx * 0.6, lake.y - lake.ry * 0.25);
    g.lineBetween(lake.x + lake.rx * 0.1, lake.y + lake.ry * 0.5, lake.x + lake.rx * 0.4, lake.y + lake.ry * 0.4);

    scatter(rng, area, 30, 30, (x, y) => {
        const r = rng.between(24, 50);
        g.fillStyle(0xc5dcec, 1);
        g.fillCircle(x + 4, y + 6, r);
        g.fillStyle(0xffffff, 1);
        g.fillCircle(x, y, r);
    });
    scatter(rng, area, 8, 40, (x, y) => {
        g.fillStyle(0x000000, 0.12);
        g.fillEllipse(x + 8, y + 34, 50, 16);
        g.fillStyle(0xffffff, 1);
        g.fillCircle(x, y + 12, 24);
        g.fillCircle(x, y - 18, 17);
        g.lineStyle(3, 0xadb5bd, 1);
        g.strokeCircle(x, y + 12, 24);
        g.strokeCircle(x, y - 18, 17);
        g.fillStyle(0x1d2b53, 1);
        g.fillCircle(x - 6, y - 21, 3);
        g.fillCircle(x + 6, y - 21, 3);
        g.fillStyle(0xff922b, 1);
        g.fillTriangle(x, y - 17, x + 14, y - 14, x, y - 12);
        g.fillStyle(0xe03131, 1);
        g.fillRect(x - 16, y - 5, 32, 7);
    });
    scatter(rng, area, 36, 60, (x, y) => {
        pineTree(g, x, y, rng.between(56, 80), 0x2b8a3e, true);
    });
}

function decorateCity(g, rng, area, loop) {
    const windowColors = [0xffe066, 0xfff3bf, 0x74c0fc, 0xffa8a8];
    scatter(rng, area, 34, 95, (x, y) => {
        const w = rng.between(70, 120);
        const h = rng.between(70, 120);
        g.fillStyle(0x000000, 0.35);
        g.fillRect(x - w / 2 + 10, y - h / 2 + 12, w, h);
        g.fillStyle([0x2c3263, 0x343a6b, 0x3b2f63][rng.between(0, 2)], 1);
        g.fillRect(x - w / 2, y - h / 2, w, h);
        g.lineStyle(3, 0x151a33, 1);
        g.strokeRect(x - w / 2, y - h / 2, w, h);
        const lit = windowColors[rng.between(0, windowColors.length - 1)];
        for (let wx = x - w / 2 + 12; wx < x + w / 2 - 12; wx += 22) {
            for (let wy = y - h / 2 + 12; wy < y + h / 2 - 12; wy += 22) {
                g.fillStyle(rng.between(0, 3) ? lit : 0x151a33, 1);
                g.fillRect(wx, wy, 11, 11);
            }
        }
    });
    // Street lamps along the road edge.
    for (let d = 0, side = 1; d < loop.total; d += 320, side = -side) {
        const p = pointAt(loop, d);
        const x = p.x + p.normX * (HW + 46) * side;
        const y = p.y + p.normY * (HW + 46) * side;
        if (distanceToLoop(loop, x, y) < HW + 30) continue;
        g.fillStyle(0xfff3bf, 0.18);
        g.fillCircle(x, y, 60);
        g.fillStyle(0xfff3bf, 0.3);
        g.fillCircle(x, y, 32);
        g.fillStyle(0x868e96, 1);
        g.fillCircle(x, y, 9);
        g.fillStyle(0xffe066, 1);
        g.fillCircle(x, y, 6);
    }
}

const DECORATORS = {
    forest: decorateForest,
    desert: decorateDesert,
    pine: decoratePine,
    snow: decorateSnow,
    city: decorateCity
};
