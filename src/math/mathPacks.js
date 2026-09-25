import { between, pick, shuffle, chance } from './random.js';
import { makeTyped } from './answers.js';
import similarFiguresPack from './similarFigures.js';

/**
 * Math Problem Pack System
 *
 * Each pack exports:
 * - id: unique identifier
 * - name: display name
 * - grade: which grade level uses it
 * - generateProblem(): returns a problem (see README "Problem format")
 *
 * A problem looks like:
 *   { question, answer, mode: 'choice', choices: [...], hint, explain }
 *   { question, answer, mode: 'typed', value, tolerance, hint, explain }
 * plus optional `diagram` (drawn in the Math Stop) and `unit`.
 */

// Share of Grade 3 numeric problems that ask the kid to type the answer
// instead of picking one of three buttons.
const G3_TYPED_SHARE = 0.5;

function numberChoices(correct, spread, min) {
    const floor = min === undefined ? 0 : min;
    const choices = [String(correct)];
    let guard = 0;
    while (choices.length < 3 && guard++ < 100) {
        const offset = between(-spread, spread);
        if (offset === 0) continue;
        const wrong = String(Math.max(floor, correct + offset));
        if (choices.indexOf(wrong) === -1) choices.push(wrong);
    }
    let bump = 1;
    while (choices.length < 3) {
        const extra = String(correct + spread + bump++);
        if (choices.indexOf(extra) === -1) choices.push(extra);
    }
    return shuffle(choices);
}

function numeric(question, value, spread, hint, explain, min) {
    const problem = {
        question,
        answer: String(value),
        mode: 'choice',
        choices: numberChoices(value, spread, min),
        hint,
        explain
    };
    return chance(G3_TYPED_SHARE) ? makeTyped(problem, value) : problem;
}

function tens(n) {
    return Math.floor(n / 10) * 10;
}

// ============================================================================
// PACK: Addition & Subtraction with Units
// ============================================================================
const addSubtractUnitsPack = {
    id: 'add-subtract-units',
    name: 'Add & Subtract (with units)',
    grade: 3,
    difficulty: 1,

    generateProblem() {
        const type = pick(['simple-add', 'simple-subtract', 'ml-liters', 'grams-kg', 'meters-cm']);
        switch (type) {
            case 'simple-add': return this.generateSimpleAddition();
            case 'simple-subtract': return this.generateSimpleSubtraction();
            case 'ml-liters': return this.generateMLLiters();
            case 'grams-kg': return this.generateGramsKg();
            default: return this.generateMetersCm();
        }
    },

    addHint(a, b) {
        return 'Add the tens first: ' + tens(a) + ' + ' + tens(b) + ' = ' + (tens(a) + tens(b)) +
            '. Then add the ones: ' + (a % 10) + ' + ' + (b % 10) + '.';
    },

    generateSimpleAddition() {
        const a = between(10, 99);
        const b = between(10, 99);
        return numeric(a + ' + ' + b + ' = ?', a + b, 10, this.addHint(a, b),
            a + ' + ' + b + ' = ' + (a + b));
    },

    generateSimpleSubtraction() {
        const a = between(50, 199);
        const b = between(10, a - 10);
        const hint = 'Take away the tens first: ' + a + ' \u2212 ' + tens(b) + ' = ' + (a - tens(b)) +
            '. Then take away ' + (b % 10) + ' more.';
        return numeric(a + ' \u2212 ' + b + ' = ?', a - b, 10, hint, a + ' \u2212 ' + b + ' = ' + (a - b));
    },

    generateMLLiters() {
        if (chance(0.5)) {
            const liters = between(1, 9);
            const ml = liters * 1000;
            return numeric(ml + ' mL = ? L', liters, 2,
                '1 L = 1000 mL. How many groups of 1000 are in ' + ml + '?',
                ml + ' mL = ' + liters + ' L', 1);
        }
        const a = between(100, 500);
        const b = between(100, 500);
        return numeric(a + ' mL + ' + b + ' mL = ? mL', a + b, 50,
            'Add the hundreds first: ' + Math.floor(a / 100) * 100 + ' + ' + Math.floor(b / 100) * 100 +
            ' = ' + (Math.floor(a / 100) + Math.floor(b / 100)) * 100 + '. Then add the rest.',
            a + ' + ' + b + ' = ' + (a + b) + ' mL');
    },

    generateGramsKg() {
        if (chance(0.5)) {
            const kg = between(1, 5);
            const grams = kg * 1000;
            return numeric(grams + ' g = ? kg', kg, 2,
                '1 kg = 1000 g. How many groups of 1000 are in ' + grams + '?',
                grams + ' g = ' + kg + ' kg', 1);
        }
        const a = between(100, 999);
        const b = between(100, 999);
        return numeric(a + ' g + ' + b + ' g = ? g', a + b, 100,
            'Add the hundreds first: ' + Math.floor(a / 100) * 100 + ' + ' + Math.floor(b / 100) * 100 +
            ' = ' + (Math.floor(a / 100) + Math.floor(b / 100)) * 100 + '. Then add the rest.',
            a + ' + ' + b + ' = ' + (a + b) + ' g');
    },

    generateMetersCm() {
        if (chance(0.5)) {
            const meters = between(1, 9);
            return numeric(meters + ' m = ? cm', meters * 100, 100,
                '1 m = 100 cm. So ' + meters + ' m is ' + meters + ' groups of 100.',
                meters + ' \u00D7 100 = ' + meters * 100 + ' cm', 100);
        }
        const a = between(10, 99);
        const b = between(10, 99);
        return numeric(a + ' cm + ' + b + ' cm = ? cm', a + b, 10, this.addHint(a, b),
            a + ' + ' + b + ' = ' + (a + b) + ' cm');
    }
};

// ============================================================================
// PACK: Multiplication (Beginner - Early 3rd Grade)
// ============================================================================
// First few skip-counting steps, stopping before the final answer.
function skipCount(step, total) {
    const out = [];
    for (let i = 1; i <= Math.min(total - 1, 3); i++) out.push(step * i);
    return out.length ? out.join(', ') + ', \u2026' : step + ', \u2026';
}

function multiplyProblem(a, b) {
    const hint = a + ' \u00D7 ' + b + ' means ' + a + ' groups of ' + b +
        '. Skip count by ' + b + ', ' + a + ' times: ' + skipCount(b, a) +
        ' (or draw ' + a + ' rows of ' + b + ' dots on the whiteboard).';
    return numeric(a + ' \u00D7 ' + b + ' = ?', a * b, Math.max(3, Math.min(a, b)), hint,
        a + ' \u00D7 ' + b + ' = ' + a * b, 1);
}

const multiplicationPack = {
    id: 'multiplication',
    name: 'Multiplication Facts',
    grade: 3,
    difficulty: 2,

    generateProblem() {
        const type = pick(['basic-facts', 'by-2', 'by-5', 'by-10']);
        if (type === 'basic-facts') return multiplyProblem(between(2, 5), between(2, 10));
        const multiplier = type === 'by-2' ? 2 : type === 'by-5' ? 5 : 10;
        return multiplyProblem(multiplier, between(2, 10));
    }
};

// ============================================================================
// PACK: Division (Beginner - Early 3rd Grade)
// ============================================================================
function divideProblem(divisor, quotient) {
    const dividend = divisor * quotient;
    const hint = 'Think: what number \u00D7 ' + divisor + ' = ' + dividend +
        '? Skip count by ' + divisor + ': ' + skipCount(divisor, quotient) + ' until you reach ' + dividend + '.';
    return numeric(dividend + ' \u00F7 ' + divisor + ' = ?', quotient, 3, hint,
        quotient + ' \u00D7 ' + divisor + ' = ' + dividend + ', so ' + dividend + ' \u00F7 ' + divisor + ' = ' + quotient, 1);
}

const divisionPack = {
    id: 'division',
    name: 'Division Facts',
    grade: 3,
    difficulty: 2,

    generateProblem() {
        const type = pick(['basic-facts', 'by-2', 'by-5', 'by-10']);
        if (type === 'basic-facts') return divideProblem(between(2, 5), between(2, 10));
        const divisor = type === 'by-2' ? 2 : type === 'by-5' ? 5 : 10;
        return divideProblem(divisor, between(2, 10));
    }
};

// ============================================================================
// Pack Registry
// ============================================================================
const PACKS = {
    'add-subtract-units': addSubtractUnitsPack,
    'multiplication': multiplicationPack,
    'division': divisionPack,
    'similar-figures': similarFiguresPack
};

export function getRandomProblem(packId) {
    const pack = PACKS[packId];
    if (!pack) {
        return { question: '1 + 1 = ?', answer: '2', mode: 'choice', choices: ['1', '2', '3'], hint: 'One and one more.', explain: '1 + 1 = 2', packId: 'fallback' };
    }
    const problem = pack.generateProblem();
    problem.packId = pack.id;
    return problem;
}

export function getAllPacks() {
    return Object.keys(PACKS).map((k) => PACKS[k]);
}

export function getPack(packId) {
    return PACKS[packId];
}

export function packsForGrade(grade) {
    return getAllPacks().filter((p) => p.grade === grade);
}
