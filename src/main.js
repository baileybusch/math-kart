import Phaser from 'phaser';
import MenuScene from './scenes/MenuScene.js';
import RaceScene from './scenes/RaceScene.js';
import ShopScene from './scenes/ShopScene.js';

const config = {
    type: Phaser.AUTO,
    width: 1200,
    height: 800,
    parent: 'game-container',
    backgroundColor: '#87CEEB',
    physics: {
        default: 'arcade',
        arcade: {
            debug: false,
            gravity: { y: 0 }
        }
    },
    scene: [MenuScene, RaceScene, ShopScene]
};

const game = new Phaser.Game(config);

// Initialize save data if needed
if (!localStorage.getItem('mathKartSave')) {
    const initialSave = {
        coins: 0,
        unlockedCourses: ['forest'],
        unlockedColors: ['red'],
        currentColor: 'red',
        speedUpgrades: 0,
        handlingUpgrades: 0,
        difficulty: 1
    };
    localStorage.setItem('mathKartSave', JSON.stringify(initialSave));
}

export default game;
