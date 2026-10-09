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
// PACK: Simplifying Strategy (Compensation / Make-a-Friendly-Number)
// ============================================================================
const simplifyingStrategyPack = {
    id: 'simplifying-strategy',
    name: 'Simplifying Strategies',
    grade: 3,
    difficulty: 2,

    generateProblem() {
        // Mix of 2-digit + 2-digit and 3-digit + 2/3-digit, sums <= 1000
        const use3Digit = chance(0.4);
        let a, b, sum;
        
        if (use3Digit) {
            // 3-digit + 2-digit or 3-digit + 3-digit
            a = between(100, 500);
            b = chance(0.5) ? between(10, 99) : between(100, Math.min(400, 1000 - a));
            sum = a + b;
        } else {
            // 2-digit + 2-digit
            a = between(10, 99);
            b = between(10, 99);
            sum = a + b;
        }
        
        // Find the addend closest to a friendly number (ending in 0, 00, 25, 50, 75)
        const roundUp = (n, target) => target - (n % target);
        const roundDown = (n, target) => n % target;
        
        // Find best compensation for 'a'
        const aTo10 = roundUp(a, 10);
        const aTo100 = roundUp(a, 100);
        let bestAdjust = aTo10;
        let aFriendly = a + aTo10;
        
        if (a >= 100 && aTo100 <= 20 && aTo100 < aTo10) {
            bestAdjust = aTo100;
            aFriendly = a + aTo100;
        }
        
        // For numbers like 198, round up to 200
        if (aFriendly === a) {
            if (a >= 100) {
                aFriendly = Math.ceil(a / 100) * 100;
                bestAdjust = aFriendly - a;
            } else {
                aFriendly = Math.ceil(a / 10) * 10;
                bestAdjust = aFriendly - a;
            }
        }
        
        // Make sure adjustment is reasonable (not too large)
        if (bestAdjust > 10 && bestAdjust <= 20) {
            aFriendly = a + bestAdjust;
        } else if (bestAdjust > 20) {
            // Just round to nearest 10
            aFriendly = Math.round(a / 10) * 10;
            bestAdjust = aFriendly - a;
        }
        
        const bAdjusted = b - bestAdjust;
        
        const hint = 'Make ' + a + ' friendly: ' + a + ' + ' + bestAdjust + ' = ' + aFriendly + '. ' +
            'Then ' + aFriendly + ' + ' + bAdjusted + ' = ' + (aFriendly + bAdjusted) + '.';
        
        return numeric(
            a + ' + ' + b + ' = ?',
            sum,
            15,
            hint,
            a + ' + ' + b + ' = ' + sum + ' (strategy: ' + aFriendly + ' + ' + bAdjusted + ' = ' + sum + ')'
        );
    }
};

// ============================================================================
// PACK: Benchmark Numbers Strategy
// ============================================================================
const benchmarkNumbersPack = {
    id: 'benchmark-numbers',
    name: 'Benchmark Numbers',
    grade: 3,
    difficulty: 2,

    generateProblem() {
        // Benchmark numbers: 10, 25, 50, 75, 100, 250, 500
        const benchmarks = [10, 25, 50, 75, 100, 250, 500];
        
        // Pick a benchmark and create a number close to it
        const benchmark = pick(benchmarks);
        const offset = between(-9, 9);
        if (offset === 0) return this.generateProblem(); // Try again
        
        const a = benchmark + offset;
        const b = between(10, Math.min(99, 900 - a));
        const sum = a + b;
        
        // Calculate using the benchmark
        const benchSum = benchmark + b;
        const finalAdjust = -offset; // If a was benchmark + offset, we need to adjust by -offset
        
        const hint = a + ' is close to ' + benchmark + ' (' + 
            (offset > 0 ? 'add ' + offset : 'subtract ' + Math.abs(offset)) + '). ' +
            'First: ' + benchmark + ' + ' + b + ' = ' + benchSum + '. ' +
            'Then adjust: ' + benchSum + (finalAdjust >= 0 ? ' + ' + finalAdjust : ' - ' + Math.abs(finalAdjust)) + ' = ' + sum + '.';
        
        return numeric(
            a + ' + ' + b + ' = ?',
            sum,
            15,
            hint,
            a + ' + ' + b + ' = ' + sum + ' (using benchmark ' + benchmark + ')'
        );
    }
};

// ============================================================================
// PACK: Number Bond and Arrow Way
// ============================================================================
const numberBondArrowPack = {
    id: 'number-bond-arrow',
    name: 'Number Bond & Arrow Way',
    grade: 3,
    difficulty: 2,

    generateProblem() {
        const useSubtraction = chance(0.4);
        
        if (useSubtraction) {
            // Arrow way for subtraction
            const start = between(100, 999);
            const subtract = between(20, Math.min(99, start - 10));
            const answer = start - subtract;
            
            // Break subtraction into jumps to friendly numbers
            const ones = start % 10;
            const tens = Math.floor(subtract / 10) * 10;
            const onesLeft = subtract % 10;
            
            let steps = [];
            let current = start;
            
            // Jump to previous ten if needed
            if (ones > 0 && onesLeft > 0) {
                const jumpToTen = Math.min(ones, onesLeft);
                const next = current - jumpToTen;
                steps.push(current + ' --(-' + jumpToTen + ')--> ' + next);
                current = next;
            }
            
            // Jump by tens
            if (tens > 0) {
                const next = current - tens;
                steps.push(current + ' --(-' + tens + ')--> ' + next);
                current = next;
            }
            
            // Final jump
            const remaining = start - subtract - current;
            if (remaining !== 0) {
                steps.push(current + ' --(-' + Math.abs(remaining) + ')--> ' + answer);
            }
            
            const hint = 'Arrow way: ' + steps.join(', then ') + '.';
            
            return numeric(
                start + ' \u2212 ' + subtract + ' = ?',
                answer,
                15,
                hint,
                start + ' \u2212 ' + subtract + ' = ' + answer + ' (arrow jumps: ' + steps.join(' ') + ')'
            );
        } else {
            // Number bond for addition (make a ten or hundred)
            const a = between(20, 999);
            const b = between(10, 99);
            const sum = a + b;
            
            if (sum > 1000) return this.generateProblem(); // Keep sum <= 1000
            
            // Find how much to make the next ten or hundred
            const aOnes = a % 10;
            const makeATen = aOnes > 0 ? (10 - aOnes) : 0;
            
            let bondPart1, bondPart2, friendly;
            
            if (makeATen > 0 && makeATen <= b) {
                bondPart1 = makeATen;
                bondPart2 = b - makeATen;
                friendly = a + bondPart1;
            } else {
                // Make a hundred instead
                const aToHundred = 100 - (a % 100);
                if (aToHundred <= b && aToHundred < 50) {
                    bondPart1 = aToHundred;
                    bondPart2 = b - aToHundred;
                    friendly = a + bondPart1;
                } else {
                    // Just split b roughly in half
                    bondPart1 = Math.floor(b / 2);
                    bondPart2 = b - bondPart1;
                    friendly = a + bondPart1;
                }
            }
            
            const hint = 'Number bond: break ' + b + ' into ' + bondPart1 + ' + ' + bondPart2 + '. ' +
                'First: ' + a + ' + ' + bondPart1 + ' = ' + friendly + '. ' +
                'Then: ' + friendly + ' + ' + bondPart2 + ' = ' + sum + '.';
            
            return numeric(
                a + ' + ' + b + ' = ?',
                sum,
                15,
                hint,
                a + ' + ' + b + ' = ' + sum + ' (bond ' + b + ' = ' + bondPart1 + ' + ' + bondPart2 + ')'
            );
        }
    }
};

// ============================================================================
// PACK: Rounding to Nearest Ten or Hundred
// ============================================================================
const roundingPack = {
    id: 'rounding',
    name: 'Rounding Numbers',
    grade: 3,
    difficulty: 1,

    generateProblem() {
        const roundToHundred = chance(0.4);
        
        if (roundToHundred) {
            // Round to nearest hundred (3-digit numbers)
            const hundreds = between(1, 9);
            const remainder = between(0, 99);
            const number = hundreds * 100 + remainder;
            
            let rounded;
            if (remainder < 50) {
                rounded = hundreds * 100;
            } else {
                rounded = (hundreds + 1) * 100;
            }
            
            const lower = hundreds * 100;
            const upper = (hundreds + 1) * 100;
            const midpoint = lower + 50;
            
            const hint = 'Number line: ' + number + ' is between ' + lower + ' and ' + upper + '. ' +
                'Midpoint is ' + midpoint + '. ' +
                (remainder < 50 
                    ? number + ' < ' + midpoint + ', so round down to ' + rounded + '.'
                    : number + ' \u2265 ' + midpoint + ', so round up to ' + rounded + '.');
            
            return numeric(
                'Round ' + number + ' to the nearest hundred.',
                rounded,
                100,
                hint,
                number + ' rounds to ' + rounded,
                0
            );
        } else {
            // Round to nearest ten (2-digit or 3-digit)
            const use3Digit = chance(0.4);
            let number;
            
            if (use3Digit) {
                number = between(100, 999);
            } else {
                number = between(10, 99);
            }
            
            const tens = Math.floor(number / 10);
            const ones = number % 10;
            
            let rounded;
            if (ones < 5) {
                rounded = tens * 10;
            } else {
                rounded = (tens + 1) * 10;
            }
            
            const lower = tens * 10;
            const upper = (tens + 1) * 10;
            const midpoint = lower + 5;
            
            const hint = 'Number line: ' + number + ' is between ' + lower + ' and ' + upper + '. ' +
                'Midpoint is ' + midpoint + '. ' +
                (ones < 5
                    ? number + ' < ' + midpoint + ', so round down to ' + rounded + '.'
                    : number + ' \u2265 ' + midpoint + ', so round up to ' + rounded + '.');
            
            return numeric(
                'Round ' + number + ' to the nearest ten.',
                rounded,
                10,
                hint,
                number + ' rounds to ' + rounded,
                0
            );
        }
    }
};

// ============================================================================
// Pack Registry
// ============================================================================
const PACKS = {
    'add-subtract-units': addSubtractUnitsPack,
    'multiplication': multiplicationPack,
    'division': divisionPack,
    'similar-figures': similarFiguresPack,
    'simplifying-strategy': simplifyingStrategyPack,
    'benchmark-numbers': benchmarkNumbersPack,
    'number-bond-arrow': numberBondArrowPack,
    'rounding': roundingPack
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
