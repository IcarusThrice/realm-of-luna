# Realm of Luna

A 3D star chart of Terra's liquidity pools. Each pool is drawn as a two-body system: one body per token in the pair, sized by the liquidity the pool holds. The Moon sits at the centre, and the three sectors of the plate stand for the three Liquidity Alliance reward gauges.

The site is read-only. It never asks for a wallet and never builds a transaction. The two action buttons open the Eris Liquidity Hub.

## Status

| Part | State |
|---|---|
| Pools shown | The deepest Astroport pools on Terra, found with the pair finder at `/discover` |
| Reserves and mass | Read live from Astroport on every load |
| Prices | Derived on-chain from pool reserves, starting from native LUNA. ampLUNA uses the Eris hub's exchange rate. Dollar figures use CoinGecko's LUNA price |
| Crown systems | The two pools holding protocol-owned liquidity from Terra proposal 4844 |
| System names, sector placement | Placeholders |
| Yield, fleet (vote share), tribute (voter incentives) | Not wired yet. These live in the Eris Liquidity Alliance contracts |

If no chain endpoint answers, the chart shows sample sizes and says so in the header.

## Run it

There is no build step. Serve the folder over HTTP (ES modules do not load from `file://`):

```
npm run serve
```

Then open http://localhost:8080.

## Deploy

Any static host works. On Cloudflare Pages: connect this repo, leave the build command empty, and set the output directory to `/`.

## Add pools

Open `/discover` on the deployed site (or run `npm run discover`). It lists every Astroport pair with its reserves, deepest first. Add an entry to `POOLS` in `src/realm.js` with the pair address and pool type.

## Layout

- `index.html`, `styles.css`: the page
- `src/realm.js`: the curated pools, sectors and token colours
- `src/config.js`: chain endpoints and known addresses
- `src/chain.js`: read-only chain queries (browser and Node)
- `src/model.js`: pricing, sizing and placement, with tests in `test/`
- `src/scene.js`: the three.js chart
- `scripts/discover.mjs`: lists Astroport pairs

```
npm test
```
