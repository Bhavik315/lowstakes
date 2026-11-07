// Presentation helpers for card movement.
//
// Everything here is cosmetic: it reads where elements ended up after a render and
// animates them there from somewhere believable. It never reads or changes game state,
// so the cards on screen are always exactly the cards the engine already dealt.
//
// Only `transform`, `opacity` and the individual `scale` property are animated, which
// the browser can run on the compositor without re-laying-out the table.

const prefersReduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const centre = (r) => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 });

export const DEAL_MS = 560;
export const SHIFT_MS = 520;
export const MOVE_MS = 720;

// Remember where every card is before the table re-renders.
export function snapshot(root) {
  const map = new Map();
  root.querySelectorAll('.card[id]').forEach((el) => map.set(el.id, el.getBoundingClientRect()));
  return map;
}

// Dealt cards leave the shoe; on narrow screens the shoe is hidden, so they leave the dealer's side.
function dealSource(root) {
  const shoe = root.querySelector('.shoe');
  if (shoe && shoe.getClientRects().length) return centre(shoe.getBoundingClientRect());
  const d = root.querySelector('.dealer-cards');
  if (!d) return { x: innerWidth / 2, y: 0 };
  const r = d.getBoundingClientRect();
  return { x: r.right + r.width * 0.5, y: r.top + r.height * 0.2 };
}

const jitter = (n) => (Math.random() * 2 - 1) * n;

function hideTotalUntilLanded(el, root, ms) {
  const hand = el.closest('.hand');
  const pill = hand ? hand.querySelector('.total') : (el.closest('.dealer-cards') ? root.querySelector('.dealer-total') : null);
  if (!pill) return;
  pill.animate(
    [{ opacity: 0, scale: '.7' }, { opacity: 0, scale: '.7', offset: 0.72 }, { opacity: 1, scale: '1.12', offset: 0.9 }, { opacity: 1, scale: '1' }],
    { duration: ms + 220, fill: 'backwards', easing: 'ease-out' },
  );
}

function dealCard(job, src, root) {
  const { el, to } = job;
  const c = centre(to);
  const dx = src.x - c.x;
  const dy = src.y - c.y;
  const r0 = jitter(10) - Math.sign(dx || 1) * 8;
  el.animate([
    { transform: `translate(${dx}px, ${dy}px) rotate(${r0}deg) scale(.78)`, opacity: 0, easing: 'cubic-bezier(.3,.1,.4,1)' },
    { transform: `translate(${dx * 0.36}px, ${dy * 0.36 - 18}px) rotate(${r0 * 0.4}deg) scale(.96)`, opacity: 1, offset: 0.4, easing: 'cubic-bezier(.2,.8,.3,1)' },
    { transform: 'translate(0, 0) rotate(0deg) scale(1)', opacity: 1 },
  ], { duration: DEAL_MS, fill: 'backwards' });
  hideTotalUntilLanded(el, root, DEAL_MS);
}

function shiftCard(job) {
  const { el, to, from } = job;
  const dx = from.left - to.left;
  const dy = from.top - to.top;
  el.animate([
    { transform: `translate(${dx}px, ${dy}px) rotate(${jitter(2.5)}deg)`, easing: 'cubic-bezier(.25,.8,.3,1)' },
    { transform: 'translate(0, 0) rotate(0deg)' },
  ], { duration: SHIFT_MS, fill: 'backwards' });
}

// A card that changed hands (the split): lift it, carry it across, set it down.
function moveCard(job) {
  const { el, to, from } = job;
  const dx = from.left - to.left;
  const dy = from.top - to.top;
  const lift = Math.min(34, 14 + Math.abs(dx) * 0.08);
  const tilt = Math.sign(dx || 1) * 9;
  el.style.zIndex = '6';
  const a = el.animate([
    { transform: `translate(${dx}px, ${dy}px) rotate(0deg) scale(1)`, easing: 'cubic-bezier(.3,.1,.35,1)' },
    { transform: `translate(${dx * 0.45}px, ${dy * 0.45 - lift}px) rotate(${tilt}deg) scale(1.1)`, offset: 0.48, easing: 'cubic-bezier(.25,.8,.3,1)' },
    { transform: 'translate(0, 0) rotate(0deg) scale(1)' },
  ], { duration: MOVE_MS, fill: 'backwards' });
  a.onfinish = a.oncancel = () => { el.style.zIndex = ''; };
}

// Call right after the table has been re-rendered.
//   added  - card elements the render just created
//   before - snapshot() taken just before the render
//   moves  - { newCardId: oldCardId } for cards that changed hands (split)
export function afterRender({ root, before, added, moves = {} }) {
  if (prefersReduced() || root.classList.contains('instant')) return;
  const addedSet = new Set(added);
  const jobs = [];

  // Batch every layout read first, then start the animations, so we never thrash layout.
  for (const el of added) {
    const from = moves[el.id] ? before.get(moves[el.id]) : null;
    jobs.push({ el, to: el.getBoundingClientRect(), from, kind: from ? 'move' : 'deal' });
  }
  before.forEach((rect, id) => {
    const el = document.getElementById(id);
    if (!el || addedSet.has(el)) return;
    const to = el.getBoundingClientRect();
    if (Math.abs(to.left - rect.left) > 1.5 || Math.abs(to.top - rect.top) > 1.5) jobs.push({ el, to, from: rect, kind: 'shift' });
  });

  if (!jobs.length) return;
  const src = dealSource(root);
  for (const j of jobs) {
    if (j.kind === 'deal') dealCard(j, src, root);
    else if (j.kind === 'move') moveCard(j);
    else shiftCard(j);
  }
}

// The dealer leans in on the hole card, then turns it over.
export function dealerPeek(root, ms) {
  const hole = root.querySelector('.dealer-cards .card.down');
  if (!hole || prefersReduced()) return;
  hole.getAnimations().forEach((a) => a.cancel());
  hole.animate([
    { transform: 'translateY(0) rotate(0deg) scale(1)', easing: 'cubic-bezier(.3,.7,.3,1)' },
    { transform: 'translateY(-9px) rotate(-3deg) scale(1.05)', offset: 0.38 },
    { transform: 'translateY(-11px) rotate(2deg) scale(1.06)', offset: 0.72 },
    { transform: 'translateY(-10px) rotate(0deg) scale(1.06)' },
  ], { duration: ms, fill: 'forwards' });
}

export function dealerReveal(root, ms) {
  const cards = root.querySelectorAll('.dealer-cards .card');
  const hole = cards[1];
  if (!hole || prefersReduced()) return;
  hole.getAnimations().forEach((a) => a.cancel());
  hole.animate([
    { transform: 'translateY(-10px) rotate(0deg) scale(1.06)', easing: 'cubic-bezier(.3,.6,.3,1)' },
    { transform: 'translateY(-26px) rotate(0deg) scale(1.14)', offset: 0.42, easing: 'cubic-bezier(.4,0,.3,1)' },
    { transform: 'translateY(0) rotate(0deg) scale(1)' },
  ], { duration: ms });
}
