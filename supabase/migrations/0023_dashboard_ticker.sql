-- ============================================================================
-- TIPOVAČKA LIGA MAJSTROV 2026 (PickMates) — Dashboard announcement ticker
-- ============================================================================
-- Adds one nullable column to the EXISTING `settings` singleton table —
-- reused deliberately instead of the existing `league_announcements`
-- table (migration 0014) or a new table. Inspected both first:
--
--   - league_announcements is append-only BY DESIGN (announcementService's
--     own comment: "there is no edit in place"; republishing always
--     inserts a new row so every member gets a fresh, unacknowledged
--     popup) and is paired with league_announcement_reads for per-player
--     acknowledgment tracking. The ticker needs the opposite shape:
--     edit-in-place, remove-to-nothing, no acknowledgment at all. Forcing
--     the ticker into that table would mean either polluting the popup's
--     audit trail with rows that don't belong to it, or bolting on
--     conditional UPDATE/DELETE policies that only apply to some rows —
--     more complex and more risky than reusing a table already built for
--     exactly this "one current value, admin-editable" shape.
--   - `settings` already holds exactly that shape twice over — logo_url
--     (migration 0008) and payment_iban (migration 0018), both nullable,
--     both admin-write-only, both "current value or nothing". This is a
--     third instance of that same established pattern, not a new one.
--
-- `ticker_message` is nullable, no default — every existing row (there is
-- exactly one, the settings singleton) keeps it NULL until an admin
-- publishes a ticker. NULL is what makes the Dashboard ticker container
-- not render at all — no empty-container state to handle separately.
--
-- Unlike get_league_logo_url()/get_payment_iban(), no bypass RPC is
-- needed here: the ticker only ever appears on the Dashboard, which an
-- unpaid/access-blocked player never reaches anyway (see App.jsx) — so
-- the plain settings_select RLS policy (has_access(), migration 0004,
-- untouched) already covers exactly the intended audience. Admin-only
-- writes reuse the existing settings_admin_update policy (also
-- untouched) — only the column grant below is new, same pattern as
-- logo_url/payment_iban.
--
-- Realtime is enabled on `settings` (previously not enabled for any
-- column) so a ticker publish/edit/removal reaches every Dashboard
-- already open, without a manual refresh — same guarded pattern already
-- used for chat_messages (0001), chat_read_receipts (0021), and matches
-- (0022). Broadcasting settings' other columns (prize amounts, logo URL,
-- IBAN) alongside this is not a new exposure: RLS still applies to
-- realtime the same as any SELECT, so this only reaches clients who could
-- already read that same row directly.
--
-- Does not modify, delete, or touch any existing row. Idempotent / safe
-- to re-run.
-- ============================================================================

alter table public.settings add column if not exists ticker_message text;

grant update (ticker_message) on public.settings to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'settings'
  ) then
    alter publication supabase_realtime add table public.settings;
  end if;
end $$;
