'use strict';
let sim = null, speed = 1, savedSpeed = 1, modalOpen = false;
let accumulator = 0, animTime = 0, uiTimer = 0, endShown = false, winShown = false;

const CONTROL_NAMES = ['pump', 'ogs', 'scrub', 'led', 'drill', 'nuc'];
const sliders = {}, valueLabels = {};
for (let i = 0; i < CONTROL_NAMES.length; i++) {
  const name = CONTROL_NAMES[i];
  sliders[name] = document.getElementById('c_' + name);
  valueLabels[name] = document.getElementById('v_' + name);
}

const ui = {
  clockMain: document.getElementById('clockMain'), clockSub: document.getElementById('clockSub'),
  missionBar: document.getElementById('missionBar'), evaBar: document.getElementById('evaBar'),
  evaText: document.getElementById('v_eva'), evaClean: document.getElementById('evaClean'),
  evaHeap: document.getElementById('evaHeap'), loads: document.getElementById('loads'),
  cards: document.getElementById('cards'), stores: document.getElementById('stores'),
  assistant: document.getElementById('assistant'), log: document.getElementById('log'),
  modal: document.getElementById('modal'), modalTitle: document.getElementById('modalTitle'),
  modalBody: document.getElementById('modalBody'), modalActions: document.getElementById('modalActions'),
  missionSelect: document.getElementById('missionSelect'), speedButtons: document.querySelectorAll('#speedBox button')
};

function fmt(val, digits) {
  return Number(val).toFixed(digits === undefined ? 1 : digits);
}


// 2D Technical Cross-Section Schematic on Canvas
const canvas = document.getElementById('view'), ctx = canvas.getContext('2d');
const VIEW_W = 1000, VIEW_H = 600, GROUND_Y = 420, DOME_X = 460;
let viewScale = 1, viewOffsetX = 0, viewOffsetY = 0;

const helpHits = [], STARS = [];
for (let i = 0; i < 35; i++) {
  STARS.push({ x: Math.random() * VIEW_W, y: Math.random() * (GROUND_Y - 30) });
}
function resizeCanvas() {
  const r = canvas.parentElement.getBoundingClientRect();
  canvas.width = Math.max(1, Math.floor(r.width)); canvas.height = Math.max(1, Math.floor(r.height));
  viewScale = Math.min(canvas.width / VIEW_W, canvas.height / VIEW_H);
  viewOffsetX = (canvas.width - VIEW_W * viewScale) / 2; viewOffsetY = (canvas.height - VIEW_H * viewScale) / 2;
}
function drawText(txt, x, y, color, size, align) {
  ctx.fillStyle = color || '#9fe8ff'; ctx.font = (size || 11) + 'px Consolas, monospace';
  ctx.textAlign = align || 'center'; ctx.fillText(txt, x, y);
}

function fmt(val, digits) { return Number(val).toFixed(digits === undefined ? 1 : digits); }
function drawHelp(x, y, key) {
  helpHits.push({ x: x, y: y, key: key });
  ctx.beginPath(); ctx.arc(x, y, 9, 0, Math.PI * 2);
  ctx.fillStyle = '#0a2438'; ctx.fill(); ctx.strokeStyle = '#3de0ff'; ctx.lineWidth = 1.5; ctx.stroke();
  drawText('?', x, y + 4, '#3de0ff', 12);
}

// Малювання Арки купола
function drawDomeRing(outerR, innerR, color) {
  ctx.beginPath();
  ctx.arc(DOME_X, GROUND_Y, outerR, Math.PI, 0);
  ctx.arc(DOME_X, GROUND_Y, innerR, 0, Math.PI, true);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

function drawAstronaut(x, y) {
  ctx.fillStyle = '#e8eef5';
  ctx.fillRect(x - 4, y - 14, 8, 14);
  ctx.beginPath();
  ctx.arc(x, y - 18, 4.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ff9f1c';
  ctx.fillRect(x - 2, y - 20, 5, 3);
}

function drawPipe(points, color, active, reverse) {
  // Ламана лінію труби по точках
  ctx.beginPath();
  points.forEach(([x, y], index) => {
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });

  // Шар 1: нерухомий корпус труби
  ctx.setLineDash([]);
  ctx.strokeStyle = '#16344d';
  ctx.lineWidth = 5;
  ctx.stroke();

  // Шар 2: рухомий кольоровий потік (пунктир)
  if (active) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.setLineDash([6, 8]);
    ctx.lineDashOffset = (reverse ? 1 : -1) * animTime * 28;
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

function drawScene() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#030810'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(viewScale, 0, 0, viewScale, viewOffsetX, viewOffsetY);
  helpHits.length = 0;
  const s = sim.s, d = sim.d;
  if (!d.o2kPa) return;
  // 1. Sky, Stars, Sun & Solar Storm Tint
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < STARS.length; i++) {
    ctx.fillRect(STARS[i].x, STARS[i].y, 2, 2);
  }
  if (d.speExt > 0.3) { ctx.fillStyle = 'rgba(200, 30, 50, 0.18)'; ctx.fillRect(0, 0, VIEW_W, GROUND_Y); }
  if (d.sunE > 0) {
    ctx.beginPath(); ctx.arc(500 - 420 * Math.cos(d.phase), GROUND_Y - 310 * Math.sin(d.phase), 18, 0, Math.PI * 2);
    ctx.fillStyle = '#ffd23d'; ctx.fill();
  }
  // 2. Ground & Animated Flow Pipes
  ctx.fillStyle = '#1b2632'; ctx.fillRect(0, GROUND_Y, VIEW_W, VIEW_H - GROUND_Y);
  ctx.strokeStyle = '#3de0ff'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, GROUND_Y); ctx.lineTo(VIEW_W, GROUND_Y); ctx.stroke();

  // 4. Central Habitat Dome (Regolith + Water-Wall + Interior)
  const rInner = 135;
  const rOuter = 162;
  const rReg = rOuter + 6 + s.regolith * 0.2;

  // Зовнішній насип
  drawDomeRing(rReg, rOuter, '#6e6556');

  // Водяна стіна (трафарет арки + стовп води знизу)
  ctx.save();
  drawDomeRing(rOuter, rInner, '#091b2a');
  ctx.clip();
  const wallH = (s.shield / K.SHIELD_CAP) * rOuter;
  ctx.fillStyle = '#1f8fff';
  ctx.fillRect(DOME_X - rOuter, GROUND_Y - wallH, rOuter * 2, wallH);
  ctx.restore();

  // Внутрішня житлова кабіна
  ctx.beginPath();
  ctx.arc(DOME_X, GROUND_Y, rInner, Math.PI, 0);
  ctx.closePath();
  ctx.fillStyle = '#0d2638';
  ctx.fill();
  ctx.strokeStyle = '#3de0ff';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Центральна установка ECLSS
  ctx.fillStyle = '#13324a';
  ctx.fillRect(DOME_X - 75, GROUND_Y - 62, 150, 50);
  ctx.strokeRect(DOME_X - 75, GROUND_Y - 62, 150, 50);

  // Показники та кнопки довідок
  drawText('OGS + SABATIER ECLSS', DOME_X, GROUND_Y - 40, '#3de0ff', 10);
  drawText('O2 ' + fmt(d.o2kPa, 1) + ' kPa | CO2 ' + fmt(d.co2ppm, 0) + ' ppm', DOME_X, GROUND_Y - 22, '#fff', 10);
  drawText('WATER-WALL ' + fmt(s.shield, 0) + ' L | SIGMA ' + fmt(d.sigma, 0) + ' g/cm2', DOME_X, GROUND_Y - rReg - 14, '#7fd6ff', 11);

  drawHelp(DOME_X - 135, GROUND_Y - rReg - 16, 'eclss');
  drawHelp(DOME_X + 135, GROUND_Y - rReg - 16, 'shield');
  drawHelp(DOME_X - 92, GROUND_Y - 46, 'ogs');
  drawHelp(DOME_X + 92, GROUND_Y - 46, 'sabatier');


  // Астронавти в куполі та на виході EVA
  drawAstronaut(DOME_X - 95, GROUND_Y);
  drawAstronaut(DOME_X + 95, GROUND_Y);
  if (s.eva.left <= 0) {
    drawAstronaut(DOME_X - 112, GROUND_Y);
    drawAstronaut(DOME_X + 112, GROUND_Y);
  } else if (s.eva.mode === 'clean') {
    drawAstronaut(215, GROUND_Y);
    drawAstronaut(232, GROUND_Y);
  } else {
    drawAstronaut(635, GROUND_Y);
    drawAstronaut(652, GROUND_Y);
  }


  // 3. Solar Array & Ice Drill
  // Сонячна панель на опорі
  ctx.fillStyle = d.sunE > 0 ? '#1c56a8' : '#102544';
  ctx.fillRect(50, GROUND_Y - 55, 140, 24);
  ctx.strokeStyle = '#7fb0ff';
  ctx.strokeRect(50, GROUND_Y - 55, 140, 24);

  ctx.fillStyle = '#8fa4b5';
  ctx.fillRect(116, GROUND_Y - 31, 8, 31);

  const dustPct = (1 - s.dustEff) * 100;
  drawText('SOLAR ARRAY', 120, GROUND_Y - 75, '#3de0ff', 11);
  drawText(fmt(d.solarKW) + ' kW | Dust ' + fmt(dustPct, 0) + '%', 120, GROUND_Y - 62, '#ffd23d', 10);
  drawHelp(202, GROUND_Y - 68, 'solar');

  // Підземний бур льоду
  ctx.fillStyle = '#25394a';
  ctx.fillRect(135, GROUND_Y + 15, 30, 110);
  ctx.strokeStyle = '#46b4ff';
  ctx.strokeRect(135, GROUND_Y + 15, 30, 110);

  drawText('ICE DRILL', 150, GROUND_Y + 142, '#3de0ff', 11);
  drawText(fmt(d.ice, 2) + ' L/h', 150, GROUND_Y + 155, '#46b4ff', 10);
  drawHelp(198, GROUND_Y + 145, 'ice');

  // 5. Subfloor Tanks (H2O & Batt), Hydroponics Bay & Kilopower Reactor
  const drawSubTank = (x, label, frac, col) => {
    // Колір корпуса резервуара
    ctx.fillStyle = '#091724';
    ctx.fillRect(x, GROUND_Y + 20, 90, 60);

    // Кольоровий індикатор рівня
    const h = Math.max(0, Math.min(1, frac)) * 56;
    ctx.fillStyle = col;
    ctx.fillRect(x + 2, GROUND_Y + 78 - h, 86, h);

    // Рамка корпусу та підпис по центру
    ctx.strokeStyle = '#2a6a8a';
    ctx.strokeRect(x, GROUND_Y + 20, 90, 60);
    drawText(label, x + 45, GROUND_Y + 54, '#fff', 10);
  };

  drawSubTank(335, 'TANK ' + fmt(s.tank, 0) + 'L', s.tank / K.TANK_CAP, '#1f7ae0');
  drawSubTank(485, 'BATT ' + fmt(s.battery, 0) + 'kWh', s.battery / K.BATT_CAP, '#d4a017');




  // Гідропонна теплиця (правий фланг поруч із куполом)
  ctx.fillStyle = 'rgba(220, 60, 190, ' + (0.08 + 0.25 * sim.ctl.led) + ')';
  ctx.fillRect(680, GROUND_Y - 75, 130, 75);
  ctx.strokeStyle = '#3de0ff';
  ctx.strokeRect(680, GROUND_Y - 75, 130, 75);

  // Лоток із рослинами та індикатор здоров'я врожаю
  ctx.fillStyle = '#183328';
  ctx.fillRect(692, GROUND_Y - 24, 106, 12);
  ctx.fillStyle = '#3dffa0';
  ctx.fillRect(692, GROUND_Y - 24, 106 * s.crop, 12);

  drawText('HYDROPONICS', 745, GROUND_Y - 90, '#3de0ff', 11);
  drawText(fmt(d.yield, 0) + ' kcal/h | Crop ' + fmt(s.crop * 100, 0) + '%', 745, GROUND_Y - 42, '#3dffa0', 10);
  drawHelp(822, GROUND_Y - 82, 'hydro');

  // Статус виходу астронавтів на поверхню (EVA)
  if (s.eva.left > 0) {
    drawText('[EVA IN PROGRESS: ' + s.eva.mode.toUpperCase() + ']', 745, GROUND_Y + 35, '#ffb02e', 11);
  }
  drawHelp(745, GROUND_Y + 55, 'eva');

  // Ядерний реактор Kilopower
  const nucFrac = sim.ctl.nuc / 12;
  ctx.fillStyle = 'rgba(255, 120, 30, ' + (0.15 + 0.5 * nucFrac) + ')';
  ctx.beginPath();
  ctx.arc(900, GROUND_Y - 45, 22 + 18 * nucFrac, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#2d3742';
  ctx.fillRect(882, GROUND_Y - 75, 36, 75);
  ctx.strokeStyle = '#ffb02e';
  ctx.strokeRect(882, GROUND_Y - 75, 36, 75);

  drawText('REACTOR', 900, GROUND_Y - 92, '#3de0ff', 11);
  drawText(fmt(d.nucKW, 1) + ' kWe', 900, GROUND_Y - 80, '#ffd23d', 10);
  drawHelp(945, GROUND_Y - 85, 'reactor');


  // Інженерні труби та кабелі між модулями бази
  drawPipe([[120, GROUND_Y], [120, 510], [510, 510], [510, 480]], '#ffd23d', d.solarKW > 0.1);        // Сонце - Акумулятор
  drawPipe([[900, GROUND_Y], [900, 520], [530, 520], [530, 480]], '#ffd23d', d.nucKW > 0.1);          // Реактор - Акумулятор
  drawPipe([[150, 520], [340, 520], [340, 480]], '#46b4ff', d.ice > 0.01);                          // Бур льоду - Бак води
  drawPipe([[360, 440], [320, 440], [320, 390]], '#46b4ff', Math.abs(d.pump) > 0.1, d.pump < 0);    // Бак - Водяна стіна
  drawPipe([[580, 380], [680, 380]], '#ff4a5e', d.cropCO2 > 0.001);                                 // CO2: Купол - Теплиця
  drawPipe([[680, 400], [580, 400]], '#3dffa0', d.cropO2 > 0.001);                                  // O2: Теплиця - Купол



  // 6. Radiation Lines & Top Banner
  const isStorm = d.speExt > 0.3;
  const rays = isStorm ? 14 : 4;
  const penetrate = s.shield < sim.shieldSafe();
  const stopY = penetrate ? GROUND_Y - 20 : GROUND_Y - rReg;

  ctx.strokeStyle = isStorm ? '#ff5c8a' : '#ffe9a0';
  ctx.lineWidth = 1.5;

  for (let i = 0; i < rays; i++) {
    const rx = DOME_X - 130 + ((i * 37 + Math.floor(animTime * 60)) % 260);
    const ry = (animTime * 180 + i * 53) % stopY;
    ctx.beginPath();
    ctx.moveTo(rx, ry - 18);
    ctx.lineTo(rx, ry);
    ctx.stroke();
  }

  drawText('LUNAR OUTPOST ALPHA - ECLSS TECHNICAL SCHEMATIC', 16, 24, '#3de0ff', 12, 'left');

  if (isStorm) {
    ctx.fillStyle = 'rgba(180, 20, 40, 0.85)';
    ctx.fillRect(280, 10, 440, 26);
    drawText(
      `[CRIT] SOLAR STORM: ${fmt(d.speExt, 1)} mSv/h EXT -> ${fmt(d.speIn, 2)} mSv/h HAB`,
      500, 27, '#fff', 12
    );
  }
}

function updateUI() {
  const s = sim.s, d = sim.d, ctl = sim.ctl;

  // Верхній годинник і смуга прогресу місії
  const day = Math.floor(s.t / 24) + 1;
  const hr = String(Math.floor(s.t % 24)).padStart(2, '0');
  ui.clockMain.textContent = 'T+' + Math.floor(s.t) + ' h (Day ' + day + ', ' + hr + ':00)';

  const phaseTag = d.sunE > 0
    ? '[DAY] Sun ' + fmt(Math.asin(d.sunE) * 57.3, 0) + ' deg'
    : '[NIGHT] Ext ' + fmt(d.textC, 0) + ' C';
  ui.clockSub.textContent = phaseTag + ' | Goal ' + sim.sc.goal + ' h' + (s.won ? ' [OK]' : '');
  ui.missionBar.style.width = Math.min(100, (s.t / sim.sc.goal) * 100) + '%';

  // Підписи під 6 повзунками керування
  const dir = d.pump > 0.01 ? 'Tank -> Wall ' : d.pump < -0.01 ? 'Wall -> Tank ' : 'Idle ';
  valueLabels.pump.textContent = dir + fmt(Math.abs(d.pump)) + ' L/h | ' + fmt(d.loads.pump, 2) + ' kW';
  valueLabels.ogs.textContent = fmt(ctl.ogs * 100, 0) + '% | ' + fmt(d.ogsO2, 2) + ' kg O2/h | ' + fmt(d.loads.ogs, 2) + ' kW';
  valueLabels.scrub.textContent = fmt(ctl.scrub * 100, 0) + '% | CO2 ' + fmt(d.removal, 2) + ' kg/h | ' + fmt(d.loads.scrub, 2) + ' kW';
  valueLabels.led.textContent = fmt(ctl.led * 100, 0) + '% | ' + fmt(d.yield, 0) + ' kcal/h | ' + fmt(d.loads.led, 1) + ' kW';
  valueLabels.drill.textContent = fmt(ctl.drill * 100, 0) + '% | ' + fmt(d.ice, 2) + ' L/h | ' + fmt(d.loads.drill, 1) + ' kW';
  valueLabels.nuc.textContent = fmt(ctl.nuc, 1) + ' kWe | heat leak ' + fmt(K.REACTOR_HEAT * ctl.nuc, 1) + ' kW';


  // Діаграма генерації та споживання електроенергії
  const rows = [
    ['Solar', d.solarKW, true],
    ['Reactor', d.nucKW, true],
    ['Base', d.loads.base, false],
    ['HVAC', d.loads.hvac, false],
    ['Electrolysis', d.loads.ogs, false],
    ['Scrubber', d.loads.scrub, false],
    ['Hydro LED', d.loads.led, false],
    ['Ice Drill', d.loads.drill, false]
  ];

  ui.loads.innerHTML = rows.map(([label, kw, isGen]) => {
    const width = Math.min(100, (kw / 30) * 100);
    const rowClass = isGen ? 'load-row gen' : 'load-row';
    return `<div class="${rowClass}"><span>${label}</span><div class="bar"><i style="width:${width}%"></i></div><span>${fmt(kw)}</span></div>`;
  }).join('');
}

let lastTime = performance.now();
function frame(now) {
  const dt = Math.min(0.1, (now - lastTime) / 1000);
  lastTime = now;
  animTime += dt;
  if (speed > 0 && !sim.s.over) {
    accumulator += dt * speed;
    let steps = 0;
    while (accumulator >= K.STEP && steps < 40) {
      sim.step(K.STEP);
      accumulator -= K.STEP;
      steps++;
    }
  }
  uiTimer += dt;
  if (uiTimer > 0.15) {
    uiTimer = 0;
    updateUI();
  }
  checkEnd();
  drawScene();
  requestAnimationFrame(frame);
}





//ЗАГЛУШКА
const K = { SHIELD_CAP: 900, TANK_CAP: 700, BATT_CAP: 120, REACTOR_HEAT: 1.5, STEP: 0.25, SIGMA_SAFE: 70, WATER_SIGMA: 0.1 };
sim = {
  sc: { goal: 168 },
  ctl: { pump: 0.2, ogs: 0.15, scrub: 0.35, led: 0.8, drill: 0.2, nuc: 8 },
  s: { t: 14, shield: 700, tank: 450, battery: 95, regolith: 30, dustEff: 0.85, crop: 0.92, eva: { mode: null, left: 0 } },
  d: {
    o2kPa: 21.2, co2ppm: 700, sigma: 100, sunE: 0.85, phase: 1.1, textC: 12,
    speExt: 0, speIn: 0,
    solarKW: 18.4, ice: 2.45, yield: 320, nucKW: 8.0, pump: 1.5, ogsO2: 0.14, removal: 0.16,
    cropCO2: 0.05, cropO2: 0.04,
    loads: { base: 1.5, hvac: 2.1, pump: 0.4, ogs: 1.2, scrub: 0.8, led: 3.2, drill: 1.5 }
  },
  shieldSafe() {
    return Math.max(150, (K.SIGMA_SAFE - this.s.regolith) / K.WATER_SIGMA);
  }
};
resizeCanvas();
updateUI();
function testLoop(t) {
  animTime = t / 1000;
  drawScene();
  requestAnimationFrame(testLoop);
}
requestAnimationFrame(testLoop);