// Cards are two-character strings: rank + suit, e.g. "As", "Td", "7h".
export const RANKS = '23456789TJQKA';
export const SUITS = 'shdc';
export const RV = Object.fromEntries([...RANKS].map((r, i) => [r, i + 2]));

export const RANK_NAME = {
  2: 'Two', 3: 'Three', 4: 'Four', 5: 'Five', 6: 'Six', 7: 'Seven', 8: 'Eight',
  9: 'Nine', 10: 'Ten', 11: 'Jack', 12: 'Queen', 13: 'King', 14: 'Ace',
};
export const RANK_PLURAL = {
  2: 'Twos', 3: 'Threes', 4: 'Fours', 5: 'Fives', 6: 'Sixes', 7: 'Sevens', 8: 'Eights',
  9: 'Nines', 10: 'Tens', 11: 'Jacks', 12: 'Queens', 13: 'Kings', 14: 'Aces',
};

export function newDeck(decks = 1) {
  const d = [];
  for (let n = 0; n < decks; n++) for (const s of SUITS) for (const r of RANKS) d.push(r + s);
  return d;
}

// Uniform random int in [0, n) from the platform CSPRNG when available.
export function randInt(n) {
  const c = globalThis.crypto;
  if (c && c.getRandomValues) {
    const buf = new Uint32Array(1);
    const limit = Math.floor(0x100000000 / n) * n;
    let x;
    do { c.getRandomValues(buf); x = buf[0]; } while (x >= limit);
    return x % n;
  }
  return Math.floor(Math.random() * n);
}

export function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randInt(i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export const rankOf = (c) => RV[c[0]];
export const suitOf = (c) => c[1];
export const isRed = (c) => c[1] === 'h' || c[1] === 'd';
