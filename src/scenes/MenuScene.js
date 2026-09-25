import Phaser from 'phaser';
import { getSaveData, updateSaveData } from '../utils/saveManager.js';
import { allCourses, courseStatus, getCourse, requiredCourse } from '../game/courses.js';
import { drawCoursePreview } from '../ui/coursePreview.js';
import {
    GAME_WIDTH, COLORS, INK, textStyle, addTitle, drawPanel, drawKart,
    createButton, createCoinPill, fadeToScene, kartColor
} from '../ui/theme.js';
import { markBooted } from '../boot.js';
import { GRADES, getGrade } from '../math/grades.js';

const W = GAME_WIDTH;

// Vertical layout (the smoke test taps these).
export const MENU_LAYOUT = {
    gradeY: 214,
    gradeXs: [W / 2 - 170, W / 2 + 170],
    cardsY: 404,
    cardXs: [128, 320, 512, 704, 896],
    messageY: 537,
    startY: 612,
    shopY: 714
};
const LAYOUT = MENU_LAYOUT;

const CARD_W = 180;
const CARD_H = 220;

export default class MenuScene extends Phaser.Scene {
    constructor() {
        super({ key: 'MenuScene' });
    }

    create() {
        const save = getSaveData();
        this.save = save;
        this.selected = save.unlockedCourses.indexOf(save.lastCourse) !== -1 ? save.lastCourse : 'forest';
        this.grade = getGrade(save.grade).id;
        this.cameras.main.fadeIn(200, 0, 0, 0);

        this.drawBackground();

        const title = addTitle(this, W / 2, 66, 'MATH KART', 90);
        this.tweens.add({ targets: title, y: 72, duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        this.add.text(W / 2, 140, 'Race, solve math, win coins!', textStyle(28, '#ffffff', {
            stroke: INK, strokeThickness: 7
        })).setOrigin(0.5);

        createCoinPill(this, W - 118, 46, save.coins);

        this.gradeCards = GRADES.map((grade, i) => this.createGradeCard(grade, LAYOUT.gradeXs[i]));
        this.refreshGrades();

        this.cards = allCourses().map((course, i) => this.createCourseCard(course, LAYOUT.cardXs[i]));
        this.refreshCards();
        this.message = this.add.text(W / 2, LAYOUT.messageY, '', textStyle(22, '#ffffff', {
            stroke: INK, strokeThickness: 6
        })).setOrigin(0.5);

        createButton(this, W / 2, LAYOUT.startY, {
            width: 460, height: 108, radius: 36,
            label: 'START RACE  \u25B6', fontSize: 52,
            color: COLORS.green,
            onTap: () => fadeToScene(this, 'RaceScene', { course: this.selected })
        });

        createButton(this, W / 2, LAYOUT.shopY, {
            width: 320, height: 76, radius: 28,
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

    createCourseCard(course, x) {
        const status = courseStatus(course.id, this.save.unlockedCourses);
        const unlocked = status === 'unlocked';
        const c = this.add.container(x, LAYOUT.cardsY);
        const glow = this.add.graphics();
        const g = this.add.graphics();
        drawPanel(g, -CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, COLORS.white, 22);
        drawCoursePreview(g, course, -CARD_W / 2 + 10, -CARD_H / 2 + 10, CARD_W - 20, 104, !unlocked);
        const name = this.add.text(0, 24, course.name, textStyle(21, INK)).setOrigin(0.5);
        let detail;
        if (unlocked) {
            detail = this.add.text(0, 60, '1st prize: ' + course.prizes[0], textStyle(17, '#2b8a3e')).setOrigin(0.5);
        } else {
            detail = this.add.text(0, 60, course.cost + ' coins', textStyle(20, status === 'next' ? '#e67700' : '#868e96')).setOrigin(0.5);
        }
        const sub = this.add.text(0, 86, unlocked ? course.blurb : (status === 'next' ? 'Unlock in Shop' : 'After ' + getCourse(requiredCourse(course.id)).name),
            textStyle(13, '#868e96', { wordWrap: { width: CARD_W - 16 } })).setOrigin(0.5);
        c.add([glow, g, name, detail, sub]);

        const hit = this.add.rectangle(0, 0, CARD_W, CARD_H).setInteractive({ useHandCursor: true });
        hit.on('pointerup', () => {
            if (unlocked) {
                this.selected = course.id;
                const save = getSaveData();
                save.lastCourse = course.id;
                updateSaveData(save);
                this.message.setText('');
                this.refreshCards();
            } else {
                this.message.setText(status === 'next'
                    ? course.name + ': unlock it in the Shop for ' + course.cost + ' coins'
                    : course.name + ': unlock ' + getCourse(requiredCourse(course.id)).name + ' first');
                this.tweens.add({ targets: c, x: x + 8, duration: 60, yoyo: true, repeat: 2 });
            }
        });
        c.add(hit);

        return { id: course.id, container: c, glow, unlocked };
    }

    createGradeCard(grade, x) {
        const c = this.add.container(x, LAYOUT.gradeY);
        const glow = this.add.graphics();
        const g = this.add.graphics();
        const name = this.add.text(0, -14, grade.label, textStyle(36, INK)).setOrigin(0.5);
        const blurb = this.add.text(0, 22, grade.blurb, textStyle(19, '#495057')).setOrigin(0.5);
        const hit = this.add.rectangle(0, 0, 310, 96).setInteractive({ useHandCursor: true });
        hit.on('pointerup', () => {
            if (this.grade === grade.id) return;
            this.grade = grade.id;
            const save = getSaveData();
            save.grade = grade.id;
            updateSaveData(save);
            this.refreshGrades();
            this.tweens.add({ targets: c, scale: 1.1, duration: 110, yoyo: true });
        });
        c.add([glow, g, name, blurb, hit]);
        return { id: grade.id, container: c, glow, g, name, blurb };
    }

    refreshGrades() {
        this.gradeCards.forEach((card) => {
            const on = card.id === this.grade;
            card.glow.clear();
            if (on) {
                card.glow.fillStyle(COLORS.yellow, 1);
                card.glow.fillRoundedRect(-164, -54, 328, 112, 30);
            }
            card.g.clear();
            drawPanel(card.g, -150, -42, 300, 84, on ? COLORS.green : COLORS.white, 24);
            card.name.setColor(on ? '#ffffff' : INK);
            card.name.setStroke(INK, on ? 6 : 0);
            card.blurb.setColor(on ? '#ffffff' : '#495057');
            card.container.setScale(on ? 1 : 0.94);
        });
    }

    refreshCards() {
        this.cards.forEach((card) => {
            const on = card.id === this.selected;
            card.glow.clear();
            if (on) {
                card.glow.fillStyle(COLORS.yellow, 1);
                card.glow.fillRoundedRect(-CARD_W / 2 - 8, -CARD_H / 2 - 8, CARD_W + 16, CARD_H + 24, 28);
            }
            card.container.setScale(on ? 1 : 0.95);
        });
    }
}
