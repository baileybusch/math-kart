import { GAME_WIDTH, COLORS, INK, textStyle, drawPanel, createButton } from './theme.js';
import { drawDiagram } from './figureDiagram.js';
import { checkAnswer, parseTypedNumber } from '../math/answers.js';
import { signed } from '../math/economy.js';
import { openWhiteboard, closeWhiteboard, clearWhiteboard, isWhiteboardOpen } from './whiteboard.js';

const W = GAME_WIDTH;

// Layout (1024x768 design space). Left column: question, diagram, hint,
// Hint/Whiteboard buttons. Right column: answer keypad or choices, stakes.
export const MATH_LAYOUT = {
    left: { x: 44, w: 540, cx: 314 },
    right: { x: 608, w: 376, cx: 796 },
    questionTop: 154,
    diagramBottom: 474,
    hintBox: { x: 44, y: 484, w: 540, h: 94 },
    hintButton: { x: 174, y: 630 },
    whiteboardButton: { x: 454, y: 630 },
    keepRacing: { x: 314, y: 630 },
    display: { y: 140, h: 66 },
    keyCols: [652, 748, 844, 940],
    keyRows: [292, 376, 460, 544],
    choiceRows2: [260, 420],
    choiceRows3: [222, 342, 462],
    stakesY: 632,
    feedbackY: 712
};
const L = MATH_LAYOUT;
const KEY_W = 86;
const KEY_H = 74;
const MAX_TYPED = 7;
const ANSWER_COLORS = [COLORS.blue, COLORS.orange, COLORS.purple];
const X_KINDS = { 'find-x': true, 'word-find': true, proportion: true };
const KEYS = [
    ['7', '8', '9', 'del'],
    ['4', '5', '6', '/'],
    ['1', '2', '3', '.'],
    ['0', 'check']
];
const CLOSE_AFTER_RIGHT = 2600;
const CLOSE_AFTER_WRONG = 6000;

function fitText(text, maxW, maxH, minSize) {
    let size = parseInt(text.style.fontSize, 10);
    while ((text.width > maxW || text.height > maxH) && size > minSize) {
        size -= 2;
        text.setFontSize(size + 'px');
    }
}

/**
 * Shows one Math Stop. `onAnswer({ correct, hintUsed })` is called exactly
 * once and returns the coin change; `onClose()` runs after the modal is gone.
 * The live state is kept on `scene.math` (used by the smoke test).
 */
export function showMathStop(scene, problem, opts, onAnswer, onClose) {
    const rules = opts.rules;
    const typed = problem.mode === 'typed';
    const state = {
        problem, typed: '', hintUsed: false, answered: false, correct: null, delta: 0, closed: false,
        whiteboardOpens: 0
    };
    scene.math = state;
    clearWhiteboard();

    const layer = scene.openModal(100);
    const panel = scene.add.container(0, 0);
    layer.add(panel);
    const add = (obj) => { panel.add(obj); return obj; };

    const g = add(scene.add.graphics());
    drawPanel(g, 20, 84, 984, 668, COLORS.white, 34);
    drawPanel(g, 352, 50, 320, 66, COLORS.yellow, 33);
    add(scene.add.text(W / 2, 83, 'MATH STOP!', textStyle(38, INK)).setOrigin(0.5));
    add(scene.add.text(W / 2, 132, opts.subtitle || '', textStyle(20, '#868e96')).setOrigin(0.5));

    // ---- question + diagram
    let question;
    if (problem.diagram) {
        const long = problem.question.length > 60;
        question = add(scene.add.text(L.left.cx, L.questionTop, problem.question, textStyle(long ? 26 : 30, INK, {
            wordWrap: { width: L.left.w - 10 }, lineSpacing: 2
        })).setOrigin(0.5, 0));
        fitText(question, L.left.w - 10, long ? 118 : 76, 18);
        const top = question.y + question.height + 6;
        drawDiagram(scene, panel, problem.diagram, { x: L.left.x, y: top, w: L.left.w, h: L.diagramBottom - top });
    } else {
        question = add(scene.add.text(L.left.cx, 310, problem.question, textStyle(64, INK, {
            wordWrap: { width: L.left.w - 10 }
        })).setOrigin(0.5));
        fitText(question, L.left.w - 10, 250, 30);
    }

    // ---- hint box (filled in when the hint is used, and after answering)
    const hintG = add(scene.add.graphics());
    const hintText = add(scene.add.text(L.hintBox.x + 16, L.hintBox.y + 10, '', textStyle(21, INK, {
        align: 'left', wordWrap: { width: L.hintBox.w - 32 }, lineSpacing: 2
    })));
    const showNote = (text, fill) => {
        hintG.clear();
        hintG.fillStyle(fill, 1);
        hintG.fillRoundedRect(L.hintBox.x, L.hintBox.y, L.hintBox.w, L.hintBox.h, 18);
        hintG.lineStyle(3, COLORS.ink, 1);
        hintG.strokeRoundedRect(L.hintBox.x, L.hintBox.y, L.hintBox.w, L.hintBox.h, 18);
        hintText.setFontSize('21px');
        hintText.setText(text);
        fitText(hintText, L.hintBox.w - 32, L.hintBox.h - 14, 15);
    };

    const feedback = add(scene.add.text(W / 2, L.feedbackY, typed ? 'Type your answer, then tap Check.' : 'Tap the right answer!',
        textStyle(26, '#495057', { wordWrap: { width: 940 } })).setOrigin(0.5));
    const stakes = add(scene.add.text(L.right.cx, L.stakesY, '', textStyle(21, INK, { lineSpacing: 4 })).setOrigin(0.5));
    const refreshStakes = () => {
        stakes.setText(state.hintUsed
            ? 'Hint used: half coins\nRight ' + signed(rules.hintRight) + '   Wrong ' + signed(rules.hintWrong)
            : 'Right ' + signed(rules.right) + '   Wrong ' + signed(rules.wrong) + '\nWith a hint: ' + signed(rules.hintRight) + ' / ' + signed(rules.hintWrong));
        stakes.setColor(state.hintUsed ? '#e67700' : INK);
    };
    refreshStakes();

    // ---- answer area
    const lockables = [];
    let display = null;
    let displayG = null;
    let choiceButtons = [];

    const refreshDisplay = () => {
        const prefix = X_KINDS[problem.kind] ? 'x = ' : '';
        const unit = problem.unit ? ' ' + problem.unit : '';
        display.setText(prefix + (state.typed || '?') + unit);
        display.setColor(state.typed ? INK : '#adb5bd');
        display.setFontSize('46px');
        fitText(display, L.right.w - 30, 60, 24);
    };

    const nudge = (message) => {
        feedback.setText(message);
        feedback.setColor('#e67700');
        if (display) scene.tweens.add({ targets: display, x: L.right.cx + 10, duration: 50, yoyo: true, repeat: 2, onComplete: () => display.setX(L.right.cx) });
    };

    const press = (key) => {
        if (state.answered || state.closed) return;
        let t = state.typed;
        if (key === 'del') {
            t = t.slice(0, -1);
        } else if (key === 'check') {
            submitTyped();
            return;
        } else if (t.length >= MAX_TYPED) {
            return;
        } else if (key === '.') {
            const part = t.slice(t.indexOf('/') + 1);
            if (part.indexOf('.') !== -1) return;
            t += part === '' ? '0.' : '.';
        } else if (key === '/') {
            if (problem.grade !== 7 || !t || t.indexOf('/') !== -1 || t.charAt(t.length - 1) === '.') return;
            t += '/';
        } else {
            t += key;
        }
        state.typed = t;
        refreshDisplay();
    };

    const submitTyped = () => {
        if (state.answered || state.closed) return;
        if (!state.typed) { nudge('Type your answer first!'); return; }
        if (!isFinite(parseTypedNumber(state.typed))) { nudge('Finish your number first!'); return; }
        resolve(checkAnswer(problem, state.typed), null);
    };

    if (typed) {
        displayG = add(scene.add.graphics());
        displayG.fillStyle(0xf1f3f5, 1);
        displayG.fillRoundedRect(L.right.x, L.display.y, L.right.w, L.display.h, 18);
        displayG.lineStyle(5, COLORS.ink, 1);
        displayG.strokeRoundedRect(L.right.x, L.display.y, L.right.w, L.display.h, 18);
        display = add(scene.add.text(L.right.cx, L.display.y + L.display.h / 2, '', textStyle(46, INK)).setOrigin(0.5));
        refreshDisplay();
        if (problem.grade === 7) {
            add(scene.add.text(L.right.cx, 228, 'Tip: round to 2 decimals (6.67) or type a fraction (20/3)',
                textStyle(15, '#868e96', { wordWrap: { width: L.right.w } })).setOrigin(0.5));
        }
        KEYS.forEach((row, r) => {
            row.forEach((key, c) => {
                const isCheck = key === 'check';
                const x = isCheck ? (L.keyCols[1] + L.keyCols[3]) / 2 : L.keyCols[c];
                const btn = createButton(scene, x, L.keyRows[r], {
                    width: isCheck ? KEY_W * 3 + 20 : KEY_W,
                    height: KEY_H,
                    radius: 18,
                    label: key === 'del' ? '\u232B' : isCheck ? 'Check \u2713' : key,
                    fontSize: isCheck ? 36 : 40,
                    color: isCheck ? COLORS.green : key === 'del' ? COLORS.orange : (key === '.' || key === '/') ? COLORS.purple : COLORS.blue,
                    onTap: () => press(key)
                });
                btn.key = key;
                if (key === '/' && problem.grade !== 7) btn.setEnabled(false);
                add(btn);
                lockables.push(btn);
            });
        });
    } else {
        const rows = problem.choices.length === 2 ? L.choiceRows2 : L.choiceRows3;
        choiceButtons = problem.choices.map((choice, i) => {
            const btn = createButton(scene, L.right.cx, rows[i], {
                width: 360, height: problem.choices.length === 2 ? 124 : 104, radius: 30,
                label: choice,
                fontSize: choice.length > 6 ? 36 : choice.length > 4 ? 46 : 58,
                color: ANSWER_COLORS[i % ANSWER_COLORS.length],
                onTap: () => resolve(choice === problem.answer || checkAnswer(problem, choice), btn)
            });
            btn.choice = choice;
            add(btn);
            lockables.push(btn);
            return btn;
        });
    }

    // ---- hint + whiteboard
    const hintBtn = add(createButton(scene, L.hintButton.x, L.hintButton.y, {
        width: 260, height: 84, radius: 26, label: 'Show hint', fontSize: 34, color: COLORS.gold,
        onTap: () => {
            if (state.hintUsed || state.answered || state.closed) return;
            state.hintUsed = true;
            showNote('Hint: ' + problem.hint, 0xfff3bf);
            hintBtn.setLabel('Hint shown');
            hintBtn.setEnabled(false);
            refreshStakes();
            scene.tweens.add({ targets: stakes, scale: 1.15, duration: 140, yoyo: true });
        }
    }));
    const boardBtn = add(createButton(scene, L.whiteboardButton.x, L.whiteboardButton.y, {
        width: 260, height: 84, radius: 26, label: 'Whiteboard', fontSize: 34, color: COLORS.blue,
        onTap: () => {
            if (state.answered || state.closed || isWhiteboardOpen()) return;
            state.whiteboardOpens++;
            scene.whiteboardOpen = true;
            openWhiteboard({
                title: problem.question,
                onClose: () => { scene.whiteboardOpen = false; }
            });
        }
    }));

    const keepBtn = add(createButton(scene, L.keepRacing.x, L.keepRacing.y, {
        width: 540, height: 84, radius: 28, label: 'Keep Racing \u25B6', fontSize: 38, color: COLORS.green,
        onTap: () => finish()
    }));
    keepBtn.setVisible(false);
    keepBtn.setLocked(true);

    // ---- answering
    function resolve(correct, pickedBtn) {
        if (state.answered || state.closed) return;
        state.answered = true;
        state.correct = correct;
        lockables.forEach((b) => b.setLocked(true));
        hintBtn.setLocked(true).setVisible(false);
        boardBtn.setLocked(true).setVisible(false);
        closeWhiteboard();

        const delta = onAnswer({ correct, hintUsed: state.hintUsed });
        state.delta = delta;

        if (display) {
            display.setColor(correct ? '#2b8a3e' : '#c92a2a');
            displayG.lineStyle(6, correct ? COLORS.green : COLORS.red, 1);
            displayG.strokeRoundedRect(L.right.x, L.display.y, L.right.w, L.display.h, 18);
        }
        choiceButtons.forEach((b) => {
            if (b.choice === problem.answer) {
                b.setColor(COLORS.green);
                if (!correct) scene.tweens.add({ targets: b, scale: 1.08, duration: 220, yoyo: true, repeat: 2 });
            } else if (b === pickedBtn) {
                b.setColor(COLORS.red);
            }
        });

        const answerText = (X_KINDS[problem.kind] ? 'x = ' : '') + problem.answer + (problem.unit ? ' ' + problem.unit : '');
        if (correct) {
            feedback.setText(state.hintUsed ? 'You got it with a hint!' : 'Great job!');
            feedback.setColor('#2b8a3e');
            scene.burstStars(panel, pickedBtn ? pickedBtn.x : L.right.cx, pickedBtn ? pickedBtn.y : L.display.y + 33);
        } else {
            feedback.setText('Not quite. The answer is ' + answerText + '.');
            feedback.setColor('#c92a2a');
        }
        showNote((correct ? 'How it works: ' : 'Here\u2019s how: ') + problem.explain, correct ? 0xd3f9d8 : 0xffe3e3);

        stakes.setText(signed(delta) + (Math.abs(delta) === 1 ? ' coin' : ' coins'));
        stakes.setFontSize('52px');
        stakes.setColor(delta >= 0 ? '#2b8a3e' : '#c92a2a');
        stakes.setStroke('#ffffff', 6);
        stakes.setScale(0.4);
        scene.tweens.add({ targets: stakes, scale: 1, duration: 320, ease: 'Back.easeOut' });

        keepBtn.setVisible(true);
        scene.time.delayedCall(350, () => keepBtn.setLocked(false));
        scene.time.delayedCall(correct ? CLOSE_AFTER_RIGHT : CLOSE_AFTER_WRONG, finish);
    }

    const keyboard = scene.input.keyboard;
    const onKey = (event) => {
        if (state.answered || state.closed || isWhiteboardOpen()) return;
        const k = event.key;
        if (typed) {
            if (/^[0-9./]$/.test(k)) press(k);
            else if (k === 'Backspace') press('del');
            else if (k === 'Enter') submitTyped();
            else return;
        } else if (/^[1-3]$/.test(k) && choiceButtons[+k - 1]) {
            const b = choiceButtons[+k - 1];
            resolve(b.choice === problem.answer, b);
        } else {
            return;
        }
        if (event.preventDefault) event.preventDefault();
    };
    if (keyboard) keyboard.on('keydown', onKey);

    function finish() {
        if (state.closed) return;
        state.closed = true;
        if (keyboard) keyboard.off('keydown', onKey);
        closeWhiteboard();
        scene.closeModal(layer, onClose);
    }

    layer.setAlpha(0);
    scene.tweens.add({ targets: layer, alpha: 1, duration: 160 });
    return state;
}
