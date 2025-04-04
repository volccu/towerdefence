export class Creep {
    constructor(game, x, y, health = 100, speed = 0.5, color = '#FF5500', radius = 8, isBoss = false, isMiniBoss = false) {
        this.game = game;
        this.x = x;
        this.y = y;
        this.health = health;
        this.maxHealth = health;
        this.speed = speed;
        this.color = color;
        this.radius = radius;
        this.isBoss = isBoss;
        this.isMiniBoss = isMiniBoss;
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
        const gridY = Math.floor((this.y - this.game.gameArea.y) / this.game.grid.cellSize);
        
        // Find path to home point instead of just bottom
        const homePointGridX = Math.floor((this.game.homePoint.x - this.game.gameArea.x) / this.game.grid.cellSize);
        const homePointGridY = Math.floor((this.game.homePoint.y - this.game.gameArea.y) / this.game.grid.cellSize);
        
        this.path = this.game.pathfinding.findPath(gridX, gridY, homePointGridX, homePointGridY);
        this.pathIndex = 0;
        
        // Jos polku löytyi, peruuta torniin hyökkääminen
        if (this.path) {
            this.attackingTower = null;
        }
        // Vain jos polkua ei löydy, etsi lähimmät tornit joihin hyökätä
        else if (!this.path) {
            this.findClosestTowerToAttack();
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

        // Jos meillä on polku, käytä sitä ensisijaisesti
        if (this.path && this.pathIndex < this.path.length) {
            // Lopeta hyökkääminen jos voimme kulkea polkua pitkin
            this.attackingTower = null;
            
            // Move towards next point in path
            const target = this.path[this.pathIndex];
            // Calculate target position (account for game area offset)
            const targetX = (target.x + 0.5) * this.game.grid.cellSize + this.game.gameArea.x;
            const targetY = (target.y + 0.5) * this.game.grid.cellSize + this.game.gameArea.y; // Korjattu y-koordinaatti
            
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
        // If at end of path or no path, check if we can find a new path
        else {
            // Try to find a new path before attacking towers
            this.findPath();
            
            // If still no path, handle tower attacking
            if (!this.path && this.attackingTower) {
                this.moveTowardsTower();
            }
            // If we've reached end of path but still have a path, continue to home
            else if (this.path && this.pathIndex >= this.path.length) {
                // Liiku kohti kotipisteettä jos polku on loppunut
                const dx = this.game.homePoint.x - this.x;
                const dy = this.game.homePoint.y - this.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance > 0) {
                    this.x += (dx / distance) * this.speed;
                    this.y += (dy / distance) * this.speed;
                }
            }
        }

        // Check if path is still valid (e.g., if player placed tower in the way)
        // Only check every ~30 frames for performance
        if (Math.random() < 0.03) {
            // Convert to grid coordinates (account for game area offset)
            const gridX = Math.floor((this.x - this.game.gameArea.x) / this.game.grid.cellSize);
            const gridY = Math.floor((this.y - this.game.gameArea.y) / this.game.grid.cellSize);
            
            // If current cell is occupied or an obstacle, find new path
            if (gridX >= 0 && gridX < this.game.grid.cols && 
                gridY >= 0 && gridY < this.game.grid.rows && 
                (this.game.grid.cells[gridY][gridX].occupied || this.game.grid.cells[gridY][gridX].isObstacle)) {
                // Move back slightly to avoid getting stuck
                if (this.path && this.pathIndex < this.path.length) {
                    const pathPoint = this.path[this.pathIndex];
                    const dx = pathPoint.x * this.game.grid.cellSize + this.game.gameArea.x - this.x;
                    const dy = pathPoint.y * this.game.grid.cellSize + this.game.gameArea.y - this.y;
                    this.x -= dx * 0.2;
                    this.y -= dy * 0.2;
                }
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
        
        // Käytä creep-kuvaa ympyrän sijaan kun kuva on ladattu
        if (this.game.assets && this.game.assets.isReady()) {
            let creepImg;
            if (this.isBoss) {
                creepImg = this.game.assets.getImage('boss');
            } else if (this.isMiniBoss) {
                creepImg = this.game.assets.getImage('miniboss');
            } else {
                creepImg = this.game.assets.getImage('creep');
            }
            
            // Keskitä kuva creep-koordinaatteihin
            const drawX = this.x - this.radius;
            const drawY = this.y - this.radius;
            const size = this.radius * 2;
            
            // Varmista että kuva on olemassa ennen piirtämistä
            if (creepImg) {
                ctx.drawImage(creepImg, drawX, drawY, size, size);
            } else {
                // Fallback jos kuva ei ole vielä latautunut tai sitä ei löydy
                ctx.fillStyle = this.color;
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
                ctx.fill();
            }
        } else {
            // Fallback jos AssetLoader ei ole valmis
            ctx.fillStyle = this.color;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
            ctx.fill();
        }
        
        // Draw health bar only if damaged or boss/miniboss
        if (this.isDamaged || this.isBoss || this.isMiniBoss) {
            const healthBarWidth = this.radius * 2;
            const healthBarHeight = 4;
            const healthBarX = this.x - healthBarWidth / 2;
            const healthBarY = this.y - this.radius - 10;
            
            // Background of health bar
            ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            ctx.fillRect(healthBarX, healthBarY, healthBarWidth, healthBarHeight);
            
            // Health portion
            const healthPortion = this.health / this.maxHealth;
            ctx.fillStyle = healthPortion > 0.5 ? '#00FF00' : healthPortion > 0.25 ? '#FFFF00' : '#FF0000';
            ctx.fillRect(healthBarX, healthBarY, healthBarWidth * healthPortion, healthBarHeight);
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