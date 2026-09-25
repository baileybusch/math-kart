import { between, pick, chance, shuffle, weighted } from './random.js';
import { isNeat, formatNumber, makeTyped } from './answers.js';

/**
 * Grade 7 - Similar Figures, ratios and proportions.
 *
 * Modeled on a "Similar Figures" homework sheet: tell whether two figures are
 * similar, find a missing side x (rectangles, right triangles,
 * parallelograms, L-shapes), and short flag/desk style word problems. Every
 * problem is generated fresh; nothing is copied from a filled-in worksheet.
 */

export const YES = 'Yes, similar';
export const NO = 'No, not similar';

// Scale factors (big / small) as [numerator, denominator] with weights.
// Halves, fifths and quarters give clean decimals (2.5, 1.8, 1.25); thirds
// give either whole numbers or a repeating decimal.
const RATIOS = [
    [8, [3, 2]], [8, [2, 1]], [8, [5, 2]], [6, [3, 1]], [5, [9, 5]],
    [4, [5, 4]], [3, [4, 1]], [4, [7, 2]], [4, [7, 3]], [4, [5, 3]], [2, [4, 3]]
];
const REPEATING_SHARE = 0.15;
const FIND_X_TYPED_SHARE = 0.8;
const WORD_TYPED_SHARE = 0.75;

const SHAPE_WORDS = {
    rect: 'rectangles',
    rtri: 'right triangles',
    para: 'parallelograms',
    L: 'shapes',
    tri: 'triangles'
};

function ratioText(big, small) {
    const v = big / small;
    if (isNeat(v)) return formatNumber(v);
    return (Math.floor(v * 1000) / 1000).toFixed(3) + '\u2026';
}

function withUnit(n, unit) {
    return unit ? n + ' ' + unit : String(n);
}

/**
 * Numbers for "the figures are similar, find x". Pair A is known on both
 * figures; pair B is known on one figure and x on the other.
 */
function findXNumbers(opts) {
    const o = opts || {};
    const wantRepeat = !o.neatOnly && chance(REPEATING_SHARE);
    let best = null;
    for (let tries = 0; tries < 200; tries++) {
        const pq = weighted(RATIOS);
        const p = pq[0];
        const q = pq[1];
        if (o.neatRatio && !isNeat(p / q)) continue;
        const aSmall = q * between(Math.ceil(2 / q), Math.floor((o.maxSmall || 12) / q));
        const aBig = aSmall * p / q;
        const unknownOnBig = o.unknownOnBig !== undefined ? o.unknownOnBig : chance(0.6);
        let bSmall;
        let bBig;
        let x;
        if (unknownOnBig) {
            bSmall = between(o.bMin || 2, o.bMax || o.maxSmall || 12);
            bBig = bSmall * p / q;
            x = bBig;
        } else {
            bBig = between(3, 36);
            bSmall = bBig * q / p;
            x = bSmall;
        }
        if (aSmall < 2 || aBig > 45 || bBig > 45 || x < 1.5) continue;
        if (o.aLonger && !(aSmall > bSmall)) continue;
        if (o.minBig && aBig < o.minBig) continue;
        if (bSmall === aSmall) continue;
        const shape = bSmall / aSmall;
        if (shape < 0.35 || shape > 2.9) continue;
        const neat = isNeat(x);
        const thirds = !neat && isNeat(x * 3);
        if (!neat && !thirds) continue;
        const candidate = { p, q, aSmall, aBig, bSmall, bBig, unknownOnBig, x, repeating: !neat };
        if (candidate.repeating === wantRepeat) return candidate;
        if (!best && neat) best = candidate;
    }
    return best || { p: 5, q: 2, aSmall: 8, aBig: 20, bSmall: 6, bBig: 15, unknownOnBig: true, x: 15, repeating: false };
}

function findXHint(n, unit) {
    const k = n.p / n.q;
    const kNeat = isNeat(k);
    let text = 'Scale factor = ' + n.aBig + ' \u00F7 ' + n.aSmall + ' = ' + ratioText(n.aBig, n.aSmall) + ' (big \u00F7 small). ';
    if (n.unknownOnBig) {
        text += kNeat
            ? 'Now multiply ' + withUnit(n.bSmall, unit) + ' by ' + formatNumber(k) + '.'
            : 'Tip: do ' + n.bSmall + ' \u00D7 ' + n.aBig + ' \u00F7 ' + n.aSmall + '.';
    } else {
        text += kNeat
            ? 'Going big to small, divide ' + withUnit(formatNumber(n.bBig), unit) + ' by ' + formatNumber(k) + '.'
            : 'Tip: do ' + formatNumber(n.bBig) + ' \u00D7 ' + n.aSmall + ' \u00F7 ' + n.aBig + '.';
    }
    return text;
}

function findXExplain(n, unit) {
    const k = n.p / n.q;
    const ans = formatNumber(n.x) + (n.repeating ? ' (' + ratioText(n.x, 1) + ')' : '');
    let work;
    if (n.unknownOnBig) {
        work = isNeat(k) ? n.bSmall + ' \u00D7 ' + formatNumber(k) : n.bSmall + ' \u00D7 ' + n.aBig + ' \u00F7 ' + n.aSmall;
    } else {
        work = isNeat(k) ? formatNumber(n.bBig) + ' \u00F7 ' + formatNumber(k) : formatNumber(n.bBig) + ' \u00D7 ' + n.aSmall + ' \u00F7 ' + n.aBig;
    }
    return work + ' = ' + ans + (unit ? ' ' + unit : '') + ', so x = ' + formatNumber(n.x);
}

// Kid mistakes make the best wrong answers: adding the difference instead of
// multiplying, or using the scale factor upside down.
function findXChoices(n) {
    const out = [formatNumber(n.x)];
    const diff = n.aBig - n.aSmall;
    const candidates = n.unknownOnBig
        ? [n.bSmall + diff, n.bSmall * n.q / n.p, n.x + n.q, n.x - 1]
        : [n.bBig - diff, n.bBig * n.p / n.q, n.x + 2, n.x + 1];
    candidates.forEach((c) => {
        if (out.length >= 3 || !(c > 0)) return;
        const s = formatNumber(c);
        if (out.indexOf(s) === -1) out.push(s);
    });
    let bump = 3;
    while (out.length < 3) {
        const s = formatNumber(n.x + bump++);
        if (out.indexOf(s) === -1) out.push(s);
    }
    return shuffle(out);
}

function finishNumeric(problem, value, typedShare) {
    if (chance(typedShare)) return makeTyped(problem, value);
    return problem;
}

function labelPair(n, kind, aKey, bKey, unit) {
    const small = { kind, dims: {}, labels: {} };
    const big = { kind, dims: {}, labels: {} };
    small.dims[aKey] = n.aSmall;
    small.dims[bKey] = n.bSmall;
    big.dims[aKey] = n.aBig;
    big.dims[bKey] = n.bBig;
    small.labels[aKey] = withUnit(n.aSmall, unit);
    big.labels[aKey] = withUnit(n.aBig, unit);
    small.labels[bKey] = n.unknownOnBig ? withUnit(n.bSmall, unit) : 'x';
    big.labels[bKey] = n.unknownOnBig ? 'x' : withUnit(formatNumber(n.bBig), unit);
    return { small, big };
}

function orderPair(pair, names) {
    const bigFirst = chance(0.25);
    const shapes = bigFirst ? [pair.big, pair.small] : [pair.small, pair.big];
    const captions = names ? (bigFirst ? [names[1], names[0]] : names) : null;
    return { shapes, captions };
}

// ---------------------------------------------------------------- find x

const SHAPE_KEYS = {
    rect: ['w', 'h'],
    rtri: ['w', 'h'],
    para: ['w', 's'],
    L: ['w', 'h']
};

function findX() {
    const kind = pick(['rect', 'rtri', 'para', 'L']);
    const n = findXNumbers();
    const keys = SHAPE_KEYS[kind];
    const swap = chance(0.5);
    let aKey = swap ? keys[1] : keys[0];
    let bKey = swap ? keys[0] : keys[1];
    // Parallelograms read best with the long side as the base.
    if (kind === 'para' && (aKey === 'w' ? n.aSmall < n.bSmall : n.aSmall > n.bSmall)) {
        const t = aKey; aKey = bKey; bKey = t;
    }
    const pair = labelPair(n, kind, aKey, bKey);
    const problem = {
        kind: 'find-x',
        question: 'These ' + SHAPE_WORDS[kind] + ' are similar. Find x.',
        answer: formatNumber(n.x),
        mode: 'choice',
        choices: findXChoices(n),
        hint: findXHint(n),
        explain: findXExplain(n),
        diagram: orderPair(pair)
    };
    return finishNumeric(problem, n.x, FIND_X_TYPED_SHARE);
}

// ------------------------------------------------------- similar or not?

const TRIANGLES = [[3, 4, 5], [4, 6, 8], [4, 5, 6], [5, 6, 8], [4, 7, 9], [5, 7, 8], [6, 7, 9], [3, 5, 7], [2, 3, 4], [6, 8, 9]];
const SCALES = [1.5, 2, 2.5, 3];

function validTriangle(s) {
    return s[0] + s[1] > s[2] + 0.5 && s[0] + s[2] > s[1] + 0.5 && s[1] + s[2] > s[0] + 0.5;
}

function allWhole(list) {
    return list.every((v) => Math.abs(v - Math.round(v)) < 1e-9);
}

function similarCheck() {
    const similar = chance(0.5);
    const useTriangle = chance(0.5);
    let small = null;
    let big = null;
    for (let tries = 0; tries < 300; tries++) {
        const k = pick(SCALES);
        const s = useTriangle ? pick(TRIANGLES).slice() : [between(3, 10), between(3, 10)];
        if (!useTriangle && s[0] === s[1]) continue;
        const b = s.map((v) => v * k);
        if (!similar) {
            const i = between(0, b.length - 1);
            b[i] = s[i] * pick(SCALES.filter((f) => f !== k));
        }
        if (!allWhole(b) || Math.max.apply(null, b) > 30) continue;
        if (useTriangle && !validTriangle(b)) continue;
        small = s;
        big = b;
        break;
    }
    if (!small) {
        small = useTriangle ? [4, 6, 8] : [8, 6];
        big = similar ? small.map((v) => v * 1.5) : (useTriangle ? [8, 12, 12] : [12, 15]);
    }

    const ratios = small.map((s, i) => big[i] + ' \u00F7 ' + s + ' = ' + ratioText(big[i], s));
    const kind = useTriangle ? 'tri' : 'rect';
    const keys = useTriangle ? ['a', 'b', 'c'] : ['w', 'h'];
    const makeShape = (vals) => {
        const shape = { kind, dims: {}, labels: {} };
        keys.forEach((key, i) => {
            shape.dims[key] = vals[i];
            shape.labels[key] = String(vals[i]);
        });
        return shape;
    };
    const first = pick([0, 1, 2].slice(0, keys.length));
    const hint = 'Compare matching sides, big \u00F7 small. ' + ratios[first] +
        '. Do the other matching sides give the same number?';
    const explain = ratios.join(', ') +
        (similar ? '. All the same, so they ARE similar.' : '. Not all the same, so they are NOT similar.');

    return {
        kind: 'similar-check',
        question: 'Are these two ' + SHAPE_WORDS[kind] + ' similar?',
        answer: similar ? YES : NO,
        mode: 'choice',
        choices: [YES, NO],
        hint,
        explain,
        diagram: orderPair({ small: makeShape(small), big: makeShape(big) })
    };
}

// ---------------------------------------------------------- word problems

const SIMILAR_STORIES = [
    { big: 'A flag', small: "Sam's drawing of the flag", names: ['Drawing', 'Flag'], unit: 'in' },
    { big: 'A poster', small: 'A postcard of the poster', names: ['Postcard', 'Poster'], unit: 'cm' },
    { big: 'A rug', small: 'A doll-house rug', names: ['Doll rug', 'Rug'], unit: 'in' }
];
const DRAWINGS = [[10, 6], [8, 5], [12, 8], [11, 7], [9, 6], [10, 4], [12, 9], [8, 6]];

function wordSimilar() {
    const story = pick(SIMILAR_STORIES);
    const d = pick(DRAWINGS);
    const k = between(3, 6);
    const similar = chance(0.5);
    const bigL = d[0] * k;
    let bigW = d[1] * k;
    if (!similar) {
        const nudge = pick([-5, -4, -3, 3, 4, 5]);
        bigW = Math.max(d[1] + 1, bigW + nudge);
        if (bigW === d[1] * k) bigW += 2;
    }
    const u = story.unit;
    const question = story.big + ' is ' + bigL + ' ' + u + ' long and ' + bigW + ' ' + u + ' wide. ' +
        story.small + ' is ' + d[0] + ' ' + u + ' long and ' + d[1] + ' ' + u + ' wide. Are they similar?';
    const longR = bigL + ' \u00F7 ' + d[0] + ' = ' + ratioText(bigL, d[0]);
    const wideR = bigW + ' \u00F7 ' + d[1] + ' = ' + ratioText(bigW, d[1]);
    const small = { kind: 'rect', dims: { w: d[0], h: d[1] }, labels: { w: withUnit(d[0], u), h: withUnit(d[1], u) } };
    const big = { kind: 'rect', dims: { w: bigL, h: bigW }, labels: { w: withUnit(bigL, u), h: withUnit(bigW, u) } };
    return {
        kind: 'word-similar',
        question,
        answer: similar ? YES : NO,
        mode: 'choice',
        choices: [YES, NO],
        hint: 'Compare long \u00F7 long: ' + longR + '. Now check wide \u00F7 wide. Same number?',
        explain: longR + ' and ' + wideR + (similar ? '. Same, so yes, similar.' : '. Different, so not similar.'),
        diagram: { shapes: [small, big], captions: story.names }
    };
}

const FIND_STORIES = [
    {
        names: ["Student's desk", "Teacher's desk"], unit: 'in', kind: 'rect', aKey: 'w', bKey: 'h', aLonger: true, minBig: 20,
        text: (n, u) => n.unknownOnBig
            ? "A student's desk is " + n.aSmall + ' ' + u + ' long and ' + n.bSmall + ' ' + u + " wide. The teacher's desk is similar and " + n.aBig + ' ' + u + " long. How wide is the teacher's desk?"
            : "A teacher's desk is " + n.aBig + ' ' + u + ' long and ' + formatNumber(n.bBig) + ' ' + u + " wide. A student's desk is similar and " + n.aSmall + ' ' + u + " long. How wide is the student's desk?"
    },
    {
        names: (n) => (n.unknownOnBig ? ['Photo', 'Enlarged'] : ['Copy', 'Poster']), unit: 'in', kind: 'rect', aKey: 'w', bKey: 'h',
        text: (n, u) => n.unknownOnBig
            ? 'A photo is ' + n.aSmall + ' ' + u + ' wide and ' + n.bSmall + ' ' + u + ' tall. It is enlarged (similar) to ' + n.aBig + ' ' + u + ' wide. How tall is the new photo?'
            : 'A poster is ' + n.aBig + ' ' + u + ' wide and ' + formatNumber(n.bBig) + ' ' + u + ' tall. A small similar copy is ' + n.aSmall + ' ' + u + ' wide. How tall is the copy?'
    },
    {
        names: ['You', 'Tree'], unit: 'ft', kind: 'rtri', aKey: 'w', bKey: 'h', onBig: true, maxSmall: 8, bMin: 4, bMax: 6,
        text: (n, u) => 'You are ' + n.bSmall + ' ' + u + ' tall and your shadow is ' + n.aSmall + ' ' + u + ' long. At the same time a tree\u2019s shadow is ' + n.aBig + ' ' + u + ' long. How tall is the tree?'
    }
];

function wordFind() {
    const story = pick(FIND_STORIES);
    const n = findXNumbers({
        unknownOnBig: story.onBig, maxSmall: story.maxSmall, bMin: story.bMin, bMax: story.bMax,
        aLonger: story.aLonger, minBig: story.minBig
    });
    const u = story.unit;
    const pair = labelPair(n, story.kind, story.aKey, story.bKey, u);
    const names = typeof story.names === 'function' ? story.names(n) : story.names;
    const problem = {
        kind: 'word-find',
        question: story.text(n, u),
        answer: formatNumber(n.x),
        unit: u,
        mode: 'choice',
        choices: findXChoices(n),
        hint: findXHint(n, u),
        explain: findXExplain(n, u),
        diagram: { shapes: [pair.small, pair.big], captions: names }
    };
    return finishNumeric(problem, n.x, WORD_TYPED_SHARE);
}

function scaleFactor() {
    const n = findXNumbers({ neatOnly: true, neatRatio: true, unknownOnBig: true });
    const k = n.p / n.q;
    const small = { kind: 'rect', dims: { w: n.aSmall, h: n.bSmall }, labels: { w: String(n.aSmall), h: String(n.bSmall) } };
    const big = { kind: 'rect', dims: { w: n.aBig, h: n.bBig }, labels: { w: String(n.aBig), h: formatNumber(n.bBig) } };
    const problem = {
        kind: 'scale-factor',
        question: 'Rectangle A is ' + n.aSmall + ' by ' + n.bSmall + '. Rectangle B is similar: ' + n.aBig + ' by ' + formatNumber(n.bBig) + '. What is the scale factor from A to B?',
        answer: formatNumber(k),
        mode: 'choice',
        hint: 'Scale factor = a side of B \u00F7 the matching side of A. Try the long sides.',
        explain: n.aBig + ' \u00F7 ' + n.aSmall + ' = ' + formatNumber(k) + ' (and ' + formatNumber(n.bBig) + ' \u00F7 ' + n.bSmall + ' = ' + formatNumber(k) + ')',
        diagram: { shapes: [small, big], captions: ['A', 'B'] }
    };
    return makeTyped(problem, k);
}

function proportion() {
    for (;;) {
        const b = between(2, 9);
        const a = between(1, b + 3);
        if (a === b) continue;
        const d = b * between(2, 6) + (chance(0.3) ? between(1, b - 1) : 0);
        const x = a * d / b;
        if (!isNeat(x) || d > 60) continue;
        const problem = {
            kind: 'proportion',
            question: 'Solve for x:   ' + a + '/' + b + ' = x/' + d,
            answer: formatNumber(x),
            mode: 'choice',
            hint: 'Cross-multiply: ' + b + ' \u00D7 x = ' + a + ' \u00D7 ' + d + '. Then divide both sides by ' + b + '.',
            explain: a + ' \u00D7 ' + d + ' \u00F7 ' + b + ' = ' + formatNumber(x) + ', so x = ' + formatNumber(x)
        };
        return makeTyped(problem, x);
    }
}

const similarFiguresPack = {
    id: 'similar-figures',
    name: 'Similar Figures & Proportions',
    grade: 7,
    difficulty: 4,

    generateProblem() {
        const make = weighted([
            [25, similarCheck],
            [40, findX],
            [8, wordSimilar],
            [17, wordFind],
            [5, scaleFactor],
            [5, proportion]
        ]);
        return make();
    },

    // Exposed for tests.
    generators: { similarCheck, findX, wordSimilar, wordFind, scaleFactor, proportion }
};

export default similarFiguresPack;
