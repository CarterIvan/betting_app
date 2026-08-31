import { supabase } from '../lib/supabase'

function mapTeam(row) {
  return {
    id: row.id,
    name: row.name,
    shortName: row.short_name,
    country: row.country,
    logo: row.logo,
    primary: row.primary_color,
    secondary: row.secondary_color,
  }
}

async function getAll() {
  const { data, error } = await supabase
    .from('teams')
    .select('id, name, short_name, country, logo, primary_color, secondary_color')
    .order('name')
  if (error) throw error
  return data.map(mapTeam)
}

const teamsService = { getAll }

export default teamsService
