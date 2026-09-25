import Phaser from 'phaser';
import { getSaveData, updateSaveData } from '../utils/saveManager.js';
import { getCourseInfo } from '../game/trackBuilder.js';
import {
    GAME_WIDTH, COLORS, INK, textStyle, addTitle, drawPanel, drawKart,
    createButton, createCoinPill, fadeToScene, kartColor
} from '../ui/theme.js';
import { markBooted } from '../boot.js';

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
        this.cameras.main.fadeIn(200, 0, 0, 0);

        this.drawBackground();

        const title = addTitle(this, W / 2, 96, 'MATH KART', 104);
        this.tweens.add({ targets: title, y: 104, duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        this.add.text(W / 2, 178, 'Race, solve math, win coins!', textStyle(32, '#ffffff', {
            stroke: INK, strokeThickness: 7
        })).setOrigin(0.5);

        createCoinPill(this, W - 118, 46, save.coins);

        this.cards = COURSE_CARDS.map((card) => this.createCourseCard(card));
        this.refreshCards();

        createButton(this, W / 2, 568, {
            width: 460, height: 118, radius: 36,
            label: 'START RACE  \u25B6', fontSize: 52,
            color: COLORS.green,
            onTap: () => fadeToScene(this, 'RaceScene', { course: this.selected })
        });

        createButton(this, W / 2, 690, {
            width: 340, height: 86, radius: 30,
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
        [[90, 90, 1], [790, 150, 0.8], [330, 240, 0.55]].forEach(([cx, cy, s]) => {
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
        const c = this.add.container(card.x, 355);

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
