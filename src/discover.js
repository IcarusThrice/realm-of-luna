// Lists every Astroport pair with its reserves, deepest first. Read-only.
import { ASTROPORT_FACTORY, PEGS, ERIS_CONTRACTS, ERIS_GAUGE, PROBE_PATHS } from './config.js';
import { listFactoryPairs, loadPool, probeContract, rpcSmart, lcdGet } from './chain.js';
import { rankByDepth, formatAmount } from './model.js';

const $ = (id) => document.getElementById(id);
const status = (t) => { $('status').textContent = t; };
const pairType = (t) => (t && t.custom) || Object.keys(t || {})[0] || '';

async function run() {
  $('go').disabled = true;
  status('Asking the Astroport factory for its pairs...');
  let pairs;
  try {
    pairs = await listFactoryPairs(ASTROPORT_FACTORY);
  } catch (err) {
    status('Could not reach the factory: ' + err.message);
    $('go').disabled = false;
    return;
  }

  const rows = [];
  const failed = [];
  let done = 0;
  const read = async (p, bucket) => {
    try {
      rows.push({ pair: p.contract_addr, type: pairType(p.pair_type), assets: await loadPool(p.contract_addr) });
    } catch (err) {
      bucket.push(p);
    }
    done++;
    status(`Reading reserves: ${done} of ${pairs.length} pairs`);
  };
  const queue = [...pairs];
  await Promise.all(Array.from({ length: 4 }, async () => { while (queue.length) await read(queue.shift(), failed); }));
  // One slow second pass for anything the endpoint dropped.
  const stillFailed = [];
  done -= failed.length;
  for (const p of failed) await read(p, stillFailed);

  // Depth is measured from native LUNA, so look-alike tokens cannot inflate it.
  const { ranked } = rankByDepth(rows, { pegs: PEGS, floor: 100 });
  const shown = ranked.filter((r) => r.depth >= 500);
  const body = $('rows');
  body.textContent = '';
  for (const r of shown.slice(0, 200)) {
    const tr = document.createElement('tr');
    const cells = [
      r.assets.map((a) => a.symbol).join(' · '),
      r.assets.map((a) => `${formatAmount(a.amount)} ${a.symbol}`).join(' + '),
      formatAmount(r.depth),
      r.type,
      r.pair,
    ];
    cells.forEach((text, i) => {
      const td = document.createElement('td');
      td.textContent = text;
      if (i === 4) td.className = 'addr';
      tr.appendChild(td);
    });
    body.appendChild(tr);
  }
  $('out').value = JSON.stringify(shown.slice(0, 200).map((r) => ({
    pair: r.pair,
    type: r.type,
    depthLuna: Math.round(r.depth),
    assets: r.assets.map((a) => ({ symbol: a.symbol, key: a.key, amount: Number(a.amount.toPrecision(8)) })),
  })));
  $('results').hidden = false;
  status(`${pairs.length} pairs listed, ${shown.length} hold at least 500 LUNA of depth, ${stillFailed.length} could not be read.`);
  $('go').disabled = false;
}

// Ask the Eris Liquidity Alliance contracts which queries they accept, then try each one.
async function probe() {
  $('probe').disabled = true;
  const report = {};
  // Arguments to offer when a query asks for them: a gauge, the current period, and the
  // most-voted asset in that gauge.
  const hints = { gauge: 'stable' };
  $('probe-status').textContent = 'Reading the current cycle...';
  const now = await rpcSmart(ERIS_GAUGE, { distributions: {} });
  if (now.data && now.data[0]) {
    hints.period = now.data[0].period;
    hints.gauge = now.data[0].gauge;
    if (now.data[0].assets[0]) hints.asset = now.data[0].assets[0].asset;
  }
  for (const [name, address] of Object.entries(ERIS_CONTRACTS)) {
    $('probe-status').textContent = `Asking ${name}...`;
    try {
      report[name] = await probeContract(address, hints);
    } catch (err) {
      report[name] = { address, error: err.message };
    }
  }
  // The chain's own Alliance and inflation figures, which set how much the gauges earn.
  report.chain = {};
  for (const path of PROBE_PATHS) {
    $('probe-status').textContent = `Reading ${path}...`;
    try {
      const text = JSON.stringify(await lcdGet(path));
      report.chain[path] = text.length > 9000 ? { truncated: text.slice(0, 9000) } : JSON.parse(text);
    } catch (err) {
      report.chain[path] = { error: err.message };
    }
  }
  $('probe-out').value = JSON.stringify(report);
  $('probe-results').hidden = false;
  const found = Object.values(report).reduce((n, r) => n + ((r.queries || []).length), 0);
  $('probe-status').textContent = found ? `Done. The contracts listed ${found} queries.` : 'Done, but the contracts did not list their queries. Copy the result anyway.';
  $('probe').disabled = false;
}

async function copyFrom(areaId, buttonId) {
  const out = $(areaId);
  try {
    await navigator.clipboard.writeText(out.value);
    $(buttonId).textContent = 'Copied';
  } catch (err) {
    out.focus();
    out.select();
    $(buttonId).textContent = 'Selected: press Ctrl or Cmd + C';
  }
}

$('go').addEventListener('click', run);
$('probe').addEventListener('click', probe);
$('probe-copy').addEventListener('click', () => copyFrom('probe-out', 'probe-copy'));
$('copy').addEventListener('click', () => copyFrom('out', 'copy'));
