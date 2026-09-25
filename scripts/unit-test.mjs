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

if (failures) {
    console.error('\nUNIT TESTS FAILED (' + failures + ')');
    process.exit(1);
}
console.log('\nUNIT TESTS PASSED');
