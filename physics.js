    'use strict';
    const K = {
    STEP: 0.25, V: 400, R: 8.314, T_REF: 294.15, MW_O2: 0.032, MW_CO2: 0.044, P_TOTAL: 101325,
    CREW: { n: 4, o2: 0.14, h2o: 0.5, kcal: 500, co2: 0.17, grey: 0.45 }, CREW_HEAT: 0.5,
    SOLAR_MAX: 30, NUC_MAX: 12, DUST_PER_H: 0.002, LUNAR_PERIOD: 708,
    BASE_LOAD: 1.8, BATT_CAP: 120, BATT_CHG: 20, BATT_DIS: 25,
    OGS_MAX: 0.8, OGS_KW_PER_KG: 4.5, O2_PER_L: 0.89, H2_PER_L: 0.11, LEAK: 0.0002,
    SCRUB_MAX: 0.4, SCRUB_KW: 2.0, H2_PER_CO2: 0.18, SAB_WATER: 0.818, CO2_STORE_CAP: 20, H2_CAP: 3,
    CROP_MAX: 650, CROP_LED_KW: 8, CROP_CO2: 0.000394, CROP_O2: 0.000287, CROP_H2O: 0.000161, IRRIG_MAX: 0.8,
    PUMP_MAX: 40, PUMP_KW: 0.6, ICE_MAX: 1.6, ICE_KW: 5, WPA_MAX: 1.5, WPA_KW: 0.4, WPA_RECOVERY: 0.95,
    SHIELD_CAP: 900, TANK_CAP: 700, UA: 0.04, C_TH: 15, T_SET: 21, REACTOR_HEAT: 0.3,
    GCR_EXT: 0.03, GCR_LAMBDA: 250, SPE_LAMBDA: 22, WATER_SIGMA: 0.1, DOSE_LIMIT: 150, SIGMA_SAFE: 70,
    EVA_H: 6, EVA_O2: 0.25, EVA_LOCK_O2: 1.5, REG_MAX: 150
    };
    const MOL_TOTAL = K.P_TOTAL * K.V / (K.R * K.T_REF);
    function clamp(x, low, high) { return Math.max(low, Math.min(high, x)); }
    function kgToKPa(kg, tempC) { return (kg / K.MW_O2) * K.R * (tempC + 273.15) / K.V / 1000; }
    function kPaToKg(kPa, tempC) { return (kPa * 1000 * K.V / (K.R * (tempC + 273.15))) * K.MW_O2; }
    function ppmOf(kg) { return (kg / K.MW_CO2) / MOL_TOTAL * 1000000; }
    function ppmToKg(ppm) { return (ppm / 1000000) * MOL_TOTAL * K.MW_CO2; }
    const BASE = {
    o2kPa: 21.2, co2ppm: 700, shield: 700, tank: 420, grey: 80, h2: 0.6,
    co2store: 2, food: 72000, battery: 100, temp: 21, dustEff: 1, regolith: 30, biomassW: 6, crop: 0.9
    };
    const BASE_CTL = { pump: 0, ogs: 0.15, scrub: 0.35, led: 0.5, drill: 0.2, nuc: 8 };

    const SCENARIOS = {
    1: {
        id: 1, name: 'Mission 1: Equilibrium Training', goal: 168, t0: 60,
        spe: [{ start: 90, rise: 3, peak: 2.5, tau: 8 }], init: {}, ctl: {},
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
    //Розрахунок фази дня/ночі
    d.phase = 2 * Math.PI * (s.t + sc.t0) / K.LUNAR_PERIOD;
    d.sunE = Math.sin(d.phase);
    d.textC = -170 + 190 * Math.max(0, d.sunE);
    d.solarKW = K.SOLAR_MAX * clamp(d.sunE * 3, 0, 1) * s.dustEff;
    d.nucKW = c.nuc;
    if (d.sunE <= 0 && !s.flags.night) { s.flags.night = true; this.addLog('warn', 'Lunar sunset. Solar output: 0 kW.'); }
    else if (d.sunE > 0 && s.flags.night) { s.flags.night = false; this.addLog('ok', 'Lunar sunrise. Solar array online.'); }



