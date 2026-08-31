-- ============================================================================
-- TIPOVAČKA LIGA MAJSTROV 2026 — payment-gated access + prize fund (Banka)
-- ============================================================================
-- Adds:
--   1. players.is_paid / payment_amount / paid_at — a player only gets
--      access once Admin marks them paid.
--   2. public.settings — one singleton row holding the 1st/2nd/3rd place
--      prize amounts (single source of truth, admin-editable).
--   3. public.has_access() — the ONE place "does this caller get to use the
--      app" is decided, reused by every table's RLS so access is enforced
--      by Postgres itself, not just by hiding screens in the frontend.
--
-- IMPORTANT — this app already has real players actively using it. Adding
-- `is_paid` with a `false` default would otherwise instantly lock every
-- existing player out the moment this runs. To avoid that destructive
-- side effect, every player who already exists at migration time is
-- backfilled to `is_paid = true` (grandfathered in) — the `false` default
-- only applies to players created from here on, matching "a new player
-- starts unpaid". Review this and adjust the backfill if you'd rather every
-- current player be re-confirmed manually.
--
-- Idempotent / safe to re-run.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. players — payment fields
-- ----------------------------------------------------------------------------
alter table public.players
  add column if not exists is_paid boolean not null default false,
  add column if not exists payment_amount numeric(10, 2) not null default 20,
  add column if not exists paid_at timestamptz;

alter table public.players
  drop constraint if exists players_payment_amount_non_negative;
alter table public.players
  add constraint players_payment_amount_non_negative check (payment_amount >= 0);

-- Grandfather in everyone who already exists (see note above) — new players
-- created after this point still get the `false` default.
update public.players set is_paid = true, paid_at = coalesce(paid_at, now()) where is_paid = false;

-- Admin may update any player's payment fields (never points/is_admin/name —
-- those stay exactly as locked down as before). A player still cannot touch
-- their own payment fields at all — no self-service "mark myself as paid".
drop policy if exists players_admin_update_payment on public.players;
create policy players_admin_update_payment on public.players for update to authenticated
  using (exists (select 1 from public.players p where p.id = auth.uid() and p.is_admin))
  with check (exists (select 1 from public.players p where p.id = auth.uid() and p.is_admin));

grant update (is_paid, payment_amount, paid_at) on public.players to authenticated;

-- IMPORTANT: the grant above and the RLS policy above are not, on their
-- own, enough. `players` already has a SEPARATE permissive UPDATE policy
-- from migration 0003 (`players_update_own_avatar`, using/with check just
-- `id = auth.uid()`, for the avatar feature) — and Postgres combines
-- multiple permissive policies for the same command with OR. That policy
-- has no idea which columns a given UPDATE touches, so a normal player's
-- own "update my row" request would satisfy it regardless of whether
-- is_paid/payment_amount/paid_at are among the changed columns — RLS row
-- checks alone can't express "this row, but only some columns". A BEFORE
-- UPDATE trigger closes that gap the same way the prediction save-limit
-- does: it explicitly rejects any change to these three columns unless the
-- caller is an admin, regardless of which policy let the statement through.
create or replace function public.enforce_player_self_update_restrictions()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_admin boolean;
begin
  -- auth.uid() is NULL outside an authenticated PostgREST request (a
  -- migration script, or the project owner running SQL directly in the
  -- dashboard as the postgres role) — that's already a strictly higher
  -- trust level than anything the app's own API surface can reach, so it's
  -- intentionally left unrestricted here. Every request the app's own
  -- client can make always carries a real auth.uid(), so this only ever
  -- exempts direct database access, never a regular player's request.
  if auth.uid() is null then
    return NEW;
  end if;

  select is_admin into v_is_admin from public.players where id = auth.uid();

  if not coalesce(v_is_admin, false) then
    if NEW.is_paid is distinct from OLD.is_paid
       or NEW.payment_amount is distinct from OLD.payment_amount
       or NEW.paid_at is distinct from OLD.paid_at then
      raise exception 'Iba administrátor môže zmeniť stav platby.' using errcode = '42501';
    end if;
  end if;

  return NEW;
end;
$$;

drop trigger if exists trg_player_self_update_restrictions on public.players;
create trigger trg_player_self_update_restrictions
  before update on public.players
  for each row execute function public.enforce_player_self_update_restrictions();

-- ----------------------------------------------------------------------------
-- 2. has_access() — reused by every table's RLS below. Defined here, before
-- anything references it: CREATE POLICY resolves the functions its
-- expression calls immediately (unlike a plpgsql body), so every policy
-- below needs this to already exist.
-- ----------------------------------------------------------------------------
-- SECURITY DEFINER so it can read `players` regardless of the caller's own
-- row-visibility (avoids any RLS-recursion subtlety from being called
-- inside other tables' policies), but it only ever answers a yes/no
-- question about the CALLER's own paid/admin status — it exposes nothing.
create or replace function public.has_access()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.players
    where id = auth.uid() and (is_paid or is_admin)
  );
$$;

-- ----------------------------------------------------------------------------
-- 3. settings — singleton row for the prize fund distribution
-- ----------------------------------------------------------------------------
create table if not exists public.settings (
  id                    boolean primary key default true,
  first_place_prize     numeric(10, 2) not null default 0,
  second_place_prize    numeric(10, 2) not null default 0,
  third_place_prize     numeric(10, 2) not null default 0,
  updated_at            timestamptz not null default now(),
  constraint settings_singleton check (id),
  constraint settings_prizes_non_negative check (
    first_place_prize >= 0 and second_place_prize >= 0 and third_place_prize >= 0
  )
);

insert into public.settings (id) values (true) on conflict (id) do nothing;

alter table public.settings enable row level security;

drop policy if exists settings_select on public.settings;
create policy settings_select on public.settings for select to authenticated
  using (public.has_access());

drop policy if exists settings_admin_update on public.settings;
create policy settings_admin_update on public.settings for update to authenticated
  using (exists (select 1 from public.players p where p.id = auth.uid() and p.is_admin))
  with check (exists (select 1 from public.players p where p.id = auth.uid() and p.is_admin));

grant select on public.settings to authenticated;
grant update (first_place_prize, second_place_prize, third_place_prize, updated_at) on public.settings to authenticated;

-- ----------------------------------------------------------------------------
-- 4. RLS — every existing "any authenticated user" read/write now also
-- requires has_access(). This is the actual enforcement: an unpaid player's
-- Supabase session can authenticate (valid email/password), but every
-- query against real app data is rejected by Postgres itself — not just by
-- the frontend choosing not to render a page.
-- ----------------------------------------------------------------------------
drop policy if exists teams_select on public.teams;
create policy teams_select on public.teams for select to authenticated
  using (public.has_access());

-- A player can always read their OWN row (needed to even determine "am I
-- paid yet" and show the right screen) — everyone else's rows only become
-- visible once the caller themselves has access.
drop policy if exists players_select on public.players;
create policy players_select on public.players for select to authenticated
  using (id = auth.uid() or public.has_access());

drop policy if exists matches_select on public.matches;
create policy matches_select on public.matches for select to authenticated
  using (public.has_access());

drop policy if exists predictions_select on public.predictions;
create policy predictions_select on public.predictions for select to authenticated
  using (public.has_access());

drop policy if exists predictions_insert_own on public.predictions;
create policy predictions_insert_own on public.predictions for insert to authenticated
  with check (
    public.has_access()
    and player_id = auth.uid()
    and exists (
      select 1 from public.matches m
      where m.id = match_id and m.finished = false and m.start_time > now()
    )
  );

drop policy if exists predictions_update_own on public.predictions;
create policy predictions_update_own on public.predictions for update to authenticated
  using (player_id = auth.uid())
  with check (
    public.has_access()
    and player_id = auth.uid()
    and exists (
      select 1 from public.matches m
      where m.id = match_id and m.finished = false and m.start_time > now()
    )
  );

drop policy if exists chat_select on public.chat_messages;
create policy chat_select on public.chat_messages for select to authenticated
  using (public.has_access());

drop policy if exists chat_insert_own on public.chat_messages;
create policy chat_insert_own on public.chat_messages for insert to authenticated
  with check (public.has_access() and player_id = auth.uid());
