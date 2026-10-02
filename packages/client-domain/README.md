# Shared client domain

Pure TypeScript modules shared by Customer Web and Manager. No Firebase, React or Zalo SDK.
Consumers compile these sources with their existing toolchain; no new runtime dependency.

- `types.ts`: existing client models and default wheel configuration, unchanged.
- `wheel.ts`: existing wheel normalization/animation calculations, unchanged.
- `safeStorage.ts`: existing guarded browser storage utilities, unchanged.

Customer Web keeps thin re-exports to preserve existing imports and test seams.
Firebase-dependent adapters are not moved here: they retain their current singleton/auth behavior.
