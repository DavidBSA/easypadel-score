import Foundation

// MARK: — Screens
enum WatchScreen {
    case joining, loading, waiting, scoring, serve, complete, leaderboard
}

// MARK: — API response models (must match Prisma schema exactly)

struct SessionSnapshot: Codable {
    let id: String
    let code: String
    let status: String       // "LOBBY" | "ACTIVE" | "COMPLETE"
    let name: String?
    let players: [SessionPlayer]
    let matches: [SessionMatch]
}

struct SessionPlayer: Codable, Identifiable {
    let id: String
    let name: String
}

struct SessionMatch: Codable, Identifiable {
    let id: String
    let status: String       // "PENDING" | "IN_PROGRESS" | "COMPLETE"
    let courtNumber: Int?
    let pointsA: Int
    let pointsB: Int
    let pointsPerMatch: Int
    let servesPerRotation: Int
    let firstServeTeam: String  // "A" | "B"
    let roundNumber: Int
    let teamAPlayers: [SessionPlayer]
    let teamBPlayers: [SessionPlayer]
}

// MARK: — Derived view models

struct MatchInfo {
    let matchId: String
    let courtNumber: Int
    let myTeam: String           // "A" or "B"
    let myTeamPlayers: [SessionPlayer]
    let opponentPlayers: [SessionPlayer]
    var pointsA: Int
    var pointsB: Int
    let pointsPerMatch: Int
    let servesPerRotation: Int
    let firstServeTeam: String
    let roundNumber: Int

    var myScore: Int  { myTeam == "A" ? pointsA : pointsB }
    var theirScore: Int { myTeam == "A" ? pointsB : pointsA }
    var totalPoints: Int { pointsA + pointsB }
}

struct LeaderRow: Identifiable {
    let id: String
    let name: String
    let diff: Int
    let pointsFor: Int
    var isMe: Bool = false
}

struct ServeInfo {
    let currentServer: String
    let nextServer: String
    let ptsLeft: Int
}

// MARK: — Score submission body

struct ScoreBody: Encodable {
    let pointsA: Int
    let pointsB: Int
    let deviceId: String
    let isPlayerSubmission: Bool
}

// MARK: — Join API body / response

struct JoinBody: Encodable {
    let name: String
    let deviceId: String
}

struct JoinResponse: Codable {
    let playerId: String
    let deviceId: String
}
