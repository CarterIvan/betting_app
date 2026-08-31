// Team data itself now lives in Supabase (see services/teamsService.js and
// supabase/seed.sql for the 36 Champions League 2026/27 clubs). This file
// keeps only the small lookup helper every match-related component uses.

export function getTeamById(teams, id) {
  return teams.find((t) => t.id === id) || null
}
