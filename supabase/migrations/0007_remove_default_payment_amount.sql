-- ============================================================================
-- TIPOVAČKA LIGA MAJSTROV 2026 — remove the €20 default payment amount
-- ============================================================================
-- players.payment_amount (migration 0004) defaulted new rows to 20, so
-- every player created via the admin-create-player Edge Function silently
-- got €20 regardless of what they actually paid. The admin now enters the
-- real amount explicitly in the Add Player form; the Edge Function sets
-- payment_amount right after creating the account. This just removes the
-- old default so nothing falls back to 20 by accident — the "not null"
-- constraint still requires a value, so the default becomes 0 (a genuinely
-- neutral "nothing entered" value, and 0 is an explicitly allowed amount).
--
-- Existing players' payment_amount values are untouched — this only
-- changes what NEW rows get if a caller ever omits the column.
--
-- Idempotent / safe to re-run.
-- ============================================================================

alter table public.players
  alter column payment_amount set default 0;
