import { randInt, pick, shuffle } from './random.js';

/**
 * Grade 3 problem packs.
 *
 * Each pack exports:
 * - id: unique identifier
 * - name: display name
 * - difficulty: base difficulty (1-5)
 * - coinMultiplier: reserved for per-pack rewards (not applied yet)
 * - generateProblem(): returns { question, answer, choices[], hint, explain }
 *
 * grades.js decides whether a problem is shown as multiple choice or typed
 * on the keypad.
 */

function choicesAround(correct, spread, min) {
    const floor = min === undefined ? 0 : min;
    const choices = [String(correct)];
    let guard = 0;
    while (choices.length < 3 && guard++ < 200) {
        const offset = randInt(-spread, spread);
        if (offset === 0) continue;
        const wrong = String(Math.max(floor, correct + offset));
        if (choices.indexOf(wrong) === -1) choices.push(wrong);
    }
    while (choices.length < 3) choices.push(String(correct + choices.length * spread + 1));
    return shuffle(choices);
}

function tens(n) {
    return Math.floor(n / 10) * 10;
}

function problem(question, answer, spread, hint, explain, min) {
    return {
        question,
        answer: String(answer),
        choices: choicesAround(answer, spread, min),
        hint,
        explain
    };
}

// ============================================================================
// PACK: Addition & Subtraction with Units
// ============================================================================
const addSubtractUnitsPack = {
    id: 'add-subtract-units',
    name: 'Add & Subtract (with units)',
    difficulty: 1,
    coinMultiplier: 1.0,

    generateProblem() {
        switch (pick(['simple-add', 'simple-subtract', 'ml-liters', 'grams-kg', 'meters-cm'])) {
            case 'simple-add': return this.generateSimpleAddition();
            case 'simple-subtract': return this.generateSimpleSubtraction();
            case 'ml-liters': return this.generateMLLiters();
            case 'grams-kg': return this.generateGramsKg();
            default: return this.generateMetersCm();
        }
    },

    generateSimpleAddition() {
        const a = randInt(10, 99);
        const b = randInt(10, 99);
        return problem(a + ' + ' + b + ' = ?', a + b, 10,
            'Add the tens first: ' + tens(a) + ' + ' + tens(b) + ' = ' + (tens(a) + tens(b)) + '. Then add the ones: ' + (a % 10) + ' + ' + (b % 10) + '.',
            a + ' + ' + b + ' = ' + (a + b));
    },

    generateSimpleSubtraction() {
        const a = randInt(50, 199);
        const b = randInt(10, a - 10);
        const step = a - tens(b);
        return problem(a + ' - ' + b + ' = ?', a - b, 10,
            'Take away the tens first: ' + a + ' - ' + tens(b) + ' = ' + step + '. Then take away ' + (b % 10) + ' more.',
            a + ' - ' + b + ' = ' + (a - b));
    },

    generateMLLiters() {
        if (randInt(0, 1) === 0) {
            const liters = randInt(1, 9);
            const ml = liters * 1000;
            return problem(ml + ' mL = ? L', liters, 1,
                '1 L = 1000 mL. How many 1000s are in ' + ml + '?',
                ml + ' mL = ' + liters + ' L', 1);
        }
        const a = randInt(100, 500);
        const b = randInt(100, 500);
        return problem(a + ' mL + ' + b + ' mL = ? mL', a + b, 50,
            'Add the hundreds first: ' + Math.floor(a / 100) * 100 + ' + ' + Math.floor(b / 100) * 100 + ' = ' + (Math.floor(a / 100) + Math.floor(b / 100)) * 100 + '.',
            a + ' + ' + b + ' = ' + (a + b) + ' mL');
    },

    generateGramsKg() {
        if (randInt(0, 1) === 0) {
            const kg = randInt(1, 5);
            const grams = kg * 1000;
            return problem(grams + ' g = ? kg', kg, 1,
                '1 kg = 1000 g. How many 1000s are in ' + grams + '?',
                grams + ' g = ' + kg + ' kg', 1);
        }
        const a = randInt(100, 999);
        const b = randInt(100, 999);
        return problem(a + ' g + ' + b + ' g = ? g', a + b, 100,
            'Add the hundreds first: ' + Math.floor(a / 100) * 100 + ' + ' + Math.floor(b / 100) * 100 + ' = ' + (Math.floor(a / 100) + Math.floor(b / 100)) * 100 + '.',
            a + ' + ' + b + ' = ' + (a + b) + ' g');
    },

    generateMetersCm() {
        if (randInt(0, 1) === 0) {
            const meters = randInt(1, 9);
            return problem(meters + ' m = ? cm', meters * 100, 100,
                '1 m = 100 cm. Count by 100s ' + meters + ' times.',
                meters + ' m = ' + meters * 100 + ' cm', 100);
        }
        const a = randInt(10, 99);
        const b = randInt(10, 99);
        return problem(a + ' cm + ' + b + ' cm = ? cm', a + b, 10,
            'Add the tens first: ' + tens(a) + ' + ' + tens(b) + ' = ' + (tens(a) + tens(b)) + '. Then add the ones.',
            a + ' + ' + b + ' = ' + (a + b) + ' cm');
    }
};

// ============================================================================
// PACK: Multiplication (Beginner - Early 3rd Grade)
// ============================================================================
function skipCount(by, count) {
    const list = [];
    for (let i = 1; i <= Math.min(count, 3); i++) list.push(by * i);
    return list.join(', ') + '\u2026';
}

const multiplicationPack = {
    id: 'multiplication',
    name: 'Multiplication Facts',
    difficulty: 2,
    coinMultiplier: 1.3,

    generateProblem() {
        switch (pick(['basic-facts', 'by-2', 'by-5', 'by-10'])) {
            case 'by-2': return this.generateMultiplyBy(2);
            case 'by-5': return this.generateMultiplyBy(5);
            case 'by-10': return this.generateMultiplyBy(10);
            default: return this.generateBasicFacts();
        }
    },

    fact(a, b, spread) {
        return problem(a + ' \u00D7 ' + b + ' = ?', a * b, spread,
            a + ' \u00D7 ' + b + ' means ' + b + ' groups of ' + a + '. Skip-count by ' + a + ': ' + skipCount(a, b),
            a + ' \u00D7 ' + b + ' = ' + a * b, 1);
    },

    generateBasicFacts() {
        return this.fact(randInt(2, 5), randInt(2, 10), 5);
    },

    generateMultiplyBy(multiplier) {
        return this.fact(multiplier, randInt(2, 10), multiplier);
    }
};

// ============================================================================
// PACK: Division (Beginner - Early 3rd Grade)
// ============================================================================
const divisionPack = {
    id: 'division',
    name: 'Division Facts',
    difficulty: 2,
    coinMultiplier: 1.4,

    generateProblem() {
        switch (pick(['basic-facts', 'by-2', 'by-5', 'by-10'])) {
            case 'by-2': return this.generateDivideBy(2);
            case 'by-5': return this.generateDivideBy(5);
            case 'by-10': return this.generateDivideBy(10);
            default: return this.generateBasicFacts();
        }
    },

    fact(divisor, quotient, spread) {
        const dividend = divisor * quotient;
        return problem(dividend + ' \u00F7 ' + divisor + ' = ?', quotient, spread,
            'Think of times: ' + divisor + ' \u00D7 ? = ' + dividend + '. Skip-count by ' + divisor + ' until you reach ' + dividend + '.',
            dividend + ' \u00F7 ' + divisor + ' = ' + quotient + ' because ' + divisor + ' \u00D7 ' + quotient + ' = ' + dividend, 1);
    },

    generateBasicFacts() {
        return this.fact(randInt(2, 5), randInt(2, 10), 3);
    },

    generateDivideBy(divisor) {
        return this.fact(divisor, randInt(2, 10), 2);
    }
};

// ============================================================================
// Pack Registry
// ============================================================================
const PACKS = {
    'add-subtract-units': addSubtractUnitsPack,
    'multiplication': multiplicationPack,
    'division': divisionPack
};

/**
 * Get a random problem from the specified pack
 */
export function getRandomProblem(packId) {
    const pack = PACKS[packId];
    if (!pack) {
        return {
            question: '1 + 1 = ?',
            answer: '2',
            choices: ['1', '2', '3'],
            hint: 'Count one more after 1.',
            explain: '1 + 1 = 2'
        };
    }
    const p = pack.generateProblem();
    p.pack = pack.id;
    return p;
}

/**
 * Get a problem from a randomly chosen pack
 */
export function getMixedProblem() {
    return getRandomProblem(pick(Object.keys(PACKS)));
}

/**
 * Get all available packs
 */
export function getAllPacks() {
    return Object.keys(PACKS).map((k) => PACKS[k]);
}

/**
 * Get pack by ID
 */
export function getPack(packId) {
    return PACKS[packId];
}
