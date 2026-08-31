// Everything else has moved to Supabase (see services/authService.js,
// playersService.js, teamsService.js, matchesService.js,
// predictionsService.js, chatService.js). The one thing that intentionally
// stays local: which chat message a player has last read, purely to drive
// the "Chat (N)" unread badge. It's cosmetic, per-device, not shared data —
// not worth a table/round-trip, so it stays in localStorage.

const READ_STATE_KEY = 'tipovacka_chat_read'

function read() {
  try {
    const raw = localStorage.getItem(READ_STATE_KEY)
    return raw === null ? {} : JSON.parse(raw)
  } catch {
    return {}
  }
}

function write(state) {
  localStorage.setItem(READ_STATE_KEY, JSON.stringify(state))
}

const dataService = {
  getReadState: () => Promise.resolve(read()),
  saveReadState: (state) => {
    write(state)
    return Promise.resolve(state)
  },
}

export default dataService
