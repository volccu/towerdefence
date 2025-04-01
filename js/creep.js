class Creep {
    constructor(game, x, y, health = 100, speed = 0.5, color = '#FF5500', radius = 8, isBoss = false) {
        this.game = game;
        this.x = x;
        this.y = y;
        this.health = health;
        this.maxHealth = health;
        this.speed = speed;
        this.color = color;
        this.radius = radius;
        this.isBoss = isBoss;
        this.isAlive = true;
        this.reachedEnd = false;
        this.pathIndex = 0;
        this.path = null;
        this.isDamaged = false; // Track if creep has been damaged
        this.attackingTower = null; // Track which tower creep is attacking
        this.attackCooldown = 0; // Time between attacks
        this.attackDamage = isBoss ? 20 : 10; // Bosses do more damage
        this.findPath();
    }

    findPath() {
        // Convert pixel coordinates to grid coordinates
        const gridX = Math.floor((this.x - this.game.gameArea.x) / this.game.grid.cellSize);
        const gridY = Math.floor(this.y / this.game.grid.cellSize);
        
        // Find path to home point instead of just bottom
        const homePointGridX = Math.floor((this.game.homePoint.x - this.game.gameArea.x) / this.game.grid.cellSize);
        const homePointGridY = Math.floor(this.game.homePoint.y / this.game.grid.cellSize);
        
        this.path = this.game.pathfinding.findPath(gridX, gridY, homePointGridX, homePointGridY);
        this.pathIndex = 0;
        
        // If no path is found, creep will look for towers to attack
        if (!this.path) {
            this.findClosestTowerToAttack();
        } else {
            // If we found a path, stop attacking tower
            this.attackingTower = null;
        }
    }

    findClosestTowerToAttack() {
        let closestTower = null;
        let closestDistance = Infinity;
        
        // Find the closest tower
        for (const tower of this.game.towers) {
            const towerCenterX = tower.x + tower.width / 2 + this.game.gameArea.x;
            const towerCenterY = tower.y + tower.height / 2;
            
            const dx = towerCenterX - this.x;
            const dy = towerCenterY - this.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < closestDistance) {
                closestDistance = distance;
                closestTower = tower;
            }
        }
        
        // Set the closest tower as target
        this.attackingTower = closestTower;
    }

    attackTower() {
        if (!this.attackingTower) return;
        
        // Check if tower is still in game (might have been sold/destroyed)
        if (this.game.towers.indexOf(this.attackingTower) === -1) {
            this.attackingTower = null;
            this.findPath();
            return;
        }
        
        // Deal damage to tower at regular intervals
        if (this.attackCooldown <= 0) {
            // Reduce tower "health" by destroying it after several hits
            this.attackingTower.hits = (this.attackingTower.hits || 0) + 1;
            
            // After 5 hits, destroy the tower
            if (this.attackingTower.hits >= 5) {
                this.game.destroyTower(this.attackingTower);
                this.attackingTower = null;
                
                // Try to find a path again now that tower is gone
                this.findPath();
            }
            
            // Reset cooldown
            this.attackCooldown = 60; // Attack every ~1 second
        } else {
            this.attackCooldown--;
        }
    }

    update() {
        if (!this.isAlive) return;
        
        // Check if creep reached the home point
        const homePointDistance = Math.sqrt(
            Math.pow(this.x - this.game.homePoint.x, 2) + 
            Math.pow(this.y - this.game.homePoint.y, 2)
        );
        
        if (homePointDistance < this.game.homePoint.radius + this.radius) {
            this.reachedEnd = true;
            this.isAlive = false;
            return; // Lives are reduced in Game class
        }

        // If attacking a tower, handle that instead of following path
        if (this.attackingTower) {
            this.moveTowardsTower();
            return;
        }
        
        // If no path exists, try to find a new one
        if (!this.path) {
            this.findPath();
            if (!this.path) return; // Still no path, try attacking
        }

        // Move towards next point in path
        if (this.pathIndex < this.path.length) {
            const target = this.path[this.pathIndex];
            // Calculate target position (account for game area offset)
            const targetX = (target.x + 0.5) * this.game.grid.cellSize + this.game.gameArea.x;
            const targetY = (target.y + 0.5) * this.game.grid.cellSize;
            
            // Calculate distance to target
            const dx = targetX - this.x;
            const dy = targetY - this.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            // If close enough to target, move to next point in path
            if (distance < this.speed * 2) {
                this.pathIndex++;
            } else {
                // Otherwise move towards target
                this.x += (dx / distance) * this.speed;
                this.y += (dy / distance) * this.speed;
            }
        } 
        // If at end of path (last point), continue downward
        else if (this.path.length > 0) {
            this.y += this.speed;
        }

        // Check if path is still valid (e.g., if player placed tower in the way)
        // Only check every ~30 frames for performance
        if (Math.random() < 0.03) {
            // Convert to grid coordinates (account for game area offset)
            const gridX = Math.floor((this.x - this.game.gameArea.x) / this.game.grid.cellSize);
            const gridY = Math.floor(this.y / this.game.grid.cellSize);
            
            // If current cell is occupied, find new path
            if (gridX >= 0 && gridX < this.game.grid.cols && 
                gridY >= 0 && gridY < this.game.grid.rows && 
                this.game.grid.cells[gridY][gridX].occupied) {
                // Move back slightly to avoid getting stuck
                const dx = this.path[this.pathIndex].x * this.game.grid.cellSize + this.game.gameArea.x - this.x;
                const dy = this.path[this.pathIndex].y * this.game.grid.cellSize - this.y;
                this.x -= dx * 0.5;
                this.y -= dy * 0.5;
                this.findPath();
            }
        }
    }

    moveTowardsTower() {
        if (!this.attackingTower) return;
        
        // Check if tower is still in game
        if (this.game.towers.indexOf(this.attackingTower) === -1) {
            this.attackingTower = null;
            this.findPath();
            return;
        }
        
        // Calculate target position (center of tower)
        const targetX = this.attackingTower.x + this.attackingTower.width / 2 + this.game.gameArea.x;
        const targetY = this.attackingTower.y + this.attackingTower.height / 2;
        
        // Calculate distance to target
        const dx = targetX - this.x;
        const dy = targetY - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // If close enough to tower, attack it
        if (distance < this.radius + this.attackingTower.width / 2) {
            this.attackTower();
        } else {
            // Otherwise move towards tower
            this.x += (dx / distance) * this.speed;
            this.y += (dy / distance) * this.speed;
        }
        
        // Periodically check if a path is available now
        if (Math.random() < 0.05) {
            this.findPath();
        }
    }

    takeDamage(amount) {
        this.health -= amount;
        this.isDamaged = true; // Mark as damaged to show health bar
        if (this.health <= 0) {
            this.isAlive = false;
            // Score and money are added in Game class
        }
    }

    draw(ctx) {
        if (!this.isAlive) return;
        
        // Draw creep body
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        
        // Draw boss indicators (spikes or crown) if it's a boss
        if (this.isBoss) {
            ctx.strokeStyle = '#FFFF00';
            ctx.lineWidth = 2;
            
            // Draw spikes or crown around the creep
            const spikes = 8; // Number of spikes
            const spikeLength = this.radius * 0.5;
            
            for (let i = 0; i < spikes; i++) {
                const angle = (i / spikes) * Math.PI * 2;
                const startX = this.x + Math.cos(angle) * this.radius;
                const startY = this.y + Math.sin(angle) * this.radius;
                const endX = this.x + Math.cos(angle) * (this.radius + spikeLength);
                const endY = this.y + Math.sin(angle) * (this.radius + spikeLength);
                
                ctx.beginPath();
                ctx.moveTo(startX, startY);
                ctx.lineTo(endX, endY);
                ctx.stroke();
            }
        }
        
        // Draw health bar only if damaged or boss
        if (this.isDamaged || this.isBoss) {
            const healthBarWidth = this.radius * 2;
            const healthBarHeight = 4;
            const healthBarX = this.x - healthBarWidth / 2;
            const healthBarY = this.y - this.radius - 10;
            
            // Health bar background
            ctx.fillStyle = '#333333';
            ctx.fillRect(healthBarX, healthBarY, healthBarWidth, healthBarHeight);
            
            // Health remaining
            const healthPercentage = this.health / this.maxHealth;
            ctx.fillStyle = healthPercentage > 0.5 ? '#00FF00' : 
                           healthPercentage > 0.25 ? '#FFFF00' : '#FF0000';
            ctx.fillRect(healthBarX, healthBarY, healthBarWidth * healthPercentage, healthBarHeight);
        }
        
        // Draw attacking indicator
        if (this.attackingTower) {
            ctx.strokeStyle = '#FF0000';
            ctx.lineWidth = 2;
            
            // Target tower center
            const targetX = this.attackingTower.x + this.attackingTower.width / 2 + this.game.gameArea.x;
            const targetY = this.attackingTower.y + this.attackingTower.height / 2;
            
            // Draw pulsing attack line
            const pulse = 0.7 + 0.3 * Math.sin(Date.now() / 100);
            ctx.globalAlpha = pulse;
            
            ctx.beginPath();
            ctx.moveTo(this.x, this.y);
            ctx.lineTo(targetX, targetY);
            ctx.stroke();
            
            ctx.globalAlpha = 1;
        }
    }
} 