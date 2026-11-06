import { esc, card, chipStack } from './parts.js?v=4';
import { COLORS } from '../net/room.js?v=4';

const HERO_HAND = ['Ah', 'Kh', 'Qh', 'Jh', 'Th'];

export function colorPicker(selected, name = 'color') {
  return `<fieldset class="swatches"><legend>Chip colour</legend>${COLORS.slice(0, 10).map((c, i) => `
    <label class="swatch" style="--c:${c}"><input type="radio" name="${name}" value="${c}"${c === selected ? ' checked' : ''} aria-label="Colour ${i + 1}"><span></span></label>`).join('')}
  </fieldset>`;
}

export function landing(me, { error = '' } = {}) {
  return `
<div class="landing">
  <header class="l-top">
    <a class="wordmark" href="#/" aria-label="Low Stakes home"><span>Low</span><span>Stakes</span></a>
    <nav class="l-nav"><a href="#how">How it works</a><a href="#games">Games</a></nav>
  </header>

  <section class="hero">
    <div class="hero-copy">
      <h1>Game night, minus the&nbsp;cash.</h1>
      <p class="lede">Hold'em, blackjack, roulette, baccarat and craps with your friends, right in the browser. Start a table, send the link, deal. Everyone gets 1,000 chips that are worth exactly nothing.</p>

      <form class="sit" id="start-form" autocomplete="off" novalidate>
        <label class="field">
          <span>Your name</span>
          <input id="name" name="name" maxlength="16" value="${esc(me.name)}" placeholder="What should the table call you?" autocomplete="nickname" spellcheck="false">
        </label>
        ${colorPicker(me.color)}
        <p class="form-error" id="form-error" role="alert">${esc(error)}</p>
        <div class="sit-actions">
          <button class="btn btn-primary" type="submit" data-mode="host">Start a table</button>
          <button class="btn btn-quiet" type="submit" data-mode="bots">Practise against bots</button>
        </div>
        <div class="join-line">
          <label for="code">Got a table code?</label>
          <div class="code-input">
            <input id="code" name="code" maxlength="5" placeholder="ABCDE" autocapitalize="characters" spellcheck="false" inputmode="text">
            <button class="btn btn-dark" type="submit" data-mode="join">Join</button>
          </div>
        </div>
      </form>
    </div>

    <div class="hero-table" aria-hidden="true">
      <div class="hero-felt">
        <div class="hero-print">Low Stakes card room</div>
        <div class="hero-hand">${HERO_HAND.map((c, i) => card(c, { cls: 'hero-card', style: `--i:${i}` })).join('')}</div>
        <div class="hero-chips">
          <div class="hero-stack" style="--d:0">${chipStack(1340)}</div>
          <div class="hero-stack" style="--d:1">${chipStack(625)}</div>
          <div class="hero-stack" style="--d:2">${chipStack(5150)}</div>
        </div>
      </div>
    </div>
  </section>

  <section class="games" id="games">
    <h2>Five tables, one link</h2>
    <div class="game-row">
      <article class="placard p-holdem">
        <div class="placard-art">${['As', 'Ad'].map((c, i) => card(c, { style: `--i:${i}` })).join('')}</div>
        <h3>Texas Hold'em</h3>
        <p>No-limit, two to nine players. Proper side pots, all-in run-outs, and a timer so nobody stalls forever.</p>
      </article>
      <article class="placard p-bj">
        <div class="placard-art">${['Kc', 'Ah'].map((c, i) => card(c, { style: `--i:${i}` })).join('')}</div>
        <h3>Blackjack</h3>
        <p>Up to seven of you against the dealer. Six-deck shoe, splits and doubles, and a coach that whispers basic strategy.</p>
      </article>
      <article class="placard p-roulette">
        <div class="placard-art"><div class="mini-wheel"></div></div>
        <h3>Roulette</h3>
        <p>Single zero. Everyone stacks chips on the same layout, then watches the ball go round together.</p>
      </article>
      <article class="placard p-baccarat">
        <div class="placard-art">${['8h', '8d'].map((c, i) => card(c, { style: `--i:${i}` })).join('')}</div>
        <h3>Baccarat</h3>
        <p>Player, Banker or Tie. The cards draw themselves by fixed rule — nothing to decide, just a fast, elegant bet.</p>
      </article>
      <article class="placard p-craps">
        <div class="placard-art"><div class="mini-dice"><i></i><i></i></div></div>
        <h3>Craps</h3>
        <p>One of you throws, everyone bets on what happens. Pass line, field, place numbers and hardways, the loud way.</p>
      </article>
    </div>
  </section>

  <section class="how" id="how">
    <h2>How a game night goes</h2>
    <ol class="steps">
      <li><b>Start a table.</b> You're the host. Your browser runs the game, so there's nothing to install and no account to make.</li>
      <li><b>Send the link.</b> Paste it in the group chat. Friends open it, type a name and sit down. Up to twelve at a table.</li>
      <li><b>Pick a game and deal.</b> Switch between hold'em, blackjack and roulette whenever you like. Chip counts carry over.</li>
    </ol>
    <p class="how-note">Short a player? Add bots. They play a sensible game and don't mind losing.</p>
  </section>

  <footer class="l-foot">
    <p>Play money only. There's nothing to buy and nothing to cash out.</p>
    <p>Tables are peer-to-peer: the host's browser deals, and guests connect to it directly. Keep the host tab open.</p>
  </footer>
</div>`;
}

export function gate(me, code, { error = '', status = '' } = {}) {
  return `
<div class="gate">
  <a class="wordmark" href="#/"><span>Low</span><span>Stakes</span></a>
  <form class="gate-card" id="gate-form" autocomplete="off" novalidate>
    <p class="gate-kicker">You're invited to table</p>
    <p class="gate-code">${esc(code)}</p>
    <label class="field">
      <span>Your name</span>
      <input id="name" name="name" maxlength="16" value="${esc(me.name)}" placeholder="What should the table call you?" autocomplete="nickname" spellcheck="false">
    </label>
    ${colorPicker(me.color)}
    <p class="form-error" id="form-error" role="alert">${esc(error)}</p>
    <button class="btn btn-primary btn-wide" type="submit"${status === 'connecting' ? ' disabled' : ''}>${status === 'connecting' ? 'Finding the table…' : 'Take a seat'}</button>
    <p class="gate-foot">Play money only. <a href="#/">Start your own table</a></p>
  </form>
</div>`;
}
