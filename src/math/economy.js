// Coin rules for Math Stops and the mistake review. Documented in NOTES.md
// ("Coins, hints and penalties", "Review mistakes") - keep them in sync.
//
//   right, no hint   +N
//   right, with hint +ceil(N/2)
//   wrong, with hint -ceil(N/2)
//   wrong, no hint   -N        (the worst outcome: a flat guess)
const BASE_REWARD = { 3: 6, 7: 10 };

export function baseReward(grade) {
    return BASE_REWARD[grade] || BASE_REWARD[3];
}

export function coinRules(grade) {
    const n = baseReward(grade);
    const half = Math.ceil(n / 2);
    return { right: n, hintRight: half, hintWrong: -half, wrong: -n };
}

export function coinDelta(grade, correct, hintUsed) {
    const r = coinRules(grade);
    if (correct) return hintUsed ? r.hintRight : r.right;
    return hintUsed ? r.hintWrong : r.wrong;
}

// Reviewing mistakes after a finished race pays ceil(N/2) per mistake (the
// same as a right answer with a hint): +3 each in Grade 3, +5 in Grade 7.
// A miss (-N) plus its review (+N/2) is still a loss, so missing on purpose
// never pays, and a perfect race always earns the most.
export function reviewBonusPerMistake(grade) {
    return Math.ceil(baseReward(grade) / 2);
}

export function reviewBonus(grade, mistakes) {
    return Math.max(0, mistakes) * reviewBonusPerMistake(grade);
}

export function signed(n) {
    return (n > 0 ? '+' : n < 0 ? '\u2212' : '') + Math.abs(n);
}
