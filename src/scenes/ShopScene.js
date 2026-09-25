import Phaser from 'phaser';
import { getSaveData, updateSaveData } from '../utils/saveManager.js';
import { allCourses, courseStatus, getCourse, requiredCourse, STARTER_COURSE } from '../game/courses.js';
import { drawCoursePreview } from '../ui/coursePreview.js';
import {
    GAME_WIDTH, GAME_HEIGHT, COLORS, INK, KART_COLORS, textStyle, addTitle, drawPanel,
    drawKart, drawMenuBackdrop, createButton, createCoinPill, fadeToScene
} from '../ui/theme.js';

const W = GAME_WIDTH;
const H = GAME_HEIGHT;
const UPGRADE_COST = 30;
const MAX_LEVEL = 5;
const COLOR_COST = 20;

export default class ShopScene extends Phaser.Scene {
    constructor() {
        super({ key: 'ShopScene' });
    }

    init(data) {
        this.toastText = (data && data.toast) || null;
    }

    create() {
        const save = getSaveData();
        this.save = save;

        drawMenuBackdrop(this);
        addTitle(this, W / 2, 62, 'SHOP', 84);
        createCoinPill(this, W - 118, 56, save.coins);
        createButton(this, 104, 56, {
            width: 170, height: 76, radius: 26, label: '\u25C0 Back', fontSize: 34,
            color: COLORS.red,
            onTap: () => fadeToScene(this, 'MenuScene')
        });

        this.createUpgrades(40, 128, 460, 342);
        this.createPaint(524, 128, 460, 342);
        this.createTracks(40, 484, 944, 268);

        if (this.toastText) this.toast(this.toastText, COLORS.green);
    }

    sectionHeader(x, y, width, label) {
        this.add.text(x + width / 2, y + 36, label, textStyle(32, INK)).setOrigin(0.5);
    }

    buy(cost, apply, message) {
        const save = getSaveData();
        if (save.coins < cost) {
            this.toast('You need ' + (cost - save.coins) + ' more coins. Win races to earn more!', COLORS.orange);
            return;
        }
        save.coins -= cost;
        apply(save);
        updateSaveData(save);
        this.scene.restart({ toast: message });
    }

    createUpgrades(x, y, width, height) {
        const g = this.add.graphics();
        drawPanel(g, x, y, width, height, COLORS.white, 28);
        this.sectionHeader(x, y, width, 'Kart Upgrades');

        const rows = [
            { key: 'speedUpgrades', name: 'Speed', blurb: 'Go faster!', color: COLORS.orange },
            { key: 'handlingUpgrades', name: 'Steering', blurb: 'Turn quicker!', color: COLORS.blue }
        ];
        rows.forEach((row, i) => {
            const ry = y + 120 + i * 130;
            const level = this.save[row.key];
            this.add.text(x + 30, ry - 30, row.name, textStyle(34, INK, { align: 'left' })).setOrigin(0, 0.5);
            this.add.text(x + 30, ry + 6, row.blurb, textStyle(20, '#868e96', { align: 'left' })).setOrigin(0, 0.5);

            const pips = this.add.graphics();
            for (let p = 0; p < MAX_LEVEL; p++) {
                pips.fillStyle(p < level ? row.color : 0xdee2e6, 1);
                pips.fillRoundedRect(x + 30 + p * 36, ry + 30, 28, 20, 6);
                pips.lineStyle(3, COLORS.ink, 1);
                pips.strokeRoundedRect(x + 30 + p * 36, ry + 30, 28, 20, 6);
            }

            const maxed = level >= MAX_LEVEL;
            const affordable = this.save.coins >= UPGRADE_COST;
            createButton(this, x + width - 110, ry + 4, {
                width: 180, height: 92, radius: 26,
                label: maxed ? 'MAX!' : 'Buy\n' + UPGRADE_COST + ' coins',
                fontSize: maxed ? 36 : 26,
                color: maxed ? COLORS.gold : (affordable ? COLORS.green : COLORS.grayDark),
                enabled: !maxed,
                onTap: () => this.buy(UPGRADE_COST, (s) => { s[row.key] += 1; },
                    row.name + ' is now level ' + (level + 1) + '!')
            });
        });
    }

    createPaint(x, y, width, height) {
        const g = this.add.graphics();
        drawPanel(g, x, y, width, height, COLORS.white, 28);
        this.sectionHeader(x, y, width, 'Kart Paint');

        const names = Object.keys(KART_COLORS);
        names.forEach((name, i) => {
            const col = i % 3;
            const row = Math.floor(i / 3);
            const cx = x + 90 + col * 140 + (row === 1 ? 70 : 0);
            const cy = y + 140 + row * 130;
            const owned = this.save.unlockedColors.indexOf(name) !== -1;
            const equipped = this.save.currentColor === name;

            const tile = this.add.graphics();
            tile.fillStyle(equipped ? COLORS.yellow : 0xf1f3f5, 1);
            tile.fillRoundedRect(cx - 58, cy - 58, 116, 116, 22);
            tile.lineStyle(equipped ? 6 : 4, COLORS.ink, 1);
            tile.strokeRoundedRect(cx - 58, cy - 58, 116, 116, 22);

            const kart = drawKart(this.add.graphics(), KART_COLORS[name].value);
            kart.setPosition(cx, cy - 10).setRotation(Math.PI / 2).setScale(1.1);

            const tag = equipped ? 'Driving' : (owned ? 'Tap to use' : COLOR_COST + ' coins');
            this.add.text(cx, cy + 38, tag, textStyle(18, equipped ? INK : (owned ? '#2b8a3e' : '#e67700'))).setOrigin(0.5);

            const hit = this.add.rectangle(cx, cy, 124, 124).setInteractive({ useHandCursor: true });
            hit.on('pointerup', () => {
                if (equipped) return;
                if (owned) {
                    const save = getSaveData();
                    save.currentColor = name;
                    updateSaveData(save);
                    this.scene.restart({ toast: KART_COLORS[name].label + ' kart ready!' });
                } else {
                    this.buy(COLOR_COST, (s) => {
                        s.unlockedColors.push(name);
                        s.currentColor = name;
                    }, 'New ' + KART_COLORS[name].label + ' paint!');
                }
            });
        });
    }

    createTracks(x, y, width, height) {
        const g = this.add.graphics();
        drawPanel(g, x, y, width, height, COLORS.white, 28);
        this.add.text(x + 28, y + 30, 'Track Ladder', textStyle(30, INK, { align: 'left' })).setOrigin(0, 0.5);
        this.add.text(x + width - 28, y + 30, 'Unlock them in order. Harder tracks pay bigger prizes!',
            textStyle(18, '#868e96', { align: 'right' })).setOrigin(1, 0.5);

        const courses = allCourses().filter((c) => c.id !== STARTER_COURSE);
        const tileW = 218;
        const gap = (width - courses.length * tileW) / (courses.length + 1);
        courses.forEach((course, i) => {
            const tx = x + gap + i * (tileW + gap);
            const cx = tx + tileW / 2;
            const status = courseStatus(course.id, this.save.unlockedCourses);
            const tile = this.add.graphics();
            tile.fillStyle(status === 'unlocked' ? 0xfff9db : 0xf1f3f5, 1);
            tile.fillRoundedRect(tx, y + 56, tileW, height - 70, 20);
            tile.lineStyle(3, COLORS.ink, 1);
            tile.strokeRoundedRect(tx, y + 56, tileW, height - 70, 20);
            drawCoursePreview(tile, course, tx + 10, y + 64, tileW - 20, 76, status !== 'unlocked');
            this.add.text(cx, y + 160, course.name, textStyle(22, INK)).setOrigin(0.5);
            this.add.text(cx, y + 184, '1st prize: ' + course.prizes[0] + ' coins', textStyle(15, '#868e96')).setOrigin(0.5);

            const affordable = this.save.coins >= course.cost;
            const btn = createButton(this, cx, y + 226, {
                width: tileW - 22, height: 56, radius: 20,
                label: status === 'unlocked' ? 'Unlocked!'
                    : status === 'next' ? 'Unlock ' + course.cost
                        : 'After ' + getCourse(requiredCourse(course.id)).name,
                fontSize: status === 'later' ? 19 : 26,
                color: status === 'unlocked' ? COLORS.gold : (status === 'next' && affordable ? COLORS.green : COLORS.grayDark),
                enabled: status !== 'later',
                onTap: () => {
                    if (courseStatus(course.id, getSaveData().unlockedCourses) !== 'next') return;
                    this.buy(course.cost, (s) => {
                        s.unlockedCourses.push(course.id);
                        s.lastCourse = course.id;
                    }, course.name + ' unlocked!');
                }
            });
            btn.courseId = course.id;
        });
    }

    toast(message, color) {
        if (this.toastObj) this.toastObj.destroy();
        const c = this.add.container(W / 2, H - 24).setDepth(50);
        const text = this.add.text(0, 0, message, textStyle(26, '#ffffff', {
            stroke: INK, strokeThickness: 5
        })).setOrigin(0.5);
        const pad = 26;
        const g = this.add.graphics();
        g.fillStyle(color, 1);
        g.fillRoundedRect(-text.width / 2 - pad, -28, text.width + pad * 2, 56, 28);
        g.lineStyle(4, COLORS.ink, 1);
        g.strokeRoundedRect(-text.width / 2 - pad, -28, text.width + pad * 2, 56, 28);
        c.add([g, text]);
        c.setAlpha(0);
        this.tweens.add({ targets: c, alpha: 1, y: H - 40, duration: 200 });
        this.tweens.add({ targets: c, alpha: 0, delay: 2600, duration: 400 });
        this.toastObj = c;
    }
}
