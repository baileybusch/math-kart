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
import { COURSE_ORDER, STARTER_COURSE, ROAD_WIDTH, allCourses, courseGeometry, courseStatus } from '../src/game/courses.js';
import { stepKart, updateProgress, reachedCheckpoint, kartStats, BOUNDS_MARGIN } from '../src/game/raceLogic.js';
import { pointAt } from '../src/game/trackMath.js';

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

function segDist(a, b, c, d) {
    const pointSeg = (p, s, e) => {
        const dx = e.x - s.x; const dy = e.y - s.y;
        let t = ((p.x - s.x) * dx + (p.y - s.y) * dy) / (dx * dx + dy * dy);
        t = Math.max(0, Math.min(1, t));
        return Math.hypot(p.x - (s.x + dx * t), p.y - (s.y + dy * t));
    };
    const cross = (o, p, q) => (p.x - o.x) * (q.y - o.y) - (p.y - o.y) * (q.x - o.x);
    const intersects = cross(a, b, c) * cross(a, b, d) < 0 && cross(c, d, a) * cross(c, d, b) < 0;
    if (intersects) return 0;
    return Math.min(pointSeg(a, c, d), pointSeg(b, c, d), pointSeg(c, a, b), pointSeg(d, a, b));
}

/** Drives two laps with a look-ahead autopilot using the game's own rules. */
function simulateRace(geo, stats) {
    const loop = geo.loop;
    const start = pointAt(loop, -70);
    const kart = Object.assign({
        x: start.x + start.normX * 48, y: start.y + start.normY * 48,
        rotation: Math.atan2(start.dirX, -start.dirY), speed: 0,
        segHint: loop.segs.length - 1, along: -70, offRoad: false
    }, stats);
    const race = { lap: 0, cpInLap: 0 };
    const dt = 1 / 60;
    const out = { checkpoints: 0, finished: false, time: 0, offRoadFrames: 0, clampedFrames: 0, frames: 0 };
    for (let f = 0; f < 60 * 240 && !out.finished; f++) {
        const target = pointAt(loop, kart.along + 240);
        const want = Math.atan2(target.x - kart.x, -(target.y - kart.y));
        let diff = want - kart.rotation;
        while (diff > Math.PI) diff -= 2 * Math.PI;
        while (diff < -Math.PI) diff += 2 * Math.PI;
        const input = { forward: Math.abs(diff) < 1.1, backward: false, left: diff < -0.06, right: diff > 0.06 };
        stepKart(kart, input, dt, geo.width, geo.height);
        if (kart.x <= BOUNDS_MARGIN || kart.y <= BOUNDS_MARGIN || kart.x >= geo.width - BOUNDS_MARGIN || kart.y >= geo.height - BOUNDS_MARGIN) out.clampedFrames++;
        if (updateProgress(race, kart, geo) && race.lap >= 2) out.finished = true;
        if (reachedCheckpoint(race, kart, geo)) { race.cpInLap++; out.checkpoints++; }
        if (kart.offRoad) out.offRoadFrames++;
        out.frames++;
    }
    out.time = out.frames * dt;
    return out;
}

console.log('\n[courses and unlock ladder]');
ok(COURSE_ORDER.length >= 4 && COURSE_ORDER[0] === STARTER_COURSE && COURSE_ORDER.indexOf('desert') === 1, 'at least 4 courses, starter first, Desert second: ' + COURSE_ORDER.join(' > '));
const costs = allCourses().map((c) => c.cost);
ok(costs[0] === 0 && costs.every((c, i) => i === 0 || c > costs[i - 1]), 'unlock costs escalate: ' + costs.join(', '));
ok(allCourses().every((c, i, all) => i === 0 || c.prizes[0] >= all[i - 1].prizes[0]), 'later courses pay at least as much for 1st place');
ok(courseStatus('desert', ['forest']) === 'next' && courseStatus('pine', ['forest']) === 'later' &&
    courseStatus('pine', ['forest', 'desert']) === 'next' && courseStatus('forest', []) === 'unlocked', 'ladder: each course needs the one before it');
const palettes = allCourses().map((c) => c.palette.ground);
ok(new Set(palettes).size === palettes.length, 'every course has its own ground colour');

allCourses().forEach((c) => {
    const before = failures;
    const geo = courseGeometry(c.id);
    const pts = geo.points;
    const n = pts.length;
    const edge = ROAD_WIDTH / 2 + 60;
    pts.forEach((p, i) => check(p.x >= edge && p.y >= edge && p.x <= c.width - edge && p.y <= c.height - edge,
        c.id + ': waypoint ' + i + ' (' + p.x + ',' + p.y + ') keeps the road inside the course'));
    let minGap = Infinity;
    for (let i = 0; i < n; i++) {
        for (let j = i + 3; j < n; j++) {
            if ((i + n - j) % n < 3) continue;
            const d = segDist(pts[i], pts[(i + 1) % n], pts[j], pts[(j + 1) % n]);
            minGap = Math.min(minGap, d);
            check(d >= ROAD_WIDTH + 60, c.id + ': roads ' + i + ' and ' + j + ' stay apart (' + Math.round(d) + ')');
        }
    }
    let maxTurn = 0;
    for (let i = 0; i < n; i++) {
        const a = pts[(i + n - 1) % n]; const b = pts[i]; const d = pts[(i + 1) % n];
        const t = Math.abs(Math.atan2((b.x - a.x) * (d.y - b.y) - (b.y - a.y) * (d.x - b.x), (b.x - a.x) * (d.x - b.x) + (b.y - a.y) * (d.y - b.y))) * 180 / Math.PI;
        maxTurn = Math.max(maxTurn, t);
        check(t <= 100, c.id + ': turn at waypoint ' + i + ' is gentle enough (' + Math.round(t) + ' deg)');
    }
    const fr = geo.checkpoints.map((cp) => cp.along / geo.loop.total);
    check(fr.every((f, i) => f > 0.12 && f < 0.92 && (i === 0 || f - fr[i - 1] >= 0.15)), c.id + ': checkpoints spread around the lap (' + fr.map((f) => f.toFixed(2)).join(', ') + ')');

    const base = simulateRace(geo, kartStats({ speedUpgrades: 0, handlingUpgrades: 0 }));
    const fast = simulateRace(geo, kartStats({ speedUpgrades: 5, handlingUpgrades: 0 }));
    [['base kart', base], ['max speed, no steering', fast]].forEach(([label, r]) => {
        check(r.finished && r.checkpoints === 2 * geo.checkpoints.length, c.id + ' (' + label + '): autopilot reaches all ' + 2 * geo.checkpoints.length + ' checkpoints and finishes (' + r.checkpoints + ')');
        check(r.clampedFrames === 0, c.id + ' (' + label + '): never pushed against the course edge');
        check(r.offRoadFrames / r.frames < 0.12, c.id + ' (' + label + '): stays on the road (' + Math.round(100 * r.offRoadFrames / r.frames) + '% off-road)');
    });
    ok(failures === before, c.name + ' (' + c.cost + ' coins): ' + n + ' waypoints, road gap ' + Math.round(minGap) + ', sharpest turn ' + Math.round(maxTurn) +
        ' deg, 2 laps in ' + Math.round(base.time) + ' s (' + Math.round(100 * base.offRoadFrames / base.frames) + '% off-road)');
});

if (failures) {
    console.error('\nUNIT TESTS FAILED (' + failures + ')');
    process.exit(1);
}
console.log('\nUNIT TESTS PASSED');
