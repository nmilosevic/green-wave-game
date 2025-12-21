// Green Wave Game
// A puzzle game about timing traffic lights

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Polyfill for roundRect (Safari < 16, older browsers)
if (!ctx.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function(x, y, w, h, radii) {
        const r = typeof radii === 'number' ? radii : (radii[0] || 0);
        this.moveTo(x + r, y);
        this.lineTo(x + w - r, y);
        this.quadraticCurveTo(x + w, y, x + w, y + r);
        this.lineTo(x + w, y + h - r);
        this.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        this.lineTo(x + r, y + h);
        this.quadraticCurveTo(x, y + h, x, y + h - r);
        this.lineTo(x, y + r);
        this.quadraticCurveTo(x, y, x + r, y);
        this.closePath();
    };
}

// Display elements
const speedDisplay = document.getElementById('speedDisplay');
const lightsDisplay = document.getElementById('lightsDisplay');
const totalLightsDisplay = document.getElementById('totalLightsDisplay');
const levelDisplay = document.getElementById('levelDisplay');
const timeDisplay = document.getElementById('timeDisplay');
const messageDiv = document.getElementById('message');
const messageTitle = document.getElementById('messageTitle');
const messageText = document.getElementById('messageText');
const messageButton = document.getElementById('messageButton');

// Best times storage
const STORAGE_KEY = 'greenWaveBestTimes';

function getBestTimes() {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        return stored ? JSON.parse(stored) : {};
    } catch (e) {
        return {};
    }
}

function saveBestTime(level, time) {
    const bestTimes = getBestTimes();
    if (!bestTimes[level] || time < bestTimes[level]) {
        bestTimes[level] = time;
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(bestTimes));
        } catch (e) {
            // localStorage might be unavailable
        }
        return true; // New record
    }
    return false;
}

function formatTime(seconds) {
    return seconds.toFixed(1);
}

// Calculate star rating based on driving smoothness
// Lower totalSpeedChange = smoother driving = more stars
function calculateStars(speedChange, levelDistance) {
    // Normalize speed change by level distance for fair comparison across levels
    // speedChange is in km/h accumulated, levelDistance in pixels
    const normalizedChange = speedChange / (levelDistance / 100);

    // Thresholds tuned for gameplay feel:
    // < 20: very smooth driving, minimal corrections
    // < 50: some adjustments needed
    // >= 50: lots of speed changes
    if (normalizedChange < 20) {
        return 3;
    } else if (normalizedChange < 50) {
        return 2;
    } else {
        return 1;
    }
}

function getStarDisplay(stars) {
    return '\u2605'.repeat(stars) + '\u2606'.repeat(3 - stars);
}

// Game constants
const ROAD_Y = 250;
const ROAD_HEIGHT = 100;
const CAR_WIDTH = 100; // Longer car body to match wheel spacing
const CAR_HEIGHT = 22; // Lower body height for better proportions
const CAR_X = 150; // Fixed screen position of the car

// Wheel animation
let wheelRotation = 0; // Current wheel rotation angle in radians

// Birds in the sky
let birds = [];

// Physics constants
const MAX_SPEED = 120; // km/h
const ACCELERATION = 40; // km/h per second
const BRAKE_POWER = 60; // km/h per second
const FRICTION = 5; // km/h per second (coasting slowdown)
const MIN_SPEED_THRESHOLD = 2; // Below this, considered stopped

// Traffic light timing constants
const YELLOW_BEFORE_GREEN = 1.0; // Yellow phase before green (preparing to go)
const YELLOW_AFTER_GREEN = 1.5; // Blinking yellow after green (warning)

// Game state
let gameState = 'playing'; // 'playing', 'won', 'lost', 'ending'
let currentLevel = 1;
let carSpeed = 50; // Starting speed in km/h
let carWorldX = 0; // Car's position in the world
let lightsPassed = 0;
let trafficLights = [];
let keys = { gas: false, brake: false };

// Smoothness tracking for star rating
let totalSpeedChange = 0; // Accumulated absolute speed changes
let lastSpeed = 0; // Previous frame's speed for comparison

// Ending animation state
let endingTime = 0;
const ENDING_DURATION = 12; // seconds for full animation

// Level definitions
// Each light has: position (x), cycle timing (greenDuration, redDuration), and phase offset
const levels = [
    {
        // Tutorial: Just one light with long green, teaches basic controls
        name: "First Light",
        startSpeed: 40,
        lights: [
            { x: 600, greenDuration: 4, redDuration: 2, offset: 0 },
        ],
        finishX: 900
    },
    {
        // Two lights, introduces timing between lights
        name: "Easy Start",
        startSpeed: 40,
        lights: [
            { x: 500, greenDuration: 3.5, redDuration: 2, offset: 0 },
            { x: 1000, greenDuration: 3.5, redDuration: 2, offset: 1.5 },
        ],
        finishX: 1300
    },
    {
        // Three lights, first real challenge
        name: "Finding the Rhythm",
        startSpeed: 45,
        lights: [
            { x: 500, greenDuration: 3, redDuration: 2, offset: 0 },
            { x: 900, greenDuration: 3, redDuration: 2, offset: 1 },
            { x: 1300, greenDuration: 3, redDuration: 2, offset: 2 },
        ],
        finishX: 1600
    },
    {
        // Four lights with tighter timing
        name: "Keep the Pace",
        startSpeed: 50,
        lights: [
            { x: 400, greenDuration: 2.5, redDuration: 2.5, offset: 0 },
            { x: 700, greenDuration: 2.5, redDuration: 2.5, offset: 1.2 },
            { x: 1000, greenDuration: 2.5, redDuration: 2.5, offset: 2.4 },
            { x: 1300, greenDuration: 2.5, redDuration: 2.5, offset: 3.6 },
        ],
        finishX: 1600
    },
    {
        // Mixed timing requires speed adjustment
        name: "Speed Adjustment",
        startSpeed: 60,
        lights: [
            { x: 400, greenDuration: 2, redDuration: 3, offset: 0 },
            { x: 750, greenDuration: 3, redDuration: 2, offset: 0.5 },
            { x: 1100, greenDuration: 2, redDuration: 3, offset: 2 },
            { x: 1400, greenDuration: 2.5, redDuration: 2.5, offset: 1 },
            { x: 1700, greenDuration: 3, redDuration: 2, offset: 3 },
        ],
        finishX: 2000
    },
    {
        // Long level with many lights
        name: "The Long Road",
        startSpeed: 55,
        lights: [
            { x: 350, greenDuration: 2, redDuration: 2, offset: 0 },
            { x: 600, greenDuration: 2.5, redDuration: 2, offset: 0.8 },
            { x: 850, greenDuration: 2, redDuration: 2.5, offset: 1.8 },
            { x: 1100, greenDuration: 3, redDuration: 2, offset: 2.5 },
            { x: 1400, greenDuration: 2, redDuration: 2, offset: 3.5 },
            { x: 1700, greenDuration: 2.5, redDuration: 2.5, offset: 4.2 },
            { x: 2000, greenDuration: 2, redDuration: 3, offset: 5 },
        ],
        finishX: 2300
    },
    {
        // Short greens, requires patience and precise timing
        name: "Patience Required",
        startSpeed: 70,
        lights: [
            { x: 400, greenDuration: 1.5, redDuration: 3, offset: 0 },
            { x: 700, greenDuration: 2, redDuration: 2.5, offset: 1.5 },
            { x: 950, greenDuration: 1.5, redDuration: 3, offset: 0.5 },
            { x: 1250, greenDuration: 2.5, redDuration: 2, offset: 2.5 },
            { x: 1500, greenDuration: 2, redDuration: 2.5, offset: 3.5 },
            { x: 1800, greenDuration: 1.5, redDuration: 3, offset: 1 },
        ],
        finishX: 2100
    }
];

// Initialize level
function initLevel(levelNum) {
    if (levelNum > levels.length) {
        levelNum = levels.length; // Stay on last level
    }

    currentLevel = levelNum;
    const level = levels[levelNum - 1];

    carSpeed = level.startSpeed;
    carWorldX = 0;
    lightsPassed = 0;
    gameState = 'playing';
    gameTime = 0;

    // Reset smoothness tracking
    totalSpeedChange = 0;
    lastSpeed = level.startSpeed;

    // Create traffic lights for this level
    trafficLights = level.lights.map(config => ({
        x: config.x,
        greenDuration: config.greenDuration,
        redDuration: config.redDuration,
        offset: config.offset,
        passed: false
    }));

    // Update HUD
    levelDisplay.textContent = levelNum;
    totalLightsDisplay.textContent = trafficLights.length;
    lightsDisplay.textContent = 0;

    // Initialize birds
    initBirds();

    hideMessage();
}

// Get light state at current time
// Cycle: Red → Yellow (before green) → Green → Blinking Yellow → Red
function getLightState(light, time) {
    const cycleDuration = light.redDuration + YELLOW_BEFORE_GREEN + light.greenDuration + YELLOW_AFTER_GREEN;
    const adjustedTime = (time + light.offset) % cycleDuration;

    // Phase boundaries
    const redEnd = light.redDuration;
    const yellowBeforeEnd = redEnd + YELLOW_BEFORE_GREEN;
    const greenEnd = yellowBeforeEnd + light.greenDuration;
    // After greenEnd until cycleDuration is blinking yellow

    if (adjustedTime < redEnd) {
        return 'red';
    } else if (adjustedTime < yellowBeforeEnd) {
        return 'yellow'; // Solid yellow before green
    } else if (adjustedTime < greenEnd) {
        return 'green';
    } else {
        return 'blinking-yellow'; // Warning before red
    }
}

// Get time until next change
function getTimeUntilChange(light, time) {
    const cycleDuration = light.redDuration + YELLOW_BEFORE_GREEN + light.greenDuration + YELLOW_AFTER_GREEN;
    const adjustedTime = (time + light.offset) % cycleDuration;

    // Phase boundaries
    const redEnd = light.redDuration;
    const yellowBeforeEnd = redEnd + YELLOW_BEFORE_GREEN;
    const greenEnd = yellowBeforeEnd + light.greenDuration;

    if (adjustedTime < redEnd) {
        return redEnd - adjustedTime;
    } else if (adjustedTime < yellowBeforeEnd) {
        return yellowBeforeEnd - adjustedTime;
    } else if (adjustedTime < greenEnd) {
        return greenEnd - adjustedTime;
    } else {
        return cycleDuration - adjustedTime;
    }
}

// Get the duration of the current phase (for progress bar)
function getCurrentPhaseDuration(light, time) {
    const state = getLightState(light, time);
    switch (state) {
        case 'red': return light.redDuration;
        case 'yellow': return YELLOW_BEFORE_GREEN;
        case 'green': return light.greenDuration;
        case 'blinking-yellow': return YELLOW_AFTER_GREEN;
        default: return 1;
    }
}

// Input handling
document.addEventListener('keydown', (e) => {
    if (e.key === 'w' || e.key === 'W' || e.key === 'ArrowUp') {
        keys.gas = true;
        e.preventDefault();
    }
    if (e.key === 's' || e.key === 'S' || e.key === 'ArrowDown') {
        keys.brake = true;
        e.preventDefault();
    }
    if (e.key === 'r' || e.key === 'R') {
        initLevel(currentLevel);
    }
});

document.addEventListener('keyup', (e) => {
    if (e.key === 'w' || e.key === 'W' || e.key === 'ArrowUp') {
        keys.gas = false;
    }
    if (e.key === 's' || e.key === 'S' || e.key === 'ArrowDown') {
        keys.brake = false;
    }
});

// Debug: Press 'E' to preview ending animation
document.addEventListener('keydown', (e) => {
    if (e.key === 'e' || e.key === 'E') {
        gameState = 'ending';
        endingTime = 0;
    }
});

// Message display
function showMessage(title, text, buttonText, buttonAction) {
    messageTitle.textContent = title;
    messageText.textContent = text;
    messageButton.textContent = buttonText;
    messageButton.onclick = buttonAction;
    messageDiv.style.display = 'block';

    if (title.includes('Complete') || title.includes('Congratulations')) {
        messageDiv.className = 'success';
    } else {
        messageDiv.className = 'failure';
    }
}

function hideMessage() {
    messageDiv.style.display = 'none';
}

// Game over states
function winLevel() {
    gameState = 'won';
    const finishTime = gameTime;
    const isNewRecord = saveBestTime(currentLevel, finishTime);
    const bestTimes = getBestTimes();
    const bestTime = bestTimes[currentLevel];

    // Calculate star rating based on smoothness
    const level = levels[currentLevel - 1];
    const stars = calculateStars(totalSpeedChange, level.finishX);
    const starDisplay = getStarDisplay(stars);

    let timeText = `Time: ${formatTime(finishTime)}s`;
    if (isNewRecord) {
        timeText += ' - New Record!';
    } else if (bestTime) {
        timeText += ` (Best: ${formatTime(bestTime)}s)`;
    }

    if (currentLevel >= levels.length) {
        // Start the ending animation instead of showing a message
        gameState = 'ending';
        endingTime = 0;
        hideMessage();
        return;
    } else {
        showMessage(
            'Level Complete!',
            `"${levels[currentLevel - 1].name}"\n${starDisplay}\n${timeText}`,
            'Next Level',
            () => initLevel(currentLevel + 1)
        );
    }
}

function loseGame(reason) {
    gameState = 'lost';
    showMessage(
        'Wave Broken!',
        reason,
        'Try Again',
        () => initLevel(currentLevel)
    );
}

// Game time (for light timing)
let gameTime = 0;
let lastTimestamp = 0;

// Update game state
function update(deltaTime) {
    if (gameState !== 'playing') return;

    gameTime += deltaTime;

    // Update car speed based on input
    if (keys.gas && !keys.brake) {
        carSpeed += ACCELERATION * deltaTime;
    } else if (keys.brake && !keys.gas) {
        carSpeed -= BRAKE_POWER * deltaTime;
    } else {
        // Coasting - apply friction
        carSpeed -= FRICTION * deltaTime;
    }

    // Clamp speed
    carSpeed = Math.max(0, Math.min(MAX_SPEED, carSpeed));

    // Track speed changes for smoothness rating (only count intentional changes, not friction)
    if (keys.gas || keys.brake) {
        totalSpeedChange += Math.abs(carSpeed - lastSpeed);
    }
    lastSpeed = carSpeed;

    // Check for stopped (failure) only when fully stopped and not accelerating
    if (carSpeed === 0 && !keys.gas) {
        loseGame("You stopped! Keep moving to catch the green wave.");
        return;
    }

    // Convert km/h to pixels per second
    // Using 3 pixels per km/h gives a good game feel: at 60 km/h the car moves
    // 180 pixels/sec, covering the ~1600-2300 pixel levels in 9-13 seconds
    const pixelsPerSecond = carSpeed * 3;

    // Move car in world
    carWorldX += pixelsPerSecond * deltaTime;

    // Update wheel rotation based on speed
    // Wheel circumference ~= 2 * PI * radius, assume radius ~11 pixels
    const wheelCircumference = 2 * Math.PI * 11;
    const wheelRotationSpeed = pixelsPerSecond / wheelCircumference;
    wheelRotation += wheelRotationSpeed * deltaTime * Math.PI * 2;

    // Check traffic lights - car is drawn centered at CAR_X, so front is at carWorldX + CAR_WIDTH/2
    const carFront = carWorldX + CAR_WIDTH / 2;

    for (const light of trafficLights) {
        if (!light.passed && carFront > light.x) {
            // Car just passed this light
            const state = getLightState(light, gameTime);
            if (state === 'red') {
                loseGame("You ran a red light! Time your speed better.");
                return;
            }
            light.passed = true;
            lightsPassed++;
            lightsDisplay.textContent = lightsPassed;
        }
    }

    // Check for level complete
    const level = levels[currentLevel - 1];
    if (carWorldX > level.finishX) {
        winLevel();
    }

    // Update speed display
    speedDisplay.textContent = Math.round(carSpeed);

    // Update time display
    timeDisplay.textContent = formatTime(gameTime);

    // Update birds
    updateBirds(deltaTime);
}

// Draw game
function draw() {
    // Clear canvas
    ctx.fillStyle = '#87CEEB';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Camera offset (car stays at fixed screen position)
    const cameraX = carWorldX - CAR_X;

    // Draw sky gradient (daylight blue sky)
    const skyGradient = ctx.createLinearGradient(0, 0, 0, ROAD_Y);
    skyGradient.addColorStop(0, '#4A90D9');
    skyGradient.addColorStop(0.5, '#87CEEB');
    skyGradient.addColorStop(1, '#B0E0E6');
    ctx.fillStyle = skyGradient;
    ctx.fillRect(0, 0, canvas.width, ROAD_Y);

    // Draw birds in the sky
    drawBirds();

    // Draw distant buildings (parallax)
    drawBuildings(cameraX * 0.3);

    // Draw road
    ctx.fillStyle = '#555555';
    ctx.fillRect(0, ROAD_Y, canvas.width, ROAD_HEIGHT);

    // Draw road lines
    ctx.strokeStyle = '#EEEEEE';
    ctx.lineWidth = 2;
    ctx.setLineDash([30, 20]);
    ctx.beginPath();
    const lineOffset = -cameraX % 50;
    ctx.moveTo(lineOffset, ROAD_Y + ROAD_HEIGHT / 2);
    ctx.lineTo(canvas.width, ROAD_Y + ROAD_HEIGHT / 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw finish line (on left/upper lane only)
    const level = levels[currentLevel - 1];
    const finishScreenX = level.finishX - cameraX;
    if (finishScreenX > -50 && finishScreenX < canvas.width + 50) {
        ctx.fillStyle = '#4ecca3';
        ctx.fillRect(finishScreenX, ROAD_Y, 10, ROAD_HEIGHT / 2);
        ctx.fillStyle = '#fff';
        ctx.font = '14px sans-serif';
        ctx.fillText('FINISH', finishScreenX - 15, ROAD_Y - 10);
    }

    // Draw traffic lights
    for (const light of trafficLights) {
        const screenX = light.x - cameraX;
        if (screenX > -100 && screenX < canvas.width + 100) {
            drawTrafficLight(screenX, light);
        }
    }

    // Draw car (on left/upper lane, under the traffic lights)
    drawCar(CAR_X, ROAD_Y + ROAD_HEIGHT / 4);

    // Draw pedal indicators
    drawPedals();
}

// Simple hash function for deterministic window pattern based on position
function seededRandom(x, y) {
    const seed = x * 374761393 + y * 668265263;
    const hash = (seed ^ (seed >> 13)) * 1274126177;
    return ((hash ^ (hash >> 16)) & 0xffff) / 0xffff;
}

// Initialize birds flying in the sky
function initBirds() {
    birds = [];
    const numBirds = 5 + Math.floor(Math.random() * 4); // 5-8 birds
    for (let i = 0; i < numBirds; i++) {
        birds.push({
            x: Math.random() * canvas.width,
            y: 30 + Math.random() * 80, // Upper sky area
            speed: 20 + Math.random() * 40, // Pixels per second
            wingPhase: Math.random() * Math.PI * 2, // Wing flap animation offset
            size: 3 + Math.random() * 3 // Bird size variation
        });
    }
}

// Update bird positions
function updateBirds(deltaTime) {
    for (const bird of birds) {
        // Birds fly from right to left
        bird.x -= bird.speed * deltaTime;
        // Animate wings
        bird.wingPhase += deltaTime * 8;
        // Wrap around when off screen
        if (bird.x < -20) {
            bird.x = canvas.width + 20;
            bird.y = 30 + Math.random() * 80;
        }
    }
}

// Draw birds as simple V shapes with flapping wings
function drawBirds() {
    ctx.strokeStyle = '#333333';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';

    for (const bird of birds) {
        const wingUp = Math.sin(bird.wingPhase) * 0.4;
        const s = bird.size;

        ctx.beginPath();
        // Left wing
        ctx.moveTo(bird.x - s * 2, bird.y + wingUp * s);
        ctx.lineTo(bird.x, bird.y);
        // Right wing
        ctx.lineTo(bird.x + s * 2, bird.y + wingUp * s);
        ctx.stroke();
    }
}

function drawBuildings(offset) {
    // Daylight building colors
    const buildingColors = ['#8B9DC3', '#9DAED4', '#7A8BB5', '#A5B5CF', '#6B7BA5'];
    const buildingData = [
        { w: 60, h: 80 }, { w: 40, h: 120 }, { w: 80, h: 60 },
        { w: 50, h: 100 }, { w: 70, h: 70 }, { w: 45, h: 90 },
        { w: 65, h: 85 }, { w: 55, h: 110 }, { w: 75, h: 65 },
    ];

    let x = -offset % 200 - 100;
    let buildingIndex = 0;

    while (x < canvas.width + 100) {
        const building = buildingData[buildingIndex % buildingData.length];
        ctx.fillStyle = buildingColors[buildingIndex % buildingColors.length];
        ctx.fillRect(x, ROAD_Y - building.h, building.w, building.h);

        // Windows - daylight reflections (blue sky reflection)
        ctx.fillStyle = 'rgba(135, 206, 235, 0.5)';
        for (let wy = ROAD_Y - building.h + 10; wy < ROAD_Y - 10; wy += 20) {
            for (let wx = x + 8; wx < x + building.w - 8; wx += 15) {
                const windowWorldX = Math.round(wx + offset);
                if (seededRandom(windowWorldX, wy) > 0.3) {
                    ctx.fillRect(wx, wy, 8, 12);
                }
            }
        }

        x += building.w + 30 + (buildingIndex % 3) * 20;
        buildingIndex++;
    }
}

function drawTrafficLight(screenX, light) {
    const state = getLightState(light, gameTime);
    const timeUntilChange = getTimeUntilChange(light, gameTime);

    // For blinking yellow, determine if we're in the "on" phase of the blink
    const blinkOn = state === 'blinking-yellow' && Math.floor(gameTime * 4) % 2 === 0;

    // Scale to match car proportions (car is ~36px tall total)
    const poleBaseY = ROAD_Y;
    const poleTopY = ROAD_Y - 95;

    // Main pole (galvanized steel look)
    ctx.fillStyle = '#666';
    ctx.fillRect(screenX - 3, poleTopY + 15, 6, poleBaseY - poleTopY - 15);
    // Pole highlight
    ctx.fillStyle = '#888';
    ctx.fillRect(screenX - 3, poleTopY + 15, 2, poleBaseY - poleTopY - 15);

    // Horizontal arm extending toward driver (to the right)
    const armLength = 28;
    const armY = poleTopY + 18;
    ctx.fillStyle = '#666';
    ctx.fillRect(screenX, armY - 3, armLength, 5);
    ctx.fillStyle = '#888';
    ctx.fillRect(screenX, armY - 3, armLength, 1);

    // Traffic light housing - angled toward driver (3D perspective)
    const lightX = screenX + armLength - 4;
    const lightY = armY;
    const housingW = 16;
    const housingH = 48;
    const perspective = 5; // 3D depth effect

    // Housing back (darker, visible due to angle)
    ctx.fillStyle = '#222';
    ctx.beginPath();
    ctx.moveTo(lightX, lightY);
    ctx.lineTo(lightX + perspective, lightY - 4);
    ctx.lineTo(lightX + perspective, lightY + housingH - 4);
    ctx.lineTo(lightX, lightY + housingH);
    ctx.closePath();
    ctx.fill();

    // Housing front face (facing driver)
    ctx.fillStyle = '#333';
    ctx.fillRect(lightX - housingW, lightY, housingW, housingH);

    // Housing top edge (3D)
    ctx.fillStyle = '#444';
    ctx.beginPath();
    ctx.moveTo(lightX - housingW, lightY);
    ctx.lineTo(lightX - housingW + perspective, lightY - 4);
    ctx.lineTo(lightX + perspective, lightY - 4);
    ctx.lineTo(lightX, lightY);
    ctx.closePath();
    ctx.fill();

    // Visor/hood over each light (realistic detail)
    const visorDepth = 4;
    const lightSpacing = 14;
    const lightRadius = 5;
    const firstLightY = lightY + 10;

    for (let i = 0; i < 3; i++) {
        const ly = firstLightY + i * lightSpacing;
        const lx = lightX - housingW / 2 - 1;

        // Visor hood
        ctx.fillStyle = '#222';
        ctx.beginPath();
        ctx.moveTo(lx - lightRadius - 1, ly - lightRadius);
        ctx.lineTo(lx - lightRadius - 1 - visorDepth, ly - lightRadius - 2);
        ctx.lineTo(lx + lightRadius + 1 - visorDepth, ly - lightRadius - 2);
        ctx.lineTo(lx + lightRadius + 1, ly - lightRadius);
        ctx.closePath();
        ctx.fill();

        // Light housing ring (black bezel)
        ctx.fillStyle = '#111';
        ctx.beginPath();
        ctx.arc(lx, ly, lightRadius + 1, 0, Math.PI * 2);
        ctx.fill();

        // Determine light state and color
        let isOn = false;
        let onColor, offColor;

        if (i === 0) { // Red
            isOn = state === 'red';
            onColor = '#ff3333';
            offColor = '#331111';
        } else if (i === 1) { // Yellow
            isOn = state === 'yellow' || blinkOn;
            onColor = '#ffcc00';
            offColor = '#332800';
        } else { // Green
            isOn = state === 'green';
            onColor = '#33ff33';
            offColor = '#113311';
        }

        // Light lens
        ctx.fillStyle = isOn ? onColor : offColor;
        if (isOn) {
            ctx.shadowColor = onColor;
            ctx.shadowBlur = 10;
        }
        ctx.beginPath();
        ctx.arc(lx, ly, lightRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Glass reflection highlight (when on)
        if (isOn) {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
            ctx.beginPath();
            ctx.arc(lx - 1, ly - 1, lightRadius / 3, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // Timer indicator bar (above the traffic light housing)
    const maxTime = getCurrentPhaseDuration(light, gameTime);
    const progress = timeUntilChange / maxTime;
    const barWidth = housingW + 4;
    const barX = lightX - housingW - 2;
    const barY = lightY - 8;
    // Background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fillRect(barX, barY, barWidth, 4);
    // Progress
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.fillRect(barX, barY, barWidth * progress, 4);
}

function drawCar(x, y) {
    // Stylized sporty coupe - clean, modern game car design
    // Proportions: wheelbase ~65% of length, body height ~1/4 of length
    const W = 90;  // Total car width (length when viewed from side)
    const H = 24;  // Body height
    const cabinH = 12; // Cabin/greenhouse height

    // Colors - vibrant orange sports car
    const bodyMain = '#ff6b35';      // Bright orange
    const bodyDark = '#cc4411';      // Darker orange for lower body
    const bodyLight = '#ff8855';     // Highlight
    const windowColor = '#1a2a3a';   // Dark tinted windows
    const windowShine = '#3a4a5a';   // Window reflection
    const black = '#111';
    const darkGray = '#333';
    const silver = '#ccc';

    // Wheel setup - proper sports car stance
    const wheelBase = W * 0.62;      // Distance between wheel centers
    const rearWheelX = x - wheelBase/2 + 2;
    const frontWheelX = x + wheelBase/2 - 2;
    const wheelY = y + H/2 + 2;
    const tireR = 11;
    const rimR = 7;

    // === WHEEL WELLS (draw first, body covers top) ===
    ctx.fillStyle = black;
    ctx.beginPath();
    ctx.arc(rearWheelX, wheelY, tireR + 3, Math.PI, 0);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(frontWheelX, wheelY, tireR + 3, Math.PI, 0);
    ctx.fill();

    // === MAIN BODY SHAPE ===
    ctx.fillStyle = bodyMain;
    ctx.beginPath();
    // Start at rear bumper bottom
    ctx.moveTo(x - W/2, y + H/2);
    // Rear end - slight angle back
    ctx.lineTo(x - W/2 + 2, y - H/2 + 4);
    // Rear deck/trunk - gentle slope up
    ctx.lineTo(x - W/4, y - H/2);
    // C-pillar - smooth rake back
    ctx.quadraticCurveTo(x - W/5, y - H/2 - cabinH + 2, x - W/6, y - H/2 - cabinH);
    // Roof line - slight curve
    ctx.quadraticCurveTo(x, y - H/2 - cabinH - 1, x + W/6, y - H/2 - cabinH);
    // A-pillar - sporty rake
    ctx.quadraticCurveTo(x + W/5, y - H/2 - cabinH + 2, x + W/4, y - H/2 - 2);
    // Hood - long, sloping down
    ctx.lineTo(x + W/2 - 4, y - H/2 + 4);
    // Front nose - rounded
    ctx.quadraticCurveTo(x + W/2, y - H/2 + 6, x + W/2, y);
    // Front lower - curves under
    ctx.quadraticCurveTo(x + W/2, y + H/2 - 2, x + W/2 - 4, y + H/2);
    // Underside back to start
    ctx.closePath();
    ctx.fill();

    // === LOWER BODY (rocker panel area) ===
    ctx.fillStyle = bodyDark;
    ctx.beginPath();
    ctx.moveTo(x - W/2 + 3, y + 2);
    ctx.lineTo(x + W/2 - 5, y + 2);
    ctx.lineTo(x + W/2 - 4, y + H/2);
    ctx.lineTo(x - W/2, y + H/2);
    ctx.closePath();
    ctx.fill();

    // === BODY SIDE LINE (character line) ===
    ctx.strokeStyle = bodyLight;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x - W/2 + 5, y - 2);
    ctx.lineTo(x + W/2 - 8, y - 4);
    ctx.stroke();

    // === WINDOWS ===
    // Rear quarter window
    ctx.fillStyle = windowColor;
    ctx.beginPath();
    ctx.moveTo(x - W/4 + 3, y - H/2 + 1);
    ctx.quadraticCurveTo(x - W/5 + 2, y - H/2 - cabinH + 4, x - W/6 + 2, y - H/2 - cabinH + 2);
    ctx.lineTo(x - W/8, y - H/2 - cabinH + 2);
    ctx.lineTo(x - W/8, y - H/2 + 1);
    ctx.closePath();
    ctx.fill();

    // Main side window
    ctx.beginPath();
    ctx.moveTo(x - W/8 + 3, y - H/2 + 1);
    ctx.lineTo(x - W/8 + 3, y - H/2 - cabinH + 2);
    ctx.quadraticCurveTo(x, y - H/2 - cabinH - 0.5, x + W/6 - 2, y - H/2 - cabinH + 2);
    ctx.quadraticCurveTo(x + W/5, y - H/2 - cabinH + 4, x + W/4 - 2, y - H/2);
    ctx.lineTo(x + W/4 - 2, y - H/2 + 1);
    ctx.closePath();
    ctx.fill();

    // Window shine/reflection
    ctx.strokeStyle = windowShine;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x - W/8 + 6, y - H/2 - cabinH + 5);
    ctx.lineTo(x + W/8, y - H/2 - cabinH + 4);
    ctx.stroke();

    // === DOOR LINE ===
    ctx.strokeStyle = bodyDark;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x - W/8, y - H/2 - cabinH + 2);
    ctx.lineTo(x - W/8, y + H/2 - 2);
    ctx.stroke();

    // Door handle
    ctx.fillStyle = silver;
    ctx.fillRect(x - W/12, y - 3, 6, 2);

    // === TIRES ===
    ctx.fillStyle = black;
    ctx.beginPath();
    ctx.arc(rearWheelX, wheelY, tireR, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(frontWheelX, wheelY, tireR, 0, Math.PI * 2);
    ctx.fill();

    // === ALLOY RIMS ===
    // Outer rim
    ctx.fillStyle = '#888';
    ctx.beginPath();
    ctx.arc(rearWheelX, wheelY, rimR, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(frontWheelX, wheelY, rimR, 0, Math.PI * 2);
    ctx.fill();

    // Inner rim face
    ctx.fillStyle = '#aaa';
    ctx.beginPath();
    ctx.arc(rearWheelX, wheelY, rimR - 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(frontWheelX, wheelY, rimR - 1, 0, Math.PI * 2);
    ctx.fill();

    // 5-spoke design (rotates with wheels)
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 2;
    for (let i = 0; i < 5; i++) {
        const angle = (i / 5) * Math.PI * 2 + wheelRotation;
        // Rear wheel
        ctx.beginPath();
        ctx.moveTo(rearWheelX, wheelY);
        ctx.lineTo(
            rearWheelX + Math.cos(angle) * (rimR - 2),
            wheelY + Math.sin(angle) * (rimR - 2)
        );
        ctx.stroke();
        // Front wheel
        ctx.beginPath();
        ctx.moveTo(frontWheelX, wheelY);
        ctx.lineTo(
            frontWheelX + Math.cos(angle) * (rimR - 2),
            wheelY + Math.sin(angle) * (rimR - 2)
        );
        ctx.stroke();
    }

    // Center caps
    ctx.fillStyle = '#777';
    ctx.beginPath();
    ctx.arc(rearWheelX, wheelY, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(frontWheelX, wheelY, 2, 0, Math.PI * 2);
    ctx.fill();

    // === HEADLIGHT ===
    const headlightOn = carSpeed > 0;
    ctx.fillStyle = '#222';
    ctx.beginPath();
    ctx.ellipse(x + W/2 - 3, y - H/2 + 7, 4, 3, 0.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = headlightOn ? '#ffffcc' : '#666';
    if (headlightOn) {
        ctx.shadowColor = '#ffffaa';
        ctx.shadowBlur = 15;
    }
    ctx.beginPath();
    ctx.ellipse(x + W/2 - 3, y - H/2 + 7, 3, 2, 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // === TAIL LIGHT ===
    const braking = keys.brake;
    ctx.fillStyle = braking ? '#ff2222' : '#661111';
    if (braking) {
        ctx.shadowColor = '#ff2222';
        ctx.shadowBlur = 12;
    }
    ctx.beginPath();
    ctx.ellipse(x - W/2 + 4, y - H/2 + 6, 2, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // === FRONT GRILLE/INTAKE ===
    ctx.fillStyle = darkGray;
    ctx.beginPath();
    ctx.moveTo(x + W/2 - 2, y + 1);
    ctx.quadraticCurveTo(x + W/2 + 1, y + 4, x + W/2 - 2, y + 7);
    ctx.lineTo(x + W/2 - 5, y + 5);
    ctx.lineTo(x + W/2 - 5, y + 2);
    ctx.closePath();
    ctx.fill();

    // === SIDE MIRROR ===
    ctx.fillStyle = bodyMain;
    ctx.beginPath();
    ctx.ellipse(x + W/4 + 2, y - H/2 - cabinH/2, 3, 2, 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = windowColor;
    ctx.beginPath();
    ctx.ellipse(x + W/4 + 3, y - H/2 - cabinH/2, 1.5, 1, 0.3, 0, Math.PI * 2);
    ctx.fill();
}

function drawPedals() {
    const pedalY = canvas.height - 40;
    const pedalWidth = 30;
    const pedalHeight = 25;

    // Gas pedal indicator
    ctx.fillStyle = keys.gas ? '#4ecca3' : '#333';
    ctx.fillRect(canvas.width - 80, pedalY, pedalWidth, pedalHeight);
    ctx.fillStyle = '#fff';
    ctx.font = '10px sans-serif';
    ctx.fillText('GAS', canvas.width - 75, pedalY + 16);

    // Brake pedal indicator
    ctx.fillStyle = keys.brake ? '#e74c3c' : '#333';
    ctx.fillRect(canvas.width - 120, pedalY, pedalWidth, pedalHeight);
    ctx.fillStyle = '#fff';
    ctx.fillText('BRK', canvas.width - 117, pedalY + 16);
}

// Ending animation - car driving into the sunset
function drawEndingAnimation(time) {
    const progress = Math.min(time / ENDING_DURATION, 1);

    // Sky gradient - sunset colors
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, '#1a0a2e');      // Deep purple at top
    gradient.addColorStop(0.3, '#4a1942');    // Purple
    gradient.addColorStop(0.5, '#c94b4b');    // Red-orange
    gradient.addColorStop(0.7, '#f09819');    // Orange
    gradient.addColorStop(0.85, '#ffcc66');   // Yellow-orange near horizon
    gradient.addColorStop(1, '#f09819');      // Orange at bottom
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Sun - large, setting behind horizon
    const sunY = canvas.height * 0.55 + progress * 30; // Slowly sinking
    const sunRadius = 60;
    const sunGradient = ctx.createRadialGradient(
        canvas.width / 2, sunY, 0,
        canvas.width / 2, sunY, sunRadius * 1.5
    );
    sunGradient.addColorStop(0, '#fff5cc');
    sunGradient.addColorStop(0.3, '#ffcc00');
    sunGradient.addColorStop(0.7, '#ff8800');
    sunGradient.addColorStop(1, 'transparent');
    ctx.fillStyle = sunGradient;
    ctx.beginPath();
    ctx.arc(canvas.width / 2, sunY, sunRadius * 1.5, 0, Math.PI * 2);
    ctx.fill();

    // Sun core
    ctx.fillStyle = '#ffffcc';
    ctx.beginPath();
    ctx.arc(canvas.width / 2, sunY, sunRadius, 0, Math.PI * 2);
    ctx.fill();

    // Road - perspective lines converging to horizon
    const horizonY = canvas.height * 0.55;
    const vanishingX = canvas.width / 2;

    // Road surface
    ctx.fillStyle = '#2a2a2a';
    ctx.beginPath();
    ctx.moveTo(vanishingX, horizonY);
    ctx.lineTo(0, canvas.height);
    ctx.lineTo(canvas.width, canvas.height);
    ctx.closePath();
    ctx.fill();

    // Road markings - dashed center line receding into distance
    ctx.strokeStyle = '#ffcc00';
    ctx.lineWidth = 2;
    const numDashes = 15;
    for (let i = 0; i < numDashes; i++) {
        const t = i / numDashes;
        const perspectiveT = Math.pow(t, 1.5); // Non-linear for perspective
        const y1 = horizonY + (canvas.height - horizonY) * perspectiveT;
        const y2 = horizonY + (canvas.height - horizonY) * Math.pow((i + 0.4) / numDashes, 1.5);
        const dashWidth = 2 + (1 - perspectiveT) * 6;

        ctx.lineWidth = dashWidth;
        ctx.beginPath();
        ctx.moveTo(vanishingX, y1);
        ctx.lineTo(vanishingX, Math.min(y2, canvas.height));
        ctx.stroke();
    }

    // Traffic lights in the distance - all green, getting smaller toward horizon
    const lightPositions = [0.15, 0.25, 0.38, 0.52, 0.68];
    for (const pos of lightPositions) {
        const perspectiveT = Math.pow(pos, 1.3);
        const y = horizonY + (canvas.height - horizonY) * perspectiveT;
        const scale = 0.2 + (1 - pos) * 0.5;

        // Slightly offset from center (alternating sides)
        const sideOffset = (lightPositions.indexOf(pos) % 2 === 0 ? 1 : -1) * (80 * scale);
        const x = vanishingX + sideOffset * (1 - perspectiveT * 0.5);

        // Pole
        ctx.fillStyle = '#333';
        ctx.fillRect(x - 2 * scale, y - 50 * scale, 4 * scale, 50 * scale);

        // Light housing
        ctx.fillStyle = '#222';
        ctx.fillRect(x - 8 * scale, y - 60 * scale, 16 * scale, 25 * scale);

        // Green light - glowing
        ctx.beginPath();
        ctx.arc(x, y - 47 * scale, 5 * scale, 0, Math.PI * 2);
        ctx.fillStyle = '#44ff44';
        ctx.fill();
        ctx.shadowColor = '#44ff44';
        ctx.shadowBlur = 15 * scale;
        ctx.fill();
        ctx.shadowBlur = 0;
    }

    // Car from behind - realistic sporty coupe
    const carX = canvas.width / 2;
    const carY = canvas.height - 75;
    const W = 150;      // Car width (from behind)
    const H = 50;       // Body height
    const cabinW = W * 0.62;
    const cabinH = 38;

    // Colors - vibrant orange sports car (matching side view)
    const bodyMain = '#ff6b35';
    const bodyDark = '#cc4411';
    const bodyShine = '#ffaa77';
    const black = '#111';
    const darkGray = '#2a2a2a';

    // Wheel positions
    const wheelX1 = carX - W/2 + 18;
    const wheelX2 = carX + W/2 - 18;

    // === TIRES (draw first, behind body) ===
    const tireWidth = 14;
    const tireHeight = 8;
    ctx.fillStyle = black;
    ctx.beginPath();
    ctx.ellipse(wheelX1, carY + H, tireWidth, tireHeight, 0, 0, Math.PI);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(wheelX2, carY + H, tireWidth, tireHeight, 0, 0, Math.PI);
    ctx.fill();

    // === MAIN BODY ===
    ctx.fillStyle = bodyMain;
    ctx.beginPath();
    // Bottom left corner
    ctx.moveTo(carX - W/2 + 5, carY + H);
    // Left fender curve
    ctx.quadraticCurveTo(carX - W/2 - 2, carY + H - 10, carX - W/2, carY + H/2);
    // Left side up to shoulder
    ctx.quadraticCurveTo(carX - W/2 + 2, carY + 5, carX - W/2 + 10, carY);
    // Left shoulder to C-pillar
    ctx.lineTo(carX - cabinW/2 - 5, carY);
    // Left C-pillar - angled inward
    ctx.lineTo(carX - cabinW/2 + 5, carY - cabinH + 5);
    // Roof left curve
    ctx.quadraticCurveTo(carX - cabinW/2 + 10, carY - cabinH, carX - 15, carY - cabinH);
    // Roof center
    ctx.quadraticCurveTo(carX, carY - cabinH - 2, carX + 15, carY - cabinH);
    // Roof right curve
    ctx.quadraticCurveTo(carX + cabinW/2 - 10, carY - cabinH, carX + cabinW/2 - 5, carY - cabinH + 5);
    // Right C-pillar
    ctx.lineTo(carX + cabinW/2 + 5, carY);
    // Right shoulder
    ctx.lineTo(carX + W/2 - 10, carY);
    // Right side
    ctx.quadraticCurveTo(carX + W/2 - 2, carY + 5, carX + W/2, carY + H/2);
    // Right fender curve
    ctx.quadraticCurveTo(carX + W/2 + 2, carY + H - 10, carX + W/2 - 5, carY + H);
    ctx.closePath();
    ctx.fill();

    // === BODY SHADING (lower section darker) ===
    ctx.fillStyle = bodyDark;
    ctx.beginPath();
    ctx.moveTo(carX - W/2 + 5, carY + H);
    ctx.quadraticCurveTo(carX - W/2 - 2, carY + H - 10, carX - W/2 + 3, carY + H/2 + 10);
    ctx.lineTo(carX + W/2 - 3, carY + H/2 + 10);
    ctx.quadraticCurveTo(carX + W/2 + 2, carY + H - 10, carX + W/2 - 5, carY + H);
    ctx.closePath();
    ctx.fill();

    // === HIGHLIGHT LINE (shoulder crease) ===
    ctx.strokeStyle = bodyShine;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(carX - W/2 + 12, carY + 3);
    ctx.lineTo(carX + W/2 - 12, carY + 3);
    ctx.stroke();

    // === PEOPLE SILHOUETTES (clipped to window area) ===
    // Save context and create clipping path from window shape
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(carX - cabinW/2 + 14, carY - 8);
    ctx.quadraticCurveTo(carX - cabinW/2 + 8, carY - cabinH + 12, carX - cabinW/2 + 16, carY - cabinH + 8);
    ctx.quadraticCurveTo(carX, carY - cabinH + 2, carX + cabinW/2 - 16, carY - cabinH + 8);
    ctx.quadraticCurveTo(carX + cabinW/2 - 8, carY - cabinH + 12, carX + cabinW/2 - 14, carY - 8);
    ctx.closePath();
    ctx.clip();

    const silhouetteColor = '#1a1a2e';
    ctx.fillStyle = silhouetteColor;

    // Dad (driver - left side when viewing from behind)
    const dadX = carX - cabinW/4;
    const dadHeadY = carY - cabinH + 22;

    // Dad's head
    ctx.beginPath();
    ctx.ellipse(dadX, dadHeadY, 8, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    // Neck and shoulders
    ctx.beginPath();
    ctx.moveTo(dadX - 14, dadHeadY + 25);
    ctx.quadraticCurveTo(dadX - 10, dadHeadY + 10, dadX - 5, dadHeadY + 8);
    ctx.lineTo(dadX + 5, dadHeadY + 8);
    ctx.quadraticCurveTo(dadX + 10, dadHeadY + 10, dadX + 14, dadHeadY + 25);
    ctx.closePath();
    ctx.fill();

    // Child (passenger - right side when viewing from behind)
    const kidX = carX + cabinW/4;
    const kidHeadY = carY - cabinH + 26;

    // Child's head
    ctx.beginPath();
    ctx.arc(kidX, kidHeadY, 6, 0, Math.PI * 2);
    ctx.fill();
    // Shoulders
    ctx.beginPath();
    ctx.moveTo(kidX - 10, kidHeadY + 18);
    ctx.quadraticCurveTo(kidX - 6, kidHeadY + 7, kidX - 3, kidHeadY + 5);
    ctx.lineTo(kidX + 3, kidHeadY + 5);
    ctx.quadraticCurveTo(kidX + 6, kidHeadY + 7, kidX + 10, kidHeadY + 18);
    ctx.closePath();
    ctx.fill();

    // Restore context (removes clipping)
    ctx.restore();

    // === REAR WINDOW (drawn over silhouettes with transparency) ===
    const windowGradient = ctx.createLinearGradient(
        carX, carY - cabinH + 8,
        carX, carY - 8
    );
    // Semi-transparent sunset reflection so we can see silhouettes through
    windowGradient.addColorStop(0, 'rgba(255, 136, 85, 0.7)');
    windowGradient.addColorStop(0.3, 'rgba(255, 187, 119, 0.6)');
    windowGradient.addColorStop(0.7, 'rgba(255, 153, 85, 0.6)');
    windowGradient.addColorStop(1, 'rgba(255, 102, 51, 0.7)');
    ctx.fillStyle = windowGradient;
    ctx.beginPath();
    ctx.moveTo(carX - cabinW/2 + 14, carY - 8);
    ctx.quadraticCurveTo(carX - cabinW/2 + 8, carY - cabinH + 12, carX - cabinW/2 + 16, carY - cabinH + 8);
    ctx.quadraticCurveTo(carX, carY - cabinH + 2, carX + cabinW/2 - 16, carY - cabinH + 8);
    ctx.quadraticCurveTo(carX + cabinW/2 - 8, carY - cabinH + 12, carX + cabinW/2 - 14, carY - 8);
    ctx.closePath();
    ctx.fill();

    // Window frame (black rubber trim)
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 3;
    ctx.stroke();

    // === TAIL LIGHTS ===
    // Left tail light (wrap-around style)
    ctx.fillStyle = '#dd2222';
    ctx.beginPath();
    ctx.moveTo(carX - W/2 + 6, carY + 8);
    ctx.lineTo(carX - W/2 + 28, carY + 8);
    ctx.lineTo(carX - W/2 + 28, carY + 28);
    ctx.lineTo(carX - W/2 + 6, carY + 28);
    ctx.quadraticCurveTo(carX - W/2 + 2, carY + 18, carX - W/2 + 6, carY + 8);
    ctx.closePath();
    ctx.fill();
    // Glow
    ctx.shadowColor = '#ff3333';
    ctx.shadowBlur = 15;
    ctx.fill();
    ctx.shadowBlur = 0;
    // Light segments
    ctx.strokeStyle = '#aa1111';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(carX - W/2 + 10, carY + 12);
    ctx.lineTo(carX - W/2 + 26, carY + 12);
    ctx.moveTo(carX - W/2 + 10, carY + 18);
    ctx.lineTo(carX - W/2 + 26, carY + 18);
    ctx.moveTo(carX - W/2 + 10, carY + 24);
    ctx.lineTo(carX - W/2 + 26, carY + 24);
    ctx.stroke();

    // Right tail light (wrap-around style)
    ctx.fillStyle = '#dd2222';
    ctx.beginPath();
    ctx.moveTo(carX + W/2 - 6, carY + 8);
    ctx.lineTo(carX + W/2 - 28, carY + 8);
    ctx.lineTo(carX + W/2 - 28, carY + 28);
    ctx.lineTo(carX + W/2 - 6, carY + 28);
    ctx.quadraticCurveTo(carX + W/2 - 2, carY + 18, carX + W/2 - 6, carY + 8);
    ctx.closePath();
    ctx.fill();
    ctx.shadowColor = '#ff3333';
    ctx.shadowBlur = 15;
    ctx.fill();
    ctx.shadowBlur = 0;
    // Light segments
    ctx.strokeStyle = '#aa1111';
    ctx.beginPath();
    ctx.moveTo(carX + W/2 - 10, carY + 12);
    ctx.lineTo(carX + W/2 - 26, carY + 12);
    ctx.moveTo(carX + W/2 - 10, carY + 18);
    ctx.lineTo(carX + W/2 - 26, carY + 18);
    ctx.moveTo(carX + W/2 - 10, carY + 24);
    ctx.lineTo(carX + W/2 - 26, carY + 24);
    ctx.stroke();

    // Center light bar
    ctx.fillStyle = '#991111';
    ctx.fillRect(carX - 25, carY + 14, 50, 4);

    // === TRUNK LID LINE ===
    ctx.strokeStyle = bodyDark;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(carX - cabinW/2 + 5, carY - 3);
    ctx.lineTo(carX + cabinW/2 - 5, carY - 3);
    ctx.stroke();

    // === REAR BUMPER ===
    ctx.fillStyle = darkGray;
    ctx.beginPath();
    ctx.roundRect(carX - W/2 + 8, carY + H - 8, W - 16, 10, 3);
    ctx.fill();

    // Bumper detail/diffuser
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(carX - 35, carY + H - 6, 70, 4);

    // === EXHAUST TIPS ===
    ctx.fillStyle = '#444';
    ctx.beginPath();
    ctx.ellipse(carX - 22, carY + H + 1, 7, 4, 0, 0, Math.PI);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(carX + 22, carY + H + 1, 7, 4, 0, 0, Math.PI);
    ctx.fill();
    // Inner dark
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.ellipse(carX - 22, carY + H + 1, 5, 2.5, 0, 0, Math.PI);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(carX + 22, carY + H + 1, 5, 2.5, 0, 0, Math.PI);
    ctx.fill();

    // === LICENSE PLATE ===
    ctx.fillStyle = '#f8f8f8';
    ctx.beginPath();
    ctx.roundRect(carX - 20, carY + H - 20, 40, 11, 2);
    ctx.fill();
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    ctx.stroke();
    // Plate text hint
    ctx.fillStyle = '#333';
    ctx.font = '6px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('GRN WV', carX, carY + H - 12);

    // === BRAND BADGE (center) ===
    ctx.fillStyle = '#888';
    ctx.beginPath();
    ctx.arc(carX, carY + 32, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#666';
    ctx.beginPath();
    ctx.arc(carX, carY + 32, 3, 0, Math.PI * 2);
    ctx.fill();

    // Fade in text after a moment
    if (time > 3) {
        const textAlpha = Math.min((time - 3) / 2, 1);
        ctx.fillStyle = `rgba(255, 255, 255, ${textAlpha})`;
        ctx.font = 'italic 24px Georgia, serif';
        ctx.textAlign = 'center';
        ctx.fillText('"If you drive at just the right speed..."', canvas.width / 2, 50);
    }

    if (time > 6) {
        const textAlpha = Math.min((time - 6) / 2, 1);
        ctx.fillStyle = `rgba(255, 255, 255, ${textAlpha})`;
        ctx.font = 'italic 24px Georgia, serif';
        ctx.textAlign = 'center';
        ctx.fillText('"...you\'ll catch every green light."', canvas.width / 2, 85);
    }

    // Final message and button prompt
    if (time > 9) {
        const textAlpha = Math.min((time - 9) / 2, 1);
        ctx.fillStyle = `rgba(255, 200, 100, ${textAlpha})`;
        ctx.font = 'bold 18px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Thanks for playing', canvas.width / 2, canvas.height - 30);

        // Show the play again message
        if (time > 10) {
            showMessage(
                'The Green Wave',
                'For the drives we remember.',
                'Play Again',
                () => {
                    gameState = 'playing';
                    initLevel(1);
                }
            );
        }
    }

    ctx.textAlign = 'left'; // Reset
}

// Game loop
function gameLoop(timestamp) {
    if (!lastTimestamp) lastTimestamp = timestamp;
    const rawDeltaTime = (timestamp - lastTimestamp) / 1000;
    lastTimestamp = timestamp;

    // If delta is too large (e.g., tab was backgrounded), skip this frame
    // rather than running in slow motion or jumping ahead
    if (rawDeltaTime > 0.1) {
        if (gameState === 'ending') {
            drawEndingAnimation(endingTime);
        } else {
            draw();
        }
        requestAnimationFrame(gameLoop);
        return;
    }

    // Handle ending animation state
    if (gameState === 'ending') {
        endingTime += rawDeltaTime;
        drawEndingAnimation(endingTime);
        requestAnimationFrame(gameLoop);
        return;
    }

    update(rawDeltaTime);
    draw();

    requestAnimationFrame(gameLoop);
}

// Start the game
initLevel(1);
requestAnimationFrame(gameLoop);
