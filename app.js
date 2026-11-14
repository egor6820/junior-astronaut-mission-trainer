// Clean 2D Technical Cross-Section Schematic on Canvas (#view)
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
}


//ЗАГЛУШКА
const K = { SHIELD_CAP: 900 };
const sim = { s: { shield: 700, regolith: 30, eva: { mode: null, left: 0 } }, d: { o2kPa: 21.2, co2ppm: 700, sigma: 100, sunE: 0.85, phase: 1.1, speExt: 0 } };
resizeCanvas();
drawScene();