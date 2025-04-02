/**
 * MapGenerator - Luokka proseduraalisten karttojen generointiin
 */
class MapGenerator {
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
        // Alusta kartta kaikki lattioina
        const map = this.initializeMap();
        
        // Merkitse aloitus- ja lopetuspisteet
        this.markStartAndEndPoints(map);
        
        // Luo varmistettu polku aloituspisteestä lopetuspisteeseen
        this.generateCorePath(map);
        
        // Lisää esteitä
        this.addObstacles(map);
        
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
    
    /**
     * Luo varmistettu polku aloituspisteestä lopetuspisteeseen
     * @param {Array} map - Kartta, jota muokataan
     */
    generateCorePath(map) {
        // Valitse satunnainen aloituspiste
        const startPoint = this.startPoints[Math.floor(Math.random() * this.startPoints.length)];
        
        // Valitse satunnainen lopetuspiste
        const endPoint = this.endPoints[Math.floor(Math.random() * this.endPoints.length)];
        
        // Käytä A* algoritmia polun luomiseen
        const path = this.findPath(map, startPoint, endPoint);
        
        // Merkitse polku kartalle
        if (path) {
            for (const point of path) {
                map[point.y][point.x] = this.TILE_TYPES.PATH;
                
                // Merkitse myös ympäröivät ruudut lattioina (2x2 alue)
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
    }
    
    /**
     * Lisää esteitä kartalle
     * @param {Array} map - Kartta, jota muokataan
     */
    addObstacles(map) {
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                // Ohita aloitus-, lopetus- ja polkupisteet
                if (map[y][x] === this.TILE_TYPES.FLOOR) {
                    // Tarkista, onko ruutu lähellä aloitus-, lopetus- tai polkupistettä
                    if (!this.isNearSpecialTile(map, x, y)) {
                        // Lisää este satunnaisesti
                        if (Math.random() < this.obstacleDensity) {
                            map[y][x] = this.TILE_TYPES.OBSTACLE;
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
} 