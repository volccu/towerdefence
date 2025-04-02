// A* pathfinding algorithm
class Pathfinding {
    constructor(grid) {
        this.grid = grid;
    }

    // Heuristic function: estimate of distance between two points (Manhattan distance)
    heuristic(a, b) {
        // Changed to Euclidean distance for diagonal movement
        return Math.sqrt(Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2));
    }

    // Returns list of neighboring cells that aren't occupied
    getNeighbors(node, grid) {
        const neighbors = [];
        const directions = [
            { x: 0, y: -1 },  // up
            { x: 1, y: 0 },   // right
            { x: 0, y: 1 },   // down
            { x: -1, y: 0 },  // left
            { x: 1, y: -1 },  // up-right (diagonal)
            { x: 1, y: 1 },   // down-right (diagonal)
            { x: -1, y: 1 },  // down-left (diagonal)
            { x: -1, y: -1 }  // up-left (diagonal)
        ];

        for (const dir of directions) {
            const x = node.x + dir.x;
            const y = node.y + dir.y;

            // Check that neighbor is within grid bounds
            if (x >= 0 && x < grid.cols && y >= 0 && y < grid.rows) {
                const cell = grid.cells[y][x];
                // Salli liikkuminen vain jos ruutu ei ole occupied tai obstacle
                if (!cell.occupied && !cell.isObstacle) {
                    // For diagonal movement, need to check if both adjacent cardinal cells are free
                    if (dir.x !== 0 && dir.y !== 0) {
                        // This is a diagonal move, check if the two adjacent cells are walkable
                        const adjXCell = grid.cells[node.y][node.x + dir.x];
                        const adjYCell = grid.cells[node.y + dir.y][node.x];
                        
                        // Jos jompikumpi viereisistä ruuduista on este tai occupied, ei voi liikkua diagonaalisesti
                        if (adjXCell.occupied || adjXCell.isObstacle || adjYCell.occupied || adjYCell.isObstacle) {
                            continue;
                        }
                    }
                    neighbors.push(cell);
                }
            }
        }

        return neighbors;
    }

    // A* pathfinding from start point to target point
    findPath(startX, startY, targetX, targetY) {
        const startNode = this.grid.cells[startY][startX];
        let targetNode;
        
        // If target is an array, choose first reachable target
        if (Array.isArray(targetY)) {
            // Assume targetX is first index of target array and targetY is second
            for (let i = 0; i < targetX.length; i++) {
                const tx = targetX[i];
                const ty = targetY[i];
                if (tx >= 0 && tx < this.grid.cols && ty >= 0 && ty < this.grid.rows) {
                    if (!this.grid.cells[ty][tx].occupied) {
                        targetNode = this.grid.cells[ty][tx];
                        break;
                    }
                }
            }
            if (!targetNode) return null; // No target is reachable
        } else {
            // Single target
            if (targetX < 0 || targetX >= this.grid.cols || targetY < 0 || targetY >= this.grid.rows) {
                return null;
            }
            if (this.grid.cells[targetY][targetX].occupied) {
                return null; // Target is occupied, cannot reach
            }
            targetNode = this.grid.cells[targetY][targetX];
        }

        // Initialize open and closed sets
        const openSet = [startNode];
        const closedSet = [];
        const cameFrom = {};
        const gScore = {};
        const fScore = {};

        // Initialize distances to infinity for all nodes
        for (let y = 0; y < this.grid.rows; y++) {
            for (let x = 0; x < this.grid.cols; x++) {
                gScore[`${x},${y}`] = Infinity;
                fScore[`${x},${y}`] = Infinity;
            }
        }

        // Set start node distance to zero
        gScore[`${startNode.x},${startNode.y}`] = 0;
        fScore[`${startNode.x},${startNode.y}`] = this.heuristic(startNode, targetNode);

        while (openSet.length > 0) {
            // Find node with lowest f-score
            let current = openSet[0];
            let lowestFScoreIndex = 0;
            for (let i = 1; i < openSet.length; i++) {
                const node = openSet[i];
                const nodeKey = `${node.x},${node.y}`;
                const currentKey = `${current.x},${current.y}`;
                if (fScore[nodeKey] < fScore[currentKey]) {
                    current = node;
                    lowestFScoreIndex = i;
                }
            }

            // If we reached the target, reconstruct path
            if (current.x === targetNode.x && current.y === targetNode.y) {
                const path = [];
                let currentPath = current;
                while (cameFrom[`${currentPath.x},${currentPath.y}`]) {
                    path.unshift(currentPath);
                    currentPath = cameFrom[`${currentPath.x},${currentPath.y}`];
                }
                path.unshift(startNode);
                return path;
            }

            // Remove current node from open set and add to closed set
            openSet.splice(lowestFScoreIndex, 1);
            closedSet.push(current);

            // Process neighbors
            const neighbors = this.getNeighbors(current, this.grid);
            for (const neighbor of neighbors) {
                const neighborKey = `${neighbor.x},${neighbor.y}`;
                
                // Skip if neighbor is already in closed set
                if (closedSet.some(node => node.x === neighbor.x && node.y === neighbor.y)) {
                    continue;
                }

                // Calculate tentative g-score
                const tentativeGScore = gScore[`${current.x},${current.y}`] + 1; // Assume distance is 1

                // If neighbor isn't in open set or new route is better
                if (!openSet.some(node => node.x === neighbor.x && node.y === neighbor.y) || 
                    tentativeGScore < gScore[neighborKey]) {
                    
                    // Update path info
                    cameFrom[neighborKey] = current;
                    gScore[neighborKey] = tentativeGScore;
                    fScore[neighborKey] = gScore[neighborKey] + this.heuristic(neighbor, targetNode);
                    
                    // Add neighbor to open set if not already there
                    if (!openSet.some(node => node.x === neighbor.x && node.y === neighbor.y)) {
                        openSet.push(neighbor);
                    }
                }
            }
        }

        // If no path is found
        return null;
    }

    // Find path to bottom targets (bottom of play area)
    findPathToBottom(startX, startY) {
        // Find all possible targets on bottom row
        const targets = [];
        const targetRows = [];
        for (let x = 0; x < this.grid.cols; x++) {
            if (!this.grid.cells[this.grid.rows - 1][x].occupied) {
                targets.push(x);
                targetRows.push(this.grid.rows - 1);
            }
        }

        if (targets.length === 0) return null; // No possible targets
        
        return this.findPath(startX, startY, targets, targetRows);
    }
} 