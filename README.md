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
- `AUTH_URL`: public app origin, for example `https://english-context-coach.manhnd.dev`
- `AUTH_TRUST_HOST`: set to `true` when running behind a reverse proxy
- `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`: optional Google OAuth login
- `GEMINI_API_KEY`: Gemini API key for AI generation and grading
- `GEMINI_ANALYSIS_MODEL`: stronger model for analysis and open grading
- `GEMINI_FAST_MODEL`: faster model for exercise/review generation
- `GEMINI_THINKING_LEVEL`: Gemini 3 thinking level for generation thoughts: `MINIMAL`, `LOW`, `MEDIUM`, or `HIGH`
- `WORKER_CONCURRENCY`: global worker concurrency, defaults to `1`
