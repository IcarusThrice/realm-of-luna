# Realm of Luna

A 3D star chart of Terra's liquidity pools. Each pool is drawn as a two-body system: one body per token in the pair, sized by the liquidity the pool holds. The Moon sits at the centre, and the four sectors of the plate are the four Liquidity Alliance reward gauges. Pools outside the Alliance drift beyond the rim.

The site is read-only. It never asks for a wallet and never builds a transaction. The two action buttons open the Eris Liquidity Hub.

## Status

| Part | State |
|---|---|
| Alliance pools and gauges | The 24 entries on the Eris Liquidity Hub, in their four gauges (Stable, Project, Bluechip, Single) |
| Outer systems | Every other Astroport pool the pair finder saw with roughly $1,000 or more of depth |
| Reserves and mass | Read live from Astroport on every load, for the 37 pools with an Astroport pair address |
| Prices | Derived on-chain from pool reserves, starting from native LUNA. ampLUNA and arbLUNA use the exchange rate their Eris contracts report. One USDC.inj is taken as one dollar |
| Hollow systems | Six Alliance entries the chart cannot read yet: three SkeletonSwap pools and three single-token stakes |
| Crown systems | Pools named as holding chain-owned liquidity (Terra proposal 4844, Phoenix treasury posts) |
| Yield, fleet (vote share), tribute (voter incentives) | Not wired yet. These live in the Eris Liquidity Alliance contracts; `/discover` has a probe that asks them what they answer |

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

Open `/discover` on the deployed site (or run `npm run discover`). It lists every Astroport pair with its reserves, deepest first. Add an entry to `ALLIANCE` or `OUTER` in `src/realm.js` with the pair address and pool type. Name any new bridged token in `KNOWN_ASSETS` in `src/config.js`.

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
