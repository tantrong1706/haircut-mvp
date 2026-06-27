import FirebaseAuth
import FirebaseFirestore
import Foundation

@MainActor
final class AuthSession: ObservableObject {
    @Published var firebaseUser: User?
    @Published var appUser: AppUser?
    @Published var isLoading = true
    @Published var errorMessage: String?

    private var authHandle: AuthStateDidChangeListenerHandle?
    private var userListener: ListenerRegistration?
    private let client = FirebaseClient.shared

    func start() {
        guard authHandle == nil else { return }
        authHandle = Auth.auth().addStateDidChangeListener { [weak self] _, user in
            Task { @MainActor in
                self?.firebaseUser = user
                self?.listenToAppUser(user)
            }
        }
    }

    func signIn(email: String, password: String) async {
        do {
            errorMessage = nil
            try await Auth.auth().signIn(withEmail: email, password: password)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func createAccount(email: String, password: String) async {
        do {
            errorMessage = nil
            try await Auth.auth().createUser(withEmail: email, password: password)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func signOut() {
        do {
            try Auth.auth().signOut()
            appUser = nil
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func listenToAppUser(_ user: User?) {
        userListener?.remove()
        guard let user else {
            isLoading = false
            appUser = nil
            return
        }

        isLoading = true
        userListener = client.listenUser(uid: user.uid) { [weak self] appUser in
            Task { @MainActor in
                self?.appUser = appUser
                self?.isLoading = false
            }
        }
    }
}

