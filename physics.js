    //Розрахунок фази дня/ночі
    d.phase = 2 * Math.PI * (s.t + sc.t0) / K.LUNAR_PERIOD;
    d.sunE = Math.sin(d.phase);
    d.textC = -170 + 190 * Math.max(0, d.sunE);
    d.solarKW = K.SOLAR_MAX * clamp(d.sunE * 3, 0, 1) * s.dustEff;
    d.nucKW = c.nuc;
    if (d.sunE <= 0 && !s.flags.night) { s.flags.night = true; this.addLog('warn', 'Lunar sunset. Solar output: 0 kW.'); }
    else if (d.sunE > 0 && s.flags.night) { s.flags.night = false; this.addLog('ok', 'Lunar sunrise. Solar array online.'); }
