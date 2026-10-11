-- Create withdrawals table for secure withdrawal tracking
CREATE TABLE IF NOT EXISTS withdrawals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  wallet_address TEXT NOT NULL,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL DEFAULT 'SMP',
  chain TEXT NOT NULL DEFAULT 'SOL',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'confirmed', 'failed', 'refunded')),
  transaction_signature TEXT,
  blockhash TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  idempotency_key TEXT UNIQUE
);

-- Create index for idempotency and queries
CREATE INDEX IF NOT EXISTS idx_withdrawals_user_id ON withdrawals(user_id);
CREATE INDEX IF NOT EXISTS idx_withdrawals_status ON withdrawals(status);
CREATE INDEX IF NOT EXISTS idx_withdrawals_signature ON withdrawals(transaction_signature);
CREATE INDEX IF NOT EXISTS idx_withdrawals_idempotency ON withdrawals(idempotency_key);

-- Create wallet_events signature unique index to prevent duplicates
CREATE UNIQUE INDEX IF NOT EXISTS idx_wallet_events_signature_unique ON wallet_events(destination_transaction_signature) WHERE destination_transaction_signature IS NOT NULL;

-- Atomic debit function
CREATE OR REPLACE FUNCTION debit_smp(p_user UUID, p_amount NUMERIC)
RETURNS NUMERIC
LANGUAGE SQL
SECURITY DEFINER
AS $$
  UPDATE wallet_balances
  SET amount = wallet_balances.amount - p_amount
  WHERE user_id = p_user
    AND currency = 'SMP'
    AND chain = 'SOL'
    AND amount >= p_amount
  RETURNING wallet_balances.amount;
$$;

-- Revoke public execute on debit function
REVOKE EXECUTE ON FUNCTION debit_smp FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION debit_smp TO service_role;

-- Atomic credit function (for refunds)
CREATE OR REPLACE FUNCTION credit_smp(p_user UUID, p_amount NUMERIC)
RETURNS NUMERIC
LANGUAGE SQL
SECURITY DEFINER
AS $$
  INSERT INTO wallet_balances (user_id, currency, chain, amount)
  VALUES (p_user, 'SMP', 'SOL', p_amount)
  ON CONFLICT (user_id, currency, chain)
  DO UPDATE SET amount = wallet_balances.amount + p_amount
  RETURNING wallet_balances.amount;
$$;

-- Revoke public execute on credit function
REVOKE EXECUTE ON FUNCTION credit_smp FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION credit_smp TO service_role;

-- Function to check daily withdrawal limit
CREATE OR REPLACE FUNCTION check_daily_withdrawal_limit(p_user UUID, p_amount NUMERIC)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
AS $$
  SELECT COALESCE(SUM(amount), 0) + p_amount <= 10000 -- 10,000 SMP daily limit
  FROM withdrawals
  WHERE user_id = p_user
    AND status IN ('pending', 'sent', 'confirmed')
    AND created_at >= NOW() - INTERVAL '24 hours';
$$;

-- Add function to update withdrawal status
CREATE OR REPLACE FUNCTION update_withdrawal_status(
  p_id UUID,
  p_status TEXT,
  p_signature TEXT DEFAULT NULL,
  p_error TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE SQL
SECURITY DEFINER
AS $$
  UPDATE withdrawals
  SET status = p_status,
      transaction_signature = COALESCE(p_signature, transaction_signature),
      error_message = COALESCE(p_error, error_message),
      updated_at = NOW()
  WHERE id = p_id;
$$;

REVOKE EXECUTE ON FUNCTION update_withdrawal_status FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION update_withdrawal_status TO service_role;
