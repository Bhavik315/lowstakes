// A free daily ping so the Supabase project is never idle for a week (free projects are paused after that).
// It asks the database a question with no side effects and reads no player data.
import { SupabaseWallet } from './wallet.js';

export async function keepAlive(env, { fetchFn } = {}) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SECRET_KEY) return { ok: false, why: 'not configured' };
  const wallet = new SupabaseWallet({ url: env.SUPABASE_URL, secretKey: env.SUPABASE_SECRET_KEY, fetchFn });
  try {
    await wallet.rpc('round_gain_cap', { p_game: 'roulette' });
    return { ok: true };
  } catch (e) {
    return { ok: false, why: (e && e.code) || 'error' };
  }
}
