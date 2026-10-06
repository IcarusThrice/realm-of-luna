// Lists Astroport pairs on phoenix-1 with their reserves, so pair addresses can be
// copied into src/realm.js. Read-only. Needs Node 18+.
//
//   npm run discover              every pair, largest LUNA side first
//   npm run discover -- LUNA USDC only pairs holding both symbols
import { writeFileSync } from 'node:fs';
import { ASTROPORT_FACTORY } from '../src/config.js';
import { listFactoryPairs, loadPool } from '../src/chain.js';

const want = process.argv.slice(2).map((s) => s.toLowerCase());
const pairs = await listFactoryPairs(ASTROPORT_FACTORY);
console.error(`Factory lists ${pairs.length} pairs. Reading reserves...`);

const rows = [];
const queue = [...pairs];
await Promise.all(Array.from({ length: 5 }, async () => {
  while (queue.length) {
    const p = queue.shift();
    try {
      const assets = await loadPool(p.contract_addr);
      rows.push({ pair: p.contract_addr, type: Object.keys(p.pair_type || {})[0] || '', assets });
    } catch (err) {
      rows.push({ pair: p.contract_addr, error: err.message });
    }
  }
}));

const lunaSide = (r) => (r.assets || []).filter((a) => /luna/i.test(a.symbol)).reduce((m, a) => Math.max(m, a.amount), 0);
const shown = rows
  .filter((r) => r.assets && r.assets.some((a) => a.amount > 0))
  .filter((r) => want.every((w) => r.assets.some((a) => a.symbol.toLowerCase() === w)))
  .sort((x, y) => lunaSide(y) - lunaSide(x));

for (const r of shown) {
  console.log(`${r.assets.map((a) => `${a.amount.toFixed(2)} ${a.symbol}`).join(' + ')}\n  ${r.type}  ${r.pair}`);
}
writeFileSync('discover-output.json', JSON.stringify(rows, null, 2));
console.error(`${shown.length} pairs shown. Full results saved to discover-output.json.`);
