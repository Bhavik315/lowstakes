// Hand values and basic strategy for 6-deck, dealer stands on soft 17,
// double after split allowed, no surrender.

export function cardValue(c) {
  const r = c[0];
  if (r === 'A') return 11;
  if ('TJQK'.includes(r)) return 10;
  return Number(r);
}

export function handValue(cards) {
  let total = 0;
  let aces = 0;
  for (const c of cards) {
    if (c === '??') continue;
    total += cardValue(c);
    if (c[0] === 'A') aces++;
  }
  while (total > 21 && aces) { total -= 10; aces--; }
  return { total, soft: aces > 0 };
}

export const isNatural = (cards, fromSplit) => !fromSplit && cards.length === 2 && handValue(cards).total === 21;

// Returns 'hit' | 'stand' | 'double' | 'split'
export function basicStrategy(cards, dealerUp, canDouble, canSplit) {
  const up = cardValue(dealerUp) === 11 ? 11 : cardValue(dealerUp);
  const { total, soft } = handValue(cards);
  const D = (fallback) => (canDouble ? 'double' : fallback);
  const between = (a, b) => up >= a && up <= b;

  if (canSplit && cards.length === 2 && cardValue(cards[0]) === cardValue(cards[1])) {
    const v = cardValue(cards[0]);
    if (v === 11 || v === 8) return 'split';
    if (v === 9 && (between(2, 6) || up === 8 || up === 9)) return 'split';
    if ((v === 7 || v === 3 || v === 2) && between(2, 7)) return 'split';
    if (v === 6 && between(2, 6)) return 'split';
    if (v === 4 && between(5, 6)) return 'split';
  }

  if (soft && cards.length >= 2) {
    if (total >= 19) return 'stand';
    if (total === 18) {
      if (between(3, 6)) return D('stand');
      if (up === 2 || up === 7 || up === 8) return 'stand';
      return 'hit';
    }
    if (total === 17) return between(3, 6) ? D('hit') : 'hit';
    if (total === 15 || total === 16) return between(4, 6) ? D('hit') : 'hit';
    if (total === 13 || total === 14) return between(5, 6) ? D('hit') : 'hit';
  }

  if (total >= 17) return 'stand';
  if (total >= 13) return between(2, 6) ? 'stand' : 'hit';
  if (total === 12) return between(4, 6) ? 'stand' : 'hit';
  if (total === 11) return up === 11 ? 'hit' : D('hit');
  if (total === 10) return between(2, 9) ? D('hit') : 'hit';
  if (total === 9) return between(3, 6) ? D('hit') : 'hit';
  return 'hit';
}
