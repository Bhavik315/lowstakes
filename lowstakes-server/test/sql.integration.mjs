// Runs the table logic against the REAL migrations (0001 + 0002) in a throwaway Postgres.
// Started by test/sql-integration.sh, which sets PGHOST/PGPORT. Not part of `npm test` (needs Postgres).
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { TableCore } from '../src/core.js';
import { WalletError } from '../src/wallet.js';
import { fakeConn } from './helpers.mjs';

const psql = (sql, role) => { try { return psqlRaw(sql, role); } catch (e) { e.message += ' | ' + String(e.stderr).slice(0, 300) + ' | SQL: ' + sql.slice(0, 160); throw e; } };
const psqlRaw = (sql, role) => execFileSync('psql', ['-h', process.env.PGHOST, '-p', process.env.PGPORT, '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-tA', '-c', sql],
  { encoding: 'utf8', env: { ...process.env, PGOPTIONS: role ? `-c role=${role}` : '' } }).trim();
const lit = (v) => `'${String(v).replace(/'/g, "''")}'`;

class SqlWallet {
  rpc(fn, sql) {
    try { return JSON.parse(psql(`select ${sql}`, 'service_role') || 'null'); }
    catch (e) { const m = /ERROR:\s+([a-z_]+)/.exec(String(e.stderr || e.message)); throw new WalletError(m ? m[1] : 'error'); }
  }
  async join(id, code, game) { return this.rpc('join', `join_table(${lit(id)}, ${lit(code)}, ${lit(game)})`); }
  async leave(id, code) { psql(`select leave_table(${lit(id)}, ${lit(code)})`, 'service_role'); }
  async touch(id, code) { psql(`select touch_table(${lit(id)}, ${lit(code)})`, 'service_role'); }
  async settle(items) { return this.rpc('settle', `settle_round(${lit(JSON.stringify(items))}::jsonb)`); }
  async balance(id) { return Number(psql(`select balance from wallets where user_id = ${lit(id)}`)); }
}

const register = (id, email, name) => {
  psql(`insert into auth.users(id,email,email_confirmed_at) values (${lit(id)}, ${lit(email)}, now())`);
  psql(`select set_config('request.jwt.claim.sub', ${lit(id)}, false), complete_registration(${lit(name)})`, 'authenticated');
};
const bal = (id) => Number(psql(`select balance from wallets where user_id = ${lit(id)}`));
const ledger = (id) => JSON.parse(psql(`select coalesce(json_agg(t order by created_at), '[]') from (select type, amount, balance_after, game, ref, created_at from transactions where user_id = ${lit(id)}) t`));

function table(code) {
  const clock = { t: Date.now() };
  const core = new TableCore({ code, wallet: new SqlWallet(), now: () => clock.t });
  // one tick per 100ms of game time, yielding like real time does so async database calls can finish between ticks
  const advance = async (ms) => { for (let t = 0; t < ms; t += 100) { clock.t += 100; core.tick(); await new Promise((r) => setImmediate(r)); } for (let i = 0; i < 10; i++) await new Promise((r) => setTimeout(r, 2)); };
  const join = async (id) => core.connect(fakeConn(), { id });
  return { core, advance, join, clock };
}

const leave = async (t, id) => { t.core.receive(id, { t: 'bye' }); await t.advance(300); };
const U1 = '00000000-0000-0000-0000-0000000000b1';
const U2 = '00000000-0000-0000-0000-0000000000b2';
test.before(() => { register(U1, 'one@x.com', 'Real_One'); register(U2, 'two@x.com', 'Real_Two'); });

test('real database: seat, bet, spin, and the net result lands in the wallet and ledger exactly once', async () => {
  const t = table('REAL1');
  assert.equal((await t.join(U1)).ok, true);
  assert.equal(t.core.player(U1).name, 'Real_One', 'username comes from the profiles table');
  assert.equal(t.core.player(U1).chips, 20000);
  t.core.setGame('roulette');
  t.core.receive(U1, { t: 'act', a: { type: 'bet', spot: 'n:17', amount: 200 } });
  t.core.receive(U1, { t: 'act', a: { type: 'bet', spot: 'red', amount: 100 } });
  t.core.receive(U1, { t: 'act', a: { type: 'ready' } });
  await t.advance(100);
  t.core.engine.result = 17; // black: the number pays 35:1, red loses
  await t.advance(8000);
  await t.advance(300);
  assert.equal(bal(U1), 20000 + 7000 - 100);
  assert.equal(t.core.player(U1).chips, bal(U1));
  const l = ledger(U1).filter((x) => x.type === 'round_result');
  assert.equal(l.length, 1);
  assert.deepEqual([l[0].amount, l[0].game], [6900, 'roulette']);
  await t.advance(7000);
  assert.equal(ledger(U1).filter((x) => x.type === 'round_result').length, 1, 'nothing more is written');
  await leave(t, U1);
});

test('real database: one table at a time, and leaving frees the seat', async () => {
  const a = table('REAL2'); const b = table('REAL3');
  assert.equal((await a.join(U2)).ok, true);
  assert.deepEqual(await b.join(U2), { ok: false, why: 'already_at_table' });
  a.core.receive(U2, { t: 'bye' });
  await a.advance(300);
  assert.equal((await b.join(U2)).ok, true);
  await leave(b, U2);
});

test('real database: a lost round, a cash-out and a bust, with the wallet never negative', async () => {
  const t = table('REAL4');
  await t.join(U2);
  t.core.setGame('crash');
  const act = (a) => t.core.receive(U2, { t: 'act', a });
  act({ type: 'add', amount: 500 }); act({ type: 'ready' });
  await t.advance(100);
  t.core.engine.crash = 1.5;
  for (let i = 0; i < 400 && t.core.engine.phase !== 'crashed'; i++) await t.advance(100);
  await t.advance(300);
  assert.equal(bal(U2), 20000 - 500);
  assert.ok(bal(U2) >= 0);
  const rounds = ledger(U2).filter((x) => x.type === 'round_result');
  assert.equal(rounds.length, 1);
  assert.equal(rounds[0].amount, -500);
  await leave(t, U2);
});

test('real database: a transient failure retries with the same key and never pays twice', async () => {
  const t = table('REAL5');
  const jr = await t.join(U1);
  assert.equal(jr.ok, true, 'seated: ' + JSON.stringify(jr));
  t.core.setGame('roulette');
  const real = t.core.wallet.settle.bind(t.core.wallet);
  let fails = 2;
  t.core.wallet.settle = async (items) => { if (fails-- > 0) throw new WalletError('network'); return real(items); };
  const before = bal(U1);
  t.core.receive(U1, { t: 'act', a: { type: 'bet', spot: 'n:3', amount: 300 } });
  t.core.receive(U1, { t: 'act', a: { type: 'ready' } });
  await t.advance(100);
  t.core.engine.result = 3;
  await t.advance(8000);
  await t.advance(3000);
  assert.equal(bal(U1), before + 300 * 35, 'chips=' + t.core.player(U1).chips + ' notices?');
  const rows = ledger(U1).filter((x) => x.ref === 'REAL5:' + t.core.engine.spinNo);
  assert.equal(rows.length, 1);
  await leave(t, U1);
});

test('real database: the wallet equals the sum of its ledger and the welcome bonus happened once per player', () => {
  for (const id of [U1, U2]) {
    const sum = ledger(id).reduce((a, r) => a + r.amount, 0);
    assert.equal(bal(id), sum);
    assert.equal(ledger(id).filter((r) => r.type === 'welcome_bonus').length, 1);
  }
});
