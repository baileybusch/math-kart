import { COLORS } from './theme.js';
import { ROAD_WIDTH, courseGeometry } from '../game/courses.js';

const DOTS = [[0.1, 0.18], [0.9, 0.2], [0.5, 0.5], [0.12, 0.84], [0.88, 0.82]];

function strokeLine(g, pts, width, color, closed) {
    g.lineStyle(width, color, 1);
    g.strokePoints(pts, closed, closed);
    g.fillStyle(color, 1);
    pts.forEach((p) => g.fillCircle(p.x, p.y, width / 2));
}

/**
 * Mini map of a course in a w x h box: its real road shape (and bridge
 * road), the river, and jump ramps / bumps, in the course's colours.
 */
export function drawCoursePreview(g, course, x, y, w, h, locked) {
    const pal = course.palette;
    const geo = courseGeometry(course.id);
    const f = geo.features;
    g.fillStyle(pal.ground, 1);
    g.fillRoundedRect(x, y, w, h, 14);

    const pad = 12;
    const scale = Math.min((w - pad * 2) / course.width, (h - pad * 2) / course.height);
    const ox = x + (w - course.width * scale) / 2;
    const oy = y + (h - course.height * scale) / 2;
    const map = (p) => ({ x: ox + p.x * scale, y: oy + p.y * scale });
    const pts = geo.points.map(map);

    g.fillStyle(pal.deco, 1);
    DOTS.forEach((d) => g.fillCircle(x + d[0] * w, y + d[1] * h, Math.max(3, h * 0.05)));
    if (course.lake) {
        g.fillStyle(0xa5d8ff, 1);
        g.fillEllipse(ox + course.lake.x * scale, oy + course.lake.y * scale, course.lake.rx * 2 * scale, course.lake.ry * 2 * scale);
    }

    const road = Math.max(6, ROAD_WIDTH * scale);
    const bypass = f.bridge ? f.bridge.points.map(map) : null;
    [[road + 4, pal.edge], [road, pal.road]].forEach(([width, color]) => {
        strokeLine(g, pts, width, color, true);
        if (bypass) strokeLine(g, bypass, width, color, false);
    });

    if (f.river) {
        const river = f.river.points.map(map).filter((p) => p.x > x + 2 && p.x < x + w - 2 && p.y > y + 2 && p.y < y + h - 2);
        if (river.length > 1) strokeLine(g, river, Math.max(4, f.river.width * scale), 0x339af0, false);
        if (f.river.pond) {
            g.fillStyle(0x339af0, 1);
            g.fillCircle(ox + f.river.pond.x * scale, oy + f.river.pond.y * scale, Math.max(4, f.river.pond.r * scale));
        }
        if (f.bridge && f.bridge.deck.length > 1) strokeLine(g, f.bridge.deck.map(map), road, 0xb07845, false);
    }
    f.ramps.forEach((r) => {
        const p = map(r);
        g.fillStyle(r.kind === 'jump' ? 0xff922b : 0x6d4c41, 1);
        g.fillCircle(p.x, p.y, Math.max(2.5, road * (r.kind === 'jump' ? 0.42 : 0.3)));
    });

    const start = pts[0];
    const seg = geo.loop.segs[0];
    const nx = -seg.dy * (road / 2 + 1);
    const ny = seg.dx * (road / 2 + 1);
    g.lineStyle(4, COLORS.white, 1);
    g.lineBetween(start.x - nx, start.y - ny, start.x + nx, start.y + ny);

    if (locked) {
        g.fillStyle(0x000000, 0.45);
        g.fillRoundedRect(x, y, w, h, 14);
        const cx = x + w / 2;
        const cy = y + h / 2 + 4;
        g.lineStyle(6, COLORS.yellow, 1);
        g.strokeCircle(cx, cy - 12, 10);
        g.fillStyle(COLORS.yellow, 1);
        g.fillRoundedRect(cx - 16, cy - 10, 32, 26, 6);
    }
}
