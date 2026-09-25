#!/usr/bin/env node
/**
 * Headless-browser smoke test of the BUILT game (dist/).
 *
 * Real iOS 12 Safari can't run in CI, so the syntax side is covered by
 * check-legacy-bundle.mjs. This script covers runtime behaviour:
 *   - "iPad mini / iOS 12" profile: iPad iOS 12 user agent, 1024x768 touch
 *     screen, WebGL disabled and post-iOS-12 APIs deleted. Boots on Canvas,
 *     picks Grade 7, taps START RACE, drives with two fingers, answers math
 *     stops (typed, hint, whiteboard), finishes the race, and unlocks the
 *     track ladder in the shop.
 *   - Every track (same profile): star 1 opens a Math Stop, water slows the
 *     kart but the bridge doesn't, ramps launch it, the finish pays that
 *     track's prize.
 *   - Phone landscape: whole game is visible (it used to be cut off).
 *   - Desktop: boots on WebGL; Grade 3, keyboard answer, mouse whiteboard.
 *   - Broken or missing bundle: the "couldn't start" banner appears.
 *
 * Env: CHROME_PATH=/path/to/chrome, SMOKE_SCREENSHOTS=/dir (optional).
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const BASE = '/math-kart/';
const GAME_W = 1024;
const GAME_H = 768;
const shotDir = process.env.SMOKE_SCREENSHOTS || '';

const IPAD_IOS12_UA = 'Mozilla/5.0 (iPad; CPU OS 12_5_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/12.1.2 Mobile/15E148 Safari/604.1';

// Approximates iOS 12 Safari: no WebGL, and APIs that arrived later are gone.
const IOS12_SHIM = `(() => {
  const getContext = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (type) {
    if (/webgl/i.test(type)) return null;
    return getContext.apply(this, arguments);
  };
  ['ResizeObserver', 'PointerEvent', 'queueMicrotask', 'structuredClone',
   'IntersectionObserver', 'OffscreenCanvas', 'createImageBitmap', 'BigInt'].forEach((k) => {
    try { delete window[k]; } catch (e) {}
    try { Object.defineProperty(window, k, { value: undefined, configurable: true, writable: true }); } catch (e) {}
  });
  try { delete Object.fromEntries; } catch (e) {}
  try { delete Array.prototype.at; } catch (e) {}
  try { delete String.prototype.replaceAll; } catch (e) {}
  try { delete Promise.allSettled; } catch (e) {}
})();`;

const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json' };

function serve() {
    const server = http.createServer((req, res) => {
        const url = decodeURIComponent(req.url.split('?')[0]);
        if (!url.startsWith(BASE)) {
            res.writeHead(302, { Location: BASE });
            res.end();
            return;
        }
        let file = path.join(dist, url.slice(BASE.length));
        if (!file.startsWith(dist)) { res.writeHead(403); res.end(); return; }
        if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
        if (!fs.existsSync(file)) { res.writeHead(404); res.end('not found'); return; }
        res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
        fs.createReadStream(file).pipe(res);
    });
    return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

function findChrome() {
    const candidates = [
        process.env.CHROME_PATH,
        '/usr/bin/google-chrome',
        '/usr/local/bin/google-chrome',
        '/usr/bin/google-chrome-stable',
        '/usr/bin/chromium',
        '/usr/bin/chromium-browser',
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
    ].filter(Boolean);
    return candidates.find((p) => fs.existsSync(p)) || null;
}

let failures = 0;
function check(cond, msg) {
    if (cond) {
        console.log('    ok   ' + msg);
    } else {
        failures++;
        console.log('    FAIL ' + msg);
    }
    return cond;
}

async function shot(page, name) {
    if (!shotDir) return;
    fs.mkdirSync(shotDir, { recursive: true });
    await page.screenshot({ path: path.join(shotDir, name + '.png') });
}

async function waitForBoot(page, timeout) {
    await page.waitForFunction(() => window.__mathKartBooted === true || !!window.__mathKartBootError, null, { timeout: timeout || 30000 });
    return page.evaluate(() => ({
        booted: window.__mathKartBooted === true,
        error: window.__mathKartBootError || null,
        renderer: window.mathKart && window.mathKart.renderer,
        reason: window.mathKart && window.mathKart.rendererReason
    }));
}

async function toClient(page, gx, gy) {
    const box = await page.locator('#game-container canvas').boundingBox();
    return { x: box.x + (gx / GAME_W) * box.width, y: box.y + (gy / GAME_H) * box.height, box };
}

async function tapGame(page, gx, gy) {
    const p = await toClient(page, gx, gy);
    await page.touchscreen.tap(p.x, p.y);
}

const activeScenes = (page) => page.evaluate(() =>
    window.mathKart.game.scene.getScenes(true).map((s) => s.sys.settings.key));

const race = (page, fn) => page.evaluate(fn);

// Game-space positions (see MENU_LAYOUT in MenuScene.js and MATH_LAYOUT in
// ui/mathStop.js).
const MENU = { grade3: [342, 214], grade7: [682, 214], start: [512, 612], shop: [512, 714], cards: [128, 320, 512, 704, 896], cardsY: 404 };
// ShopScene.createTracks: 4 tiles 218 wide spread across a 944-wide panel at x=40.
const SHOP_TRACK_XS = [0, 1, 2, 3].map((i) => 40 + 14.4 + i * (218 + 14.4) + 109);
const SHOP_TRACK_BUTTON_Y = 484 + 226;
const COURSES = [
    { id: 'forest', prizes: [50, 30, 15] }, { id: 'desert', prizes: [60, 35, 20] }, { id: 'pine', prizes: [70, 40, 20] },
    { id: 'snow', prizes: [80, 45, 25] }, { id: 'city', prizes: [90, 50, 30] }
];
const MATH = {
    hint: [174, 630], whiteboard: [454, 630], keepRacing: [314, 630],
    choiceX: 796, choiceRows2: [260, 420], choiceRows3: [222, 342, 462],
    keys: {
        '7': [652, 292], '8': [748, 292], '9': [844, 292], del: [940, 292],
        '4': [652, 376], '5': [748, 376], '6': [844, 376], '/': [940, 376],
        '1': [652, 460], '2': [748, 460], '3': [844, 460], '.': [940, 460],
        '0': [652, 544], check: [844, 544]
    }
};
// Coin table from src/math/economy.js.
const COINS = { 3: { right: 6, hintRight: 3, hintWrong: -3, wrong: -6 }, 7: { right: 10, hintRight: 5, hintWrong: -5, wrong: -10 } };
const WATER_SPEED = 0.4;

const mathState = (page) => page.evaluate(() => {
    const m = window.mathKart.game.scene.getScene('RaceHudScene').math;
    if (!m) return null;
    return {
        question: m.problem.question, answer: m.problem.answer, mode: m.problem.mode, choices: m.problem.choices || null,
        grade: m.problem.grade, kind: m.problem.kind || m.problem.packId, typed: m.typed, hintUsed: m.hintUsed,
        answered: m.answered, correct: m.correct, delta: m.delta, closed: m.closed, whiteboardOpens: m.whiteboardOpens
    };
});

const raceStats = (page) => race(page, () => {
    const r = window.mathKart.game.scene.getScene('RaceScene');
    return { coins: r.coins, asked: r.stats.asked, correct: r.stats.correct, hints: r.stats.hints };
});

async function openMathStop(page) {
    await race(page, () => window.mathKart.game.scene.getScene('RaceScene').showMathStop());
    await page.waitForFunction(() => {
        const hud = window.mathKart.game.scene.getScene('RaceHudScene');
        return hud.modalOpen && hud.math && !hud.math.closed;
    }, null, { timeout: 5000 });
    await page.waitForTimeout(250);
    return mathState(page);
}

async function keepRacing(page, tap) {
    await page.waitForTimeout(450);
    await tap(page, MATH.keepRacing[0], MATH.keepRacing[1]);
    await page.waitForFunction(() => window.mathKart.game.scene.getScene('RaceHudScene').modalOpen === false, null, { timeout: 3000 });
}

async function typeOnKeypad(page, text, tap) {
    for (const ch of text) {
        const k = MATH.keys[ch];
        await tap(page, k[0], k[1]);
        await page.waitForTimeout(40);
    }
}

function choicePos(state, choice) {
    const rows = state.choices.length === 2 ? MATH.choiceRows2 : MATH.choiceRows3;
    return [MATH.choiceX, rows[state.choices.indexOf(choice)]];
}

/** Opens Math Stops (answering the others correctly) until a typed one shows up. */
async function nextTypedStop(page, tap) {
    for (let i = 0; i < 15; i++) {
        const s = await openMathStop(page);
        if (s.mode === 'typed') return s;
        const p = choicePos(s, s.answer);
        await tap(page, p[0], p[1]);
        await keepRacing(page, tap);
    }
    throw new Error('no typed Math Stop after 15 tries');
}

const findHudText = (page, needle) => page.evaluate((needle) => {
    const hud = window.mathKart.game.scene.getScene('RaceHudScene');
    const walk = (list) => {
        for (const o of list) {
            if (o.type === 'Text' && o.text.indexOf(needle) !== -1) return o.text;
            if (o.list) { const t = walk(o.list); if (t) return t; }
        }
        return null;
    };
    return walk(hud.children.list);
}, needle);

const inkPixels = (page) => page.evaluate(() => {
    const c = document.getElementById('mk-wb-canvas');
    const data = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let i = 3; i < data.length; i += 4) if (data[i] > 0) n++;
    return n;
});

/** Water slows the kart, the bridge doesn't, ramps launch it. */
async function trackFeatures(page, id) {
    const f = await race(page, () => {
        const f = window.mathKart.game.scene.getScene('RaceScene').track.features;
        const mid = f.bridge ? f.bridge.deck[Math.floor(f.bridge.deck.length / 2)] : null;
        return {
            river: f.river ? { x: f.river.cx, y: f.river.cy, dirX: f.river.dirX, dirY: f.river.dirY } : null,
            deck: mid ? { x: mid.x, y: mid.y } : null,
            ramps: f.ramps.map((r) => ({ kind: r.kind, x: r.x, y: r.y, dirX: r.dirX, dirY: r.dirY }))
        };
    });
    const put = (x, y, dirX, dirY, speed) => page.evaluate(([x, y, dirX, dirY, speed]) => {
        const p = window.mathKart.game.scene.getScene('RaceScene').player;
        p.x = x; p.y = y; p.rotation = Math.atan2(dirX, -dirY); p.speed = speed === null ? p.maxSpeed : speed;
        p.segHint = undefined; p.air = 0; p.boost = 0;
    }, [x, y, dirX, dirY, speed]);
    const player = () => race(page, () => {
        const p = window.mathKart.game.scene.getScene('RaceScene').player;
        return { speed: p.speed, max: p.maxSpeed, inWater: !!p.inWater, onBridge: !!p.onBridge, offRoad: p.offRoad, air: p.air, jumps: p.jumps || 0, splashes: p.splashes || 0, scale: p.scaleX };
    });
    await page.keyboard.down('ArrowUp');
    try {
        if (f.river) {
            await put(f.river.x - f.river.dirX * 60, f.river.y - f.river.dirY * 60, f.river.dirX, f.river.dirY, null);
            await page.waitForTimeout(350);
            const wet = await player();
            await shot(page, 'feature-' + id + '-ford');
            check(wet.inWater && wet.speed <= wet.max * WATER_SPEED + 1 && wet.splashes >= 1, id + ': driving into the ford slows the kart to ' + Math.round(wet.speed) + ' (top speed ' + wet.max + ')');
            const d = f.deck;
            await put(d.x - f.river.dirX * 50, d.y - f.river.dirY * 50, f.river.dirX, f.river.dirY, null);
            await page.waitForTimeout(180);
            const dry = await player();
            await shot(page, 'feature-' + id + '-bridge');
            check(dry.onBridge && !dry.inWater && !dry.offRoad && dry.speed >= dry.max * 0.9, id + ': on the bridge there is no slow-down (' + Math.round(dry.speed) + ')');
        }
        if (f.ramps.length) {
            const r = f.ramps.find((x) => x.kind === 'jump') || f.ramps[0];
            const before = (await player()).jumps;
            await put(r.x - r.dirX * 150, r.y - r.dirY * 150, r.dirX, r.dirY, null);
            await page.waitForFunction((n) => (window.mathKart.game.scene.getScene('RaceScene').player.jumps || 0) > n, before, { timeout: 3000 });
            await page.waitForTimeout(r.kind === 'jump' ? 200 : 80);
            const up = await player();
            await shot(page, 'feature-' + id + '-' + r.kind);
            check(up.jumps > before && (up.air > 0 || up.speed > up.max), id + ': the ' + r.kind + ' launches the kart (air ' + up.air.toFixed(2) + ' s, speed ' + Math.round(up.speed) + ' of ' + up.max + ', scale ' + up.scale.toFixed(2) + ')');
        }
    } finally {
        await page.keyboard.up('ArrowUp');
    }
}

async function ipadIos12(browser, baseUrl) {
    console.log('\n[iPad mini / iOS 12 profile]');
    const context = await browser.newContext({
        viewport: { width: 1024, height: 768 },
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true,
        userAgent: IPAD_IOS12_UA
    });
    await context.addInitScript(IOS12_SHIM);
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));

    await page.goto(baseUrl, { waitUntil: 'load' });
    const boot = await waitForBoot(page);
    check(boot.booted && !boot.error, 'game booted (' + JSON.stringify(boot.error || 'no boot error') + ')');
    check(boot.renderer === 'canvas', 'Canvas renderer on old iOS (got ' + boot.renderer + ', ' + boot.reason + ')');
    check(await page.locator('#mk-loading').evaluate((n) => getComputedStyle(n).display === 'none'), 'loading overlay hidden');
    const box = (await toClient(page, 0, 0)).box;
    check(box.width >= 1000 && box.height >= 740, 'canvas fills the iPad screen (' + Math.round(box.width) + 'x' + Math.round(box.height) + ')');
    check((await activeScenes(page)).includes('MenuScene'), 'menu is showing');
    await page.waitForTimeout(400);
    await shot(page, 'ipad-01-menu');

    await tapGame(page, MENU.grade7[0], MENU.grade7[1]);
    await page.waitForTimeout(250);
    const gradeSave = await page.evaluate(() => JSON.parse(localStorage.getItem('mathKartSave')));
    check(gradeSave && gradeSave.grade === 7, 'tapping Grade 7 selects and saves it (grade=' + (gradeSave && gradeSave.grade) + ')');
    await shot(page, 'ipad-01b-grade7');

    await tapGame(page, MENU.start[0], MENU.start[1]);
    await page.waitForFunction(() => {
        const hud = window.mathKart.game.scene.getScene('RaceHudScene');
        return hud && hud.sys.isActive() && hud.race && hud.race.raceStarted;
    }, null, { timeout: 10000 });
    check(true, 'START RACE tap opened the race and the countdown finished');
    await shot(page, 'ipad-02-race-start');

    // Two fingers at once (GO + steer right), then lift only the steering
    // finger. Synthetic TouchEvents are used because CDP touch emulation
    // can't release a single finger.
    const go = await toClient(page, 922, 652);
    const right = await toClient(page, 272, 664);
    const startAlong = await race(page, () => window.mathKart.game.scene.getScene('RaceScene').player.along);
    const fingers = { go: { id: 11, x: go.x, y: go.y }, right: { id: 12, x: right.x, y: right.y } };
    const touch = (type, changed, held) => page.evaluate(([type, changed, held]) => {
        const canvas = document.querySelector('#game-container canvas');
        const mk = (f) => new Touch({ identifier: f.id, target: canvas, clientX: f.x, clientY: f.y, pageX: f.x, pageY: f.y });
        const heldTouches = held.map(mk);
        canvas.dispatchEvent(new TouchEvent(type, {
            changedTouches: changed.map(mk), touches: heldTouches, targetTouches: heldTouches,
            bubbles: true, cancelable: true
        }));
    }, [type, changed, held]);
    const hudControls = () => race(page, () => Object.assign({}, window.mathKart.game.scene.getScene('RaceHudScene').controls));

    await touch('touchstart', [fingers.go, fingers.right], [fingers.go, fingers.right]);
    await page.waitForTimeout(200);
    const controls = await hudControls();
    check(controls.forward && controls.right, 'GO and steering register together (' + JSON.stringify(controls) + ')');
    await touch('touchend', [fingers.right], [fingers.go]);
    await page.waitForTimeout(150);
    const goOnly = await hudControls();
    check(goOnly.forward && !goOnly.right, 'lifting one finger releases only that pedal (' + JSON.stringify(goOnly) + ')');
    await page.waitForTimeout(1200);
    await touch('touchend', [fingers.go], []);
    await page.waitForTimeout(100);
    const released = await hudControls();
    check(!released.forward && !released.right, 'all pedals released after lifting both fingers');
    const endAlong = await race(page, () => window.mathKart.game.scene.getScene('RaceScene').player.along);
    check(endAlong - startAlong > 100, 'kart drove forward (' + Math.round(startAlong) + ' -> ' + Math.round(endAlong) + ')');
    await shot(page, 'ipad-03-driving');

    await tapGame(page, 962, 46);
    await page.waitForFunction(() => window.mathKart.game.scene.getScene('RaceScene').isPaused === true, null, { timeout: 3000 });
    check(true, 'pause button pauses the race');
    await page.waitForTimeout(250);
    await shot(page, 'ipad-03b-paused');
    await tapGame(page, 512, 379);
    await page.waitForFunction(() => {
        const r = window.mathKart.game.scene.getScene('RaceScene');
        return r.isPaused === false && !r.hud.modalOpen;
    }, null, { timeout: 3000 });
    check(true, '"Keep Racing" resumes');

    // Jump to the first star to trigger a math stop.
    await race(page, () => {
        const r = window.mathKart.game.scene.getScene('RaceScene');
        const cp = r.track.checkpoints[0];
        r.player.x = cp.x; r.player.y = cp.y;
    });
    await page.waitForFunction(() => window.mathKart.game.scene.getScene('RaceHudScene').modalOpen === true, null, { timeout: 5000 });
    check(true, 'math stop opened at star 1');
    await page.waitForTimeout(350);
    await shot(page, 'ipad-04-math-stop');

    const first = await mathState(page);
    check(first && first.grade === 7, 'Grade 7 problem at the star (' + (first && first.kind) + ', ' + (first && first.mode) + ')');
    const coinsBefore = (await raceStats(page)).coins;
    if (first.mode === 'typed') {
        await typeOnKeypad(page, '1', tapGame);
        await tapGame(page, MATH.keys.check[0], MATH.keys.check[1]);
        await tapGame(page, MATH.keys.check[0], MATH.keys.check[1]);
    } else {
        const a = choicePos(first, first.choices[0]);
        const b = choicePos(first, first.choices[1]);
        await tapGame(page, a[0], a[1]);
        await tapGame(page, b[0], b[1]);
    }
    await page.waitForTimeout(400);
    await shot(page, 'ipad-05-answered');
    const after = await raceStats(page);
    check(after.asked === 1, 'exactly one answer counted even after tapping twice (asked=' + after.asked + ')');
    const expected = Math.max(0, coinsBefore + (after.correct ? COINS[7].right : COINS[7].wrong));
    check(after.coins === expected, (after.correct ? 'right' : 'wrong') + ' answer scored once (' + coinsBefore + ' -> ' + after.coins + ')');
    await keepRacing(page, tapGame);
    const resumed = await race(page, () => window.mathKart.game.scene.getScene('RaceScene').isPaused === false);
    check(resumed, '"Keep Racing" closes the math stop and racing resumes');

    // Typed Grade 7 answer + whiteboard + hint.
    await race(page, () => { window.mathKart.game.scene.getScene('RaceScene').coins = 200; });
    const typedStop = await nextTypedStop(page, tapGame);
    check(typedStop.grade === 7, 'typed Grade 7 question: "' + typedStop.question.slice(0, 60) + '" (answer ' + typedStop.answer + ')');
    await typeOnKeypad(page, '12', tapGame);
    check((await mathState(page)).typed === '12', 'keypad digits show up in the answer box');
    await shot(page, 'ipad-05b-typed');

    const statsBeforeBoard = await raceStats(page);
    await tapGame(page, MATH.whiteboard[0], MATH.whiteboard[1]);
    await page.waitForFunction(() => {
        const wb = document.getElementById('mk-whiteboard');
        return wb && getComputedStyle(wb).display !== 'none';
    }, null, { timeout: 3000 });
    check(true, 'Whiteboard button opens the full-screen scratch pad');
    const wbBox = await page.locator('#mk-wb-canvas').boundingBox();
    check(wbBox && wbBox.width >= 1000 && wbBox.height >= 600, 'scratch pad is nearly full screen (' + Math.round(wbBox.width) + 'x' + Math.round(wbBox.height) + ')');
    const drawTouches = (type, pts) => page.evaluate(([type, pts]) => {
        const c = document.getElementById('mk-wb-canvas');
        const list = pts.map((p) => new Touch({ identifier: p.id, target: c, clientX: p.x, clientY: p.y, pageX: p.x, pageY: p.y }));
        c.dispatchEvent(new TouchEvent(type, {
            changedTouches: list, touches: type === 'touchend' ? [] : list, targetTouches: type === 'touchend' ? [] : list,
            bubbles: true, cancelable: true
        }));
    }, [type, pts]);
    const x0 = wbBox.x + 200;
    const y0 = wbBox.y + 200;
    await drawTouches('touchstart', [{ id: 21, x: x0, y: y0 }, { id: 22, x: x0, y: y0 + 200 }]);
    for (let i = 1; i <= 12; i++) {
        await drawTouches('touchmove', [{ id: 21, x: x0 + i * 25, y: y0 + (i % 2) * 20 }, { id: 22, x: x0 + i * 25, y: y0 + 200 }]);
    }
    const midDraw = await race(page, () => {
        const hud = window.mathKart.game.scene.getScene('RaceHudScene');
        const c = hud.controls;
        return { pedals: c.forward || c.backward || c.left || c.right, pointerDown: window.mathKart.game.input.pointers.some((p) => p.isDown), paused: hud.race.isPaused };
    });
    await drawTouches('touchend', [{ id: 21, x: x0 + 300, y: y0 }, { id: 22, x: x0 + 300, y: y0 + 200 }]);
    check(!midDraw.pedals && !midDraw.pointerDown && midDraw.paused, 'two-finger drawing never reaches the game (no pedals, no Phaser pointer, race paused)');
    const ink = await inkPixels(page);
    const wbInfo = await page.evaluate(() => window.mathKart.whiteboard());
    check(ink > 500 && wbInfo.strokes === 2, 'two finger strokes are drawn on the pad (' + wbInfo.strokes + ' strokes, ' + ink + ' ink pixels)');
    await shot(page, 'ipad-05c-whiteboard');
    const done = await page.locator('#mk-wb-done').boundingBox();
    await page.touchscreen.tap(done.x + done.width / 2, done.y + done.height / 2);
    await page.waitForFunction(() => getComputedStyle(document.getElementById('mk-whiteboard')).display === 'none', null, { timeout: 3000 });
    const back = await mathState(page);
    check(back.question === typedStop.question && back.typed === '12' && !back.answered && !back.closed && back.whiteboardOpens === 1,
        'Done returns to the same question with the typed digits kept ("' + back.typed + '")');
    const statsMid = await raceStats(page);
    check(statsMid.coins === statsBeforeBoard.coins && statsMid.asked === statsBeforeBoard.asked, 'drawing and closing the whiteboard does not score anything (' + JSON.stringify(statsBeforeBoard) + ' -> ' + JSON.stringify(statsMid) + ')');

    await tapGame(page, MATH.hint[0], MATH.hint[1]);
    await page.waitForTimeout(200);
    const hinted = await mathState(page);
    check(hinted.hintUsed, 'Show hint reveals the hint');
    check(!!(await findHudText(page, 'Hint used: half coins')), 'stakes now say "Hint used: half coins"');
    await shot(page, 'ipad-05d-hint');
    await typeOnKeypad(page, ['del', 'del'], tapGame);
    await typeOnKeypad(page, typedStop.answer, tapGame);
    const beforeRight = await raceStats(page);
    await tapGame(page, MATH.keys.check[0], MATH.keys.check[1]);
    await tapGame(page, MATH.keys.check[0], MATH.keys.check[1]);
    await page.waitForTimeout(300);
    const rightState = await mathState(page);
    const afterRight = await raceStats(page);
    check(rightState.correct === true && rightState.typed === typedStop.answer, 'typed answer ' + typedStop.answer + ' is marked right');
    check(afterRight.coins - beforeRight.coins === COINS[7].hintRight && rightState.delta === COINS[7].hintRight && afterRight.asked === beforeRight.asked + 1,
        'right after a hint pays only +' + COINS[7].hintRight + ' (' + beforeRight.coins + ' -> ' + afterRight.coins + '), once');
    await shot(page, 'ipad-05e-right-with-hint');
    await keepRacing(page, tapGame);

    const wrongStop = await nextTypedStop(page, tapGame);
    const beforeWrong = await raceStats(page);
    await typeOnKeypad(page, '999', tapGame);
    await tapGame(page, MATH.keys.check[0], MATH.keys.check[1]);
    await page.waitForTimeout(400);
    const wrongState = await mathState(page);
    const afterWrong = await raceStats(page);
    check(wrongState.correct === false && afterWrong.coins - beforeWrong.coins === COINS[7].wrong,
        'wrong with no hint costs ' + COINS[7].wrong + ' (' + beforeWrong.coins + ' -> ' + afterWrong.coins + ')');
    const shown = await findHudText(page, 'The answer is ');
    check(!!shown && shown.indexOf(wrongStop.answer) !== -1, 'after a miss the correct answer is shown ("' + shown + '")');
    await shot(page, 'ipad-05f-wrong');
    await keepRacing(page, tapGame);
    check(true, 'math stop closed and racing resumed');

    // Fast-forward to the finish: mark every star done and cross the line.
    await race(page, () => {
        const r = window.mathKart.game.scene.getScene('RaceScene');
        r.lap = 1;
        r.cpInLap = r.track.checkpoints.length;
        const p = r.track.loop.points[0];
        r.player.x = p.x; r.player.y = p.y + 30;
        r.player.segHint = 0;
    });
    await page.waitForFunction(() => window.mathKart.game.scene.getScene('RaceScene').raceFinished === true, null, { timeout: 5000 });
    check(true, 'crossing the line on the last lap finishes the race');
    await page.waitForTimeout(500);
    await shot(page, 'ipad-06-results');

    await tapGame(page, 512 - 250, 384 + 10 + 185);
    await page.waitForFunction(() => {
        const r = window.mathKart.game.scene.getScene('RaceScene');
        const hud = window.mathKart.game.scene.getScene('RaceHudScene');
        return r.sys.isActive() && hud.sys.isActive() && r.hud === hud && r.raceStarted && !r.raceFinished && r.lap === 0;
    }, null, { timeout: 8000 });
    check(true, '"Race Again" starts a fresh race with a working HUD');


    await tapGame(page, 962, 46);
    await page.waitForFunction(() => window.mathKart.game.scene.getScene('RaceScene').menuPaused === true, null, { timeout: 3000 });
    await page.waitForTimeout(250);
    await tapGame(page, 512, 504);
    await page.waitForFunction(() => {
        const g = window.mathKart.game.scene;
        return g.getScene('MenuScene').sys.isActive() && !g.getScene('RaceScene').sys.isActive() && !g.getScene('RaceHudScene').sys.isActive();
    }, null, { timeout: 5000 });
    check(true, '"Quit to Menu" returns to the menu and stops the race');
    await page.waitForTimeout(300);
    await shot(page, 'ipad-06b-menu-after-race');
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('mathKartSave')));
    check(saved && saved.coins > 0, 'coins saved to localStorage (' + (saved && saved.coins) + ')');
    check(saved && saved.grade === 7, 'Grade 7 is still selected after racing');

    await tapGame(page, MENU.shop[0], MENU.shop[1]);
    await page.waitForFunction(() => window.mathKart.game.scene.getScene('ShopScene').sys.isActive(), null, { timeout: 5000 });
    await page.waitForTimeout(300);
    await tapGame(page, 524 + 90 + 140, 130 + 140);
    await page.waitForTimeout(400);
    await shot(page, 'ipad-07-shop');
    const shopSave = await page.evaluate(() => JSON.parse(localStorage.getItem('mathKartSave')));
    check(shopSave.currentColor === 'blue' && shopSave.coins === saved.coins - 20,
        'shop: bought and equipped blue paint (coins ' + saved.coins + ' -> ' + shopSave.coins + ')');

    // Track ladder: Desert -> Pine -> Snow -> City, in order.
    const readSave = () => page.evaluate(() => JSON.parse(localStorage.getItem('mathKartSave')));
    const tapTrack = async (i) => { await tapGame(page, SHOP_TRACK_XS[i], SHOP_TRACK_BUTTON_Y); await page.waitForTimeout(350); };
    await tapTrack(0);
    const afterDesert = await readSave();
    check(afterDesert.unlockedCourses.indexOf('desert') !== -1 && afterDesert.coins === shopSave.coins - 100,
        'shop: unlocked Desert Canyon for 100 (coins ' + shopSave.coins + ' -> ' + afterDesert.coins + ')');
    await tapTrack(1);
    const poorPine = await readSave();
    check(poorPine.unlockedCourses.indexOf('pine') === -1 && poorPine.coins === afterDesert.coins,
        'shop: Pine Path (250) stays locked with only ' + afterDesert.coins + ' coins');
    await page.evaluate(() => {
        const s = JSON.parse(localStorage.getItem('mathKartSave'));
        s.coins = 1500;
        localStorage.setItem('mathKartSave', JSON.stringify(s));
    });
    await page.reload({ waitUntil: 'load' });
    await waitForBoot(page);
    await tapGame(page, MENU.shop[0], MENU.shop[1]);
    await page.waitForFunction(() => window.mathKart.game.scene.getScene('ShopScene').sys.isActive(), null, { timeout: 5000 });
    await page.waitForTimeout(300);
    await tapTrack(2);
    check((await readSave()).unlockedCourses.indexOf('snow') === -1, 'shop: Snow Circuit can\'t be bought before Pine Path');
    await tapTrack(1);
    await tapTrack(2);
    await tapTrack(3);
    const ladder = await readSave();
    check(['pine', 'snow', 'city'].every((id) => ladder.unlockedCourses.indexOf(id) !== -1) && ladder.coins === 1500 - 250 - 450 - 700,
        'shop: Pine 250 -> Snow 450 -> City 700 unlock in order (coins 1500 -> ' + ladder.coins + ')');
    await shot(page, 'ipad-07b-track-ladder');
    await tapGame(page, 104, 56);
    await page.waitForFunction(() => window.mathKart.game.scene.getScene('MenuScene').sys.isActive(), null, { timeout: 5000 });
    await page.waitForTimeout(300);
    await tapGame(page, MENU.cards[3], MENU.cardsY);
    await page.waitForTimeout(200);
    check((await readSave()).lastCourse === 'snow', 'menu: tapping the Snow Circuit card selects it');
    await shot(page, 'ipad-08-menu-all-tracks');
    await tapGame(page, MENU.start[0], MENU.start[1]);
    await page.waitForFunction(() => {
        const r = window.mathKart.game.scene.getScene('RaceScene');
        return r && r.sys.isActive() && r.track && r.track.id === 'snow' && r.raceStarted;
    }, null, { timeout: 10000 });
    check(true, 'START RACE opens Snow Circuit');

    check(errors.length === 0, 'no uncaught page errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
    await context.close();
}

/** Every course on the iOS 12 profile: star 1 opens a Math Stop, the finish pays that course's prize. */
async function allTracks(browser, baseUrl) {
    console.log('\n[Every track, iPad mini / iOS 12 profile]');
    const context = await browser.newContext({
        viewport: { width: 1024, height: 768 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: IPAD_IOS12_UA
    });
    await context.addInitScript(IOS12_SHIM);
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(baseUrl, { waitUntil: 'load' });
    await waitForBoot(page);
    await page.evaluate(() => {
        const s = JSON.parse(localStorage.getItem('mathKartSave'));
        s.unlockedCourses = ['forest', 'desert', 'pine', 'snow', 'city'];
        localStorage.setItem('mathKartSave', JSON.stringify(s));
    });
    for (const course of COURSES) {
        await page.goto(baseUrl, { waitUntil: 'load' });
        await waitForBoot(page);
        await page.waitForTimeout(250);
        await tapGame(page, MENU.cards[COURSES.indexOf(course)], MENU.cardsY);
        await page.waitForTimeout(150);
        await tapGame(page, MENU.start[0], MENU.start[1]);
        await page.waitForFunction((id) => {
            const r = window.mathKart.game.scene.getScene('RaceScene');
            return r && r.sys.isActive() && r.track && r.track.id === id && r.raceStarted;
        }, course.id, { timeout: 10000 });
        await shot(page, 'track-' + course.id);

        await race(page, () => {
            const r = window.mathKart.game.scene.getScene('RaceScene');
            const cp = r.track.checkpoints[0];
            r.player.x = cp.x + 40; r.player.y = cp.y;
        });
        await page.waitForFunction(() => window.mathKart.game.scene.getScene('RaceHudScene').modalOpen === true, null, { timeout: 5000 });
        await page.waitForTimeout(350);
        const s = await mathState(page);
        if (s.mode === 'typed') {
            await typeOnKeypad(page, s.answer, tapGame);
            await tapGame(page, MATH.keys.check[0], MATH.keys.check[1]);
        } else {
            const p = choicePos(s, s.answer);
            await tapGame(page, p[0], p[1]);
        }
        await page.waitForTimeout(250);
        const answered = await mathState(page);
        await keepRacing(page, tapGame);
        await trackFeatures(page, course.id);

        const before = await raceStats(page);
        await race(page, () => {
            const r = window.mathKart.game.scene.getScene('RaceScene');
            r.lap = 1;
            r.cpInLap = r.track.checkpoints.length;
            const p = r.track.loop.points[0];
            r.player.x = p.x; r.player.y = p.y + 30;
            r.player.segHint = 0;
        });
        await page.waitForFunction(() => window.mathKart.game.scene.getScene('RaceScene').raceFinished === true, null, { timeout: 5000 });
        const end = await race(page, () => {
            const r = window.mathKart.game.scene.getScene('RaceScene');
            return { coins: r.coins, position: r.finishOrder.length + 1 };
        });
        const prize = course.prizes[end.position - 1];
        check(answered.correct === true && end.coins - before.coins === prize,
            course.id + ': star 1 opened a Math Stop (answered right), finishing ' + end.position + ' paid ' + (end.coins - before.coins) + ' (expected ' + prize + ')');

    }
    check(errors.length === 0, 'no uncaught page errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
    await context.close();
}

async function phoneLandscape(browser, baseUrl) {
    console.log('\n[Phone landscape 844x390]');
    const context = await browser.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 });
    const page = await context.newPage();
    await page.goto(baseUrl, { waitUntil: 'load' });
    const boot = await waitForBoot(page);
    check(boot.booted, 'game booted');
    const box = (await toClient(page, 0, 0)).box;
    check(box.y >= -1 && box.y + box.height <= 391 && box.x >= -1 && box.x + box.width <= 845,
        'entire game canvas is on screen (' + [box.x, box.y, box.width, box.height].map(Math.round).join(',') + ')');
    await page.waitForTimeout(300);
    await shot(page, 'phone-01-menu');
    await tapGame(page, MENU.start[0], MENU.start[1]);
    await page.waitForFunction(() => window.mathKart.game.scene.getScene('RaceScene').sys.isActive(), null, { timeout: 5000 });
    check(true, 'START RACE is reachable and works');
    await context.close();
}

async function desktop(browser, baseUrl) {
    console.log('\n[Desktop 1280x800]');
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();
    await page.goto(baseUrl, { waitUntil: 'load' });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const boot = await waitForBoot(page);
    check(boot.booted && !boot.error, 'game booted with ' + boot.renderer + ' (' + boot.reason + ')');

    const click = async (pg, gx, gy) => {
        const p = await toClient(pg, gx, gy);
        await pg.mouse.click(p.x, p.y);
    };
    const savedGrade = () => page.evaluate(() => JSON.parse(localStorage.getItem('mathKartSave')).grade);
    await page.waitForTimeout(300);
    check(await savedGrade() === 3, 'Grade 3 is the default');
    await click(page, MENU.grade7[0], MENU.grade7[1]);
    await click(page, MENU.grade3[0], MENU.grade3[1]);
    await page.waitForTimeout(150);
    // CI has no GPU, so WebGL is software-rendered and a race takes 10+ s to
    // start there. Boot on WebGL is checked above; play on Canvas.
    await page.goto(baseUrl + '?renderer=canvas', { waitUntil: 'load' });
    await waitForBoot(page);
    await page.waitForTimeout(300);
    check(await savedGrade() === 3 && await race(page, () => window.mathKart.game.scene.getScene('MenuScene').grade === 3),
        'switching Grade 7 -> Grade 3 with the mouse persists across a reload');

    await click(page, MENU.start[0], MENU.start[1]);
    await page.waitForFunction(() => {
        const r = window.mathKart.game.scene.getScene('RaceScene');
        return r && r.sys.isActive() && r.raceStarted;
    }, null, { timeout: 10000 });

    // Grade 3, answered right without a hint (keyboard for typed answers).
    const g3 = await openMathStop(page);
    check(g3.grade === 3 && ['add-subtract-units', 'multiplication', 'division'].indexOf(g3.kind) !== -1, 'Grade 3 problem: ' + g3.question + ' (' + g3.mode + ')');
    const before = await raceStats(page);
    if (g3.mode === 'typed') {
        await page.keyboard.type(g3.answer);
        await page.keyboard.press('Enter');
        await page.keyboard.press('Enter');
    } else {
        const p = choicePos(g3, g3.answer);
        await click(page, p[0], p[1]);
    }
    await page.waitForTimeout(300);
    const after = await raceStats(page);
    const g3After = await mathState(page);
    check(after.coins - before.coins === COINS[3].right && after.correct === before.correct + 1,
        'right answer, no hint: +' + COINS[3].right + ' (' + before.coins + ' -> ' + after.coins + ')' +
        (g3After.correct ? '' : ' [' + g3After.mode + ' answer ' + g3After.answer + ', typed "' + g3After.typed + '", answered ' + g3After.answered + ']'));
    await keepRacing(page, click);

    // Whiteboard with a mouse.
    await openMathStop(page);
    await click(page, MATH.whiteboard[0], MATH.whiteboard[1]);
    await page.waitForFunction(() => window.mathKart.whiteboard().open, null, { timeout: 3000 });
    await page.mouse.move(300, 300);
    await page.mouse.down();
    for (let i = 1; i <= 10; i++) await page.mouse.move(300 + i * 30, 300 + i * 10);
    await page.mouse.up();
    const wb = await page.evaluate(() => window.mathKart.whiteboard());
    check(wb.strokes === 1 && await inkPixels(page) > 300, 'mouse drawing works on the scratch pad');
    await page.click('#mk-wb-done');
    const st = await mathState(page);
    check(!(await page.evaluate(() => window.mathKart.whiteboard().open)) && !st.answered && !st.closed, 'Done returns to the unanswered question');
    check(errors.length === 0, 'no uncaught page errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
    await context.close();
}

async function brokenBundle(browser, baseUrl) {
    console.log('\n[Boot failure banner]');
    for (const mode of ['syntax', 'missing']) {
        const context = await browser.newContext({ viewport: { width: 1024, height: 768 } });
        const page = await context.newPage();
        await page.route(/index-legacy-.*\.js$/, (route) => {
            if (mode === 'missing') return route.fulfill({ status: 404, body: 'nope' });
            return route.fulfill({ status: 200, contentType: 'application/javascript', body: 'System.register([], function () { return { execute: function () { var x = ; } }; });' });
        });
        await page.goto(baseUrl, { waitUntil: 'load' });
        await page.waitForFunction(() => !!window.__mathKartBootError, null, { timeout: 15000 }).catch(() => {});
        const visible = await page.locator('#mk-error').isVisible();
        const title = visible ? await page.locator('#mk-error-title').innerText() : '';
        const reason = visible ? await page.locator('#mk-error-reason').innerText() : '';
        check(visible && /couldn.t start/i.test(title) && reason.length > 5,
            mode + ' bundle shows "' + title + '" - ' + reason);
        await shot(page, 'boot-error-' + mode);
        await context.close();
    }
}

async function main() {
    if (!fs.existsSync(path.join(dist, 'index.html'))) {
        console.error('dist/index.html not found. Run `npm run build` first.');
        process.exit(1);
    }
    const executablePath = findChrome();
    if (!executablePath) {
        console.error('No Chrome/Chromium found. Set CHROME_PATH to run the smoke test.');
        process.exit(1);
    }
    const server = await serve();
    const baseUrl = 'http://127.0.0.1:' + server.address().port + BASE;
    const browser = await chromium.launch({ executablePath, args: ['--no-sandbox'] });
    try {
        await ipadIos12(browser, baseUrl);
        await allTracks(browser, baseUrl);
        await phoneLandscape(browser, baseUrl);
        await desktop(browser, baseUrl);
        await brokenBundle(browser, baseUrl);
    } catch (e) {
        failures++;
        console.error('\nSmoke test crashed:', e && e.stack ? e.stack : e);
    } finally {
        await browser.close();
        server.close();
    }
    if (failures) {
        console.error('\nSMOKE TEST FAILED (' + failures + ' problem(s))');
        process.exit(1);
    }
    console.log('\nSMOKE TEST PASSED');
}

main();
