import test from 'node:test';
import assert from 'node:assert/strict';
import { priceByKey, rankByDepth, buildSystems, mergeAlliance, stakesFor, layout, nextCycle, formatCountdown, formatMass, pairName, PLATE_RADIUS } from '../src/model.js';
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
  const net = gaugeEmission({ alliances, annualProvisions: 96792696, connectors, commission: 0.05 });
  assert.ok(Math.abs(net.stable / e.stable - 0.95) < 1e-12);
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
  assert.deepEqual([by.x.staked, by.x.yield, by.x.take], [100, 0.2, 0.1]); // 80 * 0.25 / 100
  assert.deepEqual([by.y.yield, by.z.yield, by.o.yield, by.z.take], [null, null, null, null], 'no stake, no gauge figure, or outside the Alliance');
  // In dollars both sides scale by the same LUNA price, so the rate does not change.
  const usd = buildSystems(pools, live, { stakes, emission: { stable: 80 }, lunaUsd: 0.05 }).find((s) => s.id === 'x');
  assert.ok(Math.abs(usd.yield - 0.2) < 1e-12);
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
