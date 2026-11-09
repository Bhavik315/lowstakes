// A reasonable, slightly loose Hold'em opponent: Monte Carlo equity against
// the live field, pot odds, a little aggression and the occasional bluff.
import { newDeck } from '../core/cards.js?v=63';
import { evaluate } from '../core/evaluate.js?v=63';

export function equity(hole, board, opponents, iters = 150) {
  const used = new Set([...hole, ...board]);
  const rest = newDeck().filter((c) => !used.has(c));
  let score = 0;
  for (let it = 0; it < iters; it++) {
    // partial Fisher-Yates over the remaining deck
    const need = (5 - board.length) + opponents * 2;
    const d = rest.slice();
    for (let i = 0; i < need; i++) {
      const j = i + Math.floor(Math.random() * (d.length - i));
      [d[i], d[j]] = [d[j], d[i]];
    }
    let k = 0;
    const full = board.slice();
    while (full.length < 5) full.push(d[k++]);
    const mine = evaluate([...hole, ...full]).score;
    let best = 0;
    let ties = 0;
    let lost = false;
    for (let o = 0; o < opponents; o++) {
      const s = evaluate([d[k++], d[k++], ...full]).score;
      if (s > mine) { lost = true; break; }
      if (s === mine) ties++;
      best = Math.max(best, s);
    }
    if (!lost) score += ties ? 1 / (ties + 1) : 1;
  }
  return score / iters;
}

export function holdemBot(game, seatIdx) {
  const seat = game.seats[seatIdx];
  const p = game.player(seat.pid);
  const L = game.legal(seat);
  const opponents = game.seats.filter((s) => s !== seat && s.inHand && !s.folded).length;
  const pot = game.pot() + game.seats.reduce((a, s) => a + s.bet, 0);
  const style = p.style || 0.5; // 0 = rock, 1 = maniac
  const eq = equity(seat.cards, game.board, Math.max(1, Math.min(opponents, 5)));

  // What share of the pot we'd be getting.
  const odds = L.toCall > 0 ? L.callAmt / (pot + L.callAmt) : 0;
  const fair = 1 / (opponents + 1);
  const strength = eq / fair; // >1 means better than an average hand here
  const r = Math.random();

  const raiseTo = (fraction) => {
    const size = Math.max(L.minTo, game.currentBet + Math.round((pot + L.toCall) * fraction));
    return { type: 'raise', to: Math.min(L.maxTo, roundChips(size, game.s.bb)) };
  };

  if (L.canRaise) {
    if (strength > 2.1 - style * 0.4 && r < 0.75) return raiseTo(0.6 + Math.random() * 0.6);
    if (strength > 1.5 - style * 0.3 && r < 0.35 + style * 0.25) return raiseTo(0.45 + Math.random() * 0.35);
    if (L.canCheck && r < 0.06 + style * 0.1) return raiseTo(0.5); // bluff
  }
  if (L.canCheck) return { type: 'check' };
  if (eq >= odds * (1.05 - style * 0.2) || (L.callAmt <= game.s.bb && strength > 0.7)) return { type: 'call' };
  return { type: 'fold' };
}

function roundChips(x, bb) {
  const unit = Math.max(1, Math.round(bb / 2));
  return Math.round(x / unit) * unit;
}
