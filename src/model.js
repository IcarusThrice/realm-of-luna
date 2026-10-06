// Pure functions: chain numbers in, chart-ready systems out. No DOM, no network.

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// Price every token in LUNA, by token key (denom or contract address), never by symbol:
// anyone can mint a token and call it "LUNA" or "USDC".
//
// pools: [{ assets: [{ key, amount }, { key, amount }], type }]
// Prices spread outward from native LUNA. Constant-product (xyk) pools go first because
// their reserve ratio is the price; other pool types are only an approximation. Within a
// type the deepest pool goes first, so a thin skewed pool cannot set a price a deep pool
// also knows. A pool whose priced side is worth less than `floor` LUNA sets no price at
// all. `known` seeds exact prices (ampLUNA from the Eris hub). `pegs` are groups of keys
// valued alike (dollar stablecoins).
export function priceByKey(pools, { anchor = 'uluna', pegs = [], known = {}, floor = 0 } = {}) {
  const prices = { ...known, [anchor]: 1 };
  const setPrice = (key, price) => {
    prices[key] = price;
    for (const group of pegs) {
      if (group.includes(key)) for (const k of group) if (!(k in prices)) prices[k] = price;
    }
  };
  for (const key of Object.keys(known)) setPrice(key, known[key]);
  const usable = (p) => p && p.assets && p.assets.length === 2 && p.assets.every((a) => a.amount > 0);
  const todo = new Set(pools.filter(usable));
  for (;;) {
    let best = null, bestVal = 0, bestRank = 9;
    for (const p of todo) {
      const priced = p.assets.filter((a) => a.key in prices);
      if (priced.length === 2) { todo.delete(p); continue; }
      if (priced.length !== 1) continue;
      const val = priced[0].amount * prices[priced[0].key];
      if (val < floor) continue;
      const rank = p.type === 'xyk' ? 0 : 1;
      if (rank < bestRank || (rank === bestRank && val > bestVal)) { best = p; bestVal = val; bestRank = rank; }
    }
    if (!best) break;
    const unknown = best.assets.find((a) => !(a.key in prices));
    setPrice(unknown.key, bestVal / unknown.amount);
    todo.delete(best);
  }
  return prices;
}

// Value of one pool in LUNA. With one side unpriced, assume the pool is balanced.
export function poolDepth(assets, prices) {
  const vals = (assets || []).map((a) => (a.key in prices ? a.amount * prices[a.key] : null));
  const known = vals.filter((v) => v != null);
  return { vals, depth: known.length === 2 ? known[0] + known[1] : known.length === 1 ? 2 * known[0] : 0 };
}

// Rank many pools by depth in LUNA, deepest first.
export function rankByDepth(pools, opts) {
  const prices = priceByKey(pools, opts);
  const ranked = pools.map((p) => ({ ...p, depth: poolDepth(p.assets, prices).depth }));
  return { prices, ranked: ranked.sort((x, y) => y.depth - x.depth) };
}

// Merge the curated pools with live reserves.
//   opts.pegs, opts.known  passed to pricing
//   opts.usdKey            token taken as one dollar; dollars then come from the chain itself
//   opts.lunaUsd           fallback LUNA price when no pool holds usdKey
//   opts.stakes            from stakesFor(): what is staked through the Alliance
//   opts.tributes          { 'gauge assetKey': [{ key, symbol, amount }] }: voter incentives
//   opts.emission          from gaugeEmission(): LUNA each gauge earns per year
// Each system gets: live (priced reserves), ghost (nothing to read yet), value, unit,
// amounts, shareA (first token's share of the value), size and tier. With stakes it also
// gets stakedShare (part of the pool that is staked) and staked (that part's value).
// A single-token stake has no pool: its whole mass is the staked amount.
// With tributes, every Alliance system gets tribute: { items, value, unpriced }, where
// value covers the tokens that have a price and unpriced counts the ones that do not.
// With emission, a system with a staked value and a share of the votes gets yield: the
// LUNA its stakers earn in a year over the value staked (0.5 is 50%). It is an estimate.
export function buildSystems(pools, live = {}, opts = {}) {
  const prices = priceByKey(
    pools.filter((p) => live[p.id]).map((p) => ({ assets: live[p.id], type: p.type })),
    { pegs: opts.pegs || [], known: opts.known || {} },
  );
  const lunaUsd = opts.usdKey && prices[opts.usdKey] > 0 ? 1 / prices[opts.usdKey] : opts.lunaUsd > 0 ? opts.lunaUsd : 0;
  const unit = lunaUsd ? 'USD' : 'LUNA';

  const tributeOf = (p) => {
    if (!opts.tributes || p.outer || !p.asset) return null;
    const items = opts.tributes[p.sector + ' ' + p.asset] || [];
    const priced = items.filter((x) => x.amount != null && prices[x.key] > 0);
    return { items, value: priced.reduce((t, x) => t + x.amount * prices[x.key], 0) * (lunaUsd || 1), unpriced: items.length - priced.length };
  };

  const systems = pools.map((p) => {
    const assets = live[p.id];
    const s = { ...p, outer: !!p.outer, live: false, ghost: !p.pair, value: null, unit, amounts: null, shareA: p.kind === 'single' ? 1 : 0.5, staked: null, stakedShare: null, tribute: tributeOf(p) };
    const stake = (opts.stakes || {})[p.id];
    if (p.kind === 'single') {
      if (!stake || !(stake.amount >= 0)) return s;
      s.amounts = [{ symbol: p.a, amount: stake.amount }];
      const price = prices[stake.key];
      if (!(price > 0) || !(stake.amount > 0)) return s;
      s.live = true;
      s.ghost = false;
      s.value = s.staked = stake.amount * price * (lunaUsd || 1);
      s.stakedShare = 1;
      return s;
    }
    if (stake && stake.share >= 0) s.stakedShare = stake.share;
    if (!assets || assets.length !== 2) return s;
    // Match chain assets to the curated a/b order by symbol; otherwise lead with LUNA,
    // then USDC.inj, the way the Eris Liquidity Hub names its pools.
    const lead = (x) => (x.key === 'uluna' ? 0 : x.key === opts.usdKey ? 1 : 2);
    const first = assets.find((x) => x.symbol === p.a) || (lead(assets[1]) < lead(assets[0]) ? assets[1] : assets[0]);
    const second = assets.find((x) => x !== first);
    s.a = first.symbol; s.b = second.symbol;
    s.amounts = [{ symbol: first.symbol, amount: first.amount }, { symbol: second.symbol, amount: second.amount }];
    const { vals, depth } = poolDepth([first, second], prices);
    if (!(depth > 0)) return s;
    s.live = true;
    s.value = depth * (lunaUsd || 1);
    s.shareA = vals[0] != null && vals[1] != null ? clamp(vals[0] / depth, 0.2, 0.8) : 0.5;
    if (s.stakedShare != null) s.staked = s.value * s.stakedShare;
    return s;
  });

  const emission = opts.emission || {};
  for (const s of systems) {
    const perYear = emission[s.sector];
    s.take = ((opts.stakes || {})[s.id] || {}).take ?? null;
    s.yield = !s.outer && perYear > 0 && s.staked > 0 && s.fleet >= 0 ? (perYear * s.fleet * (lunaUsd || 1)) / s.staked : null;
  }

  // Size by live mass. A power curve keeps a $20K pool visibly smaller than a $1M pool
  // without vanishing. Anything not read yet takes the smallest size.
  const liveVals = systems.filter((s) => s.live).map((s) => s.value);
  const top = liveVals.length ? Math.max(...liveVals) : 0;
  for (const s of systems) {
    s.size = s.live ? 0.42 + 0.58 * Math.pow(s.value / top, 0.3) : 0.5;
    s.tier = !s.live ? 'Uncharted' : s.size >= 0.87 ? 'Stronghold' : s.size >= 0.6 ? 'Colony' : 'Outpost';
  }
  return systems;
}

// Turn raw staking-contract balances into what buildSystems needs.
//   staked: { assetKey: { raw, amount?, key? } } from the staking contracts
//   supply: { poolId: LP tokens in issue }
// A pool's stake becomes a share of the pool (staked LP / LP in issue). A single-token
// stake keeps its token key and whole-token amount so it can be priced.
export function stakesFor(pools, staked = {}, supply = {}) {
  const out = {};
  for (const p of pools) {
    const st = p.asset && staked[p.asset];
    if (!st) continue;
    const take = st.take >= 0 ? st.take : null;
    if (p.kind === 'single') {
      if (st.amount >= 0) out[p.id] = { key: st.key, amount: st.amount, take };
    } else if (supply[p.id] > 0) {
      out[p.id] = { share: clamp(st.raw / supply[p.id], 0, 1), take };
    }
  }
  return out;
}

// LUNA each gauge earns per year, from the chain's Alliance module.
// Every Alliance token has a reward weight w. The module gives it staking power equal to
// w times the native stake, so it earns w / (1 + sum of all weights) of what the chain
// mints for stakers. Each gauge's connector owns one such token: factory/<connector>/vt.
//   alliances: [{ denom, weight, staked }]   annualProvisions: LUNA minted per year
//   connectors: { gauge: connectorAddress }  commission: validators' mean cut, or null
export function gaugeEmission({ alliances = [], annualProvisions = 0, connectors = {}, commission = null } = {}) {
  const earning = alliances.filter((a) => a.weight > 0 && a.staked !== false);
  const total = 1 + earning.reduce((t, a) => t + a.weight, 0);
  const out = {};
  for (const [gauge, addr] of Object.entries(connectors)) {
    const a = earning.find((x) => x.denom === `factory/${addr}/vt`);
    if (a && annualProvisions > 0) out[gauge] = annualProvisions * (a.weight / total) * (1 - (commission || 0));
  }
  return out;
}

function hash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h;
}

// Build the pool list from the live gauge data. Every gauge asset becomes an Alliance
// entry in its gauge's sector, carrying its share of the votes ("fleet") and the key of the
// staked asset (the pool's LP token, or the token itself for a single stake). Curated entries
// lend their id, token order and crown mark when the pool address matches. Outer pools
// that turn out to be in a gauge are dropped from the outer list.
export function mergeAlliance(gaugeAssets, curated, outer, sectors) {
  const byPair = new Map(curated.filter((p) => p.pair).map((p) => [p.pair, p]));
  const outerByPair = new Map(outer.map((p) => [p.pair, p]));
  const alliance = gaugeAssets.map((g) => {
    const known = (g.pair && (byPair.get(g.pair) || outerByPair.get(g.pair))) || null;
    const single = g.kind === 'single';
    return {
      id: known && !known.outer ? known.id : 'gauge-' + g.key.replace(/[^a-z0-9]/gi, '').slice(-16),
      a: known ? known.a : single ? g.symbol : 'Pool ' + (g.pair || g.key).slice(-5),
      b: known ? known.b : null,
      sector: sectors[g.gauge] ? g.gauge : null,
      outer: !sectors[g.gauge],
      kind: single ? 'single' : 'pair',
      venue: g.venue,
      type: g.type || null,
      crown: !!(known && known.crown),
      pair: g.pair || null,
      asset: g.key,
      fleet: g.share,
    };
  });
  const taken = new Set(alliance.map((p) => p.pair).filter(Boolean));
  return [...alliance, ...outer.filter((p) => !taken.has(p.pair))];
}

// Place every system: polar radius, angle in degrees, and height above the plate.
// Alliance systems sit inside their gauge's wedge, neighbours alternating between three
// rings so labels have room. Outer systems ring the plate beyond its rim.
export const PLATE_RADIUS = 14;
const RINGS = [5.8, 11.8, 8.8];
const OUTER_RINGS = [18.2, 21.4];
export function layout(systems, sectors) {
  const bySector = {};
  const outer = [];
  for (const s of systems) {
    if (s.outer || !sectors[s.sector]) outer.push(s);
    else (bySector[s.sector] = bySector[s.sector] || []).push(s);
  }
  for (const key of Object.keys(bySector)) {
    const list = bySector[key];
    const { from, span } = sectors[key];
    list.forEach((s, i) => {
      s.deg = from + span * (i + 0.5) / list.length;
      s.r = RINGS[i % RINGS.length];
      s.y = 1.4 + (hash(s.id) % 20) / 10;
    });
  }
  outer.forEach((s, i) => {
    s.deg = (360 * (i + 0.5)) / outer.length;
    s.r = OUTER_RINGS[i % OUTER_RINGS.length];
    s.y = 0.4 + (hash(s.id) % 26) / 10;
  });
  return systems;
}

// The Liquidity Alliance epoch rolls over every Sunday at 12:00 UTC.
export function nextCycle(now = new Date()) {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 12, 0, 0));
  d.setUTCDate(d.getUTCDate() + ((7 - d.getUTCDay()) % 7));
  if (d <= now) d.setUTCDate(d.getUTCDate() + 7);
  return d;
}

export function formatCountdown(ms) {
  const mins = Math.max(0, Math.floor(ms / 60000));
  const d = Math.floor(mins / 1440), h = Math.floor((mins % 1440) / 60), m = mins % 60;
  return d > 0 ? `${d}d ${h}h` : h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function formatAmount(v) {
  if (v == null || !isFinite(v)) return '';
  const abs = Math.abs(v);
  if (abs >= 1e9) return (v / 1e9).toFixed(2) + 'B';
  if (abs >= 1e6) return (v / 1e6).toFixed(2) + 'M';
  if (abs >= 1e3) return (v / 1e3).toFixed(1) + 'K';
  if (abs >= 1) return v.toFixed(2);
  return v.toPrecision(3);
}

export function formatMass(value, unit) {
  if (value == null) return '';
  return unit === 'USD' ? '$' + formatAmount(value) : formatAmount(value) + ' ' + unit;
}

// "LUNA–USDC.inj" for a pair, "ampCAPA" for a single-token stake.
export function pairName(s) {
  return s.b ? `${s.a}–${s.b}` : s.a;
}
