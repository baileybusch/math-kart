import Phaser from 'phaser';

const RENDERER_KEY = 'mathKartRenderer';

function bootApi() {
    return window.MathKartBoot || null;
}

export function markBooted() {
    const api = bootApi();
    if (api) api.ready();
}

export function reportBootError(reason, err) {
    const detail = err ? String((err && err.message) || err) : '';
    const api = bootApi();
    if (api) {
        api.fail(reason, detail);
    } else if (window.console) {
        window.console.error(reason, err);
    }
}

function sessionGet(key) {
    try {
        return window.sessionStorage.getItem(key);
    } catch (e) {
        return null;
    }
}

export function rememberRenderer(value) {
    try {
        window.sessionStorage.setItem(RENDERER_KEY, value);
    } catch (e) {
        // Private mode: the ?renderer= URL override still works.
    }
}

/** iOS 12 and older (iPad mini 2/3, iPad Air 1, iPhone 5s/6). */
export function isLegacyIOS(ua) {
    const m = /(?:iPad|iPhone|iPod).*? OS (\d+)_/.exec(ua || '');
    return !!m && parseInt(m[1], 10) < 13;
}

function webglAvailable() {
    try {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        return !!(gl && gl.getParameter);
    } catch (e) {
        return false;
    }
}

/**
 * Canvas is the default on old iOS: the A7 GPU and iOS 12 WebGL stack are the
 * most likely thing to fail, and this game only draws flat shapes and text.
 * Override with ?renderer=canvas|webgl|auto.
 */
export function chooseRenderer() {
    const m = /[?&]renderer=(canvas|webgl|auto)/i.exec(window.location.search || '');
    const forced = (m && m[1].toLowerCase()) || sessionGet(RENDERER_KEY);
    if (forced === 'canvas') return { type: Phaser.CANVAS, reason: 'forced canvas' };
    if (forced === 'webgl') return { type: Phaser.WEBGL, reason: 'forced webgl' };
    if (forced === 'auto') return { type: Phaser.AUTO, reason: 'forced auto' };
    if (isLegacyIOS(navigator.userAgent)) return { type: Phaser.CANVAS, reason: 'old iOS' };
    if (!webglAvailable()) return { type: Phaser.CANVAS, reason: 'no WebGL' };
    return { type: Phaser.AUTO, reason: 'auto' };
}

export function rendererName(game) {
    if (!game || !game.config) return 'unknown';
    return game.config.renderType === Phaser.WEBGL ? 'webgl' : 'canvas';
}

export function whenDomReady(fn) {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', fn);
    } else {
        fn();
    }
}
