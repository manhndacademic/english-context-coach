Status: ready-for-agent

## Parent

[.scratch/action-layer-cleanup/PRD.md](../PRD.md)

## What to build

Define a new `UserApiKeyRepository` port interface (in `domain/ai/` or a new `domain/user-settings/` module) with the following operations: `add(userId, data)`, `delete(userId, keyId)`, `disable(userId, keyId)`, `enable(userId, keyId)`, `reverify(userId, keyId)`, `findById(userId, keyId)`, `countForUser(userId)`, `checkDuplicate(userId, fingerprint)`.

Implement `DrizzleUserApiKeyRepository` backed by the existing Drizzle schema for user API keys.

Add PGLite-based adapter tests (follow `src/domain/memory/adapters/drizzle-repositories.test.ts` as prior art) covering: add, delete, disable, enable, countForUser, and checkDuplicate (deduplication via SHA-256 fingerprint). Do **not** yet wire this into `settings.ts` actions — that is issue 03.

## Acceptance criteria

- [ ] `UserApiKeyRepository` port interface is defined with all 8 methods listed above
- [ ] `DrizzleUserApiKeyRepository` implements the port using the existing Drizzle schema
- [ ] `MAX_USER_KEYS = 10` business constant is co-located with the domain service/repository (not in an action file)
- [ ] PGLite adapter tests cover add, delete, disable, enable, countForUser, checkDuplicate (all passing)
- [ ] The repository is **not yet wired** into `settings.ts` actions (that is issue 03)
- [ ] `bun run typecheck` passes
- [ ] `bun run test` passes

## Blocked by

None — can start immediately
