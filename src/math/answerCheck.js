// Typed-answer rules for the on-screen keypad.
//
// Exact answers (whole numbers and decimals with up to 2 places, e.g. 15, 2.5,
// 14.4) must be typed exactly; "15.0" is fine. Repeating answers such as
// 20/3 = 6.666... accept the exact fraction, or any decimal with at least one
// place that is the answer rounded OR cut off at that many places:
// 6.7, 6.6, 6.67, 6.66, 6.667 ... are all right, 6.5 and 7 are not.

const MAX_LENGTH = 8;
const NUMBER = '(\\d+(?:\\.\\d*)?|\\.\\d+)';
const TYPED_RE = new RegExp('^' + NUMBER + '(?:\\/' + NUMBER + ')?$');

export function parseTyped(text) {
    if (typeof text !== 'string') return null;
    const m = TYPED_RE.exec(text);
    if (!m) return null;
    const top = parseFloat(m[1]);
    if (m[2] === undefined) return { value: top, decimals: decimalsOf(m[1]), fraction: false };
    const bottom = parseFloat(m[2]);
    if (!(bottom > 0)) return null;
    return { value: top / bottom, decimals: 0, fraction: true };
}

function decimalsOf(str) {
    const dot = str.indexOf('.');
    return dot === -1 ? 0 : str.length - dot - 1;
}

export function isExactDecimal(value) {
    return Math.abs(value * 100 - Math.round(value * 100)) < 1e-7;
}

export function isTypedAnswerCorrect(text, answerValue) {
    const typed = parseTyped(text);
    if (!typed) return false;
    const v = typed.value;
    if (Math.abs(v - answerValue) < 1e-6) return true;
    if (typed.fraction || isExactDecimal(answerValue)) return false;
    const d = typed.decimals;
    if (d < 1 || d > 9) return false;
    const scale = Math.pow(10, d);
    const t = Math.round(v * scale);
    return t === Math.round(answerValue * scale) || t === Math.floor(answerValue * scale + 1e-9);
}

export function canSubmit(text) {
    return parseTyped(text) !== null;
}

/**
 * Apply one keypad key ('0'-'9', '.', '/', 'back', 'clear') to the typed text.
 * Keys that would make an invalid number are ignored.
 */
export function applyKey(text, key, allowFraction) {
    text = text || '';
    if (key === 'back') return text.slice(0, -1);
    if (key === 'clear') return '';
    if (text.length >= MAX_LENGTH) return text;
    const slash = text.indexOf('/');
    const part = slash === -1 ? text : text.slice(slash + 1);
    if (key === '.') {
        return part.indexOf('.') === -1 ? text + '.' : text;
    }
    if (key === '/') {
        if (!allowFraction || slash !== -1 || !/\d$/.test(text)) return text;
        return text + '/';
    }
    if (/^\d$/.test(key)) {
        if (part === '0') return text.slice(0, -1) + key;
        return text + key;
    }
    return text;
}

/** 15 -> "15", 2.5 -> "2.5", 6.6666 -> "6.67" */
export function formatNumber(value) {
    if (Math.abs(value - Math.round(value)) < 1e-9) return String(Math.round(value));
    if (isExactDecimal(value)) return String(Math.round(value * 100) / 100);
    return value.toFixed(2);
}

/** For working shown in hints: exact when it terminates, else "2.333…". */
export function formatApprox(value) {
    if (isExactDecimal(value)) return formatNumber(value);
    return (Math.floor(value * 1000 + 1e-9) / 1000).toFixed(3) + '\u2026';
}
