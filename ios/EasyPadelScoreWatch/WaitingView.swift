import SwiftUI

private let ORANGE = Color(red: 1.0,   green: 0.420, blue: 0.0)
private let GREEN  = Color(red: 0.0,   green: 0.784, blue: 0.318)
private let MUTED  = Color(white: 0.53)

struct WaitingView: View {
    @EnvironmentObject var store: SessionStore

    var body: some View {
        VStack(spacing: 0) {
            Text("ROUND \(store.roundNumber)")
                .font(.system(size: 11, weight: .medium))
                .tracking(0.8)
                .foregroundColor(ORANGE)
                .frame(maxWidth: .infinity, alignment: .leading)

            Divider()
                .background(Color.white.opacity(0.12))
                .padding(.vertical, 4)

            VStack(spacing: 0) {
                Text("Waiting for next match")
                    .font(.system(size: 11))
                    .foregroundColor(Color(white: 0.67))
                    .multilineTextAlignment(.center)
                    .padding(.top, 6)
            }

            Divider()
                .background(Color.white.opacity(0.12))
                .padding(.vertical, 8)

            Text("Waiting…")
                .font(.system(size: 11))
                .foregroundColor(GREEN)
                .padding(.horizontal, 12)
                .padding(.vertical, 4)
                .background(GREEN.opacity(0.15))
                .overlay(
                    RoundedRectangle(cornerRadius: 20)
                        .stroke(GREEN.opacity(0.4), lineWidth: 1)
                )
                .cornerRadius(20)

            Spacer()

            Text("↑ leaderboard")
                .font(.system(size: 10))
                .foregroundColor(MUTED)
                .padding(.bottom, 4)
        }
        .padding(EdgeInsets(top: 8, leading: 12, bottom: 8, trailing: 12))
        .gesture(
            DragGesture().onEnded { v in
                if v.translation.height < -60 {
                    store.showLeaderboard(from: .waiting)
                }
            }
        )
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button("⚙") { store.clearSession() }
                    .foregroundColor(MUTED)
                    .font(.system(size: 12))
            }
        }
    }
}
