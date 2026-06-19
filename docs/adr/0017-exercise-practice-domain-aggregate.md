# ExercisePractice domain aggregate for unified practice history query

Introduce the `ExercisePractice` domain aggregate in the `memory` package to group an exercise with its practice history (attempts, errors, and mistake patterns). Grouping these prevents client-side components from performing manual lookups or queries across disjointed maps, simplifies statistics calculations, and aligns the frontend with the separated bounded contexts.

## Considered Options

- Group practice state on the client component: rejected because it leaks domain knowledge, duplicates mapping logic, and results in complex prop drillings and map lookups.
- Group practice state on the server controller into raw data and instantiate the domain aggregate in the client: chosen because client-side class instantiation (via `useMemo`) allows us to leverage rich domain logic/getters (`isSolved`, `needsRetry`) without breaking Next.js Server-to-Client serialization boundaries.
