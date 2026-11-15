'use strict';

// Фізичні константи та інженерні параметри систем бази
const K = {
  // Параметри гермооб'єму та ідеального газу
  STEP: 0.25, V: 400, R: 8.314, T_REF: 294.15, MW_O2: 0.032, MW_CO2: 0.044, P_TOTAL: 101325,

  // Метаболізм екіпажу (на 4 астронавтів за 1 годину)
  CREW: { n: 4, o2: 0.14, h2o: 0.5, kcal: 500, co2: 0.17, grey: 0.45 },
  CREW_HEAT: 0.5,

  // Генерація енергії та акумуляторна батарея
  SOLAR_MAX: 30, NUC_MAX: 12, DUST_PER_H: 0.002, LUNAR_PERIOD: 708,
  BASE_LOAD: 1.8, BATT_CAP: 120, BATT_CHG: 20, BATT_DIS: 25,

  // Електроліз кисню (OGS) та очищення CO2 (Scrubber + Sabatier)
  OGS_MAX: 0.8, OGS_KW_PER_KG: 4.5, O2_PER_L: 0.89, H2_PER_L: 0.11, LEAK: 0.0002,
  SCRUB_MAX: 0.4, SCRUB_KW: 2.0, H2_PER_CO2: 0.18, SAB_WATER: 0.818, CO2_STORE_CAP: 20, H2_CAP: 3,

  // Гідропонна оранжерея
  CROP_MAX: 650, CROP_LED_KW: 8, CROP_CO2: 0.000394, CROP_O2: 0.000287, CROP_H2O: 0.000161, IRRIG_MAX: 0.8,

  // Водопостачання: насос щита, бур льоду (ISRU) та переробка сірої води (WPA)
  PUMP_MAX: 40, PUMP_KW: 0.6, ICE_MAX: 1.6, ICE_KW: 5, WPA_MAX: 1.5, WPA_KW: 0.4, WPA_RECOVERY: 0.95,
  SHIELD_CAP: 900, TANK_CAP: 700,

  // Тепловий баланс купола (HVAC)
  UA: 0.04, C_TH: 15, T_SET: 21, REACTOR_HEAT: 0.3,

  // Космічна радіація та виходи на поверхню (EVA)
  GCR_EXT: 0.03, GCR_LAMBDA: 250, SPE_LAMBDA: 22, WATER_SIGMA: 0.1, DOSE_LIMIT: 150, SIGMA_SAFE: 70,
  EVA_H: 6, EVA_O2: 0.25, EVA_LOCK_O2: 1.5, REG_MAX: 150
};

// Загальна кількість молів повітря в куполі за рівнянням Менделєєва—Клапейрона
const MOL_TOTAL = (K.P_TOTAL * K.V) / (K.R * K.T_REF);

// Допоміжні функції перерахунку одиниць
function clamp(x, low, high) {
  return Math.max(low, Math.min(high, x));
}

function kgToKPa(kg, tempC) {
  return ((kg / K.MW_O2) * K.R * (tempC + 273.15)) / K.V / 1000;
}

function kPaToKg(kPa, tempC) {
  return ((kPa * 1000 * K.V) / (K.R * (tempC + 273.15))) * K.MW_O2;
}

function ppmOf(kg) {
  return ((kg / K.MW_CO2) / MOL_TOTAL) * 1000000;
}

function ppmToKg(ppm) {
  return (ppm / 1000000) * MOL_TOTAL * K.MW_CO2;
}

// Базові стартові запаси та налаштування повзунків за замовчуванням
const BASE = {
  o2kPa: 21.2, co2ppm: 700, shield: 700, tank: 420, grey: 80, h2: 0.6,
  co2store: 2, food: 72000, battery: 100, temp: 21, dustEff: 1, regolith: 30, biomassW: 6, crop: 0.9
};

const BASE_CTL = { pump: 0, ogs: 0.15, scrub: 0.35, led: 0.5, drill: 0.2, nuc: 8 };

// Конфігурація трьох ігрових місій
const SCENARIOS = {
  1: {
    id: 1, name: 'Mission 1: Equilibrium Training', goal: 168, t0: 60,
    spe: [{ start: 90, rise: 3, peak: 2.5, tau: 8 }],
    init: {}, ctl: {},
    brief: '<p>Welcome, trainee! The outpost starts near <b>closed-loop equilibrium</b>. Keep the 4 astronauts alive for <b>7 days (168 h)</b>.</p>' +
      '<ul><li>Balance O&#8322; (electrolysis + crops) and keep CO&#8322; below 5000 ppm with the Sabatier scrubber.</li>' +
      '<li>Watch the <b>Water-Wall</b>: more water = more radiation shielding.</li></ul>'
  },
  2: {
    id: 2, name: 'Mission 2: X-Class Solar Flare Crisis', goal: 96, t0: 60,
    spe: [{ start: 8, rise: 2, peak: 15, tau: 24 }, { start: 60, rise: 1, peak: 8, tau: 10 }],
    init: { shield: 760, tank: 330, grey: 110, o2kPa: 19.9, co2ppm: 2500, dustEff: 0.8, food: 60000 },
    ctl: { ogs: 0.2, scrub: 0.5, led: 0.4, drill: 0.1, nuc: 8 },
    brief: '<p><b>X-class flare inbound at hour 8</b> (up to 15 mSv/h outside; second pulse at hour 60). O&#8322; is low and CO&#8322; is high.</p>' +
      '<ul><li>Keep the Hull Water-Wall full to shield the crew. Do <b>not</b> send EVA during the storm.</li>' +
      '<li>Survive 96 h and keep crew dose below <b>150 mSv</b>.</li></ul>'
  },
  3: {
    id: 3, name: 'Mission 3: 14-Day Lunar Night Survival', goal: 336, t0: 350,
    spe: [{ start: 200, rise: 2, peak: 4, tau: 12 }],
    init: { battery: 70, food: 60000, tank: 380, shield: 720, dustEff: 0.6 },
    ctl: { ogs: 0.15, scrub: 0.35, led: 0.45, drill: 0.1, nuc: 4 },
    brief: '<p>Sunset in a few hours: <b>14 days of darkness</b> (336 h) and -170&deg;C outside. Solar output is <b>0 kW</b>.</p>' +
      '<ul><li>Use the Kilopower reactor (0&ndash;12 kW) and 120 kWh battery, watching reactor heat leak on the HVAC.</li>' +
      '<li>Balance power, hydroponic food growth, and water across the lunar night.</li></ul>'
  }
};

class Sim {
  constructor(id, savedState, savedControls) {
    this.id = id;
    this.sc = SCENARIOS[id];
    this.log = [];
    this.d = {};
    this.rates = {};

    // Швидке клонування стану для миттєвого перерахунку refresh()
    if (savedState) {
      this.s = savedState;
      this.ctl = savedControls;
      return;
    }

    const init = Object.assign({}, BASE, this.sc.init);
    this.s = {
      t: 0,
      o2: kPaToKg(init.o2kPa, init.temp),
      co2: ppmToKg(init.co2ppm),
      shield: init.shield,
      tank: init.tank,
      grey: init.grey,
      h2: init.h2,
      co2store: init.co2store,
      food: init.food,
      battery: init.battery,
      temp: init.temp,
      dustEff: init.dustEff,
      regolith: init.regolith,
      biomassW: init.biomassW,
      crop: init.crop,
      dose: 0,
      eva: { mode: null, left: 0 },
      haz: { o2: 0, fire: 0, co2: 0, temp: 0, water: 0, food: 0 },
      flags: {},
      over: null,
      won: false
    };

    this.ctl = Object.assign({}, BASE_CTL, this.sc.ctl);
    this.addLog('ok', `${this.sc.name} initiated. Crew of 4 aboard.`);
    this.refresh();
  }

  addLog(level, message) {
    this.log.push({ t: this.s.t, l: level, msg: message });
    if (this.log.length > 80) this.log.shift();
  }

  logOnce(key, level, message) {
    if (!this.s.flags[key]) {
      this.s.flags[key] = 1;
      this.addLog(level, message);
    }
  }

  // Пробний мікро-крок на копії стану, щоб оновити цифри UI одразу при русі повзунків
  refresh() {
    if (this.s.over) return;
    const copy = new Sim(this.id, JSON.parse(JSON.stringify(this.s)), Object.assign({}, this.ctl));
    copy.step(0.02);
    this.d = copy.d;
    this.rates = copy.rates;
  }

  // Безпечний мінімум води у стіні з урахуванням товщини реголіту на куполі
  shieldSafe() {
    return Math.max(150, (K.SIGMA_SAFE - this.s.regolith) / K.WATER_SIGMA);
  }

  // Зовнішня потужність дози під час сонячних протонних штормів (SPE)
  speExt(t) {
    let rate = 0;
    for (let i = 0; i < this.sc.spe.length; i++) {
      const ev = this.sc.spe[i];
      const x = t - ev.start;
      if (x >= 0) {
        rate += (x < ev.rise) ? (ev.peak * x) / ev.rise : ev.peak * Math.exp(-(x - ev.rise) / ev.tau);
      }
    }
    return rate;
  }

  // Запуск виходу двох астронавтів на поверхню (EVA)
  startEVA(mode) {
    if (this.s.eva.left > 0 || this.s.over) return false;
    this.s.eva.mode = mode;
    this.s.eva.left = K.EVA_H;
    this.s.o2 = Math.max(0, this.s.o2 - K.EVA_LOCK_O2);
    this.addLog('warn', `EVA started (${mode}). Airlock vented ${K.EVA_LOCK_O2} kg O2.`);
    this.refresh();
    return true;
  }

  // Головний крок фізичної симуляції (dt = 0.25 год)
  step(dt) {
    const s = this.s, c = this.ctl, sc = this.sc, d = {};
    if (s.over) return;

    const prev = {
      o2kPa: kgToKPa(s.o2, s.temp),
      co2ppm: ppmOf(s.co2),
      shield: s.shield,
      tank: s.tank,
      food: s.food,
      battery: s.battery,
      temp: s.temp
    };

    // 1. Зовнішнє середовище, електрогенерація, батарея та клімат-контроль (HVAC)
    d.phase = (2 * Math.PI * (s.t + sc.t0)) / K.LUNAR_PERIOD;
    d.sunE = Math.sin(d.phase);
    d.textC = -170 + 190 * Math.max(0, d.sunE);
    d.solarKW = K.SOLAR_MAX * clamp(d.sunE * 3, 0, 1) * s.dustEff;
    d.nucKW = c.nuc;

    if (d.sunE <= 0 && !s.flags.night) {
      s.flags.night = true;
      this.addLog('warn', 'Lunar sunset. Solar output: 0 kW.');
    } else if (d.sunE > 0 && s.flags.night) {
      s.flags.night = false;
      this.addLog('ok', 'Lunar sunrise. Solar array online.');
    }

    const ogsKgPerH = c.ogs * K.OGS_MAX;
    const loads = {
      base: K.BASE_LOAD,
      pump: K.PUMP_KW * Math.abs(c.pump),
      ogs: K.OGS_KW_PER_KG * ogsKgPerH,
      scrub: K.SCRUB_KW * c.scrub,
      led: K.CROP_LED_KW * c.led,
      drill: K.ICE_KW * c.drill,
      wpa: K.WPA_KW,
      eva: s.eva.left > 0 ? 0.8 : 0,
      hvac: 0
    };

    const heatIn = loads.base + loads.pump + loads.ogs + loads.scrub + loads.led + loads.wpa;
    const reactorHeat = K.REACTOR_HEAT * d.nucKW;
    const hvacNeed = K.UA * (K.T_SET - d.textC) - (heatIn + reactorHeat + K.CREW_HEAT) + 1.5 * (K.T_SET - s.temp);

    let heaterKW = 0, coolKW = 0;
    if (hvacNeed > 0) {
      heaterKW = Math.min(hvacNeed, 12);
      loads.hvac = heaterKW;
    } else {
      coolKW = Math.min(-hvacNeed, 18);
      if (coolKW > 0) loads.hvac = coolKW / 3 + 0.1;
    }

    let demand = 0;
    for (const k in loads) demand += loads[k];

    const gen = d.solarKW + d.nucKW;
    let pf = 1, dis = 0;

    if (gen >= demand) {
      const chg = Math.min(gen - demand, K.BATT_CHG, (K.BATT_CAP - s.battery) / (dt * 0.95));
      s.battery += chg * 0.95 * dt;
      d.netKW = gen - demand;
    } else {
      dis = Math.min(demand - gen, K.BATT_DIS, s.battery / dt);
      s.battery = Math.max(0, s.battery - dis * dt);
      pf = clamp((gen + dis) / demand, 0, 1);
      d.netKW = -dis;
    }

    d.loads = loads;
    d.demandKW = demand;
    d.pf = pf;
    d.genKW = gen;
    d.loadKW = demand * pf;

    if (pf < 0.999) {
      this.logOnce('brown' + Math.floor(s.t / 24), 'crit', `BROWNOUT: subsystems at ${Math.round(pf * 100)}%.`);
    }

    s.temp += (dt * (heatIn * pf + K.CREW_HEAT + reactorHeat + (heaterKW - coolKW) * pf - K.UA * (s.temp - d.textC))) / K.C_TH;

    // 2. Розподіл води, насос Water-Wall, бур льоду та споживання екіпажу
    let wallDraw = 0;
    const takeWater = (amt) => {
      const fromTank = Math.min(amt, s.tank);
      s.tank -= fromTank;
      const fromWall = Math.min(amt - fromTank, s.shield);
      s.shield -= fromWall;
      wallDraw += fromWall;
      return fromTank + fromWall;
    };

    const giveWater = (amt) => {
      const toTank = Math.min(amt, K.TANK_CAP - s.tank);
      s.tank += toTank;
      s.shield += Math.min(amt - toTank, K.SHIELD_CAP - s.shield);
    };

    let pumpFlow = c.pump * K.PUMP_MAX * pf;
    if (pumpFlow > 0) {
      pumpFlow = Math.min(pumpFlow, s.tank / dt, (K.SHIELD_CAP - s.shield) / dt);
    } else {
      pumpFlow = -Math.min(-pumpFlow, s.shield / dt, (K.TANK_CAP - s.tank) / dt);
    }
    s.shield += pumpFlow * dt;
    s.tank -= pumpFlow * dt;
    d.pump = pumpFlow;

    d.ice = K.ICE_MAX * c.drill * pf;
    giveWater(d.ice * dt);

    const drinkGot = takeWater(K.CREW.h2o * dt);
    s.haz.water = (K.CREW.h2o * dt - drinkGot > 0.000001) ? s.haz.water + dt : Math.max(0, s.haz.water - dt);
    s.grey += K.CREW.grey * dt;
    s.food = Math.max(0, s.food - K.CREW.kcal * dt);
    let o2Used = K.CREW.o2 * dt;

    // 3. Робота на поверхні (EVA) та запилення сонячних панелей
    d.evaDoseRate = 0;
    const speOut = this.speExt(s.t);

    if (s.eva.left > 0) {
      const evaDt = Math.min(dt, s.eva.left);
      o2Used += K.EVA_O2 * evaDt;
      d.evaDoseRate = (K.GCR_EXT + speOut) * 0.5;
      s.dose += d.evaDoseRate * evaDt;

      if (s.eva.mode === 'clean') {
        s.dustEff += (1 - s.dustEff) * (1 - Math.pow(0.85, evaDt));
      } else {
        s.regolith = Math.min(K.REG_MAX, s.regolith + 2.5 * evaDt);
      }

      s.eva.left -= dt;
      if (s.eva.left <= 0) {
        s.eva.left = 0;
        this.addLog('ok', 'EVA complete. Crew back inside.');
      }
    }
    s.dustEff *= Math.pow(1 - K.DUST_PER_H, dt);

    // 4. Замкнений цикл ECLSS: Електроліз, Гідропоніка, Sabatier та очищення води (WPA)
    const wOgs = takeWater((ogsKgPerH * pf * dt) / K.O2_PER_L);
    const o2Ogs = wOgs * K.O2_PER_L;
    s.h2 = Math.min(K.H2_CAP, s.h2 + wOgs * K.H2_PER_L);
    d.ogsO2 = o2Ogs / dt;
    d.ogsW = wOgs / dt;

    const irrNeed = K.IRRIG_MAX * c.led * pf * dt;
    const irrGot = irrNeed > 0 ? takeWater(irrNeed) : 0;
    const wFac = irrNeed > 0 ? irrGot / irrNeed : 1;
    const co2Avail = Math.max(0, s.co2 - ppmToKg(250)) / dt;
    const yieldRate = Math.min(K.CROP_MAX * c.led * pf * s.crop * wFac, co2Avail / K.CROP_CO2);
    const co2Crop = yieldRate * K.CROP_CO2 * dt;
    const o2Crop = yieldRate * K.CROP_O2 * dt;

    const wLocked = 0.12 * irrGot;
    s.biomassW += wLocked;
    const wRel = s.biomassW * Math.min(1, (K.CREW.kcal * dt) / (s.food + K.CREW.kcal * dt));
    s.biomassW -= wRel;
    s.grey += Math.max(0, irrGot - wLocked - yieldRate * K.CROP_H2O * dt) + wRel;
    s.food += yieldRate * dt;

    let dCrop = 0.01;
    if (s.temp <= 10 || s.temp >= 35) dCrop = -0.03;
    else if (irrNeed > 0 && wFac < 0.7) dCrop = -0.02;
    else if (c.led * pf < 0.05) dCrop = -0.004;
    else if (ppmOf(s.co2) < 250) dCrop = -0.01;
    s.crop = clamp(s.crop + dCrop * dt, 0, 1);

    d.yield = yieldRate;
    d.irr = irrGot / dt;
    d.cropCO2 = co2Crop / dt;
    d.cropO2 = o2Crop / dt;

    const ppmNow = ppmOf(s.co2);
    const scrubCap = K.SCRUB_MAX * c.scrub * pf;
    const co2Rem = Math.max(0, Math.min(((scrubCap * ppmNow) / (ppmNow + 1000)) * dt, s.co2 - ppmToKg(100)));
    s.co2store += co2Rem;

    const co2Sab = Math.max(0, Math.min(scrubCap * dt, s.co2store, s.h2 / K.H2_PER_CO2));
    s.co2store -= co2Sab;
    s.h2 -= co2Sab * K.H2_PER_CO2;
    giveWater(co2Sab * K.SAB_WATER);

    d.vent = s.co2store > K.CO2_STORE_CAP ? (s.co2store - K.CO2_STORE_CAP) / dt : 0;
    if (s.co2store > K.CO2_STORE_CAP) s.co2store = K.CO2_STORE_CAP;
    d.removal = co2Rem / dt;
    d.sab = co2Sab / dt;
    d.sabWater = (co2Sab * K.SAB_WATER) / dt;

    const wpa = Math.min(s.grey, K.WPA_MAX * dt) * pf;
    s.grey -= wpa;
    giveWater(wpa * K.WPA_RECOVERY);
    d.wpa = wpa / dt;
    d.wallDraw = wallDraw / dt;

    // 5. Атмосфера купола та ослаблення радіації захисним щитом
    const o2Leak = K.LEAK * s.o2 * dt;
    s.o2 = Math.max(0, s.o2 + o2Ogs + o2Crop - o2Used - o2Leak);
    s.co2 = Math.max(0, s.co2 + K.CREW.co2 * dt - co2Crop - co2Rem);
    d.o2kPa = kgToKPa(s.o2, s.temp);
    d.co2ppm = ppmOf(s.co2);
    d.o2Net = (o2Ogs + o2Crop - o2Used - o2Leak) / dt;

    d.sigma = s.regolith + K.WATER_SIGMA * s.shield;
    d.tGCR = Math.exp(-d.sigma / K.GCR_LAMBDA);
    d.tSPE = Math.exp(-d.sigma / K.SPE_LAMBDA);
    d.speExt = speOut;
    d.speIn = speOut * d.tSPE;
    d.doseRate = K.GCR_EXT * d.tGCR + d.speIn;
    s.dose += d.doseRate * dt;

    for (let i = 0; i < sc.spe.length; i++) {
      if (s.t >= sc.spe[i].start) {
        this.logOnce('spe' + i, 'crit', `SOLAR PARTICLE EVENT #${i + 1}: up to ${sc.spe[i].peak} mSv/h outside!`);
      }
    }

    // 6. Перевірка лічильників виживання, фіналу місії та розрахунок швидкостей dX/dt
    this.updateHazards(dt, d);

    this.d = d;
    this.rates = {
      o2kPa: (d.o2kPa - prev.o2kPa) / dt,
      co2ppm: (d.co2ppm - prev.co2ppm) / dt,
      shield: (s.shield - prev.shield) / dt,
      tank: (s.tank - prev.tank) / dt,
      food: (s.food - prev.food) / dt,
      battery: (s.battery - prev.battery) / dt,
      temp: (s.temp - prev.temp) / dt,
      dose: d.doseRate + d.evaDoseRate
    };
  }

  // Окремий модульний метод перевірки аварійних порогів та перемоги
  updateHazards(dt, d) {
    const s = this.s, h = s.haz;
    const stepTimer = (cur, isBad) => isBad ? cur + dt : Math.max(0, cur - 0.5 * dt);

    h.o2 = stepTimer(h.o2, d.o2kPa < 16);
    h.fire = stepTimer(h.fire, d.o2kPa > 30);
    h.co2 = stepTimer(h.co2, d.co2ppm > 10000);
    h.temp = stepTimer(h.temp, s.temp < 5 || s.temp > 38);
    h.food = s.food <= 0 ? h.food + dt : 0;

    let fail = null;
    if (h.o2 >= 3) fail = 'Crew lost to hypoxia: cabin O2 stayed below 16 kPa.';
    else if (h.fire >= 2) fail = 'Cabin fire: O2 partial pressure exceeded 30 kPa.';
    else if (h.co2 >= 4) fail = 'Crew incapacitated by CO2 poisoning (> 10000 ppm).';
    else if (h.temp >= 12) fail = 'Habitat temperature left the survivable range.';
    else if (h.water >= 72) fail = 'Crew dehydrated: no potable water remaining.';
    else if (h.food >= 240) fail = 'Crew starved: food stores exhausted.';
    else if (s.dose >= K.DOSE_LIMIT) fail = `Radiation dose limit of ${K.DOSE_LIMIT} mSv exceeded.`;

    if (fail) {
      s.over = { why: fail };
      this.addLog('crit', 'MISSION FAILED: ' + fail);
    }

    d.hazards = {
      o2: [h.o2, 3], fire: [h.fire, 2], co2: [h.co2, 4],
      temp: [h.temp, 12], water: [h.water, 72], food: [h.food, 240]
    };

    s.t += dt;
    if (!s.over && !s.won && s.t >= this.sc.goal) {
      s.won = true;
      this.addLog('ok', `MISSION OBJECTIVE ACHIEVED after ${this.sc.goal} h!`);
    }
  }

  // Предикативний інженерний асистент (попереджає про загрози за 72 години)
  advisories() {
    const s = this.s, d = this.d, r = this.rates, list = [];
    if (!d.o2kPa) return list;

    const add = (lvl, txt) => list.push({ lvl, txt });
    const hrs = (h) => h < 1 ? '<1 h' : `${h.toFixed(0)} h`;
    const etaWarn = (margin, speed, msgFn) => {
      if (speed > 0 && margin / speed < 72) add('warn', msgFn(hrs(margin / speed)));
    };

    if (d.o2kPa < 17) add('crit', `O2 critically low (${d.o2kPa.toFixed(2)} kPa)! Raise Electrolysis or LED now.`);
    else if (d.o2kPa < 19.5) add('warn', `O2 below 19.5 kPa (${d.o2kPa.toFixed(2)} kPa). Raise Electrolysis.`);
    else if (r.o2kPa < -0.001) etaWarn(d.o2kPa - 19.5, -r.o2kPa, t => `O2 drops below 19.5 kPa in ${t}.`);

    if (d.o2kPa > 23.1) add('warn', `O2 above 23.1 kPa (${d.o2kPa.toFixed(2)} kPa): fire risk. Lower OGS.`);

    if (d.co2ppm > 5000) add(d.co2ppm > 8000 ? 'crit' : 'warn', `CO2 high (${d.co2ppm.toFixed(0)} ppm). Raise Scrubber power.`);
    else if (r.co2ppm > 1) etaWarn(5000 - d.co2ppm, r.co2ppm, t => `CO2 passes 5000 ppm in ${t}.`);

    const safeW = this.shieldSafe();
    if (s.shield < safeW) add('crit', `Water-Wall (${s.shield.toFixed(0)} L) below safe ${safeW.toFixed(0)} L! Refill Wall or heap regolith.`);
    else if (r.shield < -0.01) etaWarn(s.shield - safeW, -r.shield, t => `Water-Wall drops below safe ${safeW.toFixed(0)} L in ${t}.`);

    if (s.tank <= 0.5) add('crit', 'Internal water tank EMPTY! ECLSS is draining the Water-Wall.');
    else if (r.tank < -0.01) etaWarn(s.tank, -r.tank, t => `Internal tank runs dry in ${t}.`);

    if (s.food <= 0) add('crit', 'Food exhausted! Raise Hydroponics LED power.');
    else if (r.food < -1) etaWarn(s.food, -r.food, t => `Food runs out in ${t}.`);

    if (d.pf < 0.999) add('crit', `BROWNOUT: subsystems at ${Math.round(d.pf * 100)}%. Cut loads or raise reactor.`);
    else if (r.battery < -0.01) etaWarn(s.battery, -r.battery, t => `Battery empty in ${t}.`);

    if (s.temp > 28 || s.temp < 14) add('crit', `Habitat temperature ${s.temp.toFixed(1)} C out of comfort range.`);
    if (d.speExt > 0.3) add('crit', `SOLAR STORM: ${d.speExt.toFixed(1)} mSv/h outside, ${d.speIn.toFixed(2)} mSv/h inside. Keep Wall full!`);
    if (s.eva.left > 0 && d.speExt > 0.3) add('crit', 'DANGER: EVA crew unshielded during solar storm!');

    if (list.length === 0) {
      add('info', `All systems nominal. O2 ${d.o2kPa.toFixed(1)} kPa, CO2 ${d.co2ppm.toFixed(0)} ppm, Wall ${s.shield.toFixed(0)} L.`);
    }

    const order = { crit: 0, warn: 1, info: 2 };
    list.sort((a, b) => order[a.lvl] - order[b.lvl]);
    return list.slice(0, 6);
  }
}