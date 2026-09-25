import { GAME_WIDTH, GAME_HEIGHT, COLORS, INK, textStyle, drawPanel, createButton } from './theme.js';
import { drawDiagram } from './shapeDiagram.js';
import { applyKey, canSubmit, isTypedAnswerCorrect } from '../math/answerCheck.js';
import { COINS, formatDelta } from '../math/scoring.js';

const CX = GAME_WIDTH / 2;
const CY = GAME_HEIGHT / 2;
const LX = -240;
const RX = 250;
const COL_W = 440;
const ANSWER_COLORS = [COLORS.blue, COLORS.orange, COLORS.purple];

const KEY_ROWS = [
    ['7', '8', '9', 'back'],
    ['4', '5', '6', '/'],
    ['1', '2', '3', '.'],
    ['0', 'clear']
];
const KEY_LABELS = { back: '\u2190', clear: 'CLEAR', '/': '/', '.': '.' };

function fitText(text, maxW, maxH, startSize, minSize) {
    let size = startSize;
    while ((text.width > maxW || text.height > maxH) && size > minSize) {
        size -= 2;
        text.setFontSize(size + 'px');
    }
    return text;
}

/**
 * Math Stop modal.
 *   problem  from getProblemForGrade()
 *   opts.subtitle  small grey line (lap / star / grade)
 *   opts.onAnswer({ correct, hintUsed, typed }) -> coin delta (called once)
 *   opts.onClose()
 * Returns the debug/test handle also stored as scene.mathUi.
 */
export function openMathStop(scene, problem, opts) {
    const layer = scene.openModal(100);
    const panel = scene.add.container(CX, CY);
    layer.add(panel);

    const ui = {
        problem,
        hintUsed: false,
        answered: false,
        typed: '',
        result: null,
        message: '',
        keys: {},
        choices: [],
        check: null,
        hint: null,
        cont: null
    };
    scene.mathUi = ui;
    const at = (x, y) => ({ x: CX + x, y: CY + y });

    const g = scene.add.graphics();
    drawPanel(g, -496, -330, 992, 686, COLORS.white, 34);
    drawPanel(g, -180, -382, 360, 64, COLORS.yellow, 32);
    g.lineStyle(3, 0xe9ecef, 1);
    g.lineBetween(0, -270, 0, 330);
    panel.add(g);
    panel.add(scene.add.text(0, -352, 'MATH STOP!', textStyle(36, INK)).setOrigin(0.5));
    panel.add(scene.add.text(-470, -298, opts.subtitle || '', textStyle(22, '#868e96')).setOrigin(0, 0.5));
    panel.add(scene.add.text(470, -298, 'Wrong \u2212' + COINS.wrong, textStyle(22, '#c92a2a')).setOrigin(1, 0.5));
    panel.add(scene.add.text(360, -298, 'Right +' + COINS.right + '   ', textStyle(22, '#2b8a3e')).setOrigin(1, 0.5));

    // ------------------------------------------------------------ left column
    const hasDiagram = !!problem.diagram;
    const long = problem.question.length > 60;
    const q = scene.add.text(LX, hasDiagram ? -270 : -120, problem.question, textStyle(hasDiagram ? (long ? 30 : 38) : 66, INK, {
        wordWrap: { width: COL_W, useAdvancedWrap: true }
    })).setOrigin(0.5, hasDiagram ? 0 : 0.5);
    fitText(q, COL_W, hasDiagram ? (long ? 180 : 100) : 280, parseInt(q.style.fontSize, 10), 22);
    panel.add(q);

    if (hasDiagram) {
        const top = -270 + q.height + 6;
        drawDiagram(scene, panel, problem.diagram, { x: -488, y: top, w: 480, h: 100 - top });
    }

    const msgBox = scene.add.graphics();
    panel.add(msgBox);
    const msg = scene.add.text(LX, 158, '', textStyle(24, INK, {
        wordWrap: { width: COL_W - 30, useAdvancedWrap: true }
    })).setOrigin(0.5);
    panel.add(msg);
    function showMessage(text, fill, color) {
        msgBox.clear();
        msgBox.fillStyle(fill, 1);
        msgBox.fillRoundedRect(LX - COL_W / 2, 104, COL_W, 110, 18);
        msgBox.lineStyle(3, COLORS.ink, 0.35);
        msgBox.strokeRoundedRect(LX - COL_W / 2, 104, COL_W, 110, 18);
        msg.setFontSize('24px');
        msg.setColor(color || INK);
        msg.setText(text);
        fitText(msg, COL_W - 24, 102, 24, 16);
        ui.message = text;
    }

    const caption = scene.add.text(LX, 232, 'Hint: +' + COINS.rightWithHint + ' if right, \u2212' + COINS.wrongWithHint + ' if wrong',
        textStyle(22, '#868e96')).setOrigin(0.5);
    panel.add(caption);
    const hintBtn = createButton(scene, LX, 286, {
        width: COL_W, height: 80, radius: 26, label: 'SHOW HINT', fontSize: 38,
        color: COLORS.gold,
        onTap: () => showHint()
    });
    panel.add(hintBtn);
    ui.hint = at(LX, 286);

    function showHint() {
        if (ui.hintUsed || ui.answered) return;
        ui.hintUsed = true;
        hintBtn.setLabel('HINT USED');
        hintBtn.setEnabled(false);
        caption.setText('Hint used: half coins if right (+' + COINS.rightWithHint + ')');
        caption.setColor('#e67700');
        showMessage(problem.hint, 0xfff3bf);
    }

    // ----------------------------------------------------------- right column
    let display = null;
    let displayText = null;
    let checkBtn = null;
    const keyButtons = [];
    const choiceButtons = [];

    if (problem.input === 'number') {
        display = scene.add.graphics();
        panel.add(display);
        displayText = scene.add.text(RX, -238, '', textStyle(52, INK)).setOrigin(0.5);
        panel.add(displayText);
        const unit = problem.unit ? scene.add.text(RX + 200, -238, problem.unit, textStyle(28, '#868e96')).setOrigin(1, 0.5) : null;
        if (unit) panel.add(unit);

        KEY_ROWS.forEach((row, r) => {
            const wide = row.length === 2;
            row.forEach((key, c) => {
                const x = wide ? RX - 110 + c * 220 : RX - 165 + c * 110;
                const y = -132 + r * 88;
                const isDigit = /^\d$/.test(key);
                const btn = createButton(scene, x, y, {
                    width: wide ? 210 : 100, height: 78, radius: 22,
                    label: KEY_LABELS[key] || key,
                    fontSize: key === 'clear' ? 30 : 44,
                    color: isDigit ? COLORS.blue : (key === 'back' || key === 'clear' ? COLORS.grayDark : COLORS.purple),
                    onTap: () => press(key)
                });
                if (key === '/' && !problem.allowFraction) btn.setEnabled(false);
                btn.key = key;
                keyButtons.push(btn);
                panel.add(btn);
                ui.keys[key] = at(x, y);
            });
        });

        checkBtn = createButton(scene, RX, 262, {
            width: COL_W, height: 92, radius: 28, label: 'CHECK', fontSize: 44,
            color: COLORS.green,
            onTap: () => submitTyped()
        });
        panel.add(checkBtn);
        ui.check = at(RX, 262);
        refreshDisplay(null);
    } else {
        const n = problem.choices.length;
        const h = n <= 2 ? 140 : 116;
        const step = h + 20;
        const y0 = n <= 2 ? -160 : -196;
        problem.choices.forEach((choice, i) => {
            const y = y0 + i * step;
            const btn = createButton(scene, RX, y, {
                width: COL_W, height: h, radius: 30,
                label: choice,
                fontSize: choice.length > 6 ? 40 : 60,
                color: ANSWER_COLORS[i % ANSWER_COLORS.length],
                onTap: () => submitChoice(choice, btn)
            });
            btn.choice = choice;
            choiceButtons.push(btn);
            panel.add(btn);
            ui.choices.push({ label: choice, x: CX + RX, y: CY + y });
        });
    }

    function refreshDisplay(state) {
        const border = state === 'right' ? COLORS.green : state === 'wrong' ? COLORS.red : COLORS.ink;
        const fill = state === 'right' ? 0xd3f9d8 : state === 'wrong' ? 0xffe3e3 : 0xf8f9fa;
        display.clear();
        display.fillStyle(fill, 1);
        display.fillRoundedRect(RX - COL_W / 2, -282, COL_W, 88, 20);
        display.lineStyle(5, border, 1);
        display.strokeRoundedRect(RX - COL_W / 2, -282, COL_W, 88, 20);
        if (ui.typed) {
            displayText.setText(ui.typed);
            displayText.setColor(INK);
            displayText.setFontSize('52px');
        } else {
            displayText.setText('type your answer');
            displayText.setColor('#adb5bd');
            displayText.setFontSize('30px');
        }
        if (checkBtn && !ui.answered) checkBtn.setEnabled(canSubmit(ui.typed));
    }

    function press(key) {
        if (ui.answered) return;
        ui.typed = applyKey(ui.typed, key, !!problem.allowFraction);
        refreshDisplay(null);
    }

    function submitTyped() {
        if (ui.answered || !canSubmit(ui.typed)) return;
        const correct = isTypedAnswerCorrect(ui.typed, problem.answerValue);
        keyButtons.forEach((b) => b.setLocked(true));
        finish(correct, ui.typed);
        refreshDisplay(correct ? 'right' : 'wrong');
        if (correct) scene.burstStars(panel, RX, -238);
    }

    function submitChoice(choice, btn) {
        if (ui.answered) return;
        const correct = choice === problem.answer;
        choiceButtons.forEach((b) => b.setLocked(true));
        finish(correct, choice);
        if (correct) {
            btn.setColor(COLORS.green);
            scene.tweens.add({ targets: btn, scale: 1.06, duration: 160, yoyo: true, repeat: 1 });
            scene.burstStars(panel, btn.x, btn.y);
        } else {
            btn.setColor(COLORS.red);
            choiceButtons.forEach((b) => {
                if (b.choice === problem.answer) {
                    b.setColor(COLORS.green);
                    scene.tweens.add({ targets: b, scale: 1.05, duration: 220, yoyo: true, repeat: 2 });
                }
            });
        }
    }

    // ------------------------------------------------------------- answering
    function finish(correct, typed) {
        ui.answered = true;
        hintBtn.setLocked(true);
        const delta = opts.onAnswer({ correct, hintUsed: ui.hintUsed, typed });
        ui.result = { correct, delta };

        hintBtn.setVisible(false);
        caption.setVisible(false);
        const banner = scene.add.graphics();
        banner.fillStyle(COLORS.ink, 1);
        banner.fillRoundedRect(LX - COL_W / 2, 244, COL_W, 84, 26);
        banner.fillStyle(correct ? COLORS.green : COLORS.red, 1);
        banner.fillRoundedRect(LX - COL_W / 2, 238, COL_W, 84, 26);
        panel.add(banner);
        const coinsWord = Math.abs(delta) === 1 ? ' coin' : ' coins';
        const bannerText = scene.add.text(LX, 280, formatDelta(delta) + coinsWord, textStyle(46, '#ffffff', {
            stroke: INK, strokeThickness: 6
        })).setOrigin(0.5);
        panel.add(bannerText);
        bannerText.setScale(0.6);
        scene.tweens.add({ targets: bannerText, scale: 1, duration: 260, ease: 'Back.easeOut' });

        if (correct) {
            showMessage((ui.hintUsed ? 'Right! (hint used)\n' : 'Great job!\n') + problem.explain, 0xd3f9d8, '#2b8a3e');
        } else {
            showMessage('Not quite. The answer is ' + problem.answerText + '.\n' + problem.explain, 0xffe3e3, '#c92a2a');
        }

        if (checkBtn) checkBtn.setVisible(false);
        const cont = createButton(scene, RX, 262, {
            width: COL_W, height: 92, radius: 28, label: 'KEEP RACING \u25B6', fontSize: 40,
            color: COLORS.blue,
            onTap: () => close()
        });
        panel.add(cont);
        ui.cont = at(RX, 262);

        scene.time.delayedCall(correct ? 2600 : 7000, () => close());
    }

    // Physical keyboard on desktop: digits, . / Backspace, Enter.
    const kb = scene.input.keyboard;
    function onKey(ev) {
        if (ui.answered) {
            if (ev.key === 'Enter') close();
            return;
        }
        if (problem.input === 'number') {
            if (/^[0-9./]$/.test(ev.key)) press(ev.key);
            else if (ev.key === 'Backspace') press('back');
            else if (ev.key === 'Enter') submitTyped();
        } else if (/^[1-9]$/.test(ev.key)) {
            const i = Number(ev.key) - 1;
            if (choiceButtons[i]) submitChoice(choiceButtons[i].choice, choiceButtons[i]);
        }
    }
    if (kb) kb.on('keydown', onKey);

    let closed = false;
    function close() {
        if (closed) return;
        closed = true;
        if (kb) kb.off('keydown', onKey);
        ui.closed = true;
        scene.closeModal(layer, opts.onClose);
    }

    panel.setScale(0.85);
    scene.tweens.add({ targets: panel, scale: 1, duration: 200, ease: 'Back.easeOut' });
    return ui;
}
