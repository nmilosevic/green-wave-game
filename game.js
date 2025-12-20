// Green Wave Game
// A puzzle game about timing traffic lights

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Display elements
const speedDisplay = document.getElementById('speedDisplay');
const lightsDisplay = document.getElementById('lightsDisplay');
const totalLightsDisplay = document.getElementById('totalLightsDisplay');
const levelDisplay = document.getElementById('levelDisplay');
const messageDiv = document.getElementById('message');
const messageTitle = document.getElementById('messageTitle');
const messageText = document.getElementById('messageText');
const messageButton = document.getElementById('messageButton');

// Game constants
const ROAD_Y = 250;
const ROAD_HEIGHT = 100;
const CAR_WIDTH = 60;
const CAR_HEIGHT = 30;
const CAR_X = 150; // Fixed screen position of the car

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
let gameState = 'playing'; // 'playing', 'won', 'lost'
let currentLevel = 1;
let carSpeed = 50; // Starting speed in km/h
let carWorldX = 0; // Car's position in the world
let lightsPassed = 0;
let trafficLights = [];
let keys = { gas: false, brake: false };

// Level definitions
// Each light has: position (x), cycle timing (greenDuration, redDuration), and phase offset
const levels = [
    {
        name: "Easy Start",
        startSpeed: 40,
        lights: [
            { x: 500, greenDuration: 3, redDuration: 2, offset: 0 },
            { x: 900, greenDuration: 3, redDuration: 2, offset: 1 },
            { x: 1300, greenDuration: 3, redDuration: 2, offset: 2 },
        ],
        finishX: 1600
    },
    {
        name: "Finding the Rhythm",
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
    if (currentLevel >= levels.length) {
        showMessage(
            'Congratulations!',
            'You mastered the Green Wave!',
            'Play Again',
            () => initLevel(1)
        );
    } else {
        showMessage(
            'Level Complete!',
            `You caught the green wave on "${levels[currentLevel - 1].name}"!`,
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

    // Check for stopped (failure)
    if (carSpeed < MIN_SPEED_THRESHOLD) {
        carSpeed = 0;
        loseGame("You stopped! Keep moving to catch the green wave.");
        return;
    }

    // Convert km/h to pixels per second (1 km/h = ~3 pixels/sec for good feel)
    const pixelsPerSecond = carSpeed * 3;

    // Move car in world
    carWorldX += pixelsPerSecond * deltaTime;

    // Check traffic lights
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
}

// Draw game
function draw() {
    // Clear canvas
    ctx.fillStyle = '#16213e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Camera offset (car stays at fixed screen position)
    const cameraX = carWorldX - CAR_X;

    // Draw sky gradient
    const skyGradient = ctx.createLinearGradient(0, 0, 0, ROAD_Y);
    skyGradient.addColorStop(0, '#0f0f23');
    skyGradient.addColorStop(1, '#1a1a3e');
    ctx.fillStyle = skyGradient;
    ctx.fillRect(0, 0, canvas.width, ROAD_Y);

    // Draw distant buildings (parallax)
    drawBuildings(cameraX * 0.3);

    // Draw road
    ctx.fillStyle = '#2d2d44';
    ctx.fillRect(0, ROAD_Y, canvas.width, ROAD_HEIGHT);

    // Draw road lines
    ctx.strokeStyle = '#4a4a5a';
    ctx.lineWidth = 2;
    ctx.setLineDash([30, 20]);
    ctx.beginPath();
    const lineOffset = -cameraX % 50;
    ctx.moveTo(lineOffset, ROAD_Y + ROAD_HEIGHT / 2);
    ctx.lineTo(canvas.width, ROAD_Y + ROAD_HEIGHT / 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw finish line
    const level = levels[currentLevel - 1];
    const finishScreenX = level.finishX - cameraX;
    if (finishScreenX > -50 && finishScreenX < canvas.width + 50) {
        ctx.fillStyle = '#4ecca3';
        ctx.fillRect(finishScreenX, ROAD_Y, 10, ROAD_HEIGHT);
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

    // Draw car
    drawCar(CAR_X, ROAD_Y + ROAD_HEIGHT / 2);

    // Draw pedal indicators
    drawPedals();
}

function drawBuildings(offset) {
    ctx.fillStyle = '#1a1a2e';
    const buildingData = [
        { w: 60, h: 80 }, { w: 40, h: 120 }, { w: 80, h: 60 },
        { w: 50, h: 100 }, { w: 70, h: 70 }, { w: 45, h: 90 },
        { w: 65, h: 85 }, { w: 55, h: 110 }, { w: 75, h: 65 },
    ];

    let x = -offset % 200 - 100;
    let buildingIndex = 0;

    while (x < canvas.width + 100) {
        const building = buildingData[buildingIndex % buildingData.length];
        ctx.fillRect(x, ROAD_Y - building.h, building.w, building.h);

        // Windows
        ctx.fillStyle = 'rgba(255, 255, 200, 0.3)';
        for (let wy = ROAD_Y - building.h + 10; wy < ROAD_Y - 10; wy += 20) {
            for (let wx = x + 8; wx < x + building.w - 8; wx += 15) {
                if (Math.random() > 0.3) {
                    ctx.fillRect(wx, wy, 8, 12);
                }
            }
        }
        ctx.fillStyle = '#1a1a2e';

        x += building.w + 30 + (buildingIndex % 3) * 20;
        buildingIndex++;
    }
}

function drawTrafficLight(screenX, light) {
    const state = getLightState(light, gameTime);
    const timeUntilChange = getTimeUntilChange(light, gameTime);

    // For blinking yellow, determine if we're in the "on" phase of the blink
    const blinkOn = state === 'blinking-yellow' && Math.floor(gameTime * 4) % 2 === 0;

    // Pole
    ctx.fillStyle = '#333';
    ctx.fillRect(screenX - 3, ROAD_Y - 140, 6, 140);

    // Light housing (taller now for 3 lights)
    ctx.fillStyle = '#222';
    ctx.fillRect(screenX - 15, ROAD_Y - 165, 30, 80);
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 2;
    ctx.strokeRect(screenX - 15, ROAD_Y - 165, 30, 80);

    // Red light (top)
    ctx.beginPath();
    ctx.arc(screenX, ROAD_Y - 145, 10, 0, Math.PI * 2);
    ctx.fillStyle = state === 'red' ? '#ff4444' : '#441111';
    ctx.fill();
    if (state === 'red') {
        ctx.shadowColor = '#ff4444';
        ctx.shadowBlur = 20;
        ctx.fill();
        ctx.shadowBlur = 0;
    }

    // Yellow light (middle)
    const yellowActive = state === 'yellow' || blinkOn;
    ctx.beginPath();
    ctx.arc(screenX, ROAD_Y - 120, 10, 0, Math.PI * 2);
    ctx.fillStyle = yellowActive ? '#ffcc00' : '#443300';
    ctx.fill();
    if (yellowActive) {
        ctx.shadowColor = '#ffcc00';
        ctx.shadowBlur = 20;
        ctx.fill();
        ctx.shadowBlur = 0;
    }

    // Green light (bottom)
    ctx.beginPath();
    ctx.arc(screenX, ROAD_Y - 95, 10, 0, Math.PI * 2);
    ctx.fillStyle = state === 'green' ? '#44ff44' : '#114411';
    ctx.fill();
    if (state === 'green') {
        ctx.shadowColor = '#44ff44';
        ctx.shadowBlur = 20;
        ctx.fill();
        ctx.shadowBlur = 0;
    }

    // Timer indicator (small bar showing time until change)
    const maxTime = getCurrentPhaseDuration(light, gameTime);
    const progress = timeUntilChange / maxTime;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.fillRect(screenX - 12, ROAD_Y - 170, 24 * progress, 3);
}

function drawCar(x, y) {
    // Car body
    ctx.fillStyle = '#4ecca3';
    ctx.beginPath();
    ctx.roundRect(x - CAR_WIDTH/2, y - CAR_HEIGHT/2, CAR_WIDTH, CAR_HEIGHT, 5);
    ctx.fill();

    // Car top
    ctx.fillStyle = '#3db892';
    ctx.beginPath();
    ctx.roundRect(x - CAR_WIDTH/4, y - CAR_HEIGHT/2 - 12, CAR_WIDTH/2, 14, 3);
    ctx.fill();

    // Windows
    ctx.fillStyle = '#87e5c5';
    ctx.fillRect(x - CAR_WIDTH/4 + 3, y - CAR_HEIGHT/2 - 9, CAR_WIDTH/2 - 6, 8);

    // Wheels
    ctx.fillStyle = '#222';
    ctx.beginPath();
    ctx.arc(x - CAR_WIDTH/3, y + CAR_HEIGHT/2 - 2, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + CAR_WIDTH/3, y + CAR_HEIGHT/2 - 2, 8, 0, Math.PI * 2);
    ctx.fill();

    // Headlight
    ctx.fillStyle = carSpeed > 0 ? '#ffff88' : '#888855';
    ctx.beginPath();
    ctx.arc(x + CAR_WIDTH/2 - 2, y - 5, 4, 0, Math.PI * 2);
    ctx.fill();

    // Brake light (when braking)
    if (keys.brake) {
        ctx.fillStyle = '#ff4444';
        ctx.shadowColor = '#ff4444';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(x - CAR_WIDTH/2 + 2, y - 5, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
    }
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

// Game loop
function gameLoop(timestamp) {
    if (!lastTimestamp) lastTimestamp = timestamp;
    const deltaTime = Math.min((timestamp - lastTimestamp) / 1000, 0.1); // Cap delta to prevent jumps
    lastTimestamp = timestamp;

    update(deltaTime);
    draw();

    requestAnimationFrame(gameLoop);
}

// Start the game
initLevel(1);
requestAnimationFrame(gameLoop);
