// Chain endpoints and known addresses. Nothing here is secret: the site only reads.

// Public REST endpoints for phoenix-1, tried in order. The first one that answers is reused.
export const LCD_ENDPOINTS = [
  'https://terra-rest.publicnode.com',
  'https://terra-api.polkachu.com',
];

// Astroport factory on phoenix-1 (from docs.astroport.fi).
export const ASTROPORT_FACTORY = 'terra14x9fr055x5hvr48hzy2t4q7kvjvfttsvxusa4xsdcy702mnzsvuqprer8r';

// Eris liquid staking hub and its ampLUNA token (from the official Eris contracts-terra README).
// The hub reports the exact ampLUNA to LUNA exchange rate.
export const ERIS_HUB = 'terra10788fkzah89xrdm27zkj5yvhj9x3494lxawzm5qq3vvxcqz2yzaqyd3enk';
export const AMPLUNA_TOKEN = 'terra1ecgazyd0waaj3g7l9cmy5gulhxkps2gmxu9ghducvuypjq68mq2s5lvsct';

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
  // Dollar token paired with ampLUNA in the protocol-owned pool. Proposal 4844 calls that
  // pool USDC-ampLUNA, so it is labelled USDC here. Not yet confirmed against the issuer.
  'erc20:0xa00C59fF5a080D2b954d0c75e46E22a0c371235a': { symbol: 'USDC', decimals: 6 },
};

// Tokens treated as the same price for valuing pools. Once one is priced, all are.
export const PEGS = [
  [
    'ibc/2C962DAB9F57FE0921435426AE75196009FAA1981BF86991203C8411F8980FDB', // USDC
    'ibc/B3504E092456BA618CC28AC671A71FB08C6CA0FD0BE7C8A5B5A3E2DD933CC9E4', // USDC
    'ibc/E8481AD838C31D4FC12A504B10F9B4E2F830F8818D2735C2FFC707579B5FA60B', // USDC (see BASE_DENOMS)
    'ibc/CBF67A2BCF6CAE343FDF251E510C8E18C361FC02B23430C121116E0811835DEF', // USDT
  ],
];

// Optional LUNA price, used only to show mass in dollars when no USDC pool is loaded.
export const LUNA_PRICE_URL = 'https://api.coingecko.com/api/v3/simple/price?ids=terra-luna-2&vs_currencies=usd';
