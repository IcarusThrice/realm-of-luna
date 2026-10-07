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
| Small screens | On a phone the chart frames the plate and looks down more steeply; the outer orbit runs off the sides and comes round as the chart is turned. Labels that would be cut off by the edge or sit under a control are hidden |
| Token logos | Each planet wears its token's logo, projected onto the sphere from three sides so it reads face-on as the planet turns. Logos are matched by token address, never by name. Tokens without a file keep a plain colour |
| Crown systems | Pools named as holding chain-owned liquidity (Terra proposal 4844, Phoenix treasury posts) |
| Tribute (voter incentives) | Read live from the Eris bribe manager: the tokens on offer for each asset, valued with the same on-chain prices. Tokens with no price path are listed by amount |
| Voting power | Total votes and number of locks, read live from the voting escrow and shown at the Moon Court |
| Yield | An estimate, not a figure Eris reports. Each gauge's connector owns an Alliance token; the chain's Alliance module pays it `weight / (1 + sum of all weights)` of the LUNA minted for stakers each year. That, less the mean commission of the connector's validators, times the pool's vote share, over the value staked, is the rate shown. It leaves out swap fees, exchange incentives and the Alliance's yearly take on staked tokens (shown beside it) |

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
- `src/logos.js`, `assets/tokens/`: which logo belongs to which token, and the files
- `scripts/discover.mjs`: lists Astroport pairs

```
npm test
```

## Logos

The files in `assets/tokens/` are each project's own mark, taken from the [Cosmos chain registry](https://github.com/cosmos/chain-registry) and resized to 256 px. They remain the property of their projects and are used here only to identify the tokens. To change how a token looks, replace its file. To add one, add a 256 px square PNG and a line in `src/logos.js`.
