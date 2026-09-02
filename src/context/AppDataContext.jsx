import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import authService from '../services/authService'
import playersService from '../services/playersService'
import teamsService from '../services/teamsService'
import matchesService from '../services/matchesService'
import predictionsService from '../services/predictionsService'
import chatService from '../services/chatService'
import profileService from '../services/profileService'
import settingsService from '../services/settingsService'
import logoService from '../services/logoService'
import adminActionsService from '../services/adminActionsService'
import dataService from '../services/dataService'
import resultCorrectionService from '../services/resultCorrectionService'
import { getTeamById as findTeam } from '../data/teams'
import { isSupabaseConfigured } from '../lib/supabase'
import { getMatchStatus, MATCH_STATUS } from '../utils/matchState'

const AppDataContext = createContext(null)

export function AppDataProvider({ children }) {
  const [authResolved, setAuthResolved] = useState(false)
  const [dataLoading, setDataLoading] = useState(false)
  // Stored as an i18n KEY (see src/i18n/locales/*.js), not translated text —
  // keeps this provider language-agnostic; App.jsx resolves it via
  // t(loadError) at the point it's actually displayed.
  const [loadError, setLoadError] = useState(isSupabaseConfigured ? '' : 'errors.configMissing')
  const [currentUser, setCurrentUser] = useState(null)
  const [players, setPlayers] = useState([])
  const [teams, setTeams] = useState([])
  const [matches, setMatches] = useState([])
  const [predictions, setPredictions] = useState([])
  const [predictionCompletion, setPredictionCompletion] = useState([])
  const [correctionRequests, setCorrectionRequests] = useState([])
  const [correctionVotes, setCorrectionVotes] = useState([])
  const [chatMessages, setChatMessages] = useState([])
  const [readState, setReadState] = useState({})
  const [settings, setSettings] = useState(null)
  const [leagueLogoUrl, setLeagueLogoUrl] = useState(null)

  // A logged-in-but-unpaid account: real, valid credentials, but no access
  // to anything else yet — Postgres enforces this independently via RLS
  // (see migration 0004's has_access()), this just mirrors it for the UI.
  const accessBlocked = Boolean(currentUser) && !currentUser.isAdmin && !currentUser.isPaid

  // Auth is the single source of truth for `currentUser` — login()/logout()
  // just call Supabase, this listener is what actually updates state, so
  // there is exactly one place that can ever set a logged-in user.
  useEffect(() => {
    if (!isSupabaseConfigured) {
      setAuthResolved(true)
      return
    }
    const unsubscribe = authService.onAuthStateChange((profile) => {
      setCurrentUser(profile)
      setAuthResolved(true)
    })
    return unsubscribe
  }, [])

  // Public (see migration 0008's get_league_logo_url) — fetched once,
  // independent of auth state, so the custom logo shows on the login
  // screen too, before anyone is authenticated.
  useEffect(() => {
    if (!isSupabaseConfigured) return
    settingsService
      .getLogoUrl()
      .then(setLeagueLogoUrl)
      .catch(() => setLeagueLogoUrl(null))
  }, [])

  // Once a user is known AND has access, load the rest of the app's data
  // and keep chat updating live. Tears everything down again on
  // logout/access-revoked. An unpaid account never reaches this — every
  // one of these tables is RLS-gated behind has_access() anyway, so
  // skipping the fetch just avoids a batch of requests that would only
  // come back empty/rejected.
  useEffect(() => {
    if (!currentUser || accessBlocked) {
      setPlayers([])
      setTeams([])
      setMatches([])
      setPredictions([])
      setPredictionCompletion([])
      setCorrectionRequests([])
      setCorrectionVotes([])
      setChatMessages([])
      setSettings(null)
      return
    }

    let cancelled = false
    setDataLoading(true)
    setLoadError('')

    Promise.all([
      playersService.getAll(),
      teamsService.getAll(),
      matchesService.getAll(),
      predictionsService.getAll(),
      chatService.getAll(),
      dataService.getReadState(),
      settingsService.get(),
    ])
      .then(([pls, tms, mts, preds, chat, reads, settingsData]) => {
        if (cancelled) return
        setPlayers(pls)
        setTeams(tms)
        setMatches(mts)
        setPredictions(preds)
        setChatMessages(chat)
        setReadState(reads)
        setSettings(settingsData)
      })
      .catch((err) => {
        if (!cancelled) setLoadError('errors.dataLoadFailed')
      })
      .finally(() => {
        if (!cancelled) setDataLoading(false)
      })

    // Deliberately its OWN promise chain, not part of the Promise.all above —
    // this is an optional enhancement (see migration 0010's
    // get_predictions_completion RPC). Before that migration is applied in
    // a given environment the RPC doesn't exist and this rejects (PGRST202);
    // that must never be able to block players/matches/teams/predictions
    // from loading, so its failure is caught right here and just leaves the
    // completion ring unavailable rather than surfacing anywhere else.
    predictionsService
      .getCompletion()
      .then((completion) => {
        if (!cancelled) setPredictionCompletion(completion)
      })
      .catch(() => {
        if (!cancelled) setPredictionCompletion([])
      })

    // Same reasoning as predictionCompletion above — its own isolated
    // chain, not the critical Promise.all (see migration 0012). Before
    // that migration exists in a given environment these tables/RPCs
    // don't exist and this rejects; that must never block the rest of the
    // app from loading, so it's caught right here and just leaves the
    // correction popup/history unavailable rather than surfacing anywhere
    // else.
    Promise.all([resultCorrectionService.getAllRequests(), resultCorrectionService.getAllVotes()])
      .then(([requests, votes]) => {
        if (cancelled) return
        setCorrectionRequests(requests)
        setCorrectionVotes(votes)
      })
      .catch(() => {
        if (cancelled) return
        setCorrectionRequests([])
        setCorrectionVotes([])
      })

    const unsubscribeChat = chatService.subscribe((message) => {
      setChatMessages((prev) => (prev.some((m) => m.id === message.id) ? prev : [...prev, message]))
    })

    return () => {
      cancelled = true
      unsubscribeChat()
    }
  }, [currentUser, accessBlocked])

  const refetchPlayers = useCallback(() => playersService.getAll().then(setPlayers), [])
  const refetchTeams = useCallback(() => teamsService.getAll().then(setTeams), [])
  // Never rejects — an optional enhancement (see migration 0010), so a
  // missing RPC (not yet deployed) must never surface as a failure to any
  // caller, e.g. savePrediction's follow-up refetch below.
  const refetchPredictionCompletion = useCallback(
    () =>
      predictionsService
        .getCompletion()
        .then(setPredictionCompletion)
        .catch(() => setPredictionCompletion([])),
    []
  )
  const refetchMatches = useCallback(() => matchesService.getAll().then(setMatches), [])
  // Never rejects — same reasoning as refetchPredictionCompletion above
  // (see migration 0012): a missing table/RPC must never surface as a
  // failure to any caller.
  const refetchCorrections = useCallback(
    () =>
      Promise.all([resultCorrectionService.getAllRequests(), resultCorrectionService.getAllVotes()])
        .then(([requests, votes]) => {
          setCorrectionRequests(requests)
          setCorrectionVotes(votes)
        })
        .catch(() => {
          setCorrectionRequests([])
          setCorrectionVotes([])
        }),
    []
  )
  const refetchPredictions = useCallback(() => predictionsService.getAll().then(setPredictions), [])
  const refetchSettings = useCallback(() => settingsService.get().then(setSettings), [])
  const refetchLeagueLogo = useCallback(
    () => settingsService.getLogoUrl().then(setLeagueLogoUrl),
    []
  )
  const refetchChatMessages = useCallback(() => chatService.getAll().then(setChatMessages), [])

  const login = useCallback(async (email, password) => {
    // Deliberately does not setCurrentUser itself — the onAuthStateChange
    // listener above is the single place that does, avoiding two competing
    // writers of the same state.
    await authService.login(email, password)
  }, [])

  const logout = useCallback(async () => {
    await authService.logout()
  }, [])

  /** Storage RLS enforces "own folder only" server-side (see migration
   * 0003) — this can genuinely reject for a tampered request, not just a
   * disabled button. Updates `currentUser` immediately for a snappy header,
   * then refreshes the full `players` list so the ranking/podium/chat pick
   * up the new photo too. */
  const uploadAvatar = useCallback(
    async (file) => {
      if (!currentUser) return null
      const avatarUrl = await profileService.uploadAvatar(currentUser.id, file)
      setCurrentUser((prev) => (prev ? { ...prev, avatarUrl } : prev))
      await refetchPlayers()
      return avatarUrl
    },
    [currentUser, refetchPlayers]
  )

  /** RLS + the two-save-limit trigger enforce the real rules (own
   * prediction only, before kickoff, at most two saves) — this can
   * genuinely reject, so callers must handle the rejection. Returns the
   * saved prediction (with its post-save `saveCount`) so the caller can
   * react immediately, without waiting on the follow-up refetch. */
  const savePrediction = useCallback(
    async (matchId, predictedHome, predictedAway) => {
      if (!currentUser) return null
      const saved = await predictionsService.save(currentUser.id, matchId, predictedHome, predictedAway)
      await Promise.all([refetchPredictions(), refetchPredictionCompletion()])
      return saved
    },
    [currentUser, refetchPredictions, refetchPredictionCompletion]
  )

  const addMatch = useCallback(
    async (matchData) => {
      await matchesService.create(matchData)
      await refetchMatches()
    },
    [refetchMatches]
  )

  const updateMatch = useCallback(
    async (matchId, updates) => {
      await matchesService.update(matchId, updates)
      await refetchMatches()
    },
    [refetchMatches]
  )

  const deleteMatch = useCallback(
    async (matchId) => {
      await matchesService.remove(matchId)
      await Promise.all([refetchMatches(), refetchPredictions()])
    },
    [refetchMatches, refetchPredictions]
  )

  /** Admin-only (RLS — see migration 0011). Returns the new team's id so
   * the Add Match form (or its embedded "+ Add team" flow) can select it
   * immediately without waiting on a separate lookup. */
  const createTeam = useCallback(
    async (teamData) => {
      const id = await teamsService.create(teamData)
      await refetchTeams()
      return id
    },
    [refetchTeams]
  )

  /** Admin-only, restricted to custom teams (RLS — see migration 0011). */
  const updateTeam = useCallback(
    async (teamId, teamData) => {
      await teamsService.update(teamId, teamData)
      await refetchTeams()
    },
    [refetchTeams]
  )

  /** Admin-only, permanent, restricted to custom teams (RLS — see
   * migration 0011). Rejects with a specific error if the team is still
   * used by a match (see teamsService.remove). */
  const deleteTeam = useCallback(
    async (teamId) => {
      await teamsService.remove(teamId)
      await refetchTeams()
    },
    [refetchTeams]
  )

  /** The entire scoring pipeline runs server-side inside finish_match() —
   * see supabase/migrations/0001_init.sql. This just calls it and reloads
   * the three things it touched. */
  const finishMatch = useCallback(
    async (matchId, finalHomeScore, finalAwayScore) => {
      await matchesService.finish(matchId, finalHomeScore, finalAwayScore)
      await Promise.all([refetchMatches(), refetchPredictions(), refetchPlayers()])
    },
    [refetchMatches, refetchPredictions, refetchPlayers]
  )

  /** Admin-only maintenance utility (recalculate_all_points RPC). */
  const recalculateAll = useCallback(async () => {
    await matchesService.recalculateAllPoints()
    await Promise.all([refetchPredictions(), refetchPlayers()])
  }, [refetchPredictions, refetchPlayers])

  /** Admin-only (RPC re-checks independently — see migration 0012's
   * request_result_correction). The only way to change a FINISHED match's
   * result — finish_match() itself now rejects being called again. Voting
   * seats are snapshotted server-side; nothing else needs updating here
   * besides the request/vote lists themselves. */
  const requestResultCorrection = useCallback(
    async (matchId, newHomeScore, newAwayScore, reason) => {
      const id = await resultCorrectionService.request(matchId, newHomeScore, newAwayScore, reason)
      await refetchCorrections()
      return id
    },
    [refetchCorrections]
  )

  /** RPC re-checks the caller actually holds an unvoted seat (see
   * migration 0012's vote_on_result_correction) and applies the new score
   * + recalculates points atomically, server-side, if this vote makes it
   * unanimous — so matches/predictions/players are refetched alongside
   * the correction data itself; a rejection or a non-final approval only
   * changes the vote/request rows, and refetching the rest is harmless
   * either way. */
  const voteOnResultCorrection = useCallback(
    async (requestId, approve) => {
      await resultCorrectionService.vote(requestId, approve)
      await Promise.all([refetchCorrections(), refetchMatches(), refetchPredictions(), refetchPlayers()])
    },
    [refetchCorrections, refetchMatches, refetchPredictions, refetchPlayers]
  )

  /** Admin-only (RLS + trigger — see migration 0004). Flips a player's paid
   * status; access is derived from this everywhere else in the app, so
   * nothing else needs updating by hand. */
  const setPlayerPaymentStatus = useCallback(
    async (playerId, isPaid) => {
      await playersService.setPaymentStatus(playerId, isPaid)
      await refetchPlayers()
    },
    [refetchPlayers]
  )

  /** Admin-only (RLS — see migration 0004). One settings row, so every
   * player's Banka page reflects the new prize amounts immediately on
   * their next fetch — nothing duplicated to keep in sync. */
  const updatePrizeSettings = useCallback(
    async (values) => {
      await settingsService.update(values)
      await refetchSettings()
    },
    [refetchSettings]
  )

  /** Admin-only (Storage RLS + settings RLS — see migration 0008). Uploads
   * the file, then saves the resulting URL onto the one settings row — the
   * next fetch anywhere in the app (login screen included) reflects it. */
  const updateLeagueLogo = useCallback(
    async (file) => {
      const url = await logoService.upload(file)
      await settingsService.setLogoUrl(url)
      await refetchLeagueLogo()
    },
    [refetchLeagueLogo]
  )

  /** Admin-only. Deletes the Storage object and clears settings.logo_url —
   * every screen falls back to the default /tipovacka-logo.png. */
  const removeLeagueLogo = useCallback(async () => {
    await logoService.remove()
    await settingsService.setLogoUrl(null)
    await refetchLeagueLogo()
  }, [refetchLeagueLogo])

  /** Admin-only (RLS + trigger, same column grant as is_paid/paid_at — see
   * migration 0004). Manually corrects a player's payment_amount — the
   * one existing money field on a player, shown on the Banka page and in
   * the player management panel as "balance". */
  const editPlayerBalance = useCallback(
    async (playerId, paymentAmount) => {
      await playersService.setPaymentAmount(playerId, paymentAmount)
      await refetchPlayers()
    },
    [refetchPlayers]
  )

  /** Admin-only (RPC re-checks independently — see migration 0008). */
  const getPlayerEmail = useCallback((playerId) => playersService.getEmail(playerId), [])

  /** Admin-only, permanent (RPC re-checks independently — see migration
   * 0008). Removes only this player's profile/predictions/chat from this
   * competition — their Supabase Auth account is never touched. */
  const deletePlayer = useCallback(
    async (playerId) => {
      await playersService.deletePlayer(playerId)
      await Promise.all([refetchPlayers(), refetchPredictions(), refetchChatMessages()])
    },
    [refetchPlayers, refetchPredictions, refetchChatMessages]
  )

  /** Admin-only — enforced server-side by the admin-create-player Edge
   * Function (verifies the caller is an admin before ever touching
   * service_role), not just by this button being hidden from non-admins.
   * The new player can log in immediately through the existing screen. */
  const createPlayer = useCallback(
    async ({ name, email, password, paymentAmount }) => {
      await adminActionsService.createPlayer({ name, email, password, paymentAmount })
      await refetchPlayers()
    },
    [refetchPlayers]
  )

  /** Admin-only, extremely destructive — enforced server-side by the
   * admin-reset-league Edge Function (see its own admin re-check) and by
   * reset_league_data() re-checking admin status again independently.
   * Refreshes every piece of state the reset actually touches. */
  const resetLeague = useCallback(async () => {
    await adminActionsService.resetLeague()
    await Promise.all([
      refetchPlayers(),
      refetchMatches(),
      refetchPredictions(),
      refetchChatMessages(),
      refetchSettings(),
    ])
  }, [refetchPlayers, refetchMatches, refetchPredictions, refetchChatMessages, refetchSettings])

  const sendChatMessage = useCallback(
    async (text) => {
      if (!currentUser || !text.trim()) return
      // No optimistic local append: the realtime subscription above adds
      // the message for every viewer, including the sender, once Postgres
      // confirms the insert — one code path instead of two.
      await chatService.send(currentUser.id, text)
    },
    [currentUser]
  )

  const markChatRead = useCallback(() => {
    if (!currentUser || chatMessages.length === 0) return
    setReadState((prev) => {
      const lastId = chatMessages[chatMessages.length - 1].id
      if (prev[currentUser.id] === lastId) return prev
      const next = { ...prev, [currentUser.id]: lastId }
      dataService.saveReadState(next)
      return next
    })
  }, [currentUser, chatMessages])

  const getTeamById = useCallback((id) => findTeam(teams, id), [teams])

  // Reuses the same `matches` state (and the same status derivation) the
  // Live page itself renders from — no separate fetch, no separate
  // "is it live" logic to keep in sync.
  const liveMatchCount = useMemo(
    () => matches.filter((m) => getMatchStatus(m) === MATCH_STATUS.LIVE).length,
    [matches]
  )

  const unreadChatCount = useMemo(() => {
    if (!currentUser) return 0
    const lastReadId = readState[currentUser.id]
    if (!lastReadId) return chatMessages.filter((m) => m.playerId !== currentUser.id).length
    const idx = chatMessages.findIndex((m) => m.id === lastReadId)
    if (idx === -1) return chatMessages.filter((m) => m.playerId !== currentUser.id).length
    return chatMessages.slice(idx + 1).filter((m) => m.playerId !== currentUser.id).length
  }, [chatMessages, readState, currentUser])

  const value = {
    loading: !authResolved || (Boolean(currentUser) && dataLoading && players.length === 0),
    loadError,
    currentUser,
    accessBlocked,
    players,
    teams,
    matches,
    predictions,
    predictionCompletion,
    correctionRequests,
    correctionVotes,
    chatMessages,
    settings,
    leagueLogoUrl,
    unreadChatCount,
    liveMatchCount,
    getTeamById,
    login,
    logout,
    uploadAvatar,
    savePrediction,
    addMatch,
    updateMatch,
    deleteMatch,
    createTeam,
    updateTeam,
    deleteTeam,
    finishMatch,
    requestResultCorrection,
    voteOnResultCorrection,
    recalculateAll,
    setPlayerPaymentStatus,
    updatePrizeSettings,
    updateLeagueLogo,
    removeLeagueLogo,
    editPlayerBalance,
    getPlayerEmail,
    deletePlayer,
    createPlayer,
    resetLeague,
    sendChatMessage,
    markChatRead,
  }

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>
}

export function useAppData() {
  const ctx = useContext(AppDataContext)
  if (!ctx) throw new Error('useAppData must be used within AppDataProvider')
  return ctx
}
