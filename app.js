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
}


//ЗАГЛУШКА
const sim = { s: {}, d: { o2kPa: 21.2, sunE: 0, phase: 0, speExt: 0 } };
resizeCanvas();
drawScene();