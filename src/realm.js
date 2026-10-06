// The curated chart: which pools appear, what each system is called, and where it sits.
//
// Real: the pairs, their Astroport pair addresses and their reserves (read live).
//       The two crown systems hold the protocol-owned liquidity from Terra proposal 4844.
// Provisional: system names and sector placement. Which pools sit in which Liquidity
//       Alliance gauge is not wired in yet, so sectors are grouped by kind of pair.

export const TOKENS = {
  LUNA: '#f1e6b8',
  USDC: '#4f8fe0',
  USDT: '#3fae8f',
  ampLUNA: '#e7a08a',
  SOLID: '#6fc0b0',
  wBTC: '#d9772a',
  ATOM: '#8f93c8',
  ASTRO: '#7a6fe0',
  ROAR: '#c9564f',
  CAPA: '#b58ad6',
};
export const UNKNOWN_TOKEN = '#b8bdd0';

// Three reward gauges, each a 120 degree sector of the plate.
export const SECTORS = {
  stable: { name: 'The Stable Reach', color: '#5fb5a6', from: 120 },
  blue: { name: 'The Bluechip Expanse', color: '#8f9be0', from: 240 },
  project: { name: 'The Project Frontier', color: '#e0975a', from: 0 },
};

// `pair` is the Astroport pair contract (found with the pair finder at /discover).
// `type` is the Astroport pool type; only xyk reserve ratios are exact prices.
// `sampleSize` is only used if the chain cannot be reached.
export const POOLS = [
  { id: 'amber', name: 'Amber Reach', a: 'ampLUNA', b: 'USDC', sector: 'stable', sampleSize: 1, crown: true, pair: 'terra1dqlk6vtuuqdyq2ua8v7yg86dha9kvwsdan73f5y6hnsnmwhmn4hs2wf6nt', type: 'concentrated' },
  { id: 'moonhaven', name: 'Moonhaven', a: 'LUNA', b: 'SOLID', sector: 'stable', sampleSize: 0.74, crown: false, pair: 'terra1e45ctmel6t5m9vdgxv3zxh3ecflkfcd6mr42sluzrqnhveqmy3fss338s7', type: 'xyk' },
  { id: 'twinmints', name: 'Twin Mints', a: 'USDC', b: 'USDT', sector: 'stable', sampleSize: 0.54, crown: false, pair: 'terra1ygn5h8v8rm0v8y57j3mtu3mjr2ywu9utj6jch6e0ys2fc2pkyddqekwrew', type: 'stable' },
  { id: 'bedrock', name: 'Bedrock', a: 'SOLID', b: 'USDC', sector: 'stable', sampleSize: 0.54, crown: false, pair: 'terra1fwjxdjpl98shj20l4swlen9hyu4lhvekrvqkqn393lzzghmsn2wqjdnvpu', type: 'xyk' },
  { id: 'starbridge', name: 'Starbridge', a: 'ATOM', b: 'LUNA', sector: 'blue', sampleSize: 0.74, crown: false, pair: 'terra1j3d29y506cvtavdpakdzl6e0g2xcskvmmulsetcd0jfwrpr8eu9qfe0dmf', type: 'xyk' },
  { id: 'goldspire', name: 'Goldspire', a: 'LUNA', b: 'wBTC', sector: 'blue', sampleSize: 0.54, crown: false, pair: 'terra1afkvgc0mxfqakqlaqpxdgy58n79x4r239q3tucxmrsqvqk7ce3ksnctxfu', type: 'concentrated' },
  { id: 'tidewatch', name: 'Tidewatch', a: 'LUNA', b: 'ampLUNA', sector: 'project', sampleSize: 1, crown: true, pair: 'terra1cupwgntu082ypw2ztgtxfzcenexcu6ggp5zzunn3yzfwgrvdcclqgjrjqg', type: 'concentrated' },
  { id: 'lionsgate', name: 'Lionsgate', a: 'LUNA', b: 'ROAR', sector: 'project', sampleSize: 0.74, crown: false, pair: 'terra189v2ewgfx5wdhje6geefdtxefeemujplk8qw2wx3x5hdswn95l8qf4n2r0', type: 'concentrated' },
  { id: 'capayard', name: 'Capa Yard', a: 'LUNA', b: 'CAPA', sector: 'project', sampleSize: 0.74, crown: false, pair: 'terra183wqgrwa2k0uvlz99j57c496gfuwgtaccrhv4stcjzv3ydacl9zq0hmf25', type: 'concentrated' },
  { id: 'astral', name: 'Astral Ford', a: 'ASTRO', b: 'USDC', sector: 'project', sampleSize: 0.54, crown: false, pair: 'terra1tm20pwpzwyyvyadu4v488hrg59nhu9v2l8v7k67nhccam4aagczsg0pzzr', type: 'concentrated' },
];
