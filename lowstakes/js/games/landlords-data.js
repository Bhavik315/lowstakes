// Landlords: the board, the cards and the rule options. Plain data and tiny pure helpers, shared by the game server
// (which decides everything) and the browser (which only draws it). Everything here is original: an invented town,
// invented street names, invented card text.

export const MAX_SEATS = 6;
export const MIN_SEATS = 4;

export const GROUPS = {
  brown: { name: 'Brown', color: '#8a5a3c', house: 50 },
  sky: { name: 'Sky', color: '#8fd0ef', house: 50 },
  pink: { name: 'Pink', color: '#e56aa5', house: 100 },
  orange: { name: 'Orange', color: '#ef8a2d', house: 100 },
  red: { name: 'Red', color: '#d6372b', house: 150 },
  yellow: { name: 'Yellow', color: '#f3cf2c', house: 150 },
  green: { name: 'Green', color: '#2f9a5b', house: 200 },
  navy: { name: 'Navy', color: '#2447a8', house: 200 },
  station: { name: 'Station', color: '#2b2b2b', house: 0 },
  utility: { name: 'Utility', color: '#8f98a3', house: 0 },
};

const street = (name, group, price, rents) => ({ type: 'street', name, group, price, rents });
const station = (name) => ({ type: 'station', name, group: 'station', price: 200 });
const utility = (name) => ({ type: 'utility', name, group: 'utility', price: 150 });

// Square i is 0 at the bottom right and runs clockwise: 0 Start, 10 Lockup, 20 Vacation, 30 Go to Lockup.
export const BOARD = [
  { type: 'start', name: 'Start' },
  street('Cobbler Row', 'brown', 60, [2, 10, 30, 90, 160, 250]),
  { type: 'fund', name: 'Town Fund' },
  street('Tinker’s Lane', 'brown', 60, [4, 20, 60, 180, 320, 450]),
  { type: 'tax', name: 'Income Tax', tax: 'income' },
  station('North Station'),
  street('Quay Street', 'sky', 100, [6, 30, 90, 270, 400, 550]),
  { type: 'luck', name: 'Luck' },
  street('Wharf Road', 'sky', 100, [6, 30, 90, 270, 400, 550]),
  street('Saltmarket', 'sky', 120, [8, 40, 100, 300, 450, 600]),
  { type: 'jail', name: 'Lockup' },
  street('Almond Court', 'pink', 140, [10, 50, 150, 450, 625, 750]),
  utility('Waterworks'),
  street('Fig Tree Walk', 'pink', 140, [10, 50, 150, 450, 625, 750]),
  street('Marzipan Mews', 'pink', 160, [12, 60, 180, 500, 700, 900]),
  station('East Station'),
  street('Lantern Lane', 'orange', 180, [14, 70, 200, 550, 750, 950]),
  { type: 'fund', name: 'Town Fund' },
  street('Chimney Close', 'orange', 180, [14, 70, 200, 550, 750, 950]),
  street('Brewer’s Hill', 'orange', 200, [16, 80, 220, 600, 800, 1000]),
  { type: 'vacation', name: 'Vacation' },
  street('Cardinal Street', 'red', 220, [18, 90, 250, 700, 875, 1050]),
  { type: 'luck', name: 'Luck' },
  street('Rowan Way', 'red', 220, [18, 90, 250, 700, 875, 1050]),
  street('Embers Parade', 'red', 240, [20, 100, 300, 750, 925, 1100]),
  station('South Station'),
  street('Sunflower Square', 'yellow', 260, [22, 110, 330, 800, 975, 1150]),
  street('Marigold Market', 'yellow', 260, [22, 110, 330, 800, 975, 1150]),
  utility('Gasworks'),
  street('Saffron Gate', 'yellow', 280, [24, 120, 360, 850, 1025, 1200]),
  { type: 'gojail', name: 'Go to Lockup' },
  street('Fernhill Road', 'green', 300, [26, 130, 390, 900, 1100, 1275]),
  street('Mossbank Avenue', 'green', 300, [26, 130, 390, 900, 1100, 1275]),
  { type: 'fund', name: 'Town Fund' },
  street('Ivy Crescent', 'green', 320, [28, 150, 450, 1000, 1200, 1400]),
  station('West Station'),
  { type: 'luck', name: 'Luck' },
  street('Regent Terrace', 'navy', 350, [35, 175, 500, 1100, 1300, 1500]),
  { type: 'tax', name: 'Luxury Tax', tax: 'luxury', amount: 100 },
  street('Crown Plaza', 'navy', 400, [50, 200, 600, 1400, 1700, 2000]),
].map((s, i) => ({ i, ...s }));

export const START = 0;
export const JAIL = 10;
export const VACATION = 20;
export const GO_JAIL = 30;
export const OWNABLE = BOARD.filter((s) => s.price).map((s) => s.i);
export const STATIONS = BOARD.filter((s) => s.type === 'station').map((s) => s.i);
export const UTILITIES = BOARD.filter((s) => s.type === 'utility').map((s) => s.i);
export const groupOf = (g) => BOARD.filter((s) => s.group === g).map((s) => s.i);
export const mortgageValue = (sq) => Math.floor(BOARD[sq].price / 2);
export const unmortgageCost = (sq) => Math.ceil(mortgageValue(sq) * 1.1);
export const mortgageInterest = (sq) => Math.ceil(mortgageValue(sq) * 0.1);
export const houseCost = (sq) => GROUPS[BOARD[sq].group].house;

export const LUCK = [
  { id: 'L1', text: 'Advance to Start. Collect your Start bonus.', t: 'move', to: 0 },
  { id: 'L2', text: 'Take a stroll to Crown Plaza.', t: 'move', to: 39 },
  { id: 'L3', text: 'Advance to Cardinal Street. Passing Start collects the bonus.', t: 'move', to: 21 },
  { id: 'L4', text: 'Advance to Almond Court. Passing Start collects the bonus.', t: 'move', to: 11 },
  { id: 'L5', text: 'Advance to the nearest station. If it is owned, pay the owner double rent.', t: 'near', kind: 'station' },
  { id: 'L6', text: 'Advance to the nearest station. If it is owned, pay the owner double rent.', t: 'near', kind: 'station' },
  { id: 'L7', text: 'Advance to the nearest utility. If it is owned, pay ten times a fresh dice roll.', t: 'near', kind: 'utility' },
  { id: 'L8', text: 'The bank pays you a dividend of $50.', t: 'cash', n: 50 },
  { id: 'L9', text: 'Get out of Lockup free. Keep this card until you need it.', t: 'free' },
  { id: 'L10', text: 'Go back three spaces.', t: 'back', n: 3 },
  { id: 'L11', text: 'Go directly to Lockup. Do not pass Start.', t: 'jail' },
  { id: 'L12', text: 'Make repairs on your buildings: pay $25 per house and $100 per hotel.', t: 'repair', house: 25, hotel: 100 },
  { id: 'L13', text: 'Speeding fine. Pay $15.', t: 'cash', n: -15 },
  { id: 'L14', text: 'Take a trip to North Station. Passing Start collects the bonus.', t: 'move', to: 5 },
  { id: 'L15', text: 'You are elected chair of the residents’ board. Pay each player $50.', t: 'each', n: 50 },
  { id: 'L16', text: 'Your building loan matures. Collect $150.', t: 'cash', n: 150 },
];
export const FUND = [
  { id: 'F1', text: 'Advance to Start. Collect your Start bonus.', t: 'move', to: 0 },
  { id: 'F2', text: 'Bank error in your favour. Collect $200.', t: 'cash', n: 200 },
  { id: 'F3', text: 'Doctor’s fee. Pay $50.', t: 'cash', n: -50 },
  { id: 'F4', text: 'You sell your old sofa for $50.', t: 'cash', n: 50 },
  { id: 'F5', text: 'Get out of Lockup free. Keep this card until you need it.', t: 'free' },
  { id: 'F6', text: 'Go directly to Lockup. Do not pass Start.', t: 'jail' },
  { id: 'F7', text: 'Holiday fund matures. Collect $100.', t: 'cash', n: 100 },
  { id: 'F8', text: 'Tax refund. Collect $20.', t: 'cash', n: 20 },
  { id: 'F9', text: 'It is your birthday. Collect $10 from every player.', t: 'collect', n: 10 },
  { id: 'F10', text: 'Life insurance pays out. Collect $100.', t: 'cash', n: 100 },
  { id: 'F11', text: 'Hospital fees. Pay $100.', t: 'cash', n: -100 },
  { id: 'F12', text: 'School fees. Pay $50.', t: 'cash', n: -50 },
  { id: 'F13', text: 'Consultancy fee. Collect $25.', t: 'cash', n: 25 },
  { id: 'F14', text: 'Street repairs: pay $40 per house and $115 per hotel.', t: 'repair', house: 40, hotel: 115 },
  { id: 'F15', text: 'You win second prize in a beauty contest. Collect $10.', t: 'cash', n: 10 },
  { id: 'F16', text: 'You inherit $100.', t: 'cash', n: 100 },
];
export const CARD = Object.fromEntries([...LUCK, ...FUND].map((c) => [c.id, c]));

// ---- the rules the host can choose (all enforced by the game engine) --------------------------------------
export const ENTRY_FEES = [0, 100, 250, 500, 1000, 2500, 5000, 10000];
export const OPTIONS = {
  startCash: [1000, 1500, 2000, 2500, 5000],
  passGo: [0, 100, 200, 300, 500],
  incomeTax: ['flat', 'percent'],
  supply: ['standard', 'unlimited'],
  jailFine: [50, 100, 150],
  jailTurns: [1, 2, 3],
};
export const DEFAULT_SETTINGS = {
  doubleRent: false, // unimproved streets in a complete set charge double base rent
  vacationCash: false, // taxes and bank payments pile up and go to whoever lands on Vacation
  auction: true, // a property nobody buys goes to auction
  noJailRent: false, // players in Lockup collect no rent
  mortgage: true, // properties can be mortgaged for half their price
  evenBuild: true, // houses are built and sold evenly across a set
  startCash: 1500,
  randomOrder: true,
  passGo: 200,
  incomeTax: 'flat', // flat $200, or 10% of everything you own
  supply: 'standard', // 32 houses and 12 hotels in the bank, or unlimited
  jailFine: 50,
  jailTurns: 3, // failed doubles in Lockup before the fine is forced
};
export const INCOME_TAX = 200;

// Take whatever a client sent and keep only valid, known values (anything else falls back to the default).
export function cleanSettings(raw) {
  const out = { ...DEFAULT_SETTINGS };
  if (!raw || typeof raw !== 'object') return out;
  for (const k of Object.keys(DEFAULT_SETTINGS)) {
    if (!(k in raw)) continue;
    const v = raw[k];
    if (typeof DEFAULT_SETTINGS[k] === 'boolean') { if (typeof v === 'boolean') out[k] = v; }
    else if (OPTIONS[k] && OPTIONS[k].includes(v)) out[k] = v;
  }
  return out;
}
// Only a real number from the list is a fee: null, '', true, '1000' and the like are refused (not quietly read as 0).
export const cleanFee = (v) => (typeof v === 'number' && ENTRY_FEES.includes(v) ? v : null);

// A set of properties is sent as a list of square numbers.
export const isSquareList = (l) => Array.isArray(l) && l.length <= 28 && l.every((x) => Number.isInteger(x) && OWNABLE.includes(x)) && new Set(l).size === l.length;
