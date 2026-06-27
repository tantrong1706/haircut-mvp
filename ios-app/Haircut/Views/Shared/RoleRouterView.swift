import SwiftUI

struct RoleRouterView: View {
    let user: AppUser

    var body: some View {
        if user.role == .owner {
            OwnerRootView(user: user)
        } else {
            StaffRootView(user: user)
        }
    }
}

