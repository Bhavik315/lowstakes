// Copies the game engines from the website (../lowstakes/js) into src/engine, so the server runs exactly
// the same game code as the browser. Import paths lose their ?v=NN cache-busting suffix on the way.
import { cpSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const from = join(here, '../../lowstakes/js');
const to = join(here, '../src/engine');
const FILES = [
  'core/engine.js', 'core/cards.js', 'core/evaluate.js', 'core/blackjack-rules.js',
  'bots/holdem-bot.js',
  'games/holdem.js', 'games/blackjack.js', 'games/roulette.js', 'games/crash.js',
  'games/landlords-data.js', 'games/landlords.js',
];
rmSync(to, { recursive: true, force: true });
for (const f of FILES) {
  const src = readFileSync(join(from, f), 'utf8').replace(/(from\s+['"][^'"]+?)\?v=\d+(['"])/g, '$1$2');
  mkdirSync(dirname(join(to, f)), { recursive: true });
  writeFileSync(join(to, f), src);
}
console.log(`synced ${FILES.length} engine files`);
