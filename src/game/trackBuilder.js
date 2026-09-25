import Phaser from 'phaser';
import { buildLoop, pointAt, distanceToLoop } from './trackMath.js';
import { FONT, COLORS } from '../ui/theme.js';

/**
 * Track Builder - draws a course from a closed loop of waypoints. The same
 * loop drives the road art, AI karts, checkpoints and race progress.
 *
 * Only Graphics primitives are used so the Canvas renderer (old iPads) and
 * WebGL look the same.
 */

export const ROAD_WIDTH = 190;

const COURSES = {
    forest: {
        name: 'Forest Loop',
        width: 2400,
        height: 1600,
        ground: 0x5cc85c,
        road: 0x8d7b68,
        edge: 0xf1e3c8,
        checkpointIndexes: [4, 8, 13],
        points: [
            [320, 520], [320, 900], [400, 1170], [640, 1320], [1000, 1340],
            [1380, 1240], [1740, 1320], [2040, 1230], [2150, 980], [2100, 690],
            [1960, 400], [1660, 270], [1300, 330], [1010, 470], [720, 330], [450, 300]
        ],
        decorate: decorateForest
    },
    desert: {
        name: 'Desert Canyon',
        width: 2400,
        height: 1600,
        ground: 0xf2d49b,
        road: 0xb08968,
        edge: 0xfff3d6,
        checkpointIndexes: [4, 9, 14],
        points: [
            [360, 420], [360, 800], [440, 1140], [720, 1320], [1060, 1260],
            [1240, 1010], [1440, 820], [1760, 860], [1960, 1100], [2170, 1250],
            [2260, 960], [2210, 620], [2020, 340], [1660, 260], [1310, 390],
            [1010, 560], [730, 430], [540, 270]
        ],
        decorate: decorateDesert
    }
};

export function getCourseInfo(courseId) {
    const c = COURSES[courseId] || COURSES.forest;
    return { id: COURSES[courseId] ? courseId : 'forest', name: c.name };
}

export function createTrack(scene, courseId) {
    const course = COURSES[courseId] || COURSES.forest;
    const points = course.points.map(([x, y]) => ({ x, y }));
    const loop = buildLoop(points);
    const rng = new Phaser.Math.RandomDataGenerator([courseId || 'forest']);

    scene.cameras.main.setBackgroundColor(course.ground);

    const decor = scene.add.graphics();
    course.decorate(decor, rng, course, loop);

    const road = scene.add.graphics();
    drawRoadLayer(road, points, ROAD_WIDTH + 26, course.edge);
    drawRoadLayer(road, points, ROAD_WIDTH, course.road);

    drawStartLine(scene, loop);

    const checkpoints = course.checkpointIndexes.map((index, i) => {
        const p = points[index];
        const cp = {
            x: p.x,
            y: p.y,
            along: loop.segs[index].start,
            label: String(i + 1)
        };
        cp.marker = drawCheckpoint(scene, cp);
        return cp;
    });

    return {
        id: courseId,
        name: course.name,
        width: course.width,
        height: course.height,
        loop,
        checkpoints,
        roadHalfWidth: ROAD_WIDTH / 2
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
