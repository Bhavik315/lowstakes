import { esc, card, chipStack, ROCKET_SVG } from './parts.js?v=45';

const HERO_HAND = ['Ah', 'Kh', 'Qh', 'Jh', 'Th'];

export function landing(me, { error = '' } = {}) {
  return `
<div class="landing">
  <header class="l-top">
    <a class="wordmark" href="#/" aria-label="Low Stakes home"><span>Low</span><span>Stakes</span></a>
    <nav class="l-nav" aria-label="Site"><a href="#games">Games</a></nav>
    <div class="acct-slot"></div>
  </header>

  <section class="hero">
    <div class="hero-copy">
      <h1>Game night, minus the&nbsp;cash.</h1>
      <p class="lede">Poker, blackjack, roulette and crash with your friends, right in the browser. Sign in with Google, start a table, send the link, deal. Everyone plays with free coins that are worth exactly nothing.</p>

      <form class="sit" id="start-form" autocomplete="off" novalidate>
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
    <h2>Four tables, one link</h2>
    <div class="game-row">
      <article class="placard p-holdem">
        <div class="placard-art">${['As', 'Ad'].map((c, i) => card(c, { style: `--i:${i}` })).join('')}</div>
        <h3>Poker</h3>
        <p>Texas Hold'em, no-limit, two to nine players. Proper side pots, all-in run-outs, and a timer so nobody stalls forever.</p>
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
      <article class="placard p-crash">
        <div class="placard-art">${ROCKET_SVG}</div>
        <h3>Crash</h3>
        <p>A multiplier climbs until it doesn't. Up to twelve of you bet, then race to cash out before the crash.</p>
      </article>
    </div>
  </section>

  <div class="ad-slot" data-slot="landing" data-static hidden></div>

  <section class="how" id="how">
    <h2>How a game night goes</h2>
    <ol class="steps">
      <li><b>Sign in and start a table.</b> One tap with Google and you're in. You get a username and a starting stash of free coins. Our servers run the game, so there's nothing to install.</li>
      <li><b>Send the link.</b> Paste it in the group chat. Friends sign in, open it and sit down. Up to twelve at a table.</li>
      <li><b>Pick a game and deal.</b> Switch between poker, blackjack, roulette and crash whenever you like. Your coins go with you, and you can claim free top-ups when you run low.</li>
    </ol>
    <p class="how-note">Short a player? Add bots. They play a sensible game and don't mind losing.</p>
  </section>

  <div class="ad-slot" data-slot="landing2" data-static hidden></div>

  <footer class="l-foot">
    <p>Play money only. There's nothing to buy and nothing to cash out.</p>
    <p>Tables run on our game server, so the table stays open even if the person who started it closes their tab.</p>
    <p><a href="privacy.html">Privacy</a> · <a href="terms.html">Terms</a> · For adults (18+) only</p>
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
    <p class="form-error" id="form-error" role="alert">${esc(error)}</p>
    <button class="btn btn-primary btn-wide" type="submit"${status === 'connecting' ? ' disabled' : ''}>${status === 'connecting' ? 'Finding the table…' : 'Take a seat'}</button>
    <p class="gate-foot">Play money only. <a href="#/">Start your own table</a></p>
  </form>
</div>`;
}
