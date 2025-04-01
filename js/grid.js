class Grid {
    constructor(cols, rows, cellSize, offsetX = 0) {
        this.cols = cols;
        this.rows = rows;
        this.cellSize = cellSize;
        this.offsetX = offsetX;
        this.width = cols * cellSize;
        this.height = rows * cellSize;
        this.cells = this.initializeCells();
    }

    initializeCells() {
        const cells = [];
        for (let y = 0; y < this.rows; y++) {
            const row = [];
            for (let x = 0; x < this.cols; x++) {
                row.push({
                    x,
                    y,
                    occupied: false,
                    tower: null
                });
            }
            cells.push(row);
        }
        return cells;
    }

    getCell(x, y) {
        // Convert pixel coordinates to grid coordinates
        const gridX = Math.floor((x - this.offsetX) / this.cellSize);
        const gridY = Math.floor(y / this.cellSize);
        
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

        // Check if all 4 cells are free
        for (let y = gridY; y <= gridY + 1; y++) {
            for (let x = gridX; x <= gridX + 1; x++) {
                if (this.cells[y][x].occupied) {
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
        tower.x = gridX * this.cellSize;
        tower.y = gridY * this.cellSize;
        
        return true;
    }

    // Draw the grid
    draw(ctx) {
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 0.5;

        // Draw vertical lines
        for (let x = 0; x <= this.cols; x++) {
            ctx.beginPath();
            ctx.moveTo(x * this.cellSize + this.offsetX, 0);
            ctx.lineTo(x * this.cellSize + this.offsetX, this.height);
            ctx.stroke();
        }

        // Draw horizontal lines
        for (let y = 0; y <= this.rows; y++) {
            ctx.beginPath();
            ctx.moveTo(this.offsetX, y * this.cellSize);
            ctx.lineTo(this.width + this.offsetX, y * this.cellSize);
            ctx.stroke();
        }

        // Visualize occupied cells
        ctx.fillStyle = 'rgba(100, 100, 100, 0.3)';
        for (let y = 0; y < this.rows; y++) {
            for (let x = 0; x < this.cols; x++) {
                if (this.cells[y][x].occupied) {
                    ctx.fillRect(
                        x * this.cellSize + this.offsetX, 
                        y * this.cellSize, 
                        this.cellSize, 
                        this.cellSize
                    );
                }
            }
        }
    }
} 