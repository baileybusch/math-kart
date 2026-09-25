#!/usr/bin/env node
/**
 * Headless-browser smoke test of the BUILT game (dist/).
 *
 * Real iOS 12 Safari can't run in CI, so the syntax side is covered by
 * check-legacy-bundle.mjs. This script covers runtime behaviour:
 *   - "iPad mini / iOS 12" profile: iPad iOS 12 user agent, 1024x768 touch
 *     screen, WebGL disabled and post-iOS-12 APIs deleted. Boots on Canvas,
 *     taps START RACE, drives with two fingers, answers a Grade 3 math stop
 *     and finishes the race. Then picks Grade 7 (survives a reload), and
 *     plays Similar Figures stops: hint + typed right answer (half coins),
 *     typed wrong answer with no hint (big penalty) and a YES/NO question.
 *   - Private browsing (localStorage.setItem throws): grade select still works.
 *   - Phone landscape: whole game is visible (it used to be cut off).
 *   - Desktop: boots normally.
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

const MENU = { start: [512, 610], shop: [512, 714], grade3: [362, 222], grade7: [662, 222] };
const COINS = { right: 6, rightWithHint: 3, wrongWithHint: 4, wrong: 8 };

const mathUi = (page) => page.evaluate(() => {
    const u = window.mathKart.game.scene.getScene('RaceHudScene').mathUi;
    return u && {
        input: u.problem.input, kind: u.problem.kind || u.problem.pack, grade: u.problem.grade,
        answer: u.problem.answer, answerValue: u.problem.answerValue, answerText: u.problem.answerText,
        hintText: u.problem.hint, hasDiagram: !!u.problem.diagram,
        hintUsed: u.hintUsed, answered: u.answered, typed: u.typed, result: u.result, message: u.message,
        keys: u.keys, check: u.check, hint: u.hint, cont: u.cont, choices: u.choices
    };
});

const raceState = (page) => race(page, () => {
    const r = window.mathKart.game.scene.getScene('RaceScene');
    return { coins: r.coins, asked: r.stats.asked, correct: r.stats.correct, hints: r.stats.hints, grade: r.grade };
});

// Ask for a specific problem type at the next star, then drive onto it.
async function openMathStop(page, force) {
    await page.evaluate((force) => {
        window.__mathKartForce = force;
        const r = window.mathKart.game.scene.getScene('RaceScene');
        const cp = r.track.checkpoints[r.cpInLap];
        r.player.x = cp.x; r.player.y = cp.y;
    }, force);
    await page.waitForFunction(() => {
        const hud = window.mathKart.game.scene.getScene('RaceHudScene');
        return hud.modalOpen === true && hud.mathUi && !hud.mathUi.closed;
    }, null, { timeout: 5000 });
    await page.waitForTimeout(350);
    return mathUi(page);
}

async function typeOnKeypad(page, ui, text) {
    for (const ch of text) {
        const key = ui.keys[ch];
        if (!key) throw new Error('no keypad key for ' + JSON.stringify(ch));
        await tapGame(page, key.x, key.y);
        await page.waitForTimeout(40);
    }
}

async function closeMathStop(page) {
    await page.waitForFunction(() => window.mathKart.game.scene.getScene('RaceHudScene').mathUi.contReady === true, null, { timeout: 3000 });
    const ui = await mathUi(page);
    await tapGame(page, ui.cont.x, ui.cont.y);
    await page.waitForFunction(() => window.mathKart.game.scene.getScene('RaceHudScene').modalOpen === false, null, { timeout: 3000 });
}

function typedAnswer(value) {
    return String(Math.round(value * 100) / 100);
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

    check(await page.evaluate(() => window.mathKart.game.scene.getScene('MenuScene').grade) === 3, 'Grade 3 is the default');
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

    // Grade 3 multiple choice at star 1; tap two answers quickly.
    const coinsBefore = await race(page, () => window.mathKart.game.scene.getScene('RaceScene').coins);
    const mc = await openMathStop(page, { input: 'choice' });
    check(mc.grade === 3 && mc.input === 'choice' && mc.choices.length === 3, 'Grade 3 multiple-choice math stop opened at star 1');
    await shot(page, 'ipad-04-math-stop');
    await tapGame(page, mc.choices[0].x, mc.choices[0].y);
    await page.waitForTimeout(250);
    await tapGame(page, mc.choices[1].x, mc.choices[1].y);
    await page.waitForTimeout(300);
    await shot(page, 'ipad-05-answered');
    const after = await raceState(page);
    const mcAfter = await mathUi(page);
    check(after.asked === 1, 'exactly one answer counted even after tapping twice (asked=' + after.asked + ')');
    const expected = after.correct ? coinsBefore + COINS.right : Math.max(0, coinsBefore - COINS.wrong);
    check(after.coins === expected, (after.correct ? 'right' : 'wrong') + ' answer scored correctly (' + coinsBefore + ' -> ' + after.coins + ')');
    check(mcAfter.result.delta === (after.correct ? COINS.right : -COINS.wrong), 'coin change shown: ' + mcAfter.result.delta);
    if (!after.correct) check(mcAfter.message.indexOf(mcAfter.answerText) !== -1, 'correct answer shown after a miss');
    await closeMathStop(page);
    check(true, '"Keep Racing" closed the math stop and racing resumed');

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

    await tapGame(page, MENU.shop[0], MENU.shop[1]);
    await page.waitForFunction(() => window.mathKart.game.scene.getScene('ShopScene').sys.isActive(), null, { timeout: 5000 });
    await page.waitForTimeout(300);
    await tapGame(page, 524 + 90 + 140, 130 + 140);
    await page.waitForTimeout(400);
    await shot(page, 'ipad-07-shop');
    const shopSave = await page.evaluate(() => JSON.parse(localStorage.getItem('mathKartSave')));
    check(shopSave.currentColor === 'blue' && shopSave.coins === saved.coins - 20,
        'shop: bought and equipped blue paint (coins ' + saved.coins + ' -> ' + shopSave.coins + ')');

    await grade7(page);

    check(errors.length === 0, 'no uncaught page errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
    await context.close();
}

async function grade7(page) {
    console.log('\n[iPad mini / iOS 12 profile: Grade 7 Similar Figures]');
    await tapGame(page, 104, 56);
    await page.waitForFunction(() => window.mathKart.game.scene.getScene('MenuScene').sys.isActive(), null, { timeout: 5000 });
    await page.waitForTimeout(300);
    await tapGame(page, MENU.grade7[0], MENU.grade7[1]);
    await page.waitForTimeout(200);
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('mathKartSave')));
    check(saved.grade === 7, 'tapping Grade 7 saves it (grade=' + saved.grade + ')');
    await page.reload({ waitUntil: 'load' });
    await waitForBoot(page);
    check(await page.evaluate(() => window.mathKart.game.scene.getScene('MenuScene').grade) === 7, 'Grade 7 is still picked after a reload');
    await page.waitForTimeout(300);
    await shot(page, 'ipad-08-menu-grade7');

    await tapGame(page, MENU.start[0], MENU.start[1]);
    await page.waitForFunction(() => {
        const r = window.mathKart.game.scene.getScene('RaceScene');
        return r && r.sys.isActive() && r.raceStarted && r.hud && r.hud.sys.isActive();
    }, null, { timeout: 10000 });
    await race(page, () => { window.mathKart.game.scene.getScene('RaceScene').coins = 40; });

    // Star 1: find x, use the hint, type the right answer, double-tap CHECK.
    let ui = await openMathStop(page, { kind: 'find-x' });
    check(ui.grade === 7 && ui.input === 'number' && ui.hasDiagram, 'Grade 7 find-x stop uses the keypad and a diagram (' + ui.kind + ')');
    await tapGame(page, ui.check.x, ui.check.y);
    await page.waitForTimeout(150);
    check(!(await mathUi(page)).answered, 'CHECK does nothing before anything is typed');
    await tapGame(page, ui.hint.x, ui.hint.y);
    await page.waitForTimeout(250);
    ui = await mathUi(page);
    check(ui.hintUsed && ui.message === ui.hintText, 'SHOW HINT reveals a step: "' + ui.message + '"');
    check(ui.message.indexOf('x = ') === -1, 'hint does not give away x');
    await shot(page, 'ipad-09-g7-hint');
    const answer = typedAnswer(ui.answerValue);
    await typeOnKeypad(page, ui, answer);
    check((await mathUi(page)).typed === answer, 'keypad typed ' + answer + ' (answer ' + ui.answerText + ')');
    await tapGame(page, ui.check.x, ui.check.y);
    await page.waitForTimeout(60);
    await tapGame(page, ui.check.x, ui.check.y);
    await page.waitForTimeout(350);
    await shot(page, 'ipad-10-g7-hint-right');
    let st = await raceState(page);
    ui = await mathUi(page);
    check(await page.evaluate(() => window.mathKart.game.scene.getScene('RaceHudScene').modalOpen) && !ui.closed,
        'double-tapped CHECK keeps the feedback on screen (KEEP RACING ignores the 2nd tap)');
    check(st.grade === 7 && st.asked === 1 && st.correct === 1 && st.hints === 1, 'right after hint counted once (' + JSON.stringify(st) + ')');
    check(st.coins === 40 + COINS.rightWithHint && ui.result.delta === COINS.rightWithHint,
        'hint then right = +' + COINS.rightWithHint + ' (half coins): 40 -> ' + st.coins);
    await closeMathStop(page);

    // Star 2: find x, no hint, wrong answer.
    ui = await openMathStop(page, { kind: 'find-x' });
    const wrong = typedAnswer(ui.answerValue + 1);
    await typeOnKeypad(page, ui, wrong);
    await tapGame(page, ui.check.x, ui.check.y);
    await page.waitForTimeout(350);
    await shot(page, 'ipad-11-g7-wrong-no-hint');
    const before = st.coins;
    st = await raceState(page);
    ui = await mathUi(page);
    check(st.asked === 2 && st.correct === 1 && st.hints === 1, 'wrong answer counted (' + JSON.stringify(st) + ')');
    check(st.coins === before - COINS.wrong && ui.result.delta === -COINS.wrong,
        'wrong with no hint = -' + COINS.wrong + ': ' + before + ' -> ' + st.coins);
    check(ui.message.indexOf(ui.answerText) !== -1, 'miss shows the right answer: "' + ui.message.replace(/\n/g, ' / ') + '"');
    await closeMathStop(page);

    // Star 3: YES / NO similarity, tap the right answer twice.
    ui = await openMathStop(page, { kind: 'similar-yesno' });
    check(ui.input === 'choice' && ui.choices.length === 2, 'similar-figures YES/NO is multiple choice');
    const right = ui.choices.filter((c) => c.label === ui.answer)[0];
    await tapGame(page, right.x, right.y);
    await page.waitForTimeout(60);
    await tapGame(page, right.x, right.y);
    await page.waitForTimeout(350);
    await shot(page, 'ipad-12-g7-yes-no');
    const before3 = st.coins;
    st = await raceState(page);
    check(st.asked === 3 && st.coins === before3 + COINS.right, 'YES/NO right = +' + COINS.right + ' once: ' + before3 + ' -> ' + st.coins);
    await closeMathStop(page);

    const g7Save = await page.evaluate(() => JSON.parse(localStorage.getItem('mathKartSave')));
    check(g7Save.coins === st.coins && g7Save.grade === 7, 'coins and grade saved (' + g7Save.coins + ', grade ' + g7Save.grade + ')');
}

async function privateBrowsing(browser, baseUrl) {
    console.log('\n[Private browsing: localStorage.setItem throws]');
    const context = await browser.newContext({ viewport: { width: 1024, height: 768 }, isMobile: true, hasTouch: true, userAgent: IPAD_IOS12_UA });
    await context.addInitScript(IOS12_SHIM);
    await context.addInitScript(() => {
        Storage.prototype.setItem = function () { throw new Error('QuotaExceededError'); };
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(baseUrl, { waitUntil: 'load' });
    const boot = await waitForBoot(page);
    check(boot.booted && !boot.error, 'game booted');
    await page.waitForTimeout(300);
    await tapGame(page, MENU.grade7[0], MENU.grade7[1]);
    await page.waitForTimeout(200);
    check(await page.evaluate(() => window.mathKart.game.scene.getScene('MenuScene').grade) === 7, 'Grade 7 picked without storage');
    await tapGame(page, MENU.start[0], MENU.start[1]);
    await page.waitForFunction(() => {
        const r = window.mathKart.game.scene.getScene('RaceScene');
        return r && r.sys.isActive() && r.raceStarted;
    }, null, { timeout: 10000 });
    check(await race(page, () => window.mathKart.game.scene.getScene('RaceScene').grade) === 7, 'race uses Grade 7 from the in-memory save');
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
    const boot = await waitForBoot(page);
    check(boot.booted && !boot.error, 'game booted with ' + boot.renderer + ' (' + boot.reason + ')');
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
        await privateBrowsing(browser, baseUrl);
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
