import { buildLoop } from './trackMath.js';

/**
 * Course data and the unlock ladder (no Phaser, so the Node unit test can
 * check every layout). Each course is one closed loop of waypoints; road
 * art, AI path, checkpoints and race progress all come from it.
 *
 * Ids are stored in saves: never rename one ('forest' is Meadow Loop).
 */

export const ROAD_WIDTH = 190;

const COURSES = {
    forest: {
        name: 'Meadow Loop',
        blurb: 'Flowers and big round trees',
        cost: 0,
        width: 2400,
        height: 1600,
        palette: { ground: 0x5cc85c, road: 0x8d7b68, edge: 0xf1e3c8, deco: 0x2b8a3e },
        prizes: [50, 30, 15],
        aiSpeed: 1,
        checkpointIndexes: [4, 8, 13],
        points: [
            [320, 520], [320, 900], [400, 1170], [640, 1320], [1000, 1340],
            [1380, 1240], [1740, 1320], [2040, 1230], [2150, 980], [2100, 690],
            [1960, 400], [1660, 270], [1300, 330], [1010, 470], [720, 330], [450, 300]
        ]
    },
    desert: {
        name: 'Desert Canyon',
        blurb: 'Twisty sand roads and cactus!',
        cost: 100,
        width: 2400,
        height: 1600,
        palette: { ground: 0xf2d49b, road: 0xb08968, edge: 0xfff3d6, deco: 0x2f9e44 },
        prizes: [60, 35, 20],
        aiSpeed: 1.04,
        checkpointIndexes: [4, 9, 15],
        points: [
            [360, 420], [360, 800], [440, 1140], [720, 1320], [1060, 1260],
            [1240, 1010], [1440, 820], [1760, 860], [1960, 1100], [2140, 1260],
            [2240, 1120], [2230, 900], [2210, 620], [2020, 340], [1660, 260], [1310, 390],
            [1010, 560], [730, 430], [540, 270]
        ]
    },
    pine: {
        name: 'Pine Path',
        blurb: 'Dark woods, logs and a big S-bend',
        cost: 250,
        width: 2400,
        height: 1600,
        palette: { ground: 0x2f7d4a, road: 0x6b4f3a, edge: 0xd9b98c, deco: 0x14532d },
        prizes: [70, 40, 20],
        aiSpeed: 1.08,
        checkpointIndexes: [5, 10, 16],
        points: [
            [300, 780], [320, 1130], [520, 1370], [860, 1400], [1110, 1260],
            [1200, 1010], [1380, 850], [1620, 920], [1740, 1160], [1960, 1360],
            [2170, 1230], [2180, 930], [2110, 640], [2140, 390], [1930, 240],
            [1600, 270], [1400, 440], [1150, 470], [900, 330], [620, 250],
            [390, 360], [300, 570]
        ]
    },
    snow: {
        name: 'Snow Circuit',
        blurb: 'A frozen lake and snowy hills',
        cost: 450,
        width: 2400,
        height: 1600,
        palette: { ground: 0xeaf4fb, road: 0x7d93ab, edge: 0x3b5b7a, deco: 0x74c0fc },
        prizes: [80, 45, 25],
        aiSpeed: 1.12,
        checkpointIndexes: [5, 10, 14],
        points: [
            [360, 700], [380, 1050], [560, 1320], [900, 1400], [1230, 1330],
            [1450, 1180], [1700, 1200], [1900, 1380], [2150, 1300], [2200, 1000],
            [2150, 700], [1950, 450], [1650, 300], [1300, 260], [950, 300],
            [650, 260], [430, 380]
        ]
    },
    city: {
        name: 'Night City',
        blurb: 'Bright lights and sharp corners',
        cost: 700,
        width: 2400,
        height: 1600,
        palette: { ground: 0x1f2544, road: 0x44475a, edge: 0xffd43b, deco: 0xffe066 },
        prizes: [90, 50, 30],
        aiSpeed: 1.15,
        checkpointIndexes: [6, 11, 16],
        points: [
            [300, 500], [300, 1200], [420, 1350], [800, 1350], [900, 1250],
            [900, 950], [1000, 850], [1300, 850], [1400, 950], [1400, 1250],
            [1500, 1350], [2000, 1350], [2120, 1230], [2120, 800], [2000, 680],
            [1720, 680], [1600, 580], [1600, 340], [1480, 230], [500, 230], [330, 340]
        ]
    }
};

/** Unlock ladder: each course needs the one before it. */
export const COURSE_ORDER = ['forest', 'desert', 'pine', 'snow', 'city'];
export const STARTER_COURSE = 'forest';

export function isCourse(id) {
    return Object.prototype.hasOwnProperty.call(COURSES, id);
}

export function getCourse(id) {
    const key = isCourse(id) ? id : STARTER_COURSE;
    const c = COURSES[key];
    return Object.assign({ id: key }, c);
}

export function allCourses() {
    return COURSE_ORDER.map(getCourse);
}

/** The course that must be unlocked before this one (null for the starter). */
export function requiredCourse(id) {
    const i = COURSE_ORDER.indexOf(id);
    return i > 0 ? COURSE_ORDER[i - 1] : null;
}

/**
 * 'unlocked', 'next' (can be bought now), or 'later' (an earlier course is
 * still locked).
 */
export function courseStatus(id, unlocked) {
    if (id === STARTER_COURSE || unlocked.indexOf(id) !== -1) return 'unlocked';
    const req = requiredCourse(id);
    return !req || req === STARTER_COURSE || unlocked.indexOf(req) !== -1 ? 'next' : 'later';
}

/** Loop, checkpoints and bounds for race logic (shared by game and tests). */
export function courseGeometry(id) {
    const c = getCourse(id);
    const points = c.points.map((p) => ({ x: p[0], y: p[1] }));
    const loop = buildLoop(points);
    const checkpoints = c.checkpointIndexes.map((index, i) => ({
        x: points[index].x,
        y: points[index].y,
        along: loop.segs[index].start,
        label: String(i + 1)
    }));
    return {
        id: c.id,
        name: c.name,
        width: c.width,
        height: c.height,
        points,
        loop,
        checkpoints,
        roadHalfWidth: ROAD_WIDTH / 2
    };
}
