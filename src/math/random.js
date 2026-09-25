// Small RNG helpers so the math modules don't depend on Phaser (and can be
// unit-tested in plain Node).

export function between(min, max) {
    return min + Math.floor(Math.random() * (max - min + 1));
}

export function pick(list) {
    return list[Math.floor(Math.random() * list.length)];
}

export function chance(p) {
    return Math.random() < p;
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

/** Pick from [[weight, value], ...]. */
export function weighted(entries) {
    let total = 0;
    entries.forEach((e) => { total += e[0]; });
    let r = Math.random() * total;
    for (let i = 0; i < entries.length; i++) {
        r -= entries[i][0];
        if (r < 0) return entries[i][1];
    }
    return entries[entries.length - 1][1];
}
