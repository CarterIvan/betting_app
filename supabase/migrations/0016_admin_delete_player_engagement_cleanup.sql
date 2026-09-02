-- ============================================================================
-- TIPOVAČKA LIGA MAJSTROV 2026 — admin_delete_player engagement cleanup
-- ============================================================================
-- Result Correction (migration 0012) and League Announcements (migration
-- 0014) both added tables referencing players with ON DELETE NO ACTION —
-- deliberately, to stop a targeted admin_delete_player() call from removing
-- an inconvenient voter mid-vote. Migration 0015 cleared these tables
-- WHOLESALE, but only ahead of a full league reset — that's correct for a
-- reset (everything is being wiped anyway) but wrong here: a single player
-- deletion must never touch another player's rows.
--
-- Root cause of the "Igrača nije moguće obrisati." failure: any player who
-- has ever cast a correction vote, acknowledged an announcement, requested
-- a correction, or created an announcement still has a row in one of these
-- four tables, and admin_delete_player()'s plain `delete from
-- public.players` has no cleanup step for them at all — Postgres rejects
-- the delete outright (23503, result_correction_votes_player_id_fkey,
-- reproduced against production in a rolled-back transaction).
--
-- This migration replaces admin_delete_player() only. It does not touch
-- reset_league_data(), clear_result_correction_and_announcement_data(), or
-- any FK's ON DELETE behavior — those stay exactly as migrations 0012,
-- 0014 and 0015 left them.
--
-- New behavior, in order:
--   1. Block deletion outright if the player is the requester of, or an
--      eligible voter (voted or not — see below) on, a still-PENDING
--      correction request. "Pending" is the literal status value used
--      throughout 0012 (result_correction_requests.status, default
--      'pending', check constraint ('pending','approved','rejected'),
--      the partial unique index that allows only one pending request per
--      match). This is the one case a scoped cleanup cannot safely paper
--      over: deleting a required voter mid-vote would either silently
--      erase their cast vote or leave the process permanently unable to
--      reach unanimity (a vacated eligibility slot is never re-added).
--   2. Otherwise, delete ONLY that player's own rows from the four
--      engagement tables — never another player's — then delete the
--      players row itself. Everything here is one function call, hence
--      one implicit transaction: any failure mid-way rolls back the
--      entire operation automatically, including the final player delete.
--
-- Two of those four tables need a second step beyond "delete this
-- player's own rows", because they are themselves referenced by other
-- NO ACTION children (see 0015's own comment on this):
--   - Deleting a RESOLVED correction request this player created would
--     violate result_correction_votes.request_id unless every voter's
--     row on that specific request is removed first. Rule 1 above already
--     guarantees the request is resolved (not pending) before this runs,
--     so those votes are dead history for a decision that's already been
--     made — removing them removes the play-by-play of settled votes on
--     this one request, not any player's participation in anything still
--     active. See "Edge cases" in the follow-up report for the deliberate
--     scope of this.
--   - Symmetrically, deleting an announcement this player created would
--     violate league_announcement_reads.announcement_id unless every
--     other reader's acknowledgment of that announcement is removed
--     first. In practice this table is currently unreachable in
--     production (league_announcements_admin_insert only lets an is_admin
--     player insert, and admin_delete_player() already refuses to delete
--     an admin), but is handled here defensively in case a player is ever
--     demoted from admin after creating one.
--
-- Idempotent / safe to re-run (create or replace). Does not modify or
-- delete any existing row at migration-apply time — this only redefines a
-- function; nothing runs until it's next called.
-- ============================================================================

create or replace function public.admin_delete_player(p_player_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.players where id = auth.uid() and is_admin) then
    raise exception 'Iba administrátor môže odstrániť hráča.' using errcode = '42501';
  end if;

  if not exists (select 1 from public.players where id = p_player_id) then
    raise exception 'Hráč neexistuje.' using errcode = 'P0002';
  end if;

  if exists (select 1 from public.players where id = p_player_id and is_admin) then
    raise exception 'Administrátorský účet nie je možné odstrániť.' using errcode = '42501';
  end if;

  -- Rule 1/2: block outright while the player is the requester of, or an
  -- eligible voter (cast or not — result_correction_votes rows are the
  -- eligibility snapshot itself, see 0012) on, any still-pending
  -- correction request. Scoped cleanup only ever proceeds once this is
  -- false, i.e. every request this player is involved in is resolved.
  if exists (
    select 1 from public.result_correction_requests
    where requested_by = p_player_id and status = 'pending'
  ) or exists (
    select 1
    from public.result_correction_votes v
    join public.result_correction_requests r on r.id = v.request_id
    where v.player_id = p_player_id and r.status = 'pending'
  ) then
    raise exception 'Hráča nie je možné odstrániť, kým prebieha oprava výsledku, ktorej sa týka.' using errcode = '22023';
  end if;

  -- This player's own votes on anyone's (resolved) requests.
  delete from public.result_correction_votes where player_id = p_player_id;

  -- Every voter's row on requests THIS player created — required before
  -- those requests can be deleted below (result_correction_votes.request_id
  -- is itself ON DELETE NO ACTION against result_correction_requests). Rule
  -- 1 above already guarantees every such request is resolved, not pending.
  delete from public.result_correction_votes
  where request_id in (
    select id from public.result_correction_requests where requested_by = p_player_id
  );

  delete from public.result_correction_requests where requested_by = p_player_id;

  -- This player's own acknowledgments of anyone's announcements.
  delete from public.league_announcement_reads where player_id = p_player_id;

  -- Every reader's acknowledgment of announcements THIS player created —
  -- required before those announcements can be deleted below
  -- (league_announcement_reads.announcement_id is itself ON DELETE NO
  -- ACTION against league_announcements). Currently unreachable in
  -- practice (only admins can create announcements, and admins can't be
  -- deleted), kept for correctness if that ever changes.
  delete from public.league_announcement_reads
  where announcement_id in (
    select id from public.league_announcements where created_by = p_player_id
  );

  delete from public.league_announcements where created_by = p_player_id;

  -- predictions/chat_messages cascade via their existing FK to players.id.
  -- auth.users is never touched, so the person's account (and ability to
  -- log in elsewhere) is unaffected; they simply have no profile in this
  -- competition anymore.
  delete from public.players where id = p_player_id;
end;
$$;
