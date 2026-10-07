// Page glue: curated pools + live reserves -> chart, list and reading panel.
import { ERIS_LIQUIDITY_HUB, ERIS_CONNECTORS, PEGS, USDC_INJ } from './config.js';
import { TOKENS, UNKNOWN_TOKEN, SECTORS, POOLS, ALLIANCE, OUTER } from './realm.js';
import { loadLive, loadAlliance, loadStaked, loadTribute, loadEscrow, loadEmission, loadTokenFacts, lunaUsd, knownRates } from './chain.js';
import { buildSystems, mergeAlliance, stakesFor, gaugeEmission, tokenIndex, layout, nextCycle, formatCountdown, formatAmount, formatMass, pairName } from './model.js';
import { createChart } from './scene.js';
import { logosFor, logoFor } from './logos.js';
import { tokenKind, tokenAbout } from './tokens.js';

const $ = (id) => document.getElementById(id);
const POOL_TYPES = { xyk: 'constant-product pool', concentrated: 'concentrated pool', stable: 'stable pool' };

let systems = [];
let selected = POOLS[0].id;
let listEls = {};
let period = null;
let tokens = {};          // every token on the chart, by key
let shownToken = null;    // key of the token in the panel, or null when a pool is shown
let yieldRead = false; // true once the chain's reward figures are read
const percent = (x) => (x >= 10 ? 'over 1,000%' : (x < 0 ? '\u2212' : '') + (Math.abs(x) * 100).toFixed(Math.abs(x) < 0.1 ? 1 : 0) + '%');

const chart = createChart({
  stage: $('stage'),
  canvas: $('gl'),
  tags: $('tags'),
  sectors: SECTORS,
  tokens: TOKENS,
  unknownColor: UNKNOWN_TOKEN,
  logosFor,
  onSelect: select,
  onPick: pick,
});
if (!chart) {
  $('nogl').hidden = false;
  $('gl').hidden = true;
}

// One line on where the system lives and why it may be empty.
function about(s) {
  if (s.kind === 'single') {
    const why = s.live ? '' : s.amounts ? ' The chart has no price for this token yet, so it is not sized.' : ' Its staked amount could not be read.';
    return `A single-token stake in the ${SECTORS[s.sector].gauge} gauge.${why}`;
  }
  const where = `${s.venue} ${POOL_TYPES[s.type] || 'pool'}`;
  const unread = s.amounts ? '' : ' Its reserves could not be read.';
  if (s.outer) return `${where}. Not in the Liquidity Alliance, so it earns no gauge rewards.${unread}`;
  return `${where} in the ${SECTORS[s.sector].gauge} gauge.${unread}`;
}

// A planet was clicked. Select its system, and show the token if the chain has told us
// which token it is. The Moon stands for LUNA.
function pick(hit) {
  if (hit.moon) { showToken('uluna'); return; }
  const s = systems.find((x) => x.id === hit.id);
  if (!s) return;
  select(s.id);
  const key = s.keys && s.keys[hit.index];
  if (key) showToken(key);
}

const money = (v, unit) => (v == null ? '' : unit === 'USD' ? '$' + (v >= 1000 ? formatAmount(v) : v >= 1 ? v.toFixed(2) : v.toPrecision(3)) : formatAmount(v) + ' ' + unit);

function showToken(key) {
  const t = tokens[key];
  if (!t && key !== 'uluna') return;
  shownToken = key;
  $('view-token').hidden = false;
  $('view-system').hidden = true;
  const symbol = t ? t.symbol : 'LUNA';
  const logo = logoFor(key, symbol);
  $('t-kind').textContent = tokenKind(key);
  $('t-name').textContent = symbol;
  $('t-logo').hidden = !logo;
  if (logo) $('t-logo').src = logo;
  $('t-about').textContent = tokenAbout(key) || 'This chart has no description for this token. It is shown under the name its own contract reports.';

  const priced = t && t.price != null;
  $('t-price').textContent = priced ? money(t.price, t.unit) : 'Not priced';
  $('t-price').classList.toggle('live', priced);
  $('t-price-note').textContent = priced ? (t.unit === 'USD' ? 'From pool reserves on Terra, taking one USDC.inj as one dollar' : 'From pool reserves on Terra, in LUNA') : 'No pool on this chart gives it a price';

  const held = t ? `${formatAmount(t.amount)} ${symbol}` : '';
  $('t-held').textContent = !t ? 'Not read yet' : priced ? formatMass(t.value, t.unit) : held;
  $('t-held').classList.toggle('live', !!t);
  $('t-held-note').textContent = t ? `${held} across ${t.systems.length} ${t.systems.length === 1 ? 'system' : 'systems'} on this chart` : 'Held across the systems on this chart';

  const row = $('t-systems');
  row.textContent = '';
  for (const sys of t ? t.systems : []) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = sys.name + (sys.value != null ? ' \u00b7 ' + formatMass(sys.value, t.unit) : '');
    if (sys.outer) b.className = 'ghost';
    b.addEventListener('click', () => select(sys.id));
    row.appendChild(b);
  }

  $('t-key').textContent = key;
  $('t-copy').textContent = key.startsWith('terra1') ? 'Copy address' : 'Copy denom';
  $('t-explore').hidden = !key.startsWith('terra1');
  if (key.startsWith('terra1')) $('t-explore').href = 'https://chainsco.pe/terra2/address/' + key;
  const cur = systems.find((x) => x.id === selected);
  $('t-back').textContent = cur ? `Back to ${pairName(cur)}` : 'Back to the pool';

  // Supply is read from the chain when the token is opened.
  $('t-supply').textContent = 'Reading\u2026';
  $('t-supply').classList.remove('live');
  $('t-supply-note').textContent = key.startsWith('ibc/') ? 'How much has been brought to Terra' : 'How much of it exists on this chain';
  $('t-bonded-row').hidden = key !== 'uluna';
  if (key === 'uluna') { $('t-bonded').textContent = 'Reading\u2026'; $('t-bonded').classList.remove('live'); }
  loadTokenFacts(key).then((f) => {
    if (shownToken !== key) return; // another token was opened meanwhile
    const has = f.supply > 0;
    $('t-supply').textContent = has ? `${formatAmount(f.supply)} ${symbol}` : 'Could not be read';
    $('t-supply').classList.toggle('live', has);
    if (has) {
      const worth = priced ? `Worth ${formatMass(f.supply * t.price, t.unit)} at this price. ` : '';
      const share = t && t.amount > 0 ? `${percent(t.amount / f.supply)} of it sits in these pools.` : '';
      $('t-supply-note').textContent = (key.startsWith('ibc/') ? 'Brought to Terra from another chain. ' : 'Live from the chain. ') + worth + share;
    }
    if (key === 'uluna') {
      const ok = f.bonded > 0 && has;
      $('t-bonded').textContent = ok ? `${formatAmount(f.bonded)} LUNA` : 'Could not be read';
      $('t-bonded').classList.toggle('live', ok);
      $('t-bonded-note').textContent = ok ? `${percent(f.bonded / f.supply)} of all LUNA is bonded with validators, live from the chain` : 'Bonded with validators';
    }
  });
}

function hideToken() {
  shownToken = null;
  $('view-token').hidden = true;
  $('view-system').hidden = false;
}

function select(id) {
  const s = systems.find((x) => x.id === id) || systems[0];
  if (!s) return;
  selected = s.id;
  hideToken();
  $('p-eyebrow').textContent = `${s.outer ? 'The Interchain Deep' : SECTORS[s.sector].name} · ${s.tier}`;
  $('p-name').textContent = pairName(s);

  const pair = $('p-pair');
  pair.textContent = '';
  const logos = logosFor(s);
  for (const [i, sym] of [s.a, s.b].entries()) {
    if (!sym) continue;
    // A token the chain has identified can be opened; one known only by name cannot.
    const key = s.keys && s.keys[i];
    const span = document.createElement(key ? 'button' : 'span');
    if (key) { span.type = 'button'; span.title = `About ${sym}`; span.addEventListener('click', () => showToken(key)); }
    const dot = document.createElement(logos[i] ? 'img' : 'i');
    dot.className = 'dot';
    if (logos[i]) { dot.src = logos[i]; dot.alt = ''; } else dot.style.background = TOKENS[sym] || UNKNOWN_TOKEN;
    span.appendChild(dot);
    span.appendChild(document.createTextNode(sym));
    pair.appendChild(span);
  }
  $('p-about').textContent = about(s) + (s.crown ? ' Holds chain-owned liquidity.' : '');

  const reserves = s.amounts ? s.amounts.map((x) => `${formatAmount(x.amount)} ${x.symbol}`).join(' + ') : '';
  $('v-mass').textContent = s.live ? formatMass(s.value, s.unit) : s.amounts ? 'Not priced' : 'Not read yet';
  const single = s.kind === 'single';
  $('v-mass-note').textContent = s.amounts ? (single ? `${reserves} staked, live from Eris` : `${reserves}, live from ${s.venue}`) : 'Value held in the pool';

  // Settled: the part of the pool that is staked through the Alliance.
  const pct = s.stakedShare == null ? '' : s.stakedShare > 0 && s.stakedShare < 0.001 ? 'under 0.1%' : (s.stakedShare * 100).toFixed(1) + '%';
  const settled = s.outer ? 'Not in the Alliance' : s.staked != null ? formatMass(s.staked, s.unit) : pct ? pct + ' of the pool' : 'Not read yet';
  $('v-settled').textContent = settled;
  $('v-settled').classList.toggle('live', !s.outer && s.stakedShare != null);
  $('v-settled-note').textContent = s.outer || s.stakedShare == null ? 'Staked through the Alliance'
    : single ? 'The whole system is the stake, live from Eris'
    : s.staked != null ? `${pct} of the pool is staked, live from Eris` : 'Staked through the Alliance, live from Eris';
  // Yield: LUNA rewards on the staked value, less the Alliance's take. An estimate.
  const hasYield = !s.outer && s.yield != null;
  $('v-yield').textContent = s.outer ? 'Not in the Alliance' : hasYield ? `~${percent(s.yield)} est.` : !yieldRead ? 'Not read yet' : 'Needs a staked value';
  $('v-yield').classList.toggle('live', hasYield);
  $('v-yield-note').textContent = !hasYield ? 'Yearly reward rate for settlers'
    : `${percent(s.rewardRate)} a year in LUNA rewards on the staked value` + (s.take > 0 ? `, less the Alliance's ${percent(s.take)} yearly take` : '')
      + '. Swap fees are not counted.';

  // Tribute: what is on offer to the houses that vote for this system.
  const tr = s.tribute;
  const offered = tr && tr.items.length > 0;
  const extra = offered && tr.unpriced ? (tr.value > 0 ? ' + ' : '') + (tr.unpriced === 1 ? '1 unpriced token' : tr.unpriced + ' unpriced tokens') : '';
  $('v-tribute').textContent = s.outer ? 'Not in the Alliance' : !tr ? 'Not read yet' : !offered ? 'None on offer' : (tr.value > 0 ? formatMass(tr.value, s.unit) : '') + extra;
  $('v-tribute').classList.toggle('live', !s.outer && !!tr);
  $('v-tribute-note').textContent = offered
    ? tr.items.map((x) => (x.amount == null ? 'an ' + x.symbol : `${formatAmount(x.amount)} ${x.symbol}`)).join(' + ') + ' on offer to voters, live from Eris'
    : 'Paid to houses that send a fleet here';
  const hasFleet = !s.outer && typeof s.fleet === 'number';
  $('v-fleet').textContent = s.outer ? 'Not in the Alliance' : hasFleet ? (s.fleet * 100).toFixed(1) + '%' : 'Not read yet';
  $('v-fleet').classList.toggle('live', hasFleet);
  $('v-fleet-note').textContent = hasFleet ? `Share of the ${SECTORS[s.sector].gauge} gauge's votes, live from Eris` : "Share of this cycle's votes";
  $('acts').hidden = s.outer;

  for (const [key, el] of Object.entries(listEls)) el.setAttribute('aria-pressed', key === s.id ? 'true' : 'false');
  if (chart) chart.setSelected(s.id);
}

function render(next) {
  systems = layout(next, SECTORS);
  tokens = tokenIndex(systems);
  const keep = shownToken;

  // The list mirrors the chart: one group per gauge, then everything outside the Alliance.
  const list = $('list');
  list.textContent = '';
  listEls = {};
  const groups = [
    ...Object.entries(SECTORS).map(([key, sec]) => ({ title: `${sec.gauge} gauge`, items: systems.filter((s) => !s.outer && s.sector === key) })),
    { title: 'Outside the Alliance', items: systems.filter((s) => s.outer) },
  ];
  for (const g of groups) {
    if (!g.items.length) continue;
    const h = document.createElement('h4');
    h.textContent = g.title;
    list.appendChild(h);
    const row = document.createElement('div');
    row.className = 'chips';
    for (const s of g.items) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = pairName(s) + (s.venue === 'SkeletonSwap' ? ' (Skeleton)' : '');
      if (s.ghost) b.className = 'ghost';
      b.addEventListener('click', () => select(s.id));
      row.appendChild(b);
      listEls[s.id] = b;
    }
    list.appendChild(row);
  }
  if (chart) chart.setSystems(systems);
  select(selected);
  if (keep && (tokens[keep] || keep === 'uluna')) showToken(keep); // stay on the token through a data refresh

  const sum = (xs) => xs.reduce((t, s) => t + s.value, 0);
  const inside = systems.filter((s) => s.live && !s.outer);
  const outside = systems.filter((s) => s.live && s.outer);
  const unit = (inside[0] || outside[0] || {}).unit;
  $('r-mass').textContent = inside.length ? formatMass(sum(inside), unit) : 'Not read yet';
  $('r-outer').textContent = outside.length ? formatMass(sum(outside), unit) : 'Not read yet';
  const settled = inside.filter((s) => s.staked != null);
  $('r-settled').textContent = settled.length ? formatMass(settled.reduce((t, s) => t + s.staked, 0), unit) : 'Not read yet';
  const paying = systems.filter((s) => s.tribute);
  $('r-tribute').textContent = paying.length ? formatMass(paying.reduce((t, s) => t + s.tribute.value, 0), paying[0].unit) : 'Not read yet';
  $('r-data').textContent = `${inside.length + outside.length} of ${systems.length} live`;
}

function tick() {
  $('r-cycle').textContent = (period != null ? `${period}, next ` : '') + 'in ' + formatCountdown(nextCycle() - new Date());
}

for (const a of document.querySelectorAll('[data-eris]')) a.href = ERIS_LIQUIDITY_HUB;
$('t-back').addEventListener('click', hideToken);
$('t-copy').addEventListener('click', async () => {
  const label = $('t-copy').textContent;
  try { await navigator.clipboard.writeText($('t-key').textContent); $('t-copy').textContent = 'Copied'; } catch (err) { $('t-copy').textContent = 'Select the text above to copy'; }
  setTimeout(() => { $('t-copy').textContent = label; }, 1600);
});
$('zin').addEventListener('click', () => chart && chart.zoom(0.85));
$('zout').addEventListener('click', () => chart && chart.zoom(1.18));
$('reset').addEventListener('click', () => chart && chart.reset());
$('lanes').addEventListener('change', (e) => chart && chart.setLanes(e.target.checked));

// Draw the chart at once with every system uncharted, then fill in live reserves.
render(buildSystems(POOLS));
tick();
setInterval(tick, 60000);

(async () => {
  // The gauge contract is the source of truth for what is in the Alliance. If it cannot
  // be read, fall back to the list copied from the Eris Liquidity Hub.
  let pools = POOLS;
  let gaugeAssets = [];
  try {
    const alliance = await loadAlliance();
    if (alliance.assets.length) {
      gaugeAssets = alliance.assets;
      pools = mergeAlliance(gaugeAssets, ALLIANCE, OUTER, SECTORS);
      period = alliance.period;
      tick();
    }
  } catch (err) {
    console.warn('Realm of Luna: the gauge could not be read, using the built-in list.', err);
  }
  loadEscrow().then((e) => {
    if (e && chart) chart.setCourt(`${e.locks} locks hold ${formatAmount(e.votes)} votes`);
  });
  const [{ live, supply, errors }, staked, tributes, chainPay, price, known] = await Promise.all([loadLive(pools), loadStaked(gaugeAssets), loadTribute(), loadEmission(), lunaUsd(), knownRates()]);
  const emission = chainPay ? gaugeEmission({ ...chainPay, connectors: ERIS_CONNECTORS }) : {};
  if (Object.keys(emission).length) yieldRead = true;
  if (errors.length) console.warn('Realm of Luna: some pools could not be read.', errors);
  if (Object.keys(live).length) {
    const stakes = stakesFor(pools, staked, supply);
    render(buildSystems(pools, live, { pegs: PEGS, known, usdKey: USDC_INJ, lunaUsd: price, stakes, tributes, emission }));
  } else {
    render(buildSystems(pools));
    $('r-data').textContent = 'Chain unreachable';
  }
})();
