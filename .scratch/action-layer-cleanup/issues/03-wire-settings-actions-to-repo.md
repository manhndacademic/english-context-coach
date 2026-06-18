Status: ready-for-agent

## Parent

[.scratch/action-layer-cleanup/PRD.md](../PRD.md)

## What to build

Refactor all user API key actions in `app/actions/settings.ts` to delegate to `UserApiKeyRepository` (introduced in issue 02):

- `addUserApiKeyAction` → validate → delegate duplicate-check + encryption orchestration to `UserApiKeyRepository.add()` → revalidate path. The `MAX_USER_KEYS` check must also move into the domain layer.
- `enableUserApiKeyAction` → delegate to `UserApiKeyRepository.enable()`; the fetch → decrypt → verify → update status orchestration lives inside the repository method.
- `reverifyUserApiKeyAction` → delegate to `UserApiKeyRepository.reverify()`.
- `deleteUserApiKeyAction` → delegate to `UserApiKeyRepository.delete()`.
- `disableUserApiKeyAction` → delegate to `UserApiKeyRepository.disable()`.

After the migration, each action should match the gold-standard shape: `validate → delegate → revalidate path`. No raw Drizzle statements should remain in any of these action handlers.

Evaluate whether `saveUserApiKeyAction` (the legacy multi-key action) has any remaining call sites. If none, delete it.

All Vietnamese error messages must be preserved verbatim.

## Acceptance criteria

- [ ] `addUserApiKeyAction`, `enableUserApiKeyAction`, `reverifyUserApiKeyAction`, `deleteUserApiKeyAction`, `disableUserApiKeyAction` contain zero raw Drizzle statements
- [ ] `MAX_USER_KEYS` is no longer a module-level constant in an action file
- [ ] Vietnamese error messages are preserved verbatim throughout
- [ ] `saveUserApiKeyAction` is deleted if no call sites remain, or documented if retained
- [ ] The actions follow the validate → delegate → revalidate path shape
- [ ] `bun run typecheck` passes
- [ ] `bun run test` passes

## Blocked by

- [02-extract-user-api-key-repository.md](02-extract-user-api-key-repository.md) — `UserApiKeyRepository` port and adapter must exist first
