/**
 * Sprite-kuvien lisääminen peliin:
 * 
 * 1. Luo kuvatiedosto (suositeltu formaatti: PNG, läpinäkyvyydellä)
 * 2. Tallenna kuva assets-kansioon
 * 3. Lataa kuva pelin alustuksessa (Game-luokan initialize-metodissa):
 *    this.assets.loadImage('kuvannimi', 'assets/kuvatiedosto.png');
 * 4. Käytä kuvaa objektien piirtämisessä:
 *    - const img = this.game.assets.getImage('kuvannimi');
 *    - ctx.drawImage(img, x, y, width, height);
 * 
 * Suositellut kuvakoot:
 * - Torni: 40x40 pikseliä (2x2 grid)
 * - Seinä: 20x20 pikseliä (1x1 grid)
 * - Creep: 16x16 pikseliä (piirretään radius*2 kokoiseksi)
 * - Projektiilit: 6x6 pikseliä
 */

class Projectile {
    constructor(x, y, targetCreep, damage, speed = 5, color = '#00FFFF') {
        this.x = x;
        this.y = y;
        this.targetCreep = targetCreep;
        this.damage = damage;
        this.speed = speed;
        this.color = color;
        this.radius = 3;
        this.isActive = true;
    }

    update() {
        if (!this.targetCreep || !this.targetCreep.isAlive) {
            this.isActive = false;
            return;
        }

        // Calculate direction to target
        const dx = this.targetCreep.x - this.x;
        const dy = this.targetCreep.y - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // If we hit the target
        if (distance < this.radius + this.targetCreep.radius) {
            this.targetCreep.takeDamage(this.damage);
            this.isActive = false;
            return;
        }

        // Move towards enemy
        if (distance > 0) {
            this.x += (dx / distance) * this.speed;
            this.y += (dy / distance) * this.speed;
        }
    }

    draw(ctx) {
        // Tulevaisuudessa mahdollinen projektiilikuvan käyttö:
        // if (this.game.assets && this.game.assets.isReady() && this.game.assets.getImage('projectile')) {
        //     const projImg = this.game.assets.getImage('projectile');
        //     ctx.drawImage(projImg, this.x - this.radius, this.y - this.radius, this.radius * 2, this.radius * 2);
        // } else {
            ctx.fillStyle = this.color;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
            ctx.fill();
        // }
    }
}

class Tower {
    constructor(game, gridX, gridY, type) {
        this.game = game;
        this.gridX = gridX;
        this.gridY = gridY;
        this.x = gridX * game.grid.cellSize;
        this.y = gridY * game.grid.cellSize;
        this.width = game.grid.cellSize * 2;
        this.height = game.grid.cellSize * 2;
        this.type = type;
        this.color = type.color;
        this.strokeColor = type.strokeColor;
        this.damage = type.damage;
        this.range = type.range;
        this.fireRate = type.fireRate;
        this.lastFireTime = 0;
        this.cost = type.cost;
        this.isWall = type.name === "Wall";
        this.isScrapper = type.name === "Scrapper";
        this.projectiles = [];
        
        if (this.isScrapper) {
            this.scrapRate = type.scrapRate;
            this.scrapInterval = type.scrapInterval;
            this.lastScrapTime = 0;
        }
    }

    update(currentTime) {
        if (this.isWall || this.isScrapper) return;
        
        // Update projectiles
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const projectile = this.projectiles[i];
            
            // Move projectile towards target
            const dx = projectile.targetX - projectile.x;
            const dy = projectile.targetY - projectile.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < 5) {
                // Projectile hit target
                if (projectile.target.isAlive) {
                    projectile.target.takeDamage(this.damage);
                }
                this.projectiles.splice(i, 1);
            } else {
                // Move projectile
                const speed = 10;
                const vx = (dx / distance) * speed;
                const vy = (dy / distance) * speed;
                projectile.x += vx;
                projectile.y += vy;
            }
        }
        
        // Check if tower can fire
        if (currentTime - this.lastFireTime >= 1000 / this.fireRate) {
            // Find closest creep in range
            let closestCreep = null;
            let closestDistance = this.range;
            
            for (const creep of this.game.creeps) {
                if (!creep.isAlive) continue;
                
                const dx = creep.x - (this.x + this.width / 2);
                const dy = creep.y - (this.y + this.height / 2);
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance <= this.range && (!closestCreep || distance < closestDistance)) {
                    closestCreep = creep;
                    closestDistance = distance;
                }
            }
            
            // Fire at closest creep
            if (closestCreep) {
                this.fireAt(closestCreep);
                this.lastFireTime = currentTime;
            }
        }
    }

    fireAt(target) {
        // Create new projectile
        const projectile = {
            x: this.x + this.width / 2,
            y: this.y + this.height / 2,
            targetX: target.x,
            targetY: target.y,
            target: target
        };
        
        this.projectiles.push(projectile);
    }

    draw(ctx) {
        if (this.isWall) {
            // Draw wall
            if (this.game.assets.isReady()) {
                const img = this.game.assets.getImage('wall');
                this.game.drawImageMaintainAspectRatio(
                    img,
                    this.x + this.game.gameArea.x,
                    this.y,
                    this.game.grid.cellSize,
                    this.game.grid.cellSize
                );
            } else {
                ctx.fillStyle = this.color;
                ctx.fillRect(
                    this.x + this.game.gameArea.x,
                    this.y,
                    this.game.grid.cellSize,
                    this.game.grid.cellSize
                );
            }
        } else if (this.isScrapper) {
            // Draw scrapper
            if (this.game.assets.isReady()) {
                const img = this.game.assets.getImage('scrapper');
                this.game.drawImageMaintainAspectRatio(
                    img,
                    this.x + this.game.gameArea.x,
                    this.y,
                    this.width,
                    this.height
                );
            } else {
                ctx.fillStyle = this.color;
                ctx.fillRect(
                    this.x + this.game.gameArea.x,
                    this.y,
                    this.width,
                    this.height
                );
            }
        }
    }
}

// Wall class - special tower type that doesn't attack but blocks paths
class Wall extends Tower {
    constructor(game, gridX, gridY, wallType) {
        super(game, gridX, gridY, wallType);
        
        // Override sizes for wall (1x1 instead of 2x2)
        this.width = game.grid.cellSize;
        this.height = game.grid.cellSize;
        this.isWall = true;
    }
    
    // Override update to do nothing (walls don't shoot)
    update() {
        // Walls don't do anything actively
        return;
    }
    
    // Override the shooting mechanism (walls don't shoot)
    findTargetAndShoot() {
        // Do nothing
        return;
    }
    
    shoot() {
        // Do nothing
        return;
    }
    
    // Override draw to show wall sprite
    draw(ctx) {
        // Calculate position with offset
        const drawX = this.x + this.game.gameArea.x;
        
        // Käytä wall-kuvaa
        if (this.game.assets && this.game.assets.isReady()) {
            const wallImg = this.game.assets.getImage('wall');
            ctx.drawImage(wallImg, drawX, this.y, this.width, this.height);
        } else {
            // Fallback jos kuva ei ole vielä latautunut
            ctx.fillStyle = this.color;
            ctx.fillRect(drawX, this.y, this.width, this.height);
            
            ctx.strokeStyle = this.strokeColor;
            ctx.lineWidth = 2;
            ctx.strokeRect(drawX, this.y, this.width, this.height);
        }
    }
} 