import Phaser from 'phaser';
import MenuScene from './scenes/MenuScene.js';
import RaceScene from './scenes/RaceScene.js';
import ShopScene from './scenes/ShopScene.js';

// Determine game size based on viewport
const getGameSize = () => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const aspectRatio = 3 / 2; // Target 3:2 aspect ratio
    
    let gameWidth = 1200;
    let gameHeight = 800;
    
    if (width / height > aspectRatio) {
        // Width-limited
        gameWidth = Math.min(1200, height * aspectRatio);
        gameHeight = Math.min(800, height);
    } else {
        // Height-limited
        gameWidth = Math.min(1200, width);
        gameHeight = Math.min(800, width / aspectRatio);
    }
    
    return { width: gameWidth, height: gameHeight };
};

const size = getGameSize();

const config = {
    type: Phaser.AUTO,
    width: size.width,
    height: size.height,
    parent: 'game-container',
    backgroundColor: '#87CEEB',
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH
    },
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
