/**
 * AI Kart - Computer-controlled racing opponent
 */
export default class AIKart {
    constructor(scene, x, y, color, name) {
        this.scene = scene;
        this.name = name;
        this.checkpointIndex = 0;
        this.pathProgress = 0;
        this.isPaused = false;
        this.isStopped = false;
        
        // Visual
        this.sprite = scene.add.rectangle(x, y, 40, 60, color)
            .setStrokeStyle(4, 0x000000);
        
        scene.physics.add.existing(this.sprite);
        this.sprite.body.setCollideWorldBounds(true);
        
        // AI params
        this.speed = Phaser.Math.Between(120, 160);
        this.currentWaypointIndex = 0;
    }
    
    update(delta, waypoints) {
        if (this.isPaused || this.isStopped || !waypoints || waypoints.length === 0) {
            this.sprite.body.setVelocity(0, 0);
            return;
        }
        
        const dt = delta / 1000;
        
        // Get target waypoint
        const target = waypoints[this.currentWaypointIndex];
        
        // Calculate direction to target
        const dx = target.x - this.sprite.x;
        const dy = target.y - this.sprite.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // If close enough to waypoint, move to next
        if (distance < 50) {
            this.currentWaypointIndex = (this.currentWaypointIndex + 1) % waypoints.length;
            this.pathProgress = this.currentWaypointIndex / waypoints.length;
            
            // Check if passed checkpoint
            if (this.currentWaypointIndex % 5 === 0) {
                this.checkpointIndex++;
            }
        }
        
        // Move towards target
        const vx = (dx / distance) * this.speed;
        const vy = (dy / distance) * this.speed;
        this.sprite.body.setVelocity(vx, vy);
        
        // Rotate to face direction
        this.sprite.rotation = Math.atan2(vx, -vy);
    }
    
    pause() {
        this.isPaused = true;
        this.sprite.body.setVelocity(0, 0);
    }
    
    resume() {
        this.isPaused = false;
    }
    
    stop() {
        this.isStopped = true;
        this.sprite.body.setVelocity(0, 0);
    }
}
