# VigilALPR & TraceID — Firestore Security Specification (Phase 0)

## 1. Data Invariants

1. **Zero Cross-User Access (PII Isolation)**: All user profiles (`/users/{userId}`), saved phone lookups (`/users/{userId}/phoneLookups/{lookupId}`), saved ALPR audits (`/users/{userId}/alprAudits/{auditId}`), and monitored watchlist items (`/users/{userId}/watchlist/{itemId}`) contain personal phone numbers, license plates, or email addresses. Only the verified owner (`request.auth.uid == userId` and `request.auth.token.email_verified == true`) may read, list, create, update, or delete their own documents. Collection-wide `list` on `/users` is strictly denied.
2. **Parent Existence (Master Gate)**: Subcollection documents under `/users/{userId}/phoneLookups`, `/users/{userId}/alprAudits`, and `/users/{userId}/watchlist` cannot be created unless the parent `/users/{userId}` document already exists.
3. **Strict Identity Binding**:
   - On `/users/{userId}`: `uid` must equal both `userId` and `request.auth.uid`, and `email` must match `request.auth.token.email`.
   - On all subcollections: `ownerId` must equal `userId` and `request.auth.uid`, and `id` must equal the document ID path variable.
4. **Verified Email Requirement**: Every write (`create`, `update`, `delete`) requires `request.auth.token.email_verified == true`.
5. **Immutable Provenance & Temporal Integrity**:
   - `createdAt`, `savedAt`, and `updatedAt` must equal `request.time` on creation/update (client-forged timestamps are rejected).
   - `uid`, `email`, `createdAt`, `id`, `ownerId`, `itemType`, `targetValue`, and `jurisdictionState` cannot be mutated after creation.
6. **Blueprint Validation Synchronicity**: Every string, number, and enum matches `firebase-blueprint.json` verbatim (`maxLength`, `minLength`, `pattern`, and allowed enum values), with `keys().hasOnly(...)` blocking shadow fields (`isAdmin`, `role`, `verifiedOverride`, etc.).

---

## 2. The "Dirty Dozen" Attack Payloads (All Must Return `PERMISSION_DENIED`)

1. **Cross-User Profile Read (`get /users/victim_uid`)**: Signed-in attacker (`attacker_uid`) attempts to read `victim_uid`'s profile containing `email`.
2. **User Collection Enumeration (`list /users`)**: Attacker runs a collection scan across `/users` to harvest emails and tiers.
3. **Unverified Email Profile Write (`create /users/attacker_uid`)**: Signed-in user with `email_verified: false` tries to create a profile or subcollection record.
4. **Shadow Field Injection (`create /users/uid` with `isAdmin: true`)**: Attacker includes an extra `isAdmin` or `role` field alongside valid profile fields.
5. **Email Spoofing (`create /users/uid` with `email: "admin@victim.com"`)**: Attacker sets `email` in document data to a different email than `request.auth.token.email`.
6. **Cross-User Subcollection Spoofing (`create /users/victim_uid/watchlist/item1`)**: Attacker attempts to write to another user's watchlist with `ownerId: "victim_uid"`.
7. **Orphaned Subcollection Write (`create /users/new_uid/phoneLookups/p1`)**: Attacker tries to write a lookup before `/users/new_uid` exists.
8. **ID Poisoning Attack (`create /users/uid/alprAudits/<150-char-invalid-id!@#>` )**: Oversized or non-alphanumeric document ID bypassing `^[a-zA-Z0-9_\-]+$`.
9. **Client Timestamp Forgery (`create /users/uid/watchlist/w1` with backdated `createdAt`)**: Client submits an arbitrary past timestamp instead of `serverTimestamp()` (`request.time`).
10. **Immutable Field Hijack (`update /users/uid` changing `uid` or `createdAt`)**: Owner attempts to mutate `uid`, `email`, or `createdAt` during a tier update.
11. **Oversized Denial-of-Wallet String (`create /users/uid/phoneLookups/p1` with `webSummary` = 5000 chars)**: Violates blueprint `maxLength: 1200`.
12. **Invalid Enum / Regex Bypass (`create /users/uid/alprAudits/a1` with `plateNumber: "<script>"` and `overallStatus: "hacked"`)**: Fails blueprint `pattern` and `enum` validation.
