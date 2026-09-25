import { COLORS, INK, textStyle } from './theme.js';

const FILLS = [0xa5d8ff, 0xffd8a8];
const LABEL_SIZE = 22;
const X_SIZE = 28;
const MARGIN = 38;

/**
 * Unit-space outline of a shape (y grows downward) plus which edge each
 * label sits on. Edges are [fromIndex, toIndex] into `points`.
 */
function outline(shape) {
    const d = shape.dims;
    switch (shape.kind) {
        case 'rect':
            return {
                points: [[0, 0], [d.w, 0], [d.w, d.h], [0, d.h]],
                edges: { w: [0, 1], h: [1, 2] },
                rightAngles: [0, 1, 2, 3]
            };
        case 'rtri':
            return {
                points: [[0, 0], [0, d.h], [d.w, d.h]],
                edges: { h: [0, 1], w: [1, 2] },
                rightAngles: [1]
            };
        case 'para': {
            const dx = d.s * 0.5;
            const dy = d.s * 0.866;
            return {
                points: [[dx, 0], [dx + d.w, 0], [d.w, dy], [0, dy]],
                edges: { w: [0, 1], s: [3, 0] }
            };
        }
        case 'L':
            return {
                points: [[0, 0], [d.w * 0.45, 0], [d.w * 0.45, d.h * 0.55], [d.w, d.h * 0.55], [d.w, d.h], [0, d.h]],
                edges: { w: [4, 5], h: [5, 0] },
                rightAngles: [5]
            };
        case 'tri':
        default: {
            // Side c is the base; b is the left side, a the right side.
            const cx = (d.b * d.b + d.c * d.c - d.a * d.a) / (2 * d.c);
            const hy = Math.sqrt(Math.max(0.01, d.b * d.b - cx * cx));
            return {
                points: [[0, hy], [d.c, hy], [cx, 0]],
                edges: { c: [0, 1], a: [1, 2], b: [2, 0] }
            };
        }
    }
}

function bounds(points) {
    let minX = Infinity; let minY = Infinity; let maxX = -Infinity; let maxY = -Infinity;
    points.forEach((p) => {
        minX = Math.min(minX, p[0]); maxX = Math.max(maxX, p[0]);
        minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]);
    });
    return { minX, minY, w: Math.max(0.001, maxX - minX), h: Math.max(0.001, maxY - minY) };
}

function addLabel(scene, parent, text, mx, my, nx, ny) {
    const isX = text === 'x';
    const label = scene.add.text(0, 0, text, textStyle(isX ? X_SIZE : LABEL_SIZE, isX ? '#c92a2a' : INK)).setOrigin(0.5);
    const off = 8 + Math.abs(nx) * label.width / 2 + Math.abs(ny) * label.height / 2;
    label.setPosition(mx + nx * off, my + ny * off);
    if (isX) {
        const bubble = scene.add.circle(label.x, label.y, 20, COLORS.yellow).setStrokeStyle(3, 0xc92a2a);
        parent.add(bubble);
    }
    parent.add(label);
    return label;
}

function drawShape(scene, parent, shape, cx, cy, scale, fill) {
    const o = outline(shape);
    const b = bounds(o.points);
    const ox = cx - (b.w * scale) / 2 - b.minX * scale;
    const oy = cy - (b.h * scale) / 2 - b.minY * scale;
    const pts = o.points.map((p) => ({ x: ox + p[0] * scale, y: oy + p[1] * scale }));

    const g = scene.add.graphics();
    g.fillStyle(fill, 1);
    g.fillPoints(pts, true);
    g.lineStyle(4, COLORS.ink, 1);
    g.strokePoints(pts, true);

    (o.rightAngles || []).forEach((i) => {
        const p = pts[i];
        const prev = pts[(i + pts.length - 1) % pts.length];
        const next = pts[(i + 1) % pts.length];
        const ux = Math.sign(prev.x - p.x) || 0; const uy = Math.sign(prev.y - p.y) || 0;
        const vx = Math.sign(next.x - p.x) || 0; const vy = Math.sign(next.y - p.y) || 0;
        const m = 12;
        g.lineStyle(2, COLORS.ink, 1);
        g.beginPath();
        g.moveTo(p.x + ux * m, p.y + uy * m);
        g.lineTo(p.x + ux * m + vx * m, p.y + uy * m + vy * m);
        g.lineTo(p.x + vx * m, p.y + vy * m);
        g.strokePath();
    });
    parent.add(g);

    let sx = 0; let sy = 0;
    pts.forEach((p) => { sx += p.x; sy += p.y; });
    const centroid = { x: sx / pts.length, y: sy / pts.length };

    Object.keys(o.edges).forEach((key) => {
        const text = shape.labels[key];
        if (text === undefined) return;
        const e = o.edges[key];
        const p = pts[e[0]];
        const q = pts[e[1]];
        const mx = (p.x + q.x) / 2;
        const my = (p.y + q.y) / 2;
        const len = Math.sqrt((q.x - p.x) * (q.x - p.x) + (q.y - p.y) * (q.y - p.y)) || 1;
        let nx = -(q.y - p.y) / len;
        let ny = (q.x - p.x) / len;
        if (nx * (mx - centroid.x) + ny * (my - centroid.y) < 0) { nx = -nx; ny = -ny; }
        addLabel(scene, parent, text, mx, my, nx, ny);
    });
}

/**
 * Draws a pair of figures side by side inside box {x, y, w, h} (parent
 * coordinates). Both are drawn at one shared scale so the bigger figure
 * looks bigger, but the small one never shrinks below a readable size.
 */
export function drawDiagram(scene, parent, diagram, box) {
    const shapes = diagram.shapes;
    const captionH = diagram.captions ? 30 : 0;
    const slotW = box.w / shapes.length;
    const slotH = box.h - captionH;
    const fits = shapes.map((s) => {
        const b = bounds(outline(s).points);
        return Math.min((slotW - 2 * MARGIN) / b.w, (slotH - 2 * MARGIN + 10) / b.h);
    });
    const common = Math.min.apply(null, fits);

    shapes.forEach((shape, i) => {
        const scale = Math.max(common, fits[i] * 0.5);
        const cx = box.x + slotW * (i + 0.5);
        const cy = box.y + slotH / 2;
        drawShape(scene, parent, shape, cx, cy, scale, FILLS[i % FILLS.length]);
        if (diagram.captions && diagram.captions[i]) {
            parent.add(scene.add.text(cx, box.y + box.h - captionH / 2, diagram.captions[i], textStyle(20, '#495057')).setOrigin(0.5));
        }
    });
}
