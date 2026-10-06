// Chain endpoints and known addresses. Nothing here is secret: the site only reads.

// Public REST endpoints for phoenix-1, tried in order. The first one that answers is reused.
export const LCD_ENDPOINTS = [
  'https://terra-rest.publicnode.com',
  'https://terra-api.polkachu.com',
];

// Public RPC endpoints. Used only by the contract probe: unlike REST, RPC returns a
// contract's rejection message in a normal response the browser is allowed to read.
export const RPC_ENDPOINTS = [
  'https://terra-rpc.publicnode.com',
  'https://terra-rpc.polkachu.com',
];

// Astroport factory on phoenix-1 (from docs.astroport.fi).
export const ASTROPORT_FACTORY = 'terra14x9fr055x5hvr48hzy2t4q7kvjvfttsvxusa4xsdcy702mnzsvuqprer8r';

// Tokens whose exact LUNA value is reported by their own contract, so pools holding them
// are valued at the true rate, not at a pool's reserve ratio.
//   ampLUNA: Eris staking hub (addresses from the official Eris contracts-terra README)
//   arbLUNA: Eris arb vault (address from DefiLlama's Eris adapter)
// Both answer { state: {} } with an `exchange_rate`.
export const AMPLUNA_TOKEN = 'terra1ecgazyd0waaj3g7l9cmy5gulhxkps2gmxu9ghducvuypjq68mq2s5lvsct';
export const RATE_SOURCES = [
  { token: AMPLUNA_TOKEN, contract: 'terra10788fkzah89xrdm27zkj5yvhj9x3494lxawzm5qq3vvxcqz2yzaqyd3enk' },
  { token: 'terra1se7rvuerys4kd2snt6vqswh9wugu49vhyzls8ymc02wl37g2p2ms5yz490', contract: 'terra1r9gls56glvuc4jedsvc3uwh6vj95mqm9efc7hnweqxa2nlme5cyqxygy5m' },
];

// Liquidity Alliance contracts, as listed by Eris's own registry (global-config,
// terra1hwxg6s732eparz3ys7sa4t5f64ngpd2w8syrca6z7ckv3fs9uqnsvrpcqa, query all_addresses).
// The chart reads the gauge (what is in the Alliance, and each asset's share of the votes)
// and the four staking contracts (how much of each asset is staked).
export const ERIS_GAUGE = 'terra1hfksrhchkmsj4qdq33wkksrslnfles6y2l77fmmzeep0xmq24l2smsd3lj';
export const ERIS_STAKING = {
  stable: 'terra1v399cx9drllm70wxfsgvfe694tdsd9x96p9ha36w7muffe4znlusqswspq',
  project: 'terra1awq6t7jfakg9wfjn40fk3wzwmd57mvrqtt3a39z9rmet7wdjj3ysgw3lpa',
  bluechip: 'terra14mmvqn0kthw6sre75vku263lafn5655mkjdejqjedjga4cw0qx2qlf4arv',
  single: 'terra1qdz5qgafx88kp5mf6m2tah8742g4u5g2cek0m3jrgssexexk7g4qw6e23k',
};

// Not read by the chart yet. The probe on /discover asks these what they answer:
// the bribe manager holds voter incentives (Tribute), a connector mints the reward token
// the staking contracts pay out (Yield), and the voting escrow holds the locks.
export const ERIS_CONTRACTS = {
  'bribe-manager': 'terra1tuuwm8yrj54qeg0c8xu00aha9ryatyhtczq8qq2q8tntuw0auzas9037wh',
  'stable-connector': 'terra1ym2495f63mdx63tu96085x2vf3xpy9z9k5urxwhvmf9jldm99q5qr4q6n8',
  'voting-escrow': 'terra1uqhj8agyeaz8fu6mdggfuwr3lp32jlrx5hqag4jxexde92rzkamq3l62zg',
};

// Where the two action buttons send people until in-site actions exist.
export const ERIS_LIQUIDITY_HUB = 'https://www.erisprotocol.com/terra/liquidity-hub';

// Tokens named without asking the chain, by denom. Names follow the Eris Liquidity Hub.
// Decimals for bridged tokens follow the token's home chain. FUEL's are assumed.
const ibc = (hash) => 'ibc/' + hash;
export const USDC_INJ = ibc('E8481AD838C31D4FC12A504B10F9B4E2F830F8818D2735C2FFC707579B5FA60B');
export const KNOWN_ASSETS = {
  uluna: { symbol: 'LUNA', decimals: 6 },
  [USDC_INJ]: { symbol: 'USDC.inj', decimals: 6 },
  [ibc('2C962DAB9F57FE0921435426AE75196009FAA1981BF86991203C8411F8980FDB')]: { symbol: 'USDC.noble', decimals: 6 },
  [ibc('B3504E092456BA618CC28AC671A71FB08C6CA0FD0BE7C8A5B5A3E2DD933CC9E4')]: { symbol: 'USDC.axl', decimals: 6 },
  [ibc('9B19062D46CAB50361CE9B0A3E6D0A7A53AC9E7CB361F32A73CC733144A9A9E5')]: { symbol: 'USDT', decimals: 6 },
  [ibc('CBF67A2BCF6CAE343FDF251E510C8E18C361FC02B23430C121116E0811835DEF')]: { symbol: 'USDT.axl', decimals: 6 },
  [ibc('8D52B251B447B7160421ACFBD50F6B0ABE5F98D2C404B03701130F12044439A1')]: { symbol: 'EURe', decimals: 6 },
  [ibc('27394FB092D2ECCD56123C74F36E4C1F926001CEADA9CA97EA622B25F41E5EB2')]: { symbol: 'ATOM', decimals: 6 },
  [ibc('223FF539430381ADAB3A66AC4822E253C3F845E9841F17FEEC207B3AA9F8D915')]: { symbol: 'dATOM', decimals: 6 },
  [ibc('FD9DBF0DB4D301313195159303811FD2FD72185C4B11A51659EFCD49D7FF1228')]: { symbol: 'stATOM', decimals: 6 },
  [ibc('25BC59386BB65725F735EFC0C369BB717AA8B5DAD846EAF9CBF5D0F18F207211')]: { symbol: 'INJ', decimals: 18 },
  [ibc('0EF5630576C66968EF0787868CF09FD866FAD131BC148D24A148358A85F0EB62')]: { symbol: 'PAXG', decimals: 18 },
  [ibc('88386AC48152D48B34B082648DF836F975506F0B57DBBFC10A54213B1BF484CB')]: { symbol: 'wBTC.atom', decimals: 8 },
  [ibc('05D299885B07905B6886F554B39346EA6761246076A1120B1950049B92B922DD')]: { symbol: 'wBTC.axl', decimals: 8 },
  [ibc('4B44179AC2F0BEE50C16A673B3B886398988692885B2848A1C8AEF27148B3961')]: { symbol: 'FUEL', decimals: 6 },
  [ibc('8D8A7F7253615E5F76CB6252A1E1BD921D5EDB7BBAAF8913FB1C77FF125D9995')]: { symbol: 'ASTRO', decimals: 6 },
  [ibc('08095CEDEA29977C9DD0CE9A48329FDA622C183359D5F90CF04CC4FF80CBE431')]: { symbol: 'stLUNA', decimals: 6 },
  [ibc('A356EC90DC3AE43D485514DA7260EDC7ABB5CFAA0654CE2524C739392975AD3C')]: { symbol: 'wstETH', decimals: 18 },
  [ibc('BC8A77AFBD872FDC32A348D3FB10CC09277C266CFE52081DE341C7EC6752E674')]: { symbol: 'wETH.axl', decimals: 18 },
};

// Display names for contract tokens whose own symbol clashes with a newer token.
export const RENAMED = {
  terra1nsuqsk6kh58ulczatwev87ttq2z6r3pusulg9r24mfj2fvtzd4uq3exn26: 'ASTRO.cw20',
};

// Tokens treated as the same price for valuing pools. Once one is priced, all are.
export const PEGS = [
  [
    USDC_INJ,
    ibc('2C962DAB9F57FE0921435426AE75196009FAA1981BF86991203C8411F8980FDB'),
    ibc('B3504E092456BA618CC28AC671A71FB08C6CA0FD0BE7C8A5B5A3E2DD933CC9E4'),
    ibc('9B19062D46CAB50361CE9B0A3E6D0A7A53AC9E7CB361F32A73CC733144A9A9E5'),
    ibc('CBF67A2BCF6CAE343FDF251E510C8E18C361FC02B23430C121116E0811835DEF'),
  ],
];

// Dollar figures come from the chain itself: one USDC.inj is taken as one dollar.
// This endpoint is only a fallback if no USDC pool can be read.
export const LUNA_PRICE_URL = 'https://api.coingecko.com/api/v3/simple/price?ids=terra-luna-2&vs_currencies=usd';
