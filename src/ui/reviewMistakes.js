import { GAME_WIDTH, GAME_HEIGHT, COLORS, INK, textStyle, drawPanel, createButton } from './theme.js';
import { drawDiagram } from './figureDiagram.js';
import { formatAnswer, fitText, MATH_LAYOUT } from './mathStop.js';
import { signed } from '../math/economy.js';
import { openWhiteboard, closeWhiteboard, clearWhiteboard, isWhiteboardOpen } from './whiteboard.js';

const W = GAME_WIDTH;
const H = GAME_HEIGHT;
const ML = MATH_LAYOUT;

// Game-space layout (the smoke test taps these).
export const REVIEW_LAYOUT = {
    back: { x: 164, y: 668 },
    whiteboard: { x: 430, y: 668 },
    next: { x: 790, y: 668 },
    close: { x: 924, y: 126 },
    yours: { y: 200 },
    right: { y: 334 },
    explain: { x: 44, y: 490, w: 936, h: 118 }
};
const L = REVIEW_LAYOUT;
// Each card must be on screen this long (first visit only) before Next
// unlocks, so the bonus can't be collected by tapping through blind.
export const REVIEW_READ_MS = 1200;

/**
 * Steps through Math Stops from a finished race, one card each: the
 * question (and diagram), the player's answer, the right answer and how to
 * get it. `stops` are RaceScene log entries. `onDone(completed)` runs after
 * the layer is gone; completed is true only when the last card was reached
 * and Done tapped. Live state is on `scene.review` (used by the smoke test).
 */
export function showReview(scene, stops, opts, onDone) {
    const state = { index: 0, total: stops.length, mode: opts.mode, bonus: opts.bonus || 0, canNext: false, seen: {}, finished: false, closed: false };
    scene.review = state;
    clearWhiteboard();

    const layer = scene.add.container(0, 0).setDepth(400);
    layer.add(scene.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.55).setInteractive());
    const frame = scene.add.graphics();
    drawPanel(frame, 20, 84, 984, 668, COLORS.white, 34);
    drawPanel(frame, 332, 50, 360, 66, COLORS.orange, 33);
    layer.add(frame);
    const header = scene.add.text(W / 2, 83, '', textStyle(34, '#ffffff', { stroke: INK, strokeThickness: 6 })).setOrigin(0.5);
    const sub = scene.add.text(W / 2, 132, '', textStyle(20, '#868e96')).setOrigin(0.5);
    layer.add([header, sub]);

    let card = null;
    let unlockTimer = null;

    const backBtn = createButton(scene, L.back.x, L.back.y, {
        width: 230, height: 84, radius: 26, label: '\u25C0 Back', fontSize: 34, color: COLORS.blue,
        onTap: () => go(state.index - 1)
    });
    const boardBtn = createButton(scene, L.whiteboard.x, L.whiteboard.y, {
        width: 260, height: 84, radius: 26, label: 'Whiteboard', fontSize: 34, color: COLORS.purple,
        onTap: () => {
            if (isWhiteboardOpen() || state.closed) return;
            scene.whiteboardOpen = true;
            openWhiteboard({ title: stops[state.index].problem.question, onClose: () => { scene.whiteboardOpen = false; } });
        }
    });
    const nextBtn = createButton(scene, L.next.x, L.next.y, {
        width: 380, height: 84, radius: 26, label: 'Next \u25B6', fontSize: 34, color: COLORS.green,
        onTap: () => next()
    });
    const closeBtn = createButton(scene, L.close.x, L.close.y, {
        width: 120, height: 56, radius: 20, label: 'Close', fontSize: 24, color: COLORS.grayDark,
        onTap: () => finish(false)
    });
    layer.add([backBtn, boardBtn, nextBtn, closeBtn]);

    function next() {
        if (!state.canNext || state.closed) return;
        if (state.index < stops.length - 1) go(state.index + 1);
        else finish(true);
    }

    function go(i) {
        if (i < 0 || i >= stops.length || state.closed) return;
        closeWhiteboard();
        clearWhiteboard();
        state.index = i;
        render();
    }

    function render() {
        if (card) card.destroy();
        if (unlockTimer) unlockTimer.remove(false);
        card = scene.add.container(0, 0);
        layer.addAt(card, 2);
        const stop = stops[state.index];
        const p = stop.problem;
        const last = state.index === stops.length - 1;
        const what = state.mode === 'mistakes' ? 'MISTAKE' : 'QUESTION';
        header.setText(what + ' ' + (state.index + 1) + ' of ' + stops.length);
        sub.setText('Lap ' + stop.lap + ' \u2022 Star ' + stop.star + (stop.hintUsed ? ' \u2022 you used a hint' : ''));

        let question;
        if (p.diagram) {
            const long = p.question.length > 60;
            question = scene.add.text(ML.left.cx, ML.questionTop, p.question, textStyle(long ? 26 : 30, INK, {
                wordWrap: { width: ML.left.w - 10 }, lineSpacing: 2
            })).setOrigin(0.5, 0);
            card.add(question);
            fitText(question, ML.left.w - 10, long ? 118 : 76, 18);
            const top = question.y + question.height + 6;
            drawDiagram(scene, card, p.diagram, { x: ML.left.x, y: top, w: ML.left.w, h: 474 - top });
        } else {
            question = scene.add.text(ML.left.cx, 310, p.question, textStyle(60, INK, { wordWrap: { width: ML.left.w - 10 } })).setOrigin(0.5);
            card.add(question);
            fitText(question, ML.left.w - 10, 250, 28);
        }

        const g = scene.add.graphics();
        card.add(g);
        const box = (y, label, value, fill, stroke, color) => {
            g.fillStyle(fill, 1);
            g.fillRoundedRect(ML.right.x, y, ML.right.w, 96, 20);
            g.lineStyle(4, stroke, 1);
            g.strokeRoundedRect(ML.right.x, y, ML.right.w, 96, 20);
            card.add(scene.add.text(ML.right.x + 18, y + 10, label, textStyle(20, '#495057', { align: 'left' })));
            const t = scene.add.text(ML.right.cx, y + 58, value, textStyle(42, color)).setOrigin(0.5);
            card.add(t);
            fitText(t, ML.right.w - 30, 50, 20);
            return t;
        };
        const yours = box(L.yours.y, stop.correct ? 'Your answer \u2713' : 'Your answer \u2717', formatAnswer(p, stop.given),
            stop.correct ? 0xd3f9d8 : 0xffe3e3, stop.correct ? COLORS.green : COLORS.red, stop.correct ? '#2b8a3e' : '#c92a2a');
        const right = box(L.right.y, 'Right answer', formatAnswer(p, p.answer), 0xd3f9d8, COLORS.green, '#2b8a3e');
        state.yoursText = yours.text;
        state.rightText = right.text;
        card.add(scene.add.text(ML.right.cx, 454, 'That stop: ' + signed(stop.delta) + (Math.abs(stop.delta) === 1 ? ' coin' : ' coins'),
            textStyle(22, stop.delta >= 0 ? '#2b8a3e' : '#c92a2a')).setOrigin(0.5));

        g.fillStyle(stop.correct ? 0xd3f9d8 : 0xfff3bf, 1);
        g.fillRoundedRect(L.explain.x, L.explain.y, L.explain.w, L.explain.h, 18);
        g.lineStyle(3, COLORS.ink, 1);
        g.strokeRoundedRect(L.explain.x, L.explain.y, L.explain.w, L.explain.h, 18);
        const how = scene.add.text(L.explain.x + 18, L.explain.y + 12, 'Here\u2019s how: ' + p.explain + (p.hint ? '\nTip: ' + p.hint : ''), textStyle(22, INK, {
            align: 'left', wordWrap: { width: L.explain.w - 36 }, lineSpacing: 3
        }));
        card.add(how);
        fitText(how, L.explain.w - 36, L.explain.h - 18, 14);
        state.explainText = how.text;

        backBtn.setVisible(state.index > 0).setLocked(state.index === 0);
        const bonusLabel = state.mode === 'mistakes' && state.bonus > 0 ? 'Done \u2713  +' + state.bonus : 'Done \u2713';
        nextBtn.setLabel(last ? bonusLabel : 'Next \u25B6');
        nextBtn.setColor(last ? COLORS.gold : COLORS.green);
        const seen = state.seen[state.index];
        state.seen[state.index] = true;
        state.canNext = !!seen;
        nextBtn.setEnabled(state.canNext);
        if (!seen) {
            unlockTimer = scene.time.delayedCall(REVIEW_READ_MS, () => {
                state.canNext = true;
                nextBtn.setEnabled(true);
            });
        }
    }

    const keyboard = scene.input.keyboard;
    const onKey = (event) => {
        if (event.mkHandled) return;
        event.mkHandled = true;
        if (state.closed || isWhiteboardOpen()) return;
        if (event.key === 'ArrowRight' || event.key === 'Enter') next();
        else if (event.key === 'ArrowLeft') go(state.index - 1);
        else if (event.key === 'Escape') finish(false);
    };
    if (keyboard) keyboard.on('keydown', onKey);

    function finish(completed) {
        if (state.closed) return;
        state.closed = true;
        state.finished = completed;
        if (unlockTimer) unlockTimer.remove(false);
        if (keyboard) keyboard.off('keydown', onKey);
        closeWhiteboard();
        scene.tweens.add({
            targets: layer,
            alpha: 0,
            duration: 160,
            onComplete: () => {
                layer.destroy();
                onDone(completed);
            }
        });
    }

    render();
    layer.setAlpha(0);
    scene.tweens.add({ targets: layer, alpha: 1, duration: 160 });
    return state;
}
