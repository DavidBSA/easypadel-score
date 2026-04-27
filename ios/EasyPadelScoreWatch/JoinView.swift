import SwiftUI

private let NAVY   = Color(red: 0.051, green: 0.106, blue: 0.165)
private let ORANGE = Color(red: 1.0,   green: 0.420, blue: 0.0)
private let RED    = Color(red: 1.0,   green: 0.251, blue: 0.251)
private let MUTED  = Color(white: 0.53)

struct JoinView: View {
    @EnvironmentObject var store: SessionStore
    @State private var codeInput: String = ""
    @State private var nameInput: String = ""

    var body: some View {
        ScrollView {
            VStack(spacing: 8) {
                Text("EPS")
                    .font(.system(size: 16, weight: .black))
                    .foregroundColor(ORANGE)
                    .frame(maxWidth: .infinity, alignment: .center)

                if let error = store.errorMessage {
                    Text(error)
                        .font(.system(size: 11))
                        .foregroundColor(RED)
                        .multilineTextAlignment(.center)
                        .frame(maxWidth: .infinity, alignment: .center)
                }

                TextField("Session code", text: $codeInput)
                    .autocapitalization(.allCharacters)
                    .submitLabel(.next)
                    .font(.system(size: 14))
                    .padding(8)
                    .background(Color.white.opacity(0.08))
                    .cornerRadius(8)
                    .onChange(of: codeInput) { _, newValue in
                        if newValue.count > 8 {
                            codeInput = String(newValue.prefix(8))
                        }
                        codeInput = newValue.uppercased()
                    }

                TextField("Your name", text: $nameInput)
                    .submitLabel(.go)
                    .font(.system(size: 14))
                    .padding(8)
                    .background(Color.white.opacity(0.08))
                    .cornerRadius(8)

                Button(action: {
                    Task { await store.joinSession(code: codeInput, name: nameInput) }
                }) {
                    Text("Join →")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundColor(.white)
                        .frame(maxWidth: .infinity)
                        .frame(height: 40)
                        .background(ORANGE)
                        .cornerRadius(10)
                }
                .buttonStyle(.plain)

                if !store.sessionCode.isEmpty {
                    Button(action: { store.clearSession() }) {
                        Text("Leave session")
                            .font(.system(size: 10))
                            .foregroundColor(MUTED)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(12)
        }
    }
}
