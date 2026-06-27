import SwiftUI

struct LoginView: View {
    @EnvironmentObject private var authSession: AuthSession
    @State private var email = ""
    @State private var password = ""

    var body: some View {
        NavigationStack {
            Form {
                Section("Đăng nhập thử nghiệm") {
                    TextField("Email", text: $email)
                        .textInputAutocapitalization(.never)
                        .keyboardType(.emailAddress)
                    SecureField("Mật khẩu", text: $password)
                }

                Section {
                    Button("Đăng nhập") {
                        Task { await authSession.signIn(email: email, password: password) }
                    }
                    Button("Tạo tài khoản chủ salon") {
                        Task { await authSession.createAccount(email: email, password: password) }
                    }
                }

                if let error = authSession.errorMessage {
                    Section {
                        Text(error)
                            .foregroundStyle(.red)
                    }
                }
            }
            .navigationTitle("HAIRCUT")
        }
    }
}

