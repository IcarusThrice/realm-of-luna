# Realm of Luna

A 3D star chart of Terra's liquidity pools. Each pool is drawn as a two-body system: one body per token in the pair, sized by the liquidity the pool holds. The Moon sits at the centre, and the four sectors of the plate are the four Liquidity Alliance reward gauges. Pools outside the Alliance drift beyond the rim.

The site is read-only. It never asks for a wallet and never builds a transaction. The two action buttons open the Eris Liquidity Hub.

## Status

| Part | State |
|---|---|
| Alliance pools and gauges | Read live from the Eris asset-gauge contract: every asset in the four gauges (Stable, Project, Bluechip, Single). A copy of the list in `src/realm.js` stands in if the gauge cannot be read |
| Fleet (vote share) | Read live from the same gauge contract, per pool, for the current cycle |
| Outer systems | Every other Astroport pool the pair finder saw with roughly $1,000 or more of depth |
| Reserves and mass | Read live from each pool on every load |
| Prices | Derived on-chain from pool reserves, starting from native LUNA. ampLUNA and arbLUNA use the exchange rate their Eris contracts report. One USDC.inj is taken as one dollar |
| Settled (staked amounts) | Read live from the four Eris asset-staking contracts. For a pool it is the staked LP as a share of the LP in issue; a single-token stake is sized by its staked amount |
| Hollow systems | Single-token stakes whose token has no price path through the pools the chart reads, and anything that could not be read |
| Crown systems | Pools named as holding chain-owned liquidity (Terra proposal 4844, Phoenix treasury posts) |
| Yield and tribute (voter incentives) | Not wired yet. `/discover` has a probe that asks the Eris bribe manager, a connector and the voting escrow what they answer |

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
