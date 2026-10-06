# Realm of Luna

A 3D star chart of Terra's liquidity pools. Each pool is drawn as a two-body system: one body per token in the pair, sized by the liquidity the pool holds. The Moon sits at the centre, and the three sectors of the plate stand for the three Liquidity Alliance reward gauges.

The site is read-only. It never asks for a wallet and never builds a transaction. The two action buttons open the Eris Liquidity Hub.

## Status

| Part | State |
|---|---|
| Pool pairs | Real, from Phoenix and Eris public posts |
| Reserves and mass | Read live from Astroport for any pool with a `pair` address in `src/realm.js`. One pool (LUNA-ampLUNA) has its address so far |
| System names, sector placement, crown marks | Placeholders |
| Yield, fleet (vote share), tribute (voter incentives) | Not wired yet. These live in the Eris Liquidity Alliance contracts |

Live reading has not been tested against mainnet yet. If no endpoint answers, the chart shows sample sizes and says so in the header.

## Run it

There is no build step. Serve the folder over HTTP (ES modules do not load from `file://`):

```
npm run serve
```

Then open http://localhost:8080.

## Deploy

Any static host works. On Cloudflare Pages: connect this repo, leave the build command empty, and set the output directory to `/`.

## Add live pools

```
npm run discover              # every Astroport pair with reserves
npm run discover -- LUNA USDC # only pairs holding both symbols
```

Copy a pair address into the matching entry in `src/realm.js`. The site reads its reserves on the next load.

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
