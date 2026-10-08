// The curated chart: which pools appear and where they sit.
//
// ALLIANCE is the Terra Liquidity Alliance list, by gauge, as shown on the Eris
// Liquidity Hub (erisprotocol.com/terra/liquidity-hub). Astroport pair addresses and
// pool types come from the pair finder at /discover. At run time the chart reads the
// real list from the Eris gauge contract; this copy lends ids, token order and crown
// marks to matching pools, and stands in if the gauge cannot be read.
// OUTER is every other Astroport pool the finder saw with roughly $1,000 or more of
// depth and a price path through real liquidity. Look-alike tokens are left out.
// Crown marks: pools named as holding chain-owned liquidity (Terra proposal 4844 and
// Phoenix's treasury posts).

export const TOKENS = {
  LUNA: '#f1e6b8', ampLUNA: '#e7a08a', arbLUNA: '#f0a35a', boneLUNA: '#d8d2c0', bLUNA: '#e9c46a', stLUNA: '#e6b3a1', LunaX: '#c9b8f0',
  'USDC.inj': '#4f8fe0', 'USDC.noble': '#3f78c9', 'USDC.axl': '#6aa3ea', USDT: '#3fae8f', 'USDT.axl': '#5cc0a4', EURe: '#5b7fe8', SOLID: '#6fc0b0',
  ATOM: '#8f93c8', dATOM: '#a6a9d9', stATOM: '#b3a2d6', INJ: '#39c6d9', PAXG: '#c9b037', 'wBTC.atom': '#d9772a', 'wBTC.creda.a': '#e08b45',
  wstETH: '#7fb2e5', 'wETH.axl': '#9aa7c7',
  ASTRO: '#7a6fe0', 'ASTRO.cw20': '#9388e6', xASTRO: '#5f55c9', CAPA: '#b58ad6', ampCAPA: '#9b74c4', FUEL: '#4fb7e6', ROAR: '#e3c93f', ampROAR: '#c9564f',
  VKR: '#58c98b', DEEPSTATE: '#b3392f',
};
export const UNKNOWN_TOKEN = '#b8bdd0';

// The four reward gauges, each a quarter of the plate. `from` and `span` are degrees.
export const SECTORS = {
  stable: { name: 'The Stable Reach', gauge: 'Stable', color: '#5fb5a6', from: 90, span: 90 },
  project: { name: 'The Project Frontier', gauge: 'Project', color: '#e0975a', from: 0, span: 90 },
  bluechip: { name: 'The Bluechip Expanse', gauge: 'Bluechip', color: '#8f9be0', from: 270, span: 90 },
  single: { name: 'The Single Stars', gauge: 'Single', color: '#c98fd0', from: 180, span: 90 },
};

export const ALLIANCE = [
  { id: 'luna-eure', a: 'LUNA', b: 'EURe', sector: 'stable', kind: 'pair', venue: 'Astroport', type: 'concentrated', crown: false, pair: 'terra1vhxl8ggscmhae3muvwvs2vs8ppprzqf07xngcdp798fwnrcksjxszqfa8n' },
  { id: 'luna-usdc-inj', a: 'LUNA', b: 'USDC.inj', sector: 'stable', kind: 'pair', venue: 'Astroport', type: 'concentrated', crown: false, pair: 'terra1heml6j6ewfmjj845vmhm27a4xt9hfgs67uv8qfsjkyza0auelyksmm6cxv' },
  { id: 'luna-usdt', a: 'LUNA', b: 'USDT', sector: 'stable', kind: 'pair', venue: 'Astroport', type: 'concentrated', crown: false, pair: 'terra1aategw0787y4fyunmwdvdqraxfc8jtxykyed2skx3p5fd3lkgkmsqry7pz' },
  { id: 'luna-astro', a: 'LUNA', b: 'ASTRO', sector: 'project', kind: 'pair', venue: 'Astroport', type: 'concentrated', crown: false, pair: 'terra1nwepezm3mghyxm7fjfhfr2d4jwqzndtncf9tclgunqfcwhe52mpq4sxaqr' },
  { id: 'luna-capa', a: 'LUNA', b: 'CAPA', sector: 'project', kind: 'pair', venue: 'Astroport', type: 'concentrated', crown: false, pair: 'terra183wqgrwa2k0uvlz99j57c496gfuwgtaccrhv4stcjzv3ydacl9zq0hmf25' },
  { id: 'luna-fuel', a: 'LUNA', b: 'FUEL', sector: 'project', kind: 'pair', venue: 'Astroport', type: 'concentrated', crown: false, pair: 'terra10yfnsqn20rzlnlzkeva5255q27zp6ws9te9uuql9e0lacfcze7zsffjct5' },
  { id: 'luna-roar', a: 'LUNA', b: 'ROAR', sector: 'project', kind: 'pair', venue: 'Astroport', type: 'concentrated', crown: false, pair: 'terra189v2ewgfx5wdhje6geefdtxefeemujplk8qw2wx3x5hdswn95l8qf4n2r0' },
  { id: 'luna-solid', a: 'LUNA', b: 'SOLID', sector: 'project', kind: 'pair', venue: 'Astroport', type: 'xyk', crown: false, pair: 'terra1e45ctmel6t5m9vdgxv3zxh3ecflkfcd6mr42sluzrqnhveqmy3fss338s7' },
  { id: 'luna-ampluna', a: 'LUNA', b: 'ampLUNA', sector: 'project', kind: 'pair', venue: 'Astroport', type: 'concentrated', crown: true, pair: 'terra1cupwgntu082ypw2ztgtxfzcenexcu6ggp5zzunn3yzfwgrvdcclqgjrjqg' },
  { id: 'luna-boneluna', a: 'LUNA', b: 'boneLUNA', sector: 'project', kind: 'pair', venue: 'SkeletonSwap', type: null, crown: false, pair: null },
  { id: 'usdc-inj-solid', a: 'USDC.inj', b: 'SOLID', sector: 'project', kind: 'pair', venue: 'Astroport', type: 'stable', crown: false, pair: 'terra1mkt8nv7q2u0aj4zpndh23642cnkztg66x65dlj0vhluyk95m8lys9lp2cv' },
  { id: 'luna-atom', a: 'LUNA', b: 'ATOM', sector: 'bluechip', kind: 'pair', venue: 'Astroport', type: 'xyk', crown: false, pair: 'terra1j3d29y506cvtavdpakdzl6e0g2xcskvmmulsetcd0jfwrpr8eu9qfe0dmf' },
  { id: 'luna-atom-skeleton', a: 'LUNA', b: 'ATOM', sector: 'bluechip', kind: 'pair', venue: 'SkeletonSwap', type: null, crown: false, pair: null },
  { id: 'luna-inj', a: 'LUNA', b: 'INJ', sector: 'bluechip', kind: 'pair', venue: 'Astroport', type: 'xyk', crown: false, pair: 'terra10m23jmgtx0lvc6v5gffdmcutlmrgy9pnf8wun4mxft2xd3dnqdvsv392j5' },
  { id: 'luna-paxg', a: 'LUNA', b: 'PAXG', sector: 'bluechip', kind: 'pair', venue: 'Astroport', type: 'concentrated', crown: false, pair: 'terra1xgdyzzhs2v2ne3us2kyj5ry47fwc7uk44k035dyyygq42xechwwqlddmcr' },
  { id: 'luna-wbtc-atom', a: 'LUNA', b: 'wBTC.atom', sector: 'bluechip', kind: 'pair', venue: 'Astroport', type: 'concentrated', crown: false, pair: 'terra1mea829xtsnxwv4l9lhzs0tzpnyamjpz5y45a9tpp06jgdhjd48yqc4ales' },
  { id: 'usdc-inj-eure', a: 'USDC.inj', b: 'EURe', sector: 'bluechip', kind: 'pair', venue: 'Astroport', type: 'concentrated', crown: false, pair: 'terra1yvzl23jv3rjkewz56uj63mgpu5rdpqxfm8lcqa57f5jlzlwly7nqxevatd' },
  { id: 'luna-arbluna', a: 'LUNA', b: 'arbLUNA', sector: 'single', kind: 'pair', venue: 'Astroport', type: 'concentrated', crown: false, pair: 'terra1p9lcjw8knxhtv2pyr9wa8e2ushjnjllljvsuu9cugv7trqynjzasz4x52j' },
  { id: 'paxg-wbtc-atom', a: 'PAXG', b: 'wBTC.atom', sector: 'single', kind: 'pair', venue: 'Astroport', type: 'concentrated', crown: true, pair: 'terra1g55qjcptzqgdyqfgzu5mj8x82955rvlxy4c37z5t6ldgz7cz033q0xr2lx' },
  { id: 'usdc-inj-usdt', a: 'USDC.inj', b: 'USDT', sector: 'single', kind: 'pair', venue: 'Astroport', type: 'stable', crown: false, pair: 'terra1vpwqtw2xky26mh25dlcgwyy8fqj3zatxjdu6e9z8dge4rrppj5nqdmpjwj' },
  { id: 'ampcapa', a: 'ampCAPA', b: null, sector: 'single', kind: 'single', venue: 'Eris', type: null, crown: false, pair: null },
  { id: 'amproar-roar-skeleton', a: 'ampROAR', b: 'ROAR', sector: 'single', kind: 'pair', venue: 'SkeletonSwap', type: null, crown: false, pair: null },
  { id: 'wbtc-creda', a: 'wBTC.creda.a', b: null, sector: 'single', kind: 'single', venue: 'Creda', type: null, crown: false, pair: null },
  { id: 'xastro', a: 'xASTRO', b: null, sector: 'single', kind: 'single', venue: 'Eris', type: null, crown: false, pair: null },
];

export const OUTER = [
  { id: 'out-ampluna-usdc-inj', a: 'ampLUNA', b: 'USDC.inj', sector: null, kind: 'pair', venue: 'Astroport', type: 'concentrated', crown: true, outer: true, pair: 'terra1dqlk6vtuuqdyq2ua8v7yg86dha9kvwsdan73f5y6hnsnmwhmn4hs2wf6nt' },
  { id: 'out-ampluna-arbluna', a: 'ampLUNA', b: 'arbLUNA', sector: null, kind: 'pair', venue: 'Astroport', type: 'concentrated', crown: false, outer: true, pair: 'terra19h78tjeywars6afflsup5er8qm7kl5d8ukednnfxcc2vwhzyf2vsspynjy' },
  { id: 'out-luna-usdc-noble', a: 'LUNA', b: 'USDC.noble', sector: null, kind: 'pair', venue: 'Astroport', type: 'concentrated', crown: false, outer: true, pair: 'terra1v3lqxl0eyte9x3nhdgcj8hwvjq76aupnnzz0yll8mxs5cckc29pqvg2scu' },
  { id: 'out-usdc-noble-usdt', a: 'USDC.noble', b: 'USDT', sector: null, kind: 'pair', venue: 'Astroport', type: 'stable', crown: false, outer: true, pair: 'terra1dnssvse0fqw4d4gqc8kvchfud5r6e8cr7w9cdpervhl2pgr2eecquujpg6' },
  { id: 'out-luna-usdc-axl', a: 'LUNA', b: 'USDC.axl', sector: null, kind: 'pair', venue: 'Astroport', type: 'concentrated', crown: false, outer: true, pair: 'terra13cw46g72kwtgln0540j9cqa79ham5k86jlx34e2pqukww6v0v3yseakged' },
  { id: 'out-usdc-axl-usdt-axl', a: 'USDC.axl', b: 'USDT.axl', sector: null, kind: 'pair', venue: 'Astroport', type: 'stable', crown: false, outer: true, pair: 'terra1ygn5h8v8rm0v8y57j3mtu3mjr2ywu9utj6jch6e0ys2fc2pkyddqekwrew' },
  { id: 'out-astro-cw20-usdc-axl', a: 'ASTRO.cw20', b: 'USDC.axl', sector: null, kind: 'pair', venue: 'Astroport', type: 'concentrated', crown: false, outer: true, pair: 'terra1tm20pwpzwyyvyadu4v488hrg59nhu9v2l8v7k67nhccam4aagczsg0pzzr' },
  { id: 'out-usdc-noble-eure', a: 'USDC.noble', b: 'EURe', sector: null, kind: 'pair', venue: 'Astroport', type: 'concentrated', crown: false, outer: true, pair: 'terra1ys7edvw89krf47n4zsz4c4m9das7ppltjtfv2epw85thqpvl6hhqn55m6y' },
  { id: 'out-usdc-noble-solid', a: 'USDC.noble', b: 'SOLID', sector: null, kind: 'pair', venue: 'Astroport', type: 'xyk', crown: false, outer: true, pair: 'terra1fwjxdjpl98shj20l4swlen9hyu4lhvekrvqkqn393lzzghmsn2wqjdnvpu' },
  { id: 'out-luna-lunax', a: 'LUNA', b: 'LunaX', sector: null, kind: 'pair', venue: 'Astroport', type: 'stable', crown: false, outer: true, pair: 'terra1mpj7j25fw5a0q5vfasvsvdp6xytaqxh006lh6f5zpwxvadem9hwsy6m508' },
  { id: 'out-vkr-usdc-axl', a: 'VKR', b: 'USDC.axl', sector: null, kind: 'pair', venue: 'Astroport', type: 'xyk', crown: false, outer: true, pair: 'terra1alzkrc6hkvs8g5a064cukfxnv0jj4l3l8vhgfypfxvysk78v6dgqsymgmv' },
  { id: 'out-atom-datom', a: 'ATOM', b: 'dATOM', sector: null, kind: 'pair', venue: 'Astroport', type: 'concentrated', crown: false, outer: true, pair: 'terra1a0h6vrzkztjystg8sd949qyrc6mw9gzxk2870cr2mukg53uzgvqs46qul9' },
  { id: 'out-amproar-roar', a: 'ampROAR', b: 'ROAR', sector: null, kind: 'pair', venue: 'Astroport', type: 'concentrated', crown: false, outer: true, pair: 'terra1tkj3j48d0xrh932szzsap3w8htfv3gmj2zld06an2kp90xzq5kzqvtjwfl' },
  { id: 'out-astro-usdc-axl', a: 'ASTRO', b: 'USDC.axl', sector: null, kind: 'pair', venue: 'Astroport', type: 'concentrated', crown: false, outer: true, pair: 'terra1pcge26n2f7p8cwuk42ehj2mqp52ps5dnssd94655elp0gz97u36se894z8' },
  { id: 'out-stluna-luna', a: 'stLUNA', b: 'LUNA', sector: null, kind: 'pair', venue: 'Astroport', type: 'stable', crown: false, outer: true, pair: 'terra1re0yj0j6e9v2szg7kp02ut6u8jjea586t6pnpq6628wl36fphtpqwt6l7p' },
  { id: 'out-wsteth-weth', a: 'wstETH', b: 'wETH.axl', sector: null, kind: 'pair', venue: 'Astroport', type: 'xyk', crown: false, outer: true, pair: 'terra1yga5eepqnpg77gaj59uqfkm2qtllvpq642cmx5gj5lzjf5v88wzs2srzp7' },
  { id: 'out-deepstate-usdc-inj', a: 'DEEPSTATE', b: 'USDC.inj', sector: null, kind: 'pair', venue: 'Astroport', type: 'concentrated', crown: false, outer: true, pair: 'terra1pxcldpxzftuzwgj8pa98dh5qfavx5anfekp6ykezpknrgcs927uq0jjpfe' },
  { id: 'out-bluna-luna', a: 'bLUNA', b: 'LUNA', sector: null, kind: 'pair', venue: 'Astroport', type: 'stable', crown: false, outer: true, pair: 'terra1h32epkd72x7st0wk49z35qlpsxf26pw4ydacs8acq6uka7hgshmq7z7vl9' },
  { id: 'out-atom-statom', a: 'ATOM', b: 'stATOM', sector: null, kind: 'pair', venue: 'Astroport', type: 'concentrated', crown: false, outer: true, pair: 'terra1f9vmtntpjmkyhkxtlc49jcq6cv8rfz0kr06zv6efdtdgae4m9y9qlzm36t' },
];

// The short list: what a first-time visitor sees before choosing to see everything.
// STARS are shown from the first moment, before any data arrives: the pools the Alliance
// itself promotes (Phoenix's weekly "top APRs" post), the gold pools, ROAR, and DEEPSTATE.
// Once data is in, the chart adds the Alliance's largest and highest-yielding pools by
// itself, so the list keeps up from week to week (see featuredIds in model.js).
// PINNED names tokens whose pools are always on the short list: `alliance` tokens only
// when the pool is in the Alliance, `anywhere` tokens wherever the pool is.
export const STARS = ['luna-solid', 'luna-fuel', 'luna-astro', 'luna-eure', 'luna-usdt', 'luna-roar', 'luna-paxg', 'paxg-wbtc-atom', 'xastro', 'out-deepstate-usdc-inj'];
export const PINNED = { alliance: ['PAXG', 'ROAR', 'xASTRO'], anywhere: ['DEEPSTATE'] };
for (const p of [...ALLIANCE, ...OUTER]) p.star = STARS.includes(p.id);

export const POOLS = [...ALLIANCE, ...OUTER];
