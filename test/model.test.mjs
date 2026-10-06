import test from 'node:test';
import assert from 'node:assert/strict';
import { priceTokens, buildSystems, layout, nextCycle, formatCountdown, formatMass } from '../src/model.js';
import { smartPath } from '../src/chain.js';
import { POOLS, SECTORS } from '../src/realm.js';

const pool = (a, x, b, y) => [{ symbol: a, amount: x }, { symbol: b, amount: y }];

test('prices in USD through a USDC pool', () => {
  const { unit, prices } = priceTokens({ p1: pool('LUNA', 1000, 'USDC', 50), p2: pool('LUNA', 200, 'ampLUNA', 100) });
  assert.equal(unit, 'USD');
  assert.equal(prices.LUNA, 0.05);
  assert.equal(prices.ampLUNA, 0.1);
});

test('falls back to LUNA units without a USDC pool', () => {
  const { unit, prices } = priceTokens({ p: pool('LUNA', 200, 'ampLUNA', 100) });
  assert.equal(unit, 'LUNA');
  assert.equal(prices.ampLUNA, 2);
});

test('with no live data every system keeps its sample size', () => {
  const systems = buildSystems(POOLS);
  assert.equal(systems.length, POOLS.length);
  assert.ok(systems.every((s) => !s.live && s.value === null));
  assert.equal(systems.find((s) => s.id === 'moonhaven').tier, 'Stronghold');
  assert.equal(systems.find((s) => s.id === 'bedrock').tier, 'Outpost');
});

test('a live pool reports mass, and LUNA mass converts to dollars when a price is known', () => {
  const live = { tidewatch: pool('ampLUNA', 100, 'LUNA', 200) };
  const inLuna = buildSystems(POOLS, live).find((s) => s.id === 'tidewatch');
  assert.equal(inLuna.live, true);
  assert.equal(inLuna.unit, 'LUNA');
  assert.equal(inLuna.value, 400);
  assert.equal(inLuna.a, 'LUNA');
  assert.equal(inLuna.shareA, 0.5);
  const inUsd = buildSystems(POOLS, live, { lunaUsd: 0.05 }).find((s) => s.id === 'tidewatch');
  assert.equal(inUsd.unit, 'USD');
  assert.equal(inUsd.value, 20);
});

test('with three live pools, sizes follow live mass', () => {
  const live = {
    moonhaven: pool('LUNA', 1000000, 'USDC', 50000),
    tidewatch: pool('LUNA', 10000, 'ampLUNA', 5000),
    astral: pool('LUNA', 100, 'ASTRO', 1000),
  };
  const by = Object.fromEntries(buildSystems(POOLS, live).map((s) => [s.id, s]));
  assert.equal(by.moonhaven.size, 1);
  assert.equal(by.astral.size, 0.54);
  assert.ok(by.tidewatch.size > 0.54 && by.tidewatch.size < 1);
  assert.equal(by.bedrock.size, 0.54);
});

test('layout keeps each system inside its sector wedge', () => {
  for (const s of layout(buildSystems(POOLS), SECTORS)) {
    const from = SECTORS[s.sector].from;
    assert.ok(s.deg > from && s.deg < from + 120, `${s.id} at ${s.deg}`);
    assert.ok(s.r > 0 && s.y > 0);
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
