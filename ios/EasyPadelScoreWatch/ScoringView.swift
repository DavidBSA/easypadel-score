import SwiftUI

private let ORANGE = Color(red: 1.0,   green: 0.420, blue: 0.0)
private let RED    = Color(red: 1.0,   green: 0.251, blue: 0.251)
private let MUTED  = Color(white: 0.53)

struct ScoringView: View {
    @EnvironmentObject var store: SessionStore

    var body: some View {
        let opponentTeam = (store.currentMatch?.myTeam == "A") ? "B" : "A"

        GeometryReader { geo in
            VStack(spacing: 3) {
                // Top zone — your team
                ZStack {
                    ORANGE.opacity(0.18)
                    VStack(spacing: 4) {
                        HStack(spacing: 6) {
                            Text(store.currentMatch?.myTeamPlayers.map { $0.name }.joined(separator: " & ") ?? "Your Team")
                                .font(.system(size: 10, weight: .medium))
                                .foregroundColor(ORANGE)
                                .lineLimit(1)
                            if store.isServing(team: store.currentMatch?.myTeam ?? "A") {
                                Circle()
                                    .fill(RED)
                                    .frame(width: 10, height: 10)
                            }
                        }
                        Text("\(store.currentMatch?.myScore ?? 0)")
                            .font(.system(size: 38, weight: .semibold))
                            .foregroundColor(.white)
                    }
                }
                .frame(maxWidth: .infinity)
                .frame(height: (geo.size.height - 3 - 16) / 2)
                .clipShape(RoundedCorner(radius: 14, corners: [.topLeft, .topRight]))
                .clipShape(RoundedCorner(radius: 4, corners: [.bottomLeft, .bottomRight]))
                .onTapGesture {
                    Task { await store.addPoint(toTeam: store.currentMatch?.myTeam ?? "A") }
                }
                .onLongPressGesture(minimumDuration: 0.5) {
                    Task { await store.undoPoint() }
                }

                // Hint strip
                HStack {
                    Spacer()
                    Text("→ serve")
                        .font(.system(size: 9))
                        .foregroundColor(MUTED)
                    Spacer()
                }
                .frame(height: 16)

                // Bottom zone — opponents
                ZStack {
                    Color.white.opacity(0.06)
                    VStack(spacing: 4) {
                        HStack(spacing: 6) {
                            Text(store.currentMatch?.opponentPlayers.map { $0.name }.joined(separator: " & ") ?? "Opponents")
                                .font(.system(size: 10, weight: .medium))
                                .foregroundColor(Color(white: 0.67))
                                .lineLimit(1)
                            if store.isServing(team: opponentTeam) {
                                Circle()
                                    .fill(RED)
                                    .frame(width: 10, height: 10)
                            }
                        }
                        Text("\(store.currentMatch?.theirScore ?? 0)")
                            .font(.system(size: 38, weight: .semibold))
                            .foregroundColor(Color(white: 0.8))
                    }
                }
                .frame(maxWidth: .infinity)
                .frame(height: (geo.size.height - 3 - 16) / 2)
                .clipShape(RoundedCorner(radius: 4, corners: [.topLeft, .topRight]))
                .clipShape(RoundedCorner(radius: 14, corners: [.bottomLeft, .bottomRight]))
                .onTapGesture {
                    Task { await store.addPoint(toTeam: opponentTeam) }
                }
                .onLongPressGesture(minimumDuration: 0.5) {
                    Task { await store.undoPoint() }
                }
            }
            .gesture(
                DragGesture().onEnded { value in
                    let dx = value.translation.width
                    let dy = value.translation.height
                    if dx > 50 && abs(dy) < 30 {
                        store.screen = .serve
                    } else if dy < -60 && abs(dx) < 40 {
                        store.showLeaderboard(from: .scoring)
                    }
                }
            )
        }
    }
}

struct RoundedCorner: Shape {
    var radius: CGFloat = 14
    var corners: UIRectCorner = .allCorners

    func path(in rect: CGRect) -> Path {
        let path = UIBezierPath(
            roundedRect: rect,
            byRoundingCorners: corners,
            cornerRadii: CGSize(width: radius, height: radius)
        )
        return Path(path.cgPath)
    }
}
