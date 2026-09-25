/**
 * Math Problem Pack System
 * 
 * Each pack exports:
 * - id: unique identifier
 * - name: display name
 * - difficulty: base difficulty (1-5)
 * - coinMultiplier: extra coins for harder packs
 * - generateProblem(): returns { question, answer, choices[] }
 */

// ============================================================================
// PACK: Addition & Subtraction with Units
// ============================================================================
const addSubtractUnitsPack = {
    id: 'add-subtract-units',
    name: 'Add & Subtract (with units)',
    difficulty: 1,
    coinMultiplier: 1.0,
    
    generateProblem() {
        const types = [
            'simple-add',
            'simple-subtract',
            'ml-liters',
            'grams-kg',
            'meters-cm'
        ];
        
        const type = Phaser.Math.RND.pick(types);
        
        switch (type) {
            case 'simple-add':
                return this.generateSimpleAddition();
            case 'simple-subtract':
                return this.generateSimpleSubtraction();
            case 'ml-liters':
                return this.generateMLLiters();
            case 'grams-kg':
                return this.generateGramsKg();
            case 'meters-cm':
                return this.generateMetersCm();
        }
    },
    
    generateSimpleAddition() {
        const a = Phaser.Math.Between(10, 99);
        const b = Phaser.Math.Between(10, 99);
        const answer = a + b;
        
        return {
            question: `${a} + ${b} = ?`,
            answer: answer.toString(),
            choices: this.generateChoices(answer, 10)
        };
    },
    
    generateSimpleSubtraction() {
        const a = Phaser.Math.Between(50, 199);
        const b = Phaser.Math.Between(10, a - 10);
        const answer = a - b;
        
        return {
            question: `${a} - ${b} = ?`,
            answer: answer.toString(),
            choices: this.generateChoices(answer, 10)
        };
    },
    
    generateMLLiters() {
        // Convert mL to L or add mL amounts
        const choice = Phaser.Math.Between(0, 1);
        
        if (choice === 0) {
            // Simple conversion: X mL = ? L
            const ml = Phaser.Math.Between(1, 9) * 1000;
            const liters = ml / 1000;
            
            return {
                question: `${ml} mL = ? L`,
                answer: liters.toString(),
                choices: this.generateChoices(liters, 1)
            };
        } else {
            // Addition: X mL + Y mL = ? mL
            const a = Phaser.Math.Between(100, 500);
            const b = Phaser.Math.Between(100, 500);
            const answer = a + b;
            
            return {
                question: `${a} mL + ${b} mL = ? mL`,
                answer: answer.toString(),
                choices: this.generateChoices(answer, 50)
            };
        }
    },
    
    generateGramsKg() {
        const choice = Phaser.Math.Between(0, 1);
        
        if (choice === 0) {
            // Simple conversion: X g = ? kg
            const grams = Phaser.Math.Between(1, 5) * 1000;
            const kg = grams / 1000;
            
            return {
                question: `${grams} g = ? kg`,
                answer: kg.toString(),
                choices: this.generateChoices(kg, 1)
            };
        } else {
            // Addition in grams
            const a = Phaser.Math.Between(100, 999);
            const b = Phaser.Math.Between(100, 999);
            const answer = a + b;
            
            return {
                question: `${a} g + ${b} g = ? g`,
                answer: answer.toString(),
                choices: this.generateChoices(answer, 100)
            };
        }
    },
    
    generateMetersCm() {
        // Meters to cm or addition
        const choice = Phaser.Math.Between(0, 1);
        
        if (choice === 0) {
            // Simple conversion: X m = ? cm
            const meters = Phaser.Math.Between(1, 9);
            const cm = meters * 100;
            
            return {
                question: `${meters} m = ? cm`,
                answer: cm.toString(),
                choices: this.generateChoices(cm, 100)
            };
        } else {
            // Addition in cm
            const a = Phaser.Math.Between(10, 99);
            const b = Phaser.Math.Between(10, 99);
            const answer = a + b;
            
            return {
                question: `${a} cm + ${b} cm = ? cm`,
                answer: answer.toString(),
                choices: this.generateChoices(answer, 10)
            };
        }
    },
    
    generateChoices(correctAnswer, spread) {
        const choices = [correctAnswer.toString()];
        
        while (choices.length < 3) {
            const offset = Phaser.Math.Between(-spread, spread);
            if (offset === 0) continue;
            
            const wrong = Math.max(0, correctAnswer + offset);
            const wrongStr = wrong.toString();
            
            if (!choices.includes(wrongStr)) {
                choices.push(wrongStr);
            }
        }
        
        return Phaser.Utils.Array.Shuffle(choices);
    }
};

// ============================================================================
// PACK: Multiplication (Beginner - Early 3rd Grade)
// ============================================================================
const multiplicationPack = {
    id: 'multiplication',
    name: 'Multiplication Facts',
    difficulty: 2,
    coinMultiplier: 1.3,
    
    generateProblem() {
        const types = [
            'basic-facts',
            'by-2',
            'by-5',
            'by-10'
        ];
        
        const type = Phaser.Math.RND.pick(types);
        
        switch (type) {
            case 'basic-facts':
                return this.generateBasicFacts();
            case 'by-2':
                return this.generateMultiplyBy(2);
            case 'by-5':
                return this.generateMultiplyBy(5);
            case 'by-10':
                return this.generateMultiplyBy(10);
        }
    },
    
    generateBasicFacts() {
        // Focus on 2-5 times tables for beginners
        const a = Phaser.Math.Between(2, 5);
        const b = Phaser.Math.Between(2, 10);
        const answer = a * b;
        
        return {
            question: `${a} × ${b} = ?`,
            answer: answer.toString(),
            choices: this.generateChoices(answer, 5)
        };
    },
    
    generateMultiplyBy(multiplier) {
        const other = Phaser.Math.Between(2, 10);
        const answer = multiplier * other;
        
        return {
            question: `${multiplier} × ${other} = ?`,
            answer: answer.toString(),
            choices: this.generateChoices(answer, multiplier)
        };
    },
    
    generateChoices(correctAnswer, spread) {
        const choices = [correctAnswer.toString()];
        
        while (choices.length < 3) {
            const offset = Phaser.Math.Between(-spread, spread);
            if (offset === 0) continue;
            
            const wrong = Math.max(1, correctAnswer + offset);
            const wrongStr = wrong.toString();
            
            if (!choices.includes(wrongStr)) {
                choices.push(wrongStr);
            }
        }
        
        return Phaser.Utils.Array.Shuffle(choices);
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
        const types = [
            'basic-facts',
            'by-2',
            'by-5',
            'by-10'
        ];
        
        const type = Phaser.Math.RND.pick(types);
        
        switch (type) {
            case 'basic-facts':
                return this.generateBasicFacts();
            case 'by-2':
                return this.generateDivideBy(2);
            case 'by-5':
                return this.generateDivideBy(5);
            case 'by-10':
                return this.generateDivideBy(10);
        }
    },
    
    generateBasicFacts() {
        // Simple division with numbers 2-5
        const divisor = Phaser.Math.Between(2, 5);
        const quotient = Phaser.Math.Between(2, 10);
        const dividend = divisor * quotient;
        
        return {
            question: `${dividend} ÷ ${divisor} = ?`,
            answer: quotient.toString(),
            choices: this.generateChoices(quotient, 3)
        };
    },
    
    generateDivideBy(divisor) {
        const quotient = Phaser.Math.Between(2, 10);
        const dividend = divisor * quotient;
        
        return {
            question: `${dividend} ÷ ${divisor} = ?`,
            answer: quotient.toString(),
            choices: this.generateChoices(quotient, 2)
        };
    },
    
    generateChoices(correctAnswer, spread) {
        const choices = [correctAnswer.toString()];
        
        while (choices.length < 3) {
            const offset = Phaser.Math.Between(-spread, spread);
            if (offset === 0) continue;
            
            const wrong = Math.max(1, correctAnswer + offset);
            const wrongStr = wrong.toString();
            
            if (!choices.includes(wrongStr)) {
                choices.push(wrongStr);
            }
        }
        
        return Phaser.Utils.Array.Shuffle(choices);
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
        console.error(`Math pack "${packId}" not found!`);
        return {
            question: '1 + 1 = ?',
            answer: '2',
            choices: ['1', '2', '3']
        };
    }
    
    return pack.generateProblem();
}

/**
 * Get all available packs
 */
export function getAllPacks() {
    return Object.values(PACKS);
}

/**
 * Get pack by ID
 */
export function getPack(packId) {
    return PACKS[packId];
}
