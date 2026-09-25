/**
 * Full-screen scratch pad for working things out with a finger (or mouse).
 *
 * Plain DOM + Canvas 2D so it works on iOS 12 Safari: touch events with a
 * mouse fallback (no Pointer Events - iOS 12 doesn't have them). Touches on
 * the pad never reach Phaser, so they can't press race pedals or answer
 * buttons underneath. Strokes are kept so the drawing survives a resize and
 * reopening for the same question; nothing here is graded.
 */

const TOOLS = {
    pen: { color: '#1d2b53', width: 6 },
    red: { color: '#e03131', width: 6 },
    eraser: { width: 44, erase: true }
};
const MAX_DPR = 2;

let root = null;
let pad = null;
let canvas = null;
let ctx = null;
let questionEl = null;
let toolButtons = {};
let gridButton = null;

let strokes = [];
let live = {};
let tool = 'pen';
let grid = true;
let isOpen = false;
let onClose = null;
let dpr = 1;
let padRect = null;

function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
}

function button(label, className, onClick) {
    const b = el('button', 'mk-wb-btn' + (className ? ' ' + className : ''), label);
    b.type = 'button';
    b.addEventListener('click', (e) => {
        e.preventDefault();
        onClick();
    }, false);
    return b;
}

function stop(e) {
    e.stopPropagation();
}

function build() {
    if (root) return;
    root = el('div', 'mk-wb mk-hidden');
    root.id = 'mk-whiteboard';

    const bar = el('div', 'mk-wb-bar');
    const tools = el('div', 'mk-wb-tools');
    toolButtons.pen = button('Pen', 'mk-wb-pen', () => setTool('pen'));
    toolButtons.red = button('Red', 'mk-wb-red', () => setTool('red'));
    toolButtons.eraser = button('Eraser', '', () => setTool('eraser'));
    tools.appendChild(toolButtons.pen);
    tools.appendChild(toolButtons.red);
    tools.appendChild(toolButtons.eraser);
    tools.appendChild(button('Undo', '', undo));
    tools.appendChild(button('Clear', '', clearWhiteboard));
    gridButton = button('Grid', '', toggleGrid);
    tools.appendChild(gridButton);
    bar.appendChild(tools);
    const done = button('Done \u2713', 'mk-wb-done', closeWhiteboard);
    done.id = 'mk-wb-done';
    bar.appendChild(done);

    pad = el('div', 'mk-wb-pad');
    canvas = el('canvas', 'mk-wb-canvas');
    canvas.id = 'mk-wb-canvas';
    questionEl = el('div', 'mk-wb-question');
    pad.appendChild(canvas);
    pad.appendChild(questionEl);

    root.appendChild(bar);
    root.appendChild(pad);
    document.body.appendChild(root);
    ctx = canvas.getContext('2d');

    // Keep every touch/mouse event on the pad away from Phaser's window
    // listeners (they would otherwise register taps on the game).
    ['touchstart', 'touchmove', 'touchend', 'touchcancel', 'mousedown', 'mousemove', 'mouseup'].forEach((type) => {
        root.addEventListener(type, stop, false);
    });
    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    canvas.addEventListener('touchend', onTouchEnd, { passive: false });
    canvas.addEventListener('touchcancel', onTouchEnd, { passive: false });
    canvas.addEventListener('mousedown', onMouseDown, false);
    root.addEventListener('mousemove', onMouseMove, false);
    root.addEventListener('mouseup', onMouseUp, false);

    setTool('pen');
    refreshGrid();
}

function setTool(name) {
    tool = name;
    Object.keys(toolButtons).forEach((k) => {
        toolButtons[k].className = toolButtons[k].className.replace(/\s*is-on/g, '') + (k === name ? ' is-on' : '');
    });
}

function refreshGrid() {
    pad.className = 'mk-wb-pad' + (grid ? '' : ' mk-wb-nogrid');
    gridButton.className = gridButton.className.replace(/\s*is-on/g, '') + (grid ? ' is-on' : '');
}

function toggleGrid() {
    grid = !grid;
    refreshGrid();
}

function undo() {
    strokes.pop();
    redraw();
}

function resize() {
    if (!canvas) return;
    dpr = Math.min(MAX_DPR, window.devicePixelRatio || 1);
    const w = pad.clientWidth;
    const h = pad.clientHeight;
    canvas.width = Math.max(1, Math.round(w * dpr));
    canvas.height = Math.max(1, Math.round(h * dpr));
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    padRect = null;
    redraw();
}

function style(stroke) {
    ctx.globalCompositeOperation = stroke.erase ? 'destination-out' : 'source-over';
    ctx.strokeStyle = stroke.color || '#000';
    ctx.fillStyle = stroke.color || '#000';
    ctx.lineWidth = stroke.width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
}

function dot(stroke, x, y) {
    style(stroke);
    ctx.beginPath();
    ctx.arc(x, y, stroke.width / 2, 0, Math.PI * 2);
    ctx.fill();
}

function segment(stroke, x0, y0, x1, y1) {
    style(stroke);
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
}

function redraw() {
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    strokes.forEach((s) => {
        const p = s.points;
        dot(s, p[0], p[1]);
        for (let i = 2; i < p.length; i += 2) segment(s, p[i - 2], p[i - 1], p[i], p[i + 1]);
    });
}

function local(clientX, clientY) {
    if (!padRect) padRect = canvas.getBoundingClientRect();
    return { x: clientX - padRect.left, y: clientY - padRect.top };
}

function begin(id, clientX, clientY) {
    const t = TOOLS[tool];
    const p = local(clientX, clientY);
    const stroke = { color: t.color, width: t.width, erase: !!t.erase, points: [p.x, p.y] };
    strokes.push(stroke);
    live[id] = stroke;
    dot(stroke, p.x, p.y);
}

function extend(id, clientX, clientY) {
    const stroke = live[id];
    if (!stroke) return;
    const p = local(clientX, clientY);
    const pts = stroke.points;
    const lx = pts[pts.length - 2];
    const ly = pts[pts.length - 1];
    if (Math.abs(p.x - lx) + Math.abs(p.y - ly) < 1.5) return;
    pts.push(p.x, p.y);
    segment(stroke, lx, ly, p.x, p.y);
}

function end(id) {
    delete live[id];
}

function onTouchStart(e) {
    e.preventDefault();
    for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        begin('t' + t.identifier, t.clientX, t.clientY);
    }
}

function onTouchMove(e) {
    e.preventDefault();
    for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        extend('t' + t.identifier, t.clientX, t.clientY);
    }
}

function onTouchEnd(e) {
    e.preventDefault();
    for (let i = 0; i < e.changedTouches.length; i++) end('t' + e.changedTouches[i].identifier);
}

function onMouseDown(e) {
    if (e.button !== 0) return;
    e.preventDefault();
    begin('m', e.clientX, e.clientY);
}

function onMouseMove(e) {
    if (live.m) extend('m', e.clientX, e.clientY);
}

function onMouseUp() {
    end('m');
}

function onKey(e) {
    if (e.key === 'Escape' || e.keyCode === 27) closeWhiteboard();
}

export function openWhiteboard(opts) {
    build();
    const o = opts || {};
    questionEl.textContent = o.title || '';
    questionEl.style.display = o.title ? '' : 'none';
    onClose = o.onClose || null;
    live = {};
    root.className = root.className.replace(/\s*mk-hidden/g, '');
    isOpen = true;
    resize();
    window.addEventListener('resize', resize, false);
    window.addEventListener('orientationchange', resize, false);
    window.addEventListener('keydown', onKey, false);
}

export function closeWhiteboard() {
    if (!isOpen) return;
    isOpen = false;
    live = {};
    root.className += ' mk-hidden';
    window.removeEventListener('resize', resize, false);
    window.removeEventListener('orientationchange', resize, false);
    window.removeEventListener('keydown', onKey, false);
    const cb = onClose;
    onClose = null;
    if (cb) cb();
}

/** Wipes the drawing (Clear button, and whenever a new question starts). */
export function clearWhiteboard() {
    strokes = [];
    live = {};
    redraw();
}

export function isWhiteboardOpen() {
    return isOpen;
}

export function whiteboardInfo() {
    return { open: isOpen, strokes: strokes.length, tool, grid };
}
