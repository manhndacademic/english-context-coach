# English Context Coach

Self-hosted web app for Vietnamese learners who paste English source material and receive context-aware lessons, practice exercises, Vietnamese feedback, and repeated-mistake review.

## Local development

```bash
bun install
cp .env.example .env
bun run docker:local:up
bun run db:push
bun run dev
```

Run the background worker in another terminal:

```bash
bun run worker
```

Run release checks:

```bash
bun run lint
bun run test
bun run build
```

`bun run test` is the supported test command because the suite runs on Vitest.

To stop the local PostgreSQL container:

```bash
bun run docker:local:down
```

To delete the local PostgreSQL data volume and start from a clean database:

```bash
bun run docker:local:reset
```

## Docker Compose

```bash
cp .env.example .env
docker compose up --build
```

Services:

- `web`: Next.js application
- `worker`: queued AI generation worker
- `postgres`: database

## Configuration

- `DATABASE_URL`: PostgreSQL connection string
- `AUTH_SECRET`: random secret for Auth.js
- `AUTH_URL`: the public URL of the application (e.g. `https://english.domain.com`)
- `AUTH_TRUST_HOST`: set to `true` when running behind a reverse proxy (like Nginx Proxy Manager)
- `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`: optional Google OAuth login
- `GEMINI_API_KEYS`: comma-separated or newline-separated list of Gemini API keys for rotated pool (takes precedence over `GEMINI_API_KEY`). Supports inline comments (using `#` or `//`).
- `GEMINI_API_KEY`: fallback Gemini API key (supports single/multiple keys, newline-separated, and comments).
- `GEMINI_ANALYSIS_MODELS`: comma-separated fallback models for analysis and open grading
- `GEMINI_FAST_MODELS`: comma-separated fallback models for exercise/review generation
- `GEMINI_THINKING_LEVEL`: Gemini 3 thinking level for generation thoughts: `MINIMAL`, `LOW`, `MEDIUM`, or `HIGH`
- `WORKER_CONCURRENCY`: global worker concurrency, defaults to `1`
