/* ══════════════════════════════════════════════════════════
   main.js — Planet Simulator
   Rendering, camera, UI, placement, JoJo references
   ══════════════════════════════════════════════════════════ */
import { Body, Simulation, PRESETS, AU, G, MASS_UNITS, autoUnit }
  from './simulator.js';

// ─── Canvas / Context ────────────────────────────────────────
const canvas = document.getElementById('canvas');
const ctx    = canvas.getContext('2d');

// ─── Camera ──────────────────────────────────────────────────
const PIXELS_PER_AU = 150;
const cam = { x: 0, y: 0, zoom: 1 };

const s2px  = x => canvas.width  / 2 + (x - cam.x) / AU * PIXELS_PER_AU * cam.zoom;
const s2py  = y => canvas.height / 2 - (y - cam.y) / AU * PIXELS_PER_AU * cam.zoom;
const px2sx = px => cam.x + (px - canvas.width  / 2) / PIXELS_PER_AU / cam.zoom * AU;
const px2sy = py => cam.y - (py - canvas.height / 2) / PIXELS_PER_AU / cam.zoom * AU;
const au2px = d  => d / AU * PIXELS_PER_AU * cam.zoom;

// ─── State ───────────────────────────────────────────────────
let sim         = new Simulation();
let paused      = false;
let addMode     = false;
let placing     = null;
let dragEnd     = null;
let selectedBody = null;
let showTrails  = true;
let showEngines = false;
let velSensMult = 1;
let panning     = false;
let panStart    = null;
let camStart    = null;
let lastTime    = null;
let zawarudoActive = false;

// ─── DOM refs ────────────────────────────────────────────────
const $ = id => document.getElementById(id);

const btnPlay      = $('btn-play');
const btnReset     = $('btn-reset');
const btnAddMode   = $('btn-add-mode');
const presetSel    = $('preset-select');
const statusBodies = $('status-bodies');
const statusTime   = $('status-time');
const statusEnergy = $('status-energy');

const dtSlider       = $('dt-slider');
const dtVal          = $('dt-val');
const substepsSlider = $('substeps-slider');
const substepsVal    = $('substeps-val');
const softSlider     = $('soft-slider');
const softVal        = $('soft-val');
const chkTrails      = $('chk-trails');
const chkEngines     = $('chk-engines');
const chkCenter      = $('chk-center');
const velSensSlider  = $('vel-sens');
const velSensVal     = $('vel-sens-val');

const newName      = $('new-name');
const newMassVal   = $('new-mass-val');
const newMassUnit  = $('new-mass-unit');
const newRadius    = $('new-radius');
const newRadiusVal = $('new-radius-val');
const newColor     = $('new-color');

const infoNone     = $('info-none');
const infoBody     = $('info-body');
const editName     = $('edit-name');
const editMassVal  = $('edit-mass-val');
const editMassUnit = $('edit-mass-unit');
const editRadius   = $('edit-radius');
const editRadiusVal= $('edit-radius-val');
const editVx       = $('edit-vx');
const editVy       = $('edit-vy');
const kickDvx      = $('kick-dvx');
const kickDvy      = $('kick-dvy');
const btnKick      = $('btn-kick');
const engineFx     = $('engine-fx');
const engineFy     = $('engine-fy');
const engineStatus = $('engine-status');
const btnDelete    = $('btn-delete');
const btnZawarudo  = $('btn-zawarudo');

const iName  = $('i-name');
const iMass  = $('i-mass');
const iPos   = $('i-pos');
const iVel   = $('i-vel');
const iOrbit = $('i-orbit');

const flashContainer = $('flash-container');
const helpModal      = $('help-modal');

// ─── Mass helpers ────────────────────────────────────────────
function getMassKg(valEl, unitEl) {
  const v = parseFloat(valEl.value) || 1;
  return v * MASS_UNITS[unitEl.value].factor;
}
function setMassFields(valEl, unitEl, kg) {
  const { unit, value } = autoUnit(kg);
  valEl.value  = +value.toPrecision(4);
  unitEl.value = unit;
}

// ─── Velocity scale ──────────────────────────────────────────
function velScale() {
  // returns m/s per metre of world-space drag
  // 1 AU drag  →  30 km/s  (Earth orbital speed) at velSensMult=1
  return (3e4 / AU) * velSensMult;
}

// ─── Quick body presets ──────────────────────────────────────
const QUICK_DEFS = {
  sun:         { name:'Sun',      mass:1.989e30, r:16, color:'#FFF176' },
  earth:       { name:'Earth',    mass:5.972e24, r:7,  color:'#42A5F5' },
  moon:        { name:'Moon',     mass:7.342e22, r:4,  color:'#BDBDBD' },
  jupiter:     { name:'Jupiter',  mass:1.898e27, r:13, color:'#CE9C66' },
  'black-hole':{ name:'Void',     mass:1e32,     r:8,  color:'#111111' },
  asteroid:    { name:'Rock',     mass:1e15,     r:3,  color:'#9E9E9E' },
  dio:         { name:'DIO',      mass:1.98e30,  r:18, color:'#FFD700', jojo:true },
  jotaro:      { name:'Jotaro',  mass:5.972e24,  r:7,  color:'#4A90D9', jojo:true },
};

document.querySelectorAll('.quick-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const def = QUICK_DEFS[btn.dataset.quick];
    if (!def) return;
    newName.value = def.name;
    newColor.value = def.color;
    newRadius.value = def.r;
    newRadiusVal.textContent = def.r + 'px';
    setMassFields(newMassVal, newMassUnit, def.mass);
    if (!addMode) toggleAddMode(true);
  });
});

// ─── Resize ──────────────────────────────────────────────────
function resize() {
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

// ─── Load preset ─────────────────────────────────────────────
function loadPreset(name) {
  sim = new Simulation();
  selectedBody = null;
  refreshInfoPanel();
  const factory = PRESETS[name];
  if (!factory) return;
  const bodies = typeof factory === 'function' ? factory() : factory;
  let autoZa = bodies.__zawarudo === true;
  bodies.forEach(b => {
    if (b.__zawarudo) autoZa = true;
    sim.addBody(b);
  });
  if (sim.bodies.length > 0) { cam.x = sim.bodies[0].x; cam.y = sim.bodies[0].y; }
  if (autoZa) { paused = true; btnPlay.textContent = '▶ Play'; triggerZawarudo(); }
}

// ─── Add mode ────────────────────────────────────────────────
function toggleAddMode(force) {
  addMode = typeof force === 'boolean' ? force : !addMode;
  document.body.classList.toggle('add-mode', addMode);
  btnAddMode.classList.toggle('active', addMode);
  btnAddMode.textContent = addMode ? '✕ Cancel Add' : '＋ Add Body';
  if (!addMode) { placing = null; dragEnd = null; }
}

// ─── Place body ──────────────────────────────────────────────
function placeBody(wx, wy, velX, velY) {
  const name  = newName.value.trim() || 'Planet';
  let   color = newColor.value;
  const mass  = getMassKg(newMassVal, newMassUnit);
  const r     = parseInt(newRadius.value) || 6;
  let   jojo  = false;
  const nl    = name.toLowerCase();
  if (nl.includes('dio'))      { color = '#FFD700'; jojo = true; }
  if (nl.includes('jotaro'))   { color = '#4A90D9'; jojo = true; }
  if (nl.includes('giorno'))   { color = '#40C4FF'; jojo = true; }
  if (nl.includes('kira') || nl.includes('yoshikage')) { color = '#E040FB'; jojo = true; }
  if (nl.includes('josuke') || nl.includes('gappy'))   { color = '#69F0AE'; jojo = true; }
  if (nl.includes('gyro') || nl.includes('johnny'))    { color = '#FF6E40'; jojo = true; }
  const b = new Body(name, wx, wy, velX, velY, mass, r, color);
  b.jojo = jojo;
  sim.addBody(b);
  selectBody(b);
  placing = null; dragEnd = null;
}

// ─── Selection ───────────────────────────────────────────────
function selectBody(b) { selectedBody = b; refreshInfoPanel(); }

// Updates only the read-only live-stats display — safe to call every frame
function updateLiveStats(b) {
  if (!b || !sim.bodies.includes(b)) return;
  iName.textContent = b.name;
  const { value, unit } = autoUnit(b.mass);
  iMass.textContent = value.toPrecision(4) + ' ' + MASS_UNITS[unit].label;
  iPos.textContent  = (b.x/AU).toPrecision(4) + ', ' + (b.y/AU).toPrecision(4) + ' AU';
  iVel.textContent  = (Math.hypot(b.vx,b.vy)/1000).toPrecision(4) + ' km/s';
  let heaviest = null;
  sim.bodies.forEach(o => { if (o!==b && (!heaviest||o.mass>heaviest.mass)) heaviest=o; });
  iOrbit.textContent = heaviest
    ? (Math.hypot(b.x-heaviest.x, b.y-heaviest.y)/AU).toPrecision(4)+' AU from '+heaviest.name
    : '—';
}

// Populates the edit input fields — only call when selection changes
function populateEditFields(b) {
  editName.value = b.name;
  setMassFields(editMassVal, editMassUnit, b.mass);
  editRadius.value = b.radius;
  if (editRadiusVal) editRadiusVal.textContent = b.radius + 'px';
  editVx.value = (b.vx/1000).toFixed(3);
  editVy.value = (b.vy/1000).toFixed(3);
  engineFx.value = b.fx_ext.toPrecision(4);
  engineFy.value = b.fy_ext.toPrecision(4);
  const hasEngine = b.fx_ext!==0 || b.fy_ext!==0;
  engineStatus.textContent = hasEngine ? '🔴 Engine ON' : 'Engine off';
  engineStatus.style.color = hasEngine ? '#ff8a65' : '';
}

// Full refresh: show/hide panels, update stats, populate edits
// Call this only when selection changes, not every frame
function refreshInfoPanel() {
  const b = selectedBody;
  if (!b || !sim.bodies.includes(b)) {
    selectedBody = null;
    infoNone.style.display = '';
    infoBody.style.display = 'none';
    return;
  }
  infoNone.style.display = 'none';
  infoBody.style.display = '';
  updateLiveStats(b);
  populateEditFields(b);
}

// ─── Render ──────────────────────────────────────────────────
function render() {
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  // starfield
  ctx.save();
  ctx.globalAlpha = 0.3;
  ctx.fillStyle = '#fff';
  for (let i = 0; i < 300; i++) {
    const sx = (i*1637+41) % W;
    const sy = (i*919+73)  % H;
    ctx.beginPath(); ctx.arc(sx, sy, i%3===0?1.4:0.7, 0, Math.PI*2); ctx.fill();
  }
  ctx.restore();

  // trails
  if (showTrails) {
    sim.bodies.forEach(b => {
      if (b.trail.length < 2) return;
      ctx.save();
      ctx.globalAlpha = b===selectedBody ? 0.55 : 0.28;
      ctx.strokeStyle = b.color;
      ctx.lineWidth   = b===selectedBody ? 1.5 : 0.8;
      ctx.beginPath();
      b.trail.forEach((t,i) => i===0 ? ctx.moveTo(s2px(t.x),s2py(t.y)) : ctx.lineTo(s2px(t.x),s2py(t.y)));
      ctx.stroke();
      ctx.restore();
    });
  }

  // bodies
  sim.bodies.forEach(b => {
    const bx = s2px(b.x), by = s2py(b.y);
    const r  = Math.max(b.radius, 2);
    const grd = ctx.createRadialGradient(bx, by, 0, bx, by, r*2.5);
    grd.addColorStop(0, b.color+'cc');
    grd.addColorStop(1, b.color+'00');
    ctx.beginPath(); ctx.arc(bx, by, r*2.5, 0, Math.PI*2);
    ctx.fillStyle = grd; ctx.fill();
    ctx.beginPath(); ctx.arc(bx, by, r, 0, Math.PI*2);
    ctx.fillStyle = b.color; ctx.fill();

    if (b===selectedBody) {
      ctx.save();
      ctx.beginPath(); ctx.arc(bx, by, r+5, 0, Math.PI*2);
      ctx.strokeStyle='#4fc3f7'; ctx.lineWidth=1.5;
      ctx.setLineDash([5,4]); ctx.stroke(); ctx.setLineDash([]);
      ctx.restore();
    }
    if (b.jojo) {
      ctx.save();
      ctx.beginPath(); ctx.arc(bx, by, r+2, 0, Math.PI*2);
      ctx.strokeStyle='#FFD700'; ctx.lineWidth=1.2;
      ctx.globalAlpha=0.65; ctx.stroke();
      ctx.restore();
    }

    ctx.fillStyle='rgba(220,232,255,0.82)';
    ctx.font='11px Segoe UI,system-ui,sans-serif';
    ctx.textAlign='center';
    ctx.fillText(b.name, bx, by-r-5);

    if (showEngines && (b.fx_ext!==0||b.fy_ext!==0)) drawEngineArrow(b, bx, by, r);
  });

  // placing guide
  if (addMode && placing) drawPlacingGuide();

  // merge event canvas rings
  const nowWall = performance.now()/1000;
  sim.mergeEvents.forEach(ev => {
    if (!ev.wallTime) return;
    const age = nowWall - ev.wallTime;
    if (age > 2) return;
    const ex = s2px(ev.x), ey = s2py(ev.y);
    const ringR = au2px(0.04) + age * au2px(0.3);
    ctx.beginPath(); ctx.arc(ex, ey, ringR, 0, Math.PI*2);
    ctx.strokeStyle=`rgba(255,200,0,${Math.max(0,0.7-age*0.4)})`;
    ctx.lineWidth=2; ctx.stroke();
  });
  // purge old
  sim.mergeEvents = sim.mergeEvents.filter(ev => !ev.wallTime || nowWall-ev.wallTime<3);
}

function drawEngineArrow(b, bx, by, r) {
  const fMag = Math.hypot(b.fx_ext, b.fy_ext);
  if (!fMag) return;
  const len   = Math.min(Math.max(20, Math.log10(fMag+1)*14), 60);
  const angle = Math.atan2(-b.fy_ext, b.fx_ext);
  const ex = bx+Math.cos(angle)*(r+len);
  const ey = by+Math.sin(angle)*(r+len);
  ctx.save();
  ctx.strokeStyle='#FF6D00'; ctx.fillStyle='#FF6D00';
  ctx.lineWidth=2; ctx.globalAlpha=0.85;
  ctx.beginPath(); ctx.moveTo(bx,by); ctx.lineTo(ex,ey); ctx.stroke();
  ctx.translate(ex,ey); ctx.rotate(angle);
  ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(-8,-4); ctx.lineTo(-8,4); ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawPlacingGuide() {
  const color = newColor.value;
  const r     = parseInt(newRadius.value)||6;
  const bx    = s2px(placing.x), by = s2py(placing.y);

  if (dragEnd) {
    const ex = s2px(dragEnd.x), ey = s2py(dragEnd.y);
    const dvx = (dragEnd.x - placing.x) * velScale();
    const dvy = (dragEnd.y - placing.y) * velScale();
    const spd = (Math.hypot(dvx, dvy) / 1000).toFixed(2);
    ctx.save();
    ctx.strokeStyle='#CE93D8'; ctx.lineWidth=2; ctx.setLineDash([6,3]);
    ctx.beginPath(); ctx.moveTo(bx,by); ctx.lineTo(ex,ey); ctx.stroke();
    ctx.setLineDash([]);
    const angle=Math.atan2(ey-by,ex-bx);
    ctx.translate(ex,ey); ctx.rotate(angle);
    ctx.fillStyle='#CE93D8';
    ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(-10,-4); ctx.lineTo(-10,4); ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.font='bold 12px Segoe UI,system-ui'; ctx.textAlign='left';
    ctx.fillStyle='#CE93D8';
    ctx.fillText(spd+' km/s', s2px(dragEnd.x)+8, s2py(dragEnd.y)-8);
  }

  const grd=ctx.createRadialGradient(bx,by,0,bx,by,r*2.5);
  grd.addColorStop(0,color+'aa'); grd.addColorStop(1,color+'00');
  ctx.beginPath(); ctx.arc(bx,by,r*2.5,0,Math.PI*2); ctx.fillStyle=grd; ctx.fill();
  ctx.save(); ctx.globalAlpha=0.7;
  ctx.beginPath(); ctx.arc(bx,by,r,0,Math.PI*2); ctx.fillStyle=color; ctx.fill();
  ctx.restore();
  ctx.save(); ctx.globalAlpha=0.4; ctx.setLineDash([4,4]);
  ctx.beginPath(); ctx.arc(bx,by,r+8,0,Math.PI*2);
  ctx.strokeStyle='#fff'; ctx.lineWidth=1; ctx.stroke();
  ctx.setLineDash([]); ctx.restore();
  ctx.font='11px Segoe UI,system-ui'; ctx.textAlign='center';
  ctx.fillStyle='rgba(220,232,255,0.8)';
  ctx.fillText(newName.value||'Planet', bx, by-r-5);
}

function formatTime(s) {
  if (s<3600)         return s.toFixed(0)+' s';
  if (s<86400)        return (s/3600).toFixed(2)+' h';
  if (s<86400*365.25) return (s/86400).toFixed(2)+' d';
  return (s/(86400*365.25)).toFixed(3)+' yr';
}

// ─── Flash popup ─────────────────────────────────────────────
function showFlash(ev) {
  const el = document.createElement('div');
  el.className = 'flash-text';
  el.textContent = ev.text;
  const ex = ev.wallX !== undefined ? ev.wallX : s2px(ev.x);
  const ey = ev.wallY !== undefined ? ev.wallY : s2py(ev.y);
  el.style.left = Math.max(120, Math.min(canvas.width-120, ex))+'px';
  el.style.top  = Math.max(100, Math.min(canvas.height-60, ey-40))+'px';
  flashContainer.appendChild(el);
  setTimeout(()=>el.remove(), 2600);
  const ring=document.createElement('div');
  ring.className='flash-ring';
  ring.style.cssText=`left:${ex}px;top:${ey}px;width:40px;height:40px`;
  flashContainer.appendChild(ring);
  setTimeout(()=>ring.remove(),1300);
}

// ─── Za Warudo ───────────────────────────────────────────────
function triggerZawarudo() {
  if (zawarudoActive) return;
  zawarudoActive = true;
  paused = true; btnPlay.textContent='▶ Play';
  const ov=document.createElement('div'); ov.id='zawarudo-overlay';
  document.body.appendChild(ov);
  const txt=document.createElement('div'); txt.id='zawarudo-text';
  txt.textContent='ZA WARUDO!'; document.body.appendChild(txt);
  const sub=document.createElement('div');
  sub.style.cssText='position:fixed;left:50%;top:45%;transform:translate(-50%,-50%);'+
    'font-size:clamp(14px,2.5vw,28px);color:#CE93D8;font-weight:800;letter-spacing:2px;'+
    'text-shadow:-2px -2px 0 #000,2px -2px 0 #000,-2px 2px 0 #000,2px 2px 0 #000;'+
    'z-index:401;animation:zawarudo-text-anim 3s ease-out forwards;pointer-events:none';
  sub.textContent='TIME HAS STOPPED'; document.body.appendChild(sub);
  showFlash({ x:cam.x, y:cam.y, wallX:canvas.width/2, wallY:canvas.height*0.3,
              text:'⌛ TIME IS STOPPED! ⌛', wallTime:performance.now()/1000 });
  setTimeout(()=>{ ov.remove(); txt.remove(); sub.remove(); zawarudoActive=false; }, 3300);
}

// ─── Game loop ────────────────────────────────────────────────
function loop(ts) {
  requestAnimationFrame(loop);
  if (!lastTime) lastTime=ts;
  lastTime=ts;

  if (!paused) {
    const simDt = parseFloat(dtSlider.value)*3600;
    const subs  = parseInt(substepsSlider.value);
    sim.step(simDt, subs);

    // drain new merge events
    if (sim.newMergeEvents && sim.newMergeEvents.length) {
      sim.newMergeEvents.forEach(ev => {
        ev.wallTime = performance.now()/1000;
        ev.wallX    = s2px(ev.x);
        ev.wallY    = s2py(ev.y);
        showFlash(ev);
      });
      sim.newMergeEvents.length=0;
    }

    if (chkCenter && chkCenter.checked && sim.bodies.length>0) {
      let mx=0,my=0,mt=0;
      sim.bodies.forEach(b=>{mx+=b.x*b.mass;my+=b.y*b.mass;mt+=b.mass;});
      cam.x=mx/mt; cam.y=my/mt;
    }
  }

  render();
  if (selectedBody) updateLiveStats(selectedBody);

  statusBodies.textContent = sim.bodies.length+' bodies';
  statusTime.textContent   = formatTime(sim.time);
  const ke=sim.kineticEnergy();
  statusEnergy.textContent = 'KE '+ke.toExponential(2)+' J';
}

// ─── Mouse events ─────────────────────────────────────────────
canvas.addEventListener('mousedown', e => {
  if (e.button===1||e.button===2) {
    panning=true; panStart={x:e.clientX,y:e.clientY}; camStart={x:cam.x,y:cam.y};
    document.body.classList.add('panning'); return;
  }
  if (addMode) {
    placing={x:px2sx(e.clientX),y:px2sy(e.clientY)};
    dragEnd={x:px2sx(e.clientX),y:px2sy(e.clientY)};
    return;
  }
  let hit=null,minD=Infinity;
  sim.bodies.forEach(b=>{
    const d=Math.hypot(s2px(b.x)-e.clientX, s2py(b.y)-e.clientY);
    if(d<Math.max(b.radius+6,12)&&d<minD){minD=d;hit=b;}
  });
  if (hit) selectBody(hit);
  else { selectedBody=null; refreshInfoPanel(); }
  panning=true; panStart={x:e.clientX,y:e.clientY}; camStart={x:cam.x,y:cam.y};
});

canvas.addEventListener('mousemove', e => {
  if (panning&&panStart&&!addMode) {
    const dx=(e.clientX-panStart.x)/PIXELS_PER_AU/cam.zoom*AU;
    const dy=(e.clientY-panStart.y)/PIXELS_PER_AU/cam.zoom*AU;
    cam.x=camStart.x-dx; cam.y=camStart.y+dy; return;
  }
  if (addMode&&placing) { dragEnd={x:px2sx(e.clientX),y:px2sy(e.clientY)}; return; }
  let hover=false;
  sim.bodies.forEach(b=>{
    if(Math.hypot(s2px(b.x)-e.clientX,s2py(b.y)-e.clientY)<Math.max(b.radius+6,12)) hover=true;
  });
  document.body.classList.toggle('hover-body', hover&&!addMode);
});

canvas.addEventListener('mouseup', e => {
  if (e.button===1||e.button===2) {
    panning=false; document.body.classList.remove('panning'); return;
  }
  if (addMode&&placing) {
    const velX=(dragEnd.x-placing.x)*velScale();
    const velY=(dragEnd.y-placing.y)*velScale();
    placeBody(placing.x, placing.y, velX, velY);
    return;
  }
  panning=false; document.body.classList.remove('panning');
});

canvas.addEventListener('mouseleave', ()=>{
  panning=false; document.body.classList.remove('panning');
  if(addMode&&placing) dragEnd=null;
});

canvas.addEventListener('contextmenu', e=>e.preventDefault());

canvas.addEventListener('wheel', e=>{
  e.preventDefault();
  const f=e.deltaY<0?1.12:0.89;
  const wx=px2sx(e.clientX), wy=px2sy(e.clientY);
  cam.zoom*=f; cam.zoom=Math.max(0.01,Math.min(500,cam.zoom));
  cam.x=wx-(e.clientX-canvas.width/2)/PIXELS_PER_AU/cam.zoom*AU;
  cam.y=wy+(e.clientY-canvas.height/2)/PIXELS_PER_AU/cam.zoom*AU;
},{passive:false});

// ─── Keyboard ────────────────────────────────────────────────
document.addEventListener('keydown', e=>{
  if(e.target.tagName==='INPUT'||e.target.tagName==='TEXTAREA') return;
  switch(e.code){
    case 'Space':   e.preventDefault(); togglePause(); break;
    case 'KeyA':    toggleAddMode(); break;
    case 'KeyR':    resetSim(); break;
    case 'KeyT':    chkTrails.checked=!chkTrails.checked; showTrails=chkTrails.checked; break;
    case 'KeyH':    helpModal.style.display=helpModal.style.display==='none'?'flex':'none'; break;
    case 'KeyZ':    triggerZawarudo(); break;
    case 'Escape':  addMode?toggleAddMode(false):(selectedBody=null,refreshInfoPanel()); break;
    case 'Delete':
    case 'Backspace': if(selectedBody) deleteSelected(); break;
  }
});

function togglePause(){ paused=!paused; btnPlay.textContent=paused?'▶ Play':'⏸ Pause'; }
function resetSim(){ sim=new Simulation(); selectedBody=null; refreshInfoPanel(); }
function deleteSelected(){
  if(!selectedBody) return;
  sim.bodies=sim.bodies.filter(b=>b!==selectedBody);
  selectedBody=null; refreshInfoPanel();
}

// ─── Topbar ───────────────────────────────────────────────────
btnPlay.addEventListener('click', togglePause);
btnReset.addEventListener('click', resetSim);
btnAddMode.addEventListener('click', ()=>toggleAddMode());
presetSel.addEventListener('change', ()=>{
  const v=presetSel.value; if(!v) return;
  loadPreset(v); presetSel.value='';
});

// ─── Sim sliders ─────────────────────────────────────────────
dtSlider.addEventListener('input', ()=>{
  const v=parseFloat(dtSlider.value);
  dtVal.textContent=v<24?v.toFixed(1)+'h/step':(v/24).toFixed(1)+'d/step';
});
substepsSlider.addEventListener('input', ()=>{ substepsVal.textContent=substepsSlider.value+'x'; });
softSlider.addEventListener('input', ()=>{
  sim.softening=parseFloat(softSlider.value)*AU;
  softVal.textContent=softSlider.value+' AU';
});
chkTrails.addEventListener('change', ()=>{ showTrails=chkTrails.checked; });
chkEngines.addEventListener('change', ()=>{ showEngines=chkEngines.checked; });
velSensSlider.addEventListener('input', ()=>{
  velSensMult=Math.pow(10,parseFloat(velSensSlider.value));
  velSensVal.textContent = velSensMult < 1
    ? '÷'+Math.round(1/velSensMult)+'x'
    : '×'+velSensMult.toFixed(velSensMult<10?1:0);
});

// ─── Add panel ───────────────────────────────────────────────
newRadius.addEventListener('input', ()=>{ newRadiusVal.textContent=newRadius.value+'px'; });

// Unit-change re-conversion: keep the underlying mass the same, just re-express in new unit
function attachUnitConverter(valEl, unitEl) {
  // Snapshot kg before the dropdown opens
  unitEl.addEventListener('mousedown', () => {
    unitEl._snapshotKg = getMassKg(valEl, unitEl);
  });
  // On change, redisplay the snapshot in the newly chosen unit
  unitEl.addEventListener('change', () => {
    if (unitEl._snapshotKg != null) {
      const newFactor = MASS_UNITS[unitEl.value].factor;
      valEl.value = +( unitEl._snapshotKg / newFactor ).toPrecision(5);
    }
  });
}
attachUnitConverter(newMassVal, newMassUnit);
attachUnitConverter(editMassVal, editMassUnit);

// ─── Right panel bindings ─────────────────────────────────────
if ($('edit-radius')) $('edit-radius').addEventListener('input', ()=>{
  if(editRadiusVal) editRadiusVal.textContent=$('edit-radius').value+'px';
});

$('btn-apply-edit').addEventListener('click', ()=>{
  if(!selectedBody) return;
  selectedBody.name  =editName.value.trim()||selectedBody.name;
  selectedBody.mass  =getMassKg(editMassVal,editMassUnit);
  selectedBody.radius=parseInt(editRadius.value)||selectedBody.radius;
  refreshInfoPanel();
});

$('btn-apply-vel').addEventListener('click', ()=>{
  if(!selectedBody) return;
  selectedBody.vx=(parseFloat(editVx.value)||0)*1000;
  selectedBody.vy=(parseFloat(editVy.value)||0)*1000;
  refreshInfoPanel();
});

btnKick.addEventListener('click', ()=>{
  if(!selectedBody) return;
  selectedBody.vx+=(parseFloat(kickDvx.value)||0)*1000;
  selectedBody.vy+=(parseFloat(kickDvy.value)||0)*1000;
  refreshInfoPanel();
});

$('btn-engine-apply').addEventListener('click', ()=>{
  if(!selectedBody) return;
  selectedBody.fx_ext=parseFloat(engineFx.value)||0;
  selectedBody.fy_ext=parseFloat(engineFy.value)||0;
  refreshInfoPanel();
});

$('btn-engine-off').addEventListener('click', ()=>{
  if(!selectedBody) return;
  selectedBody.fx_ext=0; selectedBody.fy_ext=0;
  engineFx.value='0'; engineFy.value='0';
  refreshInfoPanel();
});

btnDelete.addEventListener('click', deleteSelected);
if (btnZawarudo) btnZawarudo.addEventListener('click', triggerZawarudo);

// ─── Help modal ───────────────────────────────────────────────
$('btn-help').addEventListener('click', ()=>{ helpModal.style.display='flex'; });
$('btn-help-close').addEventListener('click', ()=>{ helpModal.style.display='none'; });
helpModal.addEventListener('click', e=>{ if(e.target===helpModal) helpModal.style.display='none'; });

// ─── Init ─────────────────────────────────────────────────────
(function init(){
  dtVal.textContent       = dtSlider.value+'h/step';
  substepsVal.textContent = substepsSlider.value+'x';
  softVal.textContent     = softSlider.value+' AU';
  velSensVal.textContent  = '×1.0';
  loadPreset('solar-full');
  refreshInfoPanel();
  requestAnimationFrame(loop);
})();
