import SwiftUI

@main
struct EasyPadelScoreWatchApp: App {
    @StateObject private var store = SessionStore()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(store)
        }
    }
}

struct ContentView: View {
    @EnvironmentObject var store: SessionStore

    var body: some View {
        ZStack {
            Color(red: 0.051, green: 0.106, blue: 0.165).ignoresSafeArea()

            switch store.screen {
            case .joining:   JoinView()
            case .loading:   LoadingView()
            case .waiting:   WaitingView()
            case .scoring:   ScoringView()
            case .serve:     ServeView()
            case .complete:  CompleteView()
            case .leaderboard: LeaderboardView()
            }

            // Reconnecting banner — shown over any screen
            if store.isReconnecting {
                VStack {
                    Text("Reconnecting…")
                        .font(.system(size: 10))
                        .foregroundColor(Color(white: 0.35))
                    Spacer()
                }
            }
        }
        .foregroundColor(.white)
    }
}

struct LoadingView: View {
    @State private var opacity: Double = 0.4

    var body: some View {
        Text("Connecting…")
            .font(.system(size: 13))
            .foregroundColor(Color(white: 0.53))
            .opacity(opacity)
            .onAppear {
                withAnimation(.easeInOut(duration: 1.5).repeatForever(autoreverses: true)) {
                    opacity = 1.0
                }
            }
    }
}
