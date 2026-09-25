import { getMixedProblem, getRandomProblem } from './mathPacks.js';
import { getSimilarFiguresProblem } from './similarFigures.js';
import { chance } from './random.js';
import { formatNumber } from './answerCheck.js';

export const GRADES = [
    { id: 3, label: 'Grade 3', blurb: '+  \u2212  \u00D7  \u00F7' },
    { id: 7, label: 'Grade 7', blurb: 'Similar shapes' }
];

export const DEFAULT_GRADE = 3;

// Share of Grade 3 problems typed on the keypad instead of multiple choice.
const GRADE3_TYPED_SHARE = 0.5;

export function normalizeGrade(value) {
    const n = Number(value);
    for (let i = 0; i < GRADES.length; i++) {
        if (GRADES[i].id === n) return n;
    }
    return DEFAULT_GRADE;
}

export function getGrade(id) {
    const n = normalizeGrade(id);
    return GRADES.filter((g) => g.id === n)[0];
}

/**
 * Returns a problem ready for the Math Stop:
 * {
 *   question, input: 'choice' | 'number', hint, explain, answerText,
 *   choice:  choices[], answer
 *   number:  answerValue, allowFraction, unit
 *   diagram (optional)
 * }
 * force (optional, used by tests): { kind, input, pack }
 */
export function getProblemForGrade(grade, force) {
    force = force || {};
    const g = normalizeGrade(grade);
    let p;
    if (g === 7) {
        p = getSimilarFiguresProblem(force.kind);
    } else {
        p = force.pack ? getRandomProblem(force.pack) : getMixedProblem();
        p.grade = 3;
        const typed = force.input ? force.input === 'number' : chance(GRADE3_TYPED_SHARE);
        p.input = typed ? 'number' : 'choice';
        if (typed) {
            p.answerValue = Number(p.answer);
            p.allowFraction = false;
            p.unit = '';
        }
        p.answerText = p.answer;
    }
    if (p.input === 'number' && !p.answerText) p.answerText = formatNumber(p.answerValue);
    return p;
}
