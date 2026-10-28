// Headless checks for the Atheon simulation. No browser or WebGL needed.
// Every seat played correctly by the bots must clear; every seat left idle must wipe for the right reason.
import { test } from 'node:test';
import assert from 'node:assert/strict';

// Minimal DOM stubs: the page script touches a few elements at load time.
const stubEl = () => new Proxy({
  classList: {add(){}, remove(){}}, style: {}, dataset: {}, children: [],
  addEventListener(){}, insertAdjacentHTML(){}, appendChild(){},
  getBoundingClientRect: () => ({width:1000, height:680, left:0, top:0}),
  getContext: () => new Proxy({}, {get: (t, k) => k === 'createRadialGradient' ? () => ({addColorStop(){}}) : () => {}, set: () => true}),
}, {get: (t, k) => k in t ? t[k] : undefined, set: (t, k, v) => (t[k] = v, true)});
const els = {};
globalThis.document = {getElementById: id => els[id] ||= stubEl()};
globalThis.window = globalThis;
globalThis.addEventListener = () => {};

let sim;
globalThis.__RAID_CLINIC_TEST__ = api => { sim = api; };
await import('../vault-of-glass/atheon/atheon.js');

const RUNS = 20, STEP = 1/30, LIMIT = 600;
// idle = the player's seat does nothing; otherwise the bot plays the player's seat too
function play(seat, idle){
  const results = {};
  for (let i = 0; i < RUNS; i++){
    sim.start(seat);
    const you = sim.you();
    for (let t = 0; !sim.state().result && t < LIMIT; t += STEP){
      if (you && !idle) you.you = false;
      sim.update(STEP);
      if (you && !idle) you.you = true;
    }
    const r = sim.state().result, key = r ? (r.win ? 'WIN' : r.reason) : `TIMEOUT in ${sim.state().phase}`;
    results[key] = (results[key] || 0) + 1;
  }
  return results;
}

for (const seat of [null, 'relic', 'shooter', 'plate', 'caller', 'adds']){
  test(`${seat || 'watch mode'}: correct play clears every run`, () => {
    assert.deepEqual(play(seat, false), {WIN: RUNS});
  });
}

// Interact prompt: one contextual action at a time, shown only when there is something to do
function runTo(seat, until, limit = 120){
  sim.start(seat);
  const you = sim.you();
  for (let t = 0; t < limit && !until(sim.state()); t += STEP){
    you.you = false; sim.update(STEP); you.you = true; // a bot drives the seat until the moment we want
  }
  return you;
}

test('prompt: nothing in watch mode', () => {
  sim.start(null);
  for (let i = 0; i < 300; i++){ sim.update(STEP); assert.equal(sim.interactPrompt(), null); }
});

test('prompt: new players get a move hint that goes away once they move', () => {
  const you = (sim.start('adds'), sim.you());
  sim.update(STEP);
  assert.deepEqual(sim.interactPrompt().keys, ['W','A','S','D']);
  you.x += 40;
  assert.equal(sim.interactPrompt(), null);
});

test('prompt: the Aegis is claimed by holding E, and the ring fills while you hold', () => {
  const you = runTo('relic', S => S.phase === 'away' && S.relic);
  const S = sim.state();
  you.x = S.relic.x; you.y = S.relic.y;
  let p = sim.interactPrompt();
  assert.deepEqual([p.keys, p.hold, p.act], [['E'], true, 'e']);
  assert.equal(p.prog, 0);
  sim.hold(true);
  for (let i = 0; i < 9; i++){ you.you = true; sim.update(STEP); }   // 0.3s: not enough
  assert.equal(S.relic.held, false);
  p = sim.interactPrompt();
  assert.ok(p.prog > .4 && p.prog < 1, `ring at ${p.prog}`);
  for (let i = 0; i < 12; i++) sim.update(STEP);                     // past 0.6s
  assert.equal(S.relic.held, true);
  sim.hold(false);
  assert.deepEqual(sim.interactPrompt().keys, ['Q']);                // now the cleanse
});

test('prompt: letting go of E drops the hold progress', () => {
  const you = runTo('relic', S => S.phase === 'away' && S.relic);
  const S = sim.state();
  you.x = S.relic.x; you.y = S.relic.y;
  sim.hold(true); for (let i = 0; i < 12; i++) sim.update(STEP);
  sim.hold(false); sim.update(STEP);
  assert.equal(sim.interactPrompt().prog, 0);
  assert.equal(S.relic.held, false);
});

test('prompt: the shooter is only prompted on their own shot, with the exact key', () => {
  let prompted = 0;
  runTo('shooter', S => {
    const p = sim.interactPrompt(), mine = S.phase === 'away' && S.sub === 'shoot' && S.shotIdx % 2 === 0;
    if (mine){ prompted++; assert.deepEqual(p.keys, [String(S.call[S.shotIdx] + 1)]); }
    else assert.ok(!p || p.label !== undefined && !/^Shoot Oracle/.test(p.label));
    return S.result;
  });
  assert.ok(prompted > 0);
});

test('objective: the Aegis and the plate are marked until you are on them', () => {
  const you = runTo('relic', S => S.phase === 'away' && S.relic);
  const S = sim.state();
  you.x = S.relic.x + 100; you.y = S.relic.y;                          // the bot has walked up to it already
  assert.equal(sim.objectiveTarget().label, 'Aegis');
  you.x = S.relic.x; you.y = S.relic.y;
  assert.equal(sim.objectiveTarget(), null);

  const holder = runTo('plate', S2 => S2.phase === 'away');
  const target = sim.objectiveTarget();
  holder.x = target.x + 200; holder.y = target.y;
  assert.match(sim.objectiveTarget().label, /plate$/);
  holder.x = target.x; holder.y = target.y;
  assert.equal(sim.objectiveTarget(), null);
});

// One location at a time: while the gate is open you see the place you are in, and nothing else
test('locations: away-team seats see only the destination, Vault seats only the Vault, during the away phase', () => {
  for (const [seat, loc, other] of [['relic', 'room', 'vault'], ['shooter', 'room', 'vault'], ['plate', 'vault', 'room'], ['caller', 'vault', 'room'], ['adds', 'vault', 'room']]){
    const you = (sim.start(seat), sim.you()), S = sim.state();
    S.phase = 'away'; you.loc = loc;
    assert.equal(sim.youSee(loc), true, `${seat} should see the ${loc}`);
    assert.equal(sim.youSee(other), false, `${seat} should not see the ${other}`);
  }
});

test('locations: spectators and every other phase see both', () => {
  sim.start(null);
  sim.state().phase = 'away';
  assert.deepEqual([sim.youSee('vault'), sim.youSee('room')], [true, true]);
  const you = (sim.start('relic'), sim.you());
  for (const phase of ['opening', 'teleport', 'dps']){
    sim.state().phase = phase;
    assert.deepEqual([sim.youSee('vault'), sim.youSee('room')], [true, true], phase);
  }
  assert.ok(you);
});

const IDLE_WIPES = {
  relic: 'You were consumed by the Void',
  shooter: 'An Oracle finished its song',
  plate: 'The time gate closed',
  caller: 'An Oracle finished its song',
};
for (const [seat, reason] of Object.entries(IDLE_WIPES)){
  test(`${seat}: idling wipes with "${reason}"`, () => {
    assert.deepEqual(play(seat, true), {[reason]: RUNS});
  });
}
