import { buildLoop, roundedLoop, pointAt } from './trackMath.js';
import { buildFeatures } from './features.js';

/**
 * Course data and the unlock ladder (no Phaser, so the Node unit test can
 * check every layout). Each course is a closed list of corners
 * [x, y, radius?]; roundedLoop() turns it into a smooth waypoint loop, and
 * road art, AI path, checkpoints, features and race progress all come from
 * that loop. Checkpoints, ramps and the river are placed by lap fraction
 * (0 = start line, 0.5 = half way round).
 *
 * Ids are stored in saves: never rename one ('forest' is Meadow Loop).
 */

export const ROAD_WIDTH = 190;

const COURSES = {
    forest: {
        name: 'Meadow Loop',
        blurb: 'Creek crossing: take the bridge!',
        cost: 0,
        width: 2400,
        height: 1600,
        palette: { ground: 0x5cc85c, road: 0x8d7b68, edge: 0xf1e3c8, deco: 0x2b8a3e },
        prizes: [50, 30, 15],
        aiSpeed: 1,
        radius: 330,
        corners: [
            [320, 400], [300, 1340, 250], [2000, 1360], [2090, 560],
            [1580, 280], [1250, 560, 240], [800, 290]
        ],
        checkpoints: [0.4, 0.63, 0.84],
        river: { at: 0.236, side: -1, width: 150, near: 420, far: 540, wiggle: 50, pond: 120, bridge: { offset: 280, flat: 170, ramp: 280, radius: 180 } }
    },
    desert: {
        name: 'Desert Canyon',
        blurb: 'Long canyon with big jumps',
        cost: 100,
        width: 2500,
        height: 1700,
        palette: { ground: 0xf2d49b, road: 0xb08968, edge: 0xfff3d6, deco: 0x2f9e44 },
        prizes: [60, 35, 20],
        aiSpeed: 1.04,
        radius: 290,
        corners: [
            [300, 1450], [1420, 1450], [2200, 1450], [2230, 980], [1050, 1000],
            [1050, 620], [2200, 620], [2230, 250], [380, 260]
        ],
        checkpoints: [0.24, 0.5, 0.78],
        ramps: [{ kind: 'jump', at: 0.08 }, { kind: 'jump', at: 0.66 }, { kind: 'bump', at: 0.43 }, { kind: 'bump', at: 0.456 }]
    },
    pine: {
        name: 'Pine Path',
        blurb: 'Twisty woods and a river',
        cost: 250,
        width: 2600,
        height: 2000,
        palette: { ground: 0x2f7d4a, road: 0x6b4f3a, edge: 0xd9b98c, deco: 0x14532d },
        prizes: [70, 40, 20],
        aiSpeed: 1.08,
        radius: 190,
        corners: [
            [300, 1740, 170], [1300, 1740], [1600, 1370], [1950, 1740], [2300, 1660],
            [2300, 1000], [1950, 850], [2200, 450], [1500, 300], [1300, 700],
            [900, 450], [300, 170, 180]
        ],
        checkpoints: [0.18, 0.4, 0.65],
        ramps: [{ kind: 'bump', at: 0.29 }, { kind: 'bump', at: 0.48 }],
        river: { at: 0.833, side: -1, width: 150, near: 400, far: 520, wiggle: 50, pond: 120, bridge: { offset: 280, flat: 170, ramp: 280, radius: 180 } }
    },
    snow: {
        name: 'Snow Circuit',
        blurb: 'Figure 8 with snowy bumps',
        cost: 450,
        width: 2600,
        height: 1700,
        palette: { ground: 0xeaf4fb, road: 0x7d93ab, edge: 0x3b5b7a, deco: 0x74c0fc },
        prizes: [80, 45, 25],
        aiSpeed: 1.12,
        radius: 260,
        crossings: 1,
        lake: { x: 650, y: 850, rx: 230, ry: 170 },
        corners: [
            [2400, 480], [2400, 1260], [2050, 1400], [550, 300], [200, 500],
            [200, 1200], [550, 1400], [2050, 300]
        ],
        checkpoints: [0.14, 0.45, 0.9],
        ramps: [{ kind: 'bump', at: 0.302 }, { kind: 'bump', at: 0.333 }, { kind: 'bump', at: 0.8 }, { kind: 'bump', at: 0.831 }]
    },
    city: {
        name: 'Night City',
        blurb: 'Short, sharp and jumpy',
        cost: 700,
        width: 2300,
        height: 1500,
        palette: { ground: 0x1f2544, road: 0x44475a, edge: 0xffd43b, deco: 0xffe066 },
        prizes: [90, 50, 30],
        aiSpeed: 1.15,
        radius: 170,
        corners: [
            [300, 1250], [1080, 1250], [1450, 1250], [1450, 850], [2000, 850],
            [2000, 300], [950, 300], [950, 700], [300, 700]
        ],
        checkpoints: [0.25, 0.62, 0.8],
        ramps: [{ kind: 'jump', at: 0.03 }, { kind: 'jump', at: 0.49 }]
    }
};

/** Unlock ladder: each course needs the one before it. */
export const COURSE_ORDER = ['forest', 'desert', 'pine', 'snow', 'city'];
export const STARTER_COURSE = 'forest';

export function isCourse(id) {
    return Object.prototype.hasOwnProperty.call(COURSES, id);
}

const pointCache = {};

/** The course's waypoint loop as [x, y] pairs. */
export function coursePoints(id) {
    if (!pointCache[id]) {
        const c = COURSES[id];
        pointCache[id] = roundedLoop(c.corners, c.radius).map((p) => [p.x, p.y]);
    }
    return pointCache[id];
}

export function getCourse(id) {
    const key = isCourse(id) ? id : STARTER_COURSE;
    const c = COURSES[key];
    return Object.assign({ id: key, points: coursePoints(key) }, c);
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

/** Short list of what's special on a course (menu cards, docs, tests). */
export function courseHazards(id) {
    const c = getCourse(id);
    const out = [];
    const kinds = (c.ramps || []).map((r) => r.kind);
    if (kinds.indexOf('jump') !== -1) out.push('jumps');
    if (kinds.indexOf('bump') !== -1) out.push('bumps');
    if (c.river) out.push(c.river.bridge ? 'river + bridge' : 'river');
    if (c.crossings) out.push('figure 8');
    return out;
}

/** Loop, checkpoints, features and bounds for race logic (shared by game and tests). */
export function courseGeometry(id) {
    const c = getCourse(id);
    const points = c.points.map((p) => ({ x: p[0], y: p[1] }));
    const loop = buildLoop(points);
    const checkpoints = c.checkpoints.map((f, i) => {
        const along = f * loop.total;
        const p = pointAt(loop, along);
        return { x: p.x, y: p.y, along, label: String(i + 1) };
    });
    return {
        id: c.id,
        name: c.name,
        width: c.width,
        height: c.height,
        points,
        loop,
        checkpoints,
        features: buildFeatures(c, loop, ROAD_WIDTH),
        roadHalfWidth: ROAD_WIDTH / 2
    };
}
