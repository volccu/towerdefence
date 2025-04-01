class Game {
    constructor() {
        this.initialize();
        this.setupEventListeners();
        this.lastTime = 0;
        this.startGame();
    }

    initialize() {
        // Canvas & context
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        
        // Canvas size - wider to accommodate UI panels
        this.canvas.width = 700;
        this.canvas.height = 600;
        
        // Game area definition
        this.gameArea = {
            x: 150,
            y: 0,
            width: 400,
            height: 600
        };
        
        // Grid (small cells)
        const cellSize = 20;
        const cols = Math.floor(this.gameArea.width / cellSize);
        const rows = Math.floor(this.gameArea.height / cellSize);
        this.grid = new Grid(cols, rows, cellSize, this.gameArea.x);
        
        // Pathfinding
        this.pathfinding = new Pathfinding(this.grid);
        
        // Game state
        this.playerLives = 10;
        this.money = 150; // Starting money
        this.score = 0;
        this.gameOver = false;
        this.debugMode = false;
        this.sellMode = false;
        
        // Tower types and costs
        this.towerTypes = [
            {
                name: "Basic Tower",
                cost: 40,
                damage: 20,
                range: 150,
                fireRate: 1,
                color: "#00AAFF",
                strokeColor: "#0088CC"
            }
        ];
        this.selectedTowerType = 0;
        
        // Tower wireframe and selection
        this.hoverX = 0;
        this.hoverY = 0;
        this.selectedTowers = []; // For bulk selling
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
        
        // UI Buttons
        this.nextWaveButton = {
            x: 30,
            y: 550,
            width: 90,
            height: 40,
            text: "NEXT WAVE"
        };
        
        this.sellModeButton = {
            x: 30,
            y: 500,
            width: 90,
            height: 40,
            text: "SELL MODE",
            active: false
        };
    }

    setupEventListeners() {
        // Listen for clicks for tower placement and button presses
        this.canvas.addEventListener('click', (event) => {
            if (this.gameOver) return;
            
            // Get click position in Canvas
            const rect = this.canvas.getBoundingClientRect();
            const x = event.clientX - rect.left;
            const y = event.clientY - rect.top;
            
            // Check if click hit Next Wave button
            if (this.isPointInRect(x, y, this.nextWaveButton) && !this.waveActive) {
                this.startNextWave();
                return;
            }
            
            // Check if click hit Sell Mode button
            if (this.isPointInRect(x, y, this.sellModeButton)) {
                this.sellMode = !this.sellMode;
                this.sellModeButton.active = this.sellMode;
                return;
            }
            
            // Check if click hit tower selection area
            for (let i = 0; i < this.towerTypes.length; i++) {
                const towerButton = this.getTowerButtonRect(i);
                if (this.isPointInRect(x, y, towerButton)) {
                    this.selectedTowerType = i;
                    this.sellMode = false;
                    this.sellModeButton.active = false;
                    return;
                }
            }
            
            // Check if click is within game area
            if (x >= this.gameArea.x && x <= this.gameArea.x + this.gameArea.width &&
                y >= this.gameArea.y && y <= this.gameArea.y + this.gameArea.height) {
                
                // Convert pixels to grid coordinates
                const gridX = Math.floor((x - this.gameArea.x) / this.grid.cellSize);
                const gridY = Math.floor(y / this.grid.cellSize);
                
                if (this.sellMode) {
                    // Try to sell a tower
                    this.sellTower(gridX, gridY);
                } else {
                    // Try to place a tower
                    this.placeTower(gridX, gridY);
                }
            }
        });

        // Mouse movement for wireframe and hover effects
        this.canvas.addEventListener('mousemove', (event) => {
            const rect = this.canvas.getBoundingClientRect();
            const x = event.clientX - rect.left;
            const y = event.clientY - rect.top;
            
            // Update hover coordinates if in game area
            if (x >= this.gameArea.x && x <= this.gameArea.x + this.gameArea.width &&
                y >= this.gameArea.y && y <= this.gameArea.y + this.gameArea.height) {
                this.hoverX = Math.floor((x - this.gameArea.x) / this.grid.cellSize);
                this.hoverY = Math.floor(y / this.grid.cellSize);
            }
            
            // Check mouse over buttons and update cursor
            if (this.isPointInRect(x, y, this.nextWaveButton) || 
                this.isPointInRect(x, y, this.sellModeButton)) {
                document.body.style.cursor = 'pointer';
            } else {
                for (let i = 0; i < this.towerTypes.length; i++) {
                    if (this.isPointInRect(x, y, this.getTowerButtonRect(i))) {
                        document.body.style.cursor = 'pointer';
                        return;
                    }
                }
                document.body.style.cursor = 'default';
            }
            
            // Update dragging for bulk tower selection
            if (this.sellMode && this.isDragging) {
                this.updateDragSelection(x, y);
            }
        });
        
        // Mouse down for drag selection
        this.canvas.addEventListener('mousedown', (event) => {
            if (this.gameOver || !this.sellMode) return;
            
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
                
                // Sell all selected towers if in sell mode
                if (this.sellMode && this.selectedTowers.length > 0) {
                    for (const tower of this.selectedTowers) {
                        this.sellTowerObject(tower);
                    }
                    this.selectedTowers = [];
                }
            }
        });

        // Debug mode toggle (d key)
        window.addEventListener('keydown', (event) => {
            if (event.key === 'd') {
                this.debugMode = !this.debugMode;
            }
        });
    }

    isPointInRect(x, y, rect) {
        return x >= rect.x && x <= rect.x + rect.width &&
               y >= rect.y && y <= rect.y + rect.height;
    }
    
    getTowerButtonRect(index) {
        return {
            x: 30,
            y: 150 + index * 60,
            width: 90,
            height: 50
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
        
        // Check if tower can be placed and player has enough money
        if (this.grid.canPlaceTower(gridX, gridY) && this.money >= towerType.cost) {
            const newTower = new Tower(this, gridX, gridY, towerType);
            this.towers.push(newTower);
            this.grid.placeTower(newTower, gridX, gridY);
            
            // Deduct money
            this.money -= towerType.cost;
            
            // Check if the tower blocks all paths
            for (const creep of this.creeps) {
                if (creep.isAlive) {
                    creep.findPath();
                }
            }
        }
    }
    
    sellTower(gridX, gridY) {
        // Find the tower at this grid position
        for (let i = 0; i < this.towers.length; i++) {
            const tower = this.towers[i];
            
            // Check if tower occupies this grid position
            if (gridX >= tower.gridX && gridX <= tower.gridX + 1 && 
                gridY >= tower.gridY && gridY <= tower.gridY + 1) {
                this.sellTowerObject(tower);
                break;
            }
        }
    }
    
    sellTowerObject(tower) {
        // Remove from towers array
        const index = this.towers.indexOf(tower);
        if (index !== -1) {
            // Refund half the tower cost
            this.money += Math.floor(tower.cost / 2);
            
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
        this.creepsToSpawn = 5 + this.waveNumber * 2; // More creeps each wave
        this.lastSpawnTime = 0;
        this.waveActive = true;
    }

    spawnCreep() {
        if (this.creepsToSpawn <= 0) return;
        
        // Spawn creep in the center of the top edge
        const x = this.gameArea.x + this.gameArea.width / 2;
        const y = 0;
        
        // Calculate health & reward based on wave number
        const health = 80 + this.waveNumber * 20; // More HP in later waves
        
        // Create new creep (slower speed = 0.5)
        const creep = new Creep(this, x, y, health, 0.5);
        this.creeps.push(creep);
        
        this.creepsToSpawn--;
    }

    update(currentTime) {
        // Update game objects
        for (const tower of this.towers) {
            tower.update(currentTime);
        }
        
        for (let i = this.creeps.length - 1; i >= 0; i--) {
            const creep = this.creeps[i];
            creep.update();
            
            // Remove dead creeps
            if (!creep.isAlive) {
                if (creep.reachedEnd) {
                    // Creep reached the end
                    this.playerLives--;
                } else {
                    // Creep was killed - give money
                    // Improved economy - more money for later waves
                    const reward = 15 + Math.floor(this.waveNumber * 1.5);
                    this.money += reward;
                    this.score += 10;
                }
                this.creeps.splice(i, 1);
            }
        }
        
        // Check if wave is complete
        if (this.waveActive && this.creepsToSpawn <= 0 && this.creeps.length === 0) {
            this.waveActive = false;
            // Bonus money at end of wave
            const waveBonus = 20 + this.waveNumber * 10;
            this.money += waveBonus;
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
    }

    draw() {
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw left UI panel
        this.drawLeftPanel();
        
        // Set clip region to game area
        this.ctx.save();
        this.ctx.beginPath();
        this.ctx.rect(this.gameArea.x, this.gameArea.y, this.gameArea.width, this.gameArea.height);
        this.ctx.clip();
        
        // Draw grid (offset by game area x)
        this.grid.draw(this.ctx);
        
        // Draw towers
        for (const tower of this.towers) {
            tower.draw(this.ctx);
        }
        
        // Draw tower wireframe if hovering over grid
        const towerType = this.towerTypes[this.selectedTowerType];
        if (!this.gameOver && !this.sellMode && this.money >= towerType.cost) {
            this.drawTowerWireframe(this.hoverX, this.hoverY);
        }
        
        // Draw creeps
        for (const creep of this.creeps) {
            creep.draw(this.ctx);
        }
        
        // Draw selection rectangle when dragging in sell mode
        if (this.isDragging && this.sellMode) {
            const rect = {
                x: Math.min(this.dragStart.x, this.hoverX * this.grid.cellSize + this.gameArea.x),
                y: Math.min(this.dragStart.y, this.hoverY * this.grid.cellSize),
                width: Math.abs(this.hoverX * this.grid.cellSize + this.gameArea.x - this.dragStart.x),
                height: Math.abs(this.hoverY * this.grid.cellSize - this.dragStart.y)
            };
            
            this.ctx.strokeStyle = '#FF0000';
            this.ctx.lineWidth = 2;
            this.ctx.setLineDash([5, 5]);
            this.ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
            this.ctx.setLineDash([]);
        }
        
        // Draw selected towers highlight
        if (this.sellMode) {
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
        
        // Restore clip region
        this.ctx.restore();
        
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
            this.ctx.fillText(`Score: ${this.score}`, this.canvas.width / 2, this.canvas.height / 2 + 40);
            this.ctx.fillText('Refresh to play again', this.canvas.width / 2, this.canvas.height / 2 + 70);
        }
    }

    drawTowerWireframe(gridX, gridY) {
        if (this.grid.canPlaceTower(gridX, gridY)) {
            const x = gridX * this.grid.cellSize + this.gameArea.x;
            const y = gridY * this.grid.cellSize;
            const width = this.grid.cellSize * 2;
            const height = this.grid.cellSize * 2;
            
            // Draw wireframe
            this.ctx.strokeStyle = '#00FFFF';
            this.ctx.lineWidth = 2;
            this.ctx.setLineDash([5, 5]);
            this.ctx.strokeRect(x, y, width, height);
            this.ctx.setLineDash([]);
        }
    }
    
    drawLeftPanel() {
        // Draw panel background
        this.ctx.fillStyle = '#1A1A1A';
        this.ctx.fillRect(0, 0, this.gameArea.x, this.canvas.height);
        
        // Draw game info
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.font = '16px "Courier New", monospace';
        this.ctx.textAlign = 'left';
        this.ctx.textBaseline = 'alphabetic';
        
        this.ctx.fillText(`Wave: ${this.waveNumber}`, 20, 30);
        this.ctx.fillText(`Lives: ${this.playerLives}`, 20, 60);
        this.ctx.fillText(`Money: $${this.money}`, 20, 90);
        this.ctx.fillText(`Score: ${this.score}`, 20, 120);
        
        // Draw tower shop
        this.ctx.fillText(`Tower Shop:`, 20, 160);
        
        // Draw tower selection buttons
        for (let i = 0; i < this.towerTypes.length; i++) {
            const tower = this.towerTypes[i];
            const buttonRect = this.getTowerButtonRect(i);
            
            // Draw button background
            this.ctx.fillStyle = this.selectedTowerType === i && !this.sellMode ? '#444444' : '#333333';
            this.ctx.fillRect(buttonRect.x, buttonRect.y, buttonRect.width, buttonRect.height);
            
            // Draw tower preview
            this.ctx.fillStyle = tower.color;
            this.ctx.fillRect(buttonRect.x + 10, buttonRect.y + 15, 20, 20);
            
            // Draw tower info
            this.ctx.fillStyle = '#FFFFFF';
            this.ctx.textAlign = 'left';
            this.ctx.fillText(`$${tower.cost}`, buttonRect.x + 40, buttonRect.y + 30);
        }
        
        // Draw Next Wave button
        if (!this.gameOver) {
            // Draw button
            if (!this.waveActive) {
                this.ctx.fillStyle = '#4CAF50'; // Green
            } else {
                this.ctx.fillStyle = '#666666'; // Gray when wave is active
            }
            
            this.ctx.fillRect(
                this.nextWaveButton.x,
                this.nextWaveButton.y, 
                this.nextWaveButton.width, 
                this.nextWaveButton.height
            );
            
            // Draw button text
            this.ctx.fillStyle = '#FFFFFF';
            this.ctx.font = '14px "Courier New", monospace';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(
                this.nextWaveButton.text,
                this.nextWaveButton.x + this.nextWaveButton.width / 2,
                this.nextWaveButton.y + this.nextWaveButton.height / 2
            );
        }
        
        // Draw Sell Mode button
        this.ctx.fillStyle = this.sellModeButton.active ? '#FF4444' : '#666666';
        this.ctx.fillRect(
            this.sellModeButton.x,
            this.sellModeButton.y, 
            this.sellModeButton.width, 
            this.sellModeButton.height
        );
        
        // Draw button text
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.font = '14px "Courier New", monospace';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(
            this.sellModeButton.text,
            this.sellModeButton.x + this.sellModeButton.width / 2,
            this.sellModeButton.y + this.sellModeButton.height / 2
        );
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
}

// Start game when page is loaded
window.onload = () => {
    const game = new Game();
}; 