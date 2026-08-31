-- ============================================================================
-- TIPOVAČKA LIGA MAJSTROV 2026 — seed data
-- ============================================================================
-- Run once, after 0001_init.sql, against a project that has no teams yet.
-- `on conflict do update` makes it safe to re-run (e.g. to refresh colors)
-- without duplicating rows.
--
-- This only seeds `teams`. Players are NOT seeded here — they must be real
-- Supabase Auth users (see the README section "Creating the first users").
-- Matches/predictions/chat start empty; the admin creates matches from the
-- Admin page once logged in.
-- ============================================================================

insert into public.teams (id, name, short_name, country, primary_color, secondary_color) values
  ('aek-athens', 'AEK Athens', 'AEK', 'Grécko', '#F7D117', '#0B0B0B'),
  ('arsenal', 'Arsenal', 'ARS', 'Anglicko', '#EF0107', '#063672'),
  ('aston-villa', 'Aston Villa', 'AVL', 'Anglicko', '#670E36', '#95BFE5'),
  ('atletico-madrid', 'Atlético de Madrid', 'ATM', 'Španielsko', '#CE3524', '#272E61'),
  ('barcelona', 'Barcelona', 'BAR', 'Španielsko', '#A50044', '#004D98'),
  ('bayern-munchen', 'Bayern München', 'BAY', 'Nemecko', '#DC052D', '#0066B2'),
  ('bodo-glimt', 'Bodø/Glimt', 'BOD', 'Nórsko', '#FFD400', '#111111'),
  ('borussia-dortmund', 'Borussia Dortmund', 'BVB', 'Nemecko', '#FDE100', '#000000'),
  ('club-brugge', 'Club Brugge', 'BRU', 'Belgicko', '#0060A9', '#111111'),
  ('como', 'Como', 'COM', 'Taliansko', '#1B3A6B', '#FFFFFF'),
  ('fenerbahce', 'Fenerbahçe', 'FEN', 'Turecko', '#FFED00', '#00205B'),
  ('feyenoord', 'Feyenoord', 'FEY', 'Holandsko', '#E30613', '#FFFFFF'),
  ('galatasaray', 'Galatasaray', 'GAL', 'Turecko', '#A90432', '#FFB300'),
  ('inter', 'Inter', 'INT', 'Taliansko', '#010E80', '#000000'),
  ('lask', 'LASK', 'LAS', 'Rakúsko', '#0B0B0B', '#FFFFFF'),
  ('leipzig', 'Leipzig', 'RBL', 'Nemecko', '#DD0741', '#FFFFFF'),
  ('lens', 'Lens', 'LEN', 'Francúzsko', '#E5231B', '#FFD100'),
  ('lille', 'Lille', 'LIL', 'Francúzsko', '#C8102E', '#002B5C'),
  ('liverpool', 'Liverpool', 'LIV', 'Anglicko', '#C8102E', '#00B2A9'),
  ('manchester-city', 'Manchester City', 'MCI', 'Anglicko', '#6CABDD', '#1C2C5B'),
  ('manchester-united', 'Manchester United', 'MUN', 'Anglicko', '#DA291C', '#FBE122'),
  ('napoli', 'Napoli', 'NAP', 'Taliansko', '#12A0D7', '#003C7E'),
  ('paris', 'Paris', 'PSG', 'Francúzsko', '#004170', '#DA291C'),
  ('porto', 'Porto', 'POR', 'Portugalsko', '#00437A', '#FFFFFF'),
  ('psv', 'PSV', 'PSV', 'Holandsko', '#ED1C24', '#FFFFFF'),
  ('real-betis', 'Real Betis', 'BET', 'Španielsko', '#0BB363', '#FFFFFF'),
  ('real-madrid', 'Real Madrid', 'RMA', 'Španielsko', '#FEBE10', '#0B1E3D'),
  ('roma', 'Roma', 'ROM', 'Taliansko', '#8E1F2F', '#F0BC42'),
  ('sabah', 'Sabah', 'SAB', 'Azerbajdžan', '#FFD200', '#111111'),
  ('shakhtar-donetsk', 'Shakhtar Donetsk', 'SHA', 'Ukrajina', '#FF7900', '#000000'),
  ('slavia-praha', 'Slavia Praha', 'SLA', 'Česko', '#D2001C', '#FFFFFF'),
  ('slovan-bratislava', 'Slovan Bratislava', 'SLB', 'Slovensko', '#0033A0', '#FFFFFF'),
  ('sporting-cp', 'Sporting CP', 'SCP', 'Portugalsko', '#007A33', '#FFFFFF'),
  ('stuttgart', 'Stuttgart', 'VFB', 'Nemecko', '#E32219', '#FFFFFF'),
  ('viking', 'Viking', 'VIK', 'Nórsko', '#003DA5', '#FFFFFF'),
  ('villarreal', 'Villarreal', 'VIL', 'Španielsko', '#FFE667', '#005187')
on conflict (id) do update set
  name = excluded.name,
  short_name = excluded.short_name,
  country = excluded.country,
  primary_color = excluded.primary_color,
  secondary_color = excluded.secondary_color;
