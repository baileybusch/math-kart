import Phaser from 'phaser';
import { getSaveData, updateSaveData } from '../utils/saveManager.js';
import { getCourseInfo } from '../game/trackBuilder.js';
import {
    GAME_WIDTH, COLORS, INK, textStyle, addTitle, drawPanel, drawKart,
    createButton, createCoinPill, fadeToScene, kartColor
} from '../ui/theme.js';
import { markBooted } from '../boot.js';
import { GRADES, normalizeGrade } from '../math/grades.js';

const W = GAME_WIDTH;
const DESERT_PRICE = 100;

const COURSE_CARDS = [
    { id: 'forest', x: W / 2 - 200, ground: 0x5cc85c, road: 0x8d7b68, deco: 0x2b8a3e },
    { id: 'desert', x: W / 2 + 200, ground: 0xf2d49b, road: 0xb08968, deco: 0x2f9e44 }
];

export default class MenuScene extends Phaser.Scene {
    constructor() {
        super({ key: 'MenuScene' });
    }

    create() {
        const save = getSaveData();
        this.save = save;
        this.selected = save.unlockedCourses.indexOf(save.lastCourse) !== -1 ? save.lastCourse : 'forest';
        this.grade = normalizeGrade(save.grade);
        this.cameras.main.fadeIn(200, 0, 0, 0);

        this.drawBackground();

        const title = addTitle(this, W / 2, 70, 'MATH KART', 92);
        this.tweens.add({ targets: title, y: 77, duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        this.add.text(W / 2, 140, 'Race, solve math, win coins!', textStyle(28, '#ffffff', {
            stroke: INK, strokeThickness: 7
        })).setOrigin(0.5);

        createCoinPill(this, W - 118, 46, save.coins);

        this.createGradePicker(222);

        this.cards = COURSE_CARDS.map((card) => this.createCourseCard(card));
        this.refreshCards();

        createButton(this, W / 2, 610, {
            width: 460, height: 104, radius: 36,
            label: 'START RACE  \u25B6', fontSize: 50,
            color: COLORS.green,
            onTap: () => fadeToScene(this, 'RaceScene', { course: this.selected })
        });

        createButton(this, W / 2, 714, {
            width: 300, height: 72, radius: 28,
            label: 'SHOP', fontSize: 40,
            color: COLORS.purple,
            onTap: () => fadeToScene(this, 'ShopScene')
        });

        markBooted();
    }

    drawBackground() {
        const g = this.add.graphics();
        g.fillStyle(COLORS.sky, 1);
        g.fillRect(0, 0, W, 768);
        g.fillStyle(0xffffff, 0.9);
        [[70, 190, 0.9], [800, 150, 0.8]].forEach(([cx, cy, s]) => {
            g.fillCircle(cx, cy, 34 * s);
            g.fillCircle(cx + 38 * s, cy - 14 * s, 42 * s);
            g.fillCircle(cx + 80 * s, cy, 32 * s);
            g.fillRect(cx, cy, 80 * s, 32 * s);
        });
        g.fillStyle(COLORS.grassDark, 1);
        g.fillCircle(120, 900, 360);
        g.fillCircle(920, 920, 380);
        g.fillStyle(COLORS.grass, 1);
        g.fillCircle(512, 1100, 560);
        g.fillRect(0, 620, W, 148);

        // A little kart doing laps along the bottom for some motion.
        const kart = drawKart(this.add.graphics(), kartColor(this.save.currentColor));
        kart.setPosition(-60, 745).setRotation(Math.PI / 2).setScale(0.9);
        this.tweens.add({ targets: kart, x: W + 60, duration: 6000, repeat: -1, delay: 400 });
    }

    createCourseCard(card) {
        const info = getCourseInfo(card.id);
        const unlocked = this.save.unlockedCourses.indexOf(card.id) !== -1;
        const c = this.add.container(card.x, 410);

        const glow = this.add.graphics();
        const g = this.add.graphics();
        drawPanel(g, -170, -115, 340, 230, COLORS.white, 28);
        g.fillStyle(card.ground, 1);
        g.fillRoundedRect(-150, -98, 300, 140, 18);
        g.lineStyle(26, card.road, 1);
        g.strokeRoundedRect(-112, -72, 224, 88, 40);
        g.fillStyle(card.deco, 1);
        g.fillCircle(0, -28, 16);
        g.fillCircle(-128, 22, 12);
        g.fillCircle(128, -80, 12);

        const name = this.add.text(0, 76, info.name, textStyle(32, INK)).setOrigin(0.5);
        c.add([glow, g, name]);

        if (!unlocked) {
            const lock = this.add.graphics();
            lock.fillStyle(0x000000, 0.45);
            lock.fillRoundedRect(-150, -98, 300, 140, 18);
            lock.fillStyle(COLORS.yellow, 1);
            lock.fillRoundedRect(-22, -40, 44, 38, 8);
            lock.lineStyle(8, COLORS.yellow, 1);
            lock.strokeCircle(0, -44, 14);
            c.add(lock);
            c.add(this.add.text(0, 20, 'Unlock in Shop: ' + DESERT_PRICE + ' coins', textStyle(20, '#ffffff', {
                stroke: INK, strokeThickness: 5
            })).setOrigin(0.5));
        }

        const hit = this.add.rectangle(0, 0, 340, 240).setInteractive({ useHandCursor: true });
        hit.on('pointerup', () => {
            if (unlocked) {
                this.selected = card.id;
                const save = getSaveData();
                save.lastCourse = card.id;
                updateSaveData(save);
                this.refreshCards();
            } else {
                this.tweens.add({ targets: c, x: card.x + 10, duration: 60, yoyo: true, repeat: 2 });
            }
        });
        c.add(hit);

        return { id: card.id, container: c, glow, unlocked };
    }

    createGradePicker(y) {
        this.gradeButtons = GRADES.map((grade, i) => {
            const x = W / 2 + (i - (GRADES.length - 1) / 2) * 300;
            const glow = this.add.graphics();
            glow.fillStyle(COLORS.yellow, 1);
            glow.fillRoundedRect(x - 150, y - 52, 300, 108, 34);
            const btn = createButton(this, x, y, {
                width: 272, height: 92, radius: 28,
                label: grade.label + '\n' + grade.blurb, fontSize: 28,
                color: COLORS.blue,
                onTap: () => this.pickGrade(grade.id)
            });
            return { id: grade.id, btn, glow };
        });
        this.refreshGrades();
    }

    pickGrade(id) {
        this.grade = id;
        const save = getSaveData();
        save.grade = id;
        updateSaveData(save);
        this.refreshGrades();
    }

    refreshGrades() {
        this.gradeButtons.forEach((g) => {
            const on = g.id === this.grade;
            g.glow.setVisible(on);
            g.btn.setColor(on ? COLORS.orange : COLORS.blue);
            g.btn.setScale(on ? 1.04 : 0.94);
        });
    }

    refreshCards() {
        this.cards.forEach((card) => {
            const on = card.id === this.selected;
            card.glow.clear();
            if (on) {
                card.glow.fillStyle(COLORS.yellow, 1);
                card.glow.fillRoundedRect(-186, -131, 372, 270, 38);
            }
            card.container.setScale(on ? 1.04 : 0.96);
        });
    }
}
