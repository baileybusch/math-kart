import Phaser from 'phaser';
import { getSaveData, updateSaveData } from '../utils/saveManager.js';

export default class ShopScene extends Phaser.Scene {
    constructor() {
        super({ key: 'ShopScene' });
    }

    create() {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        const save = getSaveData();

        // Title
        this.add.text(width / 2, 60, '🛒 SHOP & GARAGE 🛒', {
            fontSize: '56px',
            fontFamily: 'Arial Black',
            color: '#FFD700',
            stroke: '#FF4500',
            strokeThickness: 6
        }).setOrigin(0.5);

        // Coins display
        this.coinsText = this.add.text(width / 2, 130, `💰 Coins: ${save.coins}`, {
            fontSize: '36px',
            fontFamily: 'Arial',
            color: '#FFFF00',
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5);

        // Upgrades section
        this.add.text(200, 200, '⚡ UPGRADES', {
            fontSize: '32px',
            fontFamily: 'Arial',
            color: '#FFFFFF',
            stroke: '#000000',
            strokeThickness: 4
        });

        // Speed upgrade
        this.createUpgradeItem(200, 260, '🚀 Speed Boost', 30, 'speedUpgrades', save, 5);

        // Handling upgrade
        this.createUpgradeItem(200, 360, '🎯 Better Handling', 30, 'handlingUpgrades', save, 5);

        // Unlockables section
        this.add.text(700, 200, '🔓 UNLOCKABLES', {
            fontSize: '32px',
            fontFamily: 'Arial',
            color: '#FFFFFF',
            stroke: '#000000',
            strokeThickness: 4
        });

        // Desert course
        const desertUnlocked = save.unlockedCourses.includes('desert');
        this.createUnlockItem(700, 260, '🏜️ Desert Track', 100, 'unlockedCourses', 'desert', desertUnlocked, save);

        // Kart colors
        this.add.text(700, 380, 'Kart Colors (20 coins each):', {
            fontSize: '24px',
            fontFamily: 'Arial',
            color: '#FFFFFF',
            stroke: '#000000',
            strokeThickness: 3
        });

        const colors = [
            { name: 'blue', color: 0x4444FF, label: 'Blue' },
            { name: 'green', color: 0x44FF44, label: 'Green' },
            { name: 'yellow', color: 0xFFFF44, label: 'Yellow' },
            { name: 'purple', color: 0xFF44FF, label: 'Purple' }
        ];

        colors.forEach((colorData, index) => {
            const x = 700 + (index % 2) * 150;
            const y = 440 + Math.floor(index / 2) * 80;
            this.createColorItem(x, y, colorData.label, colorData.name, colorData.color, 20, save);
        });

        // Back button
        const backBtn = this.add.rectangle(width / 2, height - 80, 300, 60, 0xFF4444)
            .setStrokeStyle(4, 0x000000)
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => {
                this.scene.start('MenuScene');
            })
            .on('pointerover', () => backBtn.setFillStyle(0xFF6666))
            .on('pointerout', () => backBtn.setFillStyle(0xFF4444));

        this.add.text(width / 2, height - 80, 'BACK TO MENU', {
            fontSize: '28px',
            fontFamily: 'Arial',
            color: '#FFFFFF',
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5);
    }

    createUpgradeItem(x, y, label, cost, upgradeKey, save, maxLevel) {
        const currentLevel = save[upgradeKey] || 0;
        const canUpgrade = currentLevel < maxLevel && save.coins >= cost;

        const container = this.add.container(x, y);

        const btn = this.add.rectangle(0, 0, 380, 70, canUpgrade ? 0x4CAF50 : 0x888888)
            .setStrokeStyle(4, 0x000000);
        
        const text = this.add.text(-180, -10, `${label}`, {
            fontSize: '24px',
            fontFamily: 'Arial',
            color: '#FFFFFF',
            stroke: '#000000',
            strokeThickness: 3
        });

        const levelText = this.add.text(-180, 15, `Level: ${currentLevel}/${maxLevel}`, {
            fontSize: '18px',
            fontFamily: 'Arial',
            color: '#FFFF00',
            stroke: '#000000',
            strokeThickness: 2
        });

        const costText = this.add.text(140, 0, `${cost} 💰`, {
            fontSize: '22px',
            fontFamily: 'Arial',
            color: '#FFD700',
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(0.5);

        container.add([btn, text, levelText, costText]);

        if (canUpgrade) {
            btn.setInteractive({ useHandCursor: true })
                .on('pointerdown', () => {
                    save.coins -= cost;
                    save[upgradeKey]++;
                    updateSaveData(save);
                    this.scene.restart();
                })
                .on('pointerover', () => btn.setFillStyle(0x66BB6A))
                .on('pointerout', () => btn.setFillStyle(0x4CAF50));
        }
    }

    createUnlockItem(x, y, label, cost, unlockArrayKey, unlockValue, isUnlocked, save) {
        const canUnlock = !isUnlocked && save.coins >= cost;

        const btn = this.add.rectangle(x, y, 380, 70, isUnlocked ? 0x888888 : (canUnlock ? 0xFF9800 : 0x666666))
            .setStrokeStyle(4, 0x000000);

        const displayText = isUnlocked ? `${label} ✅` : `${label}`;
        const text = this.add.text(x, y - 10, displayText, {
            fontSize: '24px',
            fontFamily: 'Arial',
            color: '#FFFFFF',
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(0.5);

        if (!isUnlocked) {
            const costText = this.add.text(x, y + 18, `${cost} 💰`, {
                fontSize: '20px',
                fontFamily: 'Arial',
                color: '#FFD700',
                stroke: '#000000',
                strokeThickness: 3
            }).setOrigin(0.5);
        }

        if (canUnlock) {
            btn.setInteractive({ useHandCursor: true })
                .on('pointerdown', () => {
                    save.coins -= cost;
                    save[unlockArrayKey].push(unlockValue);
                    updateSaveData(save);
                    this.scene.restart();
                })
                .on('pointerover', () => btn.setFillStyle(0xFFAA33))
                .on('pointerout', () => btn.setFillStyle(0xFF9800));
        }
    }

    createColorItem(x, y, label, colorName, colorValue, cost, save) {
        const isUnlocked = save.unlockedColors.includes(colorName);
        const isCurrent = save.currentColor === colorName;
        const canBuy = !isUnlocked && save.coins >= cost;

        const btn = this.add.rectangle(x, y, 140, 60, colorValue)
            .setStrokeStyle(4, isCurrent ? 0xFFFF00 : 0x000000);

        const text = this.add.text(x, y + 35, isUnlocked ? (isCurrent ? 'EQUIPPED' : 'SELECT') : `${cost}💰`, {
            fontSize: '16px',
            fontFamily: 'Arial',
            color: '#FFFFFF',
            stroke: '#000000',
            strokeThickness: 2
        }).setOrigin(0.5);

        if (isUnlocked && !isCurrent) {
            btn.setInteractive({ useHandCursor: true })
                .on('pointerdown', () => {
                    save.currentColor = colorName;
                    updateSaveData(save);
                    this.scene.restart();
                })
                .on('pointerover', () => btn.setStrokeStyle(4, 0xFFFF00))
                .on('pointerout', () => btn.setStrokeStyle(4, 0x000000));
        } else if (canBuy) {
            btn.setInteractive({ useHandCursor: true })
                .on('pointerdown', () => {
                    save.coins -= cost;
                    save.unlockedColors.push(colorName);
                    save.currentColor = colorName;
                    updateSaveData(save);
                    this.scene.restart();
                })
                .on('pointerover', () => btn.setStrokeStyle(4, 0x00FF00))
                .on('pointerout', () => btn.setStrokeStyle(4, 0x000000));
        }
    }
}
