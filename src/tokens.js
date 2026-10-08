// What each token is, in a sentence. Written for this project from the descriptions in the
// Cosmos chain registry (github.com/cosmos/chain-registry). Keyed by the symbols this
// project assigns in config.js and logos.js, so a look-alike token on chain gets nothing.
// Figures (price, supply, pool holdings) are never stored here: they are read from the chain.
import { KNOWN_ASSETS } from './config.js';
import { symbolForKey } from './logos.js';

const ABOUT = {
  LUNA: "Terra's native coin. It is staked to secure the chain and used to vote on its governance.",
  ampLUNA: "Eris Protocol's liquid-staked LUNA. Staking rewards compound into it, so one ampLUNA is worth more LUNA over time.",
  arbLUNA: "A share of Eris Protocol's arbitrage vault, which holds LUNA.",
  bLUNA: "BackBone Labs' liquid-staked LUNA.",
  stLUNA: "Stride's liquid-staked LUNA, issued on Stride and sent to Terra over IBC.",
  LunaX: "Stader's liquid-staked LUNA.",
  'USDC.inj': 'USD Coin, the US dollar stablecoin from Circle, as issued on Injective and sent to Terra over IBC.',
  'USDC.noble': 'USD Coin, the US dollar stablecoin from Circle, as issued on Noble and sent to Terra over IBC.',
  'USDC.axl': 'USD Coin from Ethereum, bridged to Terra by Axelar.',
  USDT: "Tether's US dollar stablecoin, sent to Terra over IBC.",
  'USDT.axl': 'Tether USD from Ethereum, bridged to Terra by Axelar.',
  EURe: 'A euro stablecoin issued by Monerium on Noble.',
  SOLID: 'A US dollar stablecoin native to Terra, backed by more collateral than it issues. From Capapult.',
  CAPA: 'The governance token of Capapult, the protocol behind SOLID.',
  ampCAPA: "Eris Protocol's liquid-staked CAPA.",
  ATOM: 'The native coin of the Cosmos Hub.',
  dATOM: "Drop's liquid-staked ATOM, issued on Neutron.",
  stATOM: "Stride's liquid-staked ATOM.",
  INJ: 'The native coin of Injective.',
  PAXG: 'Paxos Gold. Each token stands for one troy ounce of gold held in a vault.',
  'wBTC.atom': 'Wrapped Bitcoin, a token backed one-to-one by bitcoin, bridged to Terra.',
  'wBTC.axl': 'Wrapped Bitcoin from Ethereum, bridged to Terra by Axelar.',
  wstETH: "Lido's wrapped staked ether, bridged to Terra.",
  'wETH.axl': 'Wrapped ether from Ethereum, bridged to Terra by Axelar.',
  ASTRO: 'The token of Astroport, the exchange most of these pools run on. Issued on Neutron.',
  'ASTRO.cw20': "Astroport's original token contract on Terra, since replaced by the ASTRO issued on Neutron.",
  xASTRO: "Staked ASTRO. It earns a share of Astroport's fees.",
  FUEL: 'The token of Boost DAO, issued on Neutron.',
  ROAR: 'The token of Lion DAO, a community group on Terra.',
  ampROAR: "Eris Protocol's liquid-staked ROAR.",
  VKR: 'The token of Valkyrie Protocol.',
  DEEPSTATE: 'The token of Deep State Luna, a community-run validator on Terra.',
};

// How a token exists on Terra, from the shape of its key alone.
export function tokenKind(key) {
  if (key === 'uluna') return 'Native coin of Terra';
  if (key.startsWith('ibc/')) return 'Arrived from another chain over IBC';
  if (key.startsWith('factory/')) return 'Issued on Terra by a contract';
  if (key.startsWith('terra1')) return 'Contract token on Terra';
  return 'Token on Terra';
}

// The sentence for a token read from the chain, or '' when this project has not named it.
export function tokenAbout(key) {
  const sym = (KNOWN_ASSETS[key] && KNOWN_ASSETS[key].symbol) || symbolForKey(key);
  return (sym && ABOUT[sym]) || '';
}

// CoinGecko ids, from the chain registry, used to ask DefiLlama for an outside price.
// Bridged tokens share the id of the asset they stand for.
const MARKET_ID = {
  LUNA: 'terra-luna-2', ampLUNA: 'eris-amplified-luna', arbLUNA: 'eris-arbitrage-luna',
  'USDC.inj': 'usd-coin', 'USDC.noble': 'usd-coin', 'USDC.axl': 'usd-coin', USDT: 'tether', 'USDT.axl': 'tether',
  EURe: 'monerium-eur-money', SOLID: 'solid-2', CAPA: 'capapult', ATOM: 'cosmos', stATOM: 'stride-staked-atom',
  INJ: 'injective-protocol', PAXG: 'pax-gold', 'wBTC.atom': 'wrapped-bitcoin', 'wBTC.axl': 'wrapped-bitcoin',
  wstETH: 'wrapped-steth', 'wETH.axl': 'weth', ASTRO: 'astroport-fi', ROAR: 'lion-dao',
};
export function marketId(key) {
  const sym = (KNOWN_ASSETS[key] && KNOWN_ASSETS[key].symbol) || symbolForKey(key);
  return (sym && MARKET_ID[sym]) || null;
}
export const MARKET_IDS = Array.from(new Set(Object.values(MARKET_ID)));
