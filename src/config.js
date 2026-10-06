// Chain endpoints and known addresses. Nothing here is secret: the site only reads.

// Public REST endpoints for phoenix-1, tried in order. The first one that answers is reused.
export const LCD_ENDPOINTS = [
  'https://terra-rest.publicnode.com',
  'https://terra-api.polkachu.com',
];

// Astroport factory on phoenix-1 (from docs.astroport.fi).
export const ASTROPORT_FACTORY = 'terra14x9fr055x5hvr48hzy2t4q7kvjvfttsvxusa4xsdcy702mnzsvuqprer8r';

// Where the two action buttons send people until in-site actions exist.
export const ERIS_LIQUIDITY_HUB = 'https://www.erisprotocol.com/terra/liquidity-hub';

// Native denoms we can name without asking the chain.
export const NATIVE_DENOMS = {
  uluna: { symbol: 'LUNA', decimals: 6 },
};

// IBC assets are resolved to their base denom on-chain, then named from this table.
// Anything missing falls back to the raw base denom with 6 decimals.
export const BASE_DENOMS = {
  uusdc: { symbol: 'USDC', decimals: 6 },
  uusdt: { symbol: 'USDT', decimals: 6 },
  uatom: { symbol: 'ATOM', decimals: 6 },
  uosmo: { symbol: 'OSMO', decimals: 6 },
  'wbtc-satoshi': { symbol: 'wBTC', decimals: 8 },
};

// Optional LUNA price, used only to show mass in dollars when no USDC pool is loaded.
export const LUNA_PRICE_URL = 'https://api.coingecko.com/api/v3/simple/price?ids=terra-luna-2&vs_currencies=usd';
