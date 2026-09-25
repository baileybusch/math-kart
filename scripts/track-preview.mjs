#!/usr/bin/env node
/**
 * Draws every course (road, river, bridge, ramps, stars, start line) to
 * track-preview/tracks.html, and to tracks.png when Chrome is available.
 * Handy when editing corners in src/game/courses.js.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { allCourses, courseGeometry, ROAD_WIDTH } from '../src/game/courses.js';
import { pointAt } from '../src/game/trackMath.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'track-preview');
fs.mkdirSync(outDir, { recursive: true });

const hex = (n) => '#' + n.toString(16).padStart(6, '0');
const poly = (pts, closed) => pts.map((p, i) => (i ? 'L' : 'M') + p.x.toFixed(0) + ' ' + p.y.toFixed(0)).join(' ') + (closed ? ' Z' : '');

const cards = allCourses().map((c) => {
    const g = courseGeometry(c.id);
    const f = g.features;
    const parts = [];
    parts.push(`<rect width="${c.width}" height="${c.height}" fill="${hex(c.palette.ground)}"/>`);
    const road = poly(g.points, true);
    const bypass = f.bridge ? poly(f.bridge.points, false) : '';
    [[ROAD_WIDTH + 26, c.palette.edge], [ROAD_WIDTH, c.palette.road]].forEach(([w, col]) => {
        parts.push(`<path d="${road}" fill="none" stroke="${hex(col)}" stroke-width="${w}" stroke-linejoin="round"/>`);
        if (bypass) parts.push(`<path d="${bypass}" fill="none" stroke="${hex(col)}" stroke-width="${w}" stroke-linejoin="round"/>`);
    });
    if (f.river) {
        parts.push(`<path d="${poly(f.river.points, false)}" fill="none" stroke="#339af0" stroke-width="${f.river.width}" stroke-linecap="round" opacity="0.9"/>`);
        if (f.river.pond) parts.push(`<circle cx="${f.river.pond.x}" cy="${f.river.pond.y}" r="${f.river.pond.r}" fill="#339af0"/>`);
        if (f.bridge && f.bridge.deck.length > 1) parts.push(`<path d="${poly(f.bridge.deck, false)}" fill="none" stroke="#a0522d" stroke-width="${ROAD_WIDTH}"/>`);
    }
    f.ramps.forEach((r) => {
        const nx = -r.dirY; const ny = r.dirX;
        const hw = r.halfWidth; const hd = r.depth / 2;
        const q = [[-hd, -hw], [hd, -hw], [hd, hw], [-hd, hw]].map(([a, b]) => ({ x: r.x + r.dirX * a + nx * b, y: r.y + r.dirY * a + ny * b }));
        parts.push(`<path d="${poly(q, true)}" fill="${r.kind === 'jump' ? '#ff922b' : '#8d6e63'}"/>`);
    });
    for (let k = 1; k < 20; k++) {
        const p = pointAt(g.loop, (k / 20) * g.loop.total);
        parts.push(`<text x="${p.x}" y="${p.y + 12}" font-size="36" fill="#fff" text-anchor="middle" font-family="Arial">${(k / 20).toFixed(2).slice(1)}</text>`);
    }
    g.checkpoints.forEach((cp) => parts.push(`<circle cx="${cp.x}" cy="${cp.y}" r="70" fill="#ffd43b" stroke="#fff" stroke-width="10"/><text x="${cp.x}" y="${cp.y + 22}" font-size="64" text-anchor="middle" font-family="Arial" font-weight="bold">${cp.label}</text>`));
    const s = pointAt(g.loop, 0);
    parts.push(`<line x1="${s.x + s.normX * 95}" y1="${s.y + s.normY * 95}" x2="${s.x - s.normX * 95}" y2="${s.y - s.normY * 95}" stroke="#fff" stroke-width="24"/>`);
    const a = pointAt(g.loop, 200);
    parts.push(`<line x1="${s.x}" y1="${s.y}" x2="${a.x}" y2="${a.y}" stroke="#e03131" stroke-width="16" marker-end="url(#arr)"/>`);
    return `<div class="card"><h2>${c.name} (${c.id}) - lap ${Math.round(g.loop.total)} px, ${g.points.length} waypoints</h2>` +
        `<svg viewBox="0 0 ${c.width} ${c.height}" width="${c.width / 5}" height="${c.height / 5}">` +
        `<defs><marker id="arr" markerWidth="4" markerHeight="4" refX="2" refY="2" orient="auto"><path d="M0,0 L4,2 L0,4 z" fill="#e03131"/></marker></defs>` +
        parts.join('') + '</svg></div>';
});

const html = `<!doctype html><meta charset="utf-8"><style>body{font-family:Arial;margin:8px;background:#222;color:#fff;display:flex;flex-wrap:wrap;gap:10px}h2{font-size:14px;margin:2px}</style>${cards.join('')}`;
const htmlPath = path.join(outDir, 'tracks.html');
fs.writeFileSync(htmlPath, html);
console.log('wrote ' + path.relative(root, htmlPath));

const chrome = [process.env.CHROME_PATH, '/usr/bin/google-chrome', '/usr/local/bin/google-chrome', '/usr/bin/chromium'].filter(Boolean).find((p) => fs.existsSync(p));
if (chrome) {
    const { chromium } = await import('playwright-core');
    const browser = await chromium.launch({ executablePath: chrome, args: ['--no-sandbox'] });
    const page = await browser.newPage({ viewport: { width: 1320, height: 1100 } });
    await page.goto('file://' + htmlPath);
    await page.screenshot({ path: path.join(outDir, 'tracks.png'), fullPage: true });
    await browser.close();
    console.log('wrote track-preview/tracks.png');
}
