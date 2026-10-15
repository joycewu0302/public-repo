/**
 * Post-Future Bio-Cybernetic Creature (賽博後未來滑翔蜥蜴)
 * p5.js 3D WEBGL Simulation
 *
 * Requirements implemented & refined:
 * 1. 長得像蜥蜴 (Lizard-like reptilian anatomy and posture)
 * 2. 腳上壁虎吸盤構造：前腳改為 3 指、後腳改為 4 指，清楚分開不黏連，每指具擴展吸盤與皮褶
 *    （後腳腳掌旋轉 180°，腳趾向後）
 * 3. 嘴巴閉起，已移除尖牙 (Viper fangs removed)
 * 4. 前腳與軀幹腋下薄膜構造：止於前臂，手足完全獨立不附著
 * 5. 身體細長流線型，低風阻飛行
 * 6. 頭頂機械輔助裝置：精巧縮小尺寸，雙向前小角，頂部規律閃爍紅光點
 * 7. 精緻縮小雙眼比例
 * 8. 新增地面四腳爬行模式（蜥蜴步態：對角肢體交替、身體側向波動）
 * 9. 頭頂裝置天線改為往斜上方傾斜
 */

let canvas;

// Configuration & State
let state = {
  mode: 'gliding',         // 'gliding', 'perched', 'patrol', 'crawl'
  membraneSpread: 1.0,     // 0.5 to 1.3
  swaySpeed: 1.0,          // oscillation multiplier
  pulseRate: 1.0,          // beacon pulse frequency multiplier
  wireframe: false,
  showStreamlines: true,
  streamlineSpeed: 14.0,
  cameraTargetFeature: null
};

// Camera interpolation
let cam = {
  rotX: -0.35,
  rotY: 0.65,
  dist: 460,
  targetRotX: -0.35,
  targetRotY: 0.65,
  targetDist: 460,
  panX: 0,
  panY: -20,
  targetPanX: 0,
  targetPanY: -20
};

// Wind tunnel streamline particles
let streamlines = [];
const NUM_STREAMLINES = 90;

// Creature dimensions & spine definition
const BODY_SEGMENTS = 10;
const TAIL_SEGMENTS = 16;

function setup() {
  const container = document.getElementById('canvas-container');
  canvas = createCanvas(windowWidth, windowHeight, WEBGL);
  canvas.parent('canvas-container');
  
  // Set up streamline particles
  for (let i = 0; i < NUM_STREAMLINES; i++) {
    streamlines.push(createStreamlineParticle(true));
  }

  noStroke();
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}

function createStreamlineParticle(randomZ = false) {
  return {
    x: random(-180, 180),
    y: random(-100, 100),
    z: randomZ ? random(-250, 250) : 280,
    speed: random(10, 18),
    len: random(30, 70),
    opacity: random(60, 190)
  };
}

// ----------------------------------------------------
// MAIN DRAW LOOP
// ----------------------------------------------------
function draw() {
  background(7, 11, 18);

  // Smooth camera interpolation towards target
  updateCamera();

  // Dynamic Lighting setup
  setupLighting();

  // Streamlines (Wind tunnel aerodynamics visualization)
  // 壁面吸附 / 地面爬行模式拿掉速度線
  if (state.showStreamlines && state.mode !== 'perched' && state.mode !== 'crawl') {
    drawStreamlines();
  }

  // Time & Animation phases
  const t = millis() * 0.003 * state.swaySpeed;

  push();
  // Apply camera matrix
  translate(cam.panX, cam.panY, 0);

  // Draw Ground / Wall surface（與鏡頭平移框架同步，牆面/地面不隨生物旋轉）
  if (state.mode === 'perched' || state.mode === 'crawl') {
    drawPerchSurface();
  }

  // Global creature orientation (flying forward along +Z)
  if (state.mode === 'gliding') {
    let pitch = sin(t * 0.7) * 0.04 - 0.05;
    let roll = cos(t * 0.5) * 0.05;
    let bob = sin(t * 1.2) * 8;
    translate(0, bob, 0);
    rotateX(pitch);
    rotateZ(roll);
  } else if (state.mode === 'perched') {
    // 壁面吸附：身體轉為與 ZY 平面（垂直牆面）平行，腹部貼向牆面
    // 稍微拉開，確保所有腳趾與身體、頭部皆在同一側，不穿牆
    translate(-130, 0, 0);
    rotateZ(HALF_PI);
  } else if (state.mode === 'patrol') {
    let roll = sin(t * 1.5) * 0.2;
    let yaw = cos(t * 0.8) * 0.15;
    rotateZ(roll);
    rotateY(yaw);
  } else if (state.mode === 'crawl') {
    // 貼近地面四腳爬行：身體與地面平行（水平姿勢），四肢水平貼地
    // 生物整體在Y=70，地面在Y=85，使軀幹貼近地面但不穿模
    translate(0, 70, 0);
    // 側向擺動幅度配合步態
    rotateZ(sin(t * 3.0) * 0.06);
  }

  // Render the Creature
  drawCreature(t);

  pop();

  // Update Telemetry Display
  updateTelemetryUI(t);
}

// ----------------------------------------------------
// CAMERA & CONTROLS
// ----------------------------------------------------
function updateCamera() {
  cam.rotX = lerp(cam.rotX, cam.targetRotX, 0.08);
  cam.rotY = lerp(cam.rotY, cam.targetRotY, 0.08);
  cam.dist = lerp(cam.dist, cam.targetDist, 0.08);
  cam.panX = lerp(cam.panX, cam.targetPanX, 0.08);
  cam.panY = lerp(cam.panY, cam.targetPanY, 0.08);

  // Manual mouse rotation if dragging canvas
  if (mouseIsPressed && mouseY > 60 && mouseX < windowWidth - 340) {
    let dx = (mouseX - pmouseX) * 0.008;
    let dy = (mouseY - pmouseY) * 0.008;
    if (mouseButton === LEFT) {
      cam.targetRotY += dx;
      cam.targetRotX = constrain(cam.targetRotX - dy, -1.4, 1.4);
    } else if (mouseButton === RIGHT || keyIsDown(SHIFT)) {
      cam.targetPanX += dx * 60;
      cam.targetPanY += dy * 60;
    }
  }

  let eyeX = cam.dist * sin(cam.rotY) * cos(cam.rotX);
  let eyeY = cam.dist * sin(cam.rotX);
  let eyeZ = cam.dist * cos(cam.rotY) * cos(cam.rotX);

  camera(eyeX, eyeY, eyeZ, 0, 0, 0, 0, 1, 0);
}

function mouseWheel(event) {
  if (mouseX < windowWidth - 340) {
    cam.targetDist = constrain(cam.targetDist + event.delta * 0.5, 110, 900);
    return false;
  }
}

// ----------------------------------------------------
// LIGHTING SETUP
// ----------------------------------------------------
function setupLighting() {
  ambientLight(45, 55, 75);

  directionalLight(180, 210, 240, 0.6, 1, -0.7);
  directionalLight(20, 80, 100, -0.5, -1, 0.5);

  // Dynamic Pulsing Red Beacon Light on the head device
  let beaconTime = millis() * 0.004 * state.pulseRate;
  let beaconPulse = pow(sin(beaconTime), 4);
  let beaconR = 255 * (0.35 + 0.65 * beaconPulse);

  pointLight(beaconR, 20 * beaconPulse, 30 * beaconPulse, 0, -28, 95);
  pointLight(50, 100, 140, 0, -100, -200);
}

// ----------------------------------------------------
// THE CREATURE MODEL
// ----------------------------------------------------
function drawCreature(t) {
  // 1. Calculate Spine Vertebrae Coordinates
  let spine = [];
  for (let i = 0; i < BODY_SEGMENTS; i++) {
    let segFrac = i / (BODY_SEGMENTS - 1);
    let z = map(segFrac, 0, 1, 80, -60);
    
    let waveAmp = state.mode === 'perched' ? 1.5 : (state.mode === 'crawl' ? 3 : 5);
    let waveX = sin(t * 1.5 - i * 0.3) * waveAmp;
    let waveY = cos(t * 1.2 - i * 0.2) * (waveAmp * (state.mode === 'crawl' ? 0.2 : 0.4));

    let w, h;
    if (segFrac < 0.25) {
      w = lerp(16, 28, segFrac / 0.25);
      h = lerp(12, 18, segFrac / 0.25);
    } else if (segFrac < 0.65) {
      let chestFrac = (segFrac - 0.25) / 0.4;
      w = 28 + sin(chestFrac * PI) * 5;
      h = 18 + sin(chestFrac * PI) * 3;
    } else {
      let waistFrac = (segFrac - 0.65) / 0.35;
      w = lerp(28, 18, waistFrac);
      h = lerp(18, 13, waistFrac);
    }

    spine.push({ x: waveX, y: waveY, z: z, w: w, h: h });
  }

  // 2. Calculate Tail Vertebrae Coordinates
  let tail = [];
  let lastSpine = spine[spine.length - 1];
  for (let i = 0; i < TAIL_SEGMENTS; i++) {
    let tailFrac = i / (TAIL_SEGMENTS - 1);
    let z = lastSpine.z - (i + 1) * 11;
    
    let swayAmp = map(tailFrac, 0, 1, 4, 32) * (state.mode === 'crawl' ? 0.45 : 1.0);
    let tailX = sin(t * 1.8 - i * 0.35) * swayAmp;
    let tailY = cos(t * 1.5 - i * 0.3) * (swayAmp * 0.25);

    let w = lerp(16, 2.0, tailFrac);
    let h = lerp(12, 1.8, tailFrac);

    tail.push({ x: tailX, y: tailY, z: z, w: w, h: h });
  }

  // Render components
  drawStreamlinedTorso(spine);
  drawAerodynamicTail(tail, spine[spine.length - 1]);
  drawHeadAndCyberModule(spine[0], t);
  drawLimbsAndMembranes(spine, t);
}

// ----------------------------------------------------
// 1 & 5. STREAMLINED TORSO & SPINAL KEEL
// ----------------------------------------------------
function drawStreamlinedTorso(spine) {
  applyMaterial('bio-scale');

  for (let i = 0; i < spine.length - 1; i++) {
    let curr = spine[i];
    let next = spine[i + 1];

    push();
    translate((curr.x + next.x) * 0.5, (curr.y + next.y) * 0.5, (curr.z + next.z) * 0.5);

    let dz = next.z - curr.z;
    let dx = next.x - curr.x;
    let dy = next.y - curr.y;
    let len = sqrt(dx * dx + dy * dy + dz * dz);
    let pitch = -atan2(dy, -dz);
    let yaw = atan2(dx, -dz);

    rotateY(yaw);
    rotateX(pitch);

    let avgW = (curr.w + next.w) * 0.5;
    let avgH = (curr.h + next.h) * 0.5;

    // Torso segment
    push();
    scale(avgW, avgH, len * 0.55);
    if (state.wireframe) {
      stroke(0, 240, 255, 120);
      strokeWeight(1);
      noFill();
    }
    sphere(1, 12, 10);
    pop();

    // Dorsal Spinal Keel
    push();
    translate(0, -avgH * 0.95, 0);
    applyMaterial('cyber-keel');
    rotateX(HALF_PI);
    cone(avgW * 0.18, len * 0.9, 4);
    pop();

    // Ventral streamline plate
    push();
    translate(0, avgH * 0.85, 0);
    applyMaterial('bio-belly');
    box(avgW * 0.65, avgH * 0.25, len * 0.9);
    pop();

    pop();
  }
}

// ----------------------------------------------------
// 5. AERODYNAMIC TAIL WITH FLIGHT STABILIZER VANES
// ----------------------------------------------------
function drawAerodynamicTail(tail, hipNode) {
  applyMaterial('bio-scale');

  let prev = hipNode;
  for (let i = 0; i < tail.length; i++) {
    let curr = tail[i];

    push();
    translate((prev.x + curr.x) * 0.5, (prev.y + curr.y) * 0.5, (prev.z + curr.z) * 0.5);

    let dz = curr.z - prev.z;
    let dx = curr.x - prev.x;
    let dy = curr.y - prev.y;
    let len = sqrt(dx * dx + dy * dy + dz * dz);

    rotateY(atan2(dx, -dz));
    rotateX(-atan2(dy, -dz));

    let avgW = (prev.w + curr.w) * 0.5;
    let avgH = (prev.h + curr.h) * 0.5;

    push();
    scale(avgW, avgH, len * 0.55);
    if (state.wireframe) {
      stroke(0, 240, 255, 100);
      noFill();
    }
    sphere(1, 8, 6);
    pop();

    // Posterior Tail Stabilizer Fins
    if (i >= tail.length - 4) {
      let finSpan = map(i, tail.length - 4, tail.length - 1, 16, 24);
      let finThickness = 1.2;

      push();
      applyMaterial('membrane');
      push();
      translate(-finSpan * 0.5, 0, 0);
      rotateY(-0.1);
      box(finSpan, finThickness, len * 0.95);
      pop();

      push();
      translate(finSpan * 0.5, 0, 0);
      rotateY(0.1);
      box(finSpan, finThickness, len * 0.95);
      pop();

      push();
      translate(0, -avgH * 1.5, 0);
      box(finThickness, avgH * 2.5, len * 0.8);
      pop();
      pop();
    }

    pop();
    prev = curr;
  }
}

// ----------------------------------------------------
// 1, 3, 6, 7. HEAD, JAWS, CYBER MODULE & SMALL EYES
// ----------------------------------------------------
function drawHeadAndCyberModule(neckNode, t) {
  push();
  translate(neckNode.x, neckNode.y, neckNode.z);

  let lookYaw = sin(t * 1.1) * 0.05;
  let lookPitch = cos(t * 0.9) * 0.03 - 0.02;
  rotateY(lookYaw);
  rotateX(lookPitch);

  push();
  translate(0, -2, 22);

  // Main Cranium
  applyMaterial('bio-head');
  push();
  scale(17, 10, 22);
  sphere(1, 14, 12);
  pop();

  // Tapered Snout
  push();
  translate(0, 1, 18);
  scale(11, 7, 16);
  sphere(1, 12, 10);
  pop();

  // Snout Tip
  push();
  translate(0, 2, 32);
  scale(7, 4.5, 6);
  sphere(1, 10, 8);
  pop();

  // 7. Refined Smaller Reptile Eyes (縮小比例的雙眼)
  drawReptileEyes();

  // 3. Closed mouth lower jaw
  push();
  translate(0, 5, 14);
  applyMaterial('bio-belly');
  push();
  scale(13, 3.8, 22);
  sphere(1, 12, 10);
  pop();
  pop();

  // 6. Compact Cyber Module (縮小尺寸的頭頂機械裝置與紅光)
  drawCyberModule(t);

  pop(); // End Head
  pop(); // End Neck
}

// ----------------------------------------------------
// 7. REFINED SMALLER REPTILE EYES (縮小尺寸的眼睛)
// ----------------------------------------------------
function drawReptileEyes() {
  const eyeX = 13.5;
  const eyeY = -3.2;
  const eyeZ = 13;

  for (let s of [-1, 1]) {
    push();
    translate(s * eyeX, eyeY, eyeZ);
    rotateY(s * 0.42);

    // Eye socket brow scale ridge (縮小保護鱗褶)
    applyMaterial('cyber-keel');
    push();
    scale(2.8, 2.0, 3.8);
    sphere(1, 8, 8);
    pop();

    // Glowing Reptilian Eyeball (縮小的精緻眼球)
    push();
    translate(s * 0.8, 0, 0);
    emissiveMaterial(255, 180, 20);
    sphere(1.35, 10, 10);

    // Slit pupil
    translate(s * 0.6, 0, 0);
    fill(10, 10, 15);
    scale(0.25, 1.2, 0.45);
    sphere(1, 6, 6);
    pop();

    pop();
  }
}

// ----------------------------------------------------
// 6. COMPACT CYBERNETIC MODULE WITH DUAL HORNS & RED BEACON
// ----------------------------------------------------
function drawCyberModule(t) {
  push();
  // Mounted directly atop cranium crown (緊湊貼合頭頂)
  translate(0, -9.2, 10);

  // 1. Sleek Compact Cyber Chassis (縮小尺寸的微型航空模組)
  applyMaterial('cyber-metal');

  // Base mounting brackets
  push();
  translate(0, 1.2, 0);
  box(9.5, 1.8, 12);
  pop();

  // Main Avionics Housing
  push();
  translate(0, -0.6, 0);
  box(7.5, 2.8, 9.5);
  pop();

  // Upper sensor dome deck
  push();
  translate(0, -2.4, 0.5);
  box(5.0, 1.4, 6.5);
  pop();

  // Micro side heat vents
  push();
  translate(0, -0.6, 0);
  for (let s of [-3.9, 3.9]) {
    push();
    translate(s, 0, 0);
    emissiveMaterial(0, 240, 255);
    box(0.35, 1.2, 5.5);
    pop();
  }
  pop();

  // --------------------------------------------------
  // 6A. TWO FORWARD-POINTING HORNS (精緻縮小的向前雙角)
  // --------------------------------------------------
  const hornRoots = [-2.4, 2.4];
  for (let hx of hornRoots) {
    push();
    translate(hx, -2.2, 5.0);

    let hornYaw = (hx > 0 ? 0.20 : -0.20);
    let hornPitch = 0.30; // 天線往斜上方傾斜，尖端微微指向上方
    rotateY(hornYaw);
    rotateX(hornPitch);

    applyMaterial('cyber-horn');

    // Cyber horn base socket
    push();
    rotateX(HALF_PI);
    cylinder(0.95, 1.6, 8);
    pop();

    // Segmented tapered forward horn/antenna
    push();
    translate(0, 0, 3.2);
    rotateX(HALF_PI);
    cone(0.8, 6.2, 8); // Points forward along +Z, length 6.2
    pop();

    // Cyan sensor accent ring
    push();
    translate(0, 0, 2.4);
    emissiveMaterial(0, 240, 255);
    rotateX(HALF_PI);
    torus(0.72, 0.18, 6, 10);
    pop();

    // Horn tip
    push();
    translate(0, 0, 6.4);
    emissiveMaterial(0, 240, 255);
    sphere(0.28, 6, 6);
    pop();

    pop();
  }

  // --------------------------------------------------
  // 6B. TOP PULSING RED BEACON LIGHT (裝置正上方規律發紅光小點)
  // --------------------------------------------------
  push();
  translate(0, -3.4, 0.5);

  let pulseFreq = t * 1.6 * state.pulseRate;
  let blinkCycle = (sin(pulseFreq) + 1) * 0.5;
  let strobeIntensity = pow(sin(pulseFreq), 8);
  let totalPulse = constrain(blinkCycle * 0.4 + strobeIntensity * 0.9, 0.15, 1.0);

  // Micro bezel collar
  applyMaterial('cyber-metal');
  push();
  rotateX(HALF_PI);
  cylinder(1.6, 0.8, 10);
  pop();

  // Pulsing Red Diode (小巧精確的微型紅光點)
  push();
  translate(0, -0.6, 0);
  let redR = 255;
  let redG = 20 * totalPulse;
  let redB = 35 * totalPulse;

  emissiveMaterial(redR, redG, redB);
  sphere(0.65, 10, 8); // 紅點縮小

  // Outer Glowing Glass Lens
  if (!state.wireframe) {
    push();
    emissiveMaterial(redR, redG, redB);
    scale(0.85 + 0.18 * totalPulse);
    sphere(0.8, 8, 6);
    pop();
  }
  pop();

  pop(); // End Beacon
  pop(); // End Cyber Module
}

// ----------------------------------------------------
// 2 & 4. LIMBS, GECKO SUCTION TOES & GLIDING PATAGIUM
// ----------------------------------------------------
function drawLimbsAndMembranes(spine, t) {
  let shoulderNode = spine[2];
  let hipNode = spine[8];

  let forelimbJoints = { left: {}, right: {} };

  // --------------------------------------------------
  // FORELIMBS (FRONT LEGS) - 前肢
  // --------------------------------------------------
  for (let s of [-1, 1]) {
    let sideName = s === -1 ? 'left' : 'right';

    push();
    let shoulderX = shoulderNode.x + s * (shoulderNode.w * 0.85);
    let shoulderY = shoulderNode.y + 1;
    let shoulderZ = shoulderNode.z;
    translate(shoulderX, shoulderY, shoulderZ);

    let humerusAngleY, humerusAngleX, elbowAngleY, elbowAngleX;

    if (state.mode === 'gliding') {
      let flutter = sin(t * 2.2 + s * 0.5) * 0.06;
      humerusAngleY = s * (1.1 * state.membraneSpread + flutter);
      humerusAngleX = -0.15;
      elbowAngleY = s * 0.35;
      elbowAngleX = 0.1;
    } else if (state.mode === 'perched') {
      // 壁面吸附：前腳貼向牆面
      // rotateZ(HALF_PI) + rotateX(-θ) → 前腳(+Z)的Y分量=sin(θ) → 局部+Y → 全局-X（朝牆）
      // 計算：shoulder 全局X≈-141，需偏移-19到牆面X=-160
      // θH=θE=0.20 → 34*sin(0.20)+28*sin(0.40) ≈ 6.7+10.9 = 17.6（腕部≈-158.6，貼近牆）
      humerusAngleY = s * 0.75;      // 四肢沿牆面橫向張開
      humerusAngleX = -0.22;         // 負值讓前腳往牆方向（局部+Y）彎曲
      elbowAngleY = s * 0.30;        // 前臂繼續沿牆面展開
      elbowAngleX = -0.08;           // 肘部微彎，手法端接觸牆面
    } else if (state.mode === 'crawl') {
      // 蜥蜴四腳爬行步態（對角步態）：前左+後右同相，前右+後左同相
      // foreStep: s=1時為sin(t*3)，s=-1時為sin(t*3+PI)，確保對角配對
      // 地面爬行：對角步態（左前+右後同相，右前+左後同相）
      // 擺動腳從「彎曲」變為「向前伸直」，支撐腳維持彎曲
      let walkPhase = sin(t * 2.4);
      let foreSwingRaw = (s < 0) ? walkPhase : -walkPhase;
      let foreSwingAmt = constrain(max(0, foreSwingRaw), 0, 1);
      // 水平姿勢：四肢與地面平行（X 角度 = 0），以 Y 軸掃動前後
      humerusAngleY = lerp(s * 0.72, s * 0.28, foreSwingAmt);
      humerusAngleX = 0;
      elbowAngleY = lerp(s * 0.32, s * 0.10, foreSwingAmt);
      elbowAngleX = 0;
    } else { // patrol
      let step = sin(t * 2.0 + (s > 0 ? 0 : PI)) * 0.4;
      humerusAngleY = s * (0.8 + step * 0.2);
      humerusAngleX = step * 0.3;
      elbowAngleY = s * 0.4;
      elbowAngleX = -step * 0.2;
    }

    applyMaterial('bio-limb');
    rotateY(humerusAngleY);
    rotateX(humerusAngleX);

    let humerusLen = 34;
    push();
    translate(0, 0, humerusLen * 0.5);
    scale(5.0, 3.8, humerusLen * 0.5);
    sphere(1, 10, 8);
    pop();

    // Elbow Joint
    translate(0, 0, humerusLen);
    push();
    scale(4.2, 3.4, 4.2);
    sphere(1, 8, 8);
    pop();

    // Forearm
    rotateY(elbowAngleY);
    rotateX(elbowAngleX);

    let forearmLen = 28;
    push();
    translate(0, 0, forearmLen * 0.5);
    scale(4.0, 3.0, forearmLen * 0.5);
    sphere(1, 10, 8);
    pop();

    // Wrist
    translate(0, 0, forearmLen);

    forelimbJoints[sideName] = {
      shoulder: { x: shoulderX, y: shoulderY, z: shoulderZ },
      humerusAngleY: humerusAngleY,
      humerusAngleX: humerusAngleX,
      elbowAngleY: elbowAngleY,
      elbowAngleX: elbowAngleX
    };

    // ------------------------------------------------
    // 2. GECKO FOOT - FORELEG (前腳三指，清楚分開不黏連)
    // ------------------------------------------------
    drawGeckoFoot(s, true, t);

    pop();
  }

  // --------------------------------------------------
  // 4. AXILLARY GLIDING PATAGIUM (腋下滑翔薄膜 - 獨立於手足)
  // 爬行模式時薄膜收折貼身，仍可見但展開幅度縮小
  // --------------------------------------------------
  drawGlidingMembrane(spine, forelimbJoints, t);

  // --------------------------------------------------
  // HINDLIMBS (BACK LEGS) - 後肢
  // --------------------------------------------------
  for (let s of [-1, 1]) {
    push();
    let hipX = hipNode.x + s * (hipNode.w * 0.8);
    let hipY = hipNode.y + 1;
    let hipZ = hipNode.z;
    translate(hipX, hipY, hipZ);

    let thighAngleY, thighAngleX, kneeAngleY, kneeAngleX;

    if (state.mode === 'gliding') {
      thighAngleY = s * 0.45;
      thighAngleX = 0.25;
      kneeAngleY = s * 0.2;
      kneeAngleX = 0.1;
    } else if (state.mode === 'perched') {
      // 壁面吸附：後腳沿牆面（ZY 平面）展開，不超過牆面（X=-160）
      // rotateZ(HALF_PI) 後，後腳 thighAngleX 正值 → 腳往局部+Y → 全局-X（朝牆）
      // 計算：hip全局X≈-141，腿長58，需讓腳端X≥-160（偏移≤19），角度≤arcsin(19/58)≈0.33
      thighAngleY = -s * 0.75;      // 腳沿牆面橫向展開（Z方向）
      thighAngleX = 0.28;          // 角度讓腳掌貼近牆面但不穿越（0.38會穿牆）
      kneeAngleY = -s * 0.3;       // 膝蓋以下繼續橫向展開
      kneeAngleX = 0.08;           // 微小回折，腳掌幾乎與牆面平行貼齊
    } else if (state.mode === 'crawl') {
      // 後腳與對側前腳同時發力（蜥蜴對角步態）
      // hindStep: s=1時為sin(t*3+PI)，s=-1時為sin(t*3+0)，與前腳形成對角配對
      // 地面爬行：後腳與對側前腳同相擺動，後腿往前轉帶動整腳向前
      let hindSwingRaw = (s > 0) ? sin(t * 2.4) : -sin(t * 2.4);
      let hindSwingAmt = constrain(max(0, hindSwingRaw), 0, 1);
      // 水平姿勢：四肢與地面平行（X 角度 = 0），以 Y 軸掃動前後
      thighAngleY = lerp(-s * 0.72, -s * 0.28, hindSwingAmt);
      thighAngleX = 0;
      kneeAngleY = lerp(-s * 0.32, -s * 0.10, hindSwingAmt);
      kneeAngleX = 0;
    } else { // patrol
      let step = sin(t * 2.0 + (s > 0 ? PI : 0)) * 0.4;
      thighAngleY = s * (0.5 + step * 0.2);
      thighAngleX = -step * 0.3;
      kneeAngleY = s * 0.3;
      kneeAngleX = step * 0.2;
    }

    applyMaterial('bio-limb');
    rotateY(thighAngleY);
    rotateX(thighAngleX);

    let femurLen = 32;
    push();
    translate(0, 0, -femurLen * 0.5);
    scale(5.2, 4.0, femurLen * 0.5);
    sphere(1, 10, 8);
    pop();

    // Knee
    translate(0, 0, -femurLen);
    push();
    scale(4.2, 3.4, 4.2);
    sphere(1, 8, 8);
    pop();

    // Shin
    rotateY(kneeAngleY);
    rotateX(kneeAngleX);
    let tibiaLen = 26;
    push();
    translate(0, 0, -tibiaLen * 0.5);
    scale(3.8, 2.8, tibiaLen * 0.5);
    sphere(1, 10, 8);
    pop();

    // Ankle
    translate(0, 0, -tibiaLen);

    // ------------------------------------------------
    // 2. GECKO FOOT - HINDLEG (後腳四指，清楚分開不黏連)
    // ------------------------------------------------
    drawGeckoFoot(s, false, t);

    pop();
  }
}

// ----------------------------------------------------
// 4. PATAGIUM GLIDING MEMBRANE (腋下薄膜構造)
// ----------------------------------------------------
function drawGlidingMembrane(spine, forelimbJoints, t) {
  // Spans strictly between torso flanks (axilla/ribcage) and forelimb (upper arm & elbow)
  // Stops before the wrist so hands and toes remain 100% free and detached
  for (let s of [-1, 1]) {
    let sideName = s === -1 ? 'left' : 'right';
    let fj = forelimbJoints[sideName];
    if (!fj.shoulder) continue;

    push();
    applyMaterial('membrane');

    let humerusAngleY = fj.humerusAngleY;
    let humerusAngleX = fj.humerusAngleX;

    let sX = fj.shoulder.x;
    let sY = fj.shoulder.y;
    let sZ = fj.shoulder.z;

    let hLen = 34;
    let eX = sX + hLen * sin(humerusAngleY) * cos(humerusAngleX);
    let eY = sY - hLen * sin(humerusAngleX);
    let eZ = sZ + hLen * cos(humerusAngleY) * cos(humerusAngleX);

    // Mid-forearm target (stops well before wrist to prevent any webbing on hands!)
    let midForearmLen = 14;
    let totalArmY = humerusAngleY + fj.elbowAngleY;
    let totalArmX = humerusAngleX + fj.elbowAngleX;
    let mX = eX + midForearmLen * sin(totalArmY) * cos(totalArmX);
    let mY = eY - midForearmLen * sin(totalArmX);
    let mZ = eZ + midForearmLen * cos(totalArmY) * cos(totalArmX);

    let ribNodes = [
      { x: spine[1].x + s * spine[1].w * 0.8, y: spine[1].y, z: spine[1].z }, // Axilla apex
      { x: spine[2].x + s * spine[2].w * 0.9, y: spine[2].y, z: spine[2].z },
      { x: spine[3].x + s * spine[3].w * 0.95, y: spine[3].y, z: spine[3].z },
      { x: spine[4].x + s * spine[4].w * 0.9, y: spine[4].y, z: spine[4].z },
      { x: spine[5].x + s * spine[5].w * 0.8, y: spine[5].y, z: spine[5].z }  // Posterior flank
    ];

    let flutterSpeed = t * 2.8;
    let flutterAmp = state.mode === 'gliding' ? 3.6 : 1.2;

    let innerVerts = [];
    let outerVerts = [];

    for (let i = 0; i < ribNodes.length; i++) {
      let rNode = ribNodes[i];
      let frac = i / (ribNodes.length - 1);

      // Arm leading edge: Shoulder -> Elbow -> Mid-forearm
      let armX, armY, armZ;
      if (frac < 0.6) {
        let f2 = frac / 0.6;
        armX = lerp(sX, eX, f2);
        armY = lerp(sY, eY, f2);
        armZ = lerp(sZ, eZ, f2);
      } else {
        let f2 = (frac - 0.6) / 0.4;
        armX = lerp(eX, mX, f2);
        armY = lerp(eY, mY, f2);
        armZ = lerp(eZ, mZ, f2);
      }

      let wave = sin(flutterSpeed - frac * PI * 1.5) * flutterAmp;
      innerVerts.push({ x: rNode.x, y: rNode.y + wave * 0.3, z: rNode.z });
      outerVerts.push({ x: armX, y: armY + wave, z: armZ });
    }

    // Front-Facing Surface
    beginShape(TRIANGLE_STRIP);
    for (let i = 0; i < ribNodes.length; i++) {
      vertex(innerVerts[i].x, innerVerts[i].y, innerVerts[i].z);
      vertex(outerVerts[i].x, outerVerts[i].y, outerVerts[i].z);
    }
    endShape();

    // Back-Facing Surface (for complete visibility from below)
    beginShape(TRIANGLE_STRIP);
    for (let i = ribNodes.length - 1; i >= 0; i--) {
      vertex(outerVerts[i].x, outerVerts[i].y, outerVerts[i].z);
      vertex(innerVerts[i].x, innerVerts[i].y, innerVerts[i].z);
    }
    endShape();

    // Structural biomechanical rays
    stroke(0, 240, 255, 95);
    strokeWeight(1.3);
    for (let i = 1; i < ribNodes.length; i++) {
      line(innerVerts[i].x, innerVerts[i].y, innerVerts[i].z, outerVerts[i].x, outerVerts[i].y, outerVerts[i].z);
    }
    noStroke();

    pop();
  }
}

// ----------------------------------------------------
// 2. GECKO FOOT (壁虎腳掌：前腳3指、後腳4指，清晰分開獨立)
// ----------------------------------------------------
function drawGeckoFoot(side, isFront, t) {
  push();
  // 後腳：腳掌旋轉 180°，改成腳趾向後（-Z）的形式
  if (!isFront) {
    rotateY(PI);
  }

  // Palmar wrist/ankle base
  applyMaterial('bio-foot');
  push();
  scale(3.8, 1.8, 3.2);
  sphere(1, 8, 8);
  pop();

  // Distinct Toe Configurations:
  // 前腳：3 指 (Front: 3 Toes)
  // 後腳：4 指 (Back: 4 Toes)
  let toeAngles, toeLengths;
  if (isFront) {
    // 3 Toes: wide splay to ensure zero overlap/clumping
    toeAngles = [-0.55, 0.0, 0.55]; // approx -32°, 0°, +32°
    toeLengths = [12, 16, 12];
  } else {
    // 4 Toes: evenly spaced fan
    toeAngles = [-0.62, -0.21, 0.21, 0.62]; // approx -36°, -12°, +12°, +36°
    toeLengths = [11, 15, 15, 11];
  }

  for (let i = 0; i < toeAngles.length; i++) {
    let angle = toeAngles[i];
    let tLen = toeLengths[i];

    push();
    rotateY(angle);

    // Slender independent toe stem (細長分開的指骨)
    applyMaterial('bio-foot');
    push();
    translate(0, 0, tLen * 0.45);
    scale(1.1, 0.8, tLen * 0.45);
    sphere(1, 6, 6);
    pop();

    // ------------------------------------------------
    // GECKO SCANSOR / SUCTION DISC PAD (壁虎吸盤肉墊)
    // ------------------------------------------------
    push();
    translate(0, 0.3, tLen); // Distal tip of the toe

    // Flattened Oval Suction Pad (比例適中獨立的吸盤)
    applyMaterial('gecko-pad');
    push();
    scale(2.0, 0.7, 2.6);
    sphere(1, 8, 8);
    pop();

    // Adhesive Lamellae Underneath (吸盤底部微褶剛毛)
    push();
    translate(0, 0.55, 0);
    applyMaterial('gecko-lamellae');
    for (let r = -1; r <= 1; r++) {
      push();
      translate(0, 0, r * 0.8);
      scale(1.6, 0.2, 0.2);
      box(1, 1, 1);
      pop();
    }
    pop();

    // Suction Seal Rim (獨立環形吸附邊緣)
    push();
    translate(0, 0.35, 0);
    emissiveMaterial(0, 240, 255);
    rotateX(HALF_PI);
    torus(1.4, 0.16, 6, 10);
    pop();

    // Micro-Claw on top (趾端微爪)
    push();
    translate(0, -0.45, 1.4);
    rotateX(-0.5);
    applyMaterial('fang');
    cone(0.45, 2.2, 6);
    pop();

    pop(); // End Suction Pad

    pop(); // End Individual Toe
  }

  pop(); // End Foot
}

// ----------------------------------------------------
// MATERIALS & SHADERS
// ----------------------------------------------------
function applyMaterial(type) {
  if (state.wireframe) {
    stroke(0, 240, 255, 140);
    strokeWeight(1);
    noFill();
    return;
  }

  noStroke();

  switch (type) {
    case 'bio-scale':
      specularMaterial(24, 75, 68);
      shininess(40);
      ambientMaterial(16, 48, 42);
      break;

    case 'bio-head':
      specularMaterial(30, 90, 80);
      shininess(50);
      ambientMaterial(18, 55, 48);
      break;

    case 'bio-belly':
      specularMaterial(60, 110, 100);
      shininess(30);
      ambientMaterial(35, 75, 68);
      break;

    case 'bio-limb':
      specularMaterial(26, 72, 65);
      shininess(35);
      ambientMaterial(18, 50, 44);
      break;

    case 'bio-foot':
      specularMaterial(35, 95, 85);
      shininess(25);
      ambientMaterial(22, 62, 55);
      break;

    case 'gecko-pad':
      specularMaterial(0, 180, 190);
      shininess(60);
      ambientMaterial(0, 120, 130);
      break;

    case 'gecko-lamellae':
      specularMaterial(0, 230, 245);
      shininess(80);
      ambientMaterial(0, 150, 160);
      break;

    case 'membrane':
      specularMaterial(10, 140, 150);
      shininess(70);
      ambientMaterial(8, 70, 85);
      break;

    case 'cyber-keel':
      specularMaterial(40, 50, 60);
      shininess(80);
      ambientMaterial(20, 26, 32);
      break;

    case 'cyber-metal':
      specularMaterial(140, 150, 170);
      shininess(90);
      ambientMaterial(30, 36, 44);
      break;

    case 'cyber-horn':
      specularMaterial(170, 185, 205);
      shininess(100);
      ambientMaterial(45, 52, 65);
      break;

    case 'fang':
      specularMaterial(250, 250, 245);
      shininess(100);
      ambientMaterial(220, 220, 210);
      break;
  }
}

// ----------------------------------------------------
// STREAMLINES (AERODYNAMIC FLOW TUNNEL PARTICLES)
// ----------------------------------------------------
function drawStreamlines() {
  push();
  strokeWeight(1.5);
  for (let p of streamlines) {
    p.z -= p.speed * (state.streamlineSpeed * 0.1);
    if (p.z < -280) {
      Object.assign(p, createStreamlineParticle(false));
    }

    let bodyDist = sqrt(p.x * p.x + p.y * p.y);
    let deflectX = 0;
    let deflectY = 0;
    if (abs(p.z) < 100 && bodyDist < 55) {
      let pushFactor = (55 - bodyDist) * 0.3;
      deflectX = (p.x / (bodyDist + 0.1)) * pushFactor;
      deflectY = (p.y / (bodyDist + 0.1)) * pushFactor;
    }

    let curX = p.x + deflectX;
    let curY = p.y + deflectY;

    stroke(0, 240, 255, p.opacity);
    line(curX, curY, p.z, curX, curY, p.z + p.len);
  }
  pop();
}

// ----------------------------------------------------
// PERCHED MODE GROUND / WALL SURFACE
// ----------------------------------------------------
function drawPerchSurface() {
  if (state.mode === 'perched') {
    // 壁面：ZY 平面（垂直牆面，法線朝 +X），生物腹部貼附其表面
    push();
    translate(-160, 0, 0);
    rotateY(HALF_PI);

    fill(12, 20, 32, 220);
    stroke(0, 240, 255, 40);
    strokeWeight(1);
    plane(500, 500);

    stroke(0, 240, 255, 25);
    for (let i = -200; i <= 200; i += 40) {
      line(i, -200, i, 200);
      line(-200, i, 200, i);
    }
    pop();
  } else {
    // 爬行模式：水平地面（XZ 平面）
    push();
    translate(0, 85, 0);
    rotateX(HALF_PI);

    fill(12, 20, 32, 220);
    stroke(0, 240, 255, 40);
    strokeWeight(1);
    plane(500, 500);

    stroke(0, 240, 255, 25);
    for (let i = -200; i <= 200; i += 40) {
      line(i, -200, i, 200);
      line(-200, i, 200, i);
    }
    pop();
  }
}

// ----------------------------------------------------
// HUD TELEMETRY UPDATE
// ----------------------------------------------------
function updateTelemetryUI(t) {
  let airspeedEl = document.getElementById('val-airspeed');
  let dragEl = document.getElementById('val-drag');
  let suctionEl = document.getElementById('val-suction');
  let beaconEl = document.getElementById('val-beacon');

  if (airspeedEl) {
    let speed = state.mode === 'gliding' ? (38.5 + sin(t) * 1.8).toFixed(1) : (state.mode === 'patrol' ? '22.0' : (state.mode === 'crawl' ? '2.4' : '0.0'));
    airspeedEl.innerText = speed + ' m/s';
  }
  if (dragEl) {
    let cd = (0.076 + (1.3 - state.membraneSpread) * 0.02).toFixed(3);
    dragEl.innerText = 'Cd ' + cd;
  }
  if (suctionEl) {
    let suction = (state.mode === 'perched' || state.mode === 'crawl') ? '184 kPa (ENGAGED)' : '42 kPa (STANDBY)';
    suctionEl.innerText = suction;
  }
  if (beaconEl) {
    let freq = (1.2 * state.pulseRate).toFixed(2);
    beaconEl.innerText = freq + ' Hz / LOCKED';
  }
}

// ----------------------------------------------------
// CAMERA PRESETS & INSPECTION CONTROLS (CALLED FROM HTML)
// ----------------------------------------------------
window.focusFeature = function(featureName) {
  document.querySelectorAll('.feature-btn').forEach(btn => btn.classList.remove('active'));
  let activeBtn = document.querySelector(`[data-feature="${featureName}"]`);
  if (activeBtn) activeBtn.classList.add('active');

  state.cameraTargetFeature = featureName;

  switch (featureName) {
    case 'overview':
      cam.targetRotX = -0.35;
      cam.targetRotY = 0.65;
      cam.targetDist = 460;
      cam.targetPanX = 0;
      cam.targetPanY = -20;
      break;

    case 'head-cyber':
      cam.targetRotX = -0.42;
      cam.targetRotY = 0.32;
      cam.targetDist = 150;
      cam.targetPanX = 0;
      cam.targetPanY = 32;
      break;

    case 'fangs':
      cam.targetRotX = 0.12;
      cam.targetRotY = 0.18;
      cam.targetDist = 120;
      cam.targetPanX = 0;
      cam.targetPanY = 25;
      break;

    case 'gecko-feet':
      cam.targetRotX = 0.52;
      cam.targetRotY = -0.65;
      cam.targetDist = 160;
      cam.targetPanX = -45;
      cam.targetPanY = -15;
      break;

    case 'membrane':
      cam.targetRotX = -0.85;
      cam.targetRotY = 0.85;
      cam.targetDist = 310;
      cam.targetPanX = 35;
      cam.targetPanY = -10;
      break;

    case 'streamline':
      cam.targetRotX = -1.45;
      cam.targetRotY = 0.0;
      cam.targetDist = 430;
      cam.targetPanX = 0;
      cam.targetPanY = 0;
      break;
  }
};

window.setPoseMode = function(modeName) {
  state.mode = modeName;
  document.querySelectorAll('.mode-btn').forEach(btn => btn.classList.remove('active'));
  let btn = document.querySelector(`[data-mode="${modeName}"]`);
  if (btn) btn.classList.add('active');

  // 切換移動模式時，自動調整到合適的觀察視角
  if (modeName === 'crawl') {
    cam.targetRotX = 0.12;
    cam.targetRotY = 1.35;
    cam.targetDist = 320;
    cam.targetPanX = 0;
    cam.targetPanY = -60;
  } else if (modeName === 'perched') {
    // 從側面（+X）俯瞰 ZY 垂直牆面
    cam.targetRotX = 0.0;
    cam.targetRotY = HALF_PI;
    cam.targetDist = 420;
    cam.targetPanX = 130;
    cam.targetPanY = 0;
  } else if (modeName === 'gliding') {
    cam.targetRotX = -0.35;
    cam.targetRotY = 0.65;
    cam.targetDist = 460;
    cam.targetPanX = 0;
    cam.targetPanY = -20;
  }
};

window.updateSetting = function(key, val) {
  if (key === 'membraneSpread') state.membraneSpread = parseFloat(val);
  if (key === 'swaySpeed') state.swaySpeed = parseFloat(val);
  if (key === 'pulseRate') state.pulseRate = parseFloat(val);
  if (key === 'wireframe') state.wireframe = val;
  if (key === 'showStreamlines') state.showStreamlines = val;
};
