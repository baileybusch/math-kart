import Phaser from 'phaser';
import { pointAt, distanceToLoop } from './trackMath.js';
import { getCourse, courseGeometry, ROAD_WIDTH } from './courses.js';
import { FONT, COLORS } from '../ui/theme.js';

/**
 * Track Builder - draws a course from its closed loop of waypoints (course
 * data lives in courses.js). The same loop drives the road art, AI karts,
 * checkpoints and race progress.
 *
 * Only Graphics primitives are used so the Canvas renderer (old iPads) and
 * WebGL look the same.
 */

export { ROAD_WIDTH };

export function getCourseInfo(courseId) {
    const c = getCourse(courseId);
    return { id: c.id, name: c.name };
}

export function createTrack(scene, courseId) {
    const course = getCourse(courseId);
    const geo = courseGeometry(course.id);
    const points = geo.points;
    const loop = geo.loop;
    const pal = course.palette;
    const rng = new Phaser.Math.RandomDataGenerator([course.id]);
    const box = { width: course.width, height: course.height };

    scene.cameras.main.setBackgroundColor(pal.ground);

    const decor = scene.add.graphics();
    DECORATORS[course.id](decor, rng, box, loop);

    const road = scene.add.graphics();
    drawRoadLayer(road, points, ROAD_WIDTH + 26, pal.edge);
    drawRoadLayer(road, points, ROAD_WIDTH, pal.road);
    if (course.id === 'city') drawLaneDashes(road, loop, 0xf8f9fa);

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
        roadHalfWidth: geo.roadHalfWidth
    };
}

function drawRoadLayer(g, points, width, color) {
    g.lineStyle(width, color, 1);
    g.beginPath();
    g.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) g.lineTo(points[i].x, points[i].y);
    g.closePath();
    g.strokePath();
    g.fillStyle(color, 1);
    points.forEach((p) => g.fillCircle(p.x, p.y, width / 2));
}

function drawLaneDashes(g, loop, color) {
    for (let d = 0; d < loop.total; d += 90) {
        const p = pointAt(loop, d);
        const q = pointAt(loop, d + 40);
        g.lineStyle(8, color, 0.8);
        g.lineBetween(p.x, p.y, q.x, q.y);
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

function scatter(rng, course, loop, count, clearance, draw) {
    let placed = 0;
    let tries = 0;
    while (placed < count && tries < count * 20) {
        tries++;
        const x = rng.between(60, course.width - 60);
        const y = rng.between(60, course.height - 60);
        if (distanceToLoop(loop, x, y) < ROAD_WIDTH / 2 + clearance) continue;
        draw(x, y);
        placed++;
    }
}

function decorateForest(g, rng, course, loop) {
    scatter(rng, course, loop, 40, 18, (x, y) => {
        g.fillStyle(0xffffff, 0.5);
        g.fillCircle(x, y, 4);
        g.fillStyle([0xff6b6b, 0xffd43b, 0xcc5de8][rng.between(0, 2)], 1);
        g.fillCircle(x, y, 3);
    });
    scatter(rng, course, loop, 34, 70, (x, y) => {
        const r = rng.between(34, 56);
        g.fillStyle(0x000000, 0.15);
        g.fillCircle(x + 8, y + 10, r);
        g.fillStyle(0x2b8a3e, 1);
        g.fillCircle(x, y, r);
        g.fillStyle(0x40c057, 1);
        g.fillCircle(x - r * 0.25, y - r * 0.25, r * 0.6);
    });
}

function decorateDesert(g, rng, course, loop) {
    scatter(rng, course, loop, 26, 30, (x, y) => {
        const r = rng.between(14, 30);
        g.fillStyle(0xc9a26b, 1);
        g.fillEllipse(x, y, r * 2.2, r * 1.5);
    });
    scatter(rng, course, loop, 26, 60, (x, y) => {
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

function decoratePine(g, rng, course, loop) {
    scatter(rng, course, loop, 30, 22, (x, y) => {
        g.fillStyle(0x245f38, 1);
        g.fillEllipse(x, y, rng.between(30, 60), rng.between(16, 26));
    });
    scatter(rng, course, loop, 12, 40, (x, y) => {
        g.fillStyle(0x7a5536, 1);
        g.fillRoundedRect(x - 36, y - 10, 72, 20, 10);
        g.fillStyle(0xd9b98c, 1);
        g.fillCircle(x + 32, y, 9);
        g.lineStyle(2, 0x7a5536, 1);
        g.strokeCircle(x + 32, y, 5);
    });
    scatter(rng, course, loop, 14, 26, (x, y) => {
        g.fillStyle(0xf8f9fa, 1);
        g.fillRect(x - 3, y, 6, 10);
        g.fillStyle(0xe03131, 1);
        g.fillEllipse(x, y, 20, 12);
        g.fillStyle(0xffffff, 1);
        g.fillCircle(x - 4, y - 2, 2);
        g.fillCircle(x + 4, y - 1, 2);
    });
    scatter(rng, course, loop, 60, 60, (x, y) => {
        pineTree(g, x, y, rng.between(56, 84), rng.between(0, 1) ? 0x14532d : 0x1e6b3a, false);
    });
}

function decorateSnow(g, rng, course, loop) {
    // Frozen lake inside the loop.
    g.fillStyle(0x3b5b7a, 0.25);
    g.fillEllipse(1290, 800, 820, 400);
    g.fillStyle(0xa5d8ff, 1);
    g.fillEllipse(1280, 790, 800, 380);
    g.fillStyle(0xd0ebff, 1);
    g.fillEllipse(1180, 730, 360, 120);
    g.lineStyle(4, 0xffffff, 0.9);
    g.lineBetween(1000, 850, 1120, 810);
    g.lineBetween(1400, 700, 1560, 740);
    g.lineBetween(1330, 900, 1440, 880);

    const onLake = (x, y) => ((x - 1280) * (x - 1280)) / (460 * 460) + ((y - 790) * (y - 790)) / (240 * 240) < 1;
    scatter(rng, course, loop, 30, 30, (x, y) => {
        if (onLake(x, y)) return;
        const r = rng.between(24, 50);
        g.fillStyle(0xc5dcec, 1);
        g.fillCircle(x + 4, y + 6, r);
        g.fillStyle(0xffffff, 1);
        g.fillCircle(x, y, r);
    });
    scatter(rng, course, loop, 8, 40, (x, y) => {
        if (onLake(x, y)) return;
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
    scatter(rng, course, loop, 40, 60, (x, y) => {
        if (onLake(x, y)) return;
        pineTree(g, x, y, rng.between(56, 80), 0x2b8a3e, true);
    });
}

function decorateCity(g, rng, course, loop) {
    const windowColors = [0xffe066, 0xfff3bf, 0x74c0fc, 0xffa8a8];
    scatter(rng, course, loop, 34, 95, (x, y) => {
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
        const x = p.x + p.normX * (ROAD_WIDTH / 2 + 46) * side;
        const y = p.y + p.normY * (ROAD_WIDTH / 2 + 46) * side;
        if (distanceToLoop(loop, x, y) < ROAD_WIDTH / 2 + 30) continue;
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
