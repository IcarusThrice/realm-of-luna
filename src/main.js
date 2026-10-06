// Page glue: curated pools + live reserves -> chart, list and reading panel.
import { ERIS_LIQUIDITY_HUB, PEGS, USDC_INJ } from './config.js';
import { TOKENS, UNKNOWN_TOKEN, SECTORS, POOLS } from './realm.js';
import { loadLive, lunaUsd, knownRates } from './chain.js';
import { buildSystems, layout, nextCycle, formatCountdown, formatAmount, formatMass, pairName } from './model.js';
import { createChart } from './scene.js';

const $ = (id) => document.getElementById(id);
const POOL_TYPES = { xyk: 'constant-product pool', concentrated: 'concentrated pool', stable: 'stable pool' };

let systems = [];
let selected = POOLS[0].id;
let listEls = {};

const chart = createChart({
  stage: $('stage'),
  canvas: $('gl'),
  tags: $('tags'),
  sectors: SECTORS,
  tokens: TOKENS,
  unknownColor: UNKNOWN_TOKEN,
  onSelect: select,
});
if (!chart) {
  $('nogl').hidden = false;
  $('gl').hidden = true;
}

// One line on where the system lives and why it may be empty.
function about(s) {
  if (s.kind === 'single') return `A single-token stake on ${s.venue}. The chart cannot read these yet.`;
  if (s.venue !== 'Astroport') return `Trades on ${s.venue}, which the chart cannot read yet.`;
  const where = `Astroport ${POOL_TYPES[s.type] || 'pool'}`;
  if (s.outer) return `${where}. Not in the Liquidity Alliance, so it earns no gauge rewards.`;
  return `${where} in the ${SECTORS[s.sector].gauge} gauge.`;
}

function select(id) {
  const s = systems.find((x) => x.id === id) || systems[0];
  if (!s) return;
  selected = s.id;
  $('p-eyebrow').textContent = `${s.outer ? 'The Interchain Deep' : SECTORS[s.sector].name} · ${s.tier}`;
  $('p-name').textContent = pairName(s);

  const pair = $('p-pair');
  pair.textContent = '';
  for (const sym of [s.a, s.b].filter(Boolean)) {
    const span = document.createElement('span');
    const dot = document.createElement('i');
    dot.className = 'dot';
    dot.style.background = TOKENS[sym] || UNKNOWN_TOKEN;
    span.appendChild(dot);
    span.appendChild(document.createTextNode(sym));
    pair.appendChild(span);
  }
  $('p-about').textContent = about(s) + (s.crown ? ' Holds chain-owned liquidity.' : '');

  const reserves = s.amounts ? s.amounts.map((x) => `${formatAmount(x.amount)} ${x.symbol}`).join(' + ') : '';
  $('v-mass').textContent = s.live ? formatMass(s.value, s.unit) : s.amounts ? 'Not priced' : 'Not read yet';
  $('v-mass-note').textContent = s.amounts ? `${reserves}, live from Astroport` : 'Value held in the pool';
  const rewards = s.outer ? 'Not in the Alliance' : 'Needs Eris data';
  for (const key of ['v-yield', 'v-fleet', 'v-tribute']) $(key).textContent = rewards;
  $('acts').hidden = s.outer;

  for (const [key, el] of Object.entries(listEls)) el.setAttribute('aria-pressed', key === s.id ? 'true' : 'false');
  if (chart) chart.setSelected(s.id);
}

function render(next) {
  systems = layout(next, SECTORS);

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

  const sum = (xs) => xs.reduce((t, s) => t + s.value, 0);
  const inside = systems.filter((s) => s.live && !s.outer);
  const outside = systems.filter((s) => s.live && s.outer);
  const unit = (inside[0] || outside[0] || {}).unit;
  $('r-mass').textContent = inside.length ? formatMass(sum(inside), unit) : 'Not read yet';
  $('r-outer').textContent = outside.length ? formatMass(sum(outside), unit) : 'Not read yet';
  $('r-data').textContent = `${inside.length + outside.length} of ${systems.length} read live`;
}

function tick() {
  $('r-cycle').textContent = 'in ' + formatCountdown(nextCycle() - new Date());
}

for (const a of document.querySelectorAll('[data-eris]')) a.href = ERIS_LIQUIDITY_HUB;
$('zin').addEventListener('click', () => chart && chart.zoom(0.85));
$('zout').addEventListener('click', () => chart && chart.zoom(1.18));
$('reset').addEventListener('click', () => chart && chart.reset());
$('lanes').addEventListener('change', (e) => chart && chart.setLanes(e.target.checked));

// Draw the chart at once with every system uncharted, then fill in live reserves.
render(buildSystems(POOLS));
tick();
setInterval(tick, 60000);

(async () => {
  const [{ live, errors }, price, known] = await Promise.all([loadLive(POOLS), lunaUsd(), knownRates()]);
  if (errors.length) console.warn('Realm of Luna: some pools could not be read.', errors);
  if (Object.keys(live).length) {
    render(buildSystems(POOLS, live, { pegs: PEGS, known, usdKey: USDC_INJ, lunaUsd: price }));
  } else if (errors.length) {
    $('r-data').textContent = 'Chain unreachable';
  }
})();
