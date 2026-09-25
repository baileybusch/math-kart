import { isGrade, DEFAULT_GRADE } from '../math/grades.js';

const SAVE_KEY = 'mathKartSave';

const DEFAULT_SAVE = {
    coins: 0,
    unlockedCourses: ['forest'],
    unlockedColors: ['red'],
    currentColor: 'red',
    speedUpgrades: 0,
    handlingUpgrades: 0,
    difficulty: 1,
    lastCourse: 'forest',
    grade: DEFAULT_GRADE
};

// iOS 12 Safari throws on localStorage.setItem in Private Browsing, so keep an
// in-memory copy and treat storage as best-effort.
let memorySave = null;
let storageChecked = false;
let storage = null;

function getStorage() {
    if (storageChecked) return storage;
    storageChecked = true;
    try {
        const s = window.localStorage;
        const probe = '__mathKartProbe';
        s.setItem(probe, '1');
        s.removeItem(probe);
        storage = s;
    } catch (e) {
        storage = null;
    }
    return storage;
}

function clone(data) {
    return JSON.parse(JSON.stringify(data));
}

function toCount(value, max) {
    const n = Math.floor(Number(value));
    if (!isFinite(n) || n < 0) return 0;
    return Math.min(n, max);
}

function sanitize(raw) {
    const data = clone(DEFAULT_SAVE);
    if (!raw || typeof raw !== 'object') return data;

    data.coins = toCount(raw.coins, 999999);
    data.speedUpgrades = toCount(raw.speedUpgrades, 5);
    data.handlingUpgrades = toCount(raw.handlingUpgrades, 5);
    data.difficulty = toCount(raw.difficulty, 5) || 1;

    if (Array.isArray(raw.unlockedCourses)) {
        data.unlockedCourses = raw.unlockedCourses.filter((c) => typeof c === 'string');
    }
    if (data.unlockedCourses.indexOf('forest') === -1) data.unlockedCourses.unshift('forest');

    if (Array.isArray(raw.unlockedColors)) {
        data.unlockedColors = raw.unlockedColors.filter((c) => typeof c === 'string');
    }
    if (data.unlockedColors.indexOf('red') === -1) data.unlockedColors.unshift('red');

    if (typeof raw.currentColor === 'string' && data.unlockedColors.indexOf(raw.currentColor) !== -1) {
        data.currentColor = raw.currentColor;
    }
    if (typeof raw.lastCourse === 'string' && data.unlockedCourses.indexOf(raw.lastCourse) !== -1) {
        data.lastCourse = raw.lastCourse;
    }
    const grade = Number(raw.grade);
    if (isGrade(grade)) data.grade = grade;
    return data;
}

export function getSaveData() {
    if (memorySave) return clone(memorySave);
    let parsed = null;
    const s = getStorage();
    if (s) {
        try {
            const text = s.getItem(SAVE_KEY);
            parsed = text ? JSON.parse(text) : null;
        } catch (e) {
            parsed = null;
        }
    }
    memorySave = sanitize(parsed);
    return clone(memorySave);
}

export function updateSaveData(newData) {
    memorySave = sanitize(newData);
    const s = getStorage();
    if (!s) return false;
    try {
        s.setItem(SAVE_KEY, JSON.stringify(memorySave));
        return true;
    } catch (e) {
        return false;
    }
}

export function ensureSaveData() {
    updateSaveData(getSaveData());
}

export function resetSaveData() {
    memorySave = null;
    const s = getStorage();
    if (s) {
        try {
            s.removeItem(SAVE_KEY);
        } catch (e) {
            // Nothing else to clean up.
        }
    }
}
