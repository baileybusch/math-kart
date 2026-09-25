import Phaser from 'phaser';
import { getSaveData, updateSaveData } from '../utils/saveManager.js';

export default class MenuScene extends Phaser.Scene {
    constructor() {
        super({ key: 'MenuScene' });
    }

    create() {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;

        // Title
        this.add.text(width / 2, 100, '🏎️ MATH KART 🏎️', {
            fontSize: '72px',
            fontFamily: 'Arial Black',
            color: '#FFD700',
            stroke: '#FF4500',
            strokeThickness: 8
        }).setOrigin(0.5);

        this.add.text(width / 2, 180, 'Race & Solve Math Problems!', {
            fontSize: '28px',
            fontFamily: 'Arial',
            color: '#FFFFFF',
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5);

        // Display coins
        const save = getSaveData();
        this.add.text(width / 2, 250, `💰 Coins: ${save.coins}`, {
            fontSize: '32px',
            fontFamily: 'Arial',
            color: '#FFFF00',
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5);

        // Course selection
        this.add.text(width / 2, 330, 'SELECT COURSE:', {
            fontSize: '24px',
            fontFamily: 'Arial',
            color: '#FFFFFF',
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(0.5);

        // Forest course button
        const forestBtn = this.createCourseButton(width / 2 - 200, 400, 'Forest Track', 'forest', true);
        
        // Desert course button
        const desertUnlocked = save.unlockedCourses.includes('desert');
        const desertBtn = this.createCourseButton(width / 2 + 200, 400, 'Desert Track', 'desert', desertUnlocked);
        
        if (!desertUnlocked) {
            this.add.text(width / 2 + 200, 490, '🔒 100 coins', {
                fontSize: '20px',
                fontFamily: 'Arial',
                color: '#FFD700',
                stroke: '#000000',
                strokeThickness: 3
            }).setOrigin(0.5);
        }

        // Shop button
        const shopBtn = this.add.rectangle(width / 2, 580, 300, 60, 0x9370DB)
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => {
                this.scene.start('ShopScene');
            })
            .on('pointerover', () => shopBtn.setFillStyle(0xBA55D3))
            .on('pointerout', () => shopBtn.setFillStyle(0x9370DB));

        this.add.text(width / 2, 580, '🛒 SHOP & UPGRADES', {
            fontSize: '28px',
            fontFamily: 'Arial',
            color: '#FFFFFF',
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5);

        // Instructions
        this.add.text(width / 2, 700, 'Controls: Arrow Keys or WASD to drive', {
            fontSize: '20px',
            fontFamily: 'Arial',
            color: '#FFFFFF',
            stroke: '#000000',
            strokeThickness: 2
        }).setOrigin(0.5);
    }

    createCourseButton(x, y, text, courseId, unlocked) {
        const color = unlocked ? 0x32CD32 : 0x808080;
        const btn = this.add.rectangle(x, y, 280, 60, color)
            .setStrokeStyle(4, 0x000000);

        if (unlocked) {
            btn.setInteractive({ useHandCursor: true })
                .on('pointerdown', () => {
                    this.scene.start('RaceScene', { course: courseId });
                })
                .on('pointerover', () => btn.setFillStyle(0x00FF00))
                .on('pointerout', () => btn.setFillStyle(0x32CD32));
        }

        this.add.text(x, y, text, {
            fontSize: '26px',
            fontFamily: 'Arial',
            color: unlocked ? '#FFFFFF' : '#666666',
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(0.5);

        return btn;
    }
}
