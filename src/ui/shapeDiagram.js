import { COLORS, INK, textStyle } from './theme.js';

const FILLS = [0xa5d8ff, 0xffd8a8];
const LABEL_SIZE = 26;
const GAP = 22;
const MIN_PX = 70;
const X_COLOR = '#e8590c';

// Shape outlines in "side length" units with y pointing up.
// edges: label key -> [from, to] point indexes; left/right: label keys drawn
// beside the shape (need horizontal room); right: corners with a square mark.
function outline(s) {
    switch (s.kind) {
        case 'rightTri':
            return { pts: [[0, 0], [s.w, 0], [0, s.h]], edges: { w: [0, 1], h: [2, 0] }, left: ['h'], rightSide: [], square: [0] };
        case 'para': {
            const dx = s.h * 0.5;
            const dy = s.h * 0.866;
            return { pts: [[0, 0], [s.w, 0], [s.w + dx, dy], [dx, dy]], edges: { w: [0, 1], h: [3, 0] }, left: ['h'], rightSide: [], square: [] };
        }
        case 'L':
            return {
                pts: [[0, 0], [s.w, 0], [s.w, s.h * 0.5], [s.w * 0.5, s.h * 0.5], [s.w * 0.5, s.h], [0, s.h]],
                edges: { w: [0, 1], h: [5, 0] },
                left: ['h'],
                rightSide: [],
                square: [0]
            };
        case 'tri': {
            const ax = (s.a * s.a + s.b * s.b - s.c * s.c) / (2 * s.a);
            const ay = Math.sqrt(Math.max(0, s.b * s.b - ax * ax));
            return { pts: [[0, 0], [s.a, 0], [ax, ay]], edges: { a: [0, 1], c: [1, 2], b: [2, 0] }, left: ['b'], rightSide: ['c'], square: [] };
        }
        case 'flag':
        case 'rect':
        default:
            return { pts: [[0, 0], [s.w, 0], [s.w, s.h], [0, s.h]], edges: { w: [0, 1], h: [3, 0] }, left: ['h'], rightSide: [], square: [0] };
    }
}

function bounds(pts) {
    let minX = Infinity;
    let maxX = -Infinity;
    let maxY = 0;
    pts.forEach((p) => {
        minX = Math.min(minX, p[0]);
        maxX = Math.max(maxX, p[0]);
        maxY = Math.max(maxY, p[1]);
    });
    return { minX, w: maxX - minX, h: maxY };
}

function makeLabels(scene, shape, o) {
    const texts = {};
    Object.keys(o.edges).forEach((key) => {
        const label = shape.labels && shape.labels[key];
        if (!label) return;
        const isX = label === 'x';
        texts[key] = scene.add.text(0, 0, label, textStyle(isX ? LABEL_SIZE + 6 : LABEL_SIZE, isX ? X_COLOR : INK)).setOrigin(0.5);
    });
    const side = (keys) => keys.reduce((m, k) => Math.max(m, texts[k] ? texts[k].width + 14 : 6), 6);
    return { texts, padL: side(o.left), padR: side(o.rightSide) };
}

/**
 * Draw diagram.shapes (side by side, bottom-aligned, roughly to scale) or
 * diagram.bars into parent (a container) inside box {x, y, w, h}.
 */
export function drawDiagram(scene, parent, diagram, box) {
    if (!diagram) return;
    if (diagram.bars) {
        drawBars(scene, parent, diagram.bars, box);
        return;
    }
    const shapes = diagram.shapes || [];
    const outlines = shapes.map(outline);
    const bb = outlines.map((o) => bounds(o.pts));
    const labels = shapes.map((shape, i) => makeLabels(scene, shape, outlines[i]));
    const n = shapes.length;
    const padTop = 8;
    const padBottom = LABEL_SIZE + 16;
    let fixedW = (n - 1) * GAP;
    labels.forEach((l) => { fixedW += l.padL + l.padR; });
    const availW = box.w - fixedW;
    const availH = box.h - padTop - padBottom;
    let sumW = 0;
    let maxH = 0;
    bb.forEach((b) => { sumW += b.w; maxH = Math.max(maxH, b.h); });
    const common = Math.min(availW / sumW, availH / maxH);

    // Keep small figures big enough to read, then shrink everything to fit.
    let scales = bb.map((b) => Math.max(common, MIN_PX / Math.max(b.w, b.h)));
    scales = scales.map((s, i) => Math.min(s, availH / bb[i].h));
    let pxW = 0;
    bb.forEach((b, i) => { pxW += b.w * scales[i]; });
    if (pxW > availW) {
        const f = availW / pxW;
        scales = scales.map((s) => s * f);
        pxW = availW;
    }
    let groupH = 0;
    bb.forEach((b, i) => { groupH = Math.max(groupH, b.h * scales[i]); });

    let x = box.x + (box.w - pxW - fixedW) / 2;
    const baseY = box.y + padTop + (availH + groupH) / 2;
    shapes.forEach((shape, i) => {
        const s = scales[i];
        const o = outlines[i];
        x += labels[i].padL;
        const ox = x - bb[i].minX * s;
        const pts = o.pts.map((p) => ({ x: ox + p[0] * s, y: baseY - p[1] * s }));
        drawShape(scene, parent, shape, o, pts, FILLS[i % FILLS.length], labels[i].texts);
        x += bb[i].w * s + labels[i].padR + GAP;
    });
}

function drawShape(scene, parent, shape, o, pts, fill, texts) {
    const g = scene.add.graphics();
    g.fillStyle(fill, 1);
    g.fillPoints(pts, true);
    if (shape.kind === 'flag') {
        const w = pts[1].x - pts[0].x;
        const h = pts[0].y - pts[3].y;
        g.fillStyle(0x4dabf7, 1);
        g.fillRect(pts[3].x, pts[3].y, w / 3, h);
        g.fillStyle(0xffffff, 1);
        g.fillRect(pts[3].x + w / 3, pts[3].y, w / 3, h);
        g.fillStyle(0xffd43b, 1);
        g.fillRect(pts[3].x + 2 * w / 3, pts[3].y, w / 3, h);
        g.fillStyle(COLORS.ink, 1);
        g.fillCircle(pts[3].x + w / 2, pts[3].y + h / 2, Math.min(w, h) * 0.12);
    }
    g.lineStyle(4, COLORS.ink, 1);
    g.strokePoints(pts, true, true);

    o.square.forEach((idx) => {
        const c = pts[idx];
        const r = 12;
        g.lineStyle(3, COLORS.ink, 1);
        g.strokeRect(c.x, c.y - r, r, r);
    });
    parent.add(g);

    let cx = 0;
    let cy = 0;
    pts.forEach((p) => { cx += p.x; cy += p.y; });
    cx /= pts.length;
    cy /= pts.length;

    Object.keys(texts).forEach((key) => {
        const t = texts[key];
        const e = o.edges[key];
        const a = pts[e[0]];
        const b = pts[e[1]];
        const mx = (a.x + b.x) / 2;
        const my = (a.y + b.y) / 2;
        let nx = -(b.y - a.y);
        let ny = b.x - a.x;
        const len = Math.sqrt(nx * nx + ny * ny) || 1;
        nx /= len;
        ny /= len;
        if (nx * (mx - cx) + ny * (my - cy) < 0) {
            nx = -nx;
            ny = -ny;
        }
        const off = 8 + Math.abs(nx) * t.width / 2 + Math.abs(ny) * t.height / 2;
        t.setPosition(mx + nx * off, my + ny * off);
        parent.add(t);
    });
}

function drawBars(scene, parent, bars, box) {
    const nameW = 150;
    const barMax = box.w - nameW - 20;
    const maxLen = Math.max.apply(null, bars.map((b) => b.len));
    const rowH = Math.min(90, box.h / bars.length);
    const top = box.y + (box.h - rowH * bars.length) / 2;
    const g = scene.add.graphics();
    parent.add(g);
    bars.forEach((bar, i) => {
        const y = top + rowH * i + rowH / 2;
        const w = Math.max(130, barMax * bar.len / maxLen);
        const x0 = box.x + nameW;
        g.fillStyle(COLORS.ink, 1);
        g.fillRoundedRect(x0, y - 22 + 5, w, 44, 14);
        g.fillStyle(FILLS[i % FILLS.length], 1);
        g.fillRoundedRect(x0, y - 22, w, 44, 14);
        g.lineStyle(4, COLORS.ink, 1);
        g.strokeRoundedRect(x0, y - 22, w, 44, 14);
        parent.add(scene.add.text(box.x + nameW - 14, y, bar.name, textStyle(24, INK)).setOrigin(1, 0.5));
        const isX = /^x\b/.test(bar.value);
        parent.add(scene.add.text(x0 + w / 2, y, bar.value, textStyle(26, isX ? X_COLOR : INK)).setOrigin(0.5));
    });
}
