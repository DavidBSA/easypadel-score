import SwiftUI

private let ORANGE = Color(red: 1.0,   green: 0.420, blue: 0.0)
private let GREEN  = Color(red: 0.0,   green: 0.784, blue: 0.318)
private let RED    = Color(red: 1.0,   green: 0.251, blue: 0.251)
private let MUTED  = Color(white: 0.53)

struct LeaderboardView: View {
    @EnvironmentObject var store: SessionStore

    var body: some View {
        VStack(spacing: 0) {
            Text("STANDINGS · R\(store.roundNumber)")
                .font(.system(size: 11, weight: .medium))
                .tracking(0.8)
                .foregroundColor(ORANGE)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.bottom, 4)

            Divider()
                .background(Color.white.opacity(0.12))

            ScrollView {
                VStack(spacing: 2) {
                    ForEach(Array(store.leaderboard.prefix(8).enumerated()), id: \.element.id) { index, row in
                        HStack(spacing: 4) {
                            Text("\(index + 1). \(row.name)")
                                .font(.system(size: 12, weight: row.isMe ? .semibold : .regular))
                                .foregroundColor(row.isMe ? ORANGE : Color(white: 0.87))
                                .lineLimit(1)
                            Spacer()
                            Text(row.diff >= 0 ? "+\(row.diff)" : "\(row.diff)")
                                .font(.system(size: 12))
                                .foregroundColor(row.diff > 0 ? GREEN : row.diff < 0 ? RED : MUTED)
                        }
                    }
                }
            }
        }
        .padding(EdgeInsets(top: 6, leading: 10, bottom: 6, trailing: 10))
        .gesture(
            DragGesture().onEnded { v in
                if v.translation.height > 60 {
                    store.hideLeaderboard()
                }
            }
        )
        .toolbar {
            ToolbarItem(placement: .topBarLeading) {
                Button("←") { store.hideLeaderboard() }
                    .foregroundColor(ORANGE)
                    .font(.system(size: 13))
            }
        }
    }
}
