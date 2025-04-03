class AssetLoader {
    constructor() {
        this.images = {};
        this.totalImages = 0;
        this.loadedImages = 0;
        this.loadingComplete = false;
    }

    loadImage(name, src) {
        this.totalImages++;
        const img = new Image();
        img.onload = () => {
            this.loadedImages++;
            if (this.loadedImages === this.totalImages) {
                this.loadingComplete = true;
            }
        };
        img.src = src;
        this.images[name] = img;
    }

    getImage(name) {
        return this.images[name];
    }

    isReady() {
        return this.loadingComplete;
    }
}

class Game {
    constructor() {
        this.initialize();
        this.setupEventListeners();
        this.lastTime = 0;
        this.startGame();
    }

    // Helper function to draw images with preserved aspect ratio
    drawImageMaintainAspectRatio(img, x, y, targetWidth, targetHeight, centerX = true, centerY = false) {
        const aspectRatio = img.width / img.height;
        let width, height;
        
        if (targetWidth / targetHeight > aspectRatio) {
            // Target area is wider than image aspect
            height = targetHeight;
            width = targetHeight * aspectRatio;
        } else {
            // Target area is taller than image aspect
            width = targetWidth;
            height = targetWidth / aspectRatio;
        }
        
        // Center the image if requested
        const drawX = centerX ? x + (targetWidth - width) / 2 : x;
        const drawY = centerY ? y + (targetHeight - height) / 2 : y;
        
        this.ctx.drawImage(img, drawX, drawY, width, height);
        
        return { width, height }; // Return actual dimensions used
    }

    initialize() {
        // Canvas & context
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        
        // Luo asset loader
        this.assets = new AssetLoader();
        
        // Lataa kuvat
        this.assets.loadImage('creep', 'assets/creep.png');
        this.assets.loadImage('tower', 'assets/tower.png');
        this.assets.loadImage('wall', 'assets/wall.png');
        this.assets.loadImage('scrapper', 'assets/scrapper.png');
        this.assets.loadImage('ground', 'assets/ground.png');
        this.assets.loadImage('nonground', 'assets/nonground.png');
        this.assets.loadImage('spawn', 'assets/spawn.png');
        this.assets.loadImage('base', 'assets/base.png');
        this.assets.loadImage('button', 'assets/button.png');
        this.assets.loadImage('button2', 'assets/button2.png'); // Lisätään uusi button2 kuva
        this.assets.loadImage('scrap', 'assets/scrap.png'); // Lisätään scrap kuva
        
        // Resoluution skaalaustekijä (1.5 = 50% suurempi)
        this.scaleFactor = 1.5;
        
        // Canvas size - wider to accommodate UI panels
        this.canvas.width = 800 * this.scaleFactor; // Kavennettu 900 -> 800
        this.canvas.height = 800 * this.scaleFactor;
        
        // Stats panel on top
        this.statsPanel = {
            x: 0,
            y: 0,
            width: 800 * this.scaleFactor, // Kavennettu 900 -> 800
            height: 0 // Poistetaan stats paneeli kokonaan
        };
        
        // Game area definition (now at top)
        this.gameArea = {
            x: 0,
            y: 0,
            width: 600 * this.scaleFactor,
            height: 800 * this.scaleFactor
        };
        
        // UI panel on right side
        this.uiPanel = {
            x: 600 * this.scaleFactor,
            y: 0,
            width: 200 * this.scaleFactor, // Kavennettu 300 -> 200
            height: 800 * this.scaleFactor
        };
        
        // Grid (small cells)
        const cellSize = 20 * this.scaleFactor;
        const cols = Math.floor(this.gameArea.width / cellSize);
        const rows = Math.floor(this.gameArea.height / cellSize);

        // Luo MapGenerator ja generoi kartta
        this.mapGenerator = new MapGenerator({
            width: cols,
            height: rows,
            startPoints: [{x: Math.floor(cols / 2), y: 0}],
            endPoints: [{x: Math.floor(cols / 2), y: rows - 1}],
            obstacleDensity: 0.3,
            maxAttempts: 10
        });
        this.mapData = this.mapGenerator.generateMap();

        this.grid = new Grid(cols, rows, cellSize, this.gameArea.x, this.mapData);
        this.grid.game = this;
        
        // Pathfinding
        this.pathfinding = new Pathfinding(this.grid);
        
        // Game state
        this.playerLives = 10;
        this.scraps = 500; // Starting scraps
        this.waveReached = 0; // Track highest wave reached
        this.gameOver = false;
        this.debugMode = false;
        this.scrapMode = false; // Renamed from sellMode
        this.selectedTower = null; // For tower upgrades
        this.showRangeWhenPlacing = true; // Show range when placing towers
        this.buyMode = false; // Track if player has clicked on tower purchase button
        this.isContinuousBuild = false; // Track if player is holding mouse button to build continuously
        this.hoveredTowerType = -1; // Track which tower type is being hovered over
        
        // Tower types and costs
        this.towerTypes = [
            {
                name: "Sentry",
                description: "Tehokas puolustusjärjestelmä",
                cost: 40,
                damage: 20,
                range: 150 * this.scaleFactor,
                fireRate: 1,
                color: "#00AAFF",
                strokeColor: "#0088CC"
            },
            {
                name: "Bouncer",
                description: "Ammu kimpoileva ammus joka vahingoittaa useita vihollisia",
                cost: 60,
                damage: 15,
                range: 150 * this.scaleFactor,
                fireRate: 0.8,
                color: "#00AAFF",
                strokeColor: "#0088CC",
                maxBounces: 3
            },
            {
                name: "RPG",
                description: "Ammu räjähtävä ammus joka vahingoittaa kaikkia lähellä olevia vihollisia",
                cost: 80,
                damage: 25,
                range: 120 * this.scaleFactor,
                fireRate: 0.5,
                color: "#FF4500",
                strokeColor: "#8B0000",
                explosionRadius: 50 * this.scaleFactor,
                explosionDamage: 15
            },
            {
                name: "Sniper",
                description: "Tarkka-ampuja joka osuu kaikkialle kartalle",
                cost: 120,
                damage: 50,
                range: 9999 * this.scaleFactor, // Käytännössä ääretön kantama
                fireRate: 0.2,
                color: "#800080",
                strokeColor: "#4B0082"
            },
            {
                name: "Wall",
                description: "Ohjaa viholliset haluamaasi reittiä",
                cost: 5,
                damage: 0,
                range: 0,
                fireRate: 0,
                color: "#8B4513",
                strokeColor: "#5D2906"
            },
            {
                name: "Scrapper",
                description: "Kerää ja prosessoi romua automaattisesti",
                cost: 100,
                damage: 0,
                range: 0,
                fireRate: 0,
                color: "#FFD700",
                strokeColor: "#B8860B",
                isScrapper: true,
                scrapRate: 1,
                scrapInterval: 5000 // 5 seconds
            }
        ];
        this.selectedTowerType = 0;
        
        // Tower wireframe and selection
        this.hoverX = 0;
        this.hoverY = 0;
        this.selectedTowers = [];
        this.isDragging = false;
        this.dragStart = { x: 0, y: 0 };
        
        // Game objects
        this.towers = [];
        this.creeps = [];
        this.waveNumber = 0;
        this.creepsToSpawn = 0;
        this.spawnInterval = 1000; // ms
        this.lastSpawnTime = 0;
        this.waveActive = false; // Is wave active
        
        // Spawn and home indicators
        this.spawnPoint = {
            x: this.gameArea.x + this.gameArea.width / 2,
            y: this.gameArea.y + 40 * this.scaleFactor, // Siirretään kaksi celliä alaspäin
            radius: 20 * this.scaleFactor,
            color: "#FF9900"
        };
        
        // Home point in the center bottom of the screen
        this.homePoint = {
            x: this.gameArea.x + this.gameArea.width / 2,
            y: this.gameArea.y + this.gameArea.height - 60 * this.scaleFactor, // Siirretään ylemmäs
            radius: 20 * this.scaleFactor,
            color: "#66FF66"
        };
        
        // Home base setup
        this.baseIsPlaced = false; // Track if base has been placed
        this.base = null; // Will store the base tower object
        this.baseType = {
            name: "Home Base",
            width: 60 * this.scaleFactor,
            height: 40 * this.scaleFactor,
            color: "#66FF66",
            strokeColor: "#33CC33"
        };
        
        // UI Buttons (now in UI panel)
        this.nextWaveButton = {
            x: this.uiPanel.x + 10 * this.scaleFactor, // Pienennetty padding 20 -> 10
            y: this.uiPanel.y + this.uiPanel.height - 60 * this.scaleFactor,
            width: 85 * this.scaleFactor, // Kavennettu 120 -> 85
            height: 40 * this.scaleFactor,
            text: "NEXT WAVE"
        };
        
        this.scrapModeButton = {
            x: this.uiPanel.x + 105 * this.scaleFactor, // Päivitetty sijainti
            y: this.uiPanel.y + this.uiPanel.height - 60 * this.scaleFactor,
            width: 85 * this.scaleFactor, // Kavennettu 120 -> 85
            height: 40 * this.scaleFactor,
            text: "SCRAP",
            active: false
        };
        
        // Restart button (for game over)
        this.restartButton = {
            x: this.canvas.width / 2 - 60 * this.scaleFactor,
            y: this.canvas.height / 2 + 100 * this.scaleFactor,
            width: 120 * this.scaleFactor,
            height: 40 * this.scaleFactor,
            text: "TRY AGAIN"
        };
        
        // Tower upgrade buttons
        this.upgradeButtons = {
            damage: {
                x: this.uiPanel.x + 20 * this.scaleFactor,
                y: 500 * this.scaleFactor,
                width: 80 * this.scaleFactor,
                height: 30 * this.scaleFactor,
                text: "DMG +30%",
                cost: 50
            },
            fireRate: {
                x: this.uiPanel.x + 110 * this.scaleFactor,
                y: 500 * this.scaleFactor,
                width: 80 * this.scaleFactor,
                height: 30 * this.scaleFactor,
                text: "RATE +20%",
                cost: 50
            },
            range: {
                x: this.uiPanel.x + 200 * this.scaleFactor,
                y: 500 * this.scaleFactor,
                width: 80 * this.scaleFactor,
                height: 30 * this.scaleFactor,
                text: "RANGE +25%",
                cost: 50
            }
        };
        
        // Tower tooltip for upgrades
        this.towerTooltip = {
            width: 300 * this.scaleFactor,
            height: 180 * this.scaleFactor,
            padding: 10 * this.scaleFactor,
            visible: false,
            x: 0,
            y: 0,
            buttons: {
                damage: {
                    width: 80 * this.scaleFactor,
                    height: 30 * this.scaleFactor,
                    text: "DMG +30%",
                    cost: 50
                },
                fireRate: {
                    width: 80 * this.scaleFactor,
                    height: 30 * this.scaleFactor,
                    text: "RATE +20%",
                    cost: 50
                },
                range: {
                    width: 80 * this.scaleFactor,
                    height: 30 * this.scaleFactor,
                    text: "RANGE +25%",
                    cost: 50
                }
            }
        };
        
        // For floating text effects
        this.floatingTexts = [];
        
        // Damage flash effect
        this.damageFlash = {
            active: false,
            duration: 0,
            maxDuration: 60, // frames (1 sekunti 60fps)
            showHealthBar: false,
            healthBarAlpha: 1.0 // Lisätään alpha-arvo health barille
        };
    }

    setupEventListeners() {
        // Listen for clicks for tower placement and button presses
        this.canvas.addEventListener('click', (event) => {
            if (this.gameOver) {
                // Check for restart button
                const rect = this.canvas.getBoundingClientRect();
                const x = event.clientX - rect.left;
                const y = event.clientY - rect.top;
                
                if (this.isPointInRect(x, y, this.restartButton)) {
                    this.restartGame();
                }
                return;
            }
            
            // Get click position in Canvas
            const rect = this.canvas.getBoundingClientRect();
            const x = event.clientX - rect.left;
            const y = event.clientY - rect.top;
            
            // Check if click hit Next Wave button
            if (this.isPointInRect(x, y, this.nextWaveButton) && !this.waveActive) {
                this.startNextWave();
                return;
            }
            
            // Check if click hit Scrap Mode button
            if (this.isPointInRect(x, y, this.scrapModeButton)) {
                this.scrapMode = !this.scrapMode;
                this.scrapModeButton.active = this.scrapMode;
                this.selectedTower = null; // Deselect tower when entering scrap mode
                this.buyMode = false; // Exit buy mode when entering scrap mode
                return;
            }
            
            // Check upgrade buttons when tower is selected and it's not a wall
            if (this.selectedTower && !this.scrapMode && !this.selectedTower.isWall && !this.selectedTower.isScrapper) {
                // Check if click is on tooltip buttons
                if (this.isPointInRect(x, y, this.towerTooltip.buttons.damage)) {
                    this.upgradeTowerDamage();
                    return;
                }
                if (this.isPointInRect(x, y, this.towerTooltip.buttons.fireRate)) {
                    this.upgradeTowerFireRate();
                    return;
                }
                if (this.isPointInRect(x, y, this.towerTooltip.buttons.range)) {
                    this.upgradeTowerRange();
                    return;
                }
            }
            
            // Check if click hit tower selection buttons
            for (let i = 0; i < this.towerTypes.length; i++) {
                const buttonRect = {
                    x: this.uiPanel.x + 15 * this.scaleFactor,
                    y: this.uiPanel.y + 100 * this.scaleFactor + i * 90 * this.scaleFactor, // Muutettu 80 -> 90
                    width: this.uiPanel.width * this.scaleFactor - 30 * this.scaleFactor,
                    height: 80 * this.scaleFactor
                };
                
                if (this.isPointInRect(x, y, buttonRect)) {
                    this.selectedTowerType = i;
                    this.buyMode = true;
                    this.scrapMode = false;
                    this.scrapModeButton.active = false;
                    return;
                }
            }
            
            // Check if click is within game area
            if (x >= this.gameArea.x && x <= this.gameArea.x + this.gameArea.width &&
                y >= this.gameArea.y && y <= this.gameArea.y + this.gameArea.height) {
                
                // Convert pixels to grid coordinates
                const gridX = Math.floor((x - this.gameArea.x) / this.grid.cellSize);
                const gridY = Math.floor((y - this.gameArea.y) / this.grid.cellSize);
                
                if (this.scrapMode) {
                    // Try to scrap a tower
                    this.scrapTower(gridX, gridY);
                } else {
                    // Check if clicked on existing tower
                    const clickedTower = this.getTowerAt(gridX, gridY);
                    if (clickedTower) {
                        this.selectedTower = clickedTower;
                        this.buyMode = false; // Exit buy mode when selecting a tower
                        return;
                    }
                    
                    // Try to place a tower if in buy mode
                    if (this.buyMode) {
                        this.placeTower(gridX, gridY);
                        
                        // Check if tower was successfully placed
                        if (this.scraps < this.towerTypes[this.selectedTowerType].cost) {
                            this.buyMode = false; // Exit buy mode if no more scraps
                        }
                    }
                    this.selectedTower = null; // Deselect when placing new tower
                }
            } else {
                // If clicked outside game area, deselect tower
                this.selectedTower = null;
            }
        });

        // Mouse movement for wireframe and hover effects
        this.canvas.addEventListener('mousemove', (event) => {
            const rect = this.canvas.getBoundingClientRect();
            const mouseX = event.clientX - rect.left;
            const mouseY = event.clientY - rect.top;
            
            // Update hover coordinates only if in game area
            if (mouseX >= this.gameArea.x && mouseX <= this.gameArea.x + this.gameArea.width &&
                mouseY >= this.gameArea.y && mouseY <= this.gameArea.y + this.gameArea.height) {
                this.hoverX = Math.floor((mouseX - this.gameArea.x) / this.grid.cellSize);
                this.hoverY = Math.floor((mouseY - this.gameArea.y) / this.grid.cellSize);
                
                // Try to place tower if mouse is pressed and in buy mode
                if (event.buttons === 1 && this.buyMode && !this.scrapMode) {
                    this.isContinuousBuild = true;
                    const towerType = this.towerTypes[this.selectedTowerType];
                    if (this.scraps >= towerType.cost) {
                        this.placeTower(this.hoverX, this.hoverY);
                    }
                } else {
                    this.isContinuousBuild = false;
                }
            }
            
            // Check mouse over buttons and update cursor
            let isOverButton = false;
            
            // Check stats panel buttons
            const buttons = [
                this.nextWaveButton, 
                this.scrapModeButton
            ];
            
            if (this.gameOver) {
                buttons.push(this.restartButton);
            }
            
            // Check tower tooltip buttons
            if (this.selectedTower && !this.scrapMode && !this.selectedTower.isWall && !this.selectedTower.isScrapper) {
                buttons.push(this.towerTooltip.buttons.damage, this.towerTooltip.buttons.fireRate, this.towerTooltip.buttons.range);
            }
            
            for (const button of buttons) {
                if (this.isPointInRect(mouseX, mouseY, button)) {
                    document.body.style.cursor = 'pointer';
                    isOverButton = true;
                    break;
                }
            }
            
            // Check tower shop buttons
            if (!isOverButton) {
                for (let i = 0; i < this.towerTypes.length; i++) {
                    const buttonRect = {
                        x: this.uiPanel.x + 15 * this.scaleFactor,
                        y: this.uiPanel.y + 100 * this.scaleFactor + i * 90 * this.scaleFactor, // Muutettu 80 -> 90
                        width: this.uiPanel.width * this.scaleFactor - 30 * this.scaleFactor,
                        height: 80 * this.scaleFactor
                    };
                    
                    if (this.isPointInRect(mouseX, mouseY, buttonRect)) {
                        document.body.style.cursor = 'pointer';
                        isOverButton = true;
                        this.hoveredTowerType = i;
                        break;
                    }
                }
                
                // Reset hovered tower type if not over any tower button
                if (!isOverButton) {
                    this.hoveredTowerType = -1;
                }
            }
            
            // Reset cursor if not over any button
            if (!isOverButton && document.body.style.cursor === 'pointer') {
                document.body.style.cursor = 'default';
            }
            
            // Update dragging for bulk tower selection
            if (this.scrapMode && this.isDragging) {
                this.updateDragSelection(mouseX, mouseY);
            }
        });
        
        // Mouse down for drag selection
        this.canvas.addEventListener('mousedown', (event) => {
            if (this.gameOver || !this.scrapMode) return;
            
            const rect = this.canvas.getBoundingClientRect();
            const x = event.clientX - rect.left;
            const y = event.clientY - rect.top;
            
            // Start dragging if in game area
            if (x >= this.gameArea.x && x <= this.gameArea.x + this.gameArea.width &&
                y >= this.gameArea.y && y <= this.gameArea.y + this.gameArea.height) {
                this.isDragging = true;
                this.dragStart = { x, y };
                this.selectedTowers = [];
            }
        });
        
        // Mouse up to end drag selection
        this.canvas.addEventListener('mouseup', (event) => {
            if (this.isDragging) {
                this.isDragging = false;
                
                // Scrap all selected towers if in scrap mode
                if (this.scrapMode && this.selectedTowers.length > 0) {
                    for (const tower of this.selectedTowers) {
                        this.scrapTowerObject(tower);
                    }
                    this.selectedTowers = [];
                }
            }
            
            // Reset continuous build mode
            this.isContinuousBuild = false;
        });

        // Right-click to exit buy mode
        this.canvas.addEventListener('contextmenu', (event) => {
            // Prevent default context menu
            event.preventDefault();
            
            // Exit buy mode
            this.buyMode = false;
            return false;
        });

        // Debug mode toggle (d key) and Esc to exit buy mode
        window.addEventListener('keydown', (event) => {
            if (event.key === 'd') {
                this.debugMode = !this.debugMode;
            }
            
            // Exit buy mode on Escape key
            if (event.key === 'Escape') {
                this.buyMode = false;
            }
        });
    }

    restartGame() {
        // Reset game state
        this.gameOver = false;
        this.playerLives = 10;
        this.scraps = 500; // 500 scraps
        this.towers = [];
        this.creeps = [];
        this.waveNumber = 0;
        this.creepsToSpawn = 0;
        this.waveActive = false;
        this.scrapMode = false;
        this.selectedTower = null;
        this.selectedTowerType = 0;
        
        // Reset grid
        const cellSize = 20 * this.scaleFactor;
        const cols = Math.floor(this.gameArea.width / cellSize);
        const rows = Math.floor(this.gameArea.height / cellSize);

        // Generoi uusi kartta
        this.mapData = this.mapGenerator.generateMap();
        
        // Päivitä grid käyttämään uutta karttaa
        this.grid = new Grid(cols, rows, cellSize, this.gameArea.x, this.mapData);
        this.grid.game = this;
        this.pathfinding = new Pathfinding(this.grid);
    }

    getTowerAt(gridX, gridY) {
        for (const tower of this.towers) {
            if (tower.isWall) {
                // Wall is just 1x1
                if (tower.gridX === gridX && tower.gridY === gridY) {
                return tower;
                }
            } else {
                // Regular tower is 2x2
                if (gridX >= tower.gridX && gridX < tower.gridX + 2 && 
                    gridY >= tower.gridY && gridY < tower.gridY + 2) {
                    return tower;
                }
            }
        }
        return null;
    }

    upgradeTowerDamage() {
        if (!this.selectedTower) return;
        
        const upgradeCost = this.upgradeButtons.damage.cost;
        
        if (this.scraps >= upgradeCost) {
            this.scraps -= upgradeCost;
            // Increase damage by 30%
            this.selectedTower.damage = Math.floor(this.selectedTower.damage * 1.3);
            // Increase future upgrade cost
            this.upgradeButtons.damage.cost = Math.floor(upgradeCost * 1.5);
        }
    }

    upgradeTowerFireRate() {
        if (!this.selectedTower) return;
        
        const upgradeCost = this.upgradeButtons.fireRate.cost;
        
        if (this.scraps >= upgradeCost) {
            this.scraps -= upgradeCost;
            // Increase fire rate by 20%
            this.selectedTower.fireRate *= 1.2;
            // Increase future upgrade cost
            this.upgradeButtons.fireRate.cost = Math.floor(upgradeCost * 1.5);
        }
    }

    upgradeTowerRange() {
        if (!this.selectedTower) return;
        
        const upgradeCost = this.upgradeButtons.range.cost;
        
        if (this.scraps >= upgradeCost) {
            this.scraps -= upgradeCost;
            // Increase range by 25%
            this.selectedTower.range = Math.floor(this.selectedTower.range * 1.25);
            // Increase future upgrade cost
            this.upgradeButtons.range.cost = Math.floor(upgradeCost * 1.5);
        }
    }

    isPointInRect(x, y, rect) {
        return x >= rect.x && x <= rect.x + rect.width &&
               y >= rect.y && y <= rect.y + rect.height;
    }
    
    getTowerButtonRect(index) {
        return {
            x: this.uiPanel.x + 20 * this.scaleFactor,
            y: 120 * this.scaleFactor + 50 * this.scaleFactor + index * 100 * this.scaleFactor, // Match with drawUI values
            width: this.uiPanel.width * this.scaleFactor - 40 * this.scaleFactor,
            height: 80 * this.scaleFactor
        };
    }
    
    updateDragSelection(currentX, currentY) {
        // Create selection rectangle
        const selectionRect = {
            x: Math.min(this.dragStart.x, currentX),
            y: Math.min(this.dragStart.y, currentY),
            width: Math.abs(currentX - this.dragStart.x),
            height: Math.abs(currentY - this.dragStart.y)
        };
        
        // Clear previous selection
        this.selectedTowers = [];
        
        // Check which towers are in the selection rectangle
        for (const tower of this.towers) {
            const towerCenterX = tower.x + tower.width / 2 + this.gameArea.x;
            const towerCenterY = tower.y + tower.height / 2;
            
            if (this.isPointInRect(towerCenterX, towerCenterY, selectionRect)) {
                this.selectedTowers.push(tower);
            }
        }
    }

    placeTower(gridX, gridY) {
        const towerType = this.towerTypes[this.selectedTowerType];
        
        // Check if player has enough scraps
        if (this.scraps < towerType.cost) {
            // Only show "not enough scraps" message if not in continuous build mode
            if (!this.isContinuousBuild) {
                this.addFloatingText(this.canvas.width / 2, this.canvas.height / 2, "Not enough scraps!", "#FF0000", true);
            }
            return false;
        }

        // Wall just takes one cell, regular tower takes 2x2
        let canPlace = true;
        
        if (towerType.name === "Wall") {
            // Check if the single cell is occupied or is an obstacle
            if (this.grid.isCellOccupied(gridX, gridY)) {
                canPlace = false;
            }

            // Don't place walls too close to spawn/home
            if (this.isPointNearSpawnOrHome(gridX, gridY)) {
                canPlace = false;
            }
        } else {
            // Regular tower takes 2x2 cells
            // Check if any of the 2x2 cells are occupied or are obstacles
            for (let y = gridY; y < gridY + 2; y++) {
                for (let x = gridX; x < gridX + 2; x++) {
                    if (x >= this.grid.cols || y >= this.grid.rows || this.grid.isCellOccupied(x, y)) {
                        canPlace = false;
                        break;
                    }
                }
            }
            
            // Don't place towers too close to spawn/home
            if (this.isPointNearSpawnOrHome(gridX, gridY) || 
                this.isPointNearSpawnOrHome(gridX + 1, gridY) ||
                this.isPointNearSpawnOrHome(gridX, gridY + 1) ||
                this.isPointNearSpawnOrHome(gridX + 1, gridY + 1)) {
                canPlace = false;
            }
        }

        if (!canPlace) {
            // Only show "cannot place here" message if not in continuous build mode
            if (!this.isContinuousBuild) {
                this.addFloatingText(this.canvas.width / 2, this.canvas.height / 2, "Cannot place here!", "#FF0000");
            }
            return false;
        }

        // Create the tower
        let tower;
        if (towerType.name === "Wall") {
            tower = new Wall(this, gridX, gridY, towerType);
            // Mark 1x1 cell as occupied
            this.grid.markCellOccupied(gridX, gridY);
        } else {
            tower = new Tower(this, gridX, gridY, towerType);
            // Mark all 2x2 cells as occupied
            for (let y = gridY; y < gridY + 2; y++) {
                for (let x = gridX; x < gridX + 2; x++) {
                    this.grid.markCellOccupied(x, y);
                }
            }
        }

        // Add tower and deduct cost
        this.towers.push(tower);
        this.scraps -= towerType.cost;
        
        // Show floating text for cost
        this.addFloatingText(
            tower.x + tower.width / 2 + this.gameArea.x,
            tower.y + tower.height / 2,
            `-${towerType.cost}`,
            "#FF0000"
        );
        
        return true;
    }
    
    // Check if the point is too close to spawn or home
    isPointNearSpawnOrHome(gridX, gridY) {
        const cellSize = this.grid.cellSize;
        const x = gridX * cellSize + this.gameArea.x + cellSize / 2;
        const y = gridY * cellSize + this.gameArea.y + cellSize / 2;
        
        // Calculate distance to spawn point
        const spawnDist = Math.sqrt(
            Math.pow(x - this.spawnPoint.x, 2) + 
            Math.pow(y - this.spawnPoint.y, 2)
        );
        
        // Calculate distance to home point
        const homeDist = Math.sqrt(
            Math.pow(x - this.homePoint.x, 2) + 
            Math.pow(y - this.homePoint.y, 2)
        );
        
        // Prevent placement if too close
        const safeDistance = 30 * this.scaleFactor;
        return spawnDist < this.spawnPoint.radius + safeDistance || 
               homeDist < this.homePoint.radius + safeDistance;
    }
    
    scrapTower(gridX, gridY) {
        // Find tower at selected location
        let towerToScrap = null;
        
        for (let i = 0; i < this.towers.length; i++) {
            const tower = this.towers[i];
            
            if (tower.isWall) {
                // Wall is just 1x1
                if (tower.gridX === gridX && tower.gridY === gridY) {
                    towerToScrap = tower;
                    break;
                }
            } else {
                // Check all cells of tower (2x2)
                if (gridX >= tower.gridX && gridX < tower.gridX + 2 &&
                    gridY >= tower.gridY && gridY < tower.gridY + 2) {
                    towerToScrap = tower;
                break;
            }
        }
    }
    
        if (towerToScrap) {
            this.scrapTowerObject(towerToScrap);
            return true;
        }
        
        return false;
    }
    
    scrapTowerObject(tower) {
        // Give player scraps back (half of cost)
        const refund = Math.floor(tower.cost / 2);
        this.scraps += refund;
        
        // Show floating text with refund amount
        const x = tower.x + tower.width / 2 + this.gameArea.x;
        const y = tower.y + tower.height / 2;
        this.addFloatingText(x, y, `+${refund}`, "#FFFF00");
        
        // Free up occupied cells
        if (tower.isWall) {
            // Wall is 1x1
            this.grid.markCellUnoccupied(tower.gridX, tower.gridY);
        } else {
            // Regular tower is 2x2
            for (let y = tower.gridY; y < tower.gridY + 2; y++) {
                for (let x = tower.gridX; x < tower.gridX + 2; x++) {
                    this.grid.markCellUnoccupied(x, y);
                }
            }
        }
        
        // Remove tower from game
        const index = this.towers.indexOf(tower);
        if (index !== -1) {
            this.towers.splice(index, 1);
        }
            
        // If this was the selected tower, clear selection
            if (this.selectedTower === tower) {
                this.selectedTower = null;
        }
    }
    
    destroyTower(tower) {
        // Remove tower without refund
        const index = this.towers.indexOf(tower);
        if (index !== -1) {
            // Remove tower from grid
            for (let y = tower.gridY; y <= tower.gridY + 1; y++) {
                for (let x = tower.gridX; x <= tower.gridX + 1; x++) {
                    if (x >= 0 && x < this.grid.cols && y >= 0 && y < this.grid.rows) {
                        this.grid.cells[y][x].occupied = false;
                        this.grid.cells[y][x].tower = null;
                    }
                }
            }
            
            // Remove from array
            this.towers.splice(index, 1);
            
            // If tower was selected, deselect it
            if (this.selectedTower === tower) {
                this.selectedTower = null;
            }
            
            // Recalculate paths for creeps
            for (const creep of this.creeps) {
                if (creep.isAlive) {
                    creep.findPath();
                }
            }
        }
    }

    startGame() {
        this.gameLoop(0);
        // Don't start wave automatically, player starts with button
    }

    startNextWave() {
        this.waveNumber++;
        // Track highest wave reached
        if (this.waveNumber > this.waveReached) {
            this.waveReached = this.waveNumber;
        }
        
        // Set creepsToSpawn based on wave type
        if (this.waveNumber % 5 === 0) {
            // Mini-boss wave
            this.creepsToSpawn = 5;
        } else if (this.waveNumber % 10 === 0) {
            // Boss wave
            this.creepsToSpawn = 5;
        } else {
            // Normal wave
            this.creepsToSpawn = 5 + this.waveNumber * 2;
        }
        
        this.lastSpawnTime = 0;
        this.waveActive = true;
    }

    spawnCreep() {
        if (this.creepsToSpawn <= 0) return;
        
        // Spawn creep at spawn point
        const x = this.spawnPoint.x;
        const y = this.spawnPoint.y;
        
        // Calculate health based on wave number (more growth in later waves)
        const baseHealth = 80;
        const healthMultiplier = Math.pow(1.2, this.waveNumber);
        let health = Math.floor(baseHealth * healthMultiplier);
        let speed = 0.5;
        let radius = 8 * this.scaleFactor;
        let color = '#FF5500';
        
        // Check if this is a boss or mini-boss wave
        let isBoss = false;
        let isMiniBoss = false;
        
        if (this.waveNumber % 5 === 0) {
            // Mini-boss every 5th wave
            isMiniBoss = true;
            health *= 2;  // 2x health
            speed *= 0.7; // Slightly faster
            radius = 14 * this.scaleFactor;
            color = '#FF8800';
        } else if (this.waveNumber % 10 === 0) {
            // Boss every 10th wave
            isBoss = true;
            health *= 3;  // 3x health
            speed *= 0.5; // Slower
            radius = 16 * this.scaleFactor;
            color = '#FF0000';
        }
        
        // Create new creep with appropriate parameters
        const creep = new Creep(this, x, y, health, speed, color, radius, isBoss || isMiniBoss);
        this.creeps.push(creep);
        
        this.creepsToSpawn--;
    }

    update(currentTime) {
        // Update game objects
        for (const tower of this.towers) {
            tower.update(currentTime);
            
            // Handle scrapper passive income only during active waves
            if (tower.isScrapper && this.waveActive && currentTime - tower.lastScrapTime >= tower.scrapInterval) {
                this.scraps += tower.scrapRate;
                tower.lastScrapTime = currentTime;
                // Show floating text for scrap income
                this.addFloatingText(
                    tower.x + tower.width / 2 + this.gameArea.x,
                    tower.y + tower.height / 2,
                    `+${tower.scrapRate}`,
                    "#FFD700"
                );
            }
        }
        
        for (let i = this.creeps.length - 1; i >= 0; i--) {
            const creep = this.creeps[i];
            creep.update();
            
            // Remove dead creeps
            if (!creep.isAlive) {
                if (creep.reachedEnd) {
                    // Creep reached the end
                    this.playerLives--;
                    // Trigger damage flash and show health bar
                    this.damageFlash.active = true;
                    this.damageFlash.duration = this.damageFlash.maxDuration;
                    this.damageFlash.showHealthBar = true;
                } else if (creep.attackingTower) {
                    // Creep was attacking tower but died
                    // Tower damage already handled in creep.update()
                } else {
                    // Creep was killed - give scraps
                    // Improved economy - more scraps for later waves
                    const reward = 15 + Math.floor(this.waveNumber * 1.5);
                    this.scraps += reward;
                    // Show floating text for scrap reward
                    this.addFloatingText(
                        creep.x,
                        creep.y,
                        `+${reward}`,
                        "#FFD700"
                    );
                }
                this.creeps.splice(i, 1);
            }
        }
        
        // Check if wave is complete
        if (this.waveActive && this.creepsToSpawn <= 0 && this.creeps.length === 0) {
            this.waveActive = false;
            // Bonus scraps at end of wave
            const waveBonus = 20 + this.waveNumber * 10;
            this.scraps += waveBonus;
        }
        
        // Check game over
        if (this.playerLives <= 0) {
            this.gameOver = true;
        }
        
        // Spawn new creeps periodically if wave is active
        if (this.waveActive && currentTime - this.lastSpawnTime >= this.spawnInterval && this.creepsToSpawn > 0) {
            this.spawnCreep();
            this.lastSpawnTime = currentTime;
        }
        
        // Update damage flash effect
        if (this.damageFlash.active) {
            this.damageFlash.duration--;
            
            // Laske health barin alpha-arvo
            if (this.damageFlash.duration > 30) { // 0.5 sekuntia täysin näkyvä
                this.damageFlash.healthBarAlpha = 1.0;
            } else {
                // Fade out viimeisen 0.5 sekunnin aikana
                this.damageFlash.healthBarAlpha = this.damageFlash.duration / 30;
            }
            
            if (this.damageFlash.duration <= 0) {
                this.damageFlash.active = false;
                this.damageFlash.showHealthBar = false;
                this.damageFlash.healthBarAlpha = 1.0;
            }
        }
        
        // Update floating texts
        for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
            const text = this.floatingTexts[i];
            text.y -= 1; // Move upward
            text.life -= 1; // Decrease life
            text.alpha = text.life / 60; // Fade out
            
            // Draw scrap icon if needed
            if (text.showScrapIcon && this.assets.isReady()) {
                const scrapImg = this.assets.getImage('scrap');
                const scrapSize = 15 * this.scaleFactor;
                this.ctx.globalAlpha = text.alpha;
                this.drawImageMaintainAspectRatio(
                    scrapImg,
                    text.x - 20 * this.scaleFactor,
                    text.y - scrapSize/2,
                    scrapSize,
                    scrapSize
                );
                this.ctx.globalAlpha = 1.0;
            }
            
            this.ctx.fillStyle = `rgba(${this.hexToRgb(text.color)}, ${text.alpha})`;
            this.ctx.font = 'bold 16px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText(text.text, text.x, text.y);
            
            // Remove dead texts
            if (text.life <= 0) {
                this.floatingTexts.splice(i, 1);
            }
        }
    }

    draw() {
        // Jos kuvat latautuvat vielä, näytä latausruutu
        if (!this.assets.isReady()) {
            this.drawLoadingScreen();
            return;
        }
        
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw stats panel background
        this.ctx.fillStyle = '#222';
        this.ctx.fillRect(this.statsPanel.x, this.statsPanel.y, this.statsPanel.width, this.statsPanel.height);
        
        // Draw game background
        this.ctx.fillStyle = '#111';
        this.ctx.fillRect(this.gameArea.x, this.gameArea.y, this.gameArea.width, this.gameArea.height);
        
        // Draw UI panel background
        this.ctx.fillStyle = '#222';
        this.ctx.fillRect(this.uiPanel.x, this.uiPanel.y, this.uiPanel.width, this.uiPanel.height);
        
        // Draw stats
        this.drawStats();
        
        // Draw grid (includes ground and nonground tiles)
        this.grid.draw(this.ctx);
        
        // Draw spawn point with image
        if (this.assets.isReady()) {
            const spawnImg = this.assets.getImage('spawn');
            const spawnSize = this.spawnPoint.radius * 2;
            this.drawImageMaintainAspectRatio(
                spawnImg,
                this.spawnPoint.x - spawnSize / 2,
                this.spawnPoint.y - spawnSize / 2,
                spawnSize,
                spawnSize,
                true,
                true
            );
        } else {
            // Fallback to circle if image not loaded
        this.ctx.fillStyle = this.spawnPoint.color;
        this.ctx.beginPath();
        this.ctx.arc(this.spawnPoint.x, this.spawnPoint.y, this.spawnPoint.radius, 0, Math.PI * 2);
        this.ctx.fill();
        }
        
        // Draw home point with image and health bar
        if (this.assets.isReady()) {
            const baseImg = this.assets.getImage('base');
            const baseSize = this.homePoint.radius * 2;
            this.ctx.drawImage(
                baseImg,
                this.homePoint.x - baseSize / 2,
                this.homePoint.y - baseSize / 2,
                baseSize,
                baseSize
            );
        } else {
            // Fallback to circle if image not loaded
        this.ctx.fillStyle = this.homePoint.color;
        this.ctx.beginPath();
        this.ctx.arc(this.homePoint.x, this.homePoint.y, this.homePoint.radius, 0, Math.PI * 2);
        this.ctx.fill();
        }

        // Draw health bar over base only when damage flash is active
        if (this.damageFlash.showHealthBar) {
            const healthBarWidth = 60 * this.scaleFactor;
            const healthBarHeight = 8 * this.scaleFactor;
            const healthBarX = this.homePoint.x - healthBarWidth / 2;
            const healthBarY = this.homePoint.y - this.homePoint.radius - 15 * this.scaleFactor;
            
            // Health bar background with alpha
            this.ctx.fillStyle = `rgba(51, 51, 51, ${this.damageFlash.healthBarAlpha})`;
            this.ctx.fillRect(healthBarX, healthBarY, healthBarWidth, healthBarHeight);
            
            // Health bar fill with alpha
            const healthPercentage = this.playerLives / 10;
            const color = healthPercentage > 0.5 ? '#4CAF50' : healthPercentage > 0.25 ? '#FFA500' : '#FF0000';
            const rgb = this.hexToRgb(color);
            this.ctx.fillStyle = `rgba(${rgb}, ${this.damageFlash.healthBarAlpha})`;
            this.ctx.fillRect(healthBarX, healthBarY, healthBarWidth * healthPercentage, healthBarHeight);
        }
        
        // Apply clip to prevent tower range circles from appearing over UI
        this.ctx.save();
        this.ctx.beginPath();
        this.ctx.rect(this.gameArea.x, this.gameArea.y, this.gameArea.width, this.gameArea.height);
        this.ctx.clip();

        // Draw tower wireframe at hover position only if in buy mode and has enough scraps
        const towerType = this.towerTypes[this.selectedTowerType];
        if (!this.gameOver && !this.scrapMode && this.buyMode && this.scraps >= towerType.cost) {
            // Get grid position
            const x = this.hoverX * this.grid.cellSize + this.gameArea.x;
            const y = this.hoverY * this.grid.cellSize + this.gameArea.y;
            
            // Different wireframe for wall vs tower
            let canPlace;
            
            if (towerType.name === "Wall") {
                // Wall only takes one cell
                canPlace = !this.grid.isCellOccupied(this.hoverX, this.hoverY) && 
                            !this.isPointNearSpawnOrHome(this.hoverX, this.hoverY);
            
                // Draw 1x1 wireframe for wall
            this.ctx.fillStyle = canPlace ? 'rgba(0, 255, 0, 0.3)' : 'rgba(255, 0, 0, 0.3)';
                this.ctx.fillRect(x, y, this.grid.cellSize, this.grid.cellSize);
                
            } else {
                // Regular tower takes 2x2 cells
                canPlace = this.grid.canPlaceTower(this.hoverX, this.hoverY) && 
                          !this.isPointNearSpawnOrHome(this.hoverX, this.hoverY);
                          
                // Draw 2x2 wireframe for tower
                this.ctx.fillStyle = canPlace ? 'rgba(0, 255, 0, 0.3)' : 'rgba(255, 0, 0, 0.3)';
                this.ctx.fillRect(x, y, this.grid.cellSize * 2, this.grid.cellSize * 2);
            
            // Show range circle when placing towers if debug mode is on or showRangeWhenPlacing is true
            if ((this.debugMode || this.showRangeWhenPlacing) && canPlace) {
                this.ctx.beginPath();
                this.ctx.arc(
                        x + this.grid.cellSize, // center of 2x2 grid
                        y + this.grid.cellSize,
                    towerType.range,
                    0,
                    Math.PI * 2
                );
                this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
                this.ctx.stroke();
                }
            }
        }
        
        // Draw towers
        for (const tower of this.towers) {
            if (tower.isWall) {
                // Seinät piirretään normaalisti
            tower.draw(this.ctx);
            } else if (tower.isScrapper) {
                // Scrapperit piirretään normaalisti
                tower.draw(this.ctx);
            } else {
                // Tornit piirretään säilyttäen kuvasuhde
                const x = tower.x + this.gameArea.x;
                const y = tower.y;
                
                if (this.assets.isReady()) {
                    const img = this.assets.getImage('tower');
                    const aspectRatio = img.width / img.height;
                    const targetHeight = tower.height;
                    const targetWidth = targetHeight * aspectRatio;
                    const centerX = x + (tower.width - targetWidth) / 2; // Keskitetään horisontaalisesti
                    
                    this.ctx.drawImage(img, centerX, y, targetWidth, targetHeight);
                } else {
                    // Fallback jos kuva ei ole latautunut
                    this.ctx.fillStyle = tower.color;
                    this.ctx.fillRect(x, y, tower.width, tower.height);
                }

                // Piirrä tornin projectilet
                if (tower.projectiles) {
                    for (const projectile of tower.projectiles) {
                        this.ctx.fillStyle = '#FFF';
                        this.ctx.beginPath();
                        this.ctx.arc(
                            projectile.x + this.gameArea.x,
                            projectile.y,
                            3 * this.scaleFactor,
                            0,
                            Math.PI * 2
                        );
                        this.ctx.fill();
                    }
                }
            }
        }
        
        // Highlight selected tower and show its range
        if (this.selectedTower) {
            const x = this.selectedTower.x + this.gameArea.x;
            const y = this.selectedTower.y;
            
            // Draw range circle
            this.ctx.beginPath();
            this.ctx.arc(
                x + this.selectedTower.width / 2,
                y + this.selectedTower.height / 2,
                this.selectedTower.range,
                0,
                Math.PI * 2
            );
            this.ctx.strokeStyle = 'rgba(255, 255, 100, 0.4)';
            this.ctx.lineWidth = 2;
            this.ctx.stroke();
            
            // Draw selected highlight
            this.ctx.strokeStyle = "#FFFF00";
            this.ctx.lineWidth = 3;
            this.ctx.strokeRect(x, y, this.selectedTower.width, this.selectedTower.height);
        
            // Draw tower upgrade info if a tower is selected and it's not a wall or scrapper
            if (!this.scrapMode && !this.selectedTower.isWall && !this.selectedTower.isScrapper) {
            this.drawTowerUpgradeInfo();
            }
        }
        
        // Draw creeps
        for (const creep of this.creeps) {
            creep.draw(this.ctx);
        }
        
        // Draw selection rectangle when dragging in scrap mode
        if (this.isDragging && this.scrapMode) {
            const rect = {
                x: Math.min(this.dragStart.x, this.hoverX * this.grid.cellSize + this.gameArea.x),
                y: Math.min(this.dragStart.y, this.hoverY * this.grid.cellSize + this.gameArea.y),
                width: Math.abs(this.hoverX * this.grid.cellSize + this.gameArea.x - this.dragStart.x),
                height: Math.abs(this.hoverY * this.grid.cellSize + this.gameArea.y - this.dragStart.y)
            };
            
            this.ctx.strokeStyle = '#FF0000';
            this.ctx.lineWidth = 2;
            this.ctx.setLineDash([5, 5]);
            this.ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
            this.ctx.setLineDash([]);
        }
        
        // Draw selected towers highlight
        if (this.scrapMode) {
            for (const tower of this.selectedTowers) {
                this.ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
                this.ctx.fillRect(
                    tower.x + this.gameArea.x, 
                    tower.y, 
                    tower.width, 
                    tower.height
                );
            }
        }
        
        // Draw floating texts
        for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
            const text = this.floatingTexts[i];
            text.y -= 1; // Move upward
            text.life -= 1; // Decrease life
            text.alpha = text.life / 60; // Fade out
            
            // Draw scrap icon if needed
            if (text.showScrapIcon && this.assets.isReady()) {
                const scrapImg = this.assets.getImage('scrap');
                const scrapSize = 15 * this.scaleFactor;
                this.ctx.globalAlpha = text.alpha;
                this.drawImageMaintainAspectRatio(
                    scrapImg,
                    text.x - 20 * this.scaleFactor,
                    text.y - scrapSize/2,
                    scrapSize,
                    scrapSize
                );
                this.ctx.globalAlpha = 1.0;
            }
            
            this.ctx.fillStyle = `rgba(${this.hexToRgb(text.color)}, ${text.alpha})`;
            this.ctx.font = 'bold 16px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText(text.text, text.x, text.y);
            
            // Remove dead texts
            if (text.life <= 0) {
                this.floatingTexts.splice(i, 1);
            }
        }
        
        // Restore clip to draw UI outside game area
        this.ctx.restore();
        
        // Draw damage flash effect
        if (this.damageFlash.active) {
            const alpha = this.damageFlash.duration / this.damageFlash.maxDuration * 0.5; // max 50% opacity
            this.ctx.fillStyle = `rgba(255, 0, 0, ${alpha})`;
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        }
        
        // Draw UI panel background
        this.ctx.fillStyle = '#222';
        this.ctx.fillRect(this.uiPanel.x, this.uiPanel.y, this.uiPanel.width, this.uiPanel.height);
        
        // Draw UI elements
        this.drawUI();
        
        // Draw game over message
        if (this.gameOver) {
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            
            this.ctx.fillStyle = '#FF0000';
            this.ctx.font = '36px "Courier New", monospace';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('GAME OVER', this.canvas.width / 2, this.canvas.height / 2);
            
            this.ctx.fillStyle = '#FFFFFF';
            this.ctx.font = '18px "Courier New", monospace';
            this.ctx.fillText(`You reached wave: ${this.waveReached}`, this.canvas.width / 2, this.canvas.height / 2 + 40);
            
            // Draw restart button
            this.ctx.fillStyle = '#4CAF50';
            this.ctx.fillRect(
                this.restartButton.x,
                this.restartButton.y,
                this.restartButton.width,
                this.restartButton.height
            );
            
            this.ctx.fillStyle = '#FFFFFF';
            this.ctx.font = '16px "Courier New", monospace';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(
                this.restartButton.text,
                this.restartButton.x + this.restartButton.width / 2,
                this.restartButton.y + this.restartButton.height / 2
            );
        }
    }

    drawTowerUpgradeInfo() {
        if (!this.selectedTower || this.scrapMode || this.selectedTower.isWall || this.selectedTower.isScrapper) {
            return;
        }
        
        // Calculate tooltip position (centered above the tower)
        const towerCenterX = this.selectedTower.x + this.selectedTower.width / 2 + this.gameArea.x;
        const towerCenterY = this.selectedTower.y;
        
        // Position tooltip above the tower
        this.towerTooltip.x = towerCenterX - this.towerTooltip.width / 2;
        this.towerTooltip.y = towerCenterY - this.towerTooltip.height - 20 * this.scaleFactor;
        
        // Draw tooltip background
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        this.ctx.fillRect(
            this.towerTooltip.x,
            this.towerTooltip.y,
            this.towerTooltip.width,
            this.towerTooltip.height
        );
        
        // Draw tooltip border
        this.ctx.strokeStyle = '#666';
        this.ctx.lineWidth = 1 * this.scaleFactor;
        this.ctx.strokeRect(
            this.towerTooltip.x,
            this.towerTooltip.y,
            this.towerTooltip.width,
            this.towerTooltip.height
        );
        
        // Draw tower info
        this.ctx.fillStyle = '#EEEEEE';
        this.ctx.font = '16px "Courier New", monospace';
        this.ctx.textAlign = 'left';
        this.ctx.fillText(
            `Damage: ${this.selectedTower.damage}`,
            this.towerTooltip.x + this.towerTooltip.padding,
            this.towerTooltip.y + 30 * this.scaleFactor
        );
        this.ctx.fillText(
            `Rate: ${this.selectedTower.fireRate.toFixed(2)}`,
            this.towerTooltip.x + this.towerTooltip.padding,
            this.towerTooltip.y + 50 * this.scaleFactor
        );
        
        // Position buttons
        const buttonY = this.towerTooltip.y + 70 * this.scaleFactor;
        const buttonSpacing = 10 * this.scaleFactor;
        const totalButtonWidth = this.towerTooltip.buttons.damage.width + 
                                this.towerTooltip.buttons.fireRate.width + 
                                this.towerTooltip.buttons.range.width + 
                                buttonSpacing * 2;
        const startX = this.towerTooltip.x + (this.towerTooltip.width - totalButtonWidth) / 2;
        
        // Draw damage upgrade button
        this.towerTooltip.buttons.damage.x = startX;
        this.towerTooltip.buttons.damage.y = buttonY;
        this.ctx.fillStyle = this.scraps >= this.upgradeButtons.damage.cost ? '#4CAF50' : '#666666';
        this.ctx.fillRect(
            this.towerTooltip.buttons.damage.x,
            this.towerTooltip.buttons.damage.y,
            this.towerTooltip.buttons.damage.width,
            this.towerTooltip.buttons.damage.height
        );
        
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.font = '12px "Courier New", monospace';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(
            this.upgradeButtons.damage.text,
            this.towerTooltip.buttons.damage.x + this.towerTooltip.buttons.damage.width / 2,
            this.towerTooltip.buttons.damage.y + this.towerTooltip.buttons.damage.height / 2
        );
        
        // Draw cost with scrap icon
        if (this.assets.isReady()) {
            const scrapImg = this.assets.getImage('scrap');
            const scrapSize = 15 * this.scaleFactor;
            this.drawImageMaintainAspectRatio(
                scrapImg,
                this.towerTooltip.buttons.damage.x + this.towerTooltip.buttons.damage.width/2 - 30 * this.scaleFactor,
                this.towerTooltip.buttons.damage.y + this.towerTooltip.buttons.damage.height + 15 * this.scaleFactor,
                scrapSize,
                scrapSize
            );
        }
        this.ctx.fillText(
            `${this.upgradeButtons.damage.cost}`,
            this.towerTooltip.buttons.damage.x + this.towerTooltip.buttons.damage.width/2,
            this.towerTooltip.buttons.damage.y + this.towerTooltip.buttons.damage.height + 25 * this.scaleFactor
        );
        
        // Draw fire rate upgrade button
        this.towerTooltip.buttons.fireRate.x = startX + this.towerTooltip.buttons.damage.width + buttonSpacing;
        this.towerTooltip.buttons.fireRate.y = buttonY;
        this.ctx.fillStyle = this.scraps >= this.upgradeButtons.fireRate.cost ? '#4CAF50' : '#666666';
        this.ctx.fillRect(
            this.towerTooltip.buttons.fireRate.x,
            this.towerTooltip.buttons.fireRate.y,
            this.towerTooltip.buttons.fireRate.width,
            this.towerTooltip.buttons.fireRate.height
        );
        
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(
            this.upgradeButtons.fireRate.text,
            this.towerTooltip.buttons.fireRate.x + this.towerTooltip.buttons.fireRate.width / 2,
            this.towerTooltip.buttons.fireRate.y + this.towerTooltip.buttons.fireRate.height / 2
        );
        
        // Draw cost with scrap icon
        if (this.assets.isReady()) {
            const scrapImg = this.assets.getImage('scrap');
            const scrapSize = 15 * this.scaleFactor;
            this.drawImageMaintainAspectRatio(
                scrapImg,
                this.towerTooltip.buttons.fireRate.x + this.towerTooltip.buttons.fireRate.width/2 - 30 * this.scaleFactor,
                this.towerTooltip.buttons.fireRate.y + this.towerTooltip.buttons.fireRate.height + 15 * this.scaleFactor,
                scrapSize,
                scrapSize
            );
        }
        this.ctx.fillText(
            `${this.upgradeButtons.fireRate.cost}`,
            this.towerTooltip.buttons.fireRate.x + this.towerTooltip.buttons.fireRate.width/2,
            this.towerTooltip.buttons.fireRate.y + this.towerTooltip.buttons.fireRate.height + 25 * this.scaleFactor
        );
        
        // Draw range upgrade button
        this.towerTooltip.buttons.range.x = startX + this.towerTooltip.buttons.damage.width + this.towerTooltip.buttons.fireRate.width + buttonSpacing * 2;
        this.towerTooltip.buttons.range.y = buttonY;
        this.ctx.fillStyle = this.scraps >= this.upgradeButtons.range.cost ? '#4CAF50' : '#666666';
        this.ctx.fillRect(
            this.towerTooltip.buttons.range.x,
            this.towerTooltip.buttons.range.y,
            this.towerTooltip.buttons.range.width,
            this.towerTooltip.buttons.range.height
        );
        
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(
            this.upgradeButtons.range.text,
            this.towerTooltip.buttons.range.x + this.towerTooltip.buttons.range.width / 2,
            this.towerTooltip.buttons.range.y + this.towerTooltip.buttons.range.height / 2
        );
        
        // Draw cost with scrap icon
        if (this.assets.isReady()) {
            const scrapImg = this.assets.getImage('scrap');
            const scrapSize = 15 * this.scaleFactor;
            this.drawImageMaintainAspectRatio(
                scrapImg,
                this.towerTooltip.buttons.range.x + this.towerTooltip.buttons.range.width/2 - 30 * this.scaleFactor,
                this.towerTooltip.buttons.range.y + this.towerTooltip.buttons.range.height + 15 * this.scaleFactor,
                scrapSize,
                scrapSize
            );
        }
        this.ctx.fillText(
            `${this.upgradeButtons.range.cost}`,
            this.towerTooltip.buttons.range.x + this.towerTooltip.buttons.range.width/2,
            this.towerTooltip.buttons.range.y + this.towerTooltip.buttons.range.height + 25 * this.scaleFactor
        );
    }

    drawUI() {
        // Draw scraps amount and wave number above crafting menu
        this.ctx.font = 'bold 20px Arial';
        this.ctx.fillStyle = '#FFD700';
        this.ctx.textAlign = 'left';
        
        // Draw scrap icon
        if (this.assets.isReady()) {
            const scrapImg = this.assets.getImage('scrap');
            const scrapSize = 20 * this.scaleFactor;
            this.drawImageMaintainAspectRatio(
                scrapImg,
                this.uiPanel.x + 20 * this.scaleFactor,
                this.uiPanel.y + 10 * this.scaleFactor,
                scrapSize,
                scrapSize
            );
        }
        
        this.ctx.fillText(`${this.scraps}`, this.uiPanel.x + 50 * this.scaleFactor, this.uiPanel.y + 30 * this.scaleFactor);
        
        this.ctx.fillStyle = '#FFF';
        this.ctx.fillText(`WAVE: ${this.waveNumber}`, this.uiPanel.x + 120 * this.scaleFactor, this.uiPanel.y + 30 * this.scaleFactor);
        
        // Tower shop section
        this.ctx.font = 'bold 20px Arial';
        this.ctx.fillStyle = '#FFF';
        this.ctx.textAlign = 'left';
        this.ctx.fillText('CRAFTING', this.uiPanel.x + 20 * this.scaleFactor, this.uiPanel.y + 80 * this.scaleFactor);
        
        // Draw tower selection buttons with sprite images
        for (let i = 0; i < this.towerTypes.length; i++) {
            const tower = this.towerTypes[i];
            const buttonRect = {
                x: this.uiPanel.x + 15 * this.scaleFactor,
                y: this.uiPanel.y + 100 * this.scaleFactor + i * 90 * this.scaleFactor, // Muutettu 80 -> 90
                width: this.uiPanel.width * this.scaleFactor - 30 * this.scaleFactor,
                height: 80 * this.scaleFactor
            };
            
            // Draw button background with button2 image
            if (this.assets.isReady()) {
                const buttonImg = this.assets.getImage('button2');
                const padding = 10 * this.scaleFactor;
                this.drawImageMaintainAspectRatio(
                    buttonImg,
                    buttonRect.x - padding,
                    buttonRect.y,
                    buttonRect.width + padding * 2,
                    buttonRect.height,
                    false
                );
            } else {
                // Fallback to colored rectangle if image not loaded
            this.ctx.fillStyle = this.selectedTowerType === i && this.buyMode ? '#444444' : '#333333';
            this.ctx.fillRect(buttonRect.x, buttonRect.y, buttonRect.width, buttonRect.height);
            }
            
            // Draw tower sprite
            if (this.assets.isReady()) {
                let img;
                if (tower.name === "Wall") {
                    img = this.assets.getImage('wall');
                    this.drawImageMaintainAspectRatio(
                        img,
                        buttonRect.x + 25 * this.scaleFactor,
                        buttonRect.y + 30 * this.scaleFactor,
                        20 * this.scaleFactor,
                        20 * this.scaleFactor
                    );
                } else if (tower.name === "Scrapper") {
                    img = this.assets.getImage('scrapper');
                    this.drawImageMaintainAspectRatio(
                        img,
                        buttonRect.x + 15 * this.scaleFactor,
                        buttonRect.y + 15 * this.scaleFactor,
                        50 * this.scaleFactor,
                        50 * this.scaleFactor
                    );
                } else {
                    img = this.assets.getImage('tower');
                    this.drawImageMaintainAspectRatio(
                        img,
                        buttonRect.x + 15 * this.scaleFactor,
                        buttonRect.y + 15 * this.scaleFactor,
                        50 * this.scaleFactor,
                        50 * this.scaleFactor,
                        true
                    );
                }
            } else {
                // Fallback to colored rectangles if images not loaded
            this.ctx.fillStyle = tower.color;
                if (tower.name === "Wall") {
                    this.ctx.fillRect(buttonRect.x + 25 * this.scaleFactor, buttonRect.y + 30 * this.scaleFactor, 20 * this.scaleFactor, 20 * this.scaleFactor);
                } else {
                    this.ctx.fillRect(buttonRect.x + 15 * this.scaleFactor, buttonRect.y + 15 * this.scaleFactor, 50 * this.scaleFactor, 50 * this.scaleFactor);
                }
            }
            
            // Draw tower name and cost
            this.ctx.fillStyle = '#FFFFFF';
            this.ctx.font = 'bold 16px Arial';
            this.ctx.textAlign = 'left';
            this.ctx.fillText(tower.name, buttonRect.x + 80 * this.scaleFactor, buttonRect.y + 30 * this.scaleFactor);
            
            // Draw cost with scrap icon
            if (this.assets.isReady()) {
                const scrapImg = this.assets.getImage('scrap');
                const scrapSize = 15 * this.scaleFactor;
                this.drawImageMaintainAspectRatio(
                    scrapImg,
                    buttonRect.x + 80 * this.scaleFactor,
                    buttonRect.y + 45 * this.scaleFactor,
                    scrapSize,
                    scrapSize
                );
            }
            this.ctx.font = '16px Arial';
            this.ctx.fillText(`${tower.cost}`, buttonRect.x + 100 * this.scaleFactor, buttonRect.y + 55 * this.scaleFactor);
            
            // Draw hover tooltip if this tower is being hovered over
            if (this.hoveredTowerType === i) {
                this.drawTowerTooltip(tower, buttonRect);
            }
        }
        
        // Draw tower info if a tower is selected
        if (this.selectedTower && !this.scrapMode) {
            // Poistetaan wall ja scrapper kuvaukset kokonaan
        }

        // Draw Next Wave button
            if (!this.waveActive) {
            this.ctx.fillStyle = '#4CAF50';
            } else {
            this.ctx.fillStyle = '#666666';
        }
        
        // Draw button background with image
        if (this.assets.isReady()) {
            const buttonImg = this.assets.getImage('button');
            this.ctx.globalAlpha = this.waveActive ? 0.5 : 1;
            this.drawImageMaintainAspectRatio(
                buttonImg,
                this.nextWaveButton.x,
                this.nextWaveButton.y,
                this.nextWaveButton.width,
                this.nextWaveButton.height
            );
            this.ctx.globalAlpha = 1;
        } else {
            // Fallback to rectangle if image not loaded
            this.ctx.fillRect(
                this.nextWaveButton.x,
                this.nextWaveButton.y, 
                this.nextWaveButton.width, 
                this.nextWaveButton.height
            );
        }
            
            // Draw button text
        this.ctx.fillStyle = this.waveActive ? '#999999' : '#FFFFFF';
            this.ctx.font = '16px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(
                this.nextWaveButton.text,
                this.nextWaveButton.x + this.nextWaveButton.width / 2,
                this.nextWaveButton.y + this.nextWaveButton.height / 2
            );
            
        // Draw Scrap Mode button
        this.ctx.fillStyle = this.scrapModeButton.active ? '#FF4444' : '#666666';
        
        // Draw button background with image
        if (this.assets.isReady()) {
            const buttonImg = this.assets.getImage('button');
            this.drawImageMaintainAspectRatio(
                buttonImg,
                this.scrapModeButton.x,
                this.scrapModeButton.y, 
                this.scrapModeButton.width, 
                this.scrapModeButton.height
            );
            
            // Draw highlight when active
            if (this.scrapModeButton.active) {
                this.ctx.strokeStyle = '#FF0000';
                this.ctx.lineWidth = 3 * this.scaleFactor;
                this.ctx.strokeRect(
                    this.scrapModeButton.x,
                    this.scrapModeButton.y, 
                    this.scrapModeButton.width, 
                    this.scrapModeButton.height
                );
            }
        } else {
            // Fallback to rectangle if image not loaded
            this.ctx.fillRect(
                this.scrapModeButton.x,
                this.scrapModeButton.y, 
                this.scrapModeButton.width, 
                this.scrapModeButton.height
            );
        }
            
            // Draw button text
            this.ctx.fillStyle = '#FFFFFF';
            this.ctx.textAlign = 'center';
            this.ctx.fillText(
            this.scrapModeButton.text,
            this.scrapModeButton.x + this.scrapModeButton.width/2,
            this.scrapModeButton.y + this.scrapModeButton.height/2
        );
    }
    
    // Draw tooltip for tower when hovering over it in the crafting menu
    drawTowerTooltip(tower, buttonRect) {
        // Tooltip background
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        this.ctx.fillRect(buttonRect.x, buttonRect.y - 100 * this.scaleFactor, buttonRect.width, 90 * this.scaleFactor);
        
        // Tooltip border
        this.ctx.strokeStyle = '#666';
        this.ctx.lineWidth = 1 * this.scaleFactor;
        this.ctx.strokeRect(buttonRect.x, buttonRect.y - 100 * this.scaleFactor, buttonRect.width, 90 * this.scaleFactor);
        
        // Tooltip title
        this.ctx.fillStyle = '#FFF';
        this.ctx.font = 'bold 14px Arial';
        this.ctx.textAlign = 'left';
        this.ctx.fillText(tower.name, buttonRect.x + 10 * this.scaleFactor, buttonRect.y - 80 * this.scaleFactor);
        
        // Tooltip description
            this.ctx.font = '12px Arial';
        this.ctx.fillStyle = '#CCC';
        
        if (tower.name === "Sentry") {
            this.ctx.fillText("A defensive turret that automatically", buttonRect.x + 10 * this.scaleFactor, buttonRect.y - 60 * this.scaleFactor);
            this.ctx.fillText("targets and attacks nearby creeps.", buttonRect.x + 10 * this.scaleFactor, buttonRect.y - 45 * this.scaleFactor);
            this.ctx.fillText(`Damage: ${tower.damage} | Range: ${tower.range}`, buttonRect.x + 10 * this.scaleFactor, buttonRect.y - 30 * this.scaleFactor);
            this.ctx.fillText(`Fire Rate: ${tower.fireRate}/s`, buttonRect.x + 10 * this.scaleFactor, buttonRect.y - 15 * this.scaleFactor);
        } else if (tower.name === "Bouncer") {
            this.ctx.fillText("A turret that fires bouncing projectiles", buttonRect.x + 10 * this.scaleFactor, buttonRect.y - 60 * this.scaleFactor);
            this.ctx.fillText("that can hit multiple enemies.", buttonRect.x + 10 * this.scaleFactor, buttonRect.y - 45 * this.scaleFactor);
            this.ctx.fillText(`Damage: ${tower.damage} | Range: ${tower.range}`, buttonRect.x + 10 * this.scaleFactor, buttonRect.y - 30 * this.scaleFactor);
            this.ctx.fillText(`Bounces: ${tower.maxBounces} | Rate: ${tower.fireRate}/s`, buttonRect.x + 10 * this.scaleFactor, buttonRect.y - 15 * this.scaleFactor);
        } else if (tower.name === "Wall") {
            this.ctx.fillText("A simple barrier that blocks creep", buttonRect.x + 10 * this.scaleFactor, buttonRect.y - 60 * this.scaleFactor);
            this.ctx.fillText("movement and forces them to take", buttonRect.x + 10 * this.scaleFactor, buttonRect.y - 45 * this.scaleFactor);
            this.ctx.fillText("alternative paths.", buttonRect.x + 10 * this.scaleFactor, buttonRect.y - 30 * this.scaleFactor);
        } else if (tower.name === "Scrapper") {
            this.ctx.fillText("A resource processing machine that", buttonRect.x + 10 * this.scaleFactor, buttonRect.y - 60 * this.scaleFactor);
            this.ctx.fillText("automatically generates scraps during", buttonRect.x + 10 * this.scaleFactor, buttonRect.y - 45 * this.scaleFactor);
            this.ctx.fillText("active waves.", buttonRect.x + 10 * this.scaleFactor, buttonRect.y - 30 * this.scaleFactor);
            this.ctx.fillText(`+${tower.scrapRate} scrap every ${tower.scrapInterval/1000}s during waves`, buttonRect.x + 10 * this.scaleFactor, buttonRect.y - 15 * this.scaleFactor);
        } else if (tower.name === "RPG") {
            this.ctx.fillText("A turret that fires explosive projectiles", buttonRect.x + 10 * this.scaleFactor, buttonRect.y - 60 * this.scaleFactor);
            this.ctx.fillText("that damage all enemies in the blast radius.", buttonRect.x + 10 * this.scaleFactor, buttonRect.y - 45 * this.scaleFactor);
            this.ctx.fillText(`Direct Hit: ${tower.damage} | Range: ${tower.range}`, buttonRect.x + 10 * this.scaleFactor, buttonRect.y - 30 * this.scaleFactor);
            this.ctx.fillText(`Explosion: ${tower.explosionDamage} | Radius: ${tower.explosionRadius}`, buttonRect.x + 10 * this.scaleFactor, buttonRect.y - 15 * this.scaleFactor);
        } else if (tower.name === "Sniper") {
            this.ctx.fillText("A sniper turret that can hit any target", buttonRect.x + 10 * this.scaleFactor, buttonRect.y - 60 * this.scaleFactor);
            this.ctx.fillText("on the map with devastating damage.", buttonRect.x + 10 * this.scaleFactor, buttonRect.y - 45 * this.scaleFactor);
            this.ctx.fillText(`Damage: ${tower.damage} | Range: Global`, buttonRect.x + 10 * this.scaleFactor, buttonRect.y - 30 * this.scaleFactor);
            this.ctx.fillText(`Fire Rate: ${tower.fireRate}/s`, buttonRect.x + 10 * this.scaleFactor, buttonRect.y - 15 * this.scaleFactor);
        }
    }

    drawStats() {
        // Draw stats at the top of the screen
        this.ctx.font = `${20 * this.scaleFactor}px Arial`;
        this.ctx.textAlign = 'left';
        this.ctx.fillStyle = '#FFF';
    }

    // Draw the grid with low opacity
    drawGrid() {
        this.ctx.strokeStyle = 'rgba(100, 100, 100, 0.2)';
        this.ctx.lineWidth = 1;
        
        // Draw vertical lines
        for (let x = 0; x <= this.grid.cols; x++) {
            const xPos = x * this.grid.cellSize + this.gameArea.x;
            this.ctx.beginPath();
            this.ctx.moveTo(xPos, this.gameArea.y);
            this.ctx.lineTo(xPos, this.gameArea.y + this.gameArea.height);
            this.ctx.stroke();
        }
        
        // Draw horizontal lines
        for (let y = 0; y <= this.grid.rows; y++) {
            const yPos = y * this.grid.cellSize + this.gameArea.y;
            this.ctx.beginPath();
            this.ctx.moveTo(this.gameArea.x, yPos);
            this.ctx.lineTo(this.gameArea.x + this.gameArea.width, yPos);
            this.ctx.stroke();
        }
    }

    // Add a floating text effect
    addFloatingText(x, y, text, color, showScrapIcon = false) {
        this.floatingTexts.push({
            x: x,
            y: y,
            text: text,
            color: color,
            alpha: 1.0,
            life: 120,
            showScrapIcon: showScrapIcon
        });
    }

    // Helper function to convert hex color to rgb
    hexToRgb(hex) {
        // Remove # if present
        hex = hex.replace('#', '');
        
        // Parse the values
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);
        
        return `${r}, ${g}, ${b}`;
    }

    gameLoop(currentTime) {
        const deltaTime = currentTime - this.lastTime;
        this.lastTime = currentTime;
        
        if (!this.gameOver) {
            this.update(currentTime);
        }
        
        this.draw();
        
        // Continue game loop
        requestAnimationFrame((time) => this.gameLoop(time));
    }

    // Lisätään latausruudun piirto
    drawLoadingScreen() {
        this.ctx.fillStyle = '#000';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.ctx.fillStyle = '#fff';
        this.ctx.font = '24px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('Ladataan pelin resursseja...', this.canvas.width / 2, this.canvas.height / 2);
        
        // Latauksen edistymispalkki
        const progress = this.assets.loadedImages / this.assets.totalImages;
        const barWidth = 300 * this.scaleFactor;
        const barHeight = 20 * this.scaleFactor;
        
        this.ctx.strokeStyle = '#fff';
        this.ctx.strokeRect(this.canvas.width / 2 - barWidth / 2, this.canvas.height / 2 + 30 * this.scaleFactor, barWidth, barHeight);
        
        this.ctx.fillStyle = '#4CAF50';
        this.ctx.fillRect(this.canvas.width / 2 - barWidth / 2, this.canvas.height / 2 + 30 * this.scaleFactor, barWidth * progress, barHeight);
    }
}

// Start game when page is loaded
window.onload = () => {
    const game = new Game();
}; 