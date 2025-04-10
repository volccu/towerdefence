import { AssetLoader } from './assetLoader.js';
import { MapGenerator } from './mapGenerator.js';
import { Grid } from './grid.js';
import { Pathfinding } from './pathfinding.js';
import { Tower, Wall, ElectricFence } from './tower.js';
import { Creep } from './creep.js';

class Game {
    constructor() {
        this.initialize();
        this.setupEventListeners();
        this.lastTime = 0;
        this.startGame();
        this.aspectRatioCache = new Map(); // Add aspect ratio cache
        this.pendingUIUpdates = new Set(); // Track pending UI updates
        this.lastUIUpdate = 0;
        this.UI_UPDATE_INTERVAL = 1000 / 30; // Update UI at 30 FPS
        
        // Dialogue messages for different events
        this.dialogueMessages = {
            waveStart: [
                "Here they come...",
                "Another wave incoming!",
                "Get ready!",
                "Prepare for battle!",
                "Enemies approaching!"
            ],
            waveComplete: [
                "Wave cleared!",
                "That was close...",
                "Good job!",
                "We survived!",
                "Time to prepare for the next wave!"
            ],
            towerSelected: [
                "Tower selected.",
                "Ready to place.",
                "Choose a location.",
                "Select placement.",
                "Pick a spot."
            ],
            towerPlaced: [
                "Tower deployed!",
                "Good placement!",
                "Tower ready!",
                "Construction complete!",
                "Tower operational!"
            ],
            towerScrapped: [
                "Tower scrapped.",
                "Recycling for parts...",
                "Dismantling complete.",
                "Resources recovered.",
                "Tower removed."
            ],
            lowScraps: [
                "Need more scraps...",
                "Not enough resources...",
                "Insufficient scraps...",
                "Need to gather more...",
                "Can't afford that..."
            ],
            gameOver: [
                "We've been overrun...",
                "This is the end...",
                "Defense failed...",
                "Game over...",
                "All is lost..."
            ]
        };
    }

    // Helper function to draw images with preserved aspect ratio
    drawImageMaintainAspectRatio(img, x, y, targetWidth, targetHeight, centerX = true, centerY = false) {
        // Check cache first
        const cacheKey = `${img.src}-${targetWidth}-${targetHeight}`;
        if (this.aspectRatioCache.has(cacheKey)) {
            const cached = this.aspectRatioCache.get(cacheKey);
            const drawX = centerX ? x + (targetWidth - cached.width) / 2 : x;
            const drawY = centerY ? y + (targetHeight - cached.height) / 2 : y;
            this.ctx.drawImage(img, drawX, drawY, cached.width, cached.height);
            return cached;
        }
        
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
        
        // Cache the result
        const result = { width, height };
        this.aspectRatioCache.set(cacheKey, result);
        
        return result;
    }

    initialize() {
        // Canvas & context
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.gameContainerElement = document.getElementById('game-container'); // Get container reference

        // *** Add References to HTML Elements ***
        this.rightPanelElement = document.getElementById('right-panel');
        this.dialoguePanelElement = document.getElementById('dialogue-panel');
        this.dialogueAvatarElement = document.getElementById('dialogue-avatar');
        this.dialogueTextElement = document.getElementById('dialogue-text');
        this.craftingAreaElement = document.getElementById('crafting-area');
        this.towerButtonsContainerElement = document.getElementById('tower-buttons-container');
        this.statsAreaElement = document.getElementById('stats-area');
        this.scrapsValueElement = document.getElementById('scraps-value');
        this.waveValueElement = document.getElementById('wave-value');
        this.controlsAreaElement = document.getElementById('controls-area');
        this.nextWaveButtonElement = document.getElementById('next-wave-button'); // Ensure this is referenced
        this.scrapModeButtonElement = document.getElementById('scrap-mode-button');
        // *** End References ***
        
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
        this.assets.loadImage('button2', 'assets/button2.png');
        this.assets.loadImage('scrap', 'assets/scrap.png');
        this.assets.loadImage('miniboss', 'assets/miniboss.png');
        this.assets.loadImage('boss', 'assets/boss.png');
        this.assets.loadImage('ui_tab', 'assets/tab.png');
        this.assets.loadImage('runner', 'assets/runner.png');
        this.assets.loadImage('splitter', 'assets/splitter.png');
        this.assets.loadImage('tank', 'assets/tank.png');
        
        // Resoluution skaalaustekijä (1.5 = 50% suurempi)
        this.scaleFactor = 1.5;
        
        // Canvas size - wider to accommodate UI panels
        this.canvas.width = 700 * this.scaleFactor; // Reduced from 800 to 700
        this.canvas.height = 700 * this.scaleFactor; // Reduced from 800 to 700
        
        // Stats panel on top
        this.statsPanel = {
            x: 0,
            y: 0,
            width: 700 * this.scaleFactor,
            height: 0 // Stats panel removed
        };
        
        // Game area definition (now at top)
        this.gameArea = {
            x: 0,
            y: 0,
            width: 550 * this.scaleFactor, // Adjusted from 600
            height: 700 * this.scaleFactor
        };
        
        // UI panel on right side
        this.uiPanel = {
            x: 550 * this.scaleFactor, // Adjusted from 600
            y: 0,
            width: 150 * this.scaleFactor, // Reduced from 200 to 150
            height: 700 * this.scaleFactor // Reduced from 800 to 700
        };
        
        // Grid (small cells)
        const cellSize = 16 * this.scaleFactor; // Changed base size from 20 to 16
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
        this.scraps = 250; // Starting scraps
        this.waveReached = 0; // Track highest wave reached
        this.gameOver = false;
        this.debugMode = false; // Added for developer menu
        this.devMenuVisible = false; // Added for developer menu
        this.scrapMode = false; // Renamed from sellMode
        this.selectedTower = null; // For tower upgrades
        this.showRangeWhenPlacing = true; // Show range when placing towers
        this.buyMode = false; // Track if player has clicked on tower purchase button
        this.isContinuousBuild = false; // Track if player is holding mouse button to build continuously
        this.hoveredTowerType = -1; // Track which tower type is being hovered over
        
        // Tower comments (matching towerTypes order)
        this.towerComments = [
            "Sentry turret... reliable firepower.",
            "Bouncer... let's see how this ricochet works.",
            "RPG... time for some splash damage!",
            "Sniper... one shot, one kill... hopefully.",
            "A wall? Simple, but effective for pathing.",
            "Scrapper... generates resources automatically. Useful."
        ];
        
        // Tower types and costs
        this.towerTypes = [
            {
                name: "Sentry",
                description: "Tehokas puolustusjärjestelmä",
                cost: 60,
                damage: 10,
                range: 150 * this.scaleFactor,
                fireRate: 1.5,
                color: "#00AAFF",
                strokeColor: "#0088CC",
                burstCount: 3,
                burstDelay: 0.1
            },
            {
                name: "Bouncer",
                description: "Ammu kimpoileva ammus joka vahingoittaa useita vihollisia",
                cost: 90,
                damage: 10, // Reduced from 15
                range: 120 * this.scaleFactor, // Reduced from 150
                fireRate: 0.8,
                color: "#00AAFF",
                strokeColor: "#0088CC",
                maxBounces: 3
            },
            {
                name: "RPG",
                description: "Ammu räjähtävä ammus joka vahingoittaa kaikkia lähellä olevia vihollisia",
                cost: 120,
                damage: 35, // Increased from 25
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
                cost: 180,
                damage: 75, // Increased from 50
                range: 9999 * this.scaleFactor, // Käytännössä ääretön kantama
                fireRate: 0.2,
                color: "#800080",
                strokeColor: "#4B0082"
            },
            {
                name: "Wall",
                description: "Ohjaa viholliset haluamaasi reittiä",
                cost: 8,
                damage: 0,
                range: 0,
                fireRate: 0,
                color: "#8B4513",
                strokeColor: "#5D2906"
            },
            {
                name: "ElectricFence",
                description: "Sähköaita joka vahingoittaa lähellä olevia vihollisia. Vahingoittaa kaikkia vihollisia yhden ruudun etäisyydellä.",
                cost: 25,
                damage: 2,
                range: 40 * this.scaleFactor,
                fireRate: 2,
                color: "#4169E1",
                strokeColor: "#0000CD",
                isElectricFence: true
            },
            {
                name: "Scrapper",
                description: "Kerää ja prosessoi romua automaattisesti",
                cost: 150,
                damage: 0,
                range: 0,
                fireRate: 0,
                color: "#FFD700",
                strokeColor: "#B8860B",
                isScrapper: true,
                scrapRate: 1,
                scrapInterval: 8000 // 8 seconds
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
            x: this.uiPanel.x + 10 * this.scaleFactor,
            y: this.uiPanel.y + 650 * this.scaleFactor, // Moved further down below all tower buttons
            width: 85 * this.scaleFactor,
            height: 40 * this.scaleFactor,
            text: "NEXT WAVE"
        };
        
        this.scrapModeButton = {
            x: this.uiPanel.x + 105 * this.scaleFactor,
            y: this.uiPanel.y + 650 * this.scaleFactor, // Moved further down below all tower buttons
            width: 85 * this.scaleFactor,
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
                width: 60 * this.scaleFactor,
                height: 30 * this.scaleFactor,
                text: "DMG +30%",
                cost: 50
            },
            fireRate: {
                x: this.uiPanel.x + 80 * this.scaleFactor,
                y: 500 * this.scaleFactor,
                width: 60 * this.scaleFactor,
                height: 30 * this.scaleFactor,
                text: "RATE +20%",
                cost: 50
            },
            range: { // Add range upgrade definition
                x: this.uiPanel.x + 140 * this.scaleFactor, // Adjust X if needed
                y: 500 * this.scaleFactor,
                width: 60 * this.scaleFactor,
                height: 30 * this.scaleFactor,
                text: "RANGE +25%", // Define text
                cost: 50 // Define cost
            }
        };
        
        // Tower tooltip for upgrades
        this.towerTooltip = {
            width: 200 * this.scaleFactor,
            height: 150 * this.scaleFactor,
            padding: 8 * this.scaleFactor,
            visible: false,
            x: 0,
            y: 0,
            buttons: {
                damage: {
                    width: 60 * this.scaleFactor,
                    height: 25 * this.scaleFactor,
                    text: "DMG +30%",
                    cost: 50
                },
                fireRate: {
                    width: 60 * this.scaleFactor,
                    height: 25 * this.scaleFactor,
                    text: "RATE +20%",
                    cost: 50
                },
                range: { // Add range button definition HERE
                    width: 60 * this.scaleFactor,
                    height: 25 * this.scaleFactor
                    // No text or cost needed here
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

        // Tallennetaan UI-paneelin taustakuvio tänne
        this.uiPanelPattern = null;

        // Aseta canvasin kursoriksi oletusarvoisesti nuoli
        this.canvas.style.cursor = 'default';

        // Muuttuja kirjoitusanimaation intervallille
        this.typingInterval = null;
        // Muuttuja dialogin poiston ajastimelle
        this.dialogueClearTimeout = null;

        this.populateCraftingMenu(); // *** Call to populate HTML menu ***
        this.resizeCanvas(); // Call initial resize
        window.addEventListener('resize', () => this.resizeCanvas()); // Add resize listener
    }

    resizeCanvas() {
        // Define desired aspect ratios and widths
        const desiredGameWidth = 550; // Width of the core game area
        const desiredGameHeight = 700; // Height of the core game area
        const desiredUiWidth = 300; // Fixed width for the HTML UI panel (from CSS)
        
        // Calculate the total aspect ratio needed by the container
        const totalDesiredWidth = desiredGameWidth + desiredUiWidth;
        const totalDesiredHeight = desiredGameHeight; 
        const containerAspectRatio = totalDesiredWidth / totalDesiredHeight;

        // Get available space (e.g., 90% of viewport)
        let availableWidth = window.innerWidth * 0.9;
        let availableHeight = window.innerHeight * 0.9;

        // Calculate container size maintaining aspect ratio
        let containerWidth, containerHeight;
        if (availableWidth / availableHeight > containerAspectRatio) {
            // Limited by height
            containerHeight = availableHeight;
            containerWidth = availableHeight * containerAspectRatio;
        } else {
            // Limited by width
            containerWidth = availableWidth;
            containerHeight = availableWidth / containerAspectRatio;
        }

        // Apply dimensions to the main container div
        this.gameContainerElement.style.width = `${containerWidth}px`;
        this.gameContainerElement.style.height = `${containerHeight}px`;

        // Calculate the actual canvas dimensions based on the container size and desired game width proportion
        const actualCanvasWidth = containerWidth * (desiredGameWidth / totalDesiredWidth);
        const actualCanvasHeight = containerHeight; // Canvas height matches container height
        
        // Set the canvas drawing surface size
        this.canvas.width = actualCanvasWidth;
        this.canvas.height = actualCanvasHeight;

        // Define gameArea to match the canvas exactly
        this.gameArea.x = 0;
        this.gameArea.y = 0;
        this.gameArea.width = this.canvas.width;
        this.gameArea.height = this.canvas.height;

        // UI Panel object in JS might be less relevant now, but keep for reference if needed
        this.uiPanel.width = desiredUiWidth; // Use the fixed CSS width
        this.uiPanel.height = actualCanvasHeight;
        this.uiPanel.x = actualCanvasWidth; // Starts after the canvas
        this.uiPanel.y = 0;

        // Calculate scaleFactor based on the actual game area width vs desired game width
        this.scaleFactor = actualCanvasWidth / desiredGameWidth;
        
        // Re-initialize grid with new dimensions
        const cellSize = 16 * this.scaleFactor; 
        const cols = Math.floor(this.gameArea.width / cellSize);
        const rows = Math.floor(this.gameArea.height / cellSize);
        // Regenerate map data based on potentially new cols/rows?
        // this.mapData = this.mapGenerator.regenerateMap(cols, rows); // Assumes MapGenerator has regenerate
        this.grid = new Grid(cols, rows, cellSize, this.gameArea.x, this.mapData); // Use existing map data for now
        this.grid.game = this;
        this.pathfinding = new Pathfinding(this.grid); // Recreate pathfinding with new grid

        // Update spawn/home point absolute positions (relative to gameArea)
        this.spawnPoint.x = this.gameArea.x + this.gameArea.width * 0.5; // Example: Center top
        this.spawnPoint.y = this.gameArea.y + 40 * this.scaleFactor; 
        this.homePoint.x = this.gameArea.x + this.gameArea.width * 0.5; // Example: Center bottom
        this.homePoint.y = this.gameArea.y + this.gameArea.height - 60 * this.scaleFactor; 
        this.spawnPoint.radius = 20 * this.scaleFactor;
        this.homePoint.radius = 20 * this.scaleFactor;

        // Update positions/sizes of any remaining canvas elements (like tooltip buttons, game over button)
        // Tooltip button sizes
        this.towerTooltip.width = 200 * this.scaleFactor;
        this.towerTooltip.height = 150 * this.scaleFactor;
        this.towerTooltip.padding = 8 * this.scaleFactor;
        if(this.towerTooltip.buttons.damage) {
           this.towerTooltip.buttons.damage.width = 60 * this.scaleFactor;
           this.towerTooltip.buttons.damage.height = 25 * this.scaleFactor;
        }
         if(this.towerTooltip.buttons.fireRate) {
           this.towerTooltip.buttons.fireRate.width = 60 * this.scaleFactor;
           this.towerTooltip.buttons.fireRate.height = 25 * this.scaleFactor;
        }
        // Add range if it exists
        if (this.towerTooltip.buttons.range) {
             this.towerTooltip.buttons.range.width = 60 * this.scaleFactor;
             this.towerTooltip.buttons.range.height = 25 * this.scaleFactor;
         }

        // Game Over Restart Button Position (center of canvas)
        this.restartButton.width = 120 * this.scaleFactor;
        this.restartButton.height = 40 * this.scaleFactor;
        this.restartButton.x = this.canvas.width / 2 - this.restartButton.width / 2;
        this.restartButton.y = this.canvas.height / 2 + 50 * this.scaleFactor; // Below GAME OVER text

        // Recalculate paths for existing creeps (important after grid change)
        // The new Pathfinding instance will use the new grid automatically
        // this.pathfinding.notifyGridChange(); // REMOVED - Method doesn't exist
    }

    // *** New Method to Populate Crafting Buttons ***
    populateCraftingMenu() {
        if (!this.towerButtonsContainerElement || !this.assets) return;
        this.towerButtonsContainerElement.innerHTML = ''; // Clear existing buttons

        this.towerTypes.forEach((tower, index) => {
            const button = document.createElement('button');
            button.classList.add('crafting-button');
            button.dataset.towerIndex = index; // Store index for listener

            // Sprite Div
            const spriteDiv = document.createElement('div');
            spriteDiv.classList.add('tower-sprite');
            
            // *** Determine sprite key based on tower name override ***
            let spriteKey;
            const name = tower.name.toLowerCase();
            if (['sentry', 'bouncer', 'rpg', 'sniper'].includes(name)) {
                spriteKey = 'tower'; 
            } else if (name === 'electricfence') {
                spriteKey = 'wall';
            } else {
                spriteKey = tower.assetKey || name; // Default: use assetKey or lowercase name
            }
            // *** End override ***
            
            let spriteSrc = `assets/${spriteKey}.png`; // Construct path directly
            
            // Check if asset is loaded before setting background
            if (this.assets.getImage(spriteKey)) { 
                 spriteDiv.style.backgroundImage = `url('${spriteSrc}')`;
            } else {
                 console.warn(`Sprite image not loaded or key mismatch for: ${spriteKey} (Tower: ${tower.name})`);
                 spriteDiv.style.backgroundColor = '#555'; // Placeholder background
            }
           
            // Info Div
            const infoDiv = document.createElement('div');
            infoDiv.classList.add('tower-info');

            // Tower Name Span
            const nameSpan = document.createElement('span');
            nameSpan.classList.add('tower-name');
            nameSpan.textContent = tower.name;

            // Tower Cost Span
            const costSpan = document.createElement('span');
            costSpan.classList.add('tower-cost');
            const costText = document.createTextNode(`${tower.cost}`);
             // Scrap Icon Img
             const scrapIcon = document.createElement('img');
             let scrapIconSrc = 'assets/scrap.png'; // Construct path directly
             
             // Check if scrap icon asset is loaded
             if(this.assets.getImage('scrap')){
                scrapIcon.src = scrapIconSrc;
                scrapIcon.alt = 'Scrap';
                costSpan.appendChild(scrapIcon); // Add icon before text
             } else {
                 console.warn("Scrap icon image not loaded");
             }
            costSpan.appendChild(costText); // Add cost text after icon

            // Append spans to infoDiv
            infoDiv.appendChild(nameSpan);
            infoDiv.appendChild(costSpan);

            // Append sprite and info to button
            button.appendChild(spriteDiv);
            button.appendChild(infoDiv);

            // Append button to container
            this.towerButtonsContainerElement.appendChild(button);
        });
    }
    // *** End populateCraftingMenu ***

    // *** New Method to Update Crafting Button States ***
    updateCraftingButtonStates() {
        if (!this.towerButtonsContainerElement) return;
        const buttons = this.towerButtonsContainerElement.querySelectorAll('.crafting-button');
        
        buttons.forEach((button) => {
            const index = parseInt(button.dataset.towerIndex);
            const tower = this.towerTypes[index];

            // Update disabled state
            if (this.scraps < tower.cost) {
                button.classList.add('disabled');
                button.disabled = true; // Also set disabled property
            } else {
                button.classList.remove('disabled');
                button.disabled = false;
            }

            // Update selected state
            if (this.buyMode && this.selectedTowerType === index) {
                button.classList.add('selected');
            } else {
                button.classList.remove('selected');
            }
        });
    }
     // *** End updateCraftingButtonStates ***

    // Lisätään funktio dialogin päivittämiseen
    updateDialogue(newText) {
        if (this.dialogueTextElement) {
            // Clear any existing animation
            if (this.typingInterval) {
                clearInterval(this.typingInterval);
                this.typingInterval = null;
            }
            if (this.dialogueClearTimeout) {
                clearTimeout(this.dialogueClearTimeout);
                this.dialogueClearTimeout = null;
            }

            // Clear the text element
            this.dialogueTextElement.textContent = '';

            // Start new typing animation
            let charIndex = 0;
            const typingSpeed = 40; // milliseconds per character

            this.typingInterval = setInterval(() => {
                if (charIndex < newText.length) {
                    this.dialogueTextElement.textContent += newText.charAt(charIndex);
                    charIndex++;
                } else {
                    clearInterval(this.typingInterval);
                    this.typingInterval = null; // Nollaa intervalli, kun valmis

                    // Aseta ajastin tekstin poistamiselle
                    const clearDelay = 5000; // 5 sekuntia (säädä tarvittaessa)
                    this.dialogueClearTimeout = setTimeout(() => {
                        // Poista teksti vain, jos mikään torni ei ole valittuna
                        // eikä olla ostotilassa
                        if (!this.selectedTower && !this.buyMode) {
                             this.dialogueTextElement.textContent = '';
                        }
                        this.dialogueClearTimeout = null; // Nollaa ajastinmuuttuja
                    }, clearDelay);
                }
            }, typingSpeed);

        } else {
            console.error("Dialogue text element not found!");
        }
    }

    setupEventListeners() {
        // *** Add listener for the HTML Next Wave button ***
        if (this.nextWaveButtonElement) {
            this.nextWaveButtonElement.addEventListener('click', () => {
                // Only start wave if button is not disabled (which mirrors !this.waveActive)
                if (!this.nextWaveButtonElement.disabled) {
                    this.startNextWave();
                }
            });
        }
        // *** End Next Wave Listener ***

        // *** Add listener for the HTML Scrap Mode button ***
        if (this.scrapModeButtonElement) {
            this.scrapModeButtonElement.addEventListener('click', () => {
                this.scrapMode = !this.scrapMode; 
                // Update the game state when scrap mode is toggled via HTML button
                this.selectedTower = null; 
                this.buyMode = false; 
                // The active class is handled in the update loop
                console.log(`Scrap mode toggled via HTML: ${this.scrapMode}`);
            });
        }
        // *** End Scrap Mode Listener ***

        // *** Add listener for the Crafting Button Container (Event Delegation) ***
        if (this.towerButtonsContainerElement) {
            this.towerButtonsContainerElement.addEventListener('click', (event) => {
                const button = event.target.closest('.crafting-button');
                if (button && !button.disabled) { // Check if a non-disabled button was clicked
                    const index = parseInt(button.dataset.towerIndex);
                    if (!isNaN(index) && index >= 0 && index < this.towerTypes.length) {
                        this.selectedTowerType = index;
                        this.buyMode = true;
                        this.scrapMode = false;
                        this.updateDialogue(this.towerComments[index] || "Selected item...");
                        this.updateCraftingButtonStates(); // Update visual selection immediately
                        console.log(`Selected tower type via HTML: ${this.towerTypes[index].name}`);
                    }
                }
            });
        }
        // *** End Crafting Container Listener ***

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
            
            // Check dev menu buttons if visible
            if (this.devMenuVisible) {
                // Define Kill All button rect here or reference from a central place
                const killAllButtonRect = {
                    x: this.gameArea.x + 10 * this.scaleFactor, 
                    y: this.gameArea.y + 50 * this.scaleFactor, 
                    width: 150 * this.scaleFactor, 
                    height: 30 * this.scaleFactor
                };
                if (this.isPointInRect(x, y, killAllButtonRect)) {
                    this.killAllCreeps();
                    return; // Prevent other actions if dev menu button is clicked
                }
                // Add checks for other future dev buttons here
                const forceWaveButtonRect = {
                     x: this.gameArea.x + 10 * this.scaleFactor, 
                     y: this.gameArea.y + 90 * this.scaleFactor, // Position below kill button
                     width: 150 * this.scaleFactor, 
                     height: 30 * this.scaleFactor
                 };
                 if (this.isPointInRect(x, y, forceWaveButtonRect)) {
                     this.startNextWave(); // Force start next wave
                     console.log("Forcing next wave via dev menu.");
                     return;
                 }
                
                // Prevent clicks passing through the dev menu background
                const devMenuRect = {
                    x: this.gameArea.x + 5 * this.scaleFactor,
                    y: this.gameArea.y + 5 * this.scaleFactor,
                    width: 200 * this.scaleFactor,
                    height: 200 * this.scaleFactor // Adjusted height for new button
                };
                if (this.isPointInRect(x, y, devMenuRect)) {
                    return; // Stop processing click if inside dev menu area but not on a button
                }
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
                // If clicked outside game area, deselect tower and clear dialogue
                this.selectedTower = null;
                // Peruuta mahdollinen poistoajastin ja tyhjennä dialogi
                if (this.dialogueClearTimeout) {
                    clearTimeout(this.dialogueClearTimeout);
                    this.dialogueClearTimeout = null;
                }
                if(this.dialogueTextElement) {
                    this.dialogueTextElement.textContent = '';
                }
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
                const towerButtons = this.towerButtonsContainerElement.querySelectorAll('.crafting-button');
                let hoveredTowerIndex = -1;
                
                towerButtons.forEach((button, index) => {
                    const buttonRect = button.getBoundingClientRect();
                    if (mouseX >= buttonRect.left - rect.left && 
                        mouseX <= buttonRect.right - rect.left && 
                        mouseY >= buttonRect.top - rect.top && 
                        mouseY <= buttonRect.bottom - rect.top) {
                        hoveredTowerIndex = index;
                    }
                });
                
                if (hoveredTowerIndex !== -1) {
                    document.body.style.cursor = 'pointer';
                    isOverButton = true;
                    this.hoveredTowerType = hoveredTowerIndex;
                    
                    // Show tower comment and stats in dialogue
                    const tower = this.towerTypes[hoveredTowerIndex];
                    let statsText = '';
                    
                    if (tower.name === "Sentry") {
                        statsText = `Damage: ${tower.damage}\nRange: ${tower.range}\nSpeed: ${tower.fireRate}/sec`;
                    } else if (tower.name === "Bouncer") {
                        statsText = `Damage: ${tower.damage}\nRange: ${tower.range}\nBounces: ${tower.maxBounces}\nSpeed: ${tower.fireRate}/sec`;
                    } else if (tower.name === "RPG") {
                        statsText = `Direct Hit: ${tower.damage}\nRange: ${tower.range}\nBlast Damage: ${tower.explosionDamage}\nBlast Radius: ${tower.explosionRadius}`;
                    } else if (tower.name === "Sniper") {
                        statsText = `Damage: ${tower.damage}\nRange: Unlimited\nSpeed: ${tower.fireRate}/sec`;
                    } else if (tower.name === "Wall") {
                        statsText = `Durability: High\nFunction: Blocks enemy path`;
                    } else if (tower.name === "ElectricFence") {
                        statsText = `Damage: ${tower.damage}\nRange: ${tower.range}\nSpeed: ${tower.fireRate}/sec`;
                    } else if (tower.name === "Scrapper") {
                        statsText = `Generation: +${tower.scrapRate} scrap\nInterval: ${tower.scrapInterval/1000} seconds\nRequires: Active wave`;
                    }
                    
                    // Combine comment and stats
                    const fullText = `<span class="comment">${this.towerComments[hoveredTowerIndex] || "Selected item..."}</span>${statsText}`;
                    
                    // Update dialogue text
                    if (this.dialogueTextElement) {
                        this.dialogueTextElement.innerHTML = fullText;
                    }
                } else {
                    // If not hovering over any tower button, show default text
                    if (this.hoveredTowerType !== -1) {
                        this.hoveredTowerType = -1;
                        if (this.dialogueTextElement) {
                            this.updateDialogue("Status: OK");
                        }
                    }
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
            
            // Exit buy mode and scrap mode
            this.buyMode = false;
            this.scrapMode = false;
            this.scrapModeButton.active = false;
            // Peruuta poistoajastin ja tyhjennä dialogi
            if (this.dialogueClearTimeout) {
                clearTimeout(this.dialogueClearTimeout);
                this.dialogueClearTimeout = null;
            }
            if (this.dialogueTextElement) {
                this.dialogueTextElement.textContent = '';
            }
            return false;
        });

        // Debug mode toggle (d key) and Esc to exit buy mode
        window.addEventListener('keydown', (event) => {
            // Toggle dev menu on 'd' key
            if (event.key === 'd') {
                this.debugMode = !this.debugMode;
                this.devMenuVisible = !this.devMenuVisible;
            }
            
            // Exit buy mode and scrap mode on Escape key
            if (event.key === 'Escape') {
                this.buyMode = false;
                this.scrapMode = false;
                this.scrapModeButton.active = false;
                // Peruuta poistoajastin ja tyhjennä dialogi
                if (this.dialogueClearTimeout) {
                    clearTimeout(this.dialogueClearTimeout);
                    this.dialogueClearTimeout = null;
                }
                if (this.dialogueTextElement) {
                    this.dialogueTextElement.textContent = '';
                }
            }
        });

        // Add hover event listeners for crafting buttons
        if (this.towerButtonsContainerElement) {
            const towerButtons = this.towerButtonsContainerElement.querySelectorAll('.crafting-button');
            
            towerButtons.forEach((button, index) => {
                // Mouse enter event
                button.addEventListener('mouseenter', () => {
                    const tower = this.towerTypes[index];
                    let statsText = '';
                    
                    if (tower.name === "Sentry") {
                        statsText = `Damage: ${tower.damage}\nRange: ${tower.range}\nSpeed: ${tower.fireRate}/sec`;
                    } else if (tower.name === "Bouncer") {
                        statsText = `Damage: ${tower.damage}\nRange: ${tower.range}\nBounces: ${tower.maxBounces}\nSpeed: ${tower.fireRate}/sec`;
                    } else if (tower.name === "RPG") {
                        statsText = `Direct Hit: ${tower.damage}\nRange: ${tower.range}\nBlast Damage: ${tower.explosionDamage}\nBlast Radius: ${tower.explosionRadius}`;
                    } else if (tower.name === "Sniper") {
                        statsText = `Damage: ${tower.damage}\nRange: Unlimited\nSpeed: ${tower.fireRate}/sec`;
                    } else if (tower.name === "Wall") {
                        statsText = `Durability: High\nFunction: Blocks enemy path`;
                    } else if (tower.name === "ElectricFence") {
                        statsText = `Damage: ${tower.damage}\nRange: ${tower.range}\nSpeed: ${tower.fireRate}/sec`;
                    } else if (tower.name === "Scrapper") {
                        statsText = `Generation: +${tower.scrapRate} scrap\nInterval: ${tower.scrapInterval/1000} seconds\nRequires: Active wave`;
                    }
                    
                    // Update dialogue text with just the stats
                    if (this.dialogueTextElement) {
                        this.dialogueTextElement.innerHTML = `<span class="stats">${statsText}</span>`;
                    }
                });
                
                // Mouse leave event
                button.addEventListener('mouseleave', () => {
                    if (this.dialogueTextElement) {
                        this.dialogueTextElement.innerHTML = '';
                    }
                });
            });
        }
    }

    restartGame() {
        // Reset game state
        this.gameOver = false;
        this.playerLives = 10;
        this.scraps = 250; // 250 scraps
        this.towers = [];
        this.creeps = [];
        this.waveNumber = 0;
        this.creepsToSpawn = 0;
        this.waveActive = false;
        this.scrapMode = false;
        this.selectedTower = null;
        this.selectedTowerType = 0;
        
        // Reset grid
        const cellSize = 16 * this.scaleFactor; // Changed base size from 20 to 16
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
            this.showRandomDialogue('lowScraps');
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
        } else if (towerType.name === "ElectricFence") {
            // Check if the single cell is occupied or is an obstacle
            if (this.grid.isCellOccupied(gridX, gridY)) {
                canPlace = false;
            }

            // Don't place electric fences too close to spawn/home
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
        } else if (towerType.name === "ElectricFence") {
            tower = new ElectricFence(this, gridX, gridY, towerType);
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
        
        this.showRandomDialogue('towerPlaced');
        
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
            this.showRandomDialogue('towerScrapped');
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
        
        // Show wave start message
        this.showRandomDialogue('waveStart');
        
        // Generoi uniikki aalto
        this.generateWave();
        
        this.lastSpawnTime = 0;
        this.waveActive = true;
    }

    generateWave() {
        // Perusarvot aallon vaikeudelle (käytetään aalloille > 20)
        const baseDifficulty = 1 + (this.waveNumber * 0.1);
        
        this.waveCreeps = []; // Initialize empty creep list for the wave
        
        // Helper function to create an array of creep objects
        const createCreeps = (type, count) => Array(count).fill({ type: type });
        
        // Specific wave compositions for waves 1-20
        switch (this.waveNumber) {
            case 1:
                this.waveCreeps = createCreeps('normal', 7); // 6-8 normal
                break;
            case 2:
                this.waveCreeps = createCreeps('normal', 11); // 10-12 normal
                break;
            case 3:
                this.waveCreeps = [
                    ...createCreeps('normal', 4),
                    ...createCreeps('fast', 6)
                ]; // 4 normal + 6 fast
                // Simple shuffle
                this.waveCreeps.sort(() => Math.random() - 0.5);
                break;
            case 4:
                this.waveCreeps = createCreeps('fast', 14); // 12-15 fast
                break;
            case 5:
                // Mini-boss mid-wave
                this.waveCreeps = [
                    ...createCreeps('normal', 4),
                    { type: 'miniBoss' },
                    ...createCreeps('normal', 4)
                ]; // 1 miniBoss + 8 normal
                break;
            case 6:
                this.waveCreeps = createCreeps('tank', 6); // 5-7 tank
                break;
            case 7:
                this.waveCreeps = [
                    ...createCreeps('normal', 10),
                    ...createCreeps('fast', 6),
                    ...createCreeps('tank', 3)
                ]; // 10 normal + 6 fast + 3 tank
                // Simple shuffle
                this.waveCreeps.sort(() => Math.random() - 0.5);
                break;
            case 8:
                this.waveCreeps = createCreeps('tank', 9); // 8-10 tank
                break;
            case 9:
                this.waveCreeps = createCreeps('normal', 23); // 20-25 normal
                break;
            case 10:
                this.waveCreeps = createCreeps('boss', 1); // 1 boss
                break;
            case 11:
                this.waveCreeps = createCreeps('splitter', 5); // 4-6 splitter
                break;
            case 12:
                // Arriving in pairs/triplets - just create the total count for now
                this.waveCreeps = createCreeps('splitter', 9); // 8-10 splitter
                break;
            case 13:
                 // Alternating groups - simple shuffle for now
                this.waveCreeps = [
                    ...createCreeps('fast', 10),
                    ...createCreeps('tank', 8)
                ]; // 10 fast + 8 tank
                this.waveCreeps.sort(() => Math.random() - 0.5);
                break;
            case 14:
                this.waveCreeps = [
                    ...createCreeps('normal', 15),
                    ...createCreeps('fast', 8),
                    ...createCreeps('tank', 5),
                    ...createCreeps('splitter', 3)
                ]; // 15 normal + 8 fast + 5 tank + 3 splitter
                this.waveCreeps.sort(() => Math.random() - 0.5);
                break;
             case 15:
                 // Staggered arrival - place tanks around minibosses
                 this.waveCreeps = [
                     ...createCreeps('tank', 3),
                     { type: 'miniBoss' },
                     ...createCreeps('tank', 3),
                     { type: 'miniBoss' }
                 ]; // 2 miniBoss + 6 tank
                 break;
            case 16:
                this.waveCreeps = createCreeps('fast', 33); // 30-35 fast
                break;
            case 17:
                // Tank vanguard
                this.waveCreeps = [
                    ...createCreeps('tank', 10),
                    ...createCreeps('splitter', 8)
                ]; // 10 tank + 8 splitter
                break;
            case 18:
                 // Mixed groups, arriving quickly - simple shuffle for now
                this.waveCreeps = [
                    ...createCreeps('fast', 15),
                    ...createCreeps('splitter', 10)
                ]; // 15 fast + 10 splitter
                this.waveCreeps.sort(() => Math.random() - 0.5);
                break;
            case 19:
                 // Long mixed stream - adjust counts slightly
                this.waveCreeps = [
                    ...createCreeps('normal', 15), // Fewer normal
                    ...createCreeps('fast', 12), // Fewer fast
                    ...createCreeps('tank', 4), // Fewer tanks
                    ...createCreeps('splitter', 7) // More splitters
                ]; // 38 total mixed creeps (35-40 range)
                this.waveCreeps.sort(() => Math.random() - 0.5);
                break;
            case 20:
                // Let's stick with 1 Boss for wave 20 as planned initially
                this.waveCreeps = createCreeps('boss', 1);
                break;
                
            default:
                // Default logic for waves > 20 (similar to original)
                // Boss aallot every 10 waves
                if (this.waveNumber % 10 === 0) {
                    this.creepsToSpawn = 1 + Math.floor(this.waveNumber / 20); // More bosses later
                    this.waveCreeps = createCreeps('boss', this.creepsToSpawn);
                    return; // Exit after setting boss wave
                }
                
                // Mini-boss aallot every 5 waves (excluding boss waves)
                if (this.waveNumber % 5 === 0) {
                    this.creepsToSpawn = 3 + Math.floor(this.waveNumber / 10); // More mini-bosses later
                    this.waveCreeps = createCreeps('miniBoss', this.creepsToSpawn);
                    return; // Exit after setting mini-boss wave
                }
                
                // Normaalit aallot (waves > 20)
                const creepTypes = ['normal', 'fast', 'tank', 'splitter'];
                const creepCount = Math.floor(10 + this.waveNumber * 1.8); // Increased scaling past wave 20
                
                // Luo satunnainen aalto
                for (let i = 0; i < creepCount; i++) {
                    // Valitse creep-tyyppi painotetulla todennäköisyydellä
                    let type;
                    const rand = Math.random();
                    
                    // Adjust probabilities slightly for later waves
                    if (rand < 0.3) { // Less normal
                        type = 'normal';
                    } else if (rand < 0.55) { // More fast
                        type = 'fast';
                    } else if (rand < 0.8) { // More tank
                        type = 'tank';
                    } else { // More splitter
                        type = 'splitter';
                    }
                    
                    this.waveCreeps.push({ type });
                }
                break;
        }
        
        // Set the total number of creeps to spawn for this wave
        this.creepsToSpawn = this.waveCreeps.length;
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
        
        // Hae seuraava creep aallon listasta
        const creepType = this.waveCreeps[this.waveCreeps.length - this.creepsToSpawn];
        
        // Create new creep with appropriate parameters
        const creep = new Creep(
            this,
            x,
            y,
            health,
            speed,
            '#FF5500', // Väri asetetaan Creep-luokassa
            radius,
            creepType.type === 'boss',
            creepType.type === 'miniBoss',
            creepType.type,
            creepType.type === 'splitter' // Asetetaan willSplit true splitterille
        );
        
        this.creeps.push(creep);
        this.creepsToSpawn--;
    }

    update(currentTime) {
        // Batch UI updates to reduce DOM operations
        if (currentTime - this.lastUIUpdate >= this.UI_UPDATE_INTERVAL) {
            this.updateUI();
            this.lastUIUpdate = currentTime;
        }

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
        
        // Process creeps in reverse order for safe removal
        for (let i = this.creeps.length - 1; i >= 0; i--) {
            const creep = this.creeps[i];
            creep.update();
            
            if (!creep.isAlive) {
                if (creep.reachedEnd) {
                    this.playerLives--;
                    this.damageFlash.active = true;
                    this.damageFlash.duration = this.damageFlash.maxDuration;
                    this.damageFlash.showHealthBar = true;
                    
                    // Add floating text for damage
                    this.addFloatingText(
                        this.homePoint.x,
                        this.homePoint.y,
                        "-1 Life",
                        "#FF0000"
                    );
                    
                    // Keep the creep around for one more frame to be drawn
                    creep.isAlive = true;
                    creep.reachedEnd = false;
                    setTimeout(() => {
                        creep.isAlive = false;
                        creep.reachedEnd = true;
                        const index = this.creeps.indexOf(creep);
                        if (index !== -1) {
                            this.creeps.splice(index, 1);
                        }
                    }, 16); // Wait one frame (assuming 60fps)
                } else {
                    const reward = 5 + Math.floor(this.waveNumber * 0.8);
                    this.scraps += reward;
                    // Add floating text with scrap icon
                    this.addFloatingText(
                        creep.x + this.gameArea.x,
                        creep.y,
                        `+${reward} scrap`,
                        "#FFD700",
                        true
                    );
                    this.creeps.splice(i, 1);
                }
            }
        }
        
        // Check wave completion
        if (this.waveActive && this.creepsToSpawn <= 0 && this.creeps.length === 0) {
            this.waveActive = false;
            const waveBonus = 10 + this.waveNumber * 5;
            this.scraps += waveBonus;
            this.showRandomDialogue('waveComplete');
        }
        
        // Check game over
        if (this.playerLives <= 0) {
            this.gameOver = true;
        }
        
        // Spawn new creeps if needed
        if (this.waveActive && currentTime - this.lastSpawnTime >= this.spawnInterval && this.creepsToSpawn > 0) {
            this.spawnCreep();
            this.lastSpawnTime = currentTime;
        }
        
        // Update damage flash effect
        if (this.damageFlash.active) {
            this.damageFlash.duration--;
            this.damageFlash.healthBarAlpha = this.damageFlash.duration > 30 ? 1.0 : this.damageFlash.duration / 30;
            if (this.damageFlash.duration <= 0) {
                this.damageFlash.active = false;
                this.damageFlash.showHealthBar = false;
                this.damageFlash.healthBarAlpha = 1.0;
            }
        }
        
        // Update floating texts
        for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
            const text = this.floatingTexts[i];
            text.y -= 1;
            text.life -= 1;
            text.alpha = text.life / 60;
            if (text.life <= 0) {
                this.floatingTexts.splice(i, 1);
            }
        }
    }

    updateUI() {
        // Update HTML elements in batch
        if (this.nextWaveButtonElement) {
            this.nextWaveButtonElement.disabled = this.waveActive;
        }
        
        if (this.scrapsValueElement) {
            this.scrapsValueElement.textContent = this.scraps;
        }
        
        if (this.waveValueElement) {
            this.waveValueElement.textContent = this.waveNumber;
        }

        if (this.scrapModeButtonElement) {
            if (this.scrapMode) {
                this.scrapModeButtonElement.classList.add('active');
            } else {
                this.scrapModeButtonElement.classList.remove('active');
            }
        }
        
        this.updateCraftingButtonStates();
    }

    draw() {
        if (!this.assets.isReady()) {
            this.drawLoadingScreen();
            return;
        }
        
        // Clear only the game area instead of the entire canvas
        this.ctx.clearRect(this.gameArea.x, this.gameArea.y, this.gameArea.width, this.gameArea.height);
        
        // Draw game background
        this.ctx.fillStyle = '#0f0f0f';
        this.ctx.fillRect(this.gameArea.x, this.gameArea.y, this.gameArea.width, this.gameArea.height);
        
        // Draw grid
        this.grid.draw(this.ctx);
        
        // Draw spawn and home points
        this.drawSpawnAndHomePoints();
        
        // Apply clip to game area
        this.ctx.save();
        this.ctx.beginPath();
        this.ctx.rect(this.gameArea.x, this.gameArea.y, this.gameArea.width, this.gameArea.height);
        this.ctx.clip();

        // Draw tower wireframe if in buy mode
        if (!this.gameOver && !this.scrapMode && this.buyMode) {
            this.drawTowerWireframe();
        }

        // Draw towers and their projectiles
        this.drawTowers();

        // Draw creeps
        for (const creep of this.creeps) {
            creep.draw(this.ctx);
        }
        
        // Draw selection rectangle if dragging
        if (this.isDragging && this.scrapMode) {
            this.drawSelectionRectangle();
        }
        
        // Draw selected towers highlight
        if (this.scrapMode) {
            this.drawSelectedTowersHighlight();
        }
        
        // Restore clip
        this.ctx.restore();
        
        // Draw damage flash effect
        if (this.damageFlash.active) {
            this.drawDamageFlash();
        }
        
        // Draw Game Over screen if applicable
        if (this.gameOver) {
            this.drawGameOverScreen();
        }

        // Draw debug menu if visible
        if (this.devMenuVisible) {
            this.drawDevMenu();
        }
    }

    drawSpawnAndHomePoints() {
        // Draw spawn point
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
        }

        // Draw home point
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
        }

        // Draw health bar if needed
        if (this.damageFlash.showHealthBar) {
            this.drawHealthBar();
        }
    }

    drawHealthBar() {
        const barWidth = 200 * this.scaleFactor;
        const barHeight = 20 * this.scaleFactor;
        const barX = this.canvas.width / 2 - barWidth / 2;
        const barY = 20 * this.scaleFactor;
        
        // Draw background
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        this.ctx.fillRect(barX, barY, barWidth, barHeight);
        
        // Draw health portion
        const healthPortion = this.playerLives / 10; // Assuming max lives is 10
        this.ctx.fillStyle = healthPortion > 0.5 ? '#00FF00' : healthPortion > 0.25 ? '#FFFF00' : '#FF0000';
        this.ctx.globalAlpha = this.damageFlash.healthBarAlpha;
        this.ctx.fillRect(barX, barY, barWidth * healthPortion, barHeight);
        this.ctx.globalAlpha = 1.0;
        
        // Draw border
        this.ctx.strokeStyle = '#FFFFFF';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(barX, barY, barWidth, barHeight);
        
        // Draw lives text
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.font = `${16 * this.scaleFactor}px "VT323", monospace`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(
            `Lives: ${this.playerLives}`,
            this.canvas.width / 2,
            barY + barHeight / 2
        );
    }

    drawTowerWireframe() {
        const towerType = this.towerTypes[this.selectedTowerType];
        if (this.scraps >= towerType.cost) {
            const x = this.hoverX * this.grid.cellSize + this.gameArea.x;
            const y = this.hoverY * this.grid.cellSize + this.gameArea.y;
            
            let canPlace;
            if (towerType.name === "Wall" || towerType.name === "ElectricFence") {
                canPlace = !this.grid.isCellOccupied(this.hoverX, this.hoverY) && 
                          !this.isPointNearSpawnOrHome(this.hoverX, this.hoverY);
                this.ctx.fillStyle = canPlace ? 'rgba(0, 255, 0, 0.3)' : 'rgba(255, 0, 0, 0.3)';
                this.ctx.fillRect(x, y, this.grid.cellSize, this.grid.cellSize);
            } else {
                canPlace = !this.grid.isCellOccupied(this.hoverX, this.hoverY) && 
                          !this.grid.isCellOccupied(this.hoverX + 1, this.hoverY) &&
                          !this.grid.isCellOccupied(this.hoverX, this.hoverY + 1) &&
                          !this.grid.isCellOccupied(this.hoverX + 1, this.hoverY + 1) &&
                          !this.isPointNearSpawnOrHome(this.hoverX, this.hoverY);
                this.ctx.fillStyle = canPlace ? 'rgba(0, 255, 0, 0.3)' : 'rgba(255, 0, 0, 0.3)';
                this.ctx.fillRect(x, y, this.grid.cellSize * 2, this.grid.cellSize * 2);

                if (canPlace) {
                    this.ctx.beginPath();
                    this.ctx.arc(
                        x + this.grid.cellSize,
                        y + this.grid.cellSize,
                        towerType.range,
                        0,
                        Math.PI * 2
                    );
                    this.ctx.strokeStyle = 'rgba(255, 255, 100, 0.4)';
                    this.ctx.lineWidth = 2;
                    this.ctx.stroke();
                }
            }
        }
    }

    drawTowers() {
        for (const tower of this.towers) {
            if (tower.isWall || tower.isScrapper) {
                tower.draw(this.ctx);
            } else {
                const x = tower.x + this.gameArea.x;
                const y = tower.y;
                
                if (this.assets.isReady()) {
                    const img = this.assets.getImage('tower');
                    const aspectRatio = img.width / img.height;
                    const targetHeight = tower.height;
                    const targetWidth = targetHeight * aspectRatio;
                    const centerX = x + (tower.width - targetWidth) / 2;
                    
                    this.ctx.drawImage(img, centerX, y, targetWidth, targetHeight);
                }

                if (tower.projectiles) {
                    this.ctx.fillStyle = '#FFF';
                    for (const projectile of tower.projectiles) {
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

                tower.draw(this.ctx);
            }
        }

        // Draw selected tower highlight and range
        if (this.selectedTower) {
            this.drawSelectedTowerHighlight();
        }
    }

    drawSelectedTowerHighlight() {
        const x = this.selectedTower.x + this.gameArea.x;
        const y = this.selectedTower.y;
        
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
        
        this.ctx.strokeStyle = "#FFFF00";
        this.ctx.lineWidth = 3;
        this.ctx.strokeRect(x, y, this.selectedTower.width, this.selectedTower.height);
    
        if (!this.scrapMode && !this.selectedTower.isWall && !this.selectedTower.isScrapper) {
            this.drawTowerUpgradeInfo();
        }
    }

    drawSelectionRectangle() {
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

    drawSelectedTowersHighlight() {
        this.ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
        for (const tower of this.selectedTowers) {
            this.ctx.fillRect(
                tower.x + this.gameArea.x, 
                tower.y, 
                tower.width, 
                tower.height
            );
        }
    }

    drawDamageFlash() {
        const alpha = this.damageFlash.duration / this.damageFlash.maxDuration * 0.5;
        this.ctx.fillStyle = `rgba(255, 0, 0, ${alpha})`;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    drawGameOverScreen() {
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.ctx.fillStyle = '#FF0000';
        this.ctx.font = '40px "VT323", monospace';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('GAME OVER', this.canvas.width / 2, this.canvas.height / 2);
        
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.font = '22px "VT323", monospace';
        this.ctx.fillText(`You reached wave: ${this.waveReached}`, this.canvas.width / 2, this.canvas.height / 2 + 40);
        
        this.ctx.fillStyle = '#4CAF50';
        this.ctx.fillRect(
            this.restartButton.x,
            this.restartButton.y,
            this.restartButton.width,
            this.restartButton.height
        );
        
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.font = '20px "VT323", monospace';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(
            this.restartButton.text,
            this.restartButton.x + this.restartButton.width / 2,
            this.restartButton.y + this.restartButton.height / 2
        );
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
        
        // Set common font styles
        this.ctx.font = '20px "VT323", monospace';
        this.ctx.textAlign = 'left';
        this.ctx.fillStyle = '#EEEEEE';
        
        // Draw tower info
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
        
        // Draw upgrade buttons
        this.drawUpgradeButton('damage', startX, buttonY);
        this.drawUpgradeButton('fireRate', startX + this.towerTooltip.buttons.damage.width + buttonSpacing, buttonY);
        this.drawUpgradeButton('range', startX + this.towerTooltip.buttons.damage.width + this.towerTooltip.buttons.fireRate.width + buttonSpacing * 2, buttonY);
    }

    drawUpgradeButton(buttonType, x, y) {
        const button = this.towerTooltip.buttons[buttonType];
        const upgradeButton = this.upgradeButtons[buttonType];
        
        // Position button
        button.x = x;
        button.y = y;
        
        // Draw button background
        this.ctx.fillStyle = this.scraps >= upgradeButton.cost ? '#4CAF50' : '#666666';
        this.ctx.fillRect(
            button.x,
            button.y,
            button.width,
            button.height
        );
        
        // Draw button text
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.font = '16px "VT323", monospace';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(
            upgradeButton.text,
            button.x + button.width / 2,
            button.y + button.height / 2
        );
        this.ctx.textBaseline = 'alphabetic';

        // Draw cost with scrap icon
        const costTextY = button.y + button.height + 25 * this.scaleFactor;
        const costTextString = `${upgradeButton.cost}`;
        this.ctx.font = '16px "VT323", monospace';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';

        let costIconX = button.x + button.width / 2 - 15 * this.scaleFactor;
        const textWidth = this.ctx.measureText(costTextString).width;
        let totalWidth = textWidth;
        let iconWidth = 0;

        if (this.assets.isReady()) {
            const scrapImg = this.assets.getImage('scrap');
            const scrapSize = 15 * this.scaleFactor;
            iconWidth = scrapSize;
            totalWidth += iconWidth + 5 * this.scaleFactor;
        }

        costIconX = button.x + (button.width - totalWidth) / 2;
        let costTextX = costIconX;

        if (this.assets.isReady()) {
            const scrapImg = this.assets.getImage('scrap');
            const scrapSize = 15 * this.scaleFactor;
            const iconY = costTextY - scrapSize / 2;
            const { width: drawnIconWidth } = this.drawImageMaintainAspectRatio(scrapImg, costIconX, iconY, scrapSize, scrapSize, false, true);
            costTextX = costIconX + drawnIconWidth + 5 * this.scaleFactor;
        }

        this.ctx.fillText(costTextString, costTextX, costTextY);
        this.ctx.textBaseline = 'alphabetic';
    }

    drawStats() {
        // Draw stats at the top of the screen
        this.ctx.font = `${24 * this.scaleFactor}px "VT323", monospace`;
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
        this.ctx.font = '28px "VT323", monospace';
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

    // Method to kill all active creeps
    killAllCreeps() {
        for (let i = this.creeps.length - 1; i >= 0; i--) {
            const creep = this.creeps[i];
            if (creep.isAlive) {
                creep.health = 0;
                creep.isAlive = false;
                // The standard update loop will handle removal and potential scrap reward
            }
        }
        console.log("All creeps killed via dev menu.");
    }
    
    // Draw the developer menu
    drawDevMenu() {
        const menuX = this.gameArea.x + 5 * this.scaleFactor;
        const menuY = this.gameArea.y + 5 * this.scaleFactor;
        const menuWidth = 200 * this.scaleFactor;
        const menuHeight = 200 * this.scaleFactor;
        
        // Background
        this.ctx.fillStyle = 'rgba(50, 50, 50, 0.85)';
        this.ctx.fillRect(menuX, menuY, menuWidth, menuHeight);
        
        // Title
        this.ctx.fillStyle = '#FFF';
        this.ctx.font = `bold ${20 * this.scaleFactor}px "VT323", monospace`;
        this.ctx.textAlign = 'left';
        this.ctx.fillText("Developer Menu", menuX + 10 * this.scaleFactor, menuY + 25 * this.scaleFactor);
        
        // Kill All Creeps Button
        const killAllButtonRect = {
            x: menuX + 10 * this.scaleFactor, 
            y: menuY + 50 * this.scaleFactor, 
            width: 150 * this.scaleFactor, 
            height: 30 * this.scaleFactor
        };
        
        this.ctx.fillStyle = '#FF4444';
        this.ctx.fillRect(killAllButtonRect.x, killAllButtonRect.y, killAllButtonRect.width, killAllButtonRect.height);
        
        this.ctx.fillStyle = '#FFF';
        this.ctx.font = `${18 * this.scaleFactor}px "VT323", monospace`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText("Kill All Creeps", killAllButtonRect.x + killAllButtonRect.width / 2, killAllButtonRect.y + killAllButtonRect.height / 2);
        
        // Force Next Wave Button
        const forceWaveButtonRect = {
            x: menuX + 10 * this.scaleFactor, 
            y: menuY + 90 * this.scaleFactor,
            width: 150 * this.scaleFactor, 
            height: 30 * this.scaleFactor
        };
        
        this.ctx.fillStyle = '#4CAF50';
        this.ctx.fillRect(forceWaveButtonRect.x, forceWaveButtonRect.y, forceWaveButtonRect.width, forceWaveButtonRect.height);
        
        this.ctx.fillStyle = '#FFF';
        this.ctx.font = `${14 * this.scaleFactor}px "VT323", monospace`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText("Force Next Wave", forceWaveButtonRect.x + forceWaveButtonRect.width / 2, forceWaveButtonRect.y + forceWaveButtonRect.height / 2);
    }

    // Add this new method to show random dialogue messages
    showRandomDialogue(type) {
        if (this.dialogueMessages[type]) {
            const messages = this.dialogueMessages[type];
            const randomMessage = messages[Math.floor(Math.random() * messages.length)];
            this.updateDialogue(randomMessage);
        }
    }
}

// Start game when page is loaded
window.onload = () => {
    const game = new Game();
}; 