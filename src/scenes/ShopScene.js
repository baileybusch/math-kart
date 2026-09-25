import Phaser from 'phaser';
import { getSaveData, updateSaveData } from '../utils/saveManager.js';
import {
    GAME_WIDTH, GAME_HEIGHT, COLORS, INK, KART_COLORS, textStyle, addTitle, drawPanel,
    drawKart, drawMenuBackdrop, createButton, createCoinPill, fadeToScene
} from '../ui/theme.js';

const W = GAME_WIDTH;
const H = GAME_HEIGHT;
const UPGRADE_COST = 30;
const MAX_LEVEL = 5;
const COLOR_COST = 20;
const DESERT_COST = 100;

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

        this.createUpgrades(40, 130, 460, 360);
        this.createPaint(524, 130, 460, 360);
        this.createTrackUnlock(40, 520, 944, 200);

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

    createTrackUnlock(x, y, width, height) {
        const g = this.add.graphics();
        drawPanel(g, x, y, width, height, COLORS.white, 28);

        g.fillStyle(0xf2d49b, 1);
        g.fillRoundedRect(x + 24, y + 24, 230, height - 48, 18);
        g.lineStyle(22, 0xb08968, 1);
        g.strokeRoundedRect(x + 56, y + 50, 166, height - 100, 34);
        g.fillStyle(0x2f9e44, 1);
        g.fillRoundedRect(x + 132, y + 76, 16, 48, 8);
        g.fillRoundedRect(x + 116, y + 90, 12, 22, 6);

        this.add.text(x + 290, y + 64, 'New Track: Desert Canyon', textStyle(34, INK, { align: 'left' })).setOrigin(0, 0.5);
        this.add.text(x + 290, y + 110, 'A twisty sandy race with cactus!', textStyle(22, '#868e96', { align: 'left' })).setOrigin(0, 0.5);

        const unlocked = this.save.unlockedCourses.indexOf('desert') !== -1;
        const affordable = this.save.coins >= DESERT_COST;
        createButton(this, x + width - 140, y + height / 2 + 4, {
            width: 230, height: 110, radius: 30,
            label: unlocked ? 'Unlocked!' : 'Unlock\n' + DESERT_COST + ' coins',
            fontSize: unlocked ? 34 : 30,
            color: unlocked ? COLORS.gold : (affordable ? COLORS.green : COLORS.grayDark),
            enabled: !unlocked,
            onTap: () => this.buy(DESERT_COST, (s) => {
                s.unlockedCourses.push('desert');
                s.lastCourse = 'desert';
            }, 'Desert Canyon unlocked!')
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
