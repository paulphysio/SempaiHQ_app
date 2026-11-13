// Pure helpers that turn server match data into what the screen shows. No React, no network.

export const OPEN_STATUSES = ['waiting', 'active', 'settling', 'settle_failed'];
export const isOpen = (m) => !!m && OPEN_STATUSES.includes(m.status);
export const isFinished = (m) => !!m && ['settling', 'settle_failed', 'settled'].includes(m.status);

export const shortAddr = (a) => (a ? `${a.slice(0, 4)}…${a.slice(-4)}` : '');

/** The match from my point of view. side is 'a' or 'b'. */
export function viewOf(m, side) {
  const a = side === 'a';
  return {
    hand: a ? m.hand_a : m.hand_b,
    oppHand: a ? m.hand_b : m.hand_a,
    wins: a ? m.wins_a : m.wins_b,
    oppWins: a ? m.wins_b : m.wins_a,
    lockedMe: a ? m.locked_a : m.locked_b,
    lockedOpp: a ? m.locked_b : m.locked_a,
    myWallet: a ? m.wallet_a : m.wallet_b,
    oppWallet: a ? m.wallet_b : m.wallet_a,
  };
}

/** One resolved round (server row) from my point of view. res: win | lose | tie | idle */
export function roundForMe(r, side) {
  const a = side === 'a';
  const res = r.result === 'tie' || r.result === 'idle' ? r.result : r.result === side ? 'win' : 'lose';
  return { round: r.round, myCard: a ? r.card_a : r.card_b, oppCard: a ? r.card_b : r.card_a, res, forfeit: !!r.forfeit };
}

/** Round caption for the reveal. */
export function roundMessage(v, names, oppName) {
  if (v.res === 'idle') return 'Nobody locked in. Round skipped.';
  if (v.forfeit && !v.myCard) return 'You did not lock in. Round forfeited.';
  if (v.forfeit && !v.oppCard) return `${oppName} timed out. The round is yours.`;
  if (v.res === 'tie') return 'Tie. Both cards are gone. Replay the round.';
  return v.res === 'win'
    ? `${names[v.myCard]} beats ${names[v.oppCard]}. You take the round.`
    : `${names[v.oppCard]} beats ${names[v.myCard]}. ${oppName} takes the round.`;
}

const fmt = (units, decimals) => {
  const n = Number(units) / 10 ** decimals;
  return `${Math.round(n * 100) / 100}`;
};

/** End-of-match summary. cfg needs { decimals, feeBps }. kind: win | lose | draw */
export function endInfo(m, side, cfg) {
  const wager = BigInt(m.wager);
  const pool = wager * 2n;
  const fee = (pool * BigInt(cfg.feeBps)) / 10000n;
  const payout = pool - fee;
  const paid = m.status === 'settled';
  const tail = paid ? 'Payout sent.' : m.status === 'settle_failed' ? 'Payout is delayed and will be retried.' : 'Sending payout…';

  if (m.outcome === 'win') {
    if (m.winner === side) return { kind: 'win', sub: `You won ${fmt(payout, cfg.decimals)} SKR after the 10% fee. ${tail}` };
    return { kind: 'lose', sub: `You lost ${fmt(wager, cfg.decimals)} SKR.` };
  }
  if (m.outcome === 'cancelled') return { kind: 'draw', sub: `No opponent was found. Your ${fmt(wager, cfg.decimals)} SKR is refunded. ${tail}` };
  if (m.outcome === 'void') return { kind: 'draw', sub: `Match voided because nobody played. Wagers are refunded. ${tail}` };
  return { kind: 'draw', sub: `It is a draw. Wagers are refunded. ${tail}` };
}
