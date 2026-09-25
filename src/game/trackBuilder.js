/**
 * Track Builder - Creates racing tracks with checkpoints
 */

export function createTrack(scene, courseId) {
    const tracks = {
        forest: createForestTrack,
        desert: createDesertTrack
    };
    
    const builder = tracks[courseId] || createForestTrack;
    return builder(scene);
}

function createForestTrack(scene) {
    const width = 2400;
    const height = 1600;
    
    // Background - grass
    scene.add.rectangle(width / 2, height / 2, width, height, 0x228B22);
    
    // Trees for decoration
    for (let i = 0; i < 30; i++) {
        const x = Phaser.Math.Between(50, width - 50);
        const y = Phaser.Math.Between(50, height - 50);
        const size = Phaser.Math.Between(40, 80);
        scene.add.circle(x, y, size, 0x006400);
    }
    
    // Track path (dirt/road)
    const graphics = scene.add.graphics();
    graphics.lineStyle(200, 0x8B7355, 1);
    
    // Oval track
    const path = new Phaser.Curves.Path(200, 300);
    path.lineTo(200, 800);
    path.ellipseTo(300, 300, 180, 360, false, 0);
    path.lineTo(2200, 1100);
    path.ellipseTo(300, 300, 0, 180, false, 0);
    path.lineTo(2200, 500);
    path.ellipseTo(300, 300, 180, 360, false, 0);
    path.lineTo(200, 800);
    path.ellipseTo(300, 300, 0, 180, false, 0);
    path.lineTo(200, 300);
    
    path.draw(graphics);
    
    // Start line
    scene.add.rectangle(200, 300, 150, 20, 0xFFFFFF);
    scene.add.text(200, 280, '🏁 START', {
        fontSize: '32px',
        fontFamily: 'Arial',
        color: '#000000',
        backgroundColor: '#FFFFFF',
        padding: { x: 10, y: 5 }
    }).setOrigin(0.5);
    
    // Checkpoints
    const checkpoints = [
        { x: 1200, y: 1100, label: '1' },
        { x: 2200, y: 800, label: '2' },
        { x: 1200, y: 500, label: '3' }
    ];
    
    checkpoints.forEach(cp => {
        scene.add.circle(cp.x, cp.y, 60, 0xFFFF00, 0.3)
            .setStrokeStyle(4, 0xFFD700);
        scene.add.text(cp.x, cp.y, `✓${cp.label}`, {
            fontSize: '36px',
            fontFamily: 'Arial',
            color: '#000000',
            stroke: '#FFFF00',
            strokeThickness: 4
        }).setOrigin(0.5);
    });
    
    // AI path waypoints
    const aiPath = [
        { x: 200, y: 300 },
        { x: 200, y: 600 },
        { x: 300, y: 900 },
        { x: 700, y: 1100 },
        { x: 1200, y: 1100 },
        { x: 1800, y: 1100 },
        { x: 2100, y: 1000 },
        { x: 2200, y: 800 },
        { x: 2200, y: 600 },
        { x: 2100, y: 400 },
        { x: 1800, y: 500 },
        { x: 1200, y: 500 },
        { x: 600, y: 500 },
        { x: 300, y: 400 },
        { x: 200, y: 300 }
    ];
    
    return {
        width,
        height,
        checkpoints,
        path: aiPath,
        startX: 200,
        startY: 300
    };
}

function createDesertTrack(scene) {
    const width = 2400;
    const height = 1600;
    
    // Background - sand
    scene.add.rectangle(width / 2, height / 2, width, height, 0xEDC9AF);
    
    // Cacti for decoration
    for (let i = 0; i < 25; i++) {
        const x = Phaser.Math.Between(50, width - 50);
        const y = Phaser.Math.Between(50, height - 50);
        const size = Phaser.Math.Between(30, 60);
        scene.add.rectangle(x, y, size * 0.6, size, 0x228B22);
    }
    
    // Track path
    const graphics = scene.add.graphics();
    graphics.lineStyle(200, 0xA0826D, 1);
    
    // Figure-8 style track
    const path = new Phaser.Curves.Path(300, 400);
    path.lineTo(300, 800);
    path.ellipseTo(200, 200, 180, 360, false, 0);
    path.lineTo(900, 1000);
    path.lineTo(1500, 800);
    path.ellipseTo(200, 200, 0, 180, false, 0);
    path.lineTo(2100, 600);
    path.lineTo(2100, 400);
    path.ellipseTo(200, 200, 180, 360, false, 0);
    path.lineTo(1500, 200);
    path.lineTo(900, 400);
    path.ellipseTo(200, 200, 0, 180, false, 0);
    path.lineTo(300, 400);
    
    path.draw(graphics);
    
    // Start line
    scene.add.rectangle(300, 400, 150, 20, 0xFFFFFF);
    scene.add.text(300, 380, '🏁 START', {
        fontSize: '32px',
        fontFamily: 'Arial',
        color: '#000000',
        backgroundColor: '#FFFFFF',
        padding: { x: 10, y: 5 }
    }).setOrigin(0.5);
    
    // Checkpoints
    const checkpoints = [
        { x: 900, y: 1000, label: '1' },
        { x: 2100, y: 600, label: '2' },
        { x: 900, y: 400, label: '3' }
    ];
    
    checkpoints.forEach(cp => {
        scene.add.circle(cp.x, cp.y, 60, 0xFFFF00, 0.3)
            .setStrokeStyle(4, 0xFFD700);
        scene.add.text(cp.x, cp.y, `✓${cp.label}`, {
            fontSize: '36px',
            fontFamily: 'Arial',
            color: '#000000',
            stroke: '#FFFF00',
            strokeThickness: 4
        }).setOrigin(0.5);
    });
    
    // AI path waypoints
    const aiPath = [
        { x: 300, y: 400 },
        { x: 300, y: 700 },
        { x: 400, y: 950 },
        { x: 700, y: 1050 },
        { x: 900, y: 1000 },
        { x: 1200, y: 900 },
        { x: 1500, y: 800 },
        { x: 1800, y: 700 },
        { x: 2000, y: 600 },
        { x: 2100, y: 500 },
        { x: 2100, y: 350 },
        { x: 2000, y: 250 },
        { x: 1700, y: 200 },
        { x: 1500, y: 200 },
        { x: 1200, y: 250 },
        { x: 900, y: 350 },
        { x: 700, y: 450 },
        { x: 500, y: 450 },
        { x: 350, y: 400 }
    ];
    
    return {
        width,
        height,
        checkpoints,
        path: aiPath,
        startX: 300,
        startY: 400
    };
}
