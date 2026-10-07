// Token logos. The files in assets/tokens/ are the projects' own marks, taken from the
// Cosmos chain registry (github.com/cosmos/chain-registry) and resized to 256 px.
// To restyle a token, replace its file; to add one, add the file and a line here.
import { KNOWN_ASSETS } from './config.js';

const DIR = 'assets/tokens/';

// Logo file per symbol, for symbols this project assigns itself (KNOWN_ASSETS, realm.js).
const FILE_BY_SYMBOL = {
  LUNA: 'luna', ampLUNA: 'ampluna', arbLUNA: 'arbluna', bLUNA: 'bluna', stLUNA: 'stluna', LunaX: 'lunax',
  'USDC.inj': 'usdc', 'USDC.noble': 'usdc', 'USDC.axl': 'usdc', USDT: 'usdt', 'USDT.axl': 'usdt', EURe: 'eure', SOLID: 'solid',
  ATOM: 'atom', dATOM: 'datom', stATOM: 'statom', INJ: 'inj', PAXG: 'paxg', 'wBTC.atom': 'wbtc', 'wBTC.axl': 'wbtc',
  wstETH: 'wsteth', 'wETH.axl': 'weth',
  ASTRO: 'astro', 'ASTRO.cw20': 'astro-cw20', xASTRO: 'xastro', CAPA: 'capa', ampCAPA: 'ampcapa', FUEL: 'fuel',
  ROAR: 'roar', ampROAR: 'amproar', VKR: 'vkr',
};

// Contract and factory tokens, by address or denom (from the registry's terra2 list and
// the pair finder).
const SYMBOL_BY_KEY = {
  terra1ecgazyd0waaj3g7l9cmy5gulhxkps2gmxu9ghducvuypjq68mq2s5lvsct: 'ampLUNA',
  terra1se7rvuerys4kd2snt6vqswh9wugu49vhyzls8ymc02wl37g2p2ms5yz490: 'arbLUNA',
  terra17aj4ty4sz4yhgm08na8drc0v03v2jwr3waxcqrwhajj729zhl7zqnpc0ml: 'bLUNA',
  terra14xsm2wzvu7xaf567r693vgfkhmvfs08l68h4tjj5wjgyn5ky8e2qvzyanh: 'LunaX',
  terra10aa3zdkrc7jwuf8ekl3zq7e7m42vmzqehcmu74e4egc7xkm5kr2s0muyst: 'SOLID',
  terra1nsuqsk6kh58ulczatwev87ttq2z6r3pusulg9r24mfj2fvtzd4uq3exn26: 'ASTRO.cw20',
  terra1x62mjnme4y0rdnag3r8rfgjuutsqlkkyuh4ndgex0wl3wue25uksau39q8: 'xASTRO',
  terra1t4p3u8khpd7f8qzurwyafxt648dya6mp6vur3vaapswt6m24gkuqrfdhar: 'CAPA',
  'factory/terra186rpfczl7l2kugdsqqedegl4es4hp624phfc7ddy8my02a4e8lgq5rlx7y/ampCAPA': 'ampCAPA',
  terra1lxx40s29qvkrcj8fsa3yzyehy7w50umdvvnls2r830rys6lu2zns63eelv: 'ROAR',
  'factory/terra1vklefn7n6cchn0u962w3gaszr4vf52wjvd4y95t2sydwpmpdtszsqvk9wy/ampROAR': 'ampROAR',
  terra1gy73st560m2j0esw5c5rjmr899hvtv4rhh4seeajt3clfhr4aupszjss4j: 'VKR',
};

// The logo for one token, or null.
// A token read from the chain is matched by its key alone: anyone can mint a token and
// call it "LUNA", so a symbol from the chain proves nothing. The symbol is used only when
// there is no key, which means the name came from this project's own list.
export function logoFor(key, symbol) {
  const sym = key ? (KNOWN_ASSETS[key] && KNOWN_ASSETS[key].symbol) || SYMBOL_BY_KEY[key] : symbol;
  const file = sym && FILE_BY_SYMBOL[sym];
  return file ? DIR + file + '.png' : null;
}

// Logos for a system's bodies, in the order of its names: [first, second].
export function logosFor(s) {
  const keys = s.keys || [];
  return [s.a, s.b].map((sym, i) => (sym ? logoFor(keys[i] || null, sym) : null));
}

export const LOGO_FILES = Array.from(new Set(Object.values(FILE_BY_SYMBOL))).map((f) => DIR + f + '.png');
