// The curated chart: which pools appear, what each system is called, and where it sits.
//
// Real: the token pairs (taken from Phoenix and Eris public posts) and any `pair` address.
// Provisional: system names, sector placement, crown flags and sample sizes. These are
// placeholders until the Liquidity Alliance gauge data is wired in.

export const TOKENS = {
  LUNA: '#f1e6b8',
  USDC: '#4f8fe0',
  ampLUNA: '#e7a08a',
  SOLID: '#6fc0b0',
  wBTC: '#d9772a',
  ATOM: '#8f93c8',
  PAXG: '#c9b037',
  ASTRO: '#7a6fe0',
};
export const UNKNOWN_TOKEN = '#b8bdd0';

// Three reward gauges, each a 120 degree sector of the plate.
export const SECTORS = {
  stable: { name: 'The Stable Reach', color: '#5fb5a6', from: 120 },
  blue: { name: 'The Bluechip Expanse', color: '#8f9be0', from: 240 },
  project: { name: 'The Project Frontier', color: '#e0975a', from: 0 },
};

// `pair` is the Astroport pair contract. Pools without one show sample sizes.
// Run `npm run discover` to list pair addresses, then fill them in here.
export const POOLS = [
  { id: 'moonhaven', name: 'Moonhaven', a: 'LUNA', b: 'USDC', sector: 'stable', sampleSize: 1, crown: false, pair: null },
  { id: 'amber', name: 'Amber Reach', a: 'USDC', b: 'ampLUNA', sector: 'stable', sampleSize: 0.74, crown: true, pair: null },
  { id: 'bedrock', name: 'Bedrock', a: 'SOLID', b: 'USDC', sector: 'stable', sampleSize: 0.54, crown: false, pair: null },
  { id: 'aurum', name: 'Aurum Hold', a: 'PAXG', b: 'wBTC', sector: 'blue', sampleSize: 0.54, crown: true, pair: null },
  { id: 'goldspire', name: 'Goldspire', a: 'LUNA', b: 'wBTC', sector: 'blue', sampleSize: 0.74, crown: false, pair: null },
  { id: 'starbridge', name: 'Starbridge', a: 'ATOM', b: 'LUNA', sector: 'blue', sampleSize: 0.54, crown: false, pair: null },
  // ampLUNA-LUNA pair address is from the official Eris contracts-terra README.
  { id: 'tidewatch', name: 'Tidewatch', a: 'LUNA', b: 'ampLUNA', sector: 'project', sampleSize: 1, crown: true, pair: 'terra1ccxwgew8aup6fysd7eafjzjz6hw89n40h273sgu3pl4lxrajnk5st2hvfh' },
  { id: 'astral', name: 'Astral Ford', a: 'LUNA', b: 'ASTRO', sector: 'project', sampleSize: 0.54, crown: false, pair: null },
];
