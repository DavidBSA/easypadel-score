import Foundation
import WatchKit
import Combine

@MainActor
class SessionStore: ObservableObject {

    // MARK: — Published state
    @Published var screen: WatchScreen = .joining
    @Published var sessionName: String = ""
    @Published var currentMatch: MatchInfo?
    @Published var leaderboard: [LeaderRow] = []
    @Published var roundNumber: Int = 1
    @Published var errorMessage: String? = nil
    @Published var isReconnecting: Bool = false

    // MARK: — Persisted join state (UserDefaults)
    private(set) var sessionCode: String = ""
    private(set) var playerId: String = ""
    private(set) var deviceId: String = ""

    // MARK: — Internal
    private var pollTimer: Timer?
    private var lastMatchId: String? = nil
    private var lastScreenBeforeLeaderboard: WatchScreen = .waiting
    private let baseURL = "https://easypadelscore.com"

    // MARK: — Init: restore persisted session if available
    init() {
        let defaults = UserDefaults.standard
        if let code = defaults.string(forKey: "eps_code"),
           let pid = defaults.string(forKey: "eps_playerId"),
           let did = defaults.string(forKey: "eps_deviceId"),
           !code.isEmpty, !pid.isEmpty {
            sessionCode = code
            playerId = pid
            deviceId = did
            screen = .loading
            startPolling()
        }
        // Generate deviceId if none exists yet
        if deviceId.isEmpty {
            deviceId = UUID().uuidString
        }
    }

    // MARK: — Join flow

    func joinSession(code: String, name: String) async {
        let uppercaseCode = code.uppercased().trimmingCharacters(in: .whitespaces)
        let trimmedName = name.trimmingCharacters(in: .whitespaces)

        guard !uppercaseCode.isEmpty, !trimmedName.isEmpty else {
            errorMessage = "Enter code and name"
            return
        }

        screen = .loading
        errorMessage = nil

        // Step 1: Fetch session to validate + find player
        guard let snapshot = await fetchSnapshot(code: uppercaseCode) else {
            errorMessage = "Session not found"
            screen = .joining
            return
        }

        // Step 2: Find player by name (case-insensitive, partial match)
        let matched = snapshot.players.filter {
            $0.name.lowercased().contains(trimmedName.lowercased()) ||
            trimmedName.lowercased().contains($0.name.lowercased())
        }

        let resolvedPlayerId: String

        if matched.count == 1 {
            resolvedPlayerId = matched[0].id
        } else if matched.isEmpty {
            errorMessage = "Name not found in session"
            screen = .joining
            return
        } else {
            // Multiple matches — take closest
            let exact = matched.first { $0.name.lowercased() == trimmedName.lowercased() }
            resolvedPlayerId = (exact ?? matched[0]).id
        }

        // Step 3: Register this Watch deviceId via join API
        let joinSuccess = await callJoinAPI(
            code: uppercaseCode,
            playerId: resolvedPlayerId
        )

        if !joinSuccess {
            // Non-fatal — proceed anyway, deviceId will still work for scoring
        }

        // Step 4: Persist and begin polling
        sessionCode = uppercaseCode
        playerId = resolvedPlayerId
        let defaults = UserDefaults.standard
        defaults.set(uppercaseCode, forKey: "eps_code")
        defaults.set(resolvedPlayerId, forKey: "eps_playerId")
        defaults.set(deviceId, forKey: "eps_deviceId")

        sessionName = snapshot.name ?? ""
        applySnapshot(snapshot)
        startPolling()
    }

    // MARK: — Join API call (register Watch device)
    private func callJoinAPI(code: String, playerId: String) async -> Bool {
        guard let url = URL(string: "\(baseURL)/api/sessions/\(code)/join") else { return false }
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        let body = ["playerId": playerId, "deviceId": deviceId, "isWatch": true] as [String: Any]
        req.httpBody = try? JSONSerialization.data(withJSONObject: body)
        let result = try? await URLSession.shared.data(for: req)
        return result != nil
    }

    // MARK: — Polling

    func startPolling() {
        pollTimer?.invalidate()
        pollTimer = Timer.scheduledTimer(withTimeInterval: 5.0, repeats: true) { [weak self] _ in
            Task { await self?.poll() }
        }
        Task { await poll() }
    }

    func stopPolling() {
        pollTimer?.invalidate()
        pollTimer = nil
    }

    private func poll() async {
        guard let snapshot = await fetchSnapshot(code: sessionCode) else {
            isReconnecting = true
            return
        }
        isReconnecting = false
        sessionName = snapshot.name ?? ""
        applySnapshot(snapshot)
    }

    // MARK: — Snapshot fetch
    private func fetchSnapshot(code: String) async -> SessionSnapshot? {
        guard let url = URL(string: "\(baseURL)/api/sessions/\(code)/snapshot") else { return nil }
        guard let (data, _) = try? await URLSession.shared.data(from: url) else { return nil }
        return try? JSONDecoder().decode(SessionSnapshot.self, from: data)
    }

    // MARK: — Apply snapshot → derive screen state
    private func applySnapshot(_ snapshot: SessionSnapshot) {
        // Build leaderboard from completed matches
        leaderboard = buildLeaderboard(snapshot: snapshot)

        // Find player's active match
        let activeMatch = snapshot.matches.first {
            $0.status == "IN_PROGRESS" &&
            ($0.teamAPlayers.contains { $0.id == playerId } ||
             $0.teamBPlayers.contains { $0.id == playerId })
        }

        if let active = activeMatch {
            let myTeam = active.teamAPlayers.contains { $0.id == playerId } ? "A" : "B"
            let newMatch = MatchInfo(
                matchId: active.id,
                courtNumber: active.courtNumber ?? 0,
                myTeam: myTeam,
                myTeamPlayers: myTeam == "A" ? active.teamAPlayers : active.teamBPlayers,
                opponentPlayers: myTeam == "A" ? active.teamBPlayers : active.teamAPlayers,
                pointsA: active.pointsA,
                pointsB: active.pointsB,
                pointsPerMatch: active.pointsPerMatch,
                servesPerRotation: active.servesPerRotation,
                firstServeTeam: active.firstServeTeam,
                roundNumber: active.roundNumber
            )

            // Haptic if new match just allocated
            if lastMatchId != active.id {
                if lastMatchId != nil {
                    WKInterfaceDevice.current().play(.notification)
                }
                lastMatchId = active.id
            }

            roundNumber = active.roundNumber

            // Check if match just completed (total reached pointsPerMatch)
            let total = active.pointsA + active.pointsB
            if total >= active.pointsPerMatch && screen == .scoring {
                currentMatch = newMatch
                WKInterfaceDevice.current().play(.success)
                if screen != .leaderboard { screen = .complete }
                return
            }

            currentMatch = newMatch
            if screen == .loading || screen == .waiting || screen == .complete {
                screen = .scoring
            }
        } else {
            // No active match
            if let nextMatch = findNextMatch(snapshot: snapshot) {
                roundNumber = nextMatch.roundNumber
            }
            currentMatch = nil
            if screen == .loading || screen == .scoring {
                screen = .waiting
            }
        }
    }

    // MARK: — Find next queued match for this player
    private func findNextMatch(snapshot: SessionSnapshot) -> SessionMatch? {
        snapshot.matches.first {
            $0.status == "PENDING" &&
            ($0.teamAPlayers.contains { $0.id == playerId } ||
             $0.teamBPlayers.contains { $0.id == playerId })
        }
    }

    // MARK: — Build leaderboard
    private func buildLeaderboard(snapshot: SessionSnapshot) -> [LeaderRow] {
        var pointsFor: [String: Int] = [:]
        var pointsAgainst: [String: Int] = [:]

        for match in snapshot.matches where match.status == "COMPLETE" {
            for p in match.teamAPlayers {
                pointsFor[p.id, default: 0] += match.pointsA
                pointsAgainst[p.id, default: 0] += match.pointsB
            }
            for p in match.teamBPlayers {
                pointsFor[p.id, default: 0] += match.pointsB
                pointsAgainst[p.id, default: 0] += match.pointsA
            }
        }

        return snapshot.players
            .map { player in
                let pf = pointsFor[player.id, default: 0]
                let pa = pointsAgainst[player.id, default: 0]
                return LeaderRow(
                    id: player.id,
                    name: player.id == playerId ? "You" : player.name,
                    diff: pf - pa,
                    pointsFor: pf,
                    isMe: player.id == playerId
                )
            }
            .sorted { $0.diff > $1.diff || ($0.diff == $1.diff && $0.pointsFor > $1.pointsFor) }
    }

    // MARK: — Scoring actions

    func addPoint(toTeam team: String) async {
        guard var match = currentMatch else { return }

        // Optimistic update
        if team == "A" { match.pointsA += 1 } else { match.pointsB += 1 }
        currentMatch = match
        WKInterfaceDevice.current().play(.click)

        let total = match.pointsA + match.pointsB
        if total >= match.pointsPerMatch {
            WKInterfaceDevice.current().play(.success)
            screen = .complete
        }

        await submitScore(matchId: match.matchId, pointsA: match.pointsA, pointsB: match.pointsB)
    }

    func undoPoint() async {
        guard let match = currentMatch else { return }
        guard let url = URL(string: "\(baseURL)/api/matches/\(match.matchId)/undo") else { return }
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try? JSONSerialization.data(withJSONObject: ["deviceId": deviceId])
        WKInterfaceDevice.current().play(.retry)
        _ = try? await URLSession.shared.data(for: req)
        await poll()
    }

    private func submitScore(matchId: String, pointsA: Int, pointsB: Int) async {
        guard let url = URL(string: "\(baseURL)/api/matches/\(matchId)/score") else { return }
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        let body = ScoreBody(pointsA: pointsA, pointsB: pointsB, deviceId: deviceId, isPlayerSubmission: true)
        req.httpBody = try? JSONEncoder().encode(body)
        _ = try? await URLSession.shared.data(for: req)
    }

    // MARK: — Leaderboard navigation
    func showLeaderboard(from: WatchScreen) {
        if from != .leaderboard { lastScreenBeforeLeaderboard = from }
        screen = .leaderboard
    }

    func hideLeaderboard() {
        screen = lastScreenBeforeLeaderboard
    }

    // MARK: — Serve calculation
    func getServeInfo() -> ServeInfo? {
        guard let match = currentMatch else { return nil }

        let teamANames = match.myTeam == "A"
            ? match.myTeamPlayers.map { $0.name == playerId ? "You" : $0.name }
            : match.opponentPlayers.map { $0.name }
        let teamBNames = match.myTeam == "B"
            ? match.myTeamPlayers.map { $0.name == playerId ? "You" : $0.name }
            : match.opponentPlayers.map { $0.name }

        guard teamANames.count >= 2, teamBNames.count >= 2 else { return nil }

        let order: [String] = match.firstServeTeam == "A"
            ? [teamANames[0], teamBNames[0], teamANames[1], teamBNames[1]]
            : [teamBNames[0], teamANames[0], teamBNames[1], teamANames[1]]

        let total = match.totalPoints
        let spr = match.servesPerRotation
        let pos = (total / spr) % 4
        let nextPos = (pos + 1) % 4
        let ptsLeft = spr - (total % spr)

        return ServeInfo(
            currentServer: order[pos],
            nextServer: order[nextPos],
            ptsLeft: ptsLeft
        )
    }

    // MARK: — Serving team check (for serve dot indicator)
    func isServing(team: String) -> Bool {
        guard let match = currentMatch else { return false }
        let order: [String] = match.firstServeTeam == "A"
            ? ["A", "B", "A", "B"]
            : ["B", "A", "B", "A"]
        let pos = (match.totalPoints / match.servesPerRotation) % 4
        return order[pos] == team
    }

    // MARK: — Clear session (leave / new session)
    func clearSession() {
        stopPolling()
        let defaults = UserDefaults.standard
        defaults.removeObject(forKey: "eps_code")
        defaults.removeObject(forKey: "eps_playerId")
        sessionCode = ""
        playerId = ""
        screen = .joining
        currentMatch = nil
        leaderboard = []
        lastMatchId = nil
    }
}
