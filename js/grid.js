export class Grid {
    constructor(cols, rows, cellSize, offsetX = 0, mapData = null) {
        this.cols = cols;
        this.rows = rows;
        this.cellSize = cellSize;
        this.offsetX = offsetX;
        this.width = cols * cellSize;
        this.height = rows * cellSize;
        this.mapData = mapData;
        this.cells = this.initializeCells();
        this.game = null; // Lisätään viittaus Game-olioon
    }

    initializeCells() {
        const cells = [];
        for (let y = 0; y < this.rows; y++) {
            const row = [];
            for (let x = 0; x < this.cols; x++) {
                if (this.mapData && this.mapData[y] && this.mapData[y][x] !== undefined) {
                    // Tarkista onko ruutu este (OBSTACLE = 1) tai polku (PATH = 2)
                    const isObstacle = this.mapData[y][x] === 1;
                    const isPath = this.mapData[y][x] === 2;
                    row.push({
                        x,
                        y,
                        occupied: isObstacle, // Este on occupied
                        tower: null,
                        isObstacle: isObstacle, // Este on myös isObstacle
                        isPath: isPath // Lisätään tieto polusta
                    });
                } else {
                    row.push({
                        x,
                        y,
                        occupied: false,
                        tower: null,
                        isObstacle: false,
                        isPath: false
                    });
                }
            }
            cells.push(row);
        }
        return cells;
    }

    getCell(x, y) {
        // Convert pixel coordinates to grid coordinates
        const gridX = Math.floor((x - this.offsetX) / this.cellSize);
        const gridY = Math.floor((y - this.game.gameArea.y) / this.cellSize);
        
        if (gridX >= 0 && gridX < this.cols && gridY >= 0 && gridY < this.rows) {
            return this.cells[gridY][gridX];
        }
        return null;
    }

    // Check if a 2x2 area is free for tower placement
    canPlaceTower(gridX, gridY) {
        // Check within bounds
        if (gridX < 0 || gridX + 1 >= this.cols || gridY < 0 || gridY + 1 >= this.rows) {
            return false;
        }

        // Check if all 4 cells are free and not obstacles
        for (let y = gridY; y <= gridY + 1; y++) {
            for (let x = gridX; x <= gridX + 1; x++) {
                if (this.cells[y][x].occupied || this.cells[y][x].isObstacle) {
                    return false;
                }
            }
        }
        return true;
    }

    // Mark a 2x2 area as occupied for a tower
    placeTower(tower, gridX, gridY) {
        if (!this.canPlaceTower(gridX, gridY)) {
            return false;
        }

        for (let y = gridY; y <= gridY + 1; y++) {
            for (let x = gridX; x <= gridX + 1; x++) {
                this.cells[y][x].occupied = true;
                this.cells[y][x].tower = tower;
            }
        }
        
        // Set tower coordinates in grid units
        tower.gridX = gridX;
        tower.gridY = gridY;
        
        // Set tower physical coordinates in pixels
        tower.x = gridX * this.cellSize + this.offsetX;
        tower.y = gridY * this.cellSize + this.game.gameArea.y;
        
        return true;
    }

    // Draw the grid
    draw(ctx) {
        // Piirrä ground-kuvat ensin
        if (this.game && this.game.assets && this.game.assets.isReady()) {
            const groundImg = this.game.assets.getImage('ground');
            const nongroundImg = this.game.assets.getImage('nonground');
            
            for (let y = 0; y < this.rows; y++) {
                for (let x = 0; x < this.cols; x++) {
                    const cell = this.cells[y][x];
                    const drawX = x * this.cellSize + this.offsetX;
                    const drawY = y * this.cellSize + this.game.gameArea.y;

                    if (cell.isObstacle) {
                        // Piirrä nonground-kuva esteille
                        ctx.drawImage(
                            nongroundImg,
                            drawX,
                            drawY,
                            this.cellSize,
                            this.cellSize
                        );
                    } else {
                        // Piirrä ground-kuva tyhjille ruuduille ja poluille
                        ctx.drawImage(
                            groundImg,
                            drawX,
                            drawY,
                            this.cellSize,
                            this.cellSize
                        );
                    }
                }
            }
        }

        // Piirrä ruudukko
        ctx.strokeStyle = 'rgba(51, 51, 51, 0.5)';
        ctx.lineWidth = 0.5;

        // Draw vertical lines
        for (let x = 0; x <= this.cols; x++) {
            ctx.beginPath();
            ctx.moveTo(x * this.cellSize + this.offsetX, this.game.gameArea.y);
            ctx.lineTo(x * this.cellSize + this.offsetX, this.game.gameArea.y + this.height);
            ctx.stroke();
        }

        // Draw horizontal lines
        for (let y = 0; y <= this.rows; y++) {
            ctx.beginPath();
            ctx.moveTo(this.offsetX, y * this.cellSize + this.game.gameArea.y);
            ctx.lineTo(this.width + this.offsetX, y * this.cellSize + this.game.gameArea.y);
            ctx.stroke();
        }

        // Visualize occupied cells (only for towers, not obstacles)
        for (let y = 0; y < this.rows; y++) {
            for (let x = 0; x < this.cols; x++) {
                const cell = this.cells[y][x];
                if (cell.occupied && !cell.isObstacle) {
                    // ctx.fillStyle = 'rgba(100, 100, 100, 0.3)'; // Poistettu tornien taustaväri
                    // ctx.fillRect( // Poistettu tornien taustalaatikon piirto
                    //     x * this.cellSize + this.offsetX,
                    //     y * this.cellSize + this.game.gameArea.y,
                    //     this.cellSize,
                    //     this.cellSize
                    // );
                }
            }
        }
    }

    // Check if a single cell is occupied
    isCellOccupied(gridX, gridY) {
        // Check within bounds
        if (gridX < 0 || gridX >= this.cols || gridY < 0 || gridY >= this.rows) {
            return true; // Out of bounds is considered occupied
        }
        
        const cell = this.cells[gridY][gridX];
        return cell.occupied || cell.isObstacle; // Tarkista sekä occupied että isObstacle
    }
    
    // Mark a single cell as occupied
    markCellOccupied(gridX, gridY) {
        if (gridX < 0 || gridX >= this.cols || gridY < 0 || gridY >= this.rows) {
            return false; // Can't mark out of bounds
        }
        
        this.cells[gridY][gridX].occupied = true;
        return true;
    }
    
    // Mark a single cell as unoccupied (for removal)
    markCellUnoccupied(gridX, gridY) {
        if (gridX < 0 || gridX >= this.cols || gridY < 0 || gridY >= this.rows) {
            return false; // Can't mark out of bounds
        }
        
        this.cells[gridY][gridX].occupied = false;
        this.cells[gridY][gridX].tower = null;
        return true;
    }
} 