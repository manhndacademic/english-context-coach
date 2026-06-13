# Persisted mastery state with computed due eligibility

MistakePatterns persist `MasteryState` as `active` or `mastered`, while due review eligibility is computed from an active MistakePattern's `dueAt` and usable review prompt status. Persisting `due` would require a worker or lazy transition whenever time passes, so the schedule remains temporal data and mastery remains learner progress state; new UserErrors or failed ReviewAttempts reactivate mastered patterns.

## Considered Options

- Persist `due`, `active`, and `mastered`: rejected because due changes as time passes even when no learner action occurs.
- Derive all states from `intervalDays` and `dueAt`: rejected because mastery is learner progress worth querying and displaying directly.
