// Math Stop coin economy (same for every grade). Coins never go below 0.
//
//   right, no hint   +6
//   right, with hint +3   (half, rounded up)
//   wrong, with hint -4   (half the no-hint penalty)
//   wrong, no hint   -8   (was -2; guessing should hurt)
//
// Guessing loses coins on average even on YES/NO questions, and using a hint
// always beats guessing blind.
export const COINS = {
    right: 6,
    rightWithHint: 3,
    wrongWithHint: 4,
    wrong: 8
};

export function coinDelta(correct, hintUsed) {
    if (correct) return hintUsed ? COINS.rightWithHint : COINS.right;
    return -(hintUsed ? COINS.wrongWithHint : COINS.wrong);
}

export function applyCoins(coins, delta) {
    return Math.max(0, coins + delta);
}

export function formatDelta(delta) {
    return (delta >= 0 ? '+' : '\u2212') + Math.abs(delta);
}
