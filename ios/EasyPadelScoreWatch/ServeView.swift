import SwiftUI

private let ORANGE = Color(red: 1.0,   green: 0.420, blue: 0.0)
private let MUTED  = Color(white: 0.53)

struct ServeView: View {
    @EnvironmentObject var store: SessionStore

    var body: some View {
        VStack(spacing: 4) {
            if let info = store.getServeInfo() {
                Text("SERVING NOW")
                    .font(.system(size: 11, weight: .medium))
                    .tracking(0.8)
                    .foregroundColor(ORANGE)
                    .frame(maxWidth: .infinity, alignment: .center)

                Divider()
                    .background(Color.white.opacity(0.12))

                Text(info.currentServer)
                    .font(.system(size: 15, weight: .medium))
                    .foregroundColor(.white)
                    .multilineTextAlignment(.center)
                    .padding(.vertical, 4)

                Text("Next: \(info.nextServer)")
                    .font(.system(size: 11))
                    .foregroundColor(Color(white: 0.47))

                Text("\(info.ptsLeft) pts left this rotation")
                    .font(.system(size: 11))
                    .foregroundColor(Color(white: 0.47))
                    .padding(.top, 2)

                Divider()
                    .background(Color.white.opacity(0.12))

                Text("← swipe to score")
                    .font(.system(size: 10))
                    .foregroundColor(MUTED)
            } else {
                Spacer()
                Text("Match not started")
                    .font(.system(size: 12))
                    .foregroundColor(MUTED)
                    .multilineTextAlignment(.center)
                Spacer()
            }
        }
        .padding(12)
        .gesture(
            DragGesture().onEnded { v in
                if v.translation.width < -50 && abs(v.translation.height) < 30 {
                    store.screen = .scoring
                }
            }
        )
    }
}
