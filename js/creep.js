class Creep {
    constructor(game, x, y, health = 100, speed = 0.5, color = '#FF5500') {
        this.game = game;
        this.x = x;
        this.y = y;
        this.health = health;
        this.maxHealth = health;
        this.speed = speed;
        this.color = color;
        this.radius = 8;
        this.isAlive = true;
        this.reachedEnd = false;
        this.pathIndex = 0;
        this.path = null;
        this.isDamaged = false; // Track if creep has been damaged
        this.findPath();
    }

    findPath() {
        // Convert pixel coordinates to grid coordinates
        const gridX = Math.floor((this.x - this.game.gameArea.x) / this.game.grid.cellSize);
        const gridY = Math.floor(this.y / this.game.grid.cellSize);
        
        // Find path to bottom
        this.path = this.game.pathfinding.findPathToBottom(gridX, gridY);
        this.pathIndex = 0;
        
        // If no path is found, creep waits
        if (!this.path) {
            console.log("No path found!");
        }
    }

    update() {
        if (!this.isAlive) return;
        
        // If creep reached the bottom edge, reduce player lives
        if (this.y >= this.game.canvas.height) {
            this.reachedEnd = true;
            this.isAlive = false;
            return; // Lives are reduced in Game class
        }

        // If no path exists, try to find a new one
        if (!this.path) {
            this.findPath();
            if (!this.path) return; // Still no path, wait
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
        
        // Draw creep circle
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        
        // Only draw health bar if creep is damaged
        if (this.isDamaged) {
            const healthBarWidth = this.radius * 2;
            const healthBarHeight = 3;
            const healthPercentage = this.health / this.maxHealth;
            const healthBarY = this.y + this.radius + 5;
            
            // Background
            ctx.fillStyle = '#333';
            ctx.fillRect(this.x - this.radius, healthBarY, healthBarWidth, healthBarHeight);
            
            // Health
            ctx.fillStyle = this.health > this.maxHealth * 0.5 ? '#00FF00' : '#FF0000';
            ctx.fillRect(
                this.x - this.radius, 
                healthBarY, 
                healthBarWidth * healthPercentage, 
                healthBarHeight
            );
        }
    }
} 