/**
 * MapGenerator - Luokka proseduraalisten karttojen generointiin
 */
export class MapGenerator {
    /**
     * Luo uuden MapGenerator-olion
     * @param {Object} options - Karttagenraation asetukset
     * @param {number} options.width - Kartan leveys ruutuina
     * @param {number} options.height - Kartan korkeus ruutuina
     * @param {Array} options.startPoints - Mahdolliset aloituspisteet [{x, y}, ...]
     * @param {Array} options.endPoints - Mahdolliset lopetuspisteet [{x, y}, ...]
     * @param {number} options.obstacleDensity - Esteiden tiheys (0-1)
     * @param {number} options.maxAttempts - Maksimimäärä yrityksiä kelvollisen kartan generointiin
     */
    constructor(options) {
        this.width = options.width || 30;
        this.height = options.height || 30;
        this.startPoints = options.startPoints || [{x: 0, y: Math.floor(this.height / 2)}];
        this.endPoints = options.endPoints || [{x: this.width - 1, y: Math.floor(this.height / 2)}];
        this.obstacleDensity = options.obstacleDensity || 0.3;
        this.maxAttempts = options.maxAttempts || 10;
        
        // Cellular Automata -asetukset
        this.CA_ITERATIONS = 5;
        this.CA_BIRTH_LIMIT = 4;
        this.CA_DEATH_LIMIT = 3;
        this.MIN_OBSTACLE_SIZE = 2;
        
        // Esteiden generointiasetukset
        this.CORNER_WEIGHT = 0.7;
        this.ORGANIC_WEIGHT = 0.6;
        
        // Kartan ruututyypit
        this.TILE_TYPES = {
            FLOOR: 0,    // Käveltyvä alusta, tornit rakennettavissa
            OBSTACLE: 1, // Este, ei käveltyvä eikä rakennettavissa
            PATH: 2      // Varmistettu polku (käytössä vain generoinnin aikana)
        };
    }
    
    /**
     * Generoi proseduraalisen kartan
     * @returns {Array} 2D-taulukko, joka edustaa kartan ruutuja
     */
    generateMap() {
        let attempts = 0;
        let map = null;
        
        // Yritä generoida kelvollinen kartta
        while (attempts < this.maxAttempts) {
            map = this.generateMapAttempt();
            if (this.isValidMap(map)) {
                return map;
            }
            attempts++;
        }
        
        // Jos ei onnistu, palauta viimeisin yritys
        console.warn("Karttagenraatio epäonnistui " + this.maxAttempts + " yrityksen jälkeen. Palautetaan viimeisin yritys.");
        return map;
    }
    
    /**
     * Yksi yritys kartan generointiin
     * @returns {Array} 2D-taulukko, joka edustaa kartan ruutuja
     */
    generateMapAttempt() {
        const map = this.initializeMap();
        this.markStartAndEndPoints(map);
        
        // Luo useita polkuja aloitus- ja lopetuspisteiden välille
        this.generateMultiplePaths(map);
        
        // Lisää esteitä Cellular Automata -algoritmilla
        this.addObstaclesWithCA(map);
        
        // Varmista, että polut ovat edelleen käytettävissä
        this.ensurePathsAreValid(map);
        
        return map;
    }
    
    /**
     * Alustaa kartan kaikki lattioina
     * @returns {Array} 2D-taulukko, joka edustaa kartan ruutuja
     */
    initializeMap() {
        const map = [];
        for (let y = 0; y < this.height; y++) {
            const row = [];
            for (let x = 0; x < this.width; x++) {
                row.push(this.TILE_TYPES.FLOOR);
            }
            map.push(row);
        }
        return map;
    }
    
    /**
     * Merkitsee aloitus- ja lopetuspisteet kartalle
     * @param {Array} map - Kartta, jota muokataan
     */
    markStartAndEndPoints(map) {
        // Merkitse aloituspisteet
        for (const point of this.startPoints) {
            if (this.isValidPosition(point.x, point.y)) {
                map[point.y][point.x] = this.TILE_TYPES.FLOOR;
                
                // Merkitse myös ympäröivät ruudut lattioina (3x3 alue)
                for (let dy = -1; dy <= 1; dy++) {
                    for (let dx = -1; dx <= 1; dx++) {
                        const nx = point.x + dx;
                        const ny = point.y + dy;
                        if (this.isValidPosition(nx, ny)) {
                            map[ny][nx] = this.TILE_TYPES.FLOOR;
                        }
                    }
                }
            }
        }
        
        // Merkitse lopetuspisteet
        for (const point of this.endPoints) {
            if (this.isValidPosition(point.x, point.y)) {
                map[point.y][point.x] = this.TILE_TYPES.FLOOR;
                
                // Merkitse myös ympäröivät ruudut lattioina (3x3 alue)
                for (let dy = -1; dy <= 1; dy++) {
                    for (let dx = -1; dx <= 1; dx++) {
                        const nx = point.x + dx;
                        const ny = point.y + dy;
                        if (this.isValidPosition(nx, ny)) {
                            map[ny][nx] = this.TILE_TYPES.FLOOR;
                        }
                    }
                }
            }
        }
    }
    
    generateMultiplePaths(map) {
        // Luo 2-3 polkua aloitus- ja lopetuspisteiden välille
        const numPaths = 2 + Math.floor(Math.random() * 2);
        
        for (let i = 0; i < numPaths; i++) {
            const startPoint = this.startPoints[Math.floor(Math.random() * this.startPoints.length)];
            const endPoint = this.endPoints[Math.floor(Math.random() * this.endPoints.length)];
            
            // Lisää satunnaista vaihtelua polkuun
            const path = this.findPathWithVariation(map, startPoint, endPoint);
            
            if (path) {
                this.markPath(map, path);
            }
        }
    }
    
    findPathWithVariation(map, start, end) {
        // Lisää satunnaisia pisteitä polun varrelle
        const numVariationPoints = 2 + Math.floor(Math.random() * 3);
        const variationPoints = [];
        
        for (let i = 0; i < numVariationPoints; i++) {
            const x = Math.floor(Math.random() * this.width);
            const y = Math.floor(Math.random() * this.height);
            variationPoints.push({x, y});
        }
        
        // Etsi polku vaiheittain läpi variaatiopisteiden
        let currentPath = this.findPath(map, start, variationPoints[0]);
        if (!currentPath) return null;
        
        for (let i = 0; i < variationPoints.length - 1; i++) {
            const nextPath = this.findPath(map, variationPoints[i], variationPoints[i + 1]);
            if (!nextPath) return null;
            currentPath = currentPath.concat(nextPath.slice(1));
        }
        
        const finalPath = this.findPath(map, variationPoints[variationPoints.length - 1], end);
        if (!finalPath) return null;
        
        return currentPath.concat(finalPath.slice(1));
    }
    
    markPath(map, path) {
        for (const point of path) {
            map[point.y][point.x] = this.TILE_TYPES.PATH;
            
            // Merkitse kapeampi polku (2x2 alue)
            for (let dy = -1; dy <= 1; dy++) {
                for (let dx = -1; dx <= 1; dx++) {
                    const nx = point.x + dx;
                    const ny = point.y + dy;
                    if (this.isValidPosition(nx, ny) && map[ny][nx] !== this.TILE_TYPES.PATH) {
                        map[ny][nx] = this.TILE_TYPES.FLOOR;
                    }
                }
            }
        }
    }
    
    addObstaclesWithCA(map) {
        // Alusta satunnaiset esteet, painottaen kulmia
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                if (map[y][x] === this.TILE_TYPES.FLOOR && !this.isNearSpecialTile(map, x, y)) {
                    // Laske etäisyys kulmiin
                    const distanceToCorners = this.getDistanceToCorners(x, y);
                    const cornerWeight = Math.max(0, 1 - distanceToCorners / 10);
                    
                    // Laske todennäköisyys esteen syntymiselle
                    const obstacleProbability = this.obstacleDensity * (1 + this.CORNER_WEIGHT * cornerWeight);
                    
                    map[y][x] = Math.random() < obstacleProbability ? 
                        this.TILE_TYPES.OBSTACLE : this.TILE_TYPES.FLOOR;
                }
            }
        }
        
        // Suodata esteet Cellular Automata -algoritmilla
        for (let i = 0; i < this.CA_ITERATIONS; i++) {
            this.applyCARules(map);
            
            // Lisää orgaanista kasvua joka toisella iteraatiolla
            if (i % 2 === 0) {
                this.applyOrganicGrowth(map);
            }
        }
        
        // Poista pienet estealueet
        this.removeSmallObstacles(map);
        
        // Lisää viimeiset orgaaniset muodot
        this.addOrganicDetails(map);
    }
    
    applyCARules(map) {
        const newMap = JSON.parse(JSON.stringify(map));
        
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                if (!this.isNearSpecialTile(map, x, y)) {
                    const neighbors = this.countNeighbors(map, x, y);
                    
                    if (map[y][x] === this.TILE_TYPES.OBSTACLE) {
                        // Este kuolee, jos naapureita on liian vähän
                        newMap[y][x] = neighbors < this.CA_DEATH_LIMIT ? 
                            this.TILE_TYPES.FLOOR : this.TILE_TYPES.OBSTACLE;
                    } else {
                        // Lattia muuttuu esteeksi, jos naapureita on tarpeeksi
                        newMap[y][x] = neighbors > this.CA_BIRTH_LIMIT ? 
                            this.TILE_TYPES.OBSTACLE : this.TILE_TYPES.FLOOR;
                    }
                }
            }
        }
        
        // Kopioi uusi kartta takaisin
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                map[y][x] = newMap[y][x];
            }
        }
    }
    
    applyOrganicGrowth(map) {
        const newMap = JSON.parse(JSON.stringify(map));
        
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                if (!this.isNearSpecialTile(map, x, y)) {
                    // Tarkista diagonaalinaapurit
                    const diagonalNeighbors = this.countDiagonalNeighbors(map, x, y);
                    
                    if (map[y][x] === this.TILE_TYPES.OBSTACLE) {
                        // Este kasvaa orgaanisesti diagonaalisesti
                        if (diagonalNeighbors >= 2 && Math.random() < this.ORGANIC_WEIGHT) {
                            // Lisää satunnaisia esteitä diagonaaliin
                            for (let dy = -1; dy <= 1; dy += 2) {
                                for (let dx = -1; dx <= 1; dx += 2) {
                                    const nx = x + dx;
                                    const ny = y + dy;
                                    if (this.isValidPosition(nx, ny) && Math.random() < 0.3) {
                                        newMap[ny][nx] = this.TILE_TYPES.OBSTACLE;
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
        
        // Kopioi uusi kartta takaisin
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                map[y][x] = newMap[y][x];
            }
        }
    }
    
    countDiagonalNeighbors(map, x, y) {
        let count = 0;
        for (let dy = -1; dy <= 1; dy += 2) {
            for (let dx = -1; dx <= 1; dx += 2) {
                const nx = x + dx;
                const ny = y + dy;
                if (this.isValidPosition(nx, ny) && map[ny][nx] === this.TILE_TYPES.OBSTACLE) {
                    count++;
                }
            }
        }
        return count;
    }
    
    addOrganicDetails(map) {
        // Lisää pieniä yksityiskohtia esteisiin
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                if (map[y][x] === this.TILE_TYPES.OBSTACLE && !this.isNearSpecialTile(map, x, y)) {
                    // Lisää satunnaisia pieniä muutoksia esteiden reunoille
                    if (Math.random() < 0.2) {
                        const directions = [
                            {x: 0, y: -1}, {x: 1, y: 0},
                            {x: 0, y: 1}, {x: -1, y: 0}
                        ];
                        
                        // Valitse satunnainen suunta
                        const dir = directions[Math.floor(Math.random() * directions.length)];
                        const nx = x + dir.x;
                        const ny = y + dir.y;
                        
                        if (this.isValidPosition(nx, ny) && map[ny][nx] === this.TILE_TYPES.FLOOR) {
                            // Lisää pieni "uloke" esteeseen
                            map[ny][nx] = this.TILE_TYPES.OBSTACLE;
                            
                            // Lisää todennäköisesti myös viereinen ruutu
                            const nextX = nx + dir.x;
                            const nextY = ny + dir.y;
                            if (this.isValidPosition(nextX, nextY) && 
                                map[nextY][nextX] === this.TILE_TYPES.FLOOR && 
                                Math.random() < 0.5) {
                                map[nextY][nextX] = this.TILE_TYPES.OBSTACLE;
                            }
                        }
                    }
                }
            }
        }
    }
    
    removeSmallObstacles(map) {
        const visited = new Set();
        
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                if (map[y][x] === this.TILE_TYPES.OBSTACLE && !visited.has(`${x},${y}`)) {
                    // Etsi kaikki yhteydessä olevat esteet
                    const obstacleGroup = this.floodFill(map, x, y, visited);
                    
                    // Jos estealue on liian pieni, poista se
                    if (obstacleGroup.length < this.MIN_OBSTACLE_SIZE) {
                        for (const point of obstacleGroup) {
                            map[point.y][point.x] = this.TILE_TYPES.FLOOR;
                        }
                    }
                }
            }
        }
    }
    
    floodFill(map, startX, startY, visited) {
        const group = [];
        const queue = [{x: startX, y: startY}];
        
        while (queue.length > 0) {
            const current = queue.shift();
            const key = `${current.x},${current.y}`;
            
            if (visited.has(key)) continue;
            visited.add(key);
            
            if (map[current.y][current.x] === this.TILE_TYPES.OBSTACLE) {
                group.push(current);
                
                // Tarkista naapurit
                const directions = [
                    {x: 0, y: -1}, {x: 1, y: 0},
                    {x: 0, y: 1}, {x: -1, y: 0}
                ];
                
                for (const dir of directions) {
                    const nx = current.x + dir.x;
                    const ny = current.y + dir.y;
                    
                    if (this.isValidPosition(nx, ny) && 
                        map[ny][nx] === this.TILE_TYPES.OBSTACLE && 
                        !visited.has(`${nx},${ny}`)) {
                        queue.push({x: nx, y: ny});
                    }
                }
            }
        }
        
        return group;
    }
    
    countNeighbors(map, x, y) {
        let count = 0;
        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                if (dx === 0 && dy === 0) continue;
                
                const nx = x + dx;
                const ny = y + dy;
                
                if (this.isValidPosition(nx, ny) && map[ny][nx] === this.TILE_TYPES.OBSTACLE) {
                    count++;
                }
            }
        }
        return count;
    }
    
    ensurePathsAreValid(map) {
        // Tarkista, että polut ovat edelleen käytettävissä
        for (const startPoint of this.startPoints) {
            for (const endPoint of this.endPoints) {
                const path = this.findPath(map, startPoint, endPoint);
                if (!path) {
                    // Jos polkua ei löydy, poista esteitä polun varrelta
                    this.clearPathObstacles(map, startPoint, endPoint);
                }
            }
        }
    }
    
    clearPathObstacles(map, start, end) {
        const path = this.findPath(map, start, end);
        if (path) {
            for (const point of path) {
                // Poista esteet polun varrelta ja sen ympäriltä
                for (let dy = -1; dy <= 1; dy++) {
                    for (let dx = -1; dx <= 1; dx++) {
                        const nx = point.x + dx;
                        const ny = point.y + dy;
                        if (this.isValidPosition(nx, ny)) {
                            map[ny][nx] = this.TILE_TYPES.FLOOR;
                        }
                    }
                }
            }
        }
    }
    
    /**
     * Tarkistaa, onko ruutu lähellä erikoispistettä (aloitus, lopetus, polku)
     * @param {Array} map - Kartta
     * @param {number} x - Ruudun x-koordinaatti
     * @param {number} y - Ruudun y-koordinaatti
     * @returns {boolean} Onko ruutu lähellä erikoispistettä
     */
    isNearSpecialTile(map, x, y) {
        // Tarkista 3x3 alue ympärillä
        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                const nx = x + dx;
                const ny = y + dy;
                
                if (this.isValidPosition(nx, ny)) {
                    // Tarkista, onko ruutu aloitus-, lopetus- tai polkupiste
                    if (map[ny][nx] === this.TILE_TYPES.PATH) {
                        return true;
                    }
                    
                    // Tarkista, onko ruutu aloituspiste
                    for (const startPoint of this.startPoints) {
                        if (nx === startPoint.x && ny === startPoint.y) {
                            return true;
                        }
                    }
                    
                    // Tarkista, onko ruutu lopetuspiste
                    for (const endPoint of this.endPoints) {
                        if (nx === endPoint.x && ny === endPoint.y) {
                            return true;
                        }
                    }
                }
            }
        }
        
        return false;
    }
    
    /**
     * Tarkistaa, onko kartta kelvollinen (varmistettu polku aloituspisteestä lopetuspisteeseen)
     * @param {Array} map - Kartta, jota tarkistetaan
     * @returns {boolean} Onko kartta kelvollinen
     */
    isValidMap(map) {
        // Tarkista jokaiselle aloituspisteelle, onko polku johonkin lopetuspisteeseen
        for (const startPoint of this.startPoints) {
            for (const endPoint of this.endPoints) {
                const path = this.findPath(map, startPoint, endPoint);
                if (path) {
                    return true;
                }
            }
        }
        
        return false;
    }
    
    /**
     * Etsii polun aloituspisteestä lopetuspisteeseen A* algoritmilla
     * @param {Array} map - Kartta
     * @param {Object} start - Aloituspiste {x, y}
     * @param {Object} end - Lopetuspiste {x, y}
     * @returns {Array} Polku pisteiden listana [{x, y}, ...] tai null, jos polkua ei löydy
     */
    findPath(map, start, end) {
        // Tarkista, että aloitus- ja lopetuspisteet ovat kelvollisia
        if (!this.isValidPosition(start.x, start.y) || !this.isValidPosition(end.x, end.y)) {
            return null;
        }
        
        // Tarkista, että aloitus- ja lopetuspisteet ovat käveltyviä
        if (map[start.y][start.x] === this.TILE_TYPES.OBSTACLE || map[end.y][end.x] === this.TILE_TYPES.OBSTACLE) {
            return null;
        }
        
        // A* algoritmi
        const openSet = [];
        const closedSet = [];
        const cameFrom = {};
        
        // Aloituspiste
        const startNode = {x: start.x, y: start.y, f: 0, g: 0, h: 0};
        openSet.push(startNode);
        
        // Jatka, kunnes avoin joukko on tyhjä
        while (openSet.length > 0) {
            // Etsi solmu, jolla on pienin f-arvo
            let currentIndex = 0;
            for (let i = 1; i < openSet.length; i++) {
                if (openSet[i].f < openSet[currentIndex].f) {
                    currentIndex = i;
                }
            }
            
            const current = openSet[currentIndex];
            
            // Tarkista, onko lopetuspiste saavutettu
            if (current.x === end.x && current.y === end.y) {
                // Palauta polku
                return this.reconstructPath(cameFrom, current);
            }
            
            // Siirrä nykyinen solmu suljettuun joukkoon
            openSet.splice(currentIndex, 1);
            closedSet.push(current);
            
            // Tarkista naapurisolmut
            const neighbors = this.getNeighbors(map, current);
            for (const neighbor of neighbors) {
                // Ohita, jos naapuri on suljetussa joukossa
                if (this.isInSet(closedSet, neighbor)) {
                    continue;
                }
                
                // Laske g-arvo (etäisyys aloituspisteestä)
                const tentativeG = current.g + 1;
                
                // Tarkista, onko naapuri avoimessa joukossa
                const neighborInOpenSet = this.isInSet(openSet, neighbor);
                
                // Jos naapuri ei ole avoimessa joukossa tai uusi polku on lyhyempi
                if (!neighborInOpenSet || tentativeG < neighbor.g) {
                    // Päivitä naapurin tiedot
                    neighbor.g = tentativeG;
                    neighbor.h = this.heuristic(neighbor, end);
                    neighbor.f = neighbor.g + neighbor.h;
                    
                    // Lisää naapuri avoimeen joukkoon, jos sitä ei siellä vielä ole
                    if (!neighborInOpenSet) {
                        openSet.push(neighbor);
                    }
                    
                    // Tallenna polku
                    cameFrom[`${neighbor.x},${neighbor.y}`] = current;
                }
            }
        }
        
        // Polkua ei löytynyt
        return null;
    }
    
    /**
     * Palauttaa polun pisteiden listana
     * @param {Object} cameFrom - Polun pisteet
     * @param {Object} current - Nykyinen piste
     * @returns {Array} Polku pisteiden listana [{x, y}, ...]
     */
    reconstructPath(cameFrom, current) {
        const path = [current];
        let currentKey = `${current.x},${current.y}`;
        
        while (cameFrom[currentKey]) {
            current = cameFrom[currentKey];
            path.unshift(current);
            currentKey = `${current.x},${current.y}`;
        }
        
        return path;
    }
    
    /**
     * Palauttaa naapurisolmut
     * @param {Array} map - Kartta
     * @param {Object} node - Nykyinen solmu
     * @returns {Array} Naapurisolmut
     */
    getNeighbors(map, node) {
        const neighbors = [];
        const directions = [
            {x: 0, y: -1}, // Ylös
            {x: 1, y: 0},  // Oikea
            {x: 0, y: 1},  // Alas
            {x: -1, y: 0}  // Vasen
        ];
        
        for (const dir of directions) {
            const x = node.x + dir.x;
            const y = node.y + dir.y;
            
            if (this.isValidPosition(x, y) && map[y][x] !== this.TILE_TYPES.OBSTACLE) {
                neighbors.push({x, y, f: 0, g: 0, h: 0});
            }
        }
        
        return neighbors;
    }
    
    /**
     * Tarkistaa, onko solmu joukossa
     * @param {Array} set - Joukko
     * @param {Object} node - Solmu
     * @returns {boolean} Onko solmu joukossa
     */
    isInSet(set, node) {
        for (const item of set) {
            if (item.x === node.x && item.y === node.y) {
                return true;
            }
        }
        return false;
    }
    
    /**
     * Laskee heuristisen arvon (Manhattan-etäisyys)
     * @param {Object} a - Piste A
     * @param {Object} b - Piste B
     * @returns {number} Heuristinen arvo
     */
    heuristic(a, b) {
        return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
    }
    
    /**
     * Tarkistaa, onko koordinaatti kartan rajojen sisällä
     * @param {number} x - X-koordinaatti
     * @param {number} y - Y-koordinaatti
     * @returns {boolean} Onko koordinaatti kartan rajojen sisällä
     */
    isValidPosition(x, y) {
        return x >= 0 && x < this.width && y >= 0 && y < this.height;
    }
    
    /**
     * Palauttaa kartan ruututyypit
     * @returns {Object} Ruututyypit
     */
    getTileTypes() {
        return this.TILE_TYPES;
    }

    getDistanceToCorners(x, y) {
        // Laske etäisyys kaikkiin kulmiin
        const corners = [
            {x: 0, y: 0},
            {x: this.width - 1, y: 0},
            {x: 0, y: this.height - 1},
            {x: this.width - 1, y: this.height - 1}
        ];
        
        // Palauta pienin etäisyys kulmiin
        return Math.min(...corners.map(corner => 
            Math.sqrt(Math.pow(x - corner.x, 2) + Math.pow(y - corner.y, 2))
        ));
    }
} 