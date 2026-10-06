import test from 'node:test';
import assert from 'node:assert/strict';
import { priceByKey, rankByDepth, buildSystems, layout, nextCycle, formatCountdown, formatMass } from '../src/model.js';
import { smartPath } from '../src/chain.js';
import { POOLS, SECTORS } from '../src/realm.js';
import { PEGS } from '../src/config.js';

const asset = (symbol, amount, key = symbol === 'LUNA' ? 'uluna' : 'key-' + symbol) => ({ key, symbol, amount });
const pool = (a, x, b, y) => [asset(a, x), asset(b, y)];

test('prices spread from native LUNA through the deepest pool', () => {
  const prices = priceByKey([
    { type: 'xyk', assets: pool('LUNA', 1, 'USDC', 5) },        // thin and skewed: must not set the USDC price
    { type: 'xyk', assets: pool('LUNA', 1000, 'USDC', 50) },
    { type: 'xyk', assets: pool('USDC', 100, 'wBTC', 0.001) },
  ]);
  assert.equal(prices['key-USDC'], 20);
  assert.equal(prices['key-wBTC'], 2000000);
});

test('a token that only calls itself LUNA does not anchor prices', () => {
  const fake = [asset('LUNA', 1e12, 'terra1fake'), asset('USDC', 10)];
  const real = pool('LUNA', 1000, 'USDC', 50);
  const { prices, ranked } = rankByDepth([{ pair: 'fake', assets: fake }, { pair: 'real', assets: real }]);
  assert.equal(prices['key-USDC'], 20);
  assert.equal(ranked[0].pair, 'real');
  assert.equal(ranked[0].depth, 2000);
});

test('pegged tokens share a price once one of them is priced', () => {
  const prices = priceByKey([
    { type: 'xyk', assets: pool('LUNA', 1000, 'USDC', 50) },
    { type: 'xyk', assets: [asset('USDT', 10, 'usdt'), asset('ASTRO', 100, 'astro')] },
  ], { pegs: [['key-USDC', 'usdt']] });
  assert.equal(prices.usdt, 20);
  assert.equal(prices.astro, 2);
});

test('xyk pools set prices before deeper pools of other types, and known prices win', () => {
  const pools = [
    { type: 'concentrated', assets: pool('LUNA', 1000000, 'USDC', 10000) }, // ratio says 100
    { type: 'xyk', assets: pool('LUNA', 1000, 'USDC', 50) },                // price is 20
    { type: 'concentrated', assets: pool('LUNA', 500, 'ampLUNA', 100) },    // ratio says 5
  ];
  assert.equal(priceByKey(pools)['key-USDC'], 20);
  assert.equal(priceByKey(pools)['key-ampLUNA'], 5);
  assert.equal(priceByKey(pools, { known: { 'key-ampLUNA': 3.8 } })['key-ampLUNA'], 3.8);
});

test('with no live data every system keeps its sample size', () => {
  const systems = buildSystems(POOLS);
  assert.equal(systems.length, POOLS.length);
  assert.ok(systems.every((s) => !s.live && s.value === null && s.amounts === null));
  assert.equal(systems.find((s) => s.id === 'tidewatch').tier, 'Stronghold');
  assert.equal(systems.find((s) => s.id === 'bedrock').tier, 'Outpost');
});

test('a live pool reports mass in LUNA, or dollars when a LUNA price is known', () => {
  const live = { tidewatch: [asset('ampLUNA', 100), asset('LUNA', 300)] };
  const inLuna = buildSystems(POOLS, live).find((s) => s.id === 'tidewatch');
  assert.equal(inLuna.live, true);
  assert.equal(inLuna.unit, 'LUNA');
  assert.equal(inLuna.value, 600);
  assert.equal(inLuna.a, 'LUNA');
  assert.equal(inLuna.shareA, 0.5);
  const inUsd = buildSystems(POOLS, live, { lunaUsd: 0.05 }).find((s) => s.id === 'tidewatch');
  assert.equal(inUsd.unit, 'USD');
  assert.equal(inUsd.value, 30);
});

test('a pool with no price path keeps its reserves but is not counted as live', () => {
  const s = buildSystems(POOLS, { twinmints: [asset('USDC', 10), asset('USDT', 12)] }).find((x) => x.id === 'twinmints');
  assert.equal(s.live, false);
  assert.equal(s.amounts.length, 2);
});

test('with three or more live pools, sizes follow live mass', () => {
  const live = {
    tidewatch: pool('LUNA', 10000000, 'ampLUNA', 3000000),
    starbridge: pool('ATOM', 10000, 'LUNA', 400000),
    goldspire: pool('LUNA', 6000, 'wBTC', 0.004),
  };
  const by = Object.fromEntries(buildSystems(POOLS, live).map((s) => [s.id, s]));
  assert.equal(by.tidewatch.size, 1);
  assert.equal(by.tidewatch.tier, 'Stronghold');
  assert.ok(by.goldspire.size > 0.42 && by.goldspire.size < by.starbridge.size);
  assert.ok(by.starbridge.size < 1);
  assert.equal(by.bedrock.size, 0.42);
});

test('every curated pool has a pair address and the pegs are distinct keys', () => {
  assert.ok(POOLS.every((p) => /^terra1[a-z0-9]{58}$/.test(p.pair)), 'pair addresses');
  assert.equal(new Set(POOLS.map((p) => p.pair)).size, POOLS.length);
  assert.equal(new Set(POOLS.map((p) => p.id)).size, POOLS.length);
  assert.equal(new Set(PEGS.flat()).size, PEGS.flat().length);
});

test('layout keeps each system inside its sector wedge', () => {
  for (const s of layout(buildSystems(POOLS), SECTORS)) {
    const from = SECTORS[s.sector].from;
    assert.ok(s.deg > from && s.deg < from + 120, `${s.id} at ${s.deg}`);
    assert.ok(s.r > 0 && s.r < 14 && s.y > 0);
  }
});

test('next cycle is the coming Sunday 12:00 UTC', () => {
  assert.equal(nextCycle(new Date('2026-10-06T00:00:00Z')).toISOString(), '2026-10-11T12:00:00.000Z');
  assert.equal(nextCycle(new Date('2026-10-11T11:59:00Z')).toISOString(), '2026-10-11T12:00:00.000Z');
  assert.equal(nextCycle(new Date('2026-10-11T12:00:00Z')).toISOString(), '2026-10-18T12:00:00.000Z');
});

test('formatting', () => {
  assert.equal(formatCountdown(5 * 86400000 + 3 * 3600000), '5d 3h');
  assert.equal(formatMass(1234567, 'USD'), '$1.23M');
  assert.equal(formatMass(400, 'LUNA'), '400.00 LUNA');
});

test('smart query path is base64 JSON', () => {
  const path = smartPath('terra1abc', { pool: {} });
  assert.equal(path, '/cosmwasm/wasm/v1/contract/terra1abc/smart/' + encodeURIComponent(btoa('{"pool":{}}')));
});
