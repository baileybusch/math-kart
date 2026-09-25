import Phaser from 'phaser';

// Fixed design resolution. Every scene lays out against this size and
// Phaser's FIT scaler stretches it to the screen. 4:3 matches the iPad mini.
export const GAME_WIDTH = 1024;
export const GAME_HEIGHT = 768;

// System fonts only (works offline). "Arial Rounded MT Bold" and
// "Chalkboard SE" both ship with iOS 12.
export const FONT = '"Arial Rounded MT Bold", "Chalkboard SE", "Comic Sans MS", "Trebuchet MS", Arial, sans-serif';

export const COLORS = {
    ink: 0x1d2b53,
    white: 0xffffff,
    sky: 0x3fb4f0,
    skyLight: 0x8fd8ff,
    grass: 0x5cc85c,
    grassDark: 0x3d9c3d,
    yellow: 0xffd43b,
    gold: 0xfab005,
    orange: 0xff922b,
    red: 0xff4757,
    green: 0x2fb344,
    greenLight: 0x51cf66,
    blue: 0x339af0,
    purple: 0x845ef7,
    pink: 0xf06595,
    gray: 0xadb5bd,
    grayDark: 0x868e96
};

export const INK = '#1d2b53';

export const KART_COLORS = {
    red: { value: 0xff4757, label: 'Red' },
    blue: { value: 0x339af0, label: 'Blue' },
    green: { value: 0x51cf66, label: 'Green' },
    yellow: { value: 0xffd43b, label: 'Yellow' },
    purple: { value: 0xcc5de8, label: 'Purple' }
};

export function kartColor(name) {
    return (KART_COLORS[name] || KART_COLORS.red).value;
}

export function textStyle(size, color, extra) {
    return Object.assign({
        fontFamily: FONT,
        fontSize: size + 'px',
        fontStyle: 'bold',
        color: color || INK,
        align: 'center'
    }, extra || {});
}

/** Big outlined "sticker" text that reads well on any background. */
export function addTitle(scene, x, y, text, size, color) {
    const t = scene.add.text(x, y, text, textStyle(size, color || '#ffd43b', {
        stroke: INK,
        strokeThickness: Math.max(6, Math.round(size / 7))
    })).setOrigin(0.5);
    t.setShadow(0, Math.round(size / 12), 'rgba(0,0,0,0.25)', 0, true, true);
    return t;
}

export function drawPanel(graphics, x, y, width, height, fill, radius) {
    const r = radius === undefined ? 24 : radius;
    graphics.fillStyle(COLORS.ink, 1);
    graphics.fillRoundedRect(x, y + 8, width, height, r);
    graphics.fillStyle(fill, 1);
    graphics.fillRoundedRect(x, y, width, height, r);
    graphics.lineStyle(5, COLORS.ink, 1);
    graphics.strokeRoundedRect(x, y, width, height, r);
}

export function drawCoin(graphics, x, y, radius) {
    graphics.fillStyle(0xe67700, 1);
    graphics.fillCircle(x, y + radius * 0.12, radius);
    graphics.fillStyle(COLORS.yellow, 1);
    graphics.fillCircle(x, y, radius);
    graphics.lineStyle(Math.max(2, radius * 0.16), 0xe67700, 1);
    graphics.strokeCircle(x, y, radius * 0.62);
}

/** Rounded coin counter pill. Returns { container, setValue }. */
export function createCoinPill(scene, x, y, value) {
    const container = scene.add.container(x, y);
    const g = scene.add.graphics();
    g.fillStyle(COLORS.ink, 0.9);
    g.fillRoundedRect(-95, -32, 190, 64, 32);
    g.lineStyle(4, COLORS.white, 1);
    g.strokeRoundedRect(-95, -32, 190, 64, 32);
    drawCoin(g, -58, 0, 21);
    const text = scene.add.text(18, 0, String(value), textStyle(34, '#ffd43b')).setOrigin(0.5);
    container.add([g, text]);
    return {
        container,
        setValue(v) { text.setText(String(v)); }
    };
}

/**
 * Chunky, kid-sized button. Fires onTap on release (so a finger that slides
 * off cancels). Returns the container; call .setEnabled(false) to grey it out.
 */
export function createButton(scene, x, y, opts) {
    const width = opts.width || 300;
    const height = opts.height || 96;
    const radius = opts.radius === undefined ? Math.min(28, height / 2) : opts.radius;
    let color = opts.color === undefined ? COLORS.green : opts.color;
    const container = scene.add.container(x, y);
    const g = scene.add.graphics();
    const label = scene.add.text(0, -3, opts.label || '', textStyle(opts.fontSize || 38, opts.textColor || '#ffffff', {
        stroke: INK,
        strokeThickness: opts.strokeThickness === undefined ? 6 : opts.strokeThickness,
        wordWrap: { width: width - 24 }
    })).setOrigin(0.5);
    const hit = scene.add.rectangle(0, 0, width, height + 8);
    let enabled = opts.enabled !== false;
    let pressed = false;

    function paint(down) {
        const fill = enabled ? color : COLORS.gray;
        const lift = down ? 2 : 8;
        g.clear();
        g.fillStyle(COLORS.ink, 1);
        g.fillRoundedRect(-width / 2, -height / 2 + 8, width, height, radius);
        g.fillStyle(fill, 1);
        g.fillRoundedRect(-width / 2, -height / 2 + (8 - lift), width, height, radius);
        g.fillStyle(0xffffff, enabled ? 0.28 : 0.15);
        g.fillRoundedRect(-width / 2 + 10, -height / 2 + (8 - lift) + 6, width - 20, Math.max(8, height * 0.22), Math.min(12, radius));
        g.lineStyle(5, COLORS.ink, 1);
        g.strokeRoundedRect(-width / 2, -height / 2 + (8 - lift), width, height, radius);
        label.y = -3 + (8 - lift);
        label.setAlpha(enabled ? 1 : 0.75);
    }

    hit.setInteractive({ useHandCursor: true });
    hit.on('pointerdown', () => {
        if (!enabled) return;
        pressed = true;
        paint(true);
    });
    hit.on('pointerout', () => {
        pressed = false;
        paint(false);
    });
    hit.on('pointerup', () => {
        const wasPressed = pressed;
        pressed = false;
        paint(false);
        if (enabled && wasPressed && opts.onTap) opts.onTap();
    });

    container.add([g, label, hit]);
    container.setSize(width, height);
    container.label = label;
    container.setEnabled = (value) => {
        enabled = value;
        paint(false);
        return container;
    };
    container.setLabel = (text) => {
        label.setText(text);
        return container;
    };
    container.setColor = (value) => {
        color = value;
        paint(false);
        return container;
    };
    // Ignore taps without greying the button out (e.g. after answering).
    container.setLocked = (locked) => {
        if (locked) hit.disableInteractive();
        else hit.setInteractive({ useHandCursor: true });
        return container;
    };
    paint(false);
    return container;
}

/** Solid-colour sky + rolling hills backdrop used by menu screens. */
export function drawMenuBackdrop(scene) {
    const g = scene.add.graphics();
    g.fillStyle(COLORS.sky, 1);
    g.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    g.fillStyle(COLORS.skyLight, 1);
    g.fillRect(0, GAME_HEIGHT * 0.45, GAME_WIDTH, GAME_HEIGHT * 0.2);

    g.fillStyle(0xffffff, 0.9);
    [[140, 110, 1], [860, 80, 0.8], [620, 170, 0.6]].forEach(([cx, cy, s]) => {
        g.fillCircle(cx, cy, 34 * s);
        g.fillCircle(cx + 38 * s, cy - 14 * s, 42 * s);
        g.fillCircle(cx + 80 * s, cy, 32 * s);
        g.fillRect(cx, cy, 80 * s, 30 * s);
    });

    g.fillStyle(COLORS.grassDark, 1);
    g.fillCircle(150, GAME_HEIGHT + 120, 330);
    g.fillCircle(880, GAME_HEIGHT + 140, 360);
    g.fillStyle(COLORS.grass, 1);
    g.fillCircle(520, GAME_HEIGHT + 260, 420);
    g.fillRect(0, GAME_HEIGHT - 110, GAME_WIDTH, 110);
    return g;
}

/** Draw a top-down kart centred on (0,0), nose pointing up (-y). */
export function drawKart(graphics, color) {
    const g = graphics;
    g.clear();
    g.fillStyle(0x000000, 0.2);
    g.fillEllipse(3, 5, 50, 70);
    g.fillStyle(0x212529, 1);
    g.fillRoundedRect(-25, -26, 12, 18, 4);
    g.fillRoundedRect(13, -26, 12, 18, 4);
    g.fillRoundedRect(-26, 10, 13, 20, 4);
    g.fillRoundedRect(13, 10, 13, 20, 4);
    g.fillStyle(color, 1);
    g.fillRoundedRect(-17, -32, 34, 64, 12);
    g.lineStyle(3, COLORS.ink, 1);
    g.strokeRoundedRect(-17, -32, 34, 64, 12);
    g.fillStyle(0xffffff, 0.85);
    g.fillRect(-4, -30, 8, 22);
    g.fillStyle(COLORS.ink, 1);
    g.fillCircle(0, 6, 11);
    g.fillStyle(0xffffff, 1);
    g.fillCircle(0, 4, 8);
    g.fillStyle(color, 1);
    g.fillCircle(0, 4, 5);
    return g;
}

export function ordinal(n) {
    const j = n % 10;
    const k = n % 100;
    if (j === 1 && k !== 11) return n + 'st';
    if (j === 2 && k !== 12) return n + 'nd';
    if (j === 3 && k !== 13) return n + 'rd';
    return n + 'th';
}

export function fadeToScene(scene, key, data) {
    const cam = scene.cameras.main;
    if (scene.__leaving) return;
    scene.__leaving = true;
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => { scene.__leaving = false; });
    cam.fadeOut(180, 0, 0, 0);
    cam.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
        scene.scene.start(key, data);
    });
}
