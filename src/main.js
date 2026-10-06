// Page glue: curated pools + live reserves -> chart, list and reading panel.
import { ERIS_LIQUIDITY_HUB } from './config.js';
import { TOKENS, UNKNOWN_TOKEN, SECTORS, POOLS } from './realm.js';
import { loadLive, lunaUsd } from './chain.js';
import { buildSystems, layout, nextCycle, formatCountdown, formatAmount, formatMass } from './model.js';
import { createChart } from './scene.js';

const $ = (id) => document.getElementById(id);
const NEEDS_ERIS = 'Needs Eris data';

let systems = [];
let selected = POOLS[0].id;
const listEls = {};

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

function select(id) {
  selected = id;
  const s = systems.find((x) => x.id === id) || systems[0];
  if (!s) return;
  $('p-eyebrow').textContent = `${SECTORS[s.sector].name} · ${s.tier}`;
  $('p-name').textContent = s.name;

  const pair = $('p-pair');
  pair.textContent = '';
  for (const sym of [s.a, s.b]) {
    const span = document.createElement('span');
    const dot = document.createElement('i');
    dot.className = 'dot';
    dot.style.background = TOKENS[sym] || UNKNOWN_TOKEN;
    span.appendChild(dot);
    span.appendChild(document.createTextNode(sym));
    pair.appendChild(span);
  }
  pair.appendChild(document.createTextNode('pool'));

  $('v-mass').textContent = s.live ? formatMass(s.value, s.unit) : 'Sample size';
  $('v-mass-note').textContent = s.live
    ? `${s.amounts.map((a) => `${formatAmount(a.amount)} ${a.symbol}`).join(' + ')}, live from Astroport`
    : 'Value held in the pool';
  for (const key of ['v-yield', 'v-fleet', 'v-tribute']) $(key).textContent = NEEDS_ERIS;

  for (const [key, el] of Object.entries(listEls)) el.setAttribute('aria-pressed', key === s.id ? 'true' : 'false');
  if (chart) chart.setSelected(s.id);
}

function render(next) {
  systems = layout(next, SECTORS);
  const list = $('list');
  list.textContent = '';
  for (const s of systems) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = s.name;
    b.addEventListener('click', () => select(s.id));
    list.appendChild(b);
    listEls[s.id] = b;
  }
  if (chart) chart.setSystems(systems);
  select(selected);

  const live = systems.filter((s) => s.live);
  const total = live.reduce((sum, s) => sum + s.value, 0);
  $('r-mass').textContent = live.length ? formatMass(total, live[0].unit) : 'Sample data';
  $('r-data').textContent = live.length ? `${live.length} of ${systems.length} pools live` : 'Sample data';
}

function tick() {
  $('r-cycle').textContent = 'in ' + formatCountdown(nextCycle() - new Date());
}

for (const a of document.querySelectorAll('[data-eris]')) a.href = ERIS_LIQUIDITY_HUB;
$('zin').addEventListener('click', () => chart && chart.zoom(0.85));
$('zout').addEventListener('click', () => chart && chart.zoom(1.18));
$('reset').addEventListener('click', () => chart && chart.reset());
$('lanes').addEventListener('change', (e) => chart && chart.setLanes(e.target.checked));

// Draw the curated chart at once, then replace sizes with live reserves when they arrive.
render(buildSystems(POOLS));
tick();
setInterval(tick, 60000);

(async () => {
  const [{ live, errors }, price] = await Promise.all([loadLive(POOLS), lunaUsd()]);
  if (errors.length) console.warn('Realm of Luna: some pools could not be read.', errors);
  if (Object.keys(live).length) render(buildSystems(POOLS, live, { lunaUsd: price }));
  else if (errors.length) $('r-data').textContent = 'Sample data (chain unreachable)';
})();
