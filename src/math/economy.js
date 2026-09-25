// Coin rules for Math Stops. Documented in NOTES.md ("Coins, hints and
// penalties") - keep the two in sync.
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

export function signed(n) {
    return (n > 0 ? '+' : n < 0 ? '\u2212' : '') + Math.abs(n);
}
