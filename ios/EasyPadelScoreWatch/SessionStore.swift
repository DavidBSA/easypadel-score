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

        guard let snapshot = await fetchSnapshot(code: uppercaseCode) else {
            errorMessage = "Session not found"
            screen = .joining
            return
        }

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
            let exact = matched.first { $0.name.lowercased() == trimmedName.lowercased() }
            resolvedPlayerId = (exact ?? matched[0]).id
        }

        _ = await callJoinAPI(code: uppercaseCode, playerId: resolvedPlayerId)

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

    // MARK: — Join API call
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
        leaderboard = buildLeaderboard(snapshot: snapshot)

        let playerMap = Dictionary(uniqueKeysWithValues: snapshot.players.map { ($0.id, $0) })

        let activeMatch = snapshot.matches.first {
            $0.status == "IN_PROGRESS" && $0.containsPlayer(playerId)
        }

        if let active = activeMatch {
            let myTeam = active.teamFor(playerId: playerId)
            let teamAPlayers = [active.teamAPlayer1, active.teamAPlayer2].compactMap { playerMap[$0] }
            let teamBPlayers = [active.teamBPlayer1, active.teamBPlayer2].compactMap { playerMap[$0] }
            let round = active.queuePosition / max(1, snapshot.courts) + 1

            let newMatch = MatchInfo(
                matchId: active.id,
                courtNumber: active.courtNumber ?? 0,
                myTeam: myTeam,
                myTeamPlayers: myTeam == "A" ? teamAPlayers : teamBPlayers,
                opponentPlayers: myTeam == "A" ? teamBPlayers : teamAPlayers,
                pointsA: active.pointsA ?? 0,
                pointsB: active.pointsB ?? 0,
                pointsPerMatch: snapshot.pointsPerMatch,
                servesPerRotation: snapshot.servesPerRotation ?? 4,
                roundNumber: round
            )

            if lastMatchId != active.id {
                if lastMatchId != nil {
                    WKInterfaceDevice.current().play(.notification)
                }
                lastMatchId = active.id
            }

            roundNumber = round

            let total = (active.pointsA ?? 0) + (active.pointsB ?? 0)
            if total >= snapshot.pointsPerMatch && screen == .scoring {
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
            if let next = findNextMatch(snapshot: snapshot) {
                roundNumber = next.queuePosition / max(1, snapshot.courts) + 1
            }
            currentMatch = nil
            if screen == .loading || screen == .scoring {
                screen = .waiting
            }
        }
    }

    private func findNextMatch(snapshot: SessionSnapshot) -> SessionMatch? {
        snapshot.matches.first {
            $0.status == "PENDING" && $0.containsPlayer(playerId)
        }
    }

    // MARK: — Build leaderboard
    private func buildLeaderboard(snapshot: SessionSnapshot) -> [LeaderRow] {
        var pointsFor: [String: Int] = [:]
        var pointsAgainst: [String: Int] = [:]

        for match in snapshot.matches where match.status == "COMPLETE" {
            let pA = match.pointsA ?? 0
            let pB = match.pointsB ?? 0
            for pid in [match.teamAPlayer1, match.teamAPlayer2] {
                pointsFor[pid, default: 0] += pA
                pointsAgainst[pid, default: 0] += pB
            }
            for pid in [match.teamBPlayer1, match.teamBPlayer2] {
                pointsFor[pid, default: 0] += pB
                pointsAgainst[pid, default: 0] += pA
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

    // MARK: — Serve calculation (order: A1 → B1 → A2 → B2)
    func getServeInfo() -> ServeInfo? {
        guard let match = currentMatch else { return nil }

        let myNames = match.myTeamPlayers.map { $0.name }
        let oppNames = match.opponentPlayers.map { $0.name }

        guard myNames.count >= 2, oppNames.count >= 2 else { return nil }

        // Fixed serve order: A1, B1, A2, B2
        let order: [String] = match.myTeam == "A"
            ? [myNames[0], oppNames[0], myNames[1], oppNames[1]]
            : [oppNames[0], myNames[0], oppNames[1], myNames[1]]

        let total = match.totalPoints
        let spr = match.servesPerRotation
        let pos = (total / spr) % 4
        let nextPos = (pos + 1) % 4
        let ptsLeft = spr - (total % spr)

        return ServeInfo(currentServer: order[pos], nextServer: order[nextPos], ptsLeft: ptsLeft)
    }

    // MARK: — Which team is serving (A1/A2 = even slots, B1/B2 = odd slots)
    func isServing(team: String) -> Bool {
        guard let match = currentMatch else { return false }
        let pos = (match.totalPoints / match.servesPerRotation) % 4
        let servingTeam = pos % 2 == 0 ? "A" : "B"
        return servingTeam == team
    }

    // MARK: — Clear session
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
