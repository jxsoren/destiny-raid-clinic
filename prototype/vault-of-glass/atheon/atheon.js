(() => {
// =====================================================================
// SIMULATION (2D sim units = map pixels × 0.5). Rendering reads from S; nothing here touches WebGL.
// =====================================================================
// ---------- Arena, traced from the community encounter map (map pixels × 0.5 = sim units) ----------
// 1-2-3 sit up the hall toward Atheon (left wall, middle stairs, right wall); 4-5-6 sit by the Mars gate, the DPS platform and the Venus gate.
const MS = .5, M = (x,y) => ({x:x*MS, y:y*MS}), poly = a => a.map(([x,y]) => M(x,y));
const ARENA = {
  upper: poly([[640,330],[812,330],[932,470],[895,515],[932,565],[890,610],[890,850],[965,930],[1183,930],[1183,985],[1298,985],[1298,1255],[1228,1255],[1228,1625],[886,1625],[886,1480],[800,1395],[645,1395],[558,1440],[558,1625],[212,1625],[212,1290],[225,1185],[565,860],[565,610],[522,565],[558,515],[522,470]]),
  platform: poly([[558,1440],[645,1395],[800,1395],[886,1480],[886,1775],[558,1775]]),
  lower: poly([[195,1625],[558,1625],[558,1775],[886,1775],[886,1625],[1225,1625],[1225,1890],[755,1890],[755,1990],[675,1990],[675,1890],[185,1890],[185,1785],[195,1785]]),
  dais: poly([[640,330],[628,250],[640,200],[668,195],[668,130],[683,100],[683,40],[728,15],[770,40],[770,100],[790,130],[790,195],[812,200],[825,250],[812,330]]),
  obstacles: [
    poly([[338,1275],[338,1250],[548,1040],[560,1040],[560,1215],[450,1275]]),
    poly([[600,658],[682,658],[682,693],[600,693]]),
    poly([[769,657],[850,657],[850,694],[769,694]]),
    poly([[485,1740],[548,1740],[548,1820],[485,1820]]),
    poly([[896,1740],[955,1740],[955,1825],[896,1825]]),
    poly([[600,560],[680,560],[680,592],[600,592]]),
    poly([[770,560],[850,560],[850,592],[770,592]]),
  ],
  walls: [[[645,1395],[800,1395]],[[558,1440],[558,1775]],[[886,1480],[886,1775]],[[558,1775],[886,1775]],[[307,1625],[558,1625]],[[886,1625],[1125,1625]],[[1000,1245],[1125,1245]],[[1125,1245],[1125,1165]]].map(poly),
  // ramps: height h0 at a → h1 at b (world units: main floor 0, DPS platform 1.5, plate level -2.5); w in sim units.
  // The hall also steps up toward the top room: main floor 0 → hall 1 → top room 2 (see upperH).
  stairs: [
    {a:M(253,1548), b:M(253,1624), w:52, h0:0, h1:-2.5},
    {a:M(1165,1546), b:M(1165,1624), w:40, h0:0, h1:-2.5},
    {a:M(432,1323), b:M(582,1426), w:30, h0:0, h1:1.5},
    {a:M(995,1241), b:M(838,1429), w:30, h0:0, h1:1.5},
  ],
};
const SIM_W = 720, SIM_H = 1000;
const ATHEON = M(728,1120);   // Atheon stands on the main floor, mid-arena, facing the DPS platform
const TELEPORT_SPAWN = M(728,600);
const DPS = M(722,1590);
const MID = M(728,1120);
const RALLY = M(728,1290);
const BANNER = M(715,1950);
const STAGE = {plate:M(722,1340), caller:M(640,1250), adds:M(860,1240), escape:M(1100,1100)};
const PLATES = {mars:{...M(403,1720), r:34, name:'Mars', era:'the future', color:0xe0704f}, venus:{...M(1040,1720), r:34, name:'Venus', era:'the past', color:0xb6c95a}};
const GATES = {mars:{...M(430,1455), ang:Math.atan2(1530-1380, 505-355)}, venus:{...M(1030,1455), ang:Math.atan2(1380-1530, 1105-955)}};
const ROOM = {x:850, y:560, r:175};
const VORC = poly([[537,790],[725,730],[922,793],[488,1390],[722,1422],[957,1375]]);
// The past/future chambers echo the Vault's Oracle layout at a smaller scale.
const CORC = VORC.map(o => ({x:ROOM.x + (o.x - MID.x)*.62, y:ROOM.y + (o.y - MID.y)*.62}));

const pip = (p, pl) => { let c = false; for (let i=0, j=pl.length-1; i<pl.length; j=i++){ const a = pl[i], b = pl[j]; if (((a.y > p.y) !== (b.y > p.y)) && (p.x < (b.x-a.x)*(p.y-a.y)/(b.y-a.y) + a.x)) c = !c; } return c; };
const segDist = (p,a,b) => { const dx = b.x-a.x, dy = b.y-a.y, l = dx*dx + dy*dy; let t = l ? ((p.x-a.x)*dx + (p.y-a.y)*dy)/l : 0; t = Math.max(0, Math.min(1, t)); return Math.hypot(p.x-a.x-t*dx, p.y-a.y-t*dy); };
function inStair(p){
  for (const s of ARENA.stairs){
    if (s.deco) continue;
    const dx = s.b.x-s.a.x, dy = s.b.y-s.a.y, t = ((p.x-s.a.x)*dx + (p.y-s.a.y)*dy)/(dx*dx + dy*dy);
    if (t < -.06 || t > 1.06) continue;
    if (Math.hypot(p.x - (s.a.x + dx*t), p.y - (s.a.y + dy*t)) <= s.w/2) return {s, t:Math.max(0, Math.min(1, t))};
  }
  return null;
}
// hall levels by depth (sim y): top room 2, wide stairs, hall 1, wide stairs, main floor 0
const HALL = {top:350, mid0:383, mid1:454, floor:493};
function upperH(y){
  if (y <= HALL.top) return 2;
  if (y < HALL.mid0) return 2 - (y - HALL.top)/(HALL.mid0 - HALL.top);
  if (y <= HALL.mid1) return 1;
  if (y < HALL.floor) return 1 - (y - HALL.mid1)/(HALL.floor - HALL.mid1);
  return 0;
}
function heightAt(p){
  if (p.loc==='room') return 0;
  const st = inStair(p); if (st) return st.s.h0 + (st.s.h1 - st.s.h0)*st.t;
  if (pip(p, ARENA.platform)) return 1.5;
  if (pip(p, ARENA.lower)) return -2.5;
  return upperH(p.y);
}
const onPlatform = p => p.loc==='vault' && pip(p, ARENA.platform);
function rawWalk(x, y){
  const p = {x, y};
  if (!(pip(p, ARENA.upper) || pip(p, ARENA.platform) || pip(p, ARENA.lower))) return false;
  for (const o of ARENA.obstacles) if (pip(p, o)) return false;
  if (Math.hypot(x - ATHEON.x, y - ATHEON.y) < 22) return false;
  for (const [a,b] of ARENA.walls) if (segDist(p, a, b) < 4) return false;
  return true;
}
const CELL = 5, GW = Math.ceil(SIM_W/CELL), GH = Math.ceil(SIM_H/CELL), NAV = new Uint8Array(GW*GH);
for (let j=0;j<GH;j++) for (let i=0;i<GW;i++){
  const x = (i+.5)*CELL, y = (j+.5)*CELL;
  NAV[j*GW+i] = rawWalk(x,y) && rawWalk(x+4,y) && rawWalk(x-4,y) && rawWalk(x,y+4) && rawWalk(x,y-4) ? 1 : 0;
}
const cellOf = (x,y) => { const i = Math.floor(x/CELL), j = Math.floor(y/CELL); return (i < 0 || j < 0 || i >= GW || j >= GH) ? -1 : j*GW+i; };
const walkable = (x,y) => { const c = cellOf(x,y); return c >= 0 && NAV[c] === 1; };
function lineWalk(a, b){ const n = Math.ceil(dist(a,b)/3); for (let k=1;k<=n;k++){ const t = k/n; if (!walkable(a.x + (b.x-a.x)*t, a.y + (b.y-a.y)*t)) return false; } return true; }
function nearestWalk(c){
  if (c >= 0 && NAV[c]) return c;
  const ci = c % GW, cj = Math.floor(c/GW);
  for (let r=1;r<40;r++) for (let dj=-r;dj<=r;dj++) for (let di=-r;di<=r;di++){ if (Math.max(Math.abs(di),Math.abs(dj)) !== r) continue; const i = ci+di, j = cj+dj; if (i>=0 && j>=0 && i<GW && j<GH && NAV[j*GW+i]) return j*GW+i; }
  return -1;
}
function findPath(from, to){
  const s = nearestWalk(cellOf(from.x, from.y)), t = nearestWalk(cellOf(to.x, to.y));
  if (s < 0 || t < 0) return [];
  const g = new Float32Array(GW*GH).fill(Infinity), came = new Int32Array(GW*GH).fill(-1), closed = new Uint8Array(GW*GH);
  const ti = t % GW, tj = Math.floor(t/GW), h = c => { const dx = Math.abs(c % GW - ti), dy = Math.abs(Math.floor(c/GW) - tj); return Math.max(dx,dy) + .414*Math.min(dx,dy); };
  const heap = []; const push = (c,f) => { heap.push([f,c]); let i = heap.length-1; while (i > 0){ const pI = (i-1) >> 1; if (heap[pI][0] <= heap[i][0]) break; [heap[pI], heap[i]] = [heap[i], heap[pI]]; i = pI; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length){ heap[0] = last; let i = 0; for (;;){ const l = 2*i+1, r = l+1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
  g[s] = 0; push(s, h(s));
  while (heap.length){
    const [, c] = pop(); if (c === t) break; if (closed[c]) continue; closed[c] = 1;
    const ci = c % GW, cj = Math.floor(c/GW);
    for (let dj=-1;dj<=1;dj++) for (let di=-1;di<=1;di++){
      if (!di && !dj) continue; const i = ci+di, j = cj+dj; if (i<0 || j<0 || i>=GW || j>=GH) continue;
      const n = j*GW+i; if (!NAV[n] || closed[n]) continue;
      if (di && dj && (!NAV[cj*GW+i] || !NAV[j*GW+ci])) continue;
      const ng = g[c] + (di && dj ? 1.414 : 1); if (ng < g[n]){ g[n] = ng; came[n] = c; push(n, ng + h(n)); }
    }
  }
  if (came[t] < 0 && s !== t) return [];
  const cells = []; for (let c = t; c >= 0 && c !== s; c = came[c]) cells.push(c); cells.reverse();
  const pts = cells.map(c => ({x:(c % GW + .5)*CELL, y:(Math.floor(c/GW) + .5)*CELL}));
  pts.push({x:to.x, y:to.y});
  const out = []; let cur = from;
  for (let k=0;k<pts.length;k++){ if (k === pts.length-1 || !lineWalk(cur, pts[k+1])){ out.push(pts[k]); cur = pts[k]; } }
  return out;
}
const ROSTER = [
  {key:'relic', label:'Aegis Holder', tag:'AEGIS', color:'#f2c46b', team:'away', desc:'Go through the gate, pick up the Aegis (the Relic), and cleanse your team before the Void blinds them.'},
  {key:'shooter', label:'Oracle Shooter', tag:'ORACLE A', color:'#ef7d9c', team:'away', desc:'Go through the gate and destroy the 1st and 3rd Oracle of each set, in the called order.'},
  {key:'shooterB', label:'Oracle Shooter B', tag:'ORACLE B', color:'#ff9f6b', team:'away', bot:true},
  {key:'plate', label:'Plate Holder', tag:'PLATE', color:'#7fe0d0', team:'home', desc:'Read where the away team went and hold the matching sync plate so the gate stays open.'},
  {key:'caller', label:'Caller', tag:'CALLER', color:'#a9b8ff', team:'home', desc:'Watch the Oracles light up in the Vault and enter the order on the callout pad.'},
  {key:'adds', label:'Add Clear', tag:'ADDS', color:'#b9e07a', team:'home', desc:'Shoot Supplicants before they reach the Vault team, and don’t stand close together.'},
];

let S, you = null, watch = false, speed = 1, paused = true, lastRole = null;
const keys = new Set(); let tap = null, interactHeld = false;
const dist = (a,b) => Math.hypot(a.x-b.x, a.y-b.y);
const away = () => S.players.filter(p => p.loc==='room');
const home = () => S.players.filter(p => p.loc==='vault');
const youSee = loc => watch || !you || you.loc===loc || S.phase!=='away';

function newState(){
  S = {phase:'idle', t:0, t2:0, hp:100, cycle:1, dest:null, set:0, seq:[], call:[], oracles:[], shotIdx:0, shotT:0, oracleT:0,
       sub:'', relic:null, cleanCd:0, closedT:0, portalOpen:false, enemies:[], banner:null, log:[], result:null,
       spT:0, moved:false, venT:0, marked:null, detainT:0, doneT:0, fx:[], killed:0, toKill:0};
  S.players = ROSTER.map((r,i) => ({...r, id:i, x:0, y:0, loc:'vault', meter:0, hp:100, hurtT:9, detained:false, bub:0, you:false}));
  S.players.forEach((p,i) => { const a = i/6*Math.PI*2; p.x = RALLY.x + Math.cos(a)*40; p.y = RALLY.y + Math.sin(a)*40; });
}
function log(text, kind='info'){ S.log.unshift({text, kind, id:Math.random()}); S.log.length = Math.min(S.log.length, 30); }
function banner(text, sub){ S.banner = {text, sub, t:3.4}; }
function fx(type, x, y, extra={}){ S.fx.push({type, x, y, t:0, ...extra}); }
function wipe(reason, lesson){ if (S.result) return; S.result = {win:false, reason, lesson}; log(reason,'bad'); paused = true; showOverlay('fail'); }
function victory(){ if (S.result) return; S.result = {win:true}; log('Atheon defeated','good'); paused = true; showOverlay('win'); }

let eid = 0;
function spawnSupplicant(){
  const spots = [M(260,1300), M(1260,1100), M(600,560), M(860,560), M(728,1950), M(240,1200)];
  const s = spots[Math.floor(Math.random()*spots.length)];
  S.enemies.push({id:++eid, type:'sup', x:s.x, y:s.y, hp:30});
}

function setPhase(ph){
  S.phase = ph; S.t = 0; S.t2 = 0; S.sub = ''; S.doneT = 0;
  if (ph==='opening'){
    const n = S.cycle===1 ? 6 : 4; for (let i=0;i<n;i++) spawnSupplicant();
    S.toKill = n; S.killed = 0;
    banner(S.cycle===1 ? 'Atheon, Time’s Conflux' : 'Atheon stirs', S.cycle===1 ? 'Defeat the Supplicants' : 'Supplicants inbound');
    if (S.cycle===1) log('Encounter started');
  }
  if (ph==='teleport'){
    S.dest = Math.random() < .5 ? 'mars' : 'venus'; S.moved = false;
    banner('Atheon opens a time gate', `Three Guardians are pulled to ${PLATES[S.dest].name}, ${PLATES[S.dest].era}`);
    log(`Teleport → ${PLATES[S.dest].name}`);
  }
  if (ph==='away'){ S.set = 0; S.closedT = 0; S.spT = 1; startSet(); }
  if (ph==='dps'){
    S.venT = 30; S.marked = null; S.detainT = 0; S.enemies = [];
    S.players.forEach(p => { p.detained = false; p.bub = 0; p.meter = 0; });
    banner('Time’s Vengeance', 'Group on the DPS platform and burn Atheon');
    log('Time’s Vengeance: 30s','good');
  }
}
function startSet(){
  S.set++; S.sub = 'show'; S.t2 = 0; S.call = []; S.oracles = []; S.shotIdx = 0;
  const pool = [0,1,2,3,4,5]; S.seq = [];
  for (let i=0;i<3;i++) S.seq.push(pool.splice(Math.floor(Math.random()*pool.length),1)[0]);
}
function cleanse(){
  const R = S.players[0];
  if (!S.relic || !S.relic.held || S.cleanCd > 0) return;
  S.cleanCd = 1.5; fx('cleanse', R.x, R.y);
  for (const p of away()) if (dist(p,R) < 120) p.meter = 0;
}
function shootOracle(pos, shooter){
  if (S.phase!=='away' || S.sub!=='shoot') return;
  const o = S.oracles.find(o => o.alive && o.pos===pos); if (!o) return;
  const k = S.shotIdx;
  fx('shot', CORC[pos].x, CORC[pos].y, {from:{x:shooter.x, y:shooter.y}});
  if (pos !== S.seq[k]){
    if (S.call[k] !== S.seq[k]) return wipe('The callout was wrong', `The Oracles lit up as ${S.seq.map(i=>i+1).join(' · ')}, but the call was ${S.call.map(i=>i+1).join(' · ')}. The away team can't see the order, so they shoot exactly what the Vault calls.`);
    return wipe('An Oracle was shot out of order', `The call was ${S.call.map(i=>i+1).join(' · ')}. Oracle ${pos+1} was shot when Oracle ${S.seq[k]+1} was next. Any Oracle shot out of sequence wipes the team.`);
  }
  o.alive = false; S.shotIdx++; S.shotT = 0; fx('oracleDie', CORC[pos].x, CORC[pos].y);
  log(`${shooter.tag} destroyed Oracle ${pos+1}`);
  if (S.shotIdx >= 3){
    if (S.set < 3){ S.sub = 'between'; S.t2 = 0; log(`Oracle set ${S.set}/3 silenced`,'good'); }
    else { S.sub = 'return'; S.t2 = 0; banner('The Oracles are silenced','Return through the time gate'); log('All Oracle sets silenced','good'); }
  }
}

function clampLoc(p){
  if (p.loc==='room'){ const d = dist(p,ROOM), m = ROOM.r-14; if (d > m){ p.x = ROOM.x + (p.x-ROOM.x)/d*m; p.y = ROOM.y + (p.y-ROOM.y)/d*m; } }
}
// one step with wall sliding
function stepMove(p, dx, dy){
  if (p.loc==='room'){ p.x += dx; p.y += dy; clampLoc(p); return; }
  if (walkable(p.x+dx, p.y+dy)){ p.x += dx; p.y += dy; }
  else if (walkable(p.x+dx, p.y)) p.x += dx;
  else if (walkable(p.x, p.y+dy)) p.y += dy;
}
function moveStep(p, t, spd, dt){
  const dx = t.x-p.x, dy = t.y-p.y, d = Math.hypot(dx,dy);
  if (d < .5) return true;
  const s = Math.min(d, spd*dt); p.face = Math.atan2(dy,dx); stepMove(p, dx/d*s, dy/d*s);
  return d < 4;
}
// move toward t, routing around walls with A* when there's no straight line
function moveToward(p, t, spd, dt){
  if (p.loc==='room' || lineWalk(p, t)){ p.path = null; return moveStep(p, t, spd, dt); }
  const key = `${Math.round(t.x/CELL)},${Math.round(t.y/CELL)}`;
  p.pathAge = (p.pathAge || 0) + dt;
  if (!p.path || p.pathKey !== key || p.pathAge > 1.5){ p.path = findPath(p, t); p.pathKey = key; p.pathAge = 0; }
  while (p.path.length > 1 && dist(p, p.path[0]) < 4) p.path.shift();
  if (p.path.length > 1 && lineWalk(p, p.path[1])) p.path.shift();
  const w = p.path[0] || t;
  const arrived = moveStep(p, w, spd, dt);
  return arrived && w === t || dist(p, t) < 4;
}
function botGoal(p){
  const ph = S.phase, ring = (c, r, a) => ({x:c.x + Math.cos(a)*r, y:c.y + Math.sin(a)*r});
  if (p.loc==='room'){
    const R = S.players[0];
    if (p.key==='relic') return S.relic && !S.relic.held ? S.relic : {x:ROOM.x, y:ROOM.y};
    return {x:R.x + (p.key==='shooter' ? -34 : 34), y:R.y + 10};
  }
  if (ph==='dps'){
    if (S.marked===p && !p.detained && S.detainT > 0) return STAGE.escape;
    return ring(DPS, 36, p.id/6*Math.PI*2);
  }
  if (ph==='away' || ph==='teleport'){
    if (p.key==='plate') return ph==='away' && S.t > 1.2 ? PLATES[S.dest] : STAGE.plate;
    if (p.key==='caller') return STAGE.caller;
    if (p.key==='adds') return STAGE.adds;
  }
  return ring(RALLY, 40, p.id/6*Math.PI*2);
}

function update(dt){
  S.t += dt; S.t2 += dt;
  if (S.banner){ S.banner.t -= dt; if (S.banner.t <= 0) S.banner = null; }
  S.cleanCd = Math.max(0, S.cleanCd - dt);

  for (const p of S.players){
    if (p.detained) continue;
    if (p.you){
      let vx = 0, vy = 0;
      if (keys.has('w')||keys.has('arrowup')) vy--; if (keys.has('s')||keys.has('arrowdown')) vy++;
      if (keys.has('a')||keys.has('arrowleft')) vx--; if (keys.has('d')||keys.has('arrowright')) vx++;
      if (vx||vy){ tap = null; const m = Math.hypot(vx,vy); stepMove(p, vx/m*185*dt, vy/m*185*dt); p.face = Math.atan2(vy,vx); }
      else if (tap && moveToward(p, tap, 185, dt)) tap = null;
    } else moveToward(p, botGoal(p), 170, dt);
    p.hurtT += dt; if (p.hurtT > 2) p.hp = Math.min(100, p.hp + 12*dt);
  }

  for (const p of S.players){
    p.target = null;
    if (p.loc!=='vault' || p.detained) continue;
    let best = null, bd = 330;
    for (const e of S.enemies){ const d = dist(p,e); if (d < bd){ bd = d; best = e; } }
    if (best){ best.hp -= (p.you ? 55 : 40)*dt; p.target = best; }
  }
  for (const e of S.enemies) if (e.hp <= 0 && !e.boom){ S.killed++; fx('pop', e.x, e.y); }
  S.enemies = S.enemies.filter(e => e.hp > 0);
  for (const e of S.enemies){
    let tgt = null, bd = 1e9;
    for (const p of home()){ const d = dist(p,e); if (d < bd){ bd = d; tgt = p; } }
    if (!tgt) continue;
    const dx = tgt.x-e.x, dy = tgt.y-e.y, d = Math.hypot(dx,dy) || 1;
    e.x += dx/d*88*dt; e.y += dy/d*88*dt;
    if (d < 22){
      e.hp = 0; e.boom = true; fx('boom', e.x, e.y);
      const hit = home().filter(p => dist(p,e) < 75);
      if (you && hit.includes(you)){
        you.hp -= 45*(hit.length > 1 ? 1.4 : 1); you.hurtT = 0;
        log(hit.length > 1 ? `Supplicant blast hit ${hit.length} Guardians` : 'A Supplicant detonated on you','bad');
        if (you.hp <= 0) return wipe('Killed by a Supplicant','Supplicants fly straight at the Vault team and explode on contact. Shoot them while they are still far away, and keep your distance from teammates so one blast can’t hit several people.');
      }
    }
  }
  S.enemies = S.enemies.filter(e => e.hp > 0);
  phaseLogic(dt);
}

function phaseLogic(dt){
  switch (S.phase){
    case 'opening':
      if (S.t > 1.5 && !S.enemies.length){ S.doneT += dt; if (S.doneT > .8) setPhase('teleport'); }
      break;
    case 'teleport':
      if (S.t > 1.2 && !S.moved){
        S.moved = true;
        S.players.filter(p => p.team==='away').forEach((p,i) => { fx('beam', p.x, p.y); p.loc = 'room'; p.x = ROOM.x - 30 + i*30; p.y = ROOM.y + 60 + (i===1 ? 10 : 0); p.meter = 0; fx('beam', p.x, p.y); });
        S.relic = {x:ROOM.x, y:ROOM.y - 10, held:false};
        if (you && you.team==='away') tap = null;
      }
      if (S.t > 2.4) setPhase('away');
      break;
    case 'away': {
      const R = S.players[0], plate = PLATES[S.dest];
      S.portalOpen = home().some(p => dist(p,plate) < plate.r);
      if (S.t > 3){
        S.closedT = S.portalOpen ? 0 : S.closedT + dt;
        if (S.closedT > 7) return wipe('The time gate closed', `The away team went to ${plate.name}. A Vault player has to stand on the ${plate.name} sync plate (${S.dest==='mars' ? 'left' : 'right'}) for the whole trip, or the gate closes with the away team still inside.`);
      }
      S.spT -= dt; if (S.spT <= 0){ S.spT = 1.9; spawnSupplicant(); }
      if (!S.relic.held && dist(R,S.relic) < 30 && (R.you ? interactHeld : true)){ S.relic.held = true; log('The Aegis is claimed','good'); }
      if (S.relic.held){ S.relic.x = R.x; S.relic.y = R.y; }
      if (!R.you && S.relic.held && away().some(p => p.meter > .5)) cleanse();
      if (S.t > 1) for (const p of away()){
        p.meter += dt/10;
        if (p.meter >= 1) return wipe(p.you ? 'You were consumed by the Void' : `${p.tag} was consumed by the Void`, p.key==='relic' ? 'The Aegis holder has to pick up the Relic right away and cleanse every few seconds. Watch the Void meter on each teammate and cleanse before any of them fill.' : 'Everyone in the gate is Marked by the Void. Stay inside the Aegis holder’s golden dome so their cleanse reaches you.');
      }
      if (S.sub==='show'){
        if (S.t2 > 3*.75 + .4){ S.sub = 'call'; S.t2 = 0; S.oracleT = 0; S.oracles = S.seq.map(pos => ({pos, alive:true})); S.seq.forEach(pos => fx('oracleSpawn', CORC[pos].x, CORC[pos].y)); }
      } else if (S.sub==='call'){
        const caller = S.players[4];
        if (!caller.you && S.t2 > 1.2 && S.call.length < 3) S.call = [...S.seq];
        if (S.call.length === 3){ S.sub = 'shoot'; S.shotT = 0; log(`Callout: ${S.call.map(i=>i+1).join(' · ')}`); }
      } else if (S.sub==='shoot'){
        S.shotT += dt;
        const k = S.shotIdx, sh = S.players[k%2===0 ? 1 : 2];
        if (!sh.you && S.shotT > .8 && sh.meter < .85) shootOracle(S.call[k], sh);
      } else if (S.sub==='between'){
        if (S.t2 > 1) startSet();
      } else if (S.sub==='return'){
        if (S.portalOpen){
          S.players.filter(p => p.team==='away').forEach((p,i) => { fx('beam', p.x, p.y); p.loc = 'vault'; p.x = TELEPORT_SPAWN.x + (i-1)*24; p.y = TELEPORT_SPAWN.y + 8; p.meter = 0; fx('beam', p.x, p.y); });
          S.relic = null; if (you && you.team==='away') tap = null;
          setPhase('dps');
        }
      }
      if (S.phase==='away' && (S.sub==='call' || S.sub==='shoot')){
        S.oracleT += dt;
        if (S.oracleT > 13) return wipe('An Oracle finished its song', S.call.length < 3 ? 'The away team can’t shoot until the Vault calls the order. Callers: watch the Vault Oracles light up and enter all three right away.' : 'Each set is on a clock. Shooters: take your Oracles (1st and 3rd for Shooter A) as soon as they are called.');
      }
      break;
    }
    case 'dps': {
      S.venT -= dt;
      if (!S.marked && S.t > 3){
        const pool = S.players.filter(p => p.key!=='relic');
        S.marked = (S.cycle===1 && you && !watch && you.key!=='relic') ? you : pool[Math.floor(Math.random()*pool.length)];
        S.detainT = 4.5; banner('Imminent Detain', `${S.marked.you ? 'You are' : S.marked.tag + ' is'} marked. Get away from the fireteam.`);
        log(`Imminent Detain on ${S.marked.tag}`);
      }
      if (S.marked && S.detainT > 0){
        S.detainT -= dt;
        if (S.detainT <= 0){
          const m = S.marked, caught = S.players.filter(p => p===m || dist(p,m) < 110);
          caught.forEach(p => { p.detained = true; p.bub = 70; });
          log(caught.length > 1 ? `Detainment trapped ${caught.length} Guardians` : `${m.tag} detained alone`, caught.length > 1 ? 'bad' : 'info');
          if (caught.length === 6) return wipe('The whole fireteam was detained','The marked Guardian stayed in the group, so the Detainment bubble trapped all six. When you are marked, run well away from the team before it triggers; the others then shoot you out.');
        }
      }
      const free = S.players.filter(p => !p.detained), bubbles = S.players.filter(p => p.detained);
      if (bubbles.length){
        const b = bubbles[0];
        for (const p of free) b.bub -= (p.you ? 55 : 40)*dt;
        if (b.bub <= 0){ b.detained = false; fx('pop', b.x, b.y); log(`${b.tag} freed`); }
      } else {
        const n = free.filter(onPlatform).length;
        S.hp -= .34*n*dt;
      }
      if (S.hp <= 0){ S.hp = 0; return victory(); }
      if (S.venT <= 0){
        S.players.forEach(p => { p.detained = false; });
        S.cycle++;
        if (S.cycle > 3) return wipe('Atheon outlasted the fireteam','You get three Time’s Vengeance windows in this sim. Damage only counts from the DPS platform, and every second spent detained or out of position is lost.');
        setPhase('opening');
      }
      break;
    }
  }
}

// =====================================================================
// HUD + overlay (DOM)
// =====================================================================
const $ = id => document.getElementById(id);
const YAW_LIMIT = Math.PI / 3.5; // ~51° either side of the default facing — keeps the isometric framing readable
const ROTATE_STEP = Math.PI / 18; // 10° per button press
let camYaw = 0;
const overlay = $('overlay');
const ICONS = {
  void:'<path d="M3 12s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6z"/><path d="M4 20L20 4"/>',
  aegis:'<path d="M12 3l7 4v6c0 4-3 7-7 8-4-1-7-4-7-8V7z"/>',
  time:'<path d="M7 3h10M7 21h10M8 3c0 5 8 5 8 9s-8 4-8 9M16 3c0 5-8 5-8 9"/>',
  detain:'<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/>',
};
function objectivesList(){
  const ph = S.phase, r = watch ? null : you, L = [];
  if (ph==='idle') return L;
  if (ph==='opening') L.push({t:'Defeat the Supplicants', v:`${Math.min(S.killed,S.toKill)}/${S.toKill}`});
  if (ph==='teleport') L.push({t:'Atheon is opening a time gate'});
  if (ph==='away'){
    const pl = PLATES[S.dest];
    if (!r || r.team==='away'){
      L.push({t:'Claim the Aegis', done:S.relic && S.relic.held});
      L.push({t:'Destroy Oracles in the called order', v:`Set ${S.set}/3 · ${S.shotIdx}/3`});
    }
    if (!r || r.team==='home'){
      L.push({t:`Hold the ${pl.name} sync plate`, v:S.portalOpen ? 'OPEN' : 'CLOSED', warn:!S.portalOpen});
      L.push({t:'Call the Oracle order', v:`Set ${S.set}/3`, done:S.call.length===3});
    }
    if (S.sub==='return') L.push({t:'Return through the time gate'});
  }
  if (ph==='dps'){
    L.push({t:'Damage Atheon from the DPS platform', v:`${Math.max(0,S.venT).toFixed(0)}s`});
    if (S.players.some(p => p.detained)) L.push({t:'Free detained Guardians', warn:true});
  }
  return L;
}
function buffsList(){
  if (!you || watch) return [];
  const B = [];
  if (you.key==='relic' && S.relic && S.relic.held) B.push({pos:true, ic:'aegis', n:'Aegis', v:S.cleanCd > 0 ? `${S.cleanCd.toFixed(1)}s` : 'READY', f:1 - S.cleanCd/1.5});
  if (S.phase==='dps' && S.venT > 0) B.push({pos:true, ic:'time', n:'Time’s Vengeance', v:`${S.venT.toFixed(0)}s`, f:S.venT/30});
  if (you.loc==='room') B.push({pos:false, ic:'void', n:'Marked by the Void', v:`${Math.round(you.meter*100)}%`, f:you.meter});
  if (S.marked===you && S.detainT > 0) B.push({pos:false, ic:'detain', n:'Imminent Detain', v:`${S.detainT.toFixed(1)}s`, f:S.detainT/4.5});
  if (you.detained) B.push({pos:false, ic:'detain', n:'Detained', v:'', f:you.bub/70});
  return B.sort((a,b) => b.pos - a.pos);
}
function ghost(){
  const ph = S.phase, r = watch ? null : you;
  if (ph==='idle') return 'Pick a seat to begin.';
  const dest = S.dest ? PLATES[S.dest].name : '';
  if (ph==='opening') return r && r.team==='away' ? 'Clear the Supplicants. Atheon is about to pull you through the gate.' : 'Clear the Supplicants harassing the Vault. Atheon opens a time gate once they’re dead.';
  if (ph==='teleport') return r ? (r.team==='away' ? `Atheon is sending you to <strong>${dest}</strong>. Get ready to claim the Aegis.` : `Three Guardians are going to <strong>${dest}</strong>. Note which side.`) : `Atheon sends three Guardians to ${dest}.`;
  if (ph==='away'){
    if (!r) return `Away team (${dest}): the Aegis holder cleanses, the shooters wait for the call. Vault: one Guardian holds the ${dest} plate, the caller reads the Oracles, add-clear handles Supplicants.`;
    if (r.key==='relic') return !S.relic.held ? 'Walk to the floating golden shield and <strong>hold E</strong> to claim the Aegis. The Void is already building.' : 'Press <strong>Q</strong> to cleanse before any teammate’s Void meter fills. Your golden dome is the cleanse range, so keep both shooters inside it.';
    if (r.key==='shooter'){
      if (S.sub==='show') return 'The Oracles are singing in the Vault. You can’t see the order. Wait for the call.';
      if (S.sub==='call') return 'Waiting for the Vault caller…';
      if (S.sub==='shoot') return S.shotIdx===1 ? 'Shooter B takes the 2nd Oracle. Get ready for the 3rd.' : `Destroy <strong>Oracle ${S.call[S.shotIdx]+1}</strong> (${S.call[S.shotIdx] < 3 ? 'Atheon’s end' : 'gate end'}): click it or press ${S.call[S.shotIdx]+1}. Stay inside the golden dome.`;
      return 'Stay inside the Aegis holder’s golden dome so their cleanse reaches you.';
    }
    if (r.key==='plate') return `The away team is in <strong>${dest}</strong>. Go down the ${S.dest==='mars' ? 'left' : 'right'} side stairs and stand on the <strong>${dest} sync plate</strong>. Don’t leave until they’re back.`;
    if (r.key==='caller'){
      if (S.sub==='show') return 'Watch the six Oracle spots. <strong>1 2 3</strong> are up the hall toward Atheon (left wall, middle stairs, right wall). <strong>4 5 6</strong> are by the Mars gate, the DPS platform and the Venus gate. Three light up <strong>one at a time</strong>. Remember the order.';
      if (S.sub==='call') return 'Enter the three positions <strong>in the order they lit up</strong> on the callout pad, or press 1–6.';
      return 'Called. Get ready for the next set.';
    }
    return 'Shoot Supplicants before they reach the plate holder or caller. Keep a few steps from your teammates.';
  }
  if (ph==='dps'){
    if (r && S.marked===r && S.detainT > 0) return '<strong>You have Imminent Detain.</strong> Run well away from the fireteam, outside the red ring, before it triggers.';
    if (r && r.detained) return 'You’re detained. Your fireteam is shooting you out.';
    if (S.players.some(p => p.detained)) return 'Shoot the Detainment bubble to free your teammate, then get back on Atheon.';
    return 'Get onto the <strong>DPS platform</strong> (front center, up the diagonal stairs by either gate) and damage Atheon. Damage only counts from there.';
  }
  return '';
}
let feedSeen = new Set(), lastHp = 100, chipT = 0;
function hud(){
  $('objs').innerHTML = objectivesList().map(o => `<li class="${o.done ? 'done' : ''} ${o.warn ? 'warn' : ''}">${o.t}${o.v ? `<span>${o.v}</span>` : '<span></span>'}</li>`).join('');
  $('team').innerHTML = S.players.map(p => `<div class="${p.loc==='room' && you && you.loc==='vault' && !watch ? 'gone' : ''}"><small>${p.loc==='room' ? PLATES[S.dest]?.name.toUpperCase() || '' : (p.detained ? 'DETAINED' : '')}</small>${p.you ? 'YOU' : p.tag}<i style="background:${p.color}"></i></div>`).join('');
  $('buffs').innerHTML = buffsList().map(b => `<div class="buff ${b.pos ? 'pos' : 'neg'}"><div class="ic"><b style="height:${Math.round(Math.max(0,Math.min(1,b.f))*100)}%"></b><svg viewBox="0 0 24 24">${ICONS[b.ic]}</svg></div><div class="bn">${b.n}</div><div class="bt">${b.v}</div></div>`).join('');
  const fresh = S.log.filter(l => !feedSeen.has(l.id)).reverse();
  for (const l of fresh){ feedSeen.add(l.id); const d = document.createElement('div'); d.className = l.kind; d.textContent = l.text; $('feed').appendChild(d); }
  while ($('feed').children.length > 5) $('feed').firstChild.remove();
  $('bossPct').textContent = `${Math.ceil(S.hp)}%`;
  $('fill').style.width = `${S.hp}%`;
  if (S.hp < lastHp - .5 || S.hp > lastHp){ $('chip').style.width = `${S.hp}%`; lastHp = S.hp; }
  const ann = $('ann');
  if (S.banner){ $('a1').textContent = S.banner.text; $('a2').textContent = S.banner.sub; ann.style.opacity = Math.min(1, S.banner.t/.5); } else ann.style.opacity = 0;
  $('veil').style.opacity = you && !watch && you.loc==='room' && S.phase==='away' ? Math.max(0, (you.meter - .15)*1.15) : 0;
  $('obj').innerHTML = ghost();
  const callerYou = you && you.key==='caller' && !watch;
  const canCall = callerYou && S.phase==='away' && (S.sub==='show' || S.sub==='call') && S.call.length < 3 && !paused;
  [...$('pad').children].forEach(b => b.disabled = !canCall);
  $('padClr').disabled = !canCall;
  $('padOut').textContent = callerYou ? (S.phase==='away' && S.call.length ? S.call.map(i => i+1).join(' · ') : '—') : 'Used by the Caller';
  $('bE').hidden = !(you && you.key==='relic' && S.phase==='away' && S.relic && !S.relic.held && !paused);
  $('bQ').hidden = !(you && you.key==='relic' && S.phase==='away' && S.relic && S.relic.held && !paused);
  $('bQ').disabled = S.cleanCd > 0;
  $('pausedLbl').hidden = !(paused && !S.result && S.phase!=='idle' && overlay.hidden);
  drawRadar();
}
const rc = $('radar').getContext('2d');
function drawRadar(){
  const w = 240, h = 138, cx = w/2, cy = h-6, R = 126;
  rc.clearRect(0,0,w,h);
  rc.fillStyle = 'rgba(8,12,18,.55)'; rc.beginPath(); rc.moveTo(cx,cy); rc.arc(cx,cy,R,Math.PI*1.12,Math.PI*1.88); rc.closePath(); rc.fill();
  rc.strokeStyle = 'rgba(255,255,255,.35)'; rc.lineWidth = 1.5; rc.stroke();
  rc.strokeStyle = 'rgba(255,255,255,.12)'; rc.lineWidth = 1;
  [R*.33, R*.66].forEach(r => { rc.beginPath(); rc.arc(cx,cy,r,Math.PI*1.12,Math.PI*1.88); rc.stroke(); });
  const sweep = (performance.now()/1000*1.4) % 1;
  rc.strokeStyle = `rgba(127,198,255,${.5*(1-sweep)})`; rc.beginPath(); rc.arc(cx,cy,R*sweep,Math.PI*1.12,Math.PI*1.88); rc.stroke();
  const me = you && !watch ? you : {x:RALLY.x, y:RALLY.y, loc:'vault'};
  const blip = (x,y,col,s) => { const dx = (x-me.x)/400*R, dy = (y-me.y)/400*R; const px = cx+dx, py = cy+dy - R*.35; if (py < cy && Math.hypot(px-cx,py-cy) < R){ rc.fillStyle = col; rc.beginPath(); rc.arc(px,py,s,0,Math.PI*2); rc.fill(); } };
  if (me.loc==='vault') for (const e of S.enemies) blip(e.x, e.y, '#ff4a3a', 4.5);
  for (const p of S.players) if (p !== me && p.loc===me.loc) blip(p.x, p.y, '#7fc6ff', 3);
  rc.fillStyle = '#fff'; rc.beginPath(); rc.moveTo(cx, cy-R*.35-6); rc.lineTo(cx+4, cy-R*.35+4); rc.lineTo(cx-4, cy-R*.35+4); rc.closePath(); rc.fill();
}

function showOverlay(kind){
  overlay.hidden = false;
  if (kind==='start'){
    overlay.innerHTML = `<div class="ocard"><div class="k">Vault of Glass · Raid · Choose your seat</div><h2><b>Atheon</b><br>Time’s Conflux</h2><p>Away seats go through the time gate. Vault seats stay behind. Watch the bots run it once if the fight is new to you.</p><div class="seats">${ROSTER.filter(r => !r.bot).map(r => `<button class="seat" data-role="${r.key}"><div class="em" style="border-color:${r.color}"><i style="background:${r.color}"></i></div><b>${r.label}<em>${r.team==='away' ? 'AWAY' : 'VAULT'}</em></b><span>${r.desc}</span></button>`).join('')}</div><div class="row"><button class="btn" data-watch>Watch the bots run it</button></div></div>`;
  } else if (kind==='fail'){
    overlay.innerHTML = `<div class="ocard"><div class="k" style="color:var(--debuff)">Fireteam wiped</div><h2>${S.result.reason}</h2><p class="why">${S.result.lesson}</p><div class="row"><button class="btn primary" data-retry>Try again${watch ? '' : ' as ' + you.label}</button><button class="btn" data-pick>Choose another seat</button></div></div>`;
  } else {
    overlay.innerHTML = `<div class="ocard win"><div class="k" style="color:var(--ok)">Encounter complete</div><h2><b>Atheon</b> defeated</h2><p class="why">${watch ? 'That’s the full loop. Pick a seat and play it yourself.' : `You cleared it as ${you.label}. Try a seat on the other side of the gate next; the fight looks completely different from there.`}</p><div class="row"><button class="btn primary" data-pick>Choose a seat</button><button class="btn" data-retry>Run it again</button></div></div>`;
  }
}
overlay.addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.role) start(b.dataset.role);
  else if ('watch' in b.dataset) start(null);
  else if ('retry' in b.dataset) start(lastRole);
  else if ('pick' in b.dataset) showOverlay('start');
});
function start(roleKey){
  newState(); lastRole = roleKey; watch = !roleKey; tap = null; interactHeld = false;
  you = roleKey ? S.players.find(p => p.key===roleKey) : null;
  if (you) you.you = true;
  $('seatLbl').textContent = you ? `Ghost · ${you.label} · ${you.team==='away' ? 'away team' : 'Vault team'}` : 'Ghost · spectating';
  SFX.init();
  overlay.hidden = true; paused = false; $('bPause').textContent = 'Pause';
  feedSeen = new Set(); $('feed').innerHTML = ''; lastHp = 100;
  if (window.__resetScene) window.__resetScene();
  setPhase('opening');
}

function callDigit(n){
  if (!you || you.key!=='caller' || S.phase!=='away' || !(S.sub==='show' || S.sub==='call') || S.call.length >= 3) return;
  if (!S.call.includes(n)) S.call.push(n);
}
$('pad').innerHTML = [1,2,3,4,5,6].map(n => `<button data-n="${n-1}" aria-label="Oracle ${n}">${n}</button>`).join('');
$('pad').addEventListener('click', e => { const b = e.target.closest('button'); if (b) callDigit(+b.dataset.n); });
$('padClr').onclick = () => { if (S.phase==='away' && S.call.length < 3) S.call = []; };
addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  if (['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'].includes(k) && overlay.hidden){ keys.add(k); e.preventDefault(); }
  if (k==='e') interactHeld = true;
  if (k==='q' && you && you.key==='relic' && !paused) cleanse();
  if (k==='p' && overlay.hidden) togglePause();
  if (/^[1-6]$/.test(k) && you && !paused){
    if (you.key==='caller') callDigit(+k-1);
    if (you.key==='shooter') shootOracle(+k-1, you);
  }
});
addEventListener('keyup', e => { const k = e.key.toLowerCase(); keys.delete(k); if (k==='e') interactHeld = false; });
addEventListener('blur', () => { keys.clear(); interactHeld = false; });
const bE = $('bE');
bE.addEventListener('pointerdown', e => { e.preventDefault(); interactHeld = true; });
['pointerup','pointerleave','pointercancel'].forEach(ev => bE.addEventListener(ev, () => { interactHeld = false; }));
$('bQ').addEventListener('click', () => cleanse());
function togglePause(){ if (S.result || S.phase==='idle') return; paused = !paused; $('bPause').textContent = paused ? 'Resume' : 'Pause'; }
$('bPause').onclick = togglePause;
$('bSpeed').onclick = () => { speed = speed===1 ? .5 : 1; $('bSpeed').textContent = `Speed ${speed===1 ? '1' : '½'}×`; };
$('bRoles').onclick = () => { paused = true; showOverlay('start'); };
$('bRotL').onclick = () => { camYaw = Math.max(-YAW_LIMIT, camYaw - ROTATE_STEP); };
$('bRotR').onclick = () => { camYaw = Math.min(YAW_LIMIT, camYaw + ROTATE_STEP); };

// =====================================================================
// AUDIO (Web Audio, all synthesized, no files)
// =====================================================================
const SFX = (() => {
  let ctx = null, master = null, verb = null, droneF = null, droneG = null, on = true;
  const ORACLE_HZ = [392, 440, 523.25, 587.33, 659.25, 783.99];
  function init(){
    if (ctx) return;
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e){ ctx = null; return; }
    master = ctx.createGain(); master.gain.value = on ? .7 : 0;
    const comp = ctx.createDynamicsCompressor(); master.connect(comp); comp.connect(ctx.destination);
    verb = ctx.createConvolver();
    const len = ctx.sampleRate*2.6, buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c=0;c<2;c++){ const d = buf.getChannelData(c); for (let i=0;i<len;i++) d[i] = (Math.random()*2-1)*Math.pow(1-i/len, 3); }
    verb.buffer = buf; const vg = ctx.createGain(); vg.gain.value = .32; verb.connect(vg); vg.connect(master);
    droneG = ctx.createGain(); droneG.gain.value = 0;
    droneF = ctx.createBiquadFilter(); droneF.type = 'lowpass'; droneF.frequency.value = 380; droneF.Q.value = 3;
    droneF.connect(droneG); droneG.connect(master); droneG.connect(verb);
    [55, 55*1.007, 82.41, 110*1.003].forEach((f,i) => { const o = ctx.createOscillator(); o.type = i===2 ? 'triangle' : 'sawtooth'; o.frequency.value = f; o.connect(droneF); o.start(); });
    const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = .13; lg.gain.value = 140; lfo.connect(lg); lg.connect(droneF.frequency); lfo.start();
    droneG.gain.setTargetAtTime(.055, ctx.currentTime, 2);
  }
  const t0 = () => ctx.currentTime;
  function env(g, a, peak, d){ g.gain.setValueAtTime(0.0001, t0()); g.gain.linearRampToValueAtTime(peak, t0()+a); g.gain.exponentialRampToValueAtTime(.0001, t0()+a+d); }
  function noise(dur){ const b = ctx.createBuffer(1, Math.max(1, ctx.sampleRate*dur|0), ctx.sampleRate), d = b.getChannelData(0); for (let i=0;i<d.length;i++) d[i] = Math.random()*2-1; const s = ctx.createBufferSource(); s.buffer = b; return s; }
  function out(node, wet=true){ node.connect(master); if (wet) node.connect(verb); }
  let lastScreech = 0;
  return {
    init,
    get on(){ return on; },
    toggle(){ on = !on; if (master) master.gain.setTargetAtTime(on ? .7 : 0, t0(), .05); return on; },
    oracle(i){
      if (!ctx) return; const f = ORACLE_HZ[i];
      [[1,'sine',.24],[2,'triangle',.07],[3.01,'sine',.035]].forEach(([m,type,pk]) => { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.value = f*m; env(g,.012,pk,1.7); o.connect(g); out(g); o.start(); o.stop(t0()+1.9); });
    },
    boom(){
      if (!ctx) return;
      const n = noise(1), f = ctx.createBiquadFilter(), g = ctx.createGain(); f.type = 'lowpass';
      f.frequency.setValueAtTime(2600, t0()); f.frequency.exponentialRampToValueAtTime(80, t0()+.75); env(g,.004,.6,.85); n.connect(f); f.connect(g); out(g); n.start();
      const o = ctx.createOscillator(), og = ctx.createGain(); o.frequency.setValueAtTime(95, t0()); o.frequency.exponentialRampToValueAtTime(28, t0()+.55); env(og,.004,.55,.6); o.connect(og); out(og,false); o.start(); o.stop(t0()+.7);
    },
    screech(){
      if (!ctx || t0() - lastScreech < .35) return; lastScreech = t0();
      const o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain(); o.type = 'sawtooth';
      o.frequency.setValueAtTime(1700, t0()); o.frequency.exponentialRampToValueAtTime(520, t0()+.45);
      f.type = 'bandpass'; f.frequency.value = 1400; f.Q.value = 5; env(g,.02,.05,.45); o.connect(f); f.connect(g); out(g); o.start(); o.stop(t0()+.55);
    },
    whoosh(){
      if (!ctx) return;
      const n = noise(1.4), f = ctx.createBiquadFilter(), g = ctx.createGain(); f.type = 'bandpass'; f.Q.value = 1.2;
      f.frequency.setValueAtTime(250, t0()); f.frequency.exponentialRampToValueAtTime(3200, t0()+.7); f.frequency.exponentialRampToValueAtTime(400, t0()+1.3);
      env(g,.35,.35,.9); n.connect(f); f.connect(g); out(g); n.start();
      const o = ctx.createOscillator(), og = ctx.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(180, t0()); o.frequency.exponentialRampToValueAtTime(900, t0()+.8); env(og,.3,.08,.7); o.connect(og); out(og); o.start(); o.stop(t0()+1.2);
    },
    chime(){
      if (!ctx) return;
      [880, 1318.5, 1760].forEach((fq,k) => { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine'; o.frequency.value = fq; env(g,.01,[.12,.08,.04][k],1.3); o.connect(g); out(g); o.start(); o.stop(t0()+1.5); });
    },
    shatter(){
      if (!ctx) return;
      const n = noise(.4), f = ctx.createBiquadFilter(), g = ctx.createGain(); f.type = 'highpass'; f.frequency.value = 2800; env(g,.003,.3,.35); n.connect(f); f.connect(g); out(g); n.start();
      const o = ctx.createOscillator(), og = ctx.createGain(); o.type = 'triangle'; o.frequency.setValueAtTime(1568, t0()); o.frequency.exponentialRampToValueAtTime(700, t0()+.3); env(og,.003,.12,.4); o.connect(og); out(og); o.start(); o.stop(t0()+.5);
    },
    tick(){
      if (!ctx) return;
      const n = noise(.06), f = ctx.createBiquadFilter(), g = ctx.createGain(); f.type = 'bandpass'; f.frequency.value = 2200; f.Q.value = 2; env(g,.002,.05,.06); n.connect(f); f.connect(g); out(g,false); n.start();
    },
    phase(ph){
      if (!ctx) return;
      const cfg = {dps:[1500,.085], away:[720,.07], teleport:[1000,.08], opening:[420,.055]}[ph] || [380,.05];
      droneF.frequency.setTargetAtTime(cfg[0], t0(), .9); droneG.gain.setTargetAtTime(cfg[1], t0(), .9);
    },
  };
})();
$('bSound').onclick = () => { SFX.init(); const on = SFX.toggle(); $('bSound').textContent = on ? 'Sound on' : 'Sound off'; };

// =====================================================================
// ENGINE (three.js r160, ES modules). Sim (x,y) → world (X = (x-500)/10, Z = (y-380)/10)
// =====================================================================
let render = () => {};
async function initEngine(){
  const THREE = await import('three');
  const [{EffectComposer},{RenderPass},{UnrealBloomPass},{OutputPass},{SMAAPass},{GTAOPass},{ShaderPass},{Reflector}] = await Promise.all([
    import('three/addons/postprocessing/EffectComposer.js'),
    import('three/addons/postprocessing/RenderPass.js'),
    import('three/addons/postprocessing/UnrealBloomPass.js'),
    import('three/addons/postprocessing/OutputPass.js'),
    import('three/addons/postprocessing/SMAAPass.js'),
    import('three/addons/postprocessing/GTAOPass.js'),
    import('three/addons/postprocessing/ShaderPass.js'),
    import('three/addons/objects/Reflector.js'),
  ]);

  const canvas = $('gl'), game = $('game');
  const renderer = new THREE.WebGLRenderer({canvas, antialias:false, powerPreference:'high-performance'});
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = .95;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x03050a);
  scene.fog = new THREE.FogExp2(0x060a10, 0.0052);
  const camera = new THREE.PerspectiveCamera(38, 16/9, .5, 900);

  const V = (x, y, h=0) => new THREE.Vector3((x-360)/10, h, (y-560)/10);
  const toSim = v => ({x:v.x*10 + 360, y:v.z*10 + 560});
  const hdr = (c, i) => new THREE.Color(c).multiplyScalar(i);

  // ---------- environment reflections: a dark room with Vex-colored light panels ----------
  {
    const env = new THREE.Scene();
    env.add(new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), new THREE.MeshBasicMaterial({color:0x0b0e13, side:THREE.BackSide})));
    const panel = (w, h, c, i, pos) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({color:hdr(c,i), side:THREE.DoubleSide})); m.position.set(...pos); m.lookAt(0,0,0); env.add(m); };
    panel(36, 7, 0xdff4ef, 3.2, [0, 42, -8]); panel(10, 30, 0xc9a36a, 1.6, [-42, 8, 0]); panel(10, 30, 0x7fb3ff, 1.1, [42, 8, 0]); panel(44, 4, 0xf2c46b, .8, [0, -32, 18]);
    const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(env, .03).texture; pm.dispose();
  }

  // ---------- procedural textures ----------
  const mkCanvas = (s, fn) => { const c = document.createElement('canvas'); c.width = c.height = s; fn(c.getContext('2d'), s); return c; };
  function hammeredNormal(){
    const s = 256, src = mkCanvas(s, (g) => {
      g.fillStyle = '#808080'; g.fillRect(0,0,s,s);
      for (let i=0;i<520;i++){ const x = Math.random()*s, y = Math.random()*s, r = 3 + Math.random()*11;
        for (const [ox,oy] of [[0,0],[s,0],[-s,0],[0,s],[0,-s]]){ const gr = g.createRadialGradient(x+ox,y+oy,0,x+ox,y+oy,r); gr.addColorStop(0,'rgba(0,0,0,.32)'); gr.addColorStop(1,'rgba(0,0,0,0)'); g.fillStyle = gr; g.beginPath(); g.arc(x+ox,y+oy,r,0,7); g.fill(); } }
    }).getContext('2d').getImageData(0,0,s,s).data;
    const h = (x,y) => src[(((y+s)%s)*s + ((x+s)%s))*4]/255, out = new Uint8Array(s*s*4);
    for (let y=0;y<s;y++) for (let x=0;x<s;x++){ const dx = (h(x+1,y)-h(x-1,y))*3.2, dy = (h(x,y+1)-h(x,y-1))*3.2, l = Math.hypot(dx,dy,1), i = (y*s+x)*4; out[i] = (-dx/l*.5+.5)*255; out[i+1] = (-dy/l*.5+.5)*255; out[i+2] = (1/l*.5+.5)*255; out[i+3] = 255; }
    const t = new THREE.DataTexture(out, s, s); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.needsUpdate = true; return t;
  }
  const spriteTex = new THREE.CanvasTexture(mkCanvas(64, (g,s) => { const gr = g.createRadialGradient(s/2,s/2,0,s/2,s/2,s/2); gr.addColorStop(0,'rgba(255,255,255,1)'); gr.addColorStop(.25,'rgba(255,255,255,.6)'); gr.addColorStop(1,'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0,0,s,s); }));
  const fogTex = new THREE.CanvasTexture(mkCanvas(256, (g,s) => { g.clearRect(0,0,s,s); for (let i=0;i<60;i++){ const x = Math.random()*s, y = Math.random()*s, r = 20 + Math.random()*60; for (const [ox,oy] of [[0,0],[s,0],[-s,0],[0,s],[0,-s]]){ const gr = g.createRadialGradient(x+ox,y+oy,0,x+ox,y+oy,r); gr.addColorStop(0,'rgba(255,255,255,.16)'); gr.addColorStop(1,'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(x+ox-r,y+oy-r,r*2,r*2); } } }));
  fogTex.wrapS = fogTex.wrapT = THREE.RepeatWrapping;
  const roughTex = new THREE.CanvasTexture(mkCanvas(128, (g,s) => { const d = g.createImageData(s,s); for (let i=0;i<s*s;i++){ const v = 150 + Math.random()*90; d.data[i*4] = d.data[i*4+1] = d.data[i*4+2] = v; d.data[i*4+3] = 255; } g.putImageData(d,0,0); }));
  roughTex.wrapS = roughTex.wrapT = THREE.RepeatWrapping; roughTex.repeat.set(3,3); roughTex.colorSpace = THREE.NoColorSpace;
  const hammer = hammeredNormal(); hammer.repeat.set(2,2);

  // ---------- materials ----------
  const BRASS = new THREE.MeshStandardMaterial({color:0xb08b4f, metalness:1, roughness:.34, normalMap:hammer, normalScale:new THREE.Vector2(.75,.75), envMapIntensity:1.35});
  const BRASS_DARK = BRASS.clone(); BRASS_DARK.color.set(0x6e5530); BRASS_DARK.roughness = .48;
  const STONE = new THREE.MeshStandardMaterial({color:0x1a1d23, roughness:.85, metalness:.08, roughnessMap:roughTex, envMapIntensity:.5});
  const GLASS = new THREE.MeshPhysicalMaterial({color:0xd5f1ec, metalness:0, roughness:.22, transmission:.9, thickness:1.4, ior:1.45, attenuationColor:new THREE.Color(0x76d0c2), attenuationDistance:5, envMapIntensity:1.4});
  const emis = (c, i=1) => new THREE.MeshBasicMaterial({color:hdr(c,i)});
  const VERT_VIEW = `varying vec3 vN; varying vec3 vV; varying vec3 vP; void main(){ vec4 mv = modelViewMatrix*vec4(position,1.); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); vP = position; gl_Position = projectionMatrix*mv; }`;
  const fresnel = (c, i=1, power=2.2, base=.04) => new THREE.ShaderMaterial({
    transparent:true, depthWrite:false, blending:THREE.AdditiveBlending, side:THREE.DoubleSide,
    uniforms:{uCol:{value:new THREE.Color(c)}, uI:{value:i}, uP:{value:power}, uB:{value:base}},
    vertexShader:VERT_VIEW,
    fragmentShader:`uniform vec3 uCol; uniform float uI,uP,uB; varying vec3 vN; varying vec3 vV; void main(){ float f = pow(1.-abs(dot(normalize(vN),normalize(vV))),uP); gl_FragColor = vec4(uCol*uI*(f+uB),1.); }`,
  });
  // milky radiolaria: swirling white with a bright rim
  const milky = (c, i=2) => new THREE.ShaderMaterial({
    uniforms:{uCol:{value:new THREE.Color(c)}, uI:{value:i}, uT:{value:0}},
    vertexShader:VERT_VIEW,
    fragmentShader:`uniform vec3 uCol; uniform float uI,uT; varying vec3 vN; varying vec3 vV; varying vec3 vP;
      void main(){ float f = pow(1.-abs(dot(normalize(vN),normalize(vV))),2.);
        float s = sin(vP.y*7.+uT*1.7+sin(vP.x*5.+uT)*1.5)*.5+.5; float s2 = sin(vP.z*9.-uT*2.3)*.5+.5;
        vec3 col = uCol*uI*(.45+.35*s+.2*s2) + uCol*f*uI*1.6; gl_FragColor = vec4(col,1.); }`,
  });

  // ---------- lights ----------
  scene.add(new THREE.HemisphereLight(0x8fa5c0, 0x0c0a08, .6));
  const key = new THREE.DirectionalLight(0xdfe9ff, 2); key.position.set(-36, 80, 40);
  key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -.0004; key.shadow.normalBias = .03;
  Object.assign(key.shadow.camera, {left:-80, right:80, top:70, bottom:-70, near:10, far:260}); key.target.position.set(14, 0, -3);
  scene.add(key, key.target);
  const warm = new THREE.DirectionalLight(0xffc98a, .45); warm.position.set(40, 30, 60); scene.add(warm);
  const coreLight = new THREE.PointLight(0xdff4ef, 40, 70, 1.6); scene.add(coreLight);
  const roomLight = new THREE.PointLight(0xb6c95a, 0, 70, 1.4); roomLight.position.copy(V(800, 420, 14)); scene.add(roomLight);
  const flash = new THREE.PointLight(0xffa060, 0, 40, 2); scene.add(flash);
  const platLight = new THREE.PointLight(0xc9a36a, 40, 36, 1.8); platLight.position.copy(V(DPS.x, DPS.y, 8)); scene.add(platLight);
  // ---------- sky ----------
  { const g = new THREE.BufferGeometry(), n = 1400, a = new Float32Array(n*3);
    for (let i=0;i<n;i++){ const r = 260 + Math.random()*140, t = Math.random()*Math.PI*2, ph = Math.random()*Math.PI*.5; a[i*3] = Math.cos(t)*Math.cos(ph)*r; a[i*3+1] = Math.sin(ph)*r - 30; a[i*3+2] = Math.sin(t)*Math.cos(ph)*r - 60; }
    g.setAttribute('position', new THREE.BufferAttribute(a,3));
    scene.add(new THREE.Points(g, new THREE.PointsMaterial({color:hdr(0xaec4dc,1.3), size:1.1, map:spriteTex, transparent:true, depthWrite:false, fog:false, blending:THREE.AdditiveBlending}))); }


  // ---------- arena built from the traced map ----------
  const shapeOf = pts => { const sh = new THREE.Shape(); pts.forEach((p,i) => { const w = V(p.x, p.y); i ? sh.lineTo(w.x, -w.z) : sh.moveTo(w.x, -w.z); }); sh.closePath(); return sh; };
  const flatGeo = pts => new THREE.ShapeGeometry(shapeOf(pts));              // XY plane; rotate the mesh -90° on X to lay it down
  const slab = (pts, top, depth) => { const g = new THREE.ExtrudeGeometry(shapeOf(pts), {depth, bevelEnabled:false}); g.rotateX(-Math.PI/2); g.translate(0, top - depth, 0); return g; };
  const lay = (mesh, y) => { mesh.rotation.x = -Math.PI/2; mesh.position.y = y; return mesh; };
  const outline = (pts, y, c, i, op=1) => { const g = new THREE.BufferGeometry().setFromPoints(pts.map(p => V(p.x, p.y, y))); const l = new THREE.LineLoop(g, new THREE.LineBasicMaterial({color:hdr(c,i), transparent:op < 1, opacity:op})); scene.add(l); return l; };
  const DARK_GLASS = new THREE.MeshPhysicalMaterial({color:0x070a0f, roughness:.3, metalness:.1, clearcoat:1, clearcoatRoughness:.3, transparent:true, opacity:.8, envMapIntensity:.7});
  const PLAT_GLASS = new THREE.MeshPhysicalMaterial({color:0x0e1218, roughness:.28, metalness:.35, clearcoat:1, clearcoatRoughness:.3, envMapIntensity:1});
  const LOW_FLOOR = new THREE.MeshPhysicalMaterial({color:0x0b0d11, roughness:.45, metalness:.15, clearcoat:.5, clearcoatRoughness:.35, envMapIntensity:.5});

  // main floor + hall: the hall climbs in two wide flights toward the top room (0 → 1 → 2)
  function clipY(pts, y0, y1){
    const cut = (pl, keep, yb) => { const out = []; for (let i=0;i<pl.length;i++){ const a = pl[i], b = pl[(i+1) % pl.length], ia = keep(a), ib = keep(b); if (ia) out.push(a); if (ia !== ib){ const t = (yb - a.y)/(b.y - a.y); out.push({x:a.x + (b.x-a.x)*t, y:yb}); } } return out; };
    let r = cut(pts, p => p.y >= y0, y0); if (r.length > 2) r = cut(r, p => p.y <= y1, y1); return r.length > 2 ? r : null;
  }
  const HALL_GLASS = new THREE.MeshPhysicalMaterial({color:0x0b0e13, roughness:.3, metalness:.2, clearcoat:1, clearcoatRoughness:.3, envMapIntensity:.8});
  const bands = [{y0:-1e4, y1:HALL.top, h:2}];
  const flight = (ya, yb, ha, hb, n) => { for (let k=0;k<n;k++) bands.push({y0:ya + (yb-ya)*k/n, y1:ya + (yb-ya)*(k+1)/n, h:ha + (hb-ha)*(k+.5)/n, step:true}); };
  flight(HALL.top, HALL.mid0, 2, 1, 5); bands.push({y0:HALL.mid0, y1:HALL.mid1, h:1}); flight(HALL.mid1, HALL.floor, 1, 0, 6);
  for (const b of bands){
    const pts = clipY(ARENA.upper, b.y0, b.y1); if (!pts) continue;
    const m = new THREE.Mesh(slab(pts, b.h - .01, b.h + 6), STONE); m.receiveShadow = true; m.castShadow = b.step; scene.add(m);
    const top = lay(new THREE.Mesh(flatGeo(pts), HALL_GLASS), b.h); top.receiveShadow = true; scene.add(top);
    if (b.step){ const xs = pts.filter(q => Math.abs(q.y - b.y0) < .01).map(q => q.x); if (xs.length >= 2){ const line = new THREE.BufferGeometry().setFromPoints([V(Math.min(...xs) + 2, b.y0, b.h + .02), V(Math.max(...xs) - 2, b.y0, b.h + .02)]); scene.add(new THREE.Line(line, new THREE.LineBasicMaterial({color:hdr(0xc9a36a, 1.3)}))); } }
  }
  // main floor: black glass over a live mirror
  const floorPts = clipY(ARENA.upper, HALL.floor, 1e4);
  { const b = new THREE.Mesh(slab(floorPts, -.03, 6), STONE); b.receiveShadow = true; scene.add(b); }
  const reflector = lay(new Reflector(flatGeo(floorPts), {textureWidth:1024, textureHeight:1024, color:0x7d8896, clipBias:.003}), -.012); scene.add(reflector);
  const glassTop = lay(new THREE.Mesh(flatGeo(floorPts), DARK_GLASS), 0); glassTop.receiveShadow = true; scene.add(glassTop);
  outline(floorPts, .03, 0xc9a36a, 1.3, .7);
  // DPS platform: raised, polished
  { const b = new THREE.Mesh(slab(ARENA.platform, 1.48, 8), STONE); b.receiveShadow = true; b.castShadow = true; scene.add(b); }
  { const t = lay(new THREE.Mesh(flatGeo(ARENA.platform), PLAT_GLASS), 1.5); t.receiveShadow = true; scene.add(t); }
  outline(ARENA.platform, 1.53, 0xf2c46b, 2.2);
  const dpsGlowTex = new THREE.CanvasTexture(mkCanvas(128, (g,s) => { const gr = g.createRadialGradient(s/2,s/2,0,s/2,s/2,s/2); gr.addColorStop(0,'rgba(255,255,255,.9)'); gr.addColorStop(.6,'rgba(255,255,255,.25)'); gr.addColorStop(1,'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0,0,s,s); }));
  const dpsGlow = lay(new THREE.Mesh(new THREE.PlaneGeometry(11, 15), new THREE.MeshBasicMaterial({map:dpsGlowTex, color:hdr(0xdff4ef,.9), transparent:true, depthWrite:false, blending:THREE.AdditiveBlending})), 1.56);
  dpsGlow.position.x = V(DPS.x, DPS.y).x; dpsGlow.position.z = V(DPS.x, DPS.y).z; scene.add(dpsGlow);
  // plate level (sunken entrance area)
  { const b = new THREE.Mesh(slab(ARENA.lower, -2.53, 4), STONE); b.receiveShadow = true; scene.add(b); }
  { const t = lay(new THREE.Mesh(flatGeo(ARENA.lower), LOW_FLOOR), -2.5); t.receiveShadow = true; scene.add(t); }
  outline(ARENA.lower, -2.47, 0xc9a36a, 1, .5);
  // Atheon's dais
  { const b = new THREE.Mesh(slab(ARENA.dais, 3, 9), STONE); b.castShadow = true; b.receiveShadow = true; scene.add(b); }
  { const t = lay(new THREE.Mesh(flatGeo(ARENA.dais), PLAT_GLASS), 3.01); scene.add(t); }
  outline(ARENA.dais, 3.04, 0xdff4ef, 2);

  // walls along the outer edges (inner edges are level changes, drawn by the slabs)
  const isInner = p => Math.abs(p.y - 812.5) < .01 || ARENA.platform.some(q => q.x === p.x && q.y === p.y);
  function wallSeg(a, b, base, h, thick=.8){
    const A = V(a.x, a.y), B = V(b.x, b.y), len = A.distanceTo(B); if (len < .05) return;
    const m = new THREE.Mesh(new THREE.BoxGeometry(len, h, thick), STONE); m.position.set((A.x+B.x)/2, base + h/2, (A.z+B.z)/2); m.rotation.y = -Math.atan2(B.z-A.z, B.x-A.x); m.castShadow = true; m.receiveShadow = true; scene.add(m);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(len, .08, thick*.35), emis(0xc9a36a, 1.6)); cap.position.copy(m.position); cap.position.y = base + h + .04; cap.rotation.y = m.rotation.y; scene.add(cap);
  }
  [[ARENA.upper, 0, 3.4], [ARENA.lower, -2.5, 3.2]].forEach(([pts, base, h]) => { for (let i=0;i<pts.length;i++){ const a = pts[i], b = pts[(i+1) % pts.length]; if (isInner(a) && isInner(b)) continue; if (pts === ARENA.upper && a.y < 170 && b.y < 170) continue; wallSeg(a, b, pts === ARENA.upper ? Math.min(upperH(a.y), upperH(b.y)) : base, h); } });
  ARENA.walls.slice(-2).forEach(([a,b]) => wallSeg(a, b, 0, 2.6, .6));
  // obstacles
  ARENA.obstacles.forEach((o,i) => {
    const c = o.reduce((m, q) => ({x:m.x + q.x/o.length, y:m.y + q.y/o.length}), {x:0, y:0}), base = heightAt(c), h = i === 0 ? 3.4 : 2;
    const m = new THREE.Mesh(slab(o, base + h, h + .02), STONE); m.castShadow = true; m.receiveShadow = true; scene.add(m);
    outline(o, base + h + .02, 0xc9a36a, 1.4);
  });
  // stairs
  for (const s of ARENA.stairs){
    const A = V(s.a.x, s.a.y), B = V(s.b.x, s.b.y), len = A.distanceTo(B), n = s.deco ? 6 : 9, yaw = -Math.atan2(B.z-A.z, B.x-A.x), w = s.w/10;
    for (let k=0;k<n;k++){
      const t = (k + .5)/n, top = s.deco ? .14*((k+1) % 2) + .02 : s.h0 + (s.h1 - s.h0)*t, bottom = Math.min(s.h0, s.h1) - .2, h = Math.max(.06, top - bottom);
      const st = new THREE.Mesh(new THREE.BoxGeometry(len/n*1.02, h, w), STONE); st.position.set(A.x + (B.x-A.x)*t, bottom + h/2, A.z + (B.z-A.z)*t); st.rotation.y = yaw; st.receiveShadow = true; st.castShadow = !s.deco; scene.add(st);
      const nose = new THREE.Mesh(new THREE.BoxGeometry(.06, .05, w*.96), emis(0xc9a36a, 1.3)); nose.position.copy(st.position); nose.position.y = top + .03; nose.rotation.y = yaw; scene.add(nose);
    }
  }
  // teleport spawn
  { const ring = lay(new THREE.Mesh(new THREE.RingGeometry(2.6, 3, 6), emis(0xf2c46b, 2.2)), heightAt(TELEPORT_SPAWN) + .05); const w = V(TELEPORT_SPAWN.x, TELEPORT_SPAWN.y); ring.position.x = w.x; ring.position.z = w.z; scene.add(ring);
    const fill = lay(new THREE.Mesh(new THREE.PlaneGeometry(9, 3.4), new THREE.MeshBasicMaterial({map:dpsGlowTex, color:hdr(0xf2c46b,.7), transparent:true, depthWrite:false, blending:THREE.AdditiveBlending})), heightAt(TELEPORT_SPAWN) + .06); fill.position.x = w.x; fill.position.z = w.z; scene.add(fill); }
  // rally banner at the entrance
  { const w = V(BANNER.x, BANNER.y, -2.5);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(.08, .08, 4.2, 8), BRASS); pole.position.set(w.x, w.y + 2.1, w.z); pole.castShadow = true; scene.add(pole);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 2.2), new THREE.MeshStandardMaterial({color:0x2a2216, roughness:.9, side:THREE.DoubleSide, emissive:0xf2c46b, emissiveIntensity:.05})); flag.position.set(w.x + .85, w.y + 2.9, w.z); scene.add(flag);
    const sig = new THREE.Mesh(new THREE.RingGeometry(.35, .48, 6), emis(0xf2c46b, 2.4)); sig.position.set(w.x + .85, w.y + 3, w.z + .02); scene.add(sig);
    const pad = lay(new THREE.Mesh(new THREE.RingGeometry(1.2, 1.4, 32), emis(0xf2c46b, 1.6)), w.y + .04); pad.position.x = w.x; pad.position.z = w.z; scene.add(pad); }

  // Vex circuitry etched into the main floor
  {
    const pts = [], c = V(MID.x, MID.y);
    const ok = (x,z) => { const sp = toSim({x, z}); return sp.y > HALL.floor + 2 && pip(sp, ARENA.upper) && !ARENA.obstacles.some(o => pip(sp, o)) && dist(sp, ATHEON) > 30; };
    const seg = (ax,az,bx,bz) => { const n = 24; for (let i=0;i<n;i++){ const t1 = i/n, t2 = (i+1)/n, px = ax+(bx-ax)*t1, pz = az+(bz-az)*t1, qx = ax+(bx-ax)*t2, qz = az+(bz-az)*t2; if (ok(px,pz) && ok(qx,qz)) pts.push(px,.02,pz,qx,.02,qz); } };
    for (let r = 6; r < 60; r += 5.5) for (let k=0;k<8;k++){ const a1 = k/8*Math.PI*2 + Math.PI/8, a2 = (k+1)/8*Math.PI*2 + Math.PI/8; seg(c.x+Math.cos(a1)*r, c.z+Math.sin(a1)*r, c.x+Math.cos(a2)*r, c.z+Math.sin(a2)*r); }
    for (let k=0;k<16;k++){ const a = k/16*Math.PI*2 + Math.PI/16; seg(c.x+Math.cos(a)*4, c.z+Math.sin(a)*4, c.x+Math.cos(a)*80, c.z+Math.sin(a)*80); }
    let seed = 7; const rnd = () => (seed = (seed*16807) % 2147483647) / 2147483647;
    for (let i=0;i<70;i++){ let x = -26 + rnd()*56, z = -40 + rnd()*66; for (let s2=0;s2<4;s2++){ const horiz = rnd() < .5, nx = horiz ? x + (rnd()<.5?-1:1)*(1.5+rnd()*4) : x, nz = horiz ? z : z + (rnd()<.5?-1:1)*(1.5+rnd()*4); seg(x,z,nx,nz); x = nx; z = nz; } }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts,3));
    scene.add(new THREE.LineSegments(g, new THREE.LineBasicMaterial({color:hdr(0xc9a36a,1.2), transparent:true, opacity:.28})));
  }

  // ---------- light shafts + low fog ----------
  const shafts = [];
  function shaft(x, y, rTop, rBot, h, c, i, base=0){
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, h, 32, 1, true), new THREE.ShaderMaterial({
      transparent:true, depthWrite:false, blending:THREE.AdditiveBlending, side:THREE.DoubleSide,
      uniforms:{uCol:{value:hdr(c,i)}, uT:{value:0}},
      vertexShader:`varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main(){ vUv = uv; vec4 mv = modelViewMatrix*vec4(position,1.); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }`,
      fragmentShader:`uniform vec3 uCol; uniform float uT; varying vec2 vUv; varying vec3 vN; varying vec3 vV;
        void main(){ float e = pow(abs(dot(normalize(vN),normalize(vV))),1.8); float a = e*pow(vUv.y,1.6)*(.75+.25*sin(uT*.6+vUv.y*7.+vUv.x*20.))*.03; gl_FragColor = vec4(uCol*a,1.); }`,
    }));
    m.position.copy(V(x, y, base + h/2)); scene.add(m); shafts.push(m); return m;
  }
  shaft(DPS.x, DPS.y, 3, 9, 64, 0xdff4ef, 1.3, 1.5);
  shaft(ATHEON.x, ATHEON.y, 2.5, 9, 70, 0xdff4ef, 1.0);
  shaft(TELEPORT_SPAWN.x, TELEPORT_SPAWN.y, 1.5, 5, 50, 0xf2c46b, .7, heightAt(TELEPORT_SPAWN));
  const roomShaft = shaft(ROOM.x, ROOM.y, 3, 14, 60, 0xb6c95a, 0);
  const fogLayers = [];
  for (let i=0;i<3;i++){
    const m = new THREE.Mesh(new THREE.PlaneGeometry(170, 140), new THREE.MeshBasicMaterial({map:fogTex.clone(), color:hdr(i%2 ? 0x9fb4cc : 0xdff4ef, .35), transparent:true, opacity:.06, depthWrite:false, blending:THREE.AdditiveBlending}));
    m.material.map.wrapS = m.material.map.wrapT = THREE.RepeatWrapping; m.material.map.repeat.set(2.6,2.2);
    m.rotation.x = -Math.PI/2; m.position.set(15, -1.5 + i*1.1, -2); scene.add(m); fogLayers.push(m);
  }

  // ---------- spires ----------
  const spires = [];
  [M(522,470), M(932,470), M(565,860), M(890,850), M(225,1185), M(1298,985), M(212,1600), M(1228,1600)].forEach((pt,i) => {
    const g = new THREE.Group(); g.position.copy(V(pt.x, pt.y, upperH(pt.y)));
    const h = 10 + (i%3)*3;
    const col = new THREE.Mesh(new THREE.CylinderGeometry(.9, 1.4, h, 6), STONE); col.position.y = h/2; col.castShadow = true; col.receiveShadow = true; g.add(col);
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.15, .5, 6), BRASS); collar.position.y = h*.62; g.add(collar);
    for (let k=0;k<3;k++){ const strip = new THREE.Mesh(new THREE.BoxGeometry(.1, h*.86, .1), emis(0xdff4ef, 2.2)); const a = k/3*Math.PI*2 + Math.PI/6; strip.position.set(Math.cos(a)*1.02, h*.47, Math.sin(a)*1.02); g.add(strip); }
    const cap = new THREE.Mesh(new THREE.OctahedronGeometry(.75), emis(0xdff4ef, 2.2)); cap.position.y = h + 1.4; g.add(cap);
    const capGlow = new THREE.Mesh(new THREE.SphereGeometry(1.6, 16, 12), fresnel(0xdff4ef, .45, 2, 0)); capGlow.position.y = h + 1.4; g.add(capGlow);
    scene.add(g); spires.push({cap, capGlow, h});
  });
  const platGlyph = lay(new THREE.Mesh(new THREE.RingGeometry(2, 2.3, 6), emis(0xdff4ef, 2)), 1.58); platGlyph.position.x = V(DPS.x, DPS.y).x; platGlyph.position.z = V(DPS.x, DPS.y).z; scene.add(platGlyph);
  platGlyph.rotation.order = 'YXZ';

  // ---------- sync plates (plate level) + transfer gates ----------
  const plateFx = {};
  for (const k of ['mars','venus']){
    const pl = PLATES[k], gt = GATES[k];
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(pl.r/10, pl.r/10 + .2, .35, 40), STONE); disc.position.copy(V(pl.x, pl.y, -2.5 + .17)); disc.receiveShadow = true; scene.add(disc);
    const ringM = emis(pl.color, 1);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(pl.r/10 - .25, .11, 6, 48), ringM); ring.rotation.x = Math.PI/2; ring.position.copy(V(pl.x, pl.y, -2.5 + .37)); scene.add(ring);
    const fillM = new THREE.MeshBasicMaterial({color:hdr(pl.color, .6), transparent:true, opacity:.25, depthWrite:false, blending:THREE.AdditiveBlending});
    const fill = lay(new THREE.Mesh(new THREE.CircleGeometry(pl.r/10 - .3, 40), fillM), -2.5 + .36); fill.position.x = ring.position.x; fill.position.z = ring.position.z; scene.add(fill);
    // gate ring standing on its tilted axis, as drawn on the map
    const gate = new THREE.Group(); gate.position.copy(V(gt.x, gt.y, 0)); gate.rotation.y = -gt.ang; scene.add(gate);
    const ringR = 4.6;
    const arch = new THREE.Mesh(new THREE.TorusGeometry(ringR, .42, 10, 64), BRASS); arch.position.y = ringR*1.08; arch.scale.y = 1.12; arch.castShadow = true; gate.add(arch);
    const archGlowM = emis(pl.color, 1);
    const archGlow = new THREE.Mesh(new THREE.TorusGeometry(ringR - .25, .1, 6, 64), archGlowM); archGlow.position.y = arch.position.y; archGlow.scale.y = 1.12; gate.add(archGlow);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(3, .6, 1.4), BRASS_DARK); foot.position.y = .3; gate.add(foot);
    const sheetMat = new THREE.ShaderMaterial({
      transparent:true, depthWrite:false, blending:THREE.AdditiveBlending, side:THREE.DoubleSide,
      uniforms:{uCol:{value:new THREE.Color(pl.color)}, uT:{value:0}, uOpen:{value:0}},
      vertexShader:`varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
      fragmentShader:`uniform vec3 uCol; uniform float uT,uOpen; varying vec2 vUv;
        void main(){ vec2 p = vUv-.5; float r = length(p)*2.; float a = atan(p.y,p.x);
          float sw = sin(a*5.+r*12.-uT*3.)*.5+.5; float sw2 = sin(a*9.-r*7.+uT*2.)*.5+.5; float n = (sw*.6+sw2*.4)*(1.-r*.6);
          float alpha = uOpen*(.18+.82*n)*smoothstep(1.,.86,r); gl_FragColor = vec4(uCol*(.6+2.6*n)*alpha,1.); }`,
    });
    const sheet = new THREE.Mesh(new THREE.CircleGeometry(ringR - .3, 64), sheetMat); sheet.position.y = arch.position.y; sheet.scale.y = 1.12; gate.add(sheet);
    plateFx[k] = {ringM, archGlowM, sheetMat, fillM};
  }

  // ---------- Atheon: Vex Minotaur rig ----------
  const ath = new THREE.Group(); ath.position.copy(V(ATHEON.x, ATHEON.y, 0)); ath.scale.setScalar(.95); scene.add(ath);
  ath.rotation.y = 0;  // faces the DPS platform and the entrance (+Z)
  const throne = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.9, .25, 6), GLASS); throne.position.y = .12; throne.receiveShadow = true; ath.add(throne);
  const throneRim = new THREE.Mesh(new THREE.TorusGeometry(2.8, .1, 6, 6), emis(0xdff4ef, 2.2)); throneRim.rotation.x = Math.PI/2; throneRim.rotation.z = Math.PI/6; throneRim.position.y = .27; ath.add(throneRim);
  const body = new THREE.Group(); body.position.y = .55; ath.add(body);
  const shadowAll = o => o.traverse(m => { if (m.isMesh){ m.castShadow = true; } });
  const LEG = [-1,1].map(s => {
    const hip = new THREE.Group(); hip.position.set(s*1.7, 6.3, 0); body.add(hip);
    const thigh = new THREE.Mesh(new THREE.CylinderGeometry(.95, .6, 3.6, 6), BRASS); thigh.position.y = -1.8; hip.add(thigh);
    const knee = new THREE.Group(); knee.position.y = -3.6; hip.add(knee);
    const kneeCap = new THREE.Mesh(new THREE.DodecahedronGeometry(.75, 0), BRASS_DARK); knee.add(kneeCap);
    const shin = new THREE.Mesh(new THREE.CylinderGeometry(.5, .8, 3.4, 6), BRASS); shin.position.y = -1.7; knee.add(shin);
    const ankle = new THREE.Group(); ankle.position.y = -3.4; knee.add(ankle);
    const foot = new THREE.Mesh(new THREE.ConeGeometry(.7, 2.2, 4), BRASS_DARK); foot.rotation.x = Math.PI/2; foot.position.z = .7; ankle.add(foot);
    hip.rotation.x = -.3; knee.rotation.x = .75; ankle.rotation.x = -.45; hip.rotation.z = s*.08;
    return {hip, knee};
  });
  const pelvis = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 1.7, 1.6, 6), BRASS); pelvis.position.y = 6.5; body.add(pelvis);
  const chestG = new THREE.Group(); chestG.position.y = 6.9; body.add(chestG);
  for (let k=0;k<6;k++){ const a = k/6*Math.PI*2; const bar = new THREE.Mesh(new THREE.CylinderGeometry(.22, .3, 4.8, 5), BRASS); bar.position.set(Math.cos(a)*2.25, 2.4, Math.sin(a)*2.25); bar.rotation.z = Math.cos(a)*-.12; bar.rotation.x = Math.sin(a)*.12; chestG.add(bar); }
  const chestTop = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 2.6, 1.7, 6), BRASS); chestTop.position.y = 5.4; chestG.add(chestTop);
  const chestBot = new THREE.Mesh(new THREE.TorusGeometry(2.3, .32, 6, 6), BRASS_DARK); chestBot.rotation.x = Math.PI/2; chestBot.position.y = .1; chestG.add(chestBot);
  const coreMat = milky(0xdff4ef, 2);
  const core = new THREE.Mesh(new THREE.SphereGeometry(1.65, 32, 20), coreMat); core.position.y = 2.6; chestG.add(core);
  const coreHalo = new THREE.Mesh(new THREE.SphereGeometry(2.3, 24, 16), fresnel(0xdff4ef, 1.2, 1.6, .05)); coreHalo.position.y = 2.6; chestG.add(coreHalo);
  const ARM = [-1,1].map(s => {
    const pad = new THREE.Mesh(new THREE.DodecahedronGeometry(1.6, 0), BRASS); pad.position.set(s*3.5, 5.5, 0); pad.scale.set(1.1,.8,1); chestG.add(pad);
    const sh = new THREE.Group(); sh.position.set(s*3.7, 5.1, 0); chestG.add(sh);
    const upper = new THREE.Mesh(new THREE.CylinderGeometry(.62, .45, 4.2, 6), BRASS); upper.position.y = -2.1; sh.add(upper);
    const el = new THREE.Group(); el.position.y = -4.2; sh.add(el);
    const elbow = new THREE.Mesh(new THREE.DodecahedronGeometry(.6, 0), BRASS_DARK); el.add(elbow);
    const fore = new THREE.Mesh(new THREE.CylinderGeometry(.5, .35, 4, 6), BRASS); fore.position.y = -2; el.add(fore);
    for (let c=0;c<3;c++){ const cl = new THREE.Mesh(new THREE.ConeGeometry(.16, 1.1, 4), BRASS_DARK); cl.position.set((c-1)*.28, -4.4, .1); cl.rotation.x = Math.PI; el.add(cl); }
    sh.rotation.z = s*.32; el.rotation.x = -.35;
    return {sh, el, s};
  });
  const headG = new THREE.Group(); headG.position.y = 7.2; chestG.add(headG);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(.55, .85, 1.4, 6), BRASS_DARK); neck.position.y = -.2; headG.add(neck);
  const head = new THREE.Mesh(new THREE.ConeGeometry(2.1, 4.8, 3), BRASS); head.position.set(0, 1.8, .2); head.rotation.x = .5; head.rotation.y = Math.PI; headG.add(head);
  const crest = new THREE.Mesh(new THREE.BoxGeometry(.25, 3.4, 4.2), BRASS_DARK); crest.position.set(0, 2.8, -1.6); crest.rotation.x = -.5; headG.add(crest);
  const halo = new THREE.Mesh(new THREE.TorusGeometry(3.6, .1, 6, 40, Math.PI*1.15), emis(0xdff4ef, 2.2)); halo.position.set(0, 2.2, -1.9); halo.rotation.z = -Math.PI*.075; headG.add(halo);
  const eyeM = emis(0xff3a2a, 6);
  const eye = new THREE.Mesh(new THREE.SphereGeometry(.42, 16, 12), eyeM); eye.position.set(0, 1.3, 1.95); headG.add(eye);
  const eyeGlow = new THREE.Mesh(new THREE.SphereGeometry(.9, 16, 12), fresnel(0xff3a2a, 1.5, 1.3, .1)); eyeGlow.position.copy(eye.position); headG.add(eyeGlow);
  shadowAll(body);
  [coreHalo, eyeGlow, halo].forEach(m => m.castShadow = false);

  // ---------- Oracles ----------
  const mkOracle = (tint) => {
    const g = new THREE.Group();
    const mat = milky(0xffffff, .3), s = new THREE.Mesh(new THREE.SphereGeometry(.85, 24, 16), mat);
    const ringM = emis(tint, 1), ring = new THREE.Mesh(new THREE.TorusGeometry(1.35, .055, 6, 48), ringM);
    const ring2 = new THREE.Mesh(new THREE.TorusGeometry(1.1, .035, 6, 48), ringM); ring2.rotation.y = Math.PI/2;
    const glowM = fresnel(tint, 0, 1.6, .05), glw = new THREE.Mesh(new THREE.SphereGeometry(1.6, 16, 12), glowM);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(.45, .7, .35, 6), BRASS_DARK); base.position.y = -3.3;
    g.add(s, ring, ring2, glw, base); g.userData = {mat, ring, ring2, ringM, glowM}; return g;
  };
  const vOr = VORC.map(o => { const g = mkOracle(0xdff4ef); g.position.copy(V(o.x, o.y, 4 + heightAt(o))); g.userData.base = 4 + heightAt(o); scene.add(g); return g; });

  // ---------- time-gate chamber ----------
  const room = new THREE.Group(); room.position.copy(V(ROOM.x, ROOM.y)); scene.add(room);
  const roomTopMat = new THREE.MeshPhysicalMaterial({color:0x121410, roughness:.35, metalness:.35, clearcoat:.7, clearcoatRoughness:.35, emissive:0xb6c95a, emissiveIntensity:0, envMapIntensity:.8});
  const roomTop = new THREE.Mesh(new THREE.CylinderGeometry(ROOM.r/10, ROOM.r/10 - .5, 2.4, 64), [STONE, roomTopMat, STONE]); roomTop.position.y = -1.2; roomTop.receiveShadow = true; room.add(roomTop);
  const roomRock = new THREE.Mesh(new THREE.ConeGeometry(ROOM.r/10 - .5, 24, 9), STONE); roomRock.rotation.x = Math.PI; roomRock.position.y = -14.4; room.add(roomRock);
  const roomRingM = emis(0x555a60, 1);
  const roomRing = new THREE.Mesh(new THREE.TorusGeometry(ROOM.r/10, .16, 6, 96), roomRingM); roomRing.rotation.x = Math.PI/2; roomRing.position.y = .03; room.add(roomRing);
  for (let k=0;k<6;k++){ const a = k/6*Math.PI*2; const p = new THREE.Mesh(new THREE.CylinderGeometry(.5, .7, 5, 6), BRASS_DARK); p.position.set(Math.cos(a)*(ROOM.r/10 - .4), 2.5, Math.sin(a)*(ROOM.r/10 - .4)); p.castShadow = true; room.add(p); }
  const atmoMat = fresnel(0xb6c95a, 0, 3.2, 0); atmoMat.side = THREE.FrontSide;
  const atmo = new THREE.Mesh(new THREE.SphereGeometry(ROOM.r/10 + 2, 48, 24, 0, Math.PI*2, 0, Math.PI/2), atmoMat); room.add(atmo);
  const veilMat = new THREE.MeshBasicMaterial({color:0x020304, transparent:true, opacity:0, depthWrite:false});
  const roomVeil = new THREE.Mesh(new THREE.CylinderGeometry(ROOM.r/10 + .7, ROOM.r/10 + .7, 10, 64, 1, true), veilMat); roomVeil.position.y = 4.9; room.add(roomVeil);
  const roomCap = new THREE.Mesh(new THREE.CircleGeometry(ROOM.r/10 + .7, 64), veilMat); roomCap.rotation.x = -Math.PI/2; roomCap.position.y = 9.9; room.add(roomCap);
  const cOr = CORC.map(o => { const g = mkOracle(0xff6a55); g.position.copy(V(o.x, o.y, 3.4)); g.visible = false; scene.add(g); return g; });
  const relicMesh = new THREE.Group();
  { const sh = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, .22, 6), new THREE.MeshStandardMaterial({color:0xf2c46b, metalness:1, roughness:.25, emissive:0xf2c46b, emissiveIntensity:1.3})); sh.rotation.x = Math.PI/2; relicMesh.add(sh);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(1.22, .07, 6, 6), emis(0xffffff, 3)); relicMesh.add(rim);
    const gl = new THREE.Mesh(new THREE.SphereGeometry(1.8, 16, 12), fresnel(0xf2c46b, 1.2, 1.4, .08)); relicMesh.add(gl); }
  relicMesh.visible = false; scene.add(relicMesh);
  const domeMat = fresnel(0xf2c46b, .9, 2.4, .015);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(12, 48, 24, 0, Math.PI*2, 0, Math.PI/2), domeMat);
  const domeRing = new THREE.Mesh(new THREE.TorusGeometry(12, .08, 6, 96), emis(0xf2c46b, 2.5)); domeRing.rotation.x = Math.PI/2; dome.add(domeRing);
  dome.visible = false; scene.add(dome);

  // ---------- radiolaria motes ----------
  const motes = (() => { const g = new THREE.BufferGeometry(), n = 420, a = new Float32Array(n*3);
    for (let i=0;i<n;i++){ a[i*3] = -26 + Math.random()*58; a[i*3+1] = Math.random()*16; a[i*3+2] = -44 + Math.random()*84; }
    g.setAttribute('position', new THREE.BufferAttribute(a,3));
    const m = new THREE.Points(g, new THREE.PointsMaterial({color:hdr(0xdff4ef,1.6), size:.45, map:spriteTex, transparent:true, depthWrite:false, blending:THREE.AdditiveBlending}));
    scene.add(m); return m; })();

  // ---------- particles (pooled, additive) ----------
  const MAXP = 5000, pPos = new Float32Array(MAXP*3), pCol = new Float32Array(MAXP*3), pSize = new Float32Array(MAXP), pAlpha = new Float32Array(MAXP);
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos,3).setUsage(THREE.DynamicDrawUsage));
  pGeo.setAttribute('aColor', new THREE.BufferAttribute(pCol,3).setUsage(THREE.DynamicDrawUsage));
  pGeo.setAttribute('aSize', new THREE.BufferAttribute(pSize,1).setUsage(THREE.DynamicDrawUsage));
  pGeo.setAttribute('aAlpha', new THREE.BufferAttribute(pAlpha,1).setUsage(THREE.DynamicDrawUsage));
  const pMat = new THREE.ShaderMaterial({
    transparent:true, depthWrite:false, blending:THREE.AdditiveBlending,
    uniforms:{uMap:{value:spriteTex}, uScale:{value:400}},
    vertexShader:`attribute vec3 aColor; attribute float aSize; attribute float aAlpha; uniform float uScale; varying vec3 vC; varying float vA;
      void main(){ vC = aColor; vA = aAlpha; vec4 mv = modelViewMatrix*vec4(position,1.); gl_PointSize = aSize*uScale/-mv.z; gl_Position = projectionMatrix*mv; }`,
    fragmentShader:`uniform sampler2D uMap; varying vec3 vC; varying float vA; void main(){ float t = texture2D(uMap, gl_PointCoord).a; gl_FragColor = vec4(vC*t*vA,1.); }`,
  });
  const pts = new THREE.Points(pGeo, pMat); pts.frustumCulled = false; scene.add(pts);
  const parts = [];
  function emit(n, at, o){
    for (let i=0;i<n && parts.length < MAXP;i++){
      const th = Math.random()*Math.PI*2, ph = (o.flat ? Math.PI/2 + (Math.random()-.5)*.2 : Math.acos(1 - Math.random()*(o.hemi ? 1 : 2)));
      const dir = new THREE.Vector3(Math.sin(ph)*Math.cos(th), Math.cos(ph), Math.sin(ph)*Math.sin(th));
      const sp = o.speed*(.4 + Math.random()*.8), c = (Math.random() < .5 ? o.c1 : (o.c2 || o.c1));
      const p = {x:at.x, y:at.y, z:at.z, vx:dir.x*sp, vy:dir.y*sp + (o.up||0), vz:dir.z*sp, life:0, max:o.life*(.6 + Math.random()*.7), size:o.size*(.6 + Math.random()*.8), r:c.r, g:c.g, b:c.b, drag:o.drag||1, grav:o.grav||0};
      if (o.implode){ p.x += dir.x*o.implode; p.y += dir.y*o.implode*.6 + o.implode*.4; p.z += dir.z*o.implode; p.vx = -dir.x*o.implode/p.max; p.vy = -(dir.y*o.implode*.6 + o.implode*.4)/p.max; p.vz = -dir.z*o.implode/p.max; p.drag = 0; p.grav = 0; }
      parts.push(p);
    }
  }
  function stepParticles(dt){
    let n = 0;
    for (let i=parts.length-1;i>=0;i--){
      const p = parts[i]; p.life += dt;
      if (p.life >= p.max){ parts[i] = parts[parts.length-1]; parts.pop(); continue; }
      const d = Math.exp(-p.drag*dt); p.vx *= d; p.vy = p.vy*d + p.grav*dt; p.vz *= d;
      p.x += p.vx*dt; p.y += p.vy*dt; p.z += p.vz*dt; if (p.y < .05){ p.y = .05; p.vy *= -.3; }
      const k = p.life/p.max, a = k < .1 ? k/.1 : 1 - (k-.1)/.9;
      pPos[n*3] = p.x; pPos[n*3+1] = p.y; pPos[n*3+2] = p.z; pCol[n*3] = p.r; pCol[n*3+1] = p.g; pCol[n*3+2] = p.b; pSize[n] = p.size; pAlpha[n] = a; n++;
    }
    pGeo.setDrawRange(0, n);
    for (const k of ['position','aColor','aSize','aAlpha']) pGeo.attributes[k].needsUpdate = true;
  }
  const C = (c, i) => hdr(c, i);

  // ---------- Guardians: shaped rigs with walk and aim ----------
  const tagsEl = $('tags');
  function makeGuardian(p){
    const col = new THREE.Color(p.color);
    const armor = new THREE.MeshStandardMaterial({color:col.clone().lerp(new THREE.Color(0x9aa3ad), .5), metalness:.7, roughness:.4, normalMap:hammer, normalScale:new THREE.Vector2(.18,.18), envMapIntensity:1.1});
    const suit = new THREE.MeshStandardMaterial({color:0x22262d, roughness:.85, metalness:.05});
    const root = new THREE.Group(); root.scale.setScalar(1.75);
    const hips = new THREE.Group(); hips.position.y = 1.05; root.add(hips);
    const legs = [-1,1].map(s => {
      const hip = new THREE.Group(); hip.position.set(s*.2, 0, 0); hips.add(hip);
      const thigh = new THREE.Mesh(new THREE.CylinderGeometry(.16, .13, .55, 8), suit); thigh.position.y = -.27; hip.add(thigh);
      const knee = new THREE.Group(); knee.position.y = -.55; hip.add(knee);
      const pad = new THREE.Mesh(new THREE.SphereGeometry(.1, 8, 6), armor); pad.position.z = .07; knee.add(pad);
      const shin = new THREE.Mesh(new THREE.CylinderGeometry(.14, .11, .48, 8), armor); shin.position.y = -.24; knee.add(shin);
      const boot = new THREE.Mesh(new THREE.BoxGeometry(.19, .12, .34), armor); boot.position.set(0, -.5, .06); knee.add(boot);
      return {hip, knee};
    });
    const torso = new THREE.Group(); torso.position.y = 1.05; root.add(torso);
    const belly = new THREE.Mesh(new THREE.CylinderGeometry(.27, .24, .3, 8), suit); belly.position.y = .12; torso.add(belly);
    const chest = new THREE.Mesh(new THREE.CylinderGeometry(.37, .27, .5, 8), armor); chest.position.y = .47; chest.scale.z = .72; torso.add(chest);
    const belt = new THREE.Mesh(new THREE.TorusGeometry(.26, .04, 6, 16), emis(col, 1.4)); belt.rotation.x = Math.PI/2; belt.position.y = .0; torso.add(belt);
    const arms = [-1,1].map(s => {
      const pad = new THREE.Mesh(new THREE.SphereGeometry(.17, 10, 8), armor); pad.position.set(s*.42, .66, 0); pad.scale.set(1.15, .8, 1); torso.add(pad);
      const sh = new THREE.Group(); sh.position.set(s*.42, .6, 0); torso.add(sh);
      const up = new THREE.Mesh(new THREE.CylinderGeometry(.085, .075, .4, 8), suit); up.position.y = -.2; sh.add(up);
      const el = new THREE.Group(); el.position.y = -.4; sh.add(el);
      const fore = new THREE.Mesh(new THREE.CylinderGeometry(.09, .07, .36, 8), armor); fore.position.y = -.18; el.add(fore);
      return {sh, el, s};
    });
    const gun = new THREE.Group(); gun.position.set(0, -.36, .06); arms[1].el.add(gun);
    const gunBody = new THREE.Mesh(new THREE.BoxGeometry(.09, .13, .6), new THREE.MeshStandardMaterial({color:0x2b2f36, metalness:.8, roughness:.35})); gunBody.position.z = .22; gunBody.rotation.x = Math.PI/2; gun.add(gunBody);
    const muzzle = new THREE.Sprite(new THREE.SpriteMaterial({map:spriteTex, color:hdr(0xffd08a, 6), blending:THREE.AdditiveBlending, depthWrite:false, transparent:true})); muzzle.scale.setScalar(.6); muzzle.position.set(0, -.55, 0); gun.add(muzzle); muzzle.visible = false;
    const headG = new THREE.Group(); headG.position.y = .9; torso.add(headG);
    const helm = new THREE.Mesh(new THREE.SphereGeometry(.19, 18, 14), armor); helm.scale.set(1, 1.12, 1.08); headG.add(helm);
    const visor = new THREE.Mesh(new THREE.BoxGeometry(.25, .055, .06), emis(col, 3.2)); visor.position.set(0, .02, .18); headG.add(visor);
    const cloakG = new THREE.PlaneGeometry(.62, .95, 2, 6); const cp = cloakG.attributes.position;
    for (let i=0;i<cp.count;i++){ const y = cp.getY(i); cp.setZ(i, -.05 - (.45 - y)*(.45 - y)*.35); }
    cloakG.computeVertexNormals();
    const cloak = new THREE.Mesh(cloakG, new THREE.MeshStandardMaterial({color:0x1b1f26, roughness:.9, side:THREE.DoubleSide})); cloak.position.set(0, .2, -.2); torso.add(cloak);
    const trim = new THREE.Mesh(new THREE.BoxGeometry(.62, .03, .02), emis(col, 2)); trim.position.set(0, -.27, -.27); torso.add(trim);
    const ringM = new THREE.MeshBasicMaterial({color:hdr(col,1.6), transparent:true, opacity:.85, side:THREE.DoubleSide, depthWrite:false});
    const ring = new THREE.Mesh(new THREE.RingGeometry(.55, .66, 40), ringM); ring.rotation.x = -Math.PI/2; ring.position.y = .03; root.add(ring);
    root.traverse(m => { if (m.isMesh && m !== ring) m.castShadow = true; });
    const bubble = new THREE.Mesh(new THREE.SphereGeometry(1.25, 32, 20), fresnel(0xbff3ff, 1.8, 1.8, .06)); bubble.position.y = 1.1; bubble.visible = false; root.add(bubble);
    const markM = new THREE.MeshBasicMaterial({color:hdr(0xff4a3a, 2), transparent:true, opacity:.7, side:THREE.DoubleSide, depthWrite:false});
    const mark = new THREE.Mesh(new THREE.RingGeometry(10.8/1.75, 11/1.75, 96), markM); mark.rotation.x = -Math.PI/2; mark.position.y = .06; mark.visible = false; root.add(mark);
    scene.add(root);
    const tag = document.createElement('div'); tag.className = 'tag'; tagsEl.appendChild(tag);
    return {root, hips, legs, arms, torso, headG, muzzle, ringM, bubble, mark, markM, tag, phase:Math.random()*6, yaw:0, lx:p.x, ly:p.y, aimT:0, hh:0};
  }
  const G = S.players.map(makeGuardian);
  const youBeam = new THREE.Mesh(new THREE.CylinderGeometry(.06, .06, 30, 6, 1, true), new THREE.MeshBasicMaterial({color:hdr(0xffffff,1.5), transparent:true, opacity:.2, blending:THREE.AdditiveBlending, depthWrite:false})); youBeam.visible = false; scene.add(youBeam);
  const tapMark = new THREE.Mesh(new THREE.RingGeometry(.5, .7, 32), new THREE.MeshBasicMaterial({color:hdr(0xffffff,1.5), transparent:true, opacity:.7, side:THREE.DoubleSide})); tapMark.rotation.x = -Math.PI/2; tapMark.visible = false; scene.add(tapMark);
  const mkNum = (o, i, h) => { const d = document.createElement('div'); d.className = 'otag'; d.textContent = i+1; tagsEl.appendChild(d); return {d, v:V(o.x, o.y, h)}; };
  const vNums = VORC.map((o,i) => mkNum(o, i, 6.6 + heightAt(o))), cNums = CORC.map((o,i) => mkNum(o, i, 5.8));

  // ---------- Supplicants (Harpies) ----------
  const supMeshes = new Map();
  function supMesh(e){
    let m = supMeshes.get(e.id); if (m) return m;
    m = new THREE.Group();
    const bodyM = new THREE.Mesh(new THREE.OctahedronGeometry(1, 0), BRASS); bodyM.scale.set(1.05, .38, 1.25); m.add(bodyM);
    const dome2 = new THREE.Mesh(new THREE.SphereGeometry(.45, 12, 8, 0, Math.PI*2, 0, Math.PI/2), BRASS_DARK); dome2.position.y = .2; m.add(dome2);
    const ey = new THREE.Mesh(new THREE.SphereGeometry(.2, 10, 8), emis(0xff3a2a, 7)); ey.position.set(0, .05, 1.05); m.add(ey);
    const core2 = new THREE.Mesh(new THREE.SphereGeometry(.28, 12, 10), emis(0xff6a3a, 3)); core2.position.y = -.2; m.add(core2);
    const tents = [];
    for (let k=0;k<3;k++){ const t = new THREE.Mesh(new THREE.CylinderGeometry(.05, .02, 1.4, 4), BRASS_DARK); const a = k/3*Math.PI*2; const pv = new THREE.Group(); pv.position.set(Math.cos(a)*.4, -.2, Math.sin(a)*.4 - .3); t.position.y = -.7; pv.add(t); m.add(pv); tents.push(pv); }
    [-1,1].forEach(s => { const fin = new THREE.Mesh(new THREE.BoxGeometry(1.1, .05, .5), BRASS); fin.position.set(s*1, 0, -.2); fin.rotation.z = s*.25; m.add(fin); });
    m.traverse(o => { if (o.isMesh) o.castShadow = true; });
    m.scale.setScalar(.9); m.userData = {tents};
    scene.add(m); supMeshes.set(e.id, m); SFX.screech(); return m;
  }

  // ---------- tracers ----------
  const trPos = new Float32Array(12*6), trGeo = new THREE.BufferGeometry(); trGeo.setAttribute('position', new THREE.BufferAttribute(trPos,3));
  const tracers = new THREE.LineSegments(trGeo, new THREE.LineBasicMaterial({color:hdr(0xffe2b0,2.2), transparent:true, opacity:.55, blending:THREE.AdditiveBlending})); tracers.frustumCulled = false; scene.add(tracers);

  // ---------- one-shot effects ----------
  const fxObjs = []; let shake = 0;
  function ringFx(p, c, i, grow, life, y=p.y + .3){ const m = new THREE.Mesh(new THREE.TorusGeometry(1, .14, 6, 64), new THREE.MeshBasicMaterial({color:hdr(c,i), transparent:true, opacity:1, blending:THREE.AdditiveBlending, depthWrite:false})); m.rotation.x = Math.PI/2; m.position.copy(p); m.position.y = y; scene.add(m); fxObjs.push({m, t:0, life, ring:grow}); }
  function flashAt(p, c, i){ flash.position.copy(p); flash.position.y += 3; flash.color.set(c); flash.intensity = i; }
  function spawnFx(f){
    const p = V(f.x, f.y, f.x < SIM_W ? heightAt(f) : 0);
    if (f.type==='boom'){
      emit(90, p.clone().setY(p.y + 3), {speed:16, life:.9, size:.9, c1:C(0xff8a3a,4), c2:C(0xffd28a,5), drag:2, grav:-14});
      emit(26, p.clone().setY(p.y + 3), {speed:5, life:1.4, size:2.6, c1:C(0xff4a20,1.6), drag:1.5, grav:2});
      ringFx(p, 0xff7a40, 3, 9, .5); flashAt(p, 0xff8040, 900); shake = Math.min(1.2, shake + .7); SFX.boom();
    }
    if (f.type==='pop'){ emit(28, p.clone().setY(p.y + 3), {speed:8, life:.5, size:.6, c1:C(0xffe0a0,4), c2:C(0xffffff,4), drag:3, grav:-8}); SFX.tick(); }
    if (f.type==='beam'){
      emit(90, p.clone().setY(p.y + 1.2), {implode:4.5, speed:0, life:.55, size:.7, c1:C(0xdff4ef,5), c2:C(0x7fd6ff,4)});
      const m = new THREE.Mesh(new THREE.CylinderGeometry(.45, .45, 26, 16, 1, true), fresnel(0xdff4ef, 3, 1.2, .3)); m.position.copy(p); m.position.y += 13; scene.add(m); fxObjs.push({m, t:0, life:.7, beam:true});
      ringFx(p, 0xdff4ef, 3, 4, .6, p.y + .1); flashAt(p, 0xdff4ef, 500); SFX.whoosh();
    }
    if (f.type==='cleanse'){ ringFx(p, 0xf2c46b, 3, 12, .7); emit(70, p.clone().setY(p.y + .6), {flat:true, speed:16, life:.7, size:.7, c1:C(0xf2c46b,4), c2:C(0xffffff,3), drag:2.5}); SFX.chime(); }
    if (f.type==='oracleDie'){ emit(80, p.clone().setY(p.y + 3.4), {speed:12, life:.8, size:.6, c1:C(0xffffff,6), c2:C(0xff6a55,5), drag:2, grav:-10}); ringFx(p, 0xff6a55, 3, 5, .4, p.y + 3.4); flashAt(p, 0xff8070, 300); SFX.shatter(); }
    if (f.type==='oracleSpawn'){ emit(50, p.clone().setY(p.y + 3.4), {implode:3, speed:0, life:.5, size:.55, c1:C(0xff6a55,5), c2:C(0xffffff,3)}); }
    if (f.type==='shot'){
      const g = new THREE.BufferGeometry().setFromPoints([V(f.from.x, f.from.y, 2.4), V(f.x, f.y, 3.4)]);
      const m = new THREE.Line(g, new THREE.LineBasicMaterial({color:hdr(0xffffff,4), transparent:true, opacity:1, blending:THREE.AdditiveBlending})); scene.add(m); fxObjs.push({m, t:0, life:.18});
    }
  }

  // ---------- post-processing ----------
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  // GPU half-float buffers overflow on very sharp highlights; clamp and drop non-finite pixels before AO and bloom can smear them
  composer.addPass(new ShaderPass({
    uniforms:{tDiffuse:{value:null}},
    vertexShader:`varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader:`uniform sampler2D tDiffuse; varying vec2 vUv;
      void main(){ vec4 c = texture2D(tDiffuse, vUv); vec3 r = c.rgb;
        bool bad = !(r.r == r.r) || !(r.g == r.g) || !(r.b == r.b) || any(greaterThan(abs(r), vec3(6e4)));
        gl_FragColor = bad ? vec4(0.,0.,0.,1.) : vec4(clamp(r, 0., 32.), 1.); }`,
  }));
  const gtao = new GTAOPass(scene, camera, 1280, 720); gtao.blendIntensity = .85; composer.addPass(gtao);
  const bloom = new UnrealBloomPass(new THREE.Vector2(1280, 720), .55, .5, 1.05); composer.addPass(bloom);
  composer.addPass(new OutputPass());
  const smaa = new SMAAPass(1280, 720); composer.addPass(smaa);
  const grade = new ShaderPass({
    uniforms:{tDiffuse:{value:null}, uT:{value:0}, uCA:{value:.0012}, uVig:{value:.55}, uGrain:{value:.035}},
    vertexShader:`varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader:`uniform sampler2D tDiffuse; uniform float uT,uCA,uVig,uGrain; varying vec2 vUv;
      void main(){ vec2 c = vUv-.5; float d = dot(c,c); vec2 o = c*uCA*(1.+d*4.);
        vec3 col = vec3(texture2D(tDiffuse,vUv+o).r, texture2D(tDiffuse,vUv).g, texture2D(tDiffuse,vUv-o).b);
        col *= 1. - uVig*smoothstep(.12,.55,d);
        float l = dot(col, vec3(.299,.587,.114));
        col = mix(col*vec3(.94,1.,1.06), col*vec3(1.05,1.,.93), smoothstep(.05,.7,l));
        float n = fract(sin(dot(vUv*vec2(1920.,1080.)+fract(uT)*vec2(311.,173.), vec2(12.9898,78.233)))*43758.5453);
        col += (n-.5)*uGrain; gl_FragColor = vec4(col,1.); }`,
  });
  composer.addPass(grade);

  // ---------- quality tiers ----------
  const TIERS = {
    high:  {label:'High', pr:2, shadow:2048, ao:true, refl:.5, smaa:true},
    medium:{label:'Medium', pr:1.5, shadow:1024, ao:false, refl:.35, smaa:true},
    low:   {label:'Low', pr:1, shadow:0, ao:false, refl:0, smaa:false},
  };
  let tierMode = 'auto', tierName = (matchMedia('(pointer:coarse)').matches || innerWidth < 760) ? 'medium' : 'high';
  let W2 = 1, H2 = 1;
  function resize(){
    const r = game.getBoundingClientRect(); W2 = Math.max(1, r.width); H2 = Math.max(1, r.height);
    const t = TIERS[tierName], pr = Math.min(devicePixelRatio || 1, t.pr);
    renderer.setPixelRatio(pr); renderer.setSize(W2, H2, false); composer.setPixelRatio(pr); composer.setSize(W2, H2);
    reflector.getRenderTarget().setSize(Math.max(64, W2*pr*Math.max(t.refl,.1)|0), Math.max(64, H2*pr*Math.max(t.refl,.1)|0));
    camera.aspect = W2/H2;
    if (camera.aspect < 1.2){ camera.fov = 44; base0.set(10, 170, 150); look0.set(10, 0, -3); }
    else { camera.fov = 40; base0.set(18, 80, 100); look0.set(18, 2, -3); }
    camera.updateProjectionMatrix(); pMat.uniforms.uScale.value = H2*pr*.5;
  }
  const base0 = new THREE.Vector3(), look0 = new THREE.Vector3();
  const camOffset = new THREE.Vector3();
  const UP_AXIS = new THREE.Vector3(0,1,0);
  function applyTier(name){
    tierName = name; const t = TIERS[name], sh = t.shadow > 0;
    if (renderer.shadowMap.enabled !== sh){ renderer.shadowMap.enabled = sh; scene.traverse(o => { const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : []; ms.forEach(m => m.needsUpdate = true); }); }
    key.castShadow = sh;
    if (sh && key.shadow.mapSize.x !== t.shadow){ key.shadow.mapSize.set(t.shadow, t.shadow); if (key.shadow.map){ key.shadow.map.dispose(); key.shadow.map = null; } }
    gtao.enabled = t.ao; smaa.enabled = t.smaa;
    reflector.visible = t.refl > 0; glassTop.material.opacity = t.refl > 0 ? .8 : 1;
    resize(); qualityLabel();
  }
  function qualityLabel(){ $('bQual').textContent = `Quality: ${tierMode==='auto' ? 'Auto · ' : ''}${TIERS[tierName].label}`; }
  $('bQual').onclick = () => {
    const order = ['auto','high','medium','low'], next = order[(order.indexOf(tierMode)+1) % order.length];
    tierMode = next; perf.n = 0; perf.sum = 0; perf.drops = 0;
    applyTier(next==='auto' ? ((matchMedia('(pointer:coarse)').matches || innerWidth < 760) ? 'medium' : 'high') : next);
  };
  const perf = {n:0, sum:0, drops:0};
  function autoTune(rawDt){
    if (tierMode!=='auto' || paused || perf.drops >= 2 || document.hidden) return;
    perf.n++; perf.sum += rawDt;
    if (perf.n >= 120){
      const fps = perf.n/perf.sum; perf.n = 0; perf.sum = 0;
      if (fps < 40 && tierName!=='low'){ perf.drops++; applyTier(tierName==='high' ? 'medium' : 'low'); }
    }
  }
  applyTier(tierName);
  addEventListener('resize', resize); if ('ResizeObserver' in window) new ResizeObserver(resize).observe(game);

  // ---------- input ----------
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), ground = new THREE.Plane(new THREE.Vector3(0,1,0), 0), hit = new THREE.Vector3();
  const DRAG_THRESHOLD_PX = 6, DRAG_YAW_PER_PX = .006;
  let dragging = false, dragMoved = false, dragStartX = 0, dragStartYaw = 0;
  canvas.addEventListener('pointerdown', e => {
    dragging = true; dragMoved = false; dragStartX = e.clientX; dragStartYaw = camYaw;
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', e => {
    if (!dragging) return;
    const dx = e.clientX - dragStartX;
    if (!dragMoved && Math.abs(dx) > DRAG_THRESHOLD_PX) dragMoved = true;
    if (dragMoved) camYaw = Math.max(-YAW_LIMIT, Math.min(YAW_LIMIT, dragStartYaw - dx*DRAG_YAW_PER_PX));
  });
  ['pointerup','pointercancel'].forEach(ev => canvas.addEventListener(ev, () => { dragging = false; }));
  canvas.addEventListener('click', e => {
    if (dragMoved) { dragMoved = false; return; }
    if (!you || paused || watch) return;
    const r = canvas.getBoundingClientRect(), px = e.clientX - r.left, py = e.clientY - r.top;
    if (you.key==='shooter' && you.loc==='room'){
      let best = -1, bd = Math.max(28, r.width*.03);
      cOr.forEach((g,i) => { if (!g.visible) return; const v = g.position.clone().project(camera); const d = Math.hypot((v.x+1)/2*r.width - px, (1-v.y)/2*r.height - py); if (d < bd){ bd = d; best = i; } });
      if (best >= 0){ shootOracle(best, you); return; }
    }
    ndc.set(px/r.width*2-1, -(py/r.height)*2+1); ray.setFromCamera(ndc, camera);
    if (ray.ray.intersectPlane(ground, hit)){ const s = toSim(hit); if (you.loc==='room' ? dist(s,ROOM) < ROOM.r : s.x < SIM_W) tap = s; }
  });
  window.__resetScene = () => { supMeshes.forEach(m => scene.remove(m)); supMeshes.clear(); fxObjs.forEach(o => scene.remove(o.m)); fxObjs.length = 0; parts.length = 0; G.forEach(g => { g.lx = null; }); };

  // ---------- frame ----------
  const proj = new THREE.Vector3(), tmp = new THREE.Vector3();
  let lastPhase = '', toneKey = '';
  const lerpAng = (a, b, k) => { let d = ((b - a + Math.PI*3) % (Math.PI*2)) - Math.PI; return a + d*k; };
  render = (now, dt) => {
    const T = now/1000;
    autoTune(dt);
    if (S.phase !== lastPhase){ lastPhase = S.phase; SFX.phase(S.phase); }
    if (S.phase==='away' && S.sub==='show'){
      const k = Math.floor(S.t2/.75);
      if (k < 3 && S.t2 - k*.75 < .6){ const key2 = `${S.cycle}.${S.set}.${k}`; if (key2 !== toneKey){ toneKey = key2; SFX.oracle(S.seq[k]); } }
    }
    while (S.fx.length) spawnFx(S.fx.shift());
    for (let i=fxObjs.length-1;i>=0;i--){
      const o = fxObjs[i]; o.t += dt; const k = o.t/o.life;
      if (o.ring) o.m.scale.setScalar(1 + k*o.ring);
      if (o.beam) o.m.scale.set(1 - k*.8, 1, 1 - k*.8);
      if (o.m.material.uniforms) o.m.material.uniforms.uI.value = 3*(1-k); else o.m.material.opacity = Math.max(0, 1-k);
      if (k >= 1){ scene.remove(o.m); o.m.geometry.dispose(); fxObjs.splice(i,1); }
    }
    flash.intensity *= Math.exp(-dt*9);
    stepParticles(dt);

    // camera with shake, orbited around look0 by the player-controlled yaw
    shake *= Math.exp(-dt*4);
    camOffset.copy(base0).sub(look0);
    camOffset.applyAxisAngle(UP_AXIS, camYaw);
    camera.position.copy(look0).add(camOffset);
    camera.position.x += Math.sin(T*.13)*.8; camera.position.y += Math.sin(T*.11)*.5;
    if (shake > .01){ camera.position.x += (Math.random()-.5)*shake; camera.position.y += (Math.random()-.5)*shake; }
    camera.lookAt(look0);

    // Atheon animation
    const dps = S.phase==='dps', tele = S.phase==='teleport' || (S.phase==='away' && S.t < .8);
    const detaining = dps && S.marked && S.detainT > 0;
    body.rotation.y = Math.sin(T*.35)*.07;
    body.position.y = .55 + Math.sin(T*1.1)*.12;
    chestG.rotation.x += ((dps ? -.2 + Math.sin(T*7)*.02 : 0) - chestG.rotation.x)*Math.min(1, dt*3);
    chestG.scale.y = 1 + Math.sin(T*1.6)*.01;
    ARM.forEach(a => {
      let tz = a.s*.32, tx = Math.sin(T*.9 + a.s)*.06, ex = -.35;
      if (tele){ tz = a.s*1.7; tx = -.5; ex = -.2; }
      if (dps){ tz = a.s*.65; tx = .35; ex = -.8; }
      if (detaining && a.s > 0){
        tmp.copy(V(S.marked.x, S.marked.y)).sub(ath.position); const yaw = Math.atan2(tmp.x, tmp.z) - body.rotation.y;
        tz = .4 + Math.sin(yaw)*.5; tx = -1.25; ex = -.15;
      }
      a.sh.rotation.z += (tz - a.sh.rotation.z)*Math.min(1, dt*4); a.sh.rotation.x += (tx - a.sh.rotation.x)*Math.min(1, dt*4); a.el.rotation.x += (ex - a.el.rotation.x)*Math.min(1, dt*4);
    });
    headG.rotation.x = dps ? -.25 : Math.sin(T*.5)*.05;
    const coreI = dps ? 3 + Math.sin(T*10)*.5 : (tele ? 2.6 : 1.4);
    coreMat.uniforms.uI.value = coreI; coreMat.uniforms.uT.value = T;
    coreHalo.material.uniforms.uI.value = dps ? 2.6 : 1.1;
    coreLight.intensity = dps ? 160 : 55; coreLight.position.copy(core.getWorldPosition(tmp)); coreLight.position.z += 3;
    eyeM.color.copy(hdr(0xff3a2a, tele || detaining ? 14 : 6));

    spires.forEach((s2,i) => { s2.cap.rotation.y = T*.8 + i; s2.cap.position.y = s2.h + 1.4 + Math.sin(T*1.5 + i)*.15; s2.capGlow.position.y = s2.cap.position.y; });
    shafts.forEach(m => m.material.uniforms.uT.value = T);
    fogLayers.forEach((m,i) => { m.material.map.offset.x = T*.004*(i%2 ? 1 : -1.3); m.material.map.offset.y = T*.003*(i%2 ? -1 : .7); });
    platGlyph.rotation.z = T*.2;

    // plates & gates
    for (const k of ['mars','venus']){
      const need = S.phase==='away' && S.dest===k, f = plateFx[k];
      f.ringM.color.copy(hdr(PLATES[k].color, need ? 3 + Math.sin(T*6) : .9));
      f.archGlowM.color.copy(hdr(PLATES[k].color, need ? 3.2 : .8));
      f.fillM.opacity = need ? .35 + .15*Math.sin(T*6) : .12; f.sheetMat.uniforms.uT.value = T; f.sheetMat.uniforms.uOpen.value += ((need && S.portalOpen ? 1 : need ? .15 : 0) - f.sheetMat.uniforms.uOpen.value)*Math.min(1, dt*5);
    }

    // oracles
    const showVault = S.phase==='away' && (S.sub==='show' || S.sub==='call') && youSee('vault');
    vOr.forEach((g,i) => {
      let I = .25, sc = .75;
      if (showVault){ const k = S.seq.indexOf(i); if (k >= 0){ const st = k*.75; if (S.sub==='show' && S.t2 >= st && S.t2 < st + .6){ I = 5; sc = 1.4; } else if (S.sub==='show' && S.t2 >= st){ I = 1.2; sc = 1; } } }
      const u = g.userData; u.mat.uniforms.uI.value += (I - u.mat.uniforms.uI.value)*Math.min(1, dt*12); u.mat.uniforms.uT.value = T;
      u.ringM.color.copy(hdr(0xdff4ef, u.mat.uniforms.uI.value*.7)); u.glowM.uniforms.uI.value = Math.max(0, u.mat.uniforms.uI.value - .6)*.6;
      g.scale.setScalar(g.scale.x + (sc - g.scale.x)*Math.min(1, dt*10)); u.ring.rotation.x = T*.9 + i; u.ring.rotation.y = T*.6; u.ring2.rotation.z = T*.7;
      g.position.y = g.userData.base + Math.sin(T*1.5 + i)*.15;
    });
    const active = S.phase==='away' || (S.phase==='teleport' && S.moved);
    const dcol = S.dest ? PLATES[S.dest].color : 0x555a60;
    roomRingM.color.copy(hdr(active ? dcol : 0x3a3f45, active ? 2.6 : .7));
    roomTopMat.emissive.set(dcol); roomTopMat.emissiveIntensity = active ? .06 : 0;
    roomLight.color.set(dcol); roomLight.intensity += ((active ? 140 : 0) - roomLight.intensity)*Math.min(1, dt*3);
    atmoMat.uniforms.uCol.value.set(dcol); atmoMat.uniforms.uI.value += ((active ? .45 : 0) - atmoMat.uniforms.uI.value)*Math.min(1, dt*3);
    roomShaft.material.uniforms.uCol.value.copy(hdr(dcol, active ? 1.2 : 0));
    veilMat.opacity = you && !watch && S.phase==='away' && you.loc==='vault' ? .84 : 0;
    cOr.forEach((g,i) => {
      const o = S.oracles.find(o => o.pos===i && o.alive);
      g.visible = !!o && active && youSee('room');
      const u = g.userData; u.mat.uniforms.uI.value = 2.4; u.mat.uniforms.uT.value = T; u.mat.uniforms.uCol.value.set(0xffd6cf);
      u.ringM.color.copy(hdr(0xff6a55, 3)); u.glowM.uniforms.uI.value = 1.4;
      u.ring.rotation.x = T*1.3 + i; u.ring.rotation.y = T; u.ring2.rotation.z = T*1.1;
      g.position.y = 3.4 + Math.sin(T*2 + i)*.15;
    });
    relicMesh.visible = !!S.relic;
    if (S.relic){
      const holder = S.relic.held ? S.players[0] : null;
      relicMesh.position.copy(V(S.relic.x, S.relic.y, holder ? 1.9 : 2.3 + Math.sin(T*2)*.25));
      if (holder){ const gy = G[0].yaw; relicMesh.position.x += Math.sin(gy)*1.1; relicMesh.position.z += Math.cos(gy)*1.1; relicMesh.rotation.set(0, gy, 0); }
      else relicMesh.rotation.y = T;
    }
    dome.visible = !!(S.relic && S.relic.held);
    if (dome.visible){ dome.position.copy(V(S.players[0].x, S.players[0].y)); domeMat.uniforms.uI.value = .7 + (S.cleanCd > 1.1 ? 1.2 : 0); }

    // Guardians
    S.players.forEach((p,i) => {
      const g = G[i];
      if (g.lx === null || dist({x:g.lx, y:g.ly}, p) > 60){ g.lx = p.x; g.ly = p.y; }
      const vx = (p.x - g.lx)/10, vz = (p.y - g.ly)/10, spd = dt > 0 ? Math.hypot(vx, vz)/dt : 0; g.lx = p.x; g.ly = p.y;
      const onPlat = onPlatform(p);
      g.hh += (heightAt(p) - g.hh)*Math.min(1, dt*12); if (Math.abs(heightAt(p) - g.hh) > 3) g.hh = heightAt(p);
      g.root.position.copy(V(p.x, p.y, g.hh));
      let aim = null;
      if (p.loc==='vault' && !p.detained){
        if (S.phase==='dps'){ const b = S.players.find(q => q.detained); aim = b ? V(b.x, b.y, heightAt(b) + 1.5) : (onPlat ? core.getWorldPosition(new THREE.Vector3()) : null); }
        else if (p.target) aim = V(p.target.x, p.target.y, 2.4);
      }
      let yaw = g.yaw;
      if (aim){ yaw = Math.atan2(aim.x - g.root.position.x, aim.z - g.root.position.z); }
      else if (spd > .3) yaw = Math.atan2(vx, vz);
      g.yaw = lerpAng(g.yaw, yaw, Math.min(1, dt*10)); g.root.rotation.y = g.yaw;
      const a = Math.min(1, spd/1.2); g.phase += dt*(4 + spd*3.2);
      g.legs.forEach((l, k) => { const s2 = Math.sin(g.phase + k*Math.PI); l.hip.rotation.x = -s2*.75*a; l.knee.rotation.x = Math.max(0, -Math.sin(g.phase + k*Math.PI - .6))*1.1*a; });
      g.hips.position.y = 1.05 + Math.abs(Math.sin(g.phase))*.06*a;
      g.torso.position.y = g.hips.position.y; g.torso.rotation.x = .1*a;
      g.arms.forEach(ar => {
        const firing = aim && (ar.s > 0 || S.phase==='dps');
        const tx = firing ? -1.45 + (ar.s < 0 ? .2 : 0) : Math.sin(g.phase + (ar.s > 0 ? 0 : Math.PI))*.55*a;
        const tz = firing && ar.s < 0 ? .45 : ar.s*.08;
        ar.sh.rotation.x += (tx - ar.sh.rotation.x)*Math.min(1, dt*12); ar.sh.rotation.z += (tz - ar.sh.rotation.z)*Math.min(1, dt*12);
        ar.el.rotation.x += ((firing ? -.1 : -.25 - .3*a) - ar.el.rotation.x)*Math.min(1, dt*12);
      });
      g.muzzle.visible = !!aim && Math.random() < .5; if (g.muzzle.visible) g.muzzle.scale.setScalar(.4 + Math.random()*.5);
      g.bubble.visible = p.detained; if (p.detained) g.bubble.material.uniforms.uI.value = 1 + 1.2*(p.bub/70);
      g.mark.visible = S.marked===p && S.detainT > 0; if (g.mark.visible) g.markM.opacity = .45 + .4*Math.sin(T*10);
      g.ringM.opacity = p.you ? 1 : .55;
      g.root.visible = !(p.loc==='room' && !active && S.phase!=='teleport');
      proj.copy(g.root.position); proj.y += 4.2; proj.project(camera);
      const hidden = you && !watch && S.phase==='away' && p.loc==='room' && you.loc==='vault';
      g.tag.style.display = proj.z > 1 || hidden ? 'none' : 'flex';
      g.tag.style.left = `${(proj.x+1)/2*W2}px`; g.tag.style.top = `${(1-proj.y)/2*H2}px`;
      const vm = p.loc==='room' ? `<span style="display:inline-block;width:28px;height:3px;background:rgba(255,255,255,.2);position:relative;margin-left:4px"><span style="position:absolute;inset:0 auto 0 0;width:${Math.round(p.meter*100)}%;background:${p.meter>.7?'#ff6a55':'#9b7cff'}"></span></span>` : '';
      const cls = 'tag' + (p.you ? ' you' : ''); if (g.tag.className !== cls) g.tag.className = cls;
      const html = `<i style="background:${p.color}"></i>${p.you ? 'YOU' : p.tag}${vm}`; if (g.tag._h !== html){ g.tag.innerHTML = html; g.tag._h = html; }
    });
    youBeam.visible = !!(you && !watch);
    if (youBeam.visible){ youBeam.position.copy(V(you.x, you.y, 15)); youBeam.material.opacity = .12 + Math.sin(T*3)*.05; }
    tapMark.visible = !!tap; if (tap){ tapMark.position.copy(V(tap.x, tap.y, .1)); tapMark.scale.setScalar(1 + Math.sin(T*8)*.1); }
    const placeNum = (n, show) => { n.d.style.display = show ? 'block' : 'none'; if (!show) return; proj.copy(n.v).project(camera); n.d.style.left = `${(proj.x+1)/2*W2}px`; n.d.style.top = `${(1-proj.y)/2*H2}px`; };
    vNums.forEach(n => placeNum(n, youSee('vault')));
    cNums.forEach(n => placeNum(n, active && youSee('room')));

    // Supplicants
    const alive = new Set();
    for (const e of S.enemies){
      const m = supMesh(e); alive.add(e.id);
      const prev = m.position.clone();
      m.position.copy(V(e.x, e.y, 3 + Math.max(0, heightAt(e)) + Math.sin(T*6 + e.id)*.35));
      const mv = m.position.clone().sub(prev);
      if (mv.lengthSq() > 1e-6){ m.rotation.y = lerpAng(m.rotation.y, Math.atan2(mv.x, mv.z), Math.min(1, dt*8)); }
      m.rotation.z = Math.sin(T*5 + e.id)*.15;
      m.userData.tents.forEach((t,k) => { t.rotation.x = .4 + Math.sin(T*6 + k + e.id)*.35; });
    }
    supMeshes.forEach((m,id) => { if (!alive.has(id)){ scene.remove(m); supMeshes.delete(id); } });

    // tracers
    let n = 0;
    for (const p of S.players){
      if (p.loc!=='vault' || p.detained || n >= 12) continue;
      let t = null; const onPlat = onPlatform(p);
      if (S.phase==='dps'){ const b = S.players.find(q => q.detained); t = b ? V(b.x, b.y, heightAt(b) + 1.5) : (onPlat ? core.getWorldPosition(tmp).clone() : null); }
      else if (p.target) t = V(p.target.x, p.target.y, 3 + Math.max(0, heightAt(p.target)));
      if (!t || Math.random() < .45) continue;
      const a = V(p.x, p.y, heightAt(p) + 2.6);
      trPos.set([a.x, a.y, a.z, t.x + (Math.random()-.5)*.6, t.y + (Math.random()-.5)*.6, t.z], n*6); n++;
    }
    trGeo.setDrawRange(0, n*2); trGeo.attributes.position.needsUpdate = true;

    const mp = motes.geometry.attributes.position;
    for (let i=0;i<mp.count;i++){ let y = mp.getY(i) + dt*.5; if (y > 16) y = 0; mp.setY(i, y); mp.setX(i, mp.getX(i) + Math.sin(T*.5 + i)*dt*.12); }
    mp.needsUpdate = true;

    grade.uniforms.uT.value = T;
    composer.render(dt);
  };
}

// =====================================================================
// boot
// =====================================================================
// Tests set globalThis.__RAID_CLINIC_TEST__ to drive the simulation headless (see tests/).
if (globalThis.__RAID_CLINIC_TEST__){ newState(); globalThis.__RAID_CLINIC_TEST__({start, update, state:() => S, you:() => you}); return; }
newState();
showOverlay('start');
initEngine().catch(err => { console.error(err); $('game').insertAdjacentHTML('beforeend','<div class="nogl">The 3D engine couldn’t start. This trainer needs WebGL and a connection to load its libraries.</div>'); });
let last = performance.now(), hudT = 0;
function frame(){
  const now = performance.now();
  const raw = Math.min(.05, (now-last)/1000), dt = raw*speed; last = now;
  if (!paused && !S.result && S.phase!=='idle') update(dt);
  render(now, raw);
  hudT += raw; if (hudT > .08){ hudT = 0; hud(); }
  requestAnimationFrame(frame);
}
hud();
requestAnimationFrame(frame);
})();
