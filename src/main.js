import Phaser from 'phaser';
import MenuScene from './scenes/MenuScene.js';
import RaceScene from './scenes/RaceScene.js';
import RaceHudScene from './scenes/RaceHudScene.js';
import ShopScene from './scenes/ShopScene.js';
import { GAME_WIDTH, GAME_HEIGHT } from './ui/theme.js';
import { ensureSaveData } from './utils/saveManager.js';
import {
    chooseRenderer, rememberRenderer, rendererName, reportBootError, whenDomReady
} from './boot.js';

function makeConfig(type) {
    return {
        type,
        width: GAME_WIDTH,
        height: GAME_HEIGHT,
        parent: 'game-container',
        backgroundColor: '#3fb4f0',
        banner: false,
        disableContextMenu: true,
        scale: {
            mode: Phaser.Scale.FIT,
            autoCenter: Phaser.Scale.CENTER_BOTH
        },
        input: {
            // One finger on GO while another steers.
            activePointers: 4
        },
        audio: {
            noAudio: true
        },
        render: {
            antialias: true,
            powerPreference: 'default',
            failIfMajorPerformanceCaveat: false
        },
        scene: [MenuScene, RaceScene, RaceHudScene, ShopScene]
    };
}

function clearContainer() {
    const parent = document.getElementById('game-container');
    while (parent && parent.firstChild) parent.removeChild(parent.firstChild);
}

function watchForContextLoss(game) {
    if (rendererName(game) !== 'webgl' || !game.canvas) return;
    game.canvas.addEventListener('webglcontextlost', () => {
        // The GPU gave up; come back on the Canvas renderer instead.
        rememberRenderer('canvas');
        window.location.reload();
    }, false);
}

function startGame() {
    try {
        ensureSaveData();
    } catch (e) {
        // Progress just won't persist; the game can still run.
    }

    const choice = chooseRenderer();
    let game = null;
    try {
        game = new Phaser.Game(makeConfig(choice.type));
    } catch (err) {
        if (choice.type === Phaser.CANVAS) {
            reportBootError('The game engine could not start on this device.', err);
            return;
        }
        clearContainer();
        try {
            rememberRenderer('canvas');
            game = new Phaser.Game(makeConfig(Phaser.CANVAS));
        } catch (err2) {
            reportBootError('The game engine could not start on this device.', err2);
            return;
        }
    }

    watchForContextLoss(game);
    window.mathKart = { game, renderer: rendererName(game), rendererReason: choice.reason };
}

whenDomReady(startGame);
