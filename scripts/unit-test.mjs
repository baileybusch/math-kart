#!/usr/bin/env node
/**
 * Plain-Node checks of the math generators, answer checking and coin rules.
 * Generates thousands of problems per grade and verifies each one is
 * well-formed and self-consistent (the stored answer is accepted, hints
 * don't just give the answer away, typed answers parse, etc.).
 */
import { GRADES, getProblemForGrade } from '../src/math/grades.js';
import { checkAnswer, parseTypedNumber, formatNumber, toleranceFor } from '../src/math/answers.js';
import { coinDelta, coinRules } from '../src/math/economy.js';
import similarFigures, { YES, NO } from '../src/math/similarFigures.js';
import { COURSE_ORDER, STARTER_COURSE, ROAD_WIDTH, allCourses, courseGeometry, courseStatus, courseHazards } from '../src/game/courses.js';
import {
    stepKart, updateProgress, updateFeatures, reachedCheckpoint, kartStats, stepAI,
    BOUNDS_MARGIN, CHECKPOINT_RADIUS, WATER_SPEED, OFFROAD_SPEED
} from '../src/game/raceLogic.js';
import { bridgeOffset, onBypass, surfaceAt, RAMP_TYPES } from '../src/game/features.js';
import { pointAt, distanceToLoop, distanceToPolyline, segmentIntersection } from '../src/game/trackMath.js';

let failures = 0;
function check(cond, msg) {
    if (!cond) {
        failures++;
        if (failures < 40) console.log('    FAIL ' + msg);
    }
    return cond;
}
function ok(cond, msg) {
    console.log((cond ? '    ok   ' : '    FAIL ') + msg);
    if (!cond) failures++;
}

console.log('\n[answer parsing]');
ok(parseTypedNumber('15') === 15, '"15" -> 15');
ok(parseTypedNumber('6.67') === 6.67, '"6.67" -> 6.67');
ok(parseTypedNumber('.5') === 0.5, '".5" -> 0.5');
ok(Math.abs(parseTypedNumber('20/3') - 20 / 3) < 1e-12, '"20/3" -> 6.666...');
ok(isNaN(parseTypedNumber('')) && isNaN(parseTypedNumber('.')) && isNaN(parseTypedNumber('1.2.3')) && isNaN(parseTypedNumber('4/0')) && isNaN(parseTypedNumber('/3')), 'junk input is NaN');
ok(formatNumber(20 / 3) === '6.67' && formatNumber(14.4) === '14.4' && formatNumber(15) === '15', 'formatNumber rounds to 2 places');

const repeating = { mode: 'typed', value: 20 / 3, tolerance: toleranceFor(20 / 3) };
ok(['6.67', '6.666', '6.66', '6.7', '20/3', '6.6666667'].every((s) => checkAnswer(repeating, s)), 'repeating 6.666... accepts 6.67, 6.666, 6.66, 6.7, 20/3');
ok(!['6.6', '6', '7', '6.8'].some((s) => checkAnswer(repeating, s)), 'repeating 6.666... rejects 6.6, 6, 7, 6.8');
const neat = { mode: 'typed', value: 14.4, tolerance: toleranceFor(14.4) };
ok(checkAnswer(neat, '14.4') && checkAnswer(neat, '14.40') && checkAnswer(neat, '72/5') && !checkAnswer(neat, '14.5') && !checkAnswer(neat, '14'), 'neat 14.4 needs the exact value');

console.log('\n[coin rules]');
[3, 7].forEach((g) => {
    const r = coinRules(g);
    ok(r.right > r.hintRight && r.hintRight > 0 && r.hintWrong < 0 && r.wrong < r.hintWrong,
        'grade ' + g + ': right ' + r.right + ' > hint-right ' + r.hintRight + ' > 0 > hint-wrong ' + r.hintWrong + ' > wrong ' + r.wrong);
    ok(-r.wrong > 2, 'grade ' + g + ': wrong-no-hint penalty (' + r.wrong + ') is heavier than the old -2');
    ok(coinDelta(g, true, false) === r.right && coinDelta(g, true, true) === r.hintRight &&
        coinDelta(g, false, true) === r.hintWrong && coinDelta(g, false, false) === r.wrong, 'grade ' + g + ': coinDelta matches table');
});

const N = 4000;
GRADES.forEach((grade) => {
    console.log('\n[grade ' + grade.id + ': ' + N + ' generated problems]');
    const before = failures;
    const kinds = {};
    let typed = 0;
    let findXTyped = 0;
    let findX = 0;
    let repeatingCount = 0;
    for (let i = 0; i < N; i++) {
        const p = getProblemForGrade(grade.id);
        const tag = 'grade ' + grade.id + ' #' + i + ' ' + JSON.stringify(p).slice(0, 300);
        kinds[p.kind || p.packId] = (kinds[p.kind || p.packId] || 0) + 1;
        check(p.grade === grade.id, 'grade tag: ' + tag);
        check(typeof p.question === 'string' && p.question.length > 3, 'question: ' + tag);
        check(typeof p.hint === 'string' && p.hint.length > 10, 'hint: ' + tag);
        check(typeof p.explain === 'string' && p.explain.length > 3, 'explain: ' + tag);
        check(typeof p.answer === 'string' && p.answer.length > 0, 'answer: ' + tag);
        check(p.question.indexOf('undefined') === -1 && p.hint.indexOf('undefined') === -1 && p.explain.indexOf('NaN') === -1 && p.hint.indexOf('NaN') === -1, 'no undefined/NaN text: ' + tag);
        if (p.mode === 'typed') {
            typed++;
            check(isFinite(p.value) && p.value > 0, 'typed value: ' + tag);
            check(checkAnswer(p, p.answer), 'stored answer accepted: ' + tag);
            check(checkAnswer(p, String(p.value)), 'exact value accepted: ' + tag);
            check(!checkAnswer(p, formatNumber(p.value + 1)), 'off-by-one rejected: ' + tag);
            check(p.answer.length <= 6, 'answer fits the keypad display: ' + tag);
            if (p.tolerance > 0.01) repeatingCount++;
        } else {
            check(p.mode === 'choice', 'mode: ' + tag);
            check(Array.isArray(p.choices) && p.choices.length >= 2 && p.choices.length <= 3, 'choices: ' + tag);
            check(p.choices.indexOf(p.answer) !== -1, 'answer is a choice: ' + tag);
            check(new Set(p.choices).size === p.choices.length, 'choices unique: ' + tag);
            check(checkAnswer(p, p.answer), 'answer accepted: ' + tag);
            p.choices.filter((c) => c !== p.answer).forEach((c) => check(!checkAnswer(p, c), 'wrong choice rejected: ' + tag));
        }
        if (p.kind === 'find-x' || p.kind === 'word-find') {
            findX++;
            if (p.mode === 'typed') findXTyped++;
        }
        if (p.grade === 7) {
            const results = [];
            const result = /= ([0-9]+(?:\.[0-9]+)?)(?![0-9.]| [\u00F7\u00D7])/g;
            p.hint.replace(result, (m, v) => { results.push(v); return m; });
            const scale = p.kind === 'find-x' || p.kind === 'word-find' ? results[0] : null;
            check(!/x = [0-9]+(?:\.[0-9]+)?(?![0-9.]| [\u00F7\u00D7])/.test(p.hint) && results.every((r) => r !== p.answer || r === scale),
                'hint gives a step, not the answer: ' + tag);
        }
        if (p.diagram) {
            check(p.diagram.shapes.length === 2, 'two shapes: ' + tag);
            p.diagram.shapes.forEach((s) => {
                Object.keys(s.dims).forEach((k) => check(s.dims[k] > 0 && isFinite(s.dims[k]), 'dims positive: ' + tag));
                Object.keys(s.labels).forEach((k) => check(s.dims[k] !== undefined, 'label has a dim: ' + tag));
                if (s.kind === 'tri') {
                    const d = s.dims;
                    check(d.a + d.b > d.c && d.a + d.c > d.b && d.b + d.c > d.a, 'valid triangle: ' + tag);
                }
            });
            if (p.kind === 'find-x' || p.kind === 'word-find') {
                const xs = p.diagram.shapes.reduce((n, s) => n + Object.keys(s.labels).filter((k) => s.labels[k] === 'x').length, 0);
                check(xs === 1, 'exactly one x label: ' + tag);
                // Diagram numbers must actually be similar with x filled in.
                const filled = p.diagram.shapes.map((s) => {
                    const out = {};
                    Object.keys(s.dims).forEach((k) => { out[k] = s.labels[k] === 'x' ? p.value || parseFloat(p.answer) : s.dims[k]; });
                    return out;
                });
                const keys = Object.keys(filled[0]);
                const r0 = filled[1][keys[0]] / filled[0][keys[0]];
                const r1 = filled[1][keys[1]] / filled[0][keys[1]];
                check(Math.abs(r0 - r1) < 0.02, 'figures are similar with x filled in: ' + tag);
            }
        }
        if (p.kind === 'word-find' && p.question.indexOf('desk') !== -1) {
            p.diagram.shapes.forEach((s) => check(s.dims.w > s.dims.h && s.dims.w >= 3, 'desks are longer than wide: ' + tag));
        }
        if (p.kind === 'similar-check' || p.kind === 'word-similar') {
            const s = p.diagram.shapes;
            const keys = Object.keys(s[0].dims);
            const ratios = keys.map((k) => s[1].dims[k] / s[0].dims[k]);
            const same = ratios.every((r) => Math.abs(r - ratios[0]) < 1e-9);
            check((p.answer === YES) === same && (p.answer === YES || p.answer === NO), 'yes/no matches the ratios: ' + tag);
        }
    }
    const pct = (n, d) => Math.round((100 * n) / Math.max(1, d)) + '%';
    console.log('    kinds: ' + JSON.stringify(kinds));
    console.log('    typed: ' + pct(typed, N) + (findX ? ', find-x typed: ' + pct(findXTyped, findX) + ', repeating-decimal answers: ' + pct(repeatingCount, typed) : ''));
    ok(failures === before, 'all generated problems are well-formed and self-consistent');
    ok(typed / N > 0.4 && typed / N < 0.75, 'roughly half need a typed answer (' + pct(typed, N) + ')');
    if (findX) ok(findXTyped / findX >= 0.7, 'most find-x problems are typed (' + pct(findXTyped, findX) + ')');
    if (grade.id === 7) ok(repeatingCount > 0 && repeatingCount / typed < 0.25, 'some, but not many, repeating-decimal answers');
});

console.log('\n[grade 7 problem types exist]');
Object.keys(similarFigures.generators).forEach((name) => {
    const p = similarFigures.generators[name]();
    ok(!!p && typeof p.question === 'string', name + ': "' + p.question.slice(0, 70) + (p.question.length > 70 ? '\u2026' : '') + '" -> ' + p.answer);
});

// ------------------------------------------------------------ courses

function closest(a, b, c, d) {
    const x = segmentIntersection(a, b, c, d);
    if (x) return { dist: 0, p: x, q: x };
    const onSeg = (p, s, e) => {
        const dx = e.x - s.x; const dy = e.y - s.y;
        let t = ((p.x - s.x) * dx + (p.y - s.y) * dy) / (dx * dx + dy * dy || 1);
        t = Math.max(0, Math.min(1, t));
        return { x: s.x + dx * t, y: s.y + dy * t };
    };
    const opts = [[a, onSeg(a, c, d)], [b, onSeg(b, c, d)], [onSeg(c, a, b), c], [onSeg(d, a, b), d]];
    let best = null;
    opts.forEach(([p, q]) => {
        const dist = Math.hypot(p.x - q.x, p.y - q.y);
        if (!best || dist < best.dist) best = { dist, p, q };
    });
    return best;
}

function heading(loop, along) {
    const p = pointAt(loop, along);
    return Math.atan2(p.dirY, p.dirX);
}

/** Largest heading change (degrees) between two distances along the loop. */
function maxBend(loop, from, to) {
    const h0 = heading(loop, from);
    let worst = 0;
    for (let d = from; d <= to; d += 10) {
        let diff = Math.abs(heading(loop, d) - h0);
        if (diff > Math.PI) diff = 2 * Math.PI - diff;
        worst = Math.max(worst, diff);
    }
    return worst * 180 / Math.PI;
}

const cyc = (a, b, L) => {
    const d = Math.abs(((a - b) % L + L) % L);
    return Math.min(d, L - d);
};

function newKart(geo, stats) {
    const start = pointAt(geo.loop, -70);
    return Object.assign({
        x: start.x + start.normX * 48, y: start.y + start.normY * 48,
        rotation: Math.atan2(start.dirX, -start.dirY), speed: 0,
        segHint: geo.loop.segs.length - 1, along: -70, offRoad: false
    }, stats);
}

/**
 * Drives two laps with a look-ahead autopilot using the game's own rules.
 * With `bridge` it aims along the bridge side road instead of the ford.
 */
function simulateRace(geo, stats, opts) {
    const loop = geo.loop;
    const useBridge = !!(opts && opts.bridge);
    const kart = newKart(geo, stats);
    const race = { lap: 0, cpInLap: 0 };
    const dt = 1 / 60;
    const out = { checkpoints: 0, finished: false, time: 0, offRoadFrames: 0, clampedFrames: 0, frames: 0, wetFrames: 0, airFrames: 0, kart };
    for (let f = 0; f < 60 * 300 && !out.finished; f++) {
        const aim = kart.along + 240;
        const target = pointAt(loop, aim);
        const off = useBridge ? bridgeOffset(geo.features, aim, loop.total) : 0;
        const want = Math.atan2(target.x + target.normX * off - kart.x, -(target.y + target.normY * off - kart.y));
        let diff = want - kart.rotation;
        while (diff > Math.PI) diff -= 2 * Math.PI;
        while (diff < -Math.PI) diff += 2 * Math.PI;
        const input = { forward: Math.abs(diff) < 1.1, backward: false, left: diff < -0.06, right: diff > 0.06 };
        stepKart(kart, input, dt, geo.width, geo.height);
        if (kart.x <= BOUNDS_MARGIN || kart.y <= BOUNDS_MARGIN || kart.x >= geo.width - BOUNDS_MARGIN || kart.y >= geo.height - BOUNDS_MARGIN) out.clampedFrames++;
        if (updateProgress(race, kart, geo) && race.lap >= 2) out.finished = true;
        updateFeatures(kart, geo);
        if (reachedCheckpoint(race, kart, geo)) { race.cpInLap++; out.checkpoints++; }
        if (kart.offRoad && !(kart.air > 0)) out.offRoadFrames++;
        if (kart.inWater) out.wetFrames++;
        if (kart.air > 0) out.airFrames++;
        out.frames++;
    }
    out.time = out.frames * dt;
    out.jumps = kart.jumps || 0;
    out.splashes = kart.splashes || 0;
    return out;
}

function simulateAI(geo, opts) {
    const ai = { baseSpeed: opts.speed, lane: opts.lane, along: opts.along, useBridge: opts.useBridge, wobble: 0, air: 0, boost: 0 };
    const dt = 1 / 60;
    let frames = 0;
    let backwards = 0;
    let slowest = Infinity;
    while (ai.along < 2 * geo.loop.total && frames < 60 * 300) {
        const before = ai.along;
        stepAI(ai, geo, dt, ai.along);
        if (ai.along <= before) backwards++;
        slowest = Math.min(slowest, ai.speed);
        frames++;
    }
    return { finished: ai.along >= 2 * geo.loop.total, time: frames * dt, backwards, slowest, jumps: ai.jumps || 0, wetFrames: ai.wetFrames || 0 };
}

console.log('\n[courses and unlock ladder]');
ok(COURSE_ORDER.length >= 4 && COURSE_ORDER[0] === STARTER_COURSE && COURSE_ORDER.indexOf('desert') === 1, 'at least 4 courses, starter first, Desert second: ' + COURSE_ORDER.join(' > '));
const costs = allCourses().map((c) => c.cost);
ok(costs.join(',') === '0,100,250,450,700', 'unlock ladder is still 0 / 100 / 250 / 450 / 700: ' + costs.join(', '));
ok(allCourses().every((c, i, all) => i === 0 || c.prizes[0] >= all[i - 1].prizes[0]), 'later courses pay at least as much for 1st place');
ok(courseStatus('desert', ['forest']) === 'next' && courseStatus('pine', ['forest']) === 'later' &&
    courseStatus('pine', ['forest', 'desert']) === 'next' && courseStatus('forest', []) === 'unlocked', 'ladder: each course needs the one before it');
const palettes = allCourses().map((c) => c.palette.ground);
ok(new Set(palettes).size === palettes.length, 'every course has its own ground colour');

const summary = {};
allCourses().forEach((c) => {
    const before = failures;
    const geo = courseGeometry(c.id);
    const loop = geo.loop;
    const L = loop.total;
    const pts = geo.points;
    const n = pts.length;
    const f = geo.features;
    const hw = ROAD_WIDTH / 2;
    const edge = hw + 60;
    const inside = (p) => p.x >= edge && p.y >= edge && p.x <= c.width - edge && p.y <= c.height - edge;
    pts.forEach((p, i) => check(inside(p), c.id + ': waypoint ' + i + ' (' + p.x + ',' + p.y + ') keeps the road inside the course'));

    // Road pieces that aren't the same stretch of road never touch, except
    // at a planned figure-8 crossing (which must be a clear, wide angle).
    const crossings = [];
    const close = [];
    let minGap = Infinity;
    for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
            const si = loop.segs[i]; const sj = loop.segs[j];
            const sep = cyc(si.start + si.len / 2, sj.start + sj.len / 2, L) - (si.len + sj.len) / 2;
            if (sep < 450) continue;
            const r = closest(pts[i], pts[(i + 1) % n], pts[j], pts[(j + 1) % n]);
            if (r.dist === 0) {
                const angle = Math.acos(Math.abs(si.dx * sj.dx + si.dy * sj.dy)) * 180 / Math.PI;
                const alongs = [si.start + Math.hypot(r.p.x - si.ax, r.p.y - si.ay), sj.start + Math.hypot(r.p.x - sj.ax, r.p.y - sj.ay)];
                if (!crossings.some((x) => Math.hypot(x.x - r.p.x, x.y - r.p.y) < 60)) crossings.push({ x: r.p.x, y: r.p.y, angle, alongs });
            }
            if (r.dist < ROAD_WIDTH + 60) close.push(r);
            else minGap = Math.min(minGap, r.dist);
        }
    }
    check(crossings.length === (c.crossings || 0), c.id + ': road crosses itself ' + crossings.length + ' time(s) (planned ' + (c.crossings || 0) + ')');
    crossings.forEach((x) => check(x.angle >= 55, c.id + ': crossing at (' + Math.round(x.x) + ',' + Math.round(x.y) + ') is at a clear angle (' + Math.round(x.angle) + ' deg)'));
    close.forEach((r) => {
        const near = crossings.some((x) => {
            const zone = (ROAD_WIDTH + 60) / Math.sin(x.angle * Math.PI / 180) + 40;
            return Math.hypot(r.p.x - x.x, r.p.y - x.y) < zone && Math.hypot(r.q.x - x.x, r.q.y - x.y) < zone;
        });
        check(near, c.id + ': separate roads stay apart near (' + Math.round(r.p.x) + ',' + Math.round(r.p.y) + ') (' + Math.round(r.dist) + ')');
    });

    let maxTurn = 0;
    let minRadius = Infinity;
    for (let i = 0; i < n; i++) {
        const a = pts[(i + n - 1) % n]; const b = pts[i]; const d = pts[(i + 1) % n];
        const t = Math.abs(Math.atan2((b.x - a.x) * (d.y - b.y) - (b.y - a.y) * (d.x - b.x), (b.x - a.x) * (d.x - b.x) + (b.y - a.y) * (d.y - b.y)));
        maxTurn = Math.max(maxTurn, t * 180 / Math.PI);
        check(t * 180 / Math.PI <= 100, c.id + ': turn at waypoint ' + i + ' is gentle enough (' + Math.round(t * 180 / Math.PI) + ' deg)');
    }
    for (let d = 0; d < L; d += 10) {
        const a = pointAt(loop, d - 50); const b = pointAt(loop, d); const e = pointAt(loop, d + 50);
        const area2 = Math.abs((b.x - a.x) * (e.y - a.y) - (b.y - a.y) * (e.x - a.x));
        if (area2 > 1) minRadius = Math.min(minRadius, Math.hypot(b.x - a.x, b.y - a.y) * Math.hypot(e.x - b.x, e.y - b.y) * Math.hypot(e.x - a.x, e.y - a.y) / (2 * area2));
    }
    check(minRadius >= 140, c.id + ': tightest bend radius ' + Math.round(minRadius) + ' >= 140');
    check(maxBend(loop, -220, 60) < 3, c.id + ': the karts start on a straight (' + maxBend(loop, -220, 60).toFixed(1) + ' deg)');

    // Stars: spread round the lap, only reachable from their own stretch of
    // road, and never on a ramp, in the river or on the bridge detour.
    const fr = geo.checkpoints.map((cp) => cp.along / L);
    check(fr.every((x, i) => x > 0.12 && x < 0.92 && (i === 0 || x - fr[i - 1] >= 0.15)), c.id + ': checkpoints spread around the lap (' + fr.map((x) => x.toFixed(2)).join(', ') + ')');
    geo.checkpoints.forEach((cp) => {
        let other = Infinity;
        for (let d = 0; d < L; d += 20) {
            if (cyc(d, cp.along, L) < 700) continue;
            const p = pointAt(loop, d);
            other = Math.min(other, Math.hypot(p.x - cp.x, p.y - cp.y));
        }
        check(other > CHECKPOINT_RADIUS + hw + 40, c.id + ': star ' + cp.label + ' can only be reached from its own road (' + Math.round(other) + ' px to the next road)');
        f.ramps.forEach((r) => check(cyc(r.along, cp.along, L) > 320, c.id + ': star ' + cp.label + ' is away from ramp ' + r.id));
        if (f.river) check(cyc(f.river.at, cp.along, L) > (f.bridge ? f.bridge.half + 150 : 350), c.id + ': star ' + cp.label + ' is away from the river and bridge');
        crossings.forEach((x) => x.alongs.forEach((a) => check(cyc(a, cp.along, L) > 450, c.id + ': star ' + cp.label + ' is away from the crossing')));
    });

    // Ramps sit on straights with room to land.
    f.ramps.forEach((r) => {
        const landing = r.kind === 'jump' ? 360 : 160;
        const bend = maxBend(loop, r.along - 80, r.along + landing);
        check(bend < 20, c.id + ': ' + r.kind + ' ' + r.id + ' at ' + (r.along / L).toFixed(3) + ' is on a straight with room to land (' + bend.toFixed(1) + ' deg)');
        if (f.river) check(cyc(r.along, f.river.at, L) > f.bridge.half + 200, c.id + ': ' + r.kind + ' ' + r.id + ' is away from the river');
        f.ramps.forEach((o) => check(o === r || cyc(o.along, r.along, L) >= 200, c.id + ': ' + r.kind + ' ' + r.id + ' is at least 200 px from the next ramp, so fast karts land in between'));
        crossings.forEach((x) => x.alongs.forEach((a) => check(cyc(a, r.along, L) > 300, c.id + ': ' + r.kind + ' ' + r.id + ' is away from the crossing')));
    });

    if (f.river) {
        const rv = f.river;
        const b = f.bridge;
        const roadX = [];
        const bypassX = [];
        const addHit = (list, x) => { if (x && !list.some((q) => Math.hypot(q.x - x.x, q.y - x.y) < 5)) list.push(x); };
        for (let k = 0; k < rv.points.length - 1; k++) {
            for (let i = 0; i < n; i++) addHit(roadX, segmentIntersection(rv.points[k], rv.points[k + 1], pts[i], pts[(i + 1) % n]));
            for (let i = 0; i < b.points.length - 1; i++) addHit(bypassX, segmentIntersection(rv.points[k], rv.points[k + 1], b.points[i], b.points[i + 1]));
        }
        const roadHits = roadX.length;
        const bypassHits = bypassX.length;
        check(roadHits === 1, c.id + ': river crosses the road exactly once (' + roadHits + ')');
        check(bypassHits === 1 && b.deck.length >= 4, c.id + ': bridge road crosses the river once, on a bridge deck (' + bypassHits + ', deck ' + b.deck.length + ' pts)');
        check(maxBend(loop, b.from - 40, b.to + 40) < 12, c.id + ': the river and bridge are on a straight (' + maxBend(loop, b.from - 40, b.to + 40).toFixed(1) + ' deg)');
        b.points.forEach((p, i) => check(inside(p), c.id + ': bridge road point ' + i + ' is inside the course'));
        rv.points.forEach((p) => {
            const onFord = Math.hypot(p.x - rv.cx, p.y - rv.cy) < rv.width + hw;
            if (!onFord && !onBypass(f, p.x, p.y)) check(distanceToLoop(loop, p.x, p.y) > hw + rv.width / 2 + 20, c.id + ': river only meets the road at the ford (' + Math.round(p.x) + ',' + Math.round(p.y) + ')');
        });
        if (rv.pond) check(distanceToLoop(loop, rv.pond.x, rv.pond.y) > rv.pond.r + hw + 40 && distanceToPolyline(b.points, rv.pond.x, rv.pond.y) > rv.pond.r + hw + 30, c.id + ': pond sits clear of the roads');
        const apart = b.points.filter((p) => p.off >= ROAD_WIDTH);
        let bypassRadius = Infinity;
        for (let i = 3; i < b.points.length - 3; i++) {
            const a = b.points[i - 3]; const m = b.points[i]; const e = b.points[i + 3];
            const area2 = Math.abs((m.x - a.x) * (e.y - a.y) - (m.y - a.y) * (e.x - a.x));
            if (area2 > 1) bypassRadius = Math.min(bypassRadius, Math.hypot(m.x - a.x, m.y - a.y) * Math.hypot(e.x - m.x, e.y - m.y) * Math.hypot(e.x - a.x, e.y - a.y) / (2 * area2));
        }
        check(bypassRadius >= 150, c.id + ': bridge road bends are gentle (r=' + Math.round(bypassRadius) + ')');
        const d0 = b.deck[0]; const d1 = b.deck[b.deck.length - 1];
        check(b.deck.every((p) => Math.abs(p.off - b.offset) < 1), c.id + ': the bridge deck is straight, parallel to the road (' + Math.round(Math.hypot(d1.x - d0.x, d1.y - d0.y)) + ' px long)');
        for (let d = 0; d < L; d += 20) {
            if (d > b.from - 100 && d < b.to + 100) continue;
            const p = pointAt(loop, d);
            check(distanceToPolyline(apart, p.x, p.y) > ROAD_WIDTH + 60, c.id + ': bridge road stays away from the rest of the track (along ' + d + ')');
        }
        const mid = b.deck[Math.floor(b.deck.length / 2)];
        check(surfaceAt(f, rv.cx, rv.cy) === 'water' && surfaceAt(f, mid.x, mid.y) === 'bridge', c.id + ': ford is water, bridge deck is not');
        const gapAtPeak = b.offset - ROAD_WIDTH - 26;
        check(gapAtPeak >= 50, c.id + ': there is a visible island between the ford and the bridge road (' + gapAtPeak + ' px)');
    }

    const base = simulateRace(geo, kartStats({ speedUpgrades: 0, handlingUpgrades: 0 }));
    const fast = simulateRace(geo, kartStats({ speedUpgrades: 5, handlingUpgrades: 0 }));
    const runs = [['base kart', base], ['max speed, no steering', fast]];
    let bridgeRun = null;
    if (f.bridge) {
        bridgeRun = simulateRace(geo, kartStats({ speedUpgrades: 0, handlingUpgrades: 0 }), { bridge: true });
        runs.push(['base kart over the bridge', bridgeRun]);
    }
    runs.forEach(([label, r]) => {
        check(r.finished && r.checkpoints === 2 * geo.checkpoints.length, c.id + ' (' + label + '): autopilot reaches all ' + 2 * geo.checkpoints.length + ' checkpoints and finishes (' + r.checkpoints + ')');
        check(r.clampedFrames === 0, c.id + ' (' + label + '): never pushed against the course edge');
        check(r.offRoadFrames / r.frames < 0.12, c.id + ' (' + label + '): stays on the road (' + Math.round(100 * r.offRoadFrames / r.frames) + '% off-road)');
        check(r.jumps === 2 * f.ramps.length, c.id + ' (' + label + '): takes off from every ramp and bump on both laps (' + r.jumps + ' of ' + 2 * f.ramps.length + ')');
    });
    if (f.river) {
        check(base.splashes === 2 && base.wetFrames > 0, c.id + ': driving straight through the ford gets wet on both laps (' + base.splashes + ' splashes)');
        check(bridgeRun.splashes === 0, c.id + ': the bridge route stays dry (' + bridgeRun.splashes + ' splashes)');
        check(bridgeRun.time < base.time - 0.6, c.id + ': the bridge is faster than wading (' + bridgeRun.time.toFixed(1) + ' s vs ' + base.time.toFixed(1) + ' s)');
    }

    const ais = [
        ['Zoom', { speed: 225 * c.aiSpeed, lane: -48, along: -70, useBridge: true }],
        ['Bolt', { speed: 205 * c.aiSpeed, lane: 0, along: -170, useBridge: false }]
    ].map(([name, o]) => {
        const r = simulateAI(geo, o);
        check(r.finished && r.backwards === 0 && r.slowest > 0.4 * o.speed, c.id + ': AI ' + name + ' always moves forward and finishes (' + r.time.toFixed(1) + ' s, slowest ' + Math.round(r.slowest) + ')');
        check(r.jumps === 2 * f.ramps.length, c.id + ': AI ' + name + ' hops every ramp (' + r.jumps + ')');
        if (f.river) check(o.useBridge ? r.wetFrames === 0 : r.wetFrames > 0, c.id + ': AI ' + name + (o.useBridge ? ' takes the bridge' : ' wades through the ford') + ' (' + r.wetFrames + ' wet frames)');
        return r;
    });

    summary[c.id] = { lap: Math.round(L), hazards: courseHazards(c.id), time: base.time };
    ok(failures === before, c.name + ' (' + c.cost + ' coins): lap ' + Math.round(L) + ' px, ' + courseHazards(c.id).join(', ') +
        ', road gap ' + Math.round(minGap) + ', tightest bend r=' + Math.round(minRadius) +
        ', 2 laps in ' + Math.round(base.time) + ' s' + (bridgeRun ? ' (' + Math.round(bridgeRun.time) + ' s via bridge)' : '') +
        ' (' + Math.round(100 * base.offRoadFrames / base.frames) + '% off-road), AI ' + ais.map((r) => Math.round(r.time) + ' s').join(' / '));
});

console.log('\n[tracks feel different]');
const laps = COURSE_ORDER.map((id) => summary[id].lap);
ok(Math.max.apply(null, laps) / Math.min.apply(null, laps) >= 1.45, 'lap lengths vary a lot (' + laps.join(', ') + ' px)');
ok(new Set(COURSE_ORDER.map((id) => summary[id].hazards.join('+'))).size === COURSE_ORDER.length, 'every track has its own mix of features: ' + COURSE_ORDER.map((id) => id + '=' + summary[id].hazards.join('+')).join('; '));
ok(courseHazards('forest').indexOf('river + bridge') !== -1 && courseHazards('pine').indexOf('river + bridge') !== -1, 'rivers with bridges on Meadow and Pine');
ok(courseHazards('desert').indexOf('jumps') !== -1 && courseHazards('city').indexOf('jumps') !== -1, 'jump ramps on Desert and Night City');
ok(courseHazards('snow').indexOf('figure 8') !== -1, 'Snow Circuit is a figure 8');

console.log('\n[water, bridge and jumps]');
{
    const geo = courseGeometry('forest');
    const f = geo.features;
    const stats = kartStats({ speedUpgrades: 0, handlingUpgrades: 0 });
    const rv = f.river;
    const wading = Object.assign({ x: rv.cx, y: rv.cy, rotation: Math.atan2(rv.dirX, -rv.dirY), speed: stats.maxSpeed, segHint: 0 }, stats);
    let top = 0;
    for (let i = 0; i < 60; i++) {
        wading.x = rv.cx; wading.y = rv.cy;
        updateProgress({ lap: 0, cpInLap: 0 }, wading, geo);
        updateFeatures(wading, geo);
        stepKart(wading, { forward: true }, 1 / 60, geo.width, geo.height);
        if (i > 30) top = Math.max(top, wading.speed);
    }
    ok(wading.inWater && !wading.offRoad && top <= stats.maxSpeed * WATER_SPEED + 0.01, 'in the ford the top speed drops to ' + Math.round(WATER_SPEED * 100) + '% (' + Math.round(top) + ' of ' + stats.maxSpeed + ')');
    const mid = f.bridge.deck[Math.floor(f.bridge.deck.length / 2)];
    const dry = Object.assign({ x: mid.x, y: mid.y, rotation: 0, speed: 0, segHint: 0 }, stats);
    for (let i = 0; i < 150; i++) {
        dry.x = mid.x; dry.y = mid.y;
        updateProgress({ lap: 0, cpInLap: 0 }, dry, geo);
        updateFeatures(dry, geo);
        stepKart(dry, { forward: true }, 1 / 60, geo.width, geo.height);
    }
    ok(dry.onBridge && !dry.inWater && !dry.offRoad && dry.speed === stats.maxSpeed, 'on the bridge deck there is no slow-down and it counts as road (' + Math.round(dry.speed) + ')');
    ok(OFFROAD_SPEED > WATER_SPEED, 'water (' + WATER_SPEED + 'x) is slower than grass (' + OFFROAD_SPEED + 'x)');
}
{
    const geo = courseGeometry('desert');
    const r = geo.features.ramps.find((x) => x.kind === 'jump');
    const stats = kartStats({ speedUpgrades: 0, handlingUpgrades: 0 });
    const k = Object.assign({ x: r.x - r.dirX * 150, y: r.y - r.dirY * 150, rotation: Math.atan2(r.dirX, -r.dirY), speed: stats.maxSpeed, segHint: 0 }, stats);
    const race = { lap: 0, cpInLap: 0 };
    let peak = 0; let airborne = 0; let landing = null; let knocked = false;
    for (let i = 0; i < 60 * 3; i++) {
        updateProgress(race, k, geo);
        updateFeatures(k, geo);
        if (k.air > 0) {
            airborne++;
            if (!knocked) { knocked = true; k.rotation += 0.5; }
        } else if (airborne && !landing) {
            landing = { err: Math.abs(Math.atan2(Math.sin(k.rotation - k.roadHeading), Math.cos(k.rotation - k.roadHeading))), offRoad: k.offRoad };
        }
        peak = Math.max(peak, k.speed);
        const err = Math.atan2(Math.sin(k.roadHeading - k.rotation), Math.cos(k.roadHeading - k.rotation));
        stepKart(k, { forward: true, left: !(k.air > 0) && err < -0.03, right: !(k.air > 0) && err > 0.03 }, 1 / 60, geo.width, geo.height);
    }
    ok(k.jumps === 1 && airborne >= 40 && airborne <= 50, 'a jump ramp launches the kart once, for about ' + (r.air * 1000) + ' ms (' + airborne + ' frames)');
    ok(peak > stats.maxSpeed * 1.15 && peak <= stats.maxSpeed * r.boost + 0.01, 'take-off gives a speed boost (' + Math.round(peak) + ' vs top speed ' + stats.maxSpeed + ')');
    ok(k.speed === stats.maxSpeed, 'the boost wears off back to normal top speed after landing (' + Math.round(k.speed) + ')');
    ok(landing && !landing.offRoad && landing.err < 0.2, 'forgiving landing: a kart knocked 0.5 rad off line in the air lands on the road pointing down it (' + (landing ? landing.err.toFixed(2) : '?') + ' rad off)');
    const slow = Object.assign({ x: r.x - r.dirX * 60, y: r.y - r.dirY * 60, rotation: Math.atan2(r.dirX, -r.dirY), speed: 40, segHint: 0 }, stats);
    for (let i = 0; i < 60; i++) { updateProgress(race, slow, geo); updateFeatures(slow, geo); stepKart(slow, { forward: false }, 1 / 60, geo.width, geo.height); }
    ok(!slow.jumps, 'creeping over a ramp slower than ' + r.minSpeed + ' just rolls over it');
    const bump = RAMP_TYPES.bump;
    ok(bump.air < RAMP_TYPES.jump.air && bump.boost < RAMP_TYPES.jump.boost, 'bumps are smaller hops than jumps (' + bump.air + ' s vs ' + RAMP_TYPES.jump.air + ' s)');
}

if (failures) {
    console.error('\nUNIT TESTS FAILED (' + failures + ')');
    process.exit(1);
}
console.log('\nUNIT TESTS PASSED');
