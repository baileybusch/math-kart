import { randInt, pick, chance, weightedPick } from './random.js';
import { formatNumber, formatApprox } from './answerCheck.js';

/**
 * Grade 7: Similar Figures, scale factor and proportions.
 * Problem types follow a 7th-grade "Similar Figures" worksheet (7.2.8.B):
 *   - similar-yesno: are two triangles / rectangles similar?
 *   - find-x: the figures are similar, find the missing side
 *     (rectangles, right triangles, parallelograms, L-shapes)
 *   - word-find: desk / photo / pool style "similar and N long, how wide?"
 *   - word-yesno: is a drawing of a flag or poster similar to the real one?
 *   - scale: maps, floor plans and toy models
 * Every problem is generated fresh; nothing is a fixed answer key.
 */

export const YES = 'YES, similar';
export const NO = 'NO, not similar';

const KIND_WEIGHTS = [
    ['similar-yesno', 25],
    ['find-x', 45],
    ['word-find', 15],
    ['word-yesno', 5],
    ['scale', 10]
];

// Scale factors as fractions. Mix of clean decimals (1.5, 2.5, 1.8, 1.2),
// whole numbers and repeating ones (7/3, 4/3, 5/3).
const SCALES = [
    [3, 2], [2, 1], [5, 2], [3, 1], [9, 5], [6, 5], [7, 3], [4, 3],
    [9, 4], [5, 3], [7, 2], [8, 5], [7, 5], [4, 1]
];

const SHAPE_NAMES = {
    rect: 'rectangles',
    rightTri: 'right triangles',
    para: 'parallelograms',
    L: 'L-shapes'
};

function gcd(a, b) {
    a = Math.abs(a);
    b = Math.abs(b);
    while (b) {
        const t = a % b;
        a = b;
        b = t;
    }
    return a || 1;
}

function frac(n, d) {
    const g = gcd(n, d);
    return { n: n / g, d: d / g };
}

// What a reduced denominator does to the decimal answer.
function denominatorKind(d) {
    if (d === 1) return 'int';
    if (10 % d === 0) return 'dec1';
    if (100 % d === 0) return 'dec2';
    if (d === 3 || d === 6 || d === 9) return 'repeat';
    return null;
}

function num(v) {
    return formatNumber(v);
}

function answerText(x) {
    const v = x.n / x.d;
    return denominatorKind(x.d) === 'repeat' ? num(v) + ' (= ' + x.n + '/' + x.d + ')' : num(v);
}

/**
 * Pick numbers for "two similar figures, one side missing".
 * Pair A (p on the small figure, q on the big one) is known on both.
 * Pair B has one known side m; x is the other.
 */
const DEFAULT_LIMITS = { pMin: 2, pMax: 14, qMax: 40, aspectMin: 0.4, aspectMax: 2.5 };

export function makeScenario(want, limits) {
    const lim = Object.assign({}, DEFAULT_LIMITS, limits || {});
    for (let t = 0; t < 2000; t++) {
        const s = pick(SCALES);
        const kn = s[0];
        const kd = s[1];
        const p = randInt(lim.pMin, lim.pMax);
        if ((p * kn) % kd !== 0) continue;
        const q = p * kn / kd;
        if (q > lim.qMax) continue;
        const onBig = chance(0.6);
        // m is the known side of pair B: on the small figure when x is on the big one.
        const base = onBig ? p : q;
        const lo = Math.max(2, Math.ceil(base * lim.aspectMin));
        const hi = Math.floor(base * lim.aspectMax);
        if (hi < lo) continue;
        const m = randInt(lo, hi);
        const x = onBig ? frac(m * kn, kd) : frac(m * kd, kn);
        const kind = denominatorKind(x.d);
        if (!kind || kind === 'dec2') continue;
        if (want && t < 1500 && kind !== want) continue;
        const xv = x.n / x.d;
        if (xv < 1.5 || xv > 80) continue;
        const aspect = (onBig ? m : xv) / p;
        if (aspect < lim.aspectMin || aspect > lim.aspectMax || (aspect > 0.83 && aspect < 1.2)) continue;
        return { p, q, m, x, xv, onBig, kn, kd, kind };
    }
    return { p: 8, q: 20, m: 6, x: frac(15, 1), xv: 15, onBig: true, kn: 5, kd: 2, kind: 'int', fallback: true };
}

// "2.5." but "2.333… " (no second full stop after an ellipsis).
function stop(text) {
    return /\u2026$/.test(text) ? text : text + '.';
}

function scaleWorking(sc) {
    const k = sc.kn / sc.kd;
    const kStr = formatApprox(k);
    const ans = answerText(sc.x);
    const exactK = sc.kd === 1 || 10 % sc.kd === 0;
    let hint;
    let explain;
    if (sc.onBig) {
        hint = 'Scale factor = ' + sc.q + ' \u00F7 ' + sc.p + ' = ' + stop(kStr) + (exactK
            ? ' Multiply the other small side by it.'
            : ' Tip: \u00D7 ' + sc.q + ' then \u00F7 ' + sc.p + ' keeps it exact.');
        explain = exactK
            ? sc.q + ' \u00F7 ' + sc.p + ' = ' + kStr + ', so x = ' + sc.m + ' \u00D7 ' + kStr + ' = ' + ans
            : 'x = ' + sc.m + ' \u00D7 ' + sc.q + ' \u00F7 ' + sc.p + ' = ' + ans;
    } else {
        hint = 'Scale factor = ' + sc.q + ' \u00F7 ' + sc.p + ' = ' + stop(kStr) + (exactK
            ? ' Small side = big side \u00F7 ' + kStr + '.'
            : ' Small side = big side \u00D7 ' + sc.p + ' \u00F7 ' + sc.q + '.');
        explain = exactK
            ? sc.q + ' \u00F7 ' + sc.p + ' = ' + kStr + ', so x = ' + sc.m + ' \u00F7 ' + kStr + ' = ' + ans
            : 'x = ' + sc.m + ' \u00D7 ' + sc.p + ' \u00F7 ' + sc.q + ' = ' + ans;
    }
    return { hint, explain };
}

function numberProblem(fields) {
    return Object.assign({
        grade: 7,
        input: 'number',
        allowFraction: true,
        unit: ''
    }, fields);
}

function genFindX(shape) {
    shape = SHAPE_NAMES[shape] ? shape : pick(Object.keys(SHAPE_NAMES));
    const want = weightedPick([['int', 40], ['dec1', 35], ['repeat', 25]]);
    const sc = makeScenario(want);
    const dimA = chance(0.5) ? 'w' : 'h';
    const dimB = dimA === 'w' ? 'h' : 'w';
    const small = { kind: shape, labels: {} };
    const big = { kind: shape, labels: {} };
    small[dimA] = sc.p;
    big[dimA] = sc.q;
    small[dimB] = sc.onBig ? sc.m : sc.xv;
    big[dimB] = sc.onBig ? sc.xv : sc.m;
    small.labels[dimA] = String(sc.p);
    big.labels[dimA] = String(sc.q);
    small.labels[dimB] = sc.onBig ? String(sc.m) : 'x';
    big.labels[dimB] = sc.onBig ? 'x' : String(sc.m);
    const work = scaleWorking(sc);
    return numberProblem({
        kind: 'find-x',
        shape,
        question: 'These ' + SHAPE_NAMES[shape] + ' are similar. Find x.',
        answerValue: sc.xv,
        answerText: 'x = ' + answerText(sc.x),
        hint: work.hint,
        explain: work.explain,
        diagram: { shapes: chance(0.75) ? [small, big] : [big, small] }
    });
}

// Size ranges keep the stories believable ("long" is always the longer side).
export const WORD_PAIRS = [
    { small: "student's desk", big: "teacher's desk", a: 'long', b: 'wide', unit: 'in',
        limits: { pMin: 18, pMax: 36, qMax: 72, aspectMin: 0.45, aspectMax: 0.8 } },
    { small: 'small photo', big: 'poster-size photo', a: 'wide', b: 'tall', unit: 'in',
        limits: { pMin: 3, pMax: 10, qMax: 40, aspectMin: 0.5, aspectMax: 2 } },
    { small: 'kiddie pool', big: 'big pool', a: 'long', b: 'wide', unit: 'ft',
        limits: { pMin: 4, pMax: 10, qMax: 40, aspectMin: 0.4, aspectMax: 0.8 } },
    { small: 'little kite', big: 'giant kite', a: 'wide', b: 'tall', unit: 'in',
        limits: { pMin: 10, pMax: 24, qMax: 60, aspectMin: 1.2, aspectMax: 2 } },
    { small: 'garden bed', big: 'school garden', a: 'long', b: 'wide', unit: 'ft',
        limits: { pMin: 3, pMax: 10, qMax: 30, aspectMin: 0.4, aspectMax: 0.8 } },
    { small: 'phone screen', big: 'tablet screen', a: 'tall', b: 'wide', unit: 'cm',
        limits: { pMin: 10, pMax: 16, qMax: 30, aspectMin: 0.45, aspectMax: 0.8 } }
];

function genWordFind() {
    const w = pick(WORD_PAIRS);
    const sc = makeScenario(weightedPick([['int', 50], ['dec1', 35], ['repeat', 15]]), w.limits);
    const u = ' ' + w.unit + ' ';
    let question;
    if (sc.onBig) {
        question = 'The ' + w.small + ' is ' + sc.p + u + w.a + ' and ' + sc.m + u + w.b + '. The ' + w.big +
            ' is similar and ' + sc.q + u + w.a + '. How ' + w.b + ' is the ' + w.big + '?';
    } else {
        question = 'The ' + w.big + ' is ' + sc.q + u + w.a + ' and ' + sc.m + u + w.b + '. The ' + w.small +
            ' is similar and ' + sc.p + u + w.a + '. How ' + w.b + ' is the ' + w.small + '?';
    }
    // Draw "long"/"wide" along the bottom, "tall" up the side.
    const aIsWidth = w.a !== 'tall';
    const small = { kind: 'rect', labels: {} };
    const big = { kind: 'rect', labels: {} };
    const A = aIsWidth ? 'w' : 'h';
    const B = aIsWidth ? 'h' : 'w';
    small[A] = sc.p;
    big[A] = sc.q;
    small[B] = sc.onBig ? sc.m : sc.xv;
    big[B] = sc.onBig ? sc.xv : sc.m;
    small.labels[A] = sc.p + ' ' + w.unit;
    big.labels[A] = sc.q + ' ' + w.unit;
    small.labels[B] = sc.onBig ? sc.m + ' ' + w.unit : 'x';
    big.labels[B] = sc.onBig ? 'x' : sc.m + ' ' + w.unit;
    const work = scaleWorking(sc);
    return numberProblem({
        kind: 'word-find',
        question,
        unit: w.unit,
        answerValue: sc.xv,
        answerText: answerText(sc.x) + ' ' + w.unit,
        hint: work.hint,
        explain: work.explain + ' ' + w.unit,
        diagram: { shapes: [small, big] }
    });
}

// Longest side first (drawn as the base). None are too flat to read.
const TRIANGLES = [
    [5, 4, 3], [6, 5, 4], [7, 6, 5], [8, 7, 6], [6, 5, 5], [8, 6, 6],
    [10, 8, 6], [9, 8, 7], [6, 4, 4], [8, 5, 5], [4, 4, 3], [6, 6, 5]
];

function ratioLine(pairs) {
    return pairs.map((pr) => pr[1] + ' \u00F7 ' + pr[0]).join(', ');
}

function ratioWorking(pairs) {
    return pairs.map((pr) => pr[1] + ' \u00F7 ' + pr[0] + ' = ' + formatApprox(pr[1] / pr[0])).join(', ');
}

function yesNoProblem(fields) {
    return Object.assign({
        grade: 7,
        input: 'choice',
        choices: [YES, NO]
    }, fields);
}

function genSimilarYesNo(shape) {
    shape = shape === 'tri' || shape === 'rect' ? shape : (chance(0.5) ? 'tri' : 'rect');
    const similar = chance(0.5);
    for (let t = 0; t < 400; t++) {
        const s = pick([[3, 2], [2, 1], [5, 2], [3, 1]]);
        const k = s[0] / s[1];
        if (shape === 'tri') {
            const base = pick(TRIANGLES);
            const small = [base[0], base[1], base[2]];
            if (small.some((v) => (v * s[0]) % s[1] !== 0)) continue;
            const big = small.map((v) => v * k);
            if (big[0] > 36) continue;
            if (!similar) {
                const i = randInt(0, 2);
                big[i] += pick([-2, -1, 1, 2]);
                const sorted = big.slice().sort((a, b) => b - a);
                if (sorted[0] >= sorted[1] + sorted[2] || big[i] <= small[i]) continue;
                if (Math.abs(big[i] / small[i] - k) < 0.15) continue;
            }
            const pairs = small.map((v, i) => [v, big[i]]);
            const same = pairs.every((pr) => Math.abs(pr[1] / pr[0] - k) < 1e-9);
            const mk = (sides) => ({
                kind: 'tri', a: sides[0], b: sides[1], c: sides[2],
                labels: { a: String(sides[0]), b: String(sides[1]), c: String(sides[2]) }
            });
            return yesNoProblem({
                kind: 'similar-yesno',
                shape,
                question: 'Are these two triangles similar?',
                answer: same ? YES : NO,
                answerText: same ? YES : NO,
                hint: 'Compare matching sides, big \u00F7 small: ' + ratioLine(pairs) + '. Same number every time?',
                explain: stop(ratioWorking(pairs)) + (same ? ' All the same, so YES.' : ' Not all the same, so NO.'),
                diagram: { shapes: [mk(small), mk(big)] }
            });
        }
        const sw = randInt(2, 12);
        const sh = randInt(2, 12);
        const aspect = sw / sh;
        if (aspect < 0.45 || aspect > 2.2 || (aspect > 0.83 && aspect < 1.2)) continue;
        if ((sw * s[0]) % s[1] !== 0 || (sh * s[0]) % s[1] !== 0) continue;
        const bw = sw * k;
        let bh = sh * k;
        if (Math.max(bw, bh) > 36) continue;
        if (!similar) {
            bh += pick([-3, -2, -1, 1, 2, 3]);
            if (bh < 2 || Math.abs(bh / sh - k) < 0.15 || Math.abs(bh - bw) < 1) continue;
        }
        // Sometimes stand the big one on its short side, like the worksheet.
        const turn = chance(0.35);
        const small = { kind: 'rect', w: sw, h: sh, labels: { w: String(sw), h: String(sh) } };
        const big = turn
            ? { kind: 'rect', w: bh, h: bw, labels: { w: String(bh), h: String(bw) } }
            : { kind: 'rect', w: bw, h: bh, labels: { w: String(bw), h: String(bh) } };
        const smallLong = Math.max(sw, sh);
        const smallShort = Math.min(sw, sh);
        const bigLong = Math.max(bw, bh);
        const bigShort = Math.min(bw, bh);
        const pairs = [[smallLong, bigLong], [smallShort, bigShort]];
        const sameRatio = Math.abs(bigLong / smallLong - bigShort / smallShort) < 1e-9;
        return yesNoProblem({
            kind: 'similar-yesno',
            shape,
            question: 'Are these two rectangles similar?',
            answer: sameRatio ? YES : NO,
            answerText: sameRatio ? YES : NO,
            hint: 'Compare long \u00F7 long and short \u00F7 short: ' + ratioLine(pairs) + '. Same number?',
            explain: stop(ratioWorking(pairs)) + (sameRatio ? ' Same, so YES.' : ' Different, so NO.'),
            diagram: { shapes: [small, big] }
        });
    }
    return genSimilarYesNo(shape === 'tri' ? 'rect' : 'tri');
}

const WORD_YESNO = [
    { real: 'class flag', copy: 'drawing of it', a: 'long', b: 'wide', unit: 'in', art: 'flag' },
    { real: 'team banner', copy: 'sticker of it', a: 'long', b: 'tall', unit: 'in', art: 'flag' },
    { real: 'painting', copy: 'postcard of it', a: 'wide', b: 'tall', unit: 'cm', art: 'rect' },
    { real: 'movie poster', copy: 'mini copy', a: 'wide', b: 'tall', unit: 'in', art: 'rect' }
];

function genWordYesNo() {
    const w = pick(WORD_YESNO);
    const similar = chance(0.5);
    for (let t = 0; t < 400; t++) {
        const l = randInt(6, 12);
        const wHalves = randInt(6, 2 * l - 3);
        const cw = wHalves / 2;
        const k = randInt(3, 7);
        const L = k * l;
        let Wd = k * cw;
        if (Wd !== Math.floor(Wd)) continue;
        if (!similar) {
            Wd += pick([-4, -3, -2, 2, 3, 4]);
            if (Wd <= cw || Wd >= L || Math.abs(Wd / cw - k) < 0.2) continue;
        }
        const same = Math.abs(Wd / cw - k) < 1e-9;
        const u = ' ' + w.unit;
        const question = 'A ' + w.real + ' is ' + L + u + ' ' + w.a + ' and ' + Wd + u + ' ' + w.b + '. A ' + w.copy +
            ' is ' + l + u + ' ' + w.a + ' and ' + num(cw) + u + ' ' + w.b + '. Is it similar to the ' + w.real + '?';
        const pairs = [[l, L], [cw, Wd]];
        const mk = (a, b) => ({ kind: w.art, w: a, h: b, labels: { w: num(a) + u, h: num(b) + u } });
        return yesNoProblem({
            kind: 'word-yesno',
            question,
            answer: same ? YES : NO,
            answerText: same ? YES : NO,
            hint: 'Divide real \u00F7 copy for both sides: ' + L + ' \u00F7 ' + l + ' and ' + Wd + ' \u00F7 ' + num(cw) + '. Same answer?',
            explain: stop(ratioWorking(pairs)) + (same ? ' Same, so YES.' : ' Different, so NO.'),
            diagram: { shapes: [mk(L, Wd), mk(l, cw)] }
        });
    }
    return genWordYesNo();
}

function genScale() {
    const type = pick(['map', 'plan', 'toy']);
    if (type === 'map') {
        const s = pick([2, 3, 4, 5, 10, 20, 25]);
        const d = randInt(2, 12) + (chance(0.5) ? 0.5 : 0);
        const ans = s * d;
        return numberProblem({
            kind: 'scale',
            allowFraction: false,
            unit: 'km',
            question: 'On a map, 1 cm stands for ' + s + ' km. Two towns are ' + num(d) + ' cm apart on the map. How many km apart are they really?',
            answerValue: ans,
            answerText: num(ans) + ' km',
            hint: 'Every 1 cm on the map is ' + s + ' km, so multiply the map distance by ' + s + '.',
            explain: num(d) + ' \u00D7 ' + s + ' = ' + num(ans) + ' km',
            diagram: { bars: [
                { name: 'Map', value: num(d) + ' cm', len: 1 },
                { name: 'Real', value: 'x km', len: 3 }
            ] }
        });
    }
    if (type === 'plan') {
        const s = pick([2, 4, 6, 8, 10]);
        const d = randInt(2, 10) + (chance(0.5) ? 0.5 : 0);
        const r = s * d;
        return numberProblem({
            kind: 'scale',
            allowFraction: false,
            unit: 'in',
            question: 'On a floor plan, 1 in stands for ' + s + ' ft. A real room is ' + r + ' ft long. How long is it on the plan, in inches?',
            answerValue: d,
            answerText: num(d) + ' in',
            hint: 'Each inch on the plan is ' + s + ' ft. How many ' + s + 's fit in ' + r + '? Divide by ' + s + '.',
            explain: r + ' \u00F7 ' + s + ' = ' + num(d) + ' in',
            diagram: { bars: [
                { name: 'Plan', value: 'x in', len: 1 },
                { name: 'Real room', value: r + ' ft', len: 3 }
            ] }
        });
    }
    const f = pick([12, 16, 18, 20, 24, 32]);
    const d = randInt(Math.ceil(240 / f), Math.floor(400 / f)) / 2;
    const r = f * d;
    return numberProblem({
        kind: 'scale',
        allowFraction: true,
        unit: 'in',
        question: 'A toy car is built at a scale of 1 to ' + f + '. The real car is ' + r + ' in long. How long is the toy car?',
        answerValue: d,
        answerText: num(d) + ' in',
        hint: '"1 to ' + f + '" means the real car is ' + f + ' times as long. Divide ' + r + ' by ' + f + '.',
        explain: r + ' \u00F7 ' + f + ' = ' + num(d) + ' in',
        diagram: { bars: [
            { name: 'Toy', value: 'x in', len: 1 },
            { name: 'Real car', value: r + ' in', len: 3 }
        ] }
    });
}

/**
 * kind: optional 'similar-yesno' | 'find-x' | 'word-find' | 'word-yesno' | 'scale'.
 * A shape can follow a colon, e.g. 'find-x:L' or 'similar-yesno:tri'.
 */
export function getSimilarFiguresProblem(kind) {
    const parts = String(kind || '').split(':');
    const k = parts[0] || weightedPick(KIND_WEIGHTS);
    switch (k) {
        case 'similar-yesno': return genSimilarYesNo(parts[1]);
        case 'word-find': return genWordFind();
        case 'word-yesno': return genWordYesNo();
        case 'scale': return genScale();
        case 'find-x':
        default:
            return genFindX(parts[1]);
    }
}

export const similarFiguresPack = {
    id: 'similar-figures',
    name: 'Similar Figures',
    generateProblem: getSimilarFiguresProblem
};
