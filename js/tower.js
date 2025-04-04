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

export class Tower {
    constructor(game, gridX, gridY, type) {
        this.game = game;
        this.gridX = gridX;
        this.gridY = gridY;
        this.type = type;
        this.x = gridX * game.grid.cellSize;
        this.y = gridY * game.grid.cellSize;
        this.width = game.grid.cellSize * 2;
        this.height = game.grid.cellSize * 2;
        this.damage = type.damage;
        this.range = type.range;
        this.fireRate = type.fireRate;
        this.lastFireTime = 0;
        this.projectiles = [];
        this.isWall = type.name === "Wall";
        this.isScrapper = type.isScrapper;
        this.maxBounces = type.maxBounces || 0;
        this.explosionRadius = type.explosionRadius || 0;
        this.explosionDamage = type.explosionDamage || 0;
        this.color = type.color;
        this.strokeColor = type.strokeColor;
        this.cost = type.cost;
        
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
            
            // Move projectile with different speed based on tower type
            let speed;
            if (this.type.name === "Sniper") {
                speed = 20; // Nopeampi nopeus Sniper-tornille
            } else {
                speed = 10; // Normaali nopeus muille torneille
            }
            
            const vx = (dx / distance) * speed;
            const vy = (dy / distance) * speed;
            projectile.x += vx;
            projectile.y += vy;
            
            // Tarkista osuminen uudella etäisyydellä
            const newDx = projectile.targetX - projectile.x;
            const newDy = projectile.targetY - projectile.y;
            const newDistance = Math.sqrt(newDx * newDx + newDy * newDy);
            
            // Jos ammus on ohittanut kohteen tai on tarpeeksi lähellä
            if (newDistance >= distance || newDistance < 10) {
                // Projectile hit target
                if (projectile.target.isAlive) {
                    projectile.target.takeDamage(this.damage);
                    
                    // Handle explosion damage
                    if (this.explosionRadius > 0) {
                        for (const creep of this.game.creeps) {
                            if (!creep.isAlive || creep === projectile.target) continue;
                            
                            const dx = creep.x - projectile.x;
                            const dy = creep.y - projectile.y;
                            const distance = Math.sqrt(dx * dx + dy * dy);
                            
                            if (distance <= this.explosionRadius) {
                                creep.takeDamage(this.explosionDamage);
                            }
                        }
                    }
                    
                    // Handle bouncing projectile
                    if (this.maxBounces > 0 && projectile.bounces < this.maxBounces) {
                        // Find next target
                        let nextTarget = null;
                        let closestDistance = this.range;
                        
                        for (const creep of this.game.creeps) {
                            if (!creep.isAlive || creep === projectile.target) continue;
                            
                            const dx = creep.x - projectile.x;
                            const dy = creep.y - projectile.y;
                            const distance = Math.sqrt(dx * dx + dy * dy);
                            
                            if (distance <= this.range && (!nextTarget || distance < closestDistance)) {
                                nextTarget = creep;
                                closestDistance = distance;
                            }
                        }
                        
                        if (nextTarget) {
                            // Continue projectile to next target
                            projectile.target = nextTarget;
                            projectile.targetX = nextTarget.x;
                            projectile.targetY = nextTarget.y;
                            projectile.bounces++;
                            continue;
                        }
                    }
                }
                this.projectiles.splice(i, 1);
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
        const towerCenterX = this.x + this.width / 2;
        const towerCenterY = this.y + this.height / 2;
        
        this.projectiles.push({
            x: towerCenterX,
            y: towerCenterY,
            targetX: target.x,
            targetY: target.y,
            target: target,
            bounces: 0
        });
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
export class Wall extends Tower {
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