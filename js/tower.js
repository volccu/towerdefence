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

class Explosion {
    constructor(x, y, radius, game) {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.game = game;
        this.maxRadius = radius;
        this.life = 1.0; // 1.0 -> 0.0
        this.isActive = true;
    }

    update() {
        this.life -= 0.2; // Nopeampi katoaminen
        if (this.life <= 0) {
            this.isActive = false;
        }
    }

    draw(ctx) {
        const alpha = this.life;
        const currentRadius = this.maxRadius * (1 - this.life);
        
        // Piirrä yksinkertainen oranssi ympyrä
        ctx.fillStyle = `rgba(255, 165, 0, ${alpha})`;
        ctx.beginPath();
        ctx.arc(
            this.x + this.game.gameArea.x,
            this.y,
            currentRadius,
            0,
            Math.PI * 2
        );
        ctx.fill();
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
        this.burstCount = type.burstCount || 1;
        this.burstDelay = type.burstDelay || 0;
        this.currentBurst = 0;
        this.burstTimer = 0;
        
        // Laser-viivan tilat
        this.currentTarget = null;
        this.showLaser = false;
        this.laserCooldown = 0;
        
        if (this.isScrapper) {
            this.scrapRate = type.scrapRate;
            this.scrapInterval = type.scrapInterval;
            this.lastScrapTime = 0;
        }

        this.explosions = [];
    }

    update(currentTime) {
        if (this.isWall || this.isScrapper) return;
        
        // Päivitä laserin cooldown-aika
        if (this.laserCooldown > 0) {
            this.laserCooldown -= 16;
            if (this.laserCooldown <= 0) {
                this.laserCooldown = 0;
            }
        }
        
        // Handle burst firing
        if (this.currentBurst > 0) {
            this.burstTimer += this.game.deltaTime;
            if (this.burstTimer >= this.burstDelay) {
                this.burstTimer = 0;
                this.fireAt(this.currentTarget);
                this.currentBurst--;
            }
        }
        
        // Etsi lähin kohde
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
        
        // Päivitä kohde ja laser
        if (closestCreep) {
            this.currentTarget = closestCreep;
            this.showLaser = this.laserCooldown === 0;
            this.currentBurst = this.burstCount;
            this.burstTimer = 0;
        } else {
            this.currentTarget = null;
            this.showLaser = false;
        }
        
        // Check if tower can fire
        if (currentTime - this.lastFireTime >= 1000 / this.fireRate) {
            if (closestCreep) {
                this.fireAt(closestCreep);
                this.lastFireTime = currentTime;
                this.laserCooldown = 200;
            }
        }
        
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
                speed = 20;
            } else {
                speed = 10;
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
                    // Luo räjähdys heti kun ammus osuu
                    if (this.explosionRadius > 0) {
                        this.explosions.push(new Explosion(
                            projectile.x,
                            projectile.y,
                            this.explosionRadius,
                            this.game
                        ));
                    }

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

        // Päivitä räjähdykset
        for (let i = this.explosions.length - 1; i >= 0; i--) {
            const explosion = this.explosions[i];
            explosion.update();
            if (!explosion.isActive) {
                this.explosions.splice(i, 1);
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
        // Piirrä torni ensin
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
            return;
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
        } else {
            // Draw regular tower
            if (this.game.assets.isReady()) {
                const img = this.game.assets.getImage('tower');
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

        // Piirrä laser-viiva jos tämä on sniper-torni ja sillä on kohde
        if (this.type.name === "Sniper" && this.currentTarget && this.showLaser) {
            const towerCenterX = this.x + this.width / 2 + this.game.gameArea.x;
            const towerCenterY = this.y + this.height / 2;
            const targetX = this.currentTarget.x + this.game.gameArea.x;
            const targetY = this.currentTarget.y;
            
            // Aseta viivan tyyli
            ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)';
            ctx.lineWidth = 1;
            ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
            
            // Piirrä laser-viiva
            ctx.beginPath();
            ctx.moveTo(towerCenterX, towerCenterY);
            ctx.lineTo(targetX, targetY);
            ctx.stroke();
            
            // Piirrä kohdepiste
            ctx.beginPath();
            ctx.arc(targetX, targetY, 2, 0, Math.PI * 2);
            ctx.fill();
        }

        // Piirrä projektiilit
        for (const projectile of this.projectiles) {
            if (this.type.name === "Bouncer") {
                // Chain lightning -efekti bouncer-tornille
                const gradient = ctx.createLinearGradient(
                    projectile.x + this.game.gameArea.x,
                    projectile.y,
                    projectile.targetX + this.game.gameArea.x,
                    projectile.targetY
                );
                gradient.addColorStop(0, 'rgba(255, 255, 255, 0.8)');
                gradient.addColorStop(0.5, 'rgba(0, 255, 255, 0.8)');
                gradient.addColorStop(1, 'rgba(0, 0, 255, 0.8)');
                
                ctx.strokeStyle = gradient;
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(projectile.x + this.game.gameArea.x, projectile.y);
                ctx.lineTo(projectile.targetX + this.game.gameArea.x, projectile.targetY);
                ctx.stroke();
                
                // Piirrä salamapallo
                ctx.fillStyle = 'rgba(0, 255, 255, 0.8)';
                ctx.beginPath();
                ctx.arc(
                    projectile.x + this.game.gameArea.x,
                    projectile.y,
                    4 * this.game.scaleFactor,
                    0,
                    Math.PI * 2
                );
                ctx.fill();
            } else {
                // Normaali projektiili muille torneille
                ctx.fillStyle = '#FFF';
                ctx.beginPath();
                ctx.arc(
                    projectile.x + this.game.gameArea.x,
                    projectile.y,
                    3 * this.game.scaleFactor,
                    0,
                    Math.PI * 2
                );
                ctx.fill();
            }
        }

        // Piirrä räjähdykset
        for (const explosion of this.explosions) {
            explosion.draw(ctx);
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

// ElectricFence class - special tower type that damages nearby enemies
export class ElectricFence extends Tower {
    constructor(game, gridX, gridY, fenceType) {
        super(game, gridX, gridY, fenceType);
        
        // Override sizes for fence (1x1 instead of 2x2)
        this.width = game.grid.cellSize;
        this.height = game.grid.cellSize;
        this.isElectricFence = true;
        this.isWall = true; // Käsitellään seinänä sijoittelun kannalta
        this.lastDamageTime = 0;
    }
    
    update(currentTime) {
        // Vahingoita lähellä olevia vihollisia vain kun fireRate sallii
        if (currentTime - this.lastDamageTime >= 1000 / this.fireRate) {
            const centerX = this.x + this.width / 2;
            const centerY = this.y + this.height / 2;
            
            // Käytä range^2 vertailua ettei tarvitse laskea neliöjuurta
            const rangeSquared = this.range * this.range;
            
            for (const creep of this.game.creeps) {
                if (!creep.isAlive) continue;
                
                const dx = creep.x - centerX;
                const dy = creep.y - centerY;
                const distanceSquared = dx * dx + dy * dy;
                
                if (distanceSquared <= rangeSquared) {
                    creep.takeDamage(this.damage);
                }
            }
            
            this.lastDamageTime = currentTime;
        }
    }
    
    draw(ctx) {
        // Calculate position with offset
        const drawX = this.x + this.game.gameArea.x;
        
        // Piirrä sähköaidan pohja käyttäen wall-kuvaa
        if (this.game.assets && this.game.assets.isReady()) {
            const wallImg = this.game.assets.getImage('wall');
            ctx.drawImage(wallImg, drawX, this.y, this.width, this.height);
        } else {
            // Fallback jos kuva ei ole vielä latautunut
            ctx.fillStyle = this.color;
            ctx.fillRect(drawX, this.y, this.width, this.height);
        }
        
        // Piirrä sähköefekti
        const time = Date.now() / 500; // Hidastettu animaatio (200 -> 500)
        const intensity = 0.3 + 0.2 * Math.sin(time); // Vaihtelee välillä 0.3-0.5 (oli 0.5-1.0)
        
        // Piirrä hohtava reunus
        ctx.strokeStyle = `rgba(100, 149, 237, ${intensity})`; // Cornflower blue
        ctx.lineWidth = 1; // Ohennettu viiva (oli 2)
        ctx.strokeRect(drawX, this.y, this.width, this.height);
        
        // Piirrä satunnaisia "sähkökipinöitä"
        ctx.strokeStyle = `rgba(255, 255, 255, ${intensity})`;
        const sparkCount = 2; // Vähennetty kipinöiden määrää (oli 4)
        ctx.beginPath();
        
        // Piirrä kipinöitä reunojen yli
        for (let i = 0; i < sparkCount; i++) {
            const angle = Math.random() * Math.PI * 2;
            const radius = this.width * 0.5; // Pienennetty kipinöiden pituutta (oli 0.7)
            const centerX = drawX + this.width / 2;
            const centerY = this.y + this.height / 2;
            
            const startX = centerX + Math.cos(angle) * (radius * 0.5);
            const startY = centerY + Math.sin(angle) * (radius * 0.5);
            const endX = centerX + Math.cos(angle) * radius;
            const endY = centerY + Math.sin(angle) * radius;
            
            ctx.moveTo(startX, startY);
            ctx.lineTo(endX, endY);
        }
        ctx.stroke();
        
        // Piirrä vaikutusalue jos torni on valittu
        if (this.game.selectedTower === this) {
            ctx.beginPath();
            ctx.arc(
                drawX + this.width / 2,
                this.y + this.height / 2,
                this.range,
                0,
                Math.PI * 2
            );
            ctx.strokeStyle = 'rgba(255, 255, 100, 0.4)';
            ctx.lineWidth = 2;
            ctx.stroke();
        }
    }
} 