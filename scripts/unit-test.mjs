#!/usr/bin/env node
/**
 * Plain-Node checks of the math content (no browser needed):
 *   - typed-answer tolerance rules (6.67 / 6.6 / 20/3 for 20/3, exact for 2.5)
 *   - keypad editing rules
 *   - coin economy ordering (guessing never pays)
 *   - thousands of generated Grade 3 and Grade 7 problems are well-formed,
 *     mathematically right, use friendly numbers, and mix typed / choice input
 */
import {
    isTypedAnswerCorrect, applyKey, canSubmit, formatNumber, formatApprox
} from '../src/math/answerCheck.js';
import { COINS, coinDelta, applyCoins } from '../src/math/scoring.js';
import { getProblemForGrade, normalizeGrade } from '../src/math/grades.js';
import {
    getSimilarFiguresProblem, makeScenario, WORD_PAIRS, YES, NO
} from '../src/math/similarFigures.js';

let failures = 0;
let passes = 0;
function check(cond, msg) {
    if (cond) {
        passes++;
    } else {
        failures++;
        console.log('    FAIL ' + msg);
    }
}
function section(name) {
    console.log('\n[' + name + ']');
}

section('typed answers');
const twentyThirds = 20 / 3;
['6.67', '6.6', '6.7', '6.666', '6.667', '20/3', '6.66666'].forEach((t) => {
    check(isTypedAnswerCorrect(t, twentyThirds), t + ' accepted for 20/3');
});
['6.5', '7', '6', '6.68', '6.65', '21/3', '6.'].forEach((t) => {
    check(!isTypedAnswerCorrect(t, twentyThirds), t + ' rejected for 20/3');
});
check(isTypedAnswerCorrect('2.333', 7 / 3) && isTypedAnswerCorrect('2.33', 7 / 3) && !isTypedAnswerCorrect('2.4', 7 / 3), '7/3 rounding/truncating only');
check(isTypedAnswerCorrect('2.5', 2.5) && isTypedAnswerCorrect('2.50', 2.5) && isTypedAnswerCorrect('5/2', 2.5), '2.5 exact forms');
['2', '3', '2.4', '2.6', '2.49'].forEach((t) => check(!isTypedAnswerCorrect(t, 2.5), t + ' rejected for 2.5'));
check(isTypedAnswerCorrect('14.4', 14.4) && !isTypedAnswerCorrect('14.3', 14.4) && !isTypedAnswerCorrect('14', 14.4), '14.4 must be exact');
check(isTypedAnswerCorrect('15', 15) && isTypedAnswerCorrect('15.0', 15) && !isTypedAnswerCorrect('15.1', 15), 'whole numbers');
check(isTypedAnswerCorrect('.5', 0.5), 'leading decimal point');
['', '.', '/', '3/', '3/0', '1.2.3', 'abc'].forEach((t) => check(!canSubmit(t), JSON.stringify(t) + ' cannot be submitted'));

section('keypad editing');
const type = (keys, frac) => keys.reduce((t, k) => applyKey(t, k, frac), '');
check(type(['1', '.', '5']) === '1.5', 'decimal');
check(type(['1', '.', '.', '5']) === '1.5', 'only one decimal point');
check(type(['0', '7']) === '7', 'no leading zero');
check(type(['0', '.', '7']) === '0.7', 'zero point seven');
check(type(['2', '0', '/', '3'], true) === '20/3', 'fraction when allowed');
check(type(['2', '0', '/', '3'], false) === '203', 'slash ignored when not allowed');
check(type(['/', '1'], true) === '1', 'no leading slash');
check(type(['1', '2', 'back']) === '1', 'backspace');
check(type(['1', '2', 'clear']) === '', 'clear');
check(type(['1', '2', '3', '4', '5', '6', '7', '8', '9']).length === 8, 'max length');
check(formatNumber(15) === '15' && formatNumber(2.5) === '2.5' && formatNumber(20 / 3) === '6.67', 'formatNumber');
check(formatApprox(7 / 3) === '2.333\u2026' && formatApprox(2.25) === '2.25', 'formatApprox');

section('coin economy');
check(COINS.right > COINS.rightWithHint && COINS.rightWithHint > 0, 'right > right with hint > 0');
check(coinDelta(true, true) > coinDelta(false, true) && coinDelta(false, true) > coinDelta(false, false), 'hint-right > hint-wrong > wrong');
check(COINS.wrong > 2, 'wrong-no-hint penalty is bigger than the old -2');
check(COINS.rightWithHint === Math.ceil(COINS.right / 2), 'hint halves the reward (rounded up)');
check(0.5 * coinDelta(true, false) + 0.5 * coinDelta(false, false) < 0, 'blind YES/NO guessing loses coins on average');
check(0.5 * coinDelta(true, true) + 0.5 * coinDelta(false, true) < 0, 'hint + guessing YES/NO still loses coins on average');
check(applyCoins(3, -8) === 0 && applyCoins(10, 6) === 16, 'coins never go below zero');

section('grade helpers');
check(normalizeGrade(7) === 7 && normalizeGrade('7') === 7 && normalizeGrade(5) === 3 && normalizeGrade(undefined) === 3, 'normalizeGrade');

function isFriendly(label) {
    if (label === 'x') return true;
    const n = parseFloat(label);
    return isFinite(n) && Math.abs(n * 10 - Math.round(n * 10)) < 1e-9;
}

function commonChecks(p, tag) {
    check(typeof p.question === 'string' && p.question.length > 4, tag + ' has a question');
    check(typeof p.hint === 'string' && p.hint.length > 8, tag + ' has a hint');
    check(typeof p.explain === 'string' && p.explain.length > 4, tag + ' has an explanation');
    check(typeof p.answerText === 'string' && p.answerText.length > 0, tag + ' has answerText');
    check(p.input === 'choice' || p.input === 'number', tag + ' input mode');
    if (p.input === 'choice') {
        check(Array.isArray(p.choices) && p.choices.indexOf(p.answer) !== -1, tag + ' choices include answer');
    } else {
        check(isFinite(p.answerValue) && p.answerValue > 0, tag + ' numeric answer (' + p.answerValue + ')');
        check(isTypedAnswerCorrect(formatNumber(p.answerValue), p.answerValue), tag + ' shown answer is accepted');
        check(p.hint.indexOf('x = ') === -1, tag + ' hint does not give away x');
    }
}

section('Grade 7 generator (4000 samples)');
const counts = {};
let typed = 0;
let yes = 0;
let yesNo = 0;
let repeating = 0;
let decimal = 0;
for (let i = 0; i < 4000; i++) {
    const p = getProblemForGrade(7);
    const tag = 'g7 ' + p.kind + ' #' + i;
    counts[p.kind] = (counts[p.kind] || 0) + 1;
    commonChecks(p, tag);
    if (p.input === 'number') typed++;
    if (p.input === 'choice') {
        yesNo++;
        if (p.answer === YES) yes++;
        check(p.choices.length === 2 && p.choices[0] === YES && p.choices[1] === NO, tag + ' yes/no choices');
    }
    if (p.input === 'number') {
        if (!Number.isInteger(p.answerValue)) {
            if (Math.abs(p.answerValue * 100 - Math.round(p.answerValue * 100)) < 1e-7) decimal++;
            else repeating++;
        }
    }
    if (p.diagram && p.diagram.shapes) {
        p.diagram.shapes.forEach((s) => {
            Object.keys(s.labels).forEach((k) => check(isFriendly(s.labels[k]), tag + ' friendly label ' + s.labels[k]));
        });
    }
    if (p.kind === 'find-x' || p.kind === 'word-find') {
        const [a, b] = p.diagram.shapes;
        check(Math.abs(a.w / b.w - a.h / b.h) < 1e-9, tag + ' figures really are similar');
        const unknown = [a, b].reduce((n, s) => n + ['w', 'h'].filter((k) => s.labels[k] === 'x').length, 0);
        check(unknown === 1, tag + ' exactly one x');
        const xShape = [a, b].find((s) => s.labels.w === 'x' || s.labels.h === 'x');
        const xKey = xShape.labels.w === 'x' ? 'w' : 'h';
        check(Math.abs(xShape[xKey] - p.answerValue) < 1e-9, tag + ' x matches answer');
    }
    if (p.kind === 'similar-yesno' && p.shape === 'tri') {
        const [s, b] = p.diagram.shapes;
        const r = [b.a / s.a, b.b / s.b, b.c / s.c];
        const same = Math.abs(r[0] - r[1]) < 1e-9 && Math.abs(r[1] - r[2]) < 1e-9;
        check(same === (p.answer === YES), tag + ' triangle answer matches ratios');
        [s, b].forEach((t) => {
            const sides = [t.a, t.b, t.c].sort((m, n) => n - m);
            check(sides[0] < sides[1] + sides[2], tag + ' valid triangle');
        });
    }
    if (p.kind === 'similar-yesno' && p.shape === 'rect') {
        const [s, b] = p.diagram.shapes;
        const same = Math.abs(Math.max(b.w, b.h) / Math.max(s.w, s.h) - Math.min(b.w, b.h) / Math.min(s.w, s.h)) < 1e-9;
        check(same === (p.answer === YES), tag + ' rectangle answer matches ratios');
    }
}
console.log('    kinds: ' + JSON.stringify(counts));
console.log('    typed ' + typed + '/4000, yes ' + yes + '/' + yesNo + ', non-whole typed answers: ' + decimal + ' clean decimals, ' + repeating + ' repeating');
check(typed / 4000 >= 0.6, 'Grade 7: most problems are typed');
check(yes / yesNo > 0.35 && yes / yesNo < 0.65, 'Grade 7: YES and NO both common');
check(repeating > 100 && decimal > 200, 'Grade 7: mix of clean and repeating decimals');
['similar-yesno', 'find-x', 'word-find', 'word-yesno', 'scale'].forEach((k) => check(counts[k] > 50, 'Grade 7 kind appears: ' + k));
WORD_PAIRS.forEach((w) => {
    let fallbacks = 0;
    for (let i = 0; i < 300; i++) {
        const sc = makeScenario(null, w.limits);
        if (sc.fallback) fallbacks++;
        const smallB = sc.onBig ? sc.m : sc.xv;
        if (w.limits.aspectMax < 1) check(smallB < sc.p, w.small + ': "' + w.a + '" side is the longer one');
    }
    check(fallbacks === 0, w.small + ': realistic numbers always found (' + fallbacks + ' fallbacks)');
});
for (let i = 0; i < 2000; i++) {
    const p = getProblemForGrade(7);
    check(!/\u2026\./.test(p.hint + p.explain), 'no "….": ' + p.hint + ' / ' + p.explain);
}
['rect', 'rightTri', 'para', 'L'].forEach((shape) => {
    const p = getSimilarFiguresProblem('find-x:' + shape);
    check(p.shape === shape && p.diagram.shapes[0].kind === shape, 'find-x can be forced to ' + shape);
});

section('Grade 3 generator (3000 samples)');
let typed3 = 0;
for (let i = 0; i < 3000; i++) {
    const p = getProblemForGrade(3);
    commonChecks(p, 'g3 ' + p.pack + ' #' + i);
    check(p.choices.length === 3, 'g3 #' + i + ' three choices (' + p.choices.join(',') + ')');
    if (p.input === 'number') {
        typed3++;
        check(isTypedAnswerCorrect(p.answer, p.answerValue), 'g3 #' + i + ' answer string accepted');
    }
}
console.log('    typed ' + typed3 + '/3000');
check(typed3 / 3000 > 0.4 && typed3 / 3000 < 0.6, 'Grade 3: about half typed');
check(getProblemForGrade(3, { input: 'choice' }).input === 'choice' && getProblemForGrade(3, { input: 'number' }).input === 'number', 'Grade 3 input can be forced');

console.log('\n' + passes + ' checks passed');
if (failures) {
    console.error('UNIT TESTS FAILED (' + failures + ' problem(s))');
    process.exit(1);
}
console.log('UNIT TESTS PASSED');
