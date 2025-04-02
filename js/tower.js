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
    constructor(game, gridX, gridY, towerType) {
        this.game = game;
        this.gridX = gridX;
        this.gridY = gridY;
        this.x = gridX * game.grid.cellSize;
        this.y = gridY * game.grid.cellSize + game.gameArea.y;
        this.width = game.grid.cellSize * 2;  // 2x2 grid cells
        this.height = game.grid.cellSize * 2;
        
        // Apply tower type properties
        this.name = towerType.name;
        this.range = towerType.range;
        this.damage = towerType.damage;
        this.fireRate = towerType.fireRate;
        this.color = towerType.color;
        this.strokeColor = towerType.strokeColor;
        this.cost = towerType.cost;
        this.isWall = false; // Default value
        
        this.lastFireTime = 0;
        this.projectiles = [];
    }

    update(currentTime) {
        // Update projectiles
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const projectile = this.projectiles[i];
            projectile.update();
            
            // Remove inactive projectiles
            if (!projectile.isActive) {
                this.projectiles.splice(i, 1);
            }
        }

        // Check if we can fire again
        if (currentTime - this.lastFireTime >= 1000 / this.fireRate) {
            this.findTargetAndShoot(currentTime);
        }
    }

    findTargetAndShoot(currentTime) {
        // Find nearest enemy within range
        let nearestCreep = null;
        let shortestDistance = this.range;

        const towerCenterX = this.x + this.width / 2 + this.game.gameArea.x;
        const towerCenterY = this.y + this.height / 2;

        for (const creep of this.game.creeps) {
            if (!creep.isAlive) continue;

            const dx = creep.x - towerCenterX;
            const dy = creep.y - towerCenterY;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < shortestDistance) {
                shortestDistance = distance;
                nearestCreep = creep;
            }
        }

        // If target found, shoot at it
        if (nearestCreep) {
            this.shoot(nearestCreep, currentTime);
        }
    }

    shoot(targetCreep, currentTime) {
        const towerCenterX = this.x + this.width / 2 + this.game.gameArea.x;
        const towerCenterY = this.y + this.height / 2;
        
        // Create new projectile
        const projectile = new Projectile(
            towerCenterX,
            towerCenterY,
            targetCreep,
            this.damage
        );
        
        this.projectiles.push(projectile);
        this.lastFireTime = currentTime;
    }

    draw(ctx) {
        // Calculate position with offset
        const drawX = this.x + this.game.gameArea.x;
        
        // Käytä tower-kuvaa
        if (this.game.assets && this.game.assets.isReady()) {
            const towerImg = this.game.assets.getImage('tower');
            ctx.drawImage(towerImg, drawX, this.y, this.width, this.height);
        } else {
            // Fallback jos kuva ei ole vielä latautunut
            ctx.fillStyle = this.color;
            ctx.fillRect(drawX, this.y, this.width, this.height);
            
            ctx.strokeStyle = this.strokeColor;
            ctx.lineWidth = 2;
            ctx.strokeRect(drawX, this.y, this.width, this.height);
        }

        // Draw range (visible only in debug mode)
        if (this.game.debugMode) {
            ctx.strokeStyle = 'rgba(0, 255, 255, 0.3)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(
                drawX + this.width / 2,
                this.y + this.height / 2,
                this.range,
                0,
                Math.PI * 2
            );
            ctx.stroke();
        }

        // Draw projectiles
        for (const projectile of this.projectiles) {
            projectile.draw(ctx);
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