import { pick } from './random.js';
import { getRandomProblem } from './mathPacks.js';

export const GRADES = [
    { id: 3, label: 'Grade 3', blurb: 'Add, subtract, units, \u00D7 \u00F7', packs: ['add-subtract-units', 'multiplication', 'division'] },
    { id: 7, label: 'Grade 7', blurb: 'Similar figures & ratios', packs: ['similar-figures'] }
];

export const DEFAULT_GRADE = 3;

export function isGrade(id) {
    return GRADES.some((g) => g.id === id);
}

export function getGrade(id) {
    for (let i = 0; i < GRADES.length; i++) {
        if (GRADES[i].id === id) return GRADES[i];
    }
    return GRADES[0];
}

export function getProblemForGrade(id) {
    const grade = getGrade(id);
    const problem = getRandomProblem(pick(grade.packs));
    problem.grade = grade.id;
    return problem;
}
