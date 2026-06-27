# HAIRCUT iOS App

SwiftUI source for the owner/staff iOS app.

## Setup On Mac

1. Open Xcode.
2. Create a new iOS App project named `Haircut`.
3. Set interface to SwiftUI.
4. Add Firebase packages:
   - FirebaseAuth
   - FirebaseCore
   - FirebaseFirestore
   - FirebaseFunctions
   - FirebaseStorage
5. Copy the `Haircut/` source folder into the Xcode project.
6. Add `GoogleService-Info.plist` to `Haircut/Resources`.
7. Build and run.

## MVP Login

The source includes email/password login for development testing. Before App Store release, add the production login methods you want to support, such as Sign in with Apple and phone login.

