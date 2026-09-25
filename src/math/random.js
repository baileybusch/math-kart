// Tiny random helpers so the math code has no Phaser dependency and can be
// unit-tested in plain Node.

export function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function pick(list) {
    return list[Math.floor(Math.random() * list.length)];
}

export function chance(p) {
    return Math.random() < p;
}

/** entries: [[value, weight], ...] */
export function weightedPick(entries) {
    let total = 0;
    entries.forEach((e) => { total += e[1]; });
    let roll = Math.random() * total;
    for (let i = 0; i < entries.length; i++) {
        roll -= entries[i][1];
        if (roll < 0) return entries[i][0];
    }
    return entries[entries.length - 1][0];
}

export function shuffle(list) {
    const out = list.slice();
    for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const t = out[i];
        out[i] = out[j];
        out[j] = t;
    }
    return out;
}
