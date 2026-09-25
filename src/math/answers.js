// Answer formatting and checking shared by every grade.

const EPS = 1e-9;

/** True when the value has at most two decimal places (e.g. 15, 2.5, 14.4, 2.25). */
export function isNeat(value) {
    return Math.abs(value * 100 - Math.round(value * 100)) < 1e-6;
}

/** 15 -> "15", 2.5 -> "2.5", 6.666… -> "6.67". */
export function formatNumber(value) {
    const rounded = Math.round(value * 100) / 100;
    return String(parseFloat(rounded.toFixed(2)));
}

/**
 * How far off a typed answer may be. Neat answers must be exact; repeating
 * decimals accept anything rounded to tenths or better (6.7, 6.67, 6.666)
 * and exact fractions like 20/3.
 */
export function toleranceFor(value) {
    return isNeat(value) ? 0.001 : 0.05;
}

const DECIMAL = /^(\d+\.?\d*|\.\d+)$/;

/** Parses keypad text: "15", "6.67", ".5", "20/3". Returns NaN if it isn't a number. */
export function parseTypedNumber(text) {
    const s = String(text || '').replace(/\s+/g, '');
    if (!s) return NaN;
    const slash = s.indexOf('/');
    if (slash !== -1) {
        const top = s.slice(0, slash);
        const bottom = s.slice(slash + 1);
        if (!DECIMAL.test(top) || !DECIMAL.test(bottom)) return NaN;
        const d = parseFloat(bottom);
        if (d === 0) return NaN;
        return parseFloat(top) / d;
    }
    if (!DECIMAL.test(s)) return NaN;
    return parseFloat(s);
}

export function checkAnswer(problem, input) {
    if (problem.mode === 'typed') {
        const v = parseTypedNumber(input);
        if (!isFinite(v)) return false;
        return Math.abs(v - problem.value) <= problem.tolerance + EPS;
    }
    return input === problem.answer;
}

/** Turns a numeric multiple-choice problem into a type-the-number one. */
export function makeTyped(problem, value) {
    problem.mode = 'typed';
    problem.value = value;
    problem.tolerance = toleranceFor(value);
    problem.answer = formatNumber(value);
    delete problem.choices;
    return problem;
}
