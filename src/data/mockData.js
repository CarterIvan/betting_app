// Seed / demo data. Only used once, the first time the app runs on a device
// (see services/dataService.js#initializeIfEmpty). Match kickoff times are
// generated relative to "now" so the LIVE / UPCOMING / FINISHED demo always
// works no matter what day the app is opened.

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR

function splitDateTime(ts) {
  const d = new Date(ts)
  const date = d.toISOString().slice(0, 10)
  const startTime = d.toTimeString().slice(0, 5)
  return { date, startTime }
}

export const MOCK_PLAYERS = [
  { id: 'p-admin', name: 'Admin', password: 'admin123', isAdmin: true, points: 0 },
  { id: 'p-ivan', name: 'Ivan', password: 'ivan123', isAdmin: true, points: 0 },
  { id: 'p-martin', name: 'Martin', password: 'martin123', isAdmin: false, points: 0 },
  { id: 'p-peter', name: 'Peter', password: 'peter123', isAdmin: false, points: 0 },
  { id: 'p-marek', name: 'Marek', password: 'marek123', isAdmin: false, points: 0 },
  { id: 'p-jan', name: 'Ján', password: 'jan123', isAdmin: false, points: 0 },
  { id: 'p-tomas', name: 'Tomáš', password: 'tomas123', isAdmin: false, points: 0 },
]

const now = Date.now()

export const MOCK_MATCHES = [
  // Finished matches -> História
  {
    id: 'm-1',
    homeTeam: 'real-madrid',
    awayTeam: 'napoli',
    ...splitDateTime(now - 5 * DAY),
    finished: true,
    finalHomeScore: 2,
    finalAwayScore: 0,
  },
  {
    id: 'm-2',
    homeTeam: 'arsenal',
    awayTeam: 'roma',
    ...splitDateTime(now - 3 * DAY),
    finished: true,
    finalHomeScore: 4,
    finalAwayScore: 1,
  },
  {
    id: 'm-3',
    homeTeam: 'bayern-munchen',
    awayTeam: 'paris',
    ...splitDateTime(now - 2 * DAY),
    finished: true,
    finalHomeScore: 1,
    finalAwayScore: 1,
  },
  // Live match -> started, not finished
  {
    id: 'm-4',
    homeTeam: 'inter',
    awayTeam: 'barcelona',
    ...splitDateTime(now - 35 * (60 * 1000)),
    finished: false,
    finalHomeScore: null,
    finalAwayScore: null,
  },
  // Upcoming matches
  {
    id: 'm-5',
    homeTeam: 'villarreal',
    awayTeam: 'porto',
    ...splitDateTime(now + 4 * HOUR),
    finished: false,
    finalHomeScore: null,
    finalAwayScore: null,
  },
  {
    id: 'm-6',
    homeTeam: 'manchester-city',
    awayTeam: 'liverpool',
    ...splitDateTime(now + 1 * DAY),
    finished: false,
    finalHomeScore: null,
    finalAwayScore: null,
  },
  {
    id: 'm-7',
    homeTeam: 'borussia-dortmund',
    awayTeam: 'atletico-madrid',
    ...splitDateTime(now + 2 * DAY),
    finished: false,
    finalHomeScore: null,
    finalAwayScore: null,
  },
  {
    id: 'm-8',
    homeTeam: 'psv',
    awayTeam: 'sporting-cp',
    ...splitDateTime(now + 3 * DAY + 3 * HOUR),
    finished: false,
    finalHomeScore: null,
    finalAwayScore: null,
  },
  {
    id: 'm-9',
    homeTeam: 'galatasaray',
    awayTeam: 'fenerbahce',
    ...splitDateTime(now + 5 * DAY),
    finished: false,
    finalHomeScore: null,
    finalAwayScore: null,
  },
]

// Predictions for the finished + live matches, so the ranking / stats / live
// panel have believable data out of the box.
export const MOCK_PREDICTIONS = [
  // m-1: Real Madrid 2 : 0 Napoli
  { id: 'pr-1', playerId: 'p-ivan', matchId: 'm-1', predictedHome: 2, predictedAway: 0, createdAt: now - 6 * DAY, updatedAt: now - 6 * DAY, points: null },
  { id: 'pr-2', playerId: 'p-martin', matchId: 'm-1', predictedHome: 1, predictedAway: 0, createdAt: now - 6 * DAY, updatedAt: now - 6 * DAY, points: null },
  { id: 'pr-3', playerId: 'p-peter', matchId: 'm-1', predictedHome: 0, predictedAway: 2, createdAt: now - 6 * DAY, updatedAt: now - 6 * DAY, points: null },
  { id: 'pr-4', playerId: 'p-marek', matchId: 'm-1', predictedHome: 2, predictedAway: 1, createdAt: now - 6 * DAY, updatedAt: now - 6 * DAY, points: null },

  // m-2: Arsenal 4 : 1 Roma
  { id: 'pr-5', playerId: 'p-ivan', matchId: 'm-2', predictedHome: 2, predictedAway: 1, createdAt: now - 4 * DAY, updatedAt: now - 4 * DAY, points: null },
  { id: 'pr-6', playerId: 'p-martin', matchId: 'm-2', predictedHome: 4, predictedAway: 1, createdAt: now - 4 * DAY, updatedAt: now - 4 * DAY, points: null },
  { id: 'pr-7', playerId: 'p-peter', matchId: 'm-2', predictedHome: 1, predictedAway: 1, createdAt: now - 4 * DAY, updatedAt: now - 4 * DAY, points: null },
  { id: 'pr-8', playerId: 'p-jan', matchId: 'm-2', predictedHome: 3, predictedAway: 0, createdAt: now - 4 * DAY, updatedAt: now - 4 * DAY, points: null },

  // m-3: Bayern 1 : 1 Paris
  { id: 'pr-9', playerId: 'p-ivan', matchId: 'm-3', predictedHome: 0, predictedAway: 0, createdAt: now - 2.5 * DAY, updatedAt: now - 2.5 * DAY, points: null },
  { id: 'pr-10', playerId: 'p-martin', matchId: 'm-3', predictedHome: 2, predictedAway: 1, createdAt: now - 2.5 * DAY, updatedAt: now - 2.5 * DAY, points: null },
  { id: 'pr-11', playerId: 'p-tomas', matchId: 'm-3', predictedHome: 1, predictedAway: 1, createdAt: now - 2.5 * DAY, updatedAt: now - 2.5 * DAY, points: null },

  // m-4: live Inter vs Barcelona
  { id: 'pr-12', playerId: 'p-martin', matchId: 'm-4', predictedHome: 2, predictedAway: 1, createdAt: now - 2 * HOUR, updatedAt: now - 2 * HOUR, points: null },
  { id: 'pr-13', playerId: 'p-ivan', matchId: 'm-4', predictedHome: 1, predictedAway: 1, createdAt: now - 2 * HOUR, updatedAt: now - 2 * HOUR, points: null },
  { id: 'pr-14', playerId: 'p-peter', matchId: 'm-4', predictedHome: 2, predictedAway: 0, createdAt: now - 2 * HOUR, updatedAt: now - 2 * HOUR, points: null },
  { id: 'pr-15', playerId: 'p-marek', matchId: 'm-4', predictedHome: 3, predictedAway: 1, createdAt: now - 2 * HOUR, updatedAt: now - 2 * HOUR, points: null },
]

export const MOCK_CHAT = [
  { id: 'c-1', playerId: 'p-martin', playerName: 'Martin', text: '🔥 Dnes to vidím na 2:1', createdAt: now - 50 * 60 * 1000 },
  { id: 'c-2', playerId: 'p-ivan', playerName: 'Ivan', text: 'Myslím, že to bude remíza 😄', createdAt: now - 46 * 60 * 1000 },
  { id: 'c-3', playerId: 'p-peter', playerName: 'Peter', text: 'Inter má slabú obranu, dávam Barci 3 góly ⚽', createdAt: now - 40 * 60 * 1000 },
  { id: 'c-4', playerId: 'p-marek', playerName: 'Marek', text: 'Uvidíme 👀 hlavne nech je to zápas bez zranení', createdAt: now - 20 * 60 * 1000 },
]

export const MOCK_READ_STATE = {
  // last chat message id each player has seen — used to compute unread badge
  'p-ivan': 'c-2',
}
