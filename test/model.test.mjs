import test from 'node:test';
import assert from 'node:assert/strict';
import { priceByKey, rankByDepth, buildSystems, mergeAlliance, stakesFor, tokenIndex, gapFlag, priceGaps, layout, nextCycle, formatCountdown, formatMass, pairName, PLATE_RADIUS } from '../src/model.js';
import { smartPath, encodeSmartQuery, decodeSmartResponse } from '../src/chain.js';
import { POOLS, ALLIANCE, OUTER, SECTORS, TOKENS } from '../src/realm.js';
import { PEGS, KNOWN_ASSETS, USDC_INJ } from '../src/config.js';

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

test('a pool below the floor sets no price', () => {
  const pools = [
    { pair: 'dust', type: 'xyk', assets: pool('LUNA', 5, 'JUNK', 1) },
    { pair: 'junk', type: 'xyk', assets: [asset('JUNK', 1e9), asset('TRASH', 1e9)] },
  ];
  assert.equal(rankByDepth(pools).ranked[0].pair, 'junk');
  const guarded = rankByDepth(pools, { floor: 100 });
  assert.equal(guarded.prices['key-JUNK'], undefined);
  assert.equal(guarded.ranked.find((p) => p.pair === 'junk').depth, 0);
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

test('with no live data every system is uncharted', () => {
  const systems = buildSystems(POOLS);
  assert.equal(systems.length, POOLS.length);
  assert.ok(systems.every((s) => !s.live && s.value === null && s.amounts === null && s.tier === 'Uncharted'));
  assert.equal(systems.filter((s) => s.ghost).length, 6);
});

test('mass is in dollars when the dollar token is priced on chain, else LUNA', () => {
  const live = { 'luna-ampluna': [asset('ampLUNA', 100), asset('LUNA', 300)] };
  const inLuna = buildSystems(POOLS, live).find((s) => s.id === 'luna-ampluna');
  assert.equal(inLuna.live, true);
  assert.equal(inLuna.unit, 'LUNA');
  assert.equal(inLuna.value, 600);
  assert.equal(inLuna.a, 'LUNA');
  assert.equal(inLuna.shareA, 0.5);
  live['luna-usdc-inj'] = [asset('LUNA', 2000), asset('USDC.inj', 100, USDC_INJ)];
  const inUsd = buildSystems(POOLS, live, { usdKey: USDC_INJ }).find((s) => s.id === 'luna-ampluna');
  assert.equal(inUsd.unit, 'USD');
  assert.equal(inUsd.value, 30);
  const fallback = buildSystems(POOLS, { 'luna-ampluna': live['luna-ampluna'] }, { usdKey: USDC_INJ, lunaUsd: 0.1 }).find((s) => s.id === 'luna-ampluna');
  assert.equal(fallback.value, 60);
});

test('a pool with no price path keeps its reserves but is not counted as live', () => {
  const s = buildSystems(POOLS, { 'usdc-inj-usdt': [asset('USDC.inj', 10), asset('USDT', 12)] }).find((x) => x.id === 'usdc-inj-usdt');
  assert.equal(s.live, false);
  assert.equal(s.amounts.length, 2);
});

test('sizes follow live mass', () => {
  const live = {
    'luna-ampluna': pool('LUNA', 10000000, 'ampLUNA', 3000000),
    'luna-atom': pool('ATOM', 10000, 'LUNA', 400000),
    'luna-inj': pool('LUNA', 6000, 'INJ', 40),
  };
  const by = Object.fromEntries(buildSystems(POOLS, live).map((s) => [s.id, s]));
  assert.equal(by['luna-ampluna'].size, 1);
  assert.equal(by['luna-ampluna'].tier, 'Stronghold');
  assert.ok(by['luna-inj'].size > 0.42 && by['luna-inj'].size < by['luna-atom'].size);
  assert.ok(by['luna-atom'].size < 1);
});

test('the curated lists are well formed', () => {
  assert.equal(ALLIANCE.length, 24);
  assert.deepEqual(Object.fromEntries(Object.keys(SECTORS).map((k) => [k, ALLIANCE.filter((p) => p.sector === k).length])), { stable: 3, project: 8, bluechip: 6, single: 7 });
  const withPair = POOLS.filter((p) => p.pair);
  assert.ok(withPair.every((p) => /^terra1[a-z0-9]{58}$/.test(p.pair) && p.type), 'pair addresses and types');
  assert.equal(new Set(withPair.map((p) => p.pair)).size, withPair.length);
  assert.equal(new Set(POOLS.map((p) => p.id)).size, POOLS.length);
  assert.ok(OUTER.every((p) => p.outer && p.pair && p.sector === null));
  assert.ok(ALLIANCE.every((p) => SECTORS[p.sector] && !p.outer));
  assert.equal(new Set(PEGS.flat()).size, PEGS.flat().length);
  assert.ok(PEGS.flat().every((k) => KNOWN_ASSETS[k]));
  const symbols = POOLS.flatMap((p) => [p.a, p.b]).filter(Boolean);
  assert.deepEqual(symbols.filter((s) => !TOKENS[s]), [], 'every curated token has a colour');
  const sweep = Object.values(SECTORS).reduce((t, s) => t + s.span, 0);
  assert.equal(sweep, 360);
});

test('layout keeps Alliance systems in their wedge and outer systems beyond the rim', () => {
  for (const s of layout(buildSystems(POOLS), SECTORS)) {
    assert.ok(s.y > 0);
    if (s.outer) { assert.ok(s.r > PLATE_RADIUS + 2, `${s.id} r ${s.r}`); continue; }
    const { from, span } = SECTORS[s.sector];
    assert.ok(s.deg > from && s.deg < from + span, `${s.id} at ${s.deg}`);
    assert.ok(s.r > 0 && s.r < PLATE_RADIUS);
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
  assert.equal(pairName({ a: 'LUNA', b: 'USDC.inj' }), 'LUNA–USDC.inj');
  assert.equal(pairName({ a: 'ampCAPA', b: null }), 'ampCAPA');
});

test('smart query path is base64 JSON', () => {
  const path = smartPath('terra1abc', { pool: {} });
  assert.equal(path, '/cosmwasm/wasm/v1/contract/terra1abc/smart/' + encodeURIComponent(btoa('{"pool":{}}')));
});

test('RPC smart queries are encoded and decoded as protobuf', () => {
  // field 1 (address, 3 bytes), field 2 (query bytes)
  assert.equal(encodeSmartQuery('abc', { a: {} }), '0a03616263' + '12' + '08' + Buffer.from('{"a":{}}').toString('hex'));
  const long = 'x'.repeat(200);
  assert.ok(encodeSmartQuery(long, {}).startsWith('0ac801'), 'two-byte length for 200');
  const body = Buffer.from(JSON.stringify({ pools: 'y'.repeat(300) }));
  const framed = Buffer.concat([Buffer.from([0x0a, (body.length & 127) | 128, body.length >> 7]), body]);
  assert.deepEqual(decodeSmartResponse(framed.toString('base64')), { pools: 'y'.repeat(300) });
});

test('the gauge decides what is in the Alliance', () => {
  const known = ALLIANCE.find((p) => p.id === 'luna-ampluna');
  const promoted = OUTER[0];
  const gauge = [
    { key: 'terra1lpa', gauge: 'project', share: 0.6, kind: 'pair', pair: known.pair, type: 'concentrated', venue: 'Astroport' },
    { key: 'terra1lpb', gauge: 'project', share: 0.3, kind: 'pair', pair: 'terra1' + 'z'.repeat(58), type: 'xyk', venue: 'SkeletonSwap' },
    { key: 'factory/terra1hub/ampCAPA', gauge: 'single', share: 0.1, kind: 'single', symbol: 'ampCAPA', venue: 'Eris' },
    { key: 'terra1lpc', gauge: 'stable', share: 1, kind: 'pair', pair: promoted.pair, type: promoted.type, venue: 'Astroport' },
  ];
  const pools = mergeAlliance(gauge, ALLIANCE, OUTER, SECTORS);
  const [a, b, c, d] = pools;
  assert.deepEqual([a.id, a.a, a.b, a.crown, a.fleet, a.sector], ['luna-ampluna', 'LUNA', 'ampLUNA', true, 0.6, 'project']);
  assert.equal(b.venue, 'SkeletonSwap');
  assert.equal(b.b, null);
  assert.deepEqual([c.kind, c.a, c.pair, c.sector], ['single', 'ampCAPA', null, 'single']);
  assert.deepEqual([a.asset, c.asset], ['terra1lpa', 'factory/terra1hub/ampCAPA'], 'each entry keeps the key of its staked asset');
  assert.deepEqual([d.sector, d.outer, d.a], ['stable', false, promoted.a]);
  assert.equal(pools.filter((p) => p.pair === promoted.pair).length, 1, 'a promoted pool leaves the outer list');
  assert.equal(pools.length, 4 + OUTER.length - 1);
  assert.equal(new Set(pools.map((p) => p.id)).size, pools.length);
});

test('uncurated pools are named LUNA first, then the dollar token', () => {
  const pools = [
    { id: 'x', a: 'Pool abcde', b: null, sector: 'project', kind: 'pair', type: 'xyk', pair: 'p1' },
    { id: 'y', a: 'Pool fghij', b: null, sector: 'stable', kind: 'pair', type: 'stable', pair: 'p2' },
  ];
  const live = {
    x: [asset('boneLUNA', 50), asset('LUNA', 100)],
    y: [asset('EURe', 90), asset('USDC.inj', 100, USDC_INJ)],
  };
  const [x, y] = buildSystems(pools, live, { usdKey: USDC_INJ });
  assert.equal(pairName(x), 'LUNA\u2013boneLUNA');
  assert.equal(pairName(y), 'USDC.inj\u2013EURe');
});

test('a pool\'s stake is its staked LP over the LP in issue', () => {
  const pools = [
    { id: 'x', a: 'LUNA', b: 'FOO', sector: 'project', kind: 'pair', type: 'xyk', pair: 'p1', asset: 'lp-x' },
    { id: 'y', a: 'LUNA', b: 'BAR', sector: 'project', kind: 'pair', type: 'xyk', pair: 'p2', asset: 'lp-y' },
    { id: 'z', a: 'LUNA', b: 'BAZ', sector: 'project', kind: 'pair', type: 'xyk', pair: 'p3', asset: 'lp-z' },
    { id: 'o', a: 'LUNA', b: 'QUX', outer: true, kind: 'pair', type: 'xyk', pair: 'p4' },
  ];
  const stakes = stakesFor(pools, { 'lp-x': { raw: 250 }, 'lp-y': { raw: 900 }, 'lp-z': { raw: 5 } }, { x: 1000, y: 600 });
  assert.deepEqual(stakes, { x: { share: 0.25, take: null }, y: { share: 1, take: null } }, 'capped at the whole pool; no supply, no share');
  const live = { x: pool('LUNA', 100, 'FOO', 50), y: pool('LUNA', 10, 'BAR', 5), z: pool('LUNA', 10, 'BAZ', 5), o: pool('LUNA', 10, 'QUX', 5) };
  const by = Object.fromEntries(buildSystems(pools, live, { stakes }).map((s) => [s.id, s]));
  assert.deepEqual([by.x.value, by.x.stakedShare, by.x.staked], [200, 0.25, 50]);
  assert.deepEqual([by.z.stakedShare, by.z.staked, by.o.staked], [null, null, null]);
});

test('a single-token stake is sized by its staked amount once the token has a price', () => {
  const pools = [
    { id: 'p', a: 'LUNA', b: 'CAPA', sector: 'project', kind: 'pair', type: 'xyk', pair: 'p1', asset: 'lp-p' },
    { id: 's', a: 'CAPA', b: null, sector: 'single', kind: 'single', pair: null, asset: 'key-CAPA' },
    { id: 'u', a: 'xFOO', b: null, sector: 'single', kind: 'single', pair: null, asset: 'key-xFOO' },
    { id: 'n', a: 'xBAR', b: null, sector: 'single', kind: 'single', pair: null, asset: 'key-xBAR' },
  ];
  const staked = { 'key-CAPA': { raw: 4e6, key: 'key-CAPA', amount: 4 }, 'key-xFOO': { raw: 7e6, key: 'key-xFOO', amount: 7 }, 'key-xBAR': { raw: 1 } };
  const stakes = stakesFor(pools, staked, {});
  assert.deepEqual(Object.keys(stakes), ['s', 'u'], 'a stake whose decimals are unknown is left out');
  const by = Object.fromEntries(buildSystems(pools, { p: pool('LUNA', 100, 'CAPA', 50) }, { stakes }).map((s) => [s.id, s]));
  assert.deepEqual([by.s.live, by.s.ghost, by.s.value, by.s.staked, by.s.stakedShare], [true, false, 8, 8, 1]);
  assert.deepEqual(by.s.amounts, [{ symbol: 'CAPA', amount: 4 }]);
  assert.deepEqual([by.u.live, by.u.ghost, by.u.value], [false, true, null], 'no price: amount known, still hollow');
  assert.deepEqual(by.u.amounts, [{ symbol: 'xFOO', amount: 7 }]);
  assert.deepEqual([by.n.live, by.n.amounts], [false, null]);
});

test('tribute is valued from the tokens that have a price', () => {
  const pools = [
    { id: 'x', a: 'LUNA', b: 'FOO', sector: 'project', kind: 'pair', type: 'xyk', pair: 'p1', asset: 'lp-x' },
    { id: 'y', a: 'LUNA', b: 'BAR', sector: 'stable', kind: 'pair', type: 'xyk', pair: 'p2', asset: 'lp-y' },
    { id: 'o', a: 'LUNA', b: 'QUX', outer: true, kind: 'pair', type: 'xyk', pair: 'p4' },
  ];
  const live = { x: pool('LUNA', 100, 'FOO', 50), y: pool('LUNA', 10, 'BAR', 5), o: pool('LUNA', 10, 'QUX', 5) };
  const tributes = {
    'project lp-x': [{ key: 'uluna', symbol: 'LUNA', amount: 30 }, { key: 'key-FOO', symbol: 'FOO', amount: 10 }, { key: 'key-ZZZ', symbol: 'ZZZ', amount: 9 }, { key: 'k', symbol: 'unread token', amount: null }],
    'stable lp-x': [{ key: 'uluna', symbol: 'LUNA', amount: 999 }],
  };
  const by = Object.fromEntries(buildSystems(pools, live, { tributes }).map((s) => [s.id, s]));
  assert.deepEqual([by.x.tribute.value, by.x.tribute.unpriced, by.x.tribute.items.length], [50, 2, 4]);
  assert.deepEqual(by.y.tribute, { items: [], value: 0, unpriced: 0 }, 'read, and nothing on offer; another gauge\'s bucket does not count');
  assert.equal(by.o.tribute, null);
  assert.equal(buildSystems(pools, live)[0].tribute, null, 'not read');
});

test('a gauge earns its reward weight over one plus all weights', async () => {
  const { gaugeEmission } = await import('../src/model.js');
  // Figures read from phoenix-1 on 2026-10-05.
  const alliances = [
    { denom: 'factory/blue/vt', weight: 0.05, staked: true }, { denom: 'factory/other/vt', weight: 0.14, staked: true },
    { denom: 'factory/single/vt', weight: 0.05, staked: true }, { denom: 'factory/project/vt', weight: 0.05, staked: true },
    { denom: 'factory/stable/vt', weight: 0.1, staked: true }, { denom: 'factory/x/ampROAR', weight: 0, staked: true },
    { denom: 'factory/nft/AllianceNFT', weight: 0.008, staked: true },
  ];
  const connectors = { stable: 'stable', project: 'project', bluechip: 'blue', single: 'single', missing: 'nope' };
  const e = gaugeEmission({ alliances, annualProvisions: 96792696, connectors });
  assert.deepEqual(Object.keys(e), ['stable', 'project', 'bluechip', 'single']);
  assert.ok(Math.abs(e.stable - 96792696 * 0.1 / 1.398) < 1e-6);
  assert.ok(Math.abs(e.stable / 96792696 - 0.07153) < 1e-5 && Math.abs(e.project / e.stable - 0.5) < 1e-12);
  assert.deepEqual(gaugeEmission({ alliances, annualProvisions: 0, connectors }), {});
});

test('yield is the gauge\'s LUNA times the vote share over the staked value', () => {
  const pools = [
    { id: 'x', a: 'LUNA', b: 'FOO', sector: 'stable', kind: 'pair', type: 'xyk', pair: 'p1', asset: 'lp-x', fleet: 0.25 },
    { id: 'y', a: 'LUNA', b: 'BAR', sector: 'stable', kind: 'pair', type: 'xyk', pair: 'p2', asset: 'lp-y', fleet: 0.75 },
    { id: 'z', a: 'LUNA', b: 'BAZ', sector: 'project', kind: 'pair', type: 'xyk', pair: 'p3', asset: 'lp-z', fleet: 1 },
    { id: 'o', a: 'LUNA', b: 'QUX', outer: true, kind: 'pair', type: 'xyk', pair: 'p4' },
  ];
  const live = { x: pool('LUNA', 100, 'FOO', 50), y: pool('LUNA', 10, 'BAR', 5), z: pool('LUNA', 10, 'BAZ', 5), o: pool('LUNA', 10, 'QUX', 5) };
  const stakes = stakesFor(pools, { 'lp-x': { raw: 500, take: 0.1 }, 'lp-z': { raw: 5 } }, { x: 1000, z: 10 });
  const by = Object.fromEntries(buildSystems(pools, live, { stakes, emission: { stable: 80 } }).map((s) => [s.id, s]));
  assert.deepEqual([by.x.staked, by.x.rewardRate, by.x.take], [100, 0.2, 0.1]); // 80 * 0.25 / 100
  assert.ok(Math.abs(by.x.yield - 0.1) < 1e-12, 'yield is the reward rate less the take');
  assert.deepEqual([by.y.yield, by.z.yield, by.o.yield, by.z.take], [null, null, null, null], 'no stake, no gauge figure, or outside the Alliance');
  // In dollars both sides scale by the same LUNA price, so the rate does not change.
  const usd = buildSystems(pools, live, { stakes, emission: { stable: 80 }, lunaUsd: 0.05 }).find((s) => s.id === 'x');
  assert.ok(Math.abs(usd.rewardRate - 0.2) < 1e-12);
});

test('logos are matched by token key, and by name only for this project\'s own list', async () => {
  const { logoFor, logosFor, LOGO_FILES } = await import('../src/logos.js');
  const { existsSync } = await import('node:fs');
  for (const f of LOGO_FILES) assert.ok(existsSync(new URL('../' + f, import.meta.url)), f + ' exists');
  assert.equal(logoFor('uluna', 'anything'), 'assets/tokens/luna.png');
  assert.equal(logoFor(USDC_INJ, 'USDC'), 'assets/tokens/usdc.png');
  assert.equal(logoFor('terra1ecgazyd0waaj3g7l9cmy5gulhxkps2gmxu9ghducvuypjq68mq2s5lvsct', 'x'), 'assets/tokens/ampluna.png');
  assert.equal(logoFor('terra1fake', 'LUNA'), null, 'a look-alike token gets no logo');
  assert.equal(logoFor(null, 'LUNA'), 'assets/tokens/luna.png');
  assert.equal(logoFor(null, 'Pool abcde'), null);
  // A read pool carries keys; an unread curated one falls back to its names.
  const [x] = buildSystems([{ id: 'x', a: 'LUNA', b: 'FAKE', sector: 'project', kind: 'pair', type: 'xyk', pair: 'p1' }], { x: [asset('LUNA', 100), asset('LUNA', 50, 'terra1fake')] });
  assert.deepEqual(x.keys, ['uluna', 'terra1fake']);
  assert.deepEqual(logosFor(x), ['assets/tokens/luna.png', null]);
  assert.deepEqual(logosFor(buildSystems([{ id: 'y', a: 'LUNA', b: 'EURe', sector: 'stable', kind: 'pair', pair: 'p2' }])[0]), ['assets/tokens/luna.png', 'assets/tokens/eure.png']);
  const single = buildSystems([{ id: 's', a: 'ampCAPA', b: null, sector: 'single', kind: 'single', pair: null, asset: 'factory/terra186rpfczl7l2kugdsqqedegl4es4hp624phfc7ddy8my02a4e8lgq5rlx7y/ampCAPA' }])[0];
  assert.deepEqual(logosFor(single), ['assets/tokens/ampcapa.png', null]);
});

test('the yield formula reproduces the Eris Liquidity Hub figures of 2026-10-07', async () => {
  const { gaugeEmission } = await import('../src/model.js');
  // Chain figures from the probe of 2026-10-05; Eris's yearly reward dollars from its hub.
  const alliances = [0.05, 0.14, 0.05, 0.05, 0.1, 0.008].map((weight, i) => ({ denom: `factory/c${i}/vt`, weight, staked: true }));
  const e = gaugeEmission({ alliances, annualProvisions: 96792696.088, connectors: { stable: 'c4', project: 'c3' } });
  const eris = [
    ['stable', 0.293186, 95750], ['stable', 0.646673, 211190], ['stable', 0.060141, 19640],
    ['project', 0.032320, 5277.70], ['project', 0.036489, 5958.51], ['project', 0.282622, 46150],
  ];
  // Every pool must imply the same LUNA price, and a believable one.
  const prices = eris.map(([gauge, fleet, usd]) => usd / (e[gauge] * fleet));
  for (const p of prices) assert.ok(Math.abs(p / prices[0] - 1) < 0.001, 'one price fits all six pools');
  assert.ok(prices[0] > 0.045 && prices[0] < 0.05);
});

test('tokens are gathered across every system that holds them', () => {
  const pools = [
    { id: 'x', a: 'LUNA', b: 'FOO', sector: 'project', kind: 'pair', type: 'xyk', pair: 'p1' },
    { id: 'y', a: 'LUNA', b: 'BAR', sector: 'project', kind: 'pair', type: 'xyk', pair: 'p2' },
    { id: 'o', a: 'FOO', b: 'ZED', outer: true, kind: 'pair', type: 'stable', pair: 'p3' },
    { id: 'u', a: 'LUNA', b: 'NOPE', sector: 'stable', kind: 'pair', pair: 'p4' },
    { id: 's', a: 'FOO', b: null, sector: 'single', kind: 'single', pair: null, asset: 'key-FOO' },
  ];
  const live = { x: pool('LUNA', 100, 'FOO', 50), y: pool('LUNA', 10, 'BAR', 5), o: [asset('FOO', 4), asset('ZED', 9, 'key-ZED')] };
  const stakes = stakesFor(pools, { 'key-FOO': { raw: 3e6, key: 'key-FOO', amount: 3 } }, {});
  const systems = buildSystems(pools, live, { stakes, lunaUsd: 0.5 });
  const x = systems.find((s) => s.id === 'x');
  assert.deepEqual(x.parts, [
    { key: 'uluna', symbol: 'LUNA', amount: 100, price: 0.5, value: 50, source: { via: 'anchor' } },
    { key: 'key-FOO', symbol: 'FOO', amount: 50, price: 1, value: 50, source: { via: 'pool', id: 'x' } },
  ]);
  const t = tokenIndex(systems);
  assert.deepEqual(Object.keys(t).sort(), ['key-BAR', 'key-FOO', 'key-ZED', 'uluna']);
  assert.deepEqual([t.uluna.amount, t.uluna.value, t.uluna.price, t.uluna.unit], [110, 55, 0.5, 'USD']);
  assert.deepEqual(t.uluna.systems.map((s) => s.id), ['x', 'y'], 'deepest first; an unread system holds nothing');
  assert.deepEqual([t['key-FOO'].amount, t['key-FOO'].value], [57, 57], 'two pools and a single stake');
  assert.deepEqual(t['key-FOO'].systems.map((s) => [s.id, s.outer]), [['x', false], ['o', true], ['s', false]]);
});

test('token descriptions go by key, never by the name a token gives itself', async () => {
  const { tokenAbout, tokenKind } = await import('../src/tokens.js');
  assert.match(tokenAbout('uluna'), /native coin/);
  assert.match(tokenAbout(USDC_INJ), /Injective/);
  assert.match(tokenAbout('terra13lc4xzfmzfgds5zux5pp3zuqf665akrdzwlumnjykrt850n96lvsz5y0wg'), /Deep State Luna/);
  assert.equal(tokenAbout('terra1fake'), '');
  assert.deepEqual(['uluna', 'ibc/AB', 'factory/terra1x/y', 'terra1abc'].map(tokenKind), ['Native coin of Terra', 'Arrived from another chain over IBC', 'Issued on Terra by a contract', 'Contract token on Terra']);
});

test('a quote sets the price where reserves alone would mislead', () => {
  // A concentrated pool holding 100 LUNA and 400 FOO really trades at 2 FOO per LUNA.
  const pools = [{ id: 'c', type: 'concentrated', assets: pool('LUNA', 100, 'FOO', 400), quote: { from: 'uluna', to: 'key-FOO', rate: 2 } }];
  assert.equal(priceByKey(pools)['key-FOO'], 0.5);
  assert.equal(priceByKey([{ ...pools[0], quote: { from: 'key-FOO', to: 'uluna', rate: 0.5 } }])['key-FOO'], 0.5, 'either direction');
  assert.equal(priceByKey([{ ...pools[0], quote: null }])['key-FOO'], 0.25, 'no quote: the reserve ratio');
  const trace = {};
  priceByKey(pools, { known: { 'key-AMP': 2 }, pegs: [['key-FOO', 'key-PEG']], trace });
  assert.deepEqual(trace, { uluna: { via: 'anchor' }, 'key-AMP': { via: 'known' }, 'key-FOO': { via: 'pool', id: 'c' }, 'key-PEG': { via: 'peg', of: 'key-FOO' } });
});

test('pools that disagree on a price are found, and thin ones are told apart', () => {
  const pools = [
    { id: 'deep', a: 'LUNA', b: 'USD', sector: 'stable', kind: 'pair', type: 'concentrated', pair: 'p1' },
    { id: 'off', a: 'LUNA', b: 'FOO', sector: 'project', kind: 'pair', type: 'xyk', pair: 'p2' },
    { id: 'tri', a: 'USD', b: 'FOO', outer: true, kind: 'pair', type: 'xyk', pair: 'p3' },
    { id: 'tiny', a: 'LUNA', b: 'FOO', outer: true, kind: 'pair', type: 'xyk', pair: 'p4' },
    { id: 'mute', a: 'LUNA', b: 'BAR', outer: true, kind: 'pair', type: 'xyk', pair: 'p5' },
  ];
  const USD = 'key-USD';
  const live = {
    deep: [asset('LUNA', 2e6), asset('USD', 1e5, USD)], off: pool('LUNA', 4e5, 'FOO', 2e4), tri: [asset('USD', 1e4, USD), asset('FOO', 1e4)],
    tiny: pool('LUNA', 2000, 'FOO', 100), mute: pool('LUNA', 10, 'BAR', 5),
  };
  const quotes = {
    deep: { from: 'uluna', to: USD, rate: 0.05, fee: 0.003 },       // LUNA = $0.05
    off: { from: 'uluna', to: 'key-FOO', rate: 0.05, fee: 0.003 },  // FOO = $1.00, set here (the deepest pool with FOO)
    tri: { from: USD, to: 'key-FOO', rate: 0.96, fee: 0.003 },      // ...but against dollars FOO costs $1.0417
    tiny: { from: 'uluna', to: 'key-FOO', rate: 0.04, fee: 0.003 }, // and a tiny pool has it at $1.25
  };
  const t = tokenIndex(buildSystems(pools, live, { usdKey: USD, quotes }));
  const foo = t['key-FOO'];
  assert.ok(Math.abs(foo.price - 1) < 1e-9);
  assert.deepEqual(foo.source, { via: 'pool', id: 'off' });
  const by = Object.fromEntries(foo.checks.map((c) => [c.id, c]));
  assert.deepEqual(Object.keys(by).sort(), ['off', 'tiny', 'tri'], 'a pool with no quote is not checked');
  assert.ok(by.off.sets && Math.abs(by.off.gap) < 1e-9, 'the pool that set the price agrees with itself');
  assert.ok(Math.abs(by.tri.gap - (1 / 0.96 - 1)) < 1e-9 && Math.abs(by.tiny.gap - 0.25) < 1e-9);
  assert.deepEqual([gapFlag(by.off, 'USD'), gapFlag(by.tri, 'USD'), gapFlag(by.tiny, 'USD')], ['line', 'gap', 'thin']);
  assert.equal(gapFlag({ gap: 0.012, depth: 1e6, fee: 0.01 }), 'line', 'inside twice the fee');
  const gaps = priceGaps(t);
  assert.deepEqual(gaps.map((g) => g.id), ['tri'], 'one entry per pool; thin pools and the price-setter are left out');
  assert.equal(foo.checks[0].id, 'off', 'deepest first');
});

test('a redemption-rate token prices its neighbours only when no market route exists', () => {
  // ampLUNA redeems for 2 LUNA but trades at 1.9. The dollar must be priced through the
  // LUNA pool, not through the deeper ampLUNA pool at the redemption rate.
  const AMP = 'key-AMP', USD = 'key-USD';
  const pools = [
    { id: 'amp-usd', type: 'concentrated', assets: [asset('AMP', 1e6, AMP), asset('USD', 1e5, USD)], quote: { from: AMP, to: USD, rate: 0.095 } },
    { id: 'luna-usd', type: 'concentrated', assets: [asset('LUNA', 1e5), asset('USD', 5e3, USD)], quote: { from: 'uluna', to: USD, rate: 0.05 } },
    { id: 'amp-only', type: 'xyk', assets: [asset('AMP', 10, AMP), asset('ZED', 40)] },
  ];
  const trace = {};
  const prices = priceByKey(pools, { known: { [AMP]: 2 }, trace });
  assert.equal(prices[USD], 20);
  assert.deepEqual(trace[USD], { via: 'pool', id: 'luna-usd' });
  assert.equal(prices['key-ZED'], 0.5, 'still used when it is the only route');
});
