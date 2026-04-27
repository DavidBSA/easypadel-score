import SwiftUI

private let ORANGE = Color(red: 1.0,   green: 0.420, blue: 0.0)
private let GREEN  = Color(red: 0.0,   green: 0.784, blue: 0.318)

struct CompleteView: View {
    @EnvironmentObject var store: SessionStore

    var body: some View {
        guard let match = store.currentMatch else {
            return AnyView(
                Text("Loading…")
                    .font(.system(size: 12))
                    .foregroundColor(Color(white: 0.53))
            )
        }

        let won = match.myScore > match.theirScore
        let drew = match.myScore == match.theirScore
        let resultText = won ? "You won!" : drew ? "Draw" : "You lost"
        let resultColor = won ? GREEN : drew ? Color(white: 0.67) : Color(white: 0.67)

        return AnyView(
            VStack(spacing: 6) {
                Text("✓")
                    .font(.system(size: 20))
                    .foregroundColor(GREEN)
                    .frame(maxWidth: .infinity, alignment: .center)

                Text(resultText)
                    .font(.system(size: 13, weight: .medium))
                    .foregroundColor(resultColor)

                Divider()
                    .background(Color.white.opacity(0.12))

                Text("\(match.myScore)–\(match.theirScore)")
                    .font(.system(size: 26, weight: .medium))
                    .foregroundColor(.white)
                    .multilineTextAlignment(.center)

                Divider()
                    .background(Color.white.opacity(0.12))

                Button(action: { store.screen = .waiting }) {
                    Text("Next match →")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundColor(.white)
                        .frame(maxWidth: .infinity)
                        .frame(height: 36)
                        .background(ORANGE)
                        .cornerRadius(10)
                }
                .buttonStyle(.plain)

                Button(action: { store.showLeaderboard(from: .complete) }) {
                    Text("Leaderboard")
                        .font(.system(size: 11))
                        .foregroundColor(.white)
                        .frame(maxWidth: .infinity)
                        .frame(height: 30)
                        .background(Color.white.opacity(0.08))
                        .cornerRadius(10)
                }
                .buttonStyle(.plain)
            }
            .padding(16)
        )
    }
}
