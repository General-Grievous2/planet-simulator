// simulator.js — N-body physics engine (Leapfrog / Störmer-Verlet)

export const G           = 6.674e-11;   // m³ kg⁻¹ s⁻²
export const AU          = 1.496e11;    // metres per AU
export const SOLAR_MASS  = 1.989e30;    // kg

// ── Mass unit table (for UI) ─────────────
export const MASS_UNITS = {
  kg:      { label: 'kg',              factor: 1          },
  ton:     { label: 'Metric Tons',     factor: 1e3        },
  moon:    { label: 'Moon masses',     factor: 7.342e22   },
  earth:   { label: 'Earth masses',    factor: 5.972e24   },
  jupiter: { label: 'Jupiter masses',  factor: 1.898e27   },
  solar:   { label: 'Solar masses',    factor: 1.989e30   },
};

export function autoUnit(kg) {
  let unit;
  if (kg >= 0.01 * 1.989e30) unit = 'solar';
  else if (kg >= 0.01 * 1.898e27) unit = 'jupiter';
  else if (kg >= 0.01 * 5.972e24) unit = 'earth';
  else if (kg >= 0.01 * 7.342e22) unit = 'moon';
  else if (kg >= 1e3)              unit = 'ton';
  else unit = 'kg';
  return { unit, value: kg / MASS_UNITS[unit].factor };
}

let _nextId = 1;

// ── Body ──────────────────────────────────
export class Body {
  constructor(name, x, y, vx, vy, mass, radius, color) {
    this.id          = _nextId++;
    this.name        = name;
    this.x           = x;    // m
    this.y           = y;    // m
    this.vx          = vx;   // m/s
    this.vy          = vy;   // m/s
    this.mass        = mass; // kg
    this.radius      = radius; // display px
    this.color       = color;
    this.ax          = 0;
    this.ay          = 0;
    this._vxh        = vx;
    this._vyh        = vy;
    this._leapReady  = false;
    this.trail       = [];
    this.forceMag    = 0;    // N — gravitational force magnitude
    this.physRadius  = radius * 1.5e8; // collision radius in m
    // External constant force (e.g. engine thrust)
    this.fx_ext      = 0;   // Newtons
    this.fy_ext      = 0;   // Newtons
    this.engineOn    = false;
    // JoJo-related
    this.jojo        = false; // lights up gold
  }
}

// ── Simulation ────────────────────────────
export class Simulation {
  constructor() {
    this.bodies           = [];
    this.softening        = 0.01 * AU;
    this.mergeOnCollision = true;
    this.time             = 0;
    this.maxTrailLength   = 600;
    // Merge flash events
    this.mergeEvents      = [];
    this.newMergeEvents   = [];  // drained by renderer each frame
  }

  addBody(b) {
    this.bodies.push(b);
    this.bodies.forEach(bd => { bd._leapReady = false; });
  }

  removeById(id) {
    this.bodies = this.bodies.filter(b => b.id !== id);
    this.bodies.forEach(bd => { bd._leapReady = false; });
  }

  clear() {
    this.bodies       = [];
    this.mergeEvents  = [];
    this.newMergeEvents = [];
    this.time         = 0;
  }

  // ── Accelerations ─────────────────────
  _accumulateAccels() {
    for (const b of this.bodies) { b.ax = 0; b.ay = 0; b.forceMag = 0; }
    const eps2 = this.softening * this.softening;
    const n = this.bodies.length;
    for (let i = 0; i < n; i++) {
      const bi = this.bodies[i];
      for (let j = i + 1; j < n; j++) {
        const bj = this.bodies[j];
        const dx = bj.x - bi.x, dy = bj.y - bi.y;
        const r2 = dx*dx + dy*dy + eps2;
        const r  = Math.sqrt(r2);
        const g  = G / (r2 * r);
        const gx = g * dx, gy = g * dy;
        bi.ax += bj.mass * gx; bi.ay += bj.mass * gy;
        bj.ax -= bi.mass * gx; bj.ay -= bi.mass * gy;
        const fmag = G * bi.mass * bj.mass / r2;
        bi.forceMag += fmag; bj.forceMag += fmag;
      }
    }
    // External forces (engine / thrust)
    for (const b of this.bodies) {
      if (b.fx_ext !== 0 || b.fy_ext !== 0) {
        b.ax += b.fx_ext / b.mass;
        b.ay += b.fy_ext / b.mass;
      }
    }
  }

  // ── Leapfrog integrator ───────────────
  step(dt, subSteps = 1) {
    if (this.bodies.length === 0) return;
    const h = dt / subSteps;
    for (let s = 0; s < subSteps; s++) this._leapfrogStep(h);
    // Record trails once per real frame
    for (const b of this.bodies) {
      const tl = b.trail;
      if (tl.length === 0 ||
          Math.hypot(b.x - tl[tl.length-1].x, b.y - tl[tl.length-1].y) > 0.001 * AU) {
        tl.push({ x: b.x, y: b.y });
        if (tl.length > this.maxTrailLength) tl.shift();
      }
    }
    this.time += dt;
    if (this.mergeOnCollision) this._handleMerges();
    // Expire old flash events (keep 4 s)
    const now = this.time;
    this.mergeEvents = this.mergeEvents.filter(e => (now - e.simTime) < 4 * 365.25 * 86400);
  }

  _leapfrogStep(h) {
    if (!this.bodies.every(b => b._leapReady)) {
      this._accumulateAccels();
      for (const b of this.bodies) {
        b._vxh = b.vx + 0.5 * b.ax * h;
        b._vyh = b.vy + 0.5 * b.ay * h;
        b._leapReady = true;
      }
    }
    for (const b of this.bodies) { b.x += b._vxh * h; b.y += b._vyh * h; }
    this._accumulateAccels();
    for (const b of this.bodies) {
      b.vx   = b._vxh + 0.5 * b.ax * h;
      b.vy   = b._vyh + 0.5 * b.ay * h;
      b._vxh = b.vx   + 0.5 * b.ax * h;
      b._vyh = b.vy   + 0.5 * b.ay * h;
    }
  }

  // ── Collision merging ─────────────────
  _handleMerges() {
    let found = true;
    while (found) {
      found = false;
      outer: for (let i = 0; i < this.bodies.length; i++) {
        for (let j = i + 1; j < this.bodies.length; j++) {
          const a = this.bodies[i], b = this.bodies[j];
          if (Math.hypot(b.x - a.x, b.y - a.y) < a.physRadius + b.physRadius) {
            this._merge(i, j);
            found = true; break outer;
          }
        }
      }
    }
  }

  _merge(i, j) {
    const a = this.bodies[i], b = this.bodies[j];
    const Mt = a.mass + b.mass;
    // The bigger body survives (eats the smaller)
    const big   = a.mass >= b.mass ? a : b;
    const small = a.mass >= b.mass ? b : a;

    // Momentum conservation
    const nx = (a.mass * a.x  + b.mass * b.x)  / Mt;
    const ny = (a.mass * a.y  + b.mass * b.y)  / Mt;
    const nvx = (a.mass * a.vx + b.mass * b.vx) / Mt;
    const nvy = (a.mass * a.vy + b.mass * b.vy) / Mt;

    big.x    = nx; big.y  = ny;
    big.vx   = nvx; big.vy = nvy;
    big.mass = Mt;
    big.radius      = Math.ceil(Math.cbrt(Math.pow(a.radius,3) + Math.pow(b.radius,3)));
    big.physRadius  = Math.max(a.physRadius, b.physRadius) * 1.06;
    big.trail       = [];
    // Combined external force
    big.fx_ext += small.fx_ext;
    big.fy_ext += small.fy_ext;

    // Flash event w/ JoJo shout
    const ev = {
      x: nx, y: ny, simTime: this.time,
      text: _jojoShout(big.name, small.name),
      bigName: big.name, smallName: small.name,
    };
    this.mergeEvents.push(ev);
    this.newMergeEvents.push(ev);

    this.bodies = this.bodies.filter(bd => bd !== small);
    this.bodies.forEach(bd => { bd._leapReady = false; });
  }

  // ── Diagnostics ───────────────────────
  kineticEnergy()   { return this.bodies.reduce((s,b) => s + 0.5*b.mass*(b.vx*b.vx+b.vy*b.vy), 0); }
  potentialEnergy() {
    let U = 0; const eps2 = this.softening*this.softening;
    for (let i = 0; i < this.bodies.length; i++)
      for (let j = i+1; j < this.bodies.length; j++) {
        const dx = this.bodies[j].x-this.bodies[i].x, dy = this.bodies[j].y-this.bodies[i].y;
        U -= G * this.bodies[i].mass * this.bodies[j].mass / Math.sqrt(dx*dx+dy*dy+eps2);
      }
    return U;
  }
  totalEnergy()  { return this.kineticEnergy() + this.potentialEnergy(); }
  centerOfMass() {
    let M=0, cx=0, cy=0;
    for (const b of this.bodies) { M+=b.mass; cx+=b.mass*b.x; cy+=b.mass*b.y; }
    return M>0 ? {x:cx/M,y:cy/M,mass:M} : {x:0,y:0,mass:0};
  }
}

// ── JoJo shout selector ───────────────────
const SHOUTS = [
  'WRRYYYY!!', 'ORA ORA ORA!', 'MUDA MUDA!', 'KONO DIO DA!',
  'YARE YARE DAZE', 'HOLY MOLY!', 'STAR FINGER!', 'KILLER QUEEN!',
  'CRAZY DIAMOND!', 'JAM!! JAM!!', 'GREAT DAYS!',
];
function _jojoShout(bigName, smallName) {
  const n = (bigName + smallName).toUpperCase();
  if (n.includes('DIO'))      return 'KONO DIO DA! 🧛';
  if (n.includes('ORA'))      return 'ORA ORA ORA! 👊';
  if (n.includes('MUDA'))     return 'MUDA MUDA MUDA! 🌟';
  if (n.includes('GIORNO'))   return 'THIS IS REQUIEM! 🌹';
  if (n.includes('JOTARO'))   return 'YARE YARE DAZE 🌊';
  if (n.includes('KIRA'))     return 'KILLER QUEEN! 💣';
  if (n.includes('GAPPY'))    return 'SOFT & WET! 🫧';
  if (n.includes('JOSUKE'))   return 'GREAT DAYS! 💎';
  if (n.includes('ROAD'))     return 'ROAD ROLLA DA!! 🛣️';
  if (n.includes('STAR'))     return 'STAR PLATINUM!! ⭐';
  return SHOUTS[Math.floor(Math.random() * SHOUTS.length)];
}

// ── Preset builder helpers ────────────────
function bd(name, xAU, yAU, vxKms, vyKms, massKg, radiusPx, color, physR) {
  const b = new Body(name, xAU*AU, yAU*AU, vxKms*1e3, vyKms*1e3, massKg, radiusPx, color);
  b.physRadius = physR !== undefined ? physR : radiusPx * 1.5e8;
  return b;
}

// ── Presets ───────────────────────────────
export const PRESETS = {

  'solar-inner': () => [
    bd('Sun',     0,      0,    0,      0,      1.989e30, 16, '#FFF176'),
    bd('Mercury', 0.387,  0,    0,     47.87,   3.301e23,  4, '#B0BEC5'),
    bd('Venus',   0.723,  0,    0,     35.02,   4.867e24,  6, '#FFCC80'),
    bd('Earth',   1.000,  0,    0,     29.78,   5.972e24,  7, '#42A5F5'),
    bd('Mars',    1.524,  0,    0,     24.13,   6.417e23,  5, '#EF5350'),
  ],

  'solar-full': () => [
    bd('Sun',     0,       0,   0,      0,       1.989e30, 16, '#FFF176'),
    bd('Mercury', 0.387,   0,   0,     47.87,    3.301e23,  3, '#B0BEC5'),
    bd('Venus',   0.723,   0,   0,     35.02,    4.867e24,  5, '#FFCC80'),
    bd('Earth',   1.000,   0,   0,     29.78,    5.972e24,  6, '#42A5F5'),
    bd('Mars',    1.524,   0,   0,     24.13,    6.417e23,  4, '#EF5350'),
    bd('Jupiter', 5.204,   0,   0,     13.07,    1.898e27, 13, '#CE9C66'),
    bd('Saturn',  9.537,   0,   0,      9.69,    5.683e26, 11, '#F8D59A'),
    bd('Uranus', 19.191,   0,   0,      6.81,    8.681e25,  8, '#80DEEA'),
    bd('Neptune',30.069,   0,   0,      5.43,    1.024e26,  8, '#5C6BC0'),
  ],

  'earth-moon': () => {
    const EM = 3.844e8, moonV = 1022;
    const earth = new Body('Earth', 0, 0, 0, 0, 5.972e24, 10, '#42A5F5');
    const moon  = new Body('Moon', EM, 0, 0, moonV, 7.342e22, 4, '#BDBDBD');
    earth.physRadius = 8e6; moon.physRadius = 2e6;
    return [earth, moon];
  },

  'binary-star': () => {
    const M = 1.989e30, sep = 2*AU;
    const v = Math.sqrt(G*M / (2*sep));
    const a = new Body('Star A', -sep/2, 0,  0,  v, M, 14, '#FF8A65');
    const b = new Body('Star B',  sep/2, 0,  0, -v, M, 14, '#64B5F6');
    a.physRadius = b.physRadius = 6e9;
    return [a, b];
  },

  'three-body': () => {
    const M = 5e30, sc = 2.2*AU, vc = Math.sqrt(G*M/sc);
    const bodies = [
      new Body('α', -0.97000436*sc,  0.24308753*sc,  0.93240737/2*vc,  0.86473146/2*vc, M, 8, '#EF5350'),
      new Body('β',  0.97000436*sc, -0.24308753*sc,  0.93240737/2*vc,  0.86473146/2*vc, M, 8, '#4CAF50'),
      new Body('γ',  0,              0,              -0.93240737*vc,   -0.86473146*vc,   M, 8, '#42A5F5'),
    ];
    bodies.forEach(b => { b.physRadius = 5e9; });
    return bodies;
  },

  'galaxy-collision': () => {
    const bodies = [];
    const Mc = 2e31, Ms = 3e29, N = 18;
    function cluster(cx, cy, vx, vy, cc, sc, tag) {
      const core = new Body(tag+' Core', cx, cy, vx, vy, Mc, 16, cc);
      core.physRadius = 8e9; bodies.push(core);
      for (let i = 0; i < N; i++) {
        const r = (0.4 + Math.random()*0.9)*AU, ang = Math.random()*2*Math.PI;
        const vOrb = Math.sqrt(G*Mc/r);
        const star = new Body(tag+(i+1), cx+r*Math.cos(ang), cy+r*Math.sin(ang),
          vx - vOrb*Math.sin(ang), vy + vOrb*Math.cos(ang), Ms, 3, sc);
        star.physRadius = 2e9; bodies.push(star);
      }
    }
    cluster(-5*AU,  0.5*AU,  7000,  500, '#FFF176', '#90CAF9', 'A');
    cluster( 5*AU, -0.5*AU, -7000, -500, '#FFCC80', '#EF9A9A', 'B');
    return bodies;
  },

  // ── JoJo Presets ──────────────────────
  'jojo-roadroller': () => {
    const sunM = 1.989e30;
    const earth = new Body('DIO 🧛', 0, 0, 0, 0, sunM * 0.8, 18, '#FFD700');
    earth.physRadius = 1.2e10; earth.jojo = true;
    const planet = new Body('Jotaro 🌊', 2*AU, 0, 0, 19000, 5.972e24, 7, '#42A5F5');
    planet.physRadius = 6e8;
    const roadroller = new Body('Road Roller 🛣️', 2*AU, 0.5*AU, 0, -8000, sunM*3, 22, '#FF9800');
    roadroller.physRadius = 1.5e10; roadroller.jojo = true;
    const giorno = new Body('Giorno 🌹', -1.5*AU, 0, 0, 25000, 3e24, 6, '#FFB300');
    giorno.physRadius = 5e8; giorno.jojo = true;
    return [earth, planet, roadroller, giorno];
  },

  'jojo-starstruck': () => {
    // Star Platinum vs The World — two massive fast bodies orbiting
    const M = SOLAR_MASS * 1.5, sep = 1.2*AU;
    const v = Math.sqrt(G*M/(2*sep)) * 1.1;
    const sp = new Body('Star Platinum ⭐', -sep/2, 0,  0,  v, M, 14, '#4A90D9');
    sp.physRadius = 8e9; sp.jojo = true;
    const tw = new Body('The World ⌛',   sep/2, 0,  0, -v, M, 14, '#FFD700');
    tw.physRadius = 8e9; tw.jojo = true;
    // Several smaller stands orbiting
    const stands = [
      {name:'Crazy Diamond 💎', c:'#E91E63'}, {name:'Gold Experience 🌟', c:'#FFF176'},
      {name:'Killer Queen 💣',  c:'#CE93D8'}, {name:'Sticky Fingers 👆', c:'#80CBC4'},
    ];
    const out = [sp, tw];
    stands.forEach((s, i) => {
      const r = (2.5 + i*0.6)*AU, ang = i * Math.PI/2;
      const vOrb = Math.sqrt(G*(M+M)/r);
      const b = new Body(s.name, r*Math.cos(ang), r*Math.sin(ang), -vOrb*Math.sin(ang), vOrb*Math.cos(ang), sunM()*0.01, 5, s.c);
      b.physRadius = 4e8; b.jojo = true; out.push(b);
    });
    return out;
    function sunM() { return 1.989e30; }
  },

  'jojo-requiem': () => {
    // Golden spiral of bodies (Giorno's Requiem — everything transforms)
    const bodies = [];
    const phi = (1 + Math.sqrt(5)) / 2; // golden ratio
    const N = 13;
    const coreM = SOLAR_MASS * 2;
    const core = new Body('Gold Requiem 👑', 0, 0, 0, 0, coreM, 18, '#FFD700');
    core.physRadius = 1.2e10; core.jojo = true; bodies.push(core);
    for (let i = 1; i <= N; i++) {
      const r    = i * 0.55 * AU;
      const ang  = i * 2 * Math.PI / (phi * phi);
      const vOrb = Math.sqrt(G * coreM / r);
      const names = ['Giorno 🌹','Bruno 🤐','Abbacchio 🍷','Fugo 🦋','Narancia ✈️',
                     'Mista 🔫','Trish 🌸','Doppio 📞','Risotto ⚗️','Illuso 🪞',
                     'Prosciutto 🧤','Pesci 🐟','Cioccolata 🍫'];
      const colors = ['#FFD700','#546E7A','#7B1FA2','#00897B','#F57F17',
                      '#D32F2F','#E91E63','#FF6F00','#37474F','#4A148C',
                      '#827717','#006064','#1B5E20'];
      const b = new Body(names[i-1]||`Stand ${i}`, r*Math.cos(ang), r*Math.sin(ang),
        -vOrb*Math.sin(ang), vOrb*Math.cos(ang), SOLAR_MASS*0.003*i, 4+Math.floor(i/3), colors[i-1]||'#fff');
      b.physRadius = (4+Math.floor(i/3)) * 2e8; b.jojo = true; bodies.push(b);
    }
    return bodies;
  },

  'jojo-zawarudo': () => {
    // Inner solar system preset, but returns "paused:true" flag
    const bodies = [
      bd('Sun (Za Warudo ⌛)', 0,      0,    0,      0,      1.989e30, 16, '#FFD700'),
      bd('Mercury',            0.387,  0,    0,     47.87,   3.301e23,  4, '#B0BEC5'),
      bd('Venus',              0.723,  0,    0,     35.02,   4.867e24,  6, '#FFCC80'),
      bd('Earth',              1.000,  0,    0,     29.78,   5.972e24,  7, '#42A5F5'),
      bd('Mars',               1.524,  0,    0,     24.13,   6.417e23,  5, '#EF5350'),
    ];
    bodies.forEach(b => { b.jojo = true; });
    bodies.__zawarudo = true;
    return bodies;
  },
};
