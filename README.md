# Lunar Outpost ECLSS Simulator

> **Interactive closed-loop Lunar Outpost ECLSS simulator built for the NASA Space Apps Challenge (*"Build a Junior Astronaut Mission Trainer"*).**

## About The Project

**Lunar Outpost ECLSS Simulator** is a browser-based engineering sandbox where players manage the Environmental Control and Life Support System (ECLSS) of a 4-crew lunar habitat (400 m³ pressurized volume).

All station subsystems share the same power grid, water tanks, and cabin atmosphere. Splitting water to generate oxygen drains potable reserves and consumes power, scrubbing too much CO2 starves the hydroponic crops, and running the nuclear reactor at full throttle during the lunar night adds waste heat that the HVAC system must reject. Players have to monitor live telemetry, anticipate resource shortages, and balance subsystem throttles as external conditions change.

## Controls & Subsystem Mechanics

### Left Panel: Engineering Controls
- **Water-Wall <-> Internal Tank Pump (`-100%` to `+100%`):** Moves water between the 700 L internal potable tank and the 900 L hull radiation shield (`< 0` drains the wall into the tank; `> 0` fills the wall). If the internal tank runs completely dry, life support systems automatically pull water from the radiation shield.
- **Electrolysis (OGS) Throttle (`0–100%`):** Splits water into breathable O2 (0.89 kg/L) and H2 (0.11 kg/L) at up to 3.6 kW. Keeping OGS too high pushes cabin O2 above 23.1 kPa (fire warning) and 30 kPa (cabin fire).
- **Sabatier / CO2 Scrubber (`0–100%`):** Captures cabin CO2 and reacts it with H2 from electrolysis to recover water (0.82 L per kg of CO2). *Tip:* If cabin CO2 drops below ~350 ppm, turn down the scrubber so the hydroponic bay gets enough CO2 for photosynthesis.
- **Hydroponics LED Power (`0–100%`):** Uses up to 8 kW of light, water, and cabin CO2 (above 250 ppm) to grow up to 650 kcal/h of food and produce bonus O2. Because crew respiration returns ~86% of eaten carbon as CO2, steady-state crop yield covers ~431 kcal/h out of the crew's 500 kcal/h demand unless extra CO2 is buffered in the cabin.
- **Ice Extractor Drill (`0–100%`):** Extracts up to 1.6 L/h of water from polar crater ice (up to 5 kW), filling the internal tank first and overflowing into the Water-Wall.
- **Kilopower Reactor Throttle (`0–12 kWe`):** Provides continuous baseline power day and night. 30% of reactor power leaks into the habitat as waste heat, increasing HVAC cooling load.
- **EVA Crew (`Clean Solar Dust` / `Heap Regolith`):** Sends 2 astronauts outside for 6 hours. Cleaning restores solar array efficiency (degraded by 0.2%/h dust buildup), while heaping regolith adds +2.5 g/cm²/h of permanent radiation shielding (up to 150 g/cm²). Each EVA vents 1.5 kg of airlock O2 and leaves the outside crew unshielded during solar storms.

### Right Panel: Telemetry & Predictive Assistant
- **Predictive Engineering Assistant:** Calculates real-time consumption rates (`dX/dt`) and warns the player up to 72 hours before O2, water, food, battery charge, or radiation shielding crosses a critical threshold.
- **Live Telemetry & Stores:** Displays 10 primary gauges with `ok` / `warn` / `crit` status bars, plus secondary buffers (`Grey water`, `Biomass H2O`, `H2 store`, `CO2 store`, `Regolith`, `Shield sigma`, `Crop health`, and minimum `Safe Wall` water volume).

## Mission Scenarios

| Scenario | Duration | Initial Conditions & Primary Challenge |
| :--- | :--- | :--- |
| **Mission 1: Equilibrium Training** | 168 h (7 days) | Starts near closed-loop equilibrium. Includes a moderate solar storm at T+90 h (2.5 mSv/h peak). |
| **Mission 2: X-Class Solar Flare Crisis** | 96 h (4 days) | Starts with low O2 (19.9 kPa) and high CO2 (2500 ppm). Heavy solar flares hit at T+8 h (15 mSv/h) and T+60 h (8 mSv/h). |
| **Mission 3: 14-Day Lunar Night Survival** | 336 h (14 days) | Full lunar night at -170 °C outside and 0 kW solar power. Requires careful reactor, battery, and brownout management. |

## Survival Limits (Failure Conditions)

The mission ends in failure if any of the following conditions are met:
- **Hypoxia:** Cabin O2 stays below `16 kPa` for 3 hours.
- **Cabin Fire:** Cabin O2 exceeds `30 kPa` for 2 hours.
- **CO2 Poisoning:** Cabin CO2 exceeds `10,000 ppm` for 4 hours.
- **Thermal Failure:** Habitat temperature leaves the `5 °C – 38 °C` range for 12 hours.
- **Dehydration:** Potable water is completely depleted for 72 hours.
- **Starvation:** Food supply stays at `0 kcal` for 240 hours.
- **Radiation Limit:** Cumulative crew radiation dose reaches `150 mSv`.

## Project Structure & Running Locally

- `index.html` — Main three-column interface layout (controls, Canvas viewport, telemetry panels, and modal dialogs).
- `style.css` — UI styling, responsive layout, progress bars, and alert animations.
- `physics.js` — Physical constants (`K`), scenario definitions (`SCENARIOS`), state machine (`Sim`), hazard timers, and predictive advisor logic.
- `app.js` — 2D HTML5 Canvas schematic renderer (`drawScene()`), DOM updater (`updateUI()`), fixed-timestep loop (`frame()`), and event listeners.

The simulator uses vanilla JavaScript, HTML5 Canvas, and CSS with no external libraries or build steps. To run it locally, clone the repository and open `index.html` in any modern web browser.

## 👨‍💻 Team — R&D CIT KAI

Developed by the **Student Research Society of the Department of Computer Information Technologies**, Faculty of Computer Science and Technology, **NU KAI** (Ukraine).

- **Mykola Kravchenko** [@nic_k] — Team Owner
- **Vladyslav Yaremchuk** [@yaremchuk_vladyslav]
- **Egor Serdiuk** [@\_ehor\_]

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.