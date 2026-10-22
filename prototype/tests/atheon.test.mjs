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
