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

const BRIEFS = {
  eclss: ['ISS ECLSS: Closed-Loop Life Support', 'The ISS Environmental Control &amp; Life Support System recycles ~98% of crew water. Electrolysis splits water into breathable O&#8322;, the CO&#8322; scrubber + Sabatier reactor recover water from exhaled air, and the Water Processor turns grey water back into potable water.'],
  ogs: ['Oxygen Generation: Water Electrolysis', '<code>2 H&#8322;O &rarr; 2 H&#8322; + O&#8322;</code>. Each litre of water yields <code>0.89 kg O&#8322;</code> and <code>0.11 kg H&#8322;</code> at <code>4.5 kW per kg O&#8322;</code>. If the internal tank runs dry, OGS draws from the Water-Wall radiation shield!'],
  sabatier: ['Sabatier Reaction &amp; CO&#8322; Scrubber', 'Crew exhale <code>0.17 kg CO&#8322;/h</code>. The scrubber captures CO&#8322; and the Sabatier reactor combines it with H&#8322; from electrolysis (<code>CO&#8322; + 4 H&#8322; &rarr; CH&#8324; + 2 H&#8322;O</code>) to recover 0.82 L of water per kg CO&#8322;.'],
  hydro: ['Hydroponic Bay: Food, O&#8322; and CO&#8322; Sink', 'Photosynthesis uses LED light, water and CO&#8322; to grow food (up to 650 kcal/h at 8 kW) and produce bonus O&#8322;. Crops wilt if starved of light, water, CO&#8322; or comfortable temperature.'],
  shield: ['Hydrogen-Rich Radiation Shielding (Water-Wall)', 'Hydrogen-rich water blocks Galactic Cosmic Rays and Solar Particle Events effectively. Total shielding is <code>sigma = regolith + 0.1 * Wall_L</code>. Keep <code>sigma &ge; 70 g/cm&sup2;</code> to protect the crew.'],
  reactor: ['Kilopower Fission Reactor', 'Provides up to 12 kWe day and night, essential during the 336-hour lunar night. However, 30% of reactor output leaks into the habitat as waste heat that the HVAC must reject.'],
  solar: ['Solar Array &amp; Lunar Dust', 'Generates up to 30 kW in sunlight and 0 kW at night. Electrostatic lunar dust degrades efficiency by 0.2%/h until cleaned by EVA.'],
  ice: ['Ice Extractor Drill (ISRU)', 'Extracts up to 1.6 L/h of water from polar crater ice at 5 kW to replenish the internal tank and Water-Wall.'],
  eva: ['Extravehicular Activity (EVA)', 'Two astronauts go outside for 6 hours to clean solar panels or heap regolith shielding (+2.5 g/cm&sup2;/h). Costs 1.5 kg airlock O&#8322; and leaves the EVA crew unshielded against solar storms.']
};

function openModal(title, html, actions = []) {
  if (!modalOpen) savedSpeed = speed;
  modalOpen = true;
  setSpeed(0);

  ui.modalTitle.innerHTML = title;
  ui.modalBody.innerHTML = html;
  ui.modalActions.innerHTML = '';

  actions.forEach(({ label, fn }) => {
    const btn = document.createElement('button');
    btn.className = 'btn';
    btn.textContent = label;
    btn.onclick = fn;
    ui.modalActions.appendChild(btn);
  });

  ui.modal.classList.remove('hidden');
}

function closeModal() {
  if (!modalOpen) return;
  modalOpen = false;
  ui.modal.classList.add('hidden');
  setSpeed(savedSpeed);
}

function showBrief(key) {
  const brief = BRIEFS[key];
  if (brief) {
    openModal(`<span class="tag">NASA ENGINEERING BRIEF</span><br>${brief[0]}`, `<p>${brief[1]}</p>`);
  }
}

function showMissionIntro() {
  const sc = sim.sc;
  const html = `${sc.brief}<p><b>Goal:</b> survive ${sc.goal} h. Click any <b>?</b> icon for NASA engineering briefs.</p>`;
  openModal(`<span class="tag">MISSION BRIEFING</span><br>${sc.name}`, html, [
    { label: 'Begin Mission', fn: closeModal }
  ]);
}

function readSliders() {
  CONTROL_NAMES.forEach(k => {
    const val = parseFloat(sliders[k].value);
    sim.ctl[k] = (k === 'nuc') ? val : val / 100;
  });
  sim.refresh();
  updateUI();
}

function syncSliders() {
  CONTROL_NAMES.forEach(k => {
    sliders[k].value = (k === 'nuc') ? sim.ctl[k] : sim.ctl[k] * 100;
  });
}

function setSpeed(s) {
  speed = s;
  ui.speedButtons.forEach(btn => {
    btn.classList.toggle('active', Number(btn.dataset.speed) === s);
  });
}

function loadMission(id) {
  sim = new Sim(id);
  accumulator = 0;
  endShown = false;
  winShown = false;
  ui.missionSelect.value = id;

  syncSliders();
  setSpeed(1);
  modalOpen = false;
  ui.modal.classList.add('hidden');

  updateUI();
  showMissionIntro();
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
  canvas.width = Math.max(1, Math.floor(r.width));
  canvas.height = Math.max(1, Math.floor(r.height));
  viewScale = Math.min(canvas.width / VIEW_W, canvas.height / VIEW_H);
  viewOffsetX = (canvas.width - VIEW_W * viewScale) / 2;
  viewOffsetY = (canvas.height - VIEW_H * viewScale) / 2;
}

function drawText(txt, x, y, color, size, align) {
  ctx.fillStyle = color || '#9fe8ff';
  ctx.font = (size || 11) + 'px Consolas, monospace';
  ctx.textAlign = align || 'center';
  ctx.fillText(txt, x, y);
}

// Малювання круглої іконки довідки ?
function drawHelp(x, y, key) {
  helpHits.push({ x: x, y: y, key: key });
  ctx.beginPath();
  ctx.arc(x, y, 9, 0, Math.PI * 2);
  ctx.fillStyle = '#0a2438';
  ctx.fill();
  ctx.strokeStyle = '#3de0ff';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  drawText('?', x, y + 4, '#3de0ff', 12);
}

// Малювання кільцевої арки купола
function drawDomeRing(outerR, innerR, color) {
  ctx.beginPath();
  ctx.arc(DOME_X, GROUND_Y, outerR, Math.PI, 0);
  ctx.arc(DOME_X, GROUND_Y, innerR, 0, Math.PI, true);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

// Малювання фігурки астронавта
function drawAstronaut(x, y) {
  ctx.fillStyle = '#e8eef5';
  ctx.fillRect(x - 4, y - 14, 8, 14);
  ctx.beginPath();
  ctx.arc(x, y - 18, 4.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ff9f1c';
  ctx.fillRect(x - 2, y - 20, 5, 3);
}

// Малювання інженерної труби з анімацією потоку
function drawPipe(points, color, active, reverse) {
  // Ламана лінія труби по точках
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

// Перевірка порогів тривоги для карток телеметрії
function band(v, critLow, warnLow, warnHigh, critHigh) {
  if ((critLow !== null && v < critLow) || (critHigh !== null && v > critHigh)) return 'crit';
  if ((warnLow !== null && v < warnLow) || (warnHigh !== null && v > warnHigh)) return 'warn';
  return 'ok';
}

const CARDS = [
  { id: 'o2', title: 'O2 Partial Pressure', unit: 'kPa', dec: 2, max: 30, val: s => s.d.o2kPa, rate: s => [s.rates.o2kPa, 2, 'kPa/h'], st: v => band(v, 17, 19.5, 23.1, 30) },
  { id: 'co2', title: 'CO2 Concentration', unit: 'ppm', dec: 0, max: 10000, val: s => s.d.co2ppm, rate: s => [s.rates.co2ppm, 0, 'ppm/h'], st: v => band(v, null, null, 5000, 8000) },
  { id: 'shield', title: 'Hull Water-Wall', unit: 'L', dec: 0, max: K.SHIELD_CAP, val: s => s.s.shield, rate: s => [s.rates.shield, 1, 'L/h'], st: (v, s) => v < s.shieldSafe() ? 'crit' : v < s.shieldSafe() * 1.25 ? 'warn' : 'ok' },
  { id: 'tank', title: 'Internal Water Tank', unit: 'L', dec: 0, max: K.TANK_CAP, val: s => s.s.tank, rate: s => [s.rates.tank, 1, 'L/h'], st: v => band(v, 30, 120, null, null) },
  { id: 'food', title: 'Food Supply', unit: 'kcal', dec: 0, max: 80000, val: s => s.s.food, rate: s => [s.rates.food, 0, 'kcal/h'], st: v => band(v, 6000, 24000, null, null) },
  { id: 'dose', title: 'Radiation Dose', unit: 'mSv', dec: 2, max: K.DOSE_LIMIT, val: s => s.s.dose, rate: s => [s.rates.dose, 3, 'mSv/h'], st: v => band(v, null, null, 60, 110) },
  { id: 'net', title: 'Net Power', unit: 'kW', dec: 1, max: 30, val: s => s.d.netKW, sub: s => `Gen ${fmt(s.d.genKW)} | Load ${fmt(s.d.loadKW)}`, st: (v, s) => s.d.pf < 0.999 ? 'crit' : v < 0 ? 'warn' : 'ok' },
  { id: 'batt', title: 'Battery Storage', unit: 'kWh', dec: 1, max: K.BATT_CAP, val: s => s.s.battery, rate: s => [s.rates.battery, 1, 'kWh/h'], st: v => band(v, 10, 30, null, null) },
  { id: 'temp', title: 'Habitat Temp', unit: 'degC', dec: 1, max: 40, val: s => s.s.temp, rate: s => [s.rates.temp, 2, 'C/h'], st: v => band(v, 14, 18, 25, 28) },
  { id: 'solar', title: 'Solar Output', unit: 'kW', dec: 1, max: 30, val: s => s.d.solarKW, sub: s => `Dust eff: ${fmt(s.s.dustEff * 100, 0)}%`, st: () => 'ok' }
];

function buildCards() {
  ui.cards.innerHTML = '';
  CARDS.forEach(c => {
    const div = document.createElement('div');
    div.className = 'card';
    div.innerHTML = `
      <h4>${c.title}</h4>
      <div><span class="val">-</span><span class="unit">${c.unit}</span></div>
      <div class="dbar"><i></i></div>
      <div class="rate"></div>
    `;
    ui.cards.appendChild(div);
    c.el = div;
    c.valEl = div.querySelector('.val');
    c.barEl = div.querySelector('.dbar i');
    c.rateEl = div.querySelector('.rate');
  });
}

function drawScene() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#030810';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(viewScale, 0, 0, viewScale, viewOffsetX, viewOffsetY);
  helpHits.length = 0;

  const s = sim.s, d = sim.d;
  if (!d.o2kPa) return;

  // 1. Sky, Stars, Sun & Solar Storm Tint
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < STARS.length; i++) {
    ctx.fillRect(STARS[i].x, STARS[i].y, 2, 2);
  }
  if (d.speExt > 0.3) {
    ctx.fillStyle = 'rgba(200, 30, 50, 0.18)';
    ctx.fillRect(0, 0, VIEW_W, GROUND_Y);
  }
  if (d.sunE > 0) {
    ctx.beginPath();
    ctx.arc(500 - 420 * Math.cos(d.phase), GROUND_Y - 310 * Math.sin(d.phase), 18, 0, Math.PI * 2);
    ctx.fillStyle = '#ffd23d';
    ctx.fill();
  }

  // 2. Ground & Animated Flow Pipes
  ctx.fillStyle = '#1b2632';
  ctx.fillRect(0, GROUND_Y, VIEW_W, VIEW_H - GROUND_Y);
  ctx.strokeStyle = '#3de0ff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, GROUND_Y);
  ctx.lineTo(VIEW_W, GROUND_Y);
  ctx.stroke();

  // Інженерні труби та кабелі між модулями бази
  drawPipe([[120, GROUND_Y], [120, 510], [510, 510], [510, 480]], '#ffd23d', d.solarKW > 0.1);        // Сонце - Акумулятор
  drawPipe([[900, GROUND_Y], [900, 520], [530, 520], [530, 480]], '#ffd23d', d.nucKW > 0.1);          // Реактор - Акумулятор
  drawPipe([[150, 520], [340, 520], [340, 480]], '#46b4ff', d.ice > 0.01);                          // Бур льoду - Бак води
  drawPipe([[360, 440], [320, 440], [320, 390]], '#46b4ff', Math.abs(d.pump) > 0.1, d.pump < 0);    // Бак - Водяна стіна
  drawPipe([[580, 380], [680, 380]], '#ff4a5e', d.cropCO2 > 0.001);                                 // CO2: Купол - Теплиця
  drawPipe([[680, 400], [580, 400]], '#3dffa0', d.cropO2 > 0.001);                                  // O2: Теплиця - Купол

  // 3. Solar Array & Ice Drill (Лівий фланг: сонячна батарея та бур льоду)
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

  // 4. Центральний купол, водяна стіна, кабіна та екіпаж
  const rInner = 135;
  const rOuter = 162;
  const rReg = rOuter + 6 + s.regolith * 0.2;

  // Зовнішній захисний насип реголіту
  drawDomeRing(rReg, rOuter, '#6e6556');

  // Водяна стіна
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

  // Центральна установка життєзабезпечення ECLSS
  ctx.fillStyle = '#13324a';
  ctx.fillRect(DOME_X - 75, GROUND_Y - 62, 150, 50);
  ctx.strokeRect(DOME_X - 75, GROUND_Y - 62, 150, 50);

  // Показники купола та кнопки довідок
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

  // 5. Subfloor Tanks, Hydroponics Bay & Kilopower Reactor
  const drawSubTank = (x, label, frac, col) => {
    // Темний корпус резервуара
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

  // Гідропонна теплиця
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
  if (!d.o2kPa) return;

  // 1. Оновлення 10 карток телеметрії
  CARDS.forEach(c => {
    const v = c.val(sim);
    const st = c.st(v, sim);
    c.el.className = st === 'ok' ? 'card' : `card ${st}`;
    c.valEl.textContent = fmt(v, c.dec);
    c.barEl.style.width = `${Math.max(0, Math.min(100, (Math.abs(v) / c.max) * 100))}%`;

    if (c.sub) {
      c.rateEl.textContent = c.sub(sim);
    } else {
      const [rateVal, dec, unit] = c.rate(sim);
      const sign = rateVal >= 0 ? '+' : '';
      c.rateEl.textContent = `dX/dt: ${sign}${fmt(rateVal, dec)} ${unit}`;
    }
  });

  // 2. Верхній годинник і прогрес місії
  const day = Math.floor(s.t / 24) + 1;
  const hr = String(Math.floor(s.t % 24)).padStart(2, '0');
  ui.clockMain.textContent = `T+${Math.floor(s.t)} h (Day ${day}, ${hr}:00)`;

  const phaseTag = d.sunE > 0
    ? `[DAY] Sun ${fmt(Math.asin(d.sunE) * 57.3, 0)} deg`
    : `[NIGHT] Ext ${fmt(d.textC, 0)} C`;
  ui.clockSub.textContent = `${phaseTag} | Goal ${sim.sc.goal} h${s.won ? ' [OK]' : ''}`;
  ui.missionBar.style.width = `${Math.min(100, (s.t / sim.sc.goal) * 100)}%`;

  // 3. Підписи під 6 повзунками
  const dir = d.pump > 0.01 ? 'Tank -> Wall ' : d.pump < -0.01 ? 'Wall -> Tank ' : 'Idle ';
  valueLabels.pump.textContent = `${dir}${fmt(Math.abs(d.pump))} L/h | ${fmt(d.loads.pump, 2)} kW`;
  valueLabels.ogs.textContent = `${fmt(ctl.ogs * 100, 0)}% | ${fmt(d.ogsO2, 2)} kg O2/h | ${fmt(d.loads.ogs, 2)} kW`;
  valueLabels.scrub.textContent = `${fmt(ctl.scrub * 100, 0)}% | CO2 ${fmt(d.removal, 2)} kg/h | ${fmt(d.loads.scrub, 2)} kW`;
  valueLabels.led.textContent = `${fmt(ctl.led * 100, 0)}% | ${fmt(d.yield, 0)} kcal/h | ${fmt(d.loads.led, 1)} kW`;
  valueLabels.drill.textContent = `${fmt(ctl.drill * 100, 0)}% | ${fmt(d.ice, 2)} L/h | ${fmt(d.loads.drill, 1)} kW`;
  valueLabels.nuc.textContent = `${fmt(ctl.nuc, 1)} kWe | heat leak ${fmt(K.REACTOR_HEAT * ctl.nuc, 1)} kW`;

  // 4. Кнопки та смужка виходу астронавтів EVA
  const evaActive = s.eva.left > 0;
  ui.evaBar.style.width = evaActive ? `${(1 - s.eva.left / K.EVA_H) * 100}%` : '0%';
  ui.evaText.textContent = evaActive ? `EVA (${s.eva.mode}): ${fmt(s.eva.left, 1)} h left` : 'Crew inside. Airlock ready.';
  ui.evaClean.disabled = evaActive || !!s.over;
  ui.evaHeap.disabled = evaActive || !!s.over;

  // 5. Діаграма потужності
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
    const w = Math.min(100, (kw / 30) * 100);
    return `<div class="${isGen ? 'load-row gen' : 'load-row'}"><span>${label}</span><div class="bar"><i style="width:${w}%"></i></div><span>${fmt(kw)}</span></div>`;
  }).join('');

  // 6. Таблиця другорядних складів
  const stores = [
    ['Grey water', `${fmt(s.grey, 0)} L`],
    ['Biomass H2O', `${fmt(s.biomassW, 1)} L`],
    ['H2 store', `${fmt(s.h2, 2)} kg`],
    ['CO2 store', `${fmt(s.co2store, 1)} kg`],
    ['Regolith', `${fmt(s.regolith, 0)} g/cm2`],
    ['Shield sigma', `${fmt(d.sigma, 0)} g/cm2`],
    ['Crop health', `${fmt(s.crop * 100, 0)}%`],
    ['Safe Wall', `${fmt(sim.shieldSafe(), 0)} L`]
  ];
  ui.stores.innerHTML = stores.map(([label, val]) => `<span>${label}</span><b>${val}</b>`).join('');

  // 7. Підказки інженерного асистента
  const tagMap = { crit: '[CRIT] ', warn: '[WARN] ', info: '[INFO] ' };
  ui.assistant.innerHTML = sim.advisories().map(item =>
    `<div class="adv ${item.lvl}">${tagMap[item.lvl]}${item.txt}</div>`
  ).join('');

  // 8. Бортовий журнал подій
  ui.log.innerHTML = sim.log.slice(-20).reverse().map(entry => {
    const hrs = String(Math.floor(entry.t)).padStart(3, '0');
    return `<div class="${entry.l}">[T+${hrs}h] ${entry.msg}</div>`;
  }).join('');
}

// Головний ігровий цикл із фіксованим кроком фізики
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

// Перевірка умов поразки або перемоги місії
function checkEnd() {
  const s = sim.s;
  if (s.over && !endShown) {
    endShown = true;
    openModal(
      `<span class="tag" style="background:#ff4a5e">MISSION FAILED</span><br>${s.over.why}`,
      `<p>Failed at T+${Math.floor(s.t)} h. Dose: ${fmt(s.dose, 1)} mSv, Wall: ${fmt(s.shield, 0)} L.</p>`,
      [{ label: 'Retry Mission', fn: () => loadMission(sim.id) }]
    );
  } else if (s.won && !winShown && !s.over) {
    winShown = true;
    openModal(
      `<span class="tag" style="background:#3dffa0">MISSION SUCCESS</span><br>${sim.sc.name}`,
      `<p>You survived ${sim.sc.goal} hours! Dose: ${fmt(s.dose, 1)} mSv, Wall: ${fmt(s.shield, 0)} L.</p>`,
      [
        { label: 'Continue Sandbox', fn: closeModal },
        { label: 'Next Mission', fn: () => loadMission((sim.id % 3) + 1) }
      ]
    );
  }
}

function init() {
  // 1. Підготовка карток та полотна
  buildCards();
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  // 2. Клік по круглих іконках ? на сцені Canvas
  canvas.addEventListener('click', (e) => {
    const r = canvas.getBoundingClientRect();
    const x = (e.clientX - r.left - viewOffsetX) / viewScale;
    const y = (e.clientY - r.top - viewOffsetY) / viewScale;
    const hit = helpHits.find(h => Math.hypot(h.x - x, h.y - y) < 12);
    if (hit) showBrief(hit.key);
  });

  // 3. Повзунки, кнопки швидкості та кнопки ? на бічній панелі
  CONTROL_NAMES.forEach(k => sliders[k].addEventListener('input', readSliders));
  ui.speedButtons.forEach(btn => {
    btn.onclick = () => { if (!modalOpen) setSpeed(Number(btn.dataset.speed)); };
  });
  document.querySelectorAll('.help').forEach(el => {
    el.onclick = () => showBrief(el.dataset.help);
  });

  // 4. Кнопки керування місією, модальним вікном та виходами EVA
  ui.missionSelect.onchange = (e) => loadMission(Number(e.target.value));
  document.getElementById('btnReset').onclick = () => loadMission(sim.id);
  document.getElementById('btnBrief').onclick = showMissionIntro;
  document.getElementById('modalClose').onclick = closeModal;
  ui.evaClean.onclick = () => { sim.startEVA('clean'); updateUI(); };
  ui.evaHeap.onclick = () => { sim.startEVA('heap'); updateUI(); };

  // 5. Старт Місії 1 та запуск головного циклу анімації
  loadMission(1);
  requestAnimationFrame(frame);
}

init();