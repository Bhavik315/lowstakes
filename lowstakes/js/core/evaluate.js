// Best-five-of-N poker hand evaluator (N = 5..7).
// Returns { score, cat, name, best } where a higher score always wins.
import { RV, RANK_NAME, RANK_PLURAL } from './cards.js?v=34';

export const CATEGORY = [
  'High card', 'Pair', 'Two pair', 'Three of a kind', 'Straight',
  'Flush', 'Full house', 'Four of a kind', 'Straight flush',
];

const byRankDesc = (a, b) => RV[b[0]] - RV[a[0]];

function findStraight(sortedDesc) {
  // sortedDesc: cards sorted high to low, may contain duplicate ranks.
  const uniq = [];
  const seen = new Set();
  for (const c of sortedDesc) {
    const r = RV[c[0]];
    if (!seen.has(r)) { seen.add(r); uniq.push(c); }
  }
  const vals = uniq.map((c) => RV[c[0]]);
  if (seen.has(14)) { uniq.push(uniq[0]); vals.push(1); } // ace plays low too
  for (let i = 0; i + 5 <= uniq.length; i++) {
    if (vals[i] - vals[i + 4] === 4) return { cards: uniq.slice(i, i + 5), high: vals[i] };
  }
  return null;
}

function encode(cat, ranks) {
  let s = cat;
  for (let i = 0; i < 5; i++) s = s * 15 + (ranks[i] || 0);
  return s;
}

export function evaluate(cards) {
  const sorted = [...cards].sort(byRankDesc);
  const suits = { s: [], h: [], d: [], c: [] };
  for (const c of sorted) suits[c[1]].push(c);

  let flush = null;
  for (const s in suits) if (suits[s].length >= 5) flush = suits[s];

  if (flush) {
    const sf = findStraight(flush);
    if (sf) {
      const name = sf.high === 14 ? 'Royal flush' : `Straight flush, ${RANK_NAME[sf.high]} high`;
      return { score: encode(8, [sf.high]), cat: 8, name, best: sf.cards };
    }
  }

  const groups = new Map();
  for (const c of sorted) {
    const r = RV[c[0]];
    if (!groups.has(r)) groups.set(r, []);
    groups.get(r).push(c);
  }
  const g = [...groups.entries()]
    .sort((a, b) => b[1].length - a[1].length || b[0] - a[0]);

  const kickers = (used, n) => sorted.filter((c) => !used.includes(c)).slice(0, n);

  if (g[0][1].length === 4) {
    const quad = g[0][1];
    const k = kickers(quad, 1);
    return {
      score: encode(7, [g[0][0], RV[k[0][0]]]), cat: 7,
      name: `Four ${RANK_PLURAL[g[0][0]]}`, best: [...quad, ...k],
    };
  }

  if (g[0][1].length === 3 && g.length > 1 && g[1][1].length >= 2) {
    // With two sets of trips, the lower one plays as the pair. Find best pair rank.
    const trips = g[0];
    const pair = g.slice(1).filter((x) => x[1].length >= 2).sort((a, b) => b[0] - a[0])[0];
    return {
      score: encode(6, [trips[0], pair[0]]), cat: 6,
      name: `Full house, ${RANK_PLURAL[trips[0]]} over ${RANK_PLURAL[pair[0]]}`,
      best: [...trips[1], ...pair[1].slice(0, 2)],
    };
  }

  if (flush) {
    const best = flush.slice(0, 5);
    return {
      score: encode(5, best.map((c) => RV[c[0]])), cat: 5,
      name: `Flush, ${RANK_NAME[RV[best[0][0]]]} high`, best,
    };
  }

  const st = findStraight(sorted);
  if (st) {
    return {
      score: encode(4, [st.high]), cat: 4,
      name: `Straight, ${RANK_NAME[st.high]} high`, best: st.cards,
    };
  }

  if (g[0][1].length === 3) {
    const k = kickers(g[0][1], 2);
    return {
      score: encode(3, [g[0][0], ...k.map((c) => RV[c[0]])]), cat: 3,
      name: `Three ${RANK_PLURAL[g[0][0]]}`, best: [...g[0][1], ...k],
    };
  }

  if (g[0][1].length === 2 && g[1] && g[1][1].length === 2) {
    const used = [...g[0][1], ...g[1][1]];
    const k = kickers(used, 1);
    return {
      score: encode(2, [g[0][0], g[1][0], RV[k[0][0]]]), cat: 2,
      name: `Two pair, ${RANK_PLURAL[g[0][0]]} and ${RANK_PLURAL[g[1][0]]}`,
      best: [...used, ...k],
    };
  }

  if (g[0][1].length === 2) {
    const k = kickers(g[0][1], 3);
    return {
      score: encode(1, [g[0][0], ...k.map((c) => RV[c[0]])]), cat: 1,
      name: `Pair of ${RANK_PLURAL[g[0][0]]}`, best: [...g[0][1], ...k],
    };
  }

  const best = sorted.slice(0, 5);
  return {
    score: encode(0, best.map((c) => RV[c[0]])), cat: 0,
    name: `${RANK_NAME[RV[best[0][0]]]} high`, best,
  };
}
