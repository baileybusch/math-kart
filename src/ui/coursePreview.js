import { COLORS } from './theme.js';
import { ROAD_WIDTH } from '../game/courses.js';

const DOTS = [[0.1, 0.18], [0.9, 0.2], [0.5, 0.5], [0.12, 0.84], [0.88, 0.82]];

/** Mini map of a course (its real road shape and colours) in a w x h box. */
export function drawCoursePreview(g, course, x, y, w, h, locked) {
    const pal = course.palette;
    g.fillStyle(pal.ground, 1);
    g.fillRoundedRect(x, y, w, h, 14);

    const pad = 12;
    const scale = Math.min((w - pad * 2) / course.width, (h - pad * 2) / course.height);
    const ox = x + (w - course.width * scale) / 2;
    const oy = y + (h - course.height * scale) / 2;
    const pts = course.points.map((p) => ({ x: ox + p[0] * scale, y: oy + p[1] * scale }));

    g.fillStyle(pal.deco, 1);
    DOTS.forEach((d) => g.fillCircle(x + d[0] * w, y + d[1] * h, Math.max(3, h * 0.05)));

    const road = Math.max(6, ROAD_WIDTH * scale);
    [[road + 4, pal.edge], [road, pal.road]].forEach(([width, color]) => {
        g.lineStyle(width, color, 1);
        g.strokePoints(pts, true, true);
        g.fillStyle(color, 1);
        pts.forEach((p) => g.fillCircle(p.x, p.y, width / 2));
    });

    const start = pts[0];
    g.fillStyle(COLORS.white, 1);
    g.fillRect(start.x - road / 2 - 1, start.y - 2, road + 2, 4);

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
