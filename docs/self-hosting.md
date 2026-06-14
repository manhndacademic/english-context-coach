# Self-Hosting Guide

This guide provides detailed instructions on how to self-host the **English Context Coach** application on a personal server (VPS/Homelab) using **Docker Compose**, configure **Google OAuth** for user authentication, integrate with **Nginx Proxy Manager** (or other Reverse Proxies), and set up basic security measures.

---

## 1. System Requirements

Before you begin, ensure your server has the following installed:

- **Docker** and **Docker Compose** (V2 or higher).
- A **Domain Name** pointed to your server's IP address to set up HTTPS and OAuth login.

---

## 2. Environment Variables Configuration (`.env`)

Create a `.env` file from the example `.env.example` template at the root of the project:

```bash
cp .env.example .env
```

Open the `.env` file and configure the values:

| Environment Variable     | Description                                           | Production Configuration Guide                                                                                                                         |
| :----------------------- | :---------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`           | PostgreSQL connection string.                         | `postgres://postgres:<SECURE_PASSWORD>@postgres:5432/english_context_coach`                                                                            |
| `REDIS_URL`              | Redis connection URL for background jobs.             | `redis://redis:6379`                                                                                                                                   |
| `AUTH_SECRET`            | Secret key used to encrypt Auth.js sessions.          | Generate using: `openssl rand -hex 32`                                                                                                                 |
| `AUTH_URL`               | The public URL of the application.                    | `https://english.domain.com` (Must use HTTPS)                                                                                                          |
| `AUTH_TRUST_HOST`        | Trusts forwarded headers from reverse proxies.        | Set to `true` (Mandatory behind a proxy)                                                                                                               |
| `GOOGLE_CLIENT_ID`       | Client ID from Google Cloud Console.                  | See instructions in Section 3                                                                                                                          |
| `GOOGLE_CLIENT_SECRET`   | Client Secret from Google Cloud Console.              | See instructions in Section 3                                                                                                                          |
| `GEMINI_API_KEYS`        | Google Gemini API Keys.                               | A comma-separated or newline-separated list of keys used in rotation (takes precedence over `GEMINI_API_KEY`). Supports inline comments (`#` or `//`). |
| `GEMINI_API_KEY`         | Google Gemini API Key.                                | Fallback key (supports single or multiple keys, newline-separated, and comments) if no keys are in the database and `GEMINI_API_KEYS` is not set.      |
| `GEMINI_ANALYSIS_MODELS` | Fallback models for analysis and grading.             | Comma-separated list. Recommended: `gemini-3.1-flash-lite,gemma-4-31b-it,gemma-4-26b-a4b-it,gemini-3-flash-preview,gemini-3.5-flash`                   |
| `GEMINI_FAST_MODELS`     | Fallback models for exercise generation.              | Comma-separated list. Recommended: `gemini-3.1-flash-lite,gemma-4-31b-it,gemma-4-26b-a4b-it,gemini-3-flash-preview,gemini-3.5-flash`                   |
| `GEMINI_THINKING_LEVEL`  | Thinking budget level for the model.                  | `MINIMAL`, `LOW`, `MEDIUM`, or `HIGH`                                                                                                                  |
| `WORKER_CONCURRENCY`     | Number of background tasks processed concurrently.    | Defaults to `1` (Recommended for small RAM servers)                                                                                                    |
| `ENCRYPTION_SECRET`      | Secret key for encrypting API keys in database.       | Generate using: `openssl rand -hex 16` (Must be at least 32 characters)                                                                                |
| `ADMIN_EMAIL`            | Email of the admin user to be automatically promoted. | e.g. `your.email@gmail.com`                                                                                                                            |

---

## 3. Google OAuth Configuration

The system uses Google OAuth to link a user's login method (**Account**) to their learner profile (**User**) in the database.

To get your `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`:

1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new Project or select an existing one.
3. Navigate to **API & Services** > **OAuth consent screen**:
   - Choose **External**.
   - Fill in the required fields (App name, User support email, Developer contact email).
4. Navigate to **Credentials** > **Create Credentials** > **OAuth client ID**:
   - **Application type**: Select `Web application`.
   - **Name**: Enter a descriptive name (e.g., `English Context Coach`).
   - **Authorized JavaScript origins**: Enter your public application URL, e.g., `https://english.domain.com`.
   - **Authorized redirect URIs**: Enter the exact callback URL:
     ```
     https://english.domain.com/api/auth/callback/google
     ```
     > [!IMPORTANT]
     > If this redirect URI is configured incorrectly, Google will return a `redirect_uri_mismatch` error when users attempt to log in.
5. Copy the **Client ID** and **Client Secret** into your `.env` file.

---

## 4. Deployment via Docker Compose

Below are two options for integrating the application with your Reverse Proxy.

### Option 1: Port Exposing (For General Reverse Proxies)

This option is suitable if your reverse proxy runs independently on the host machine or on another host. The application will expose port `3000` on the host, and the proxy will forward traffic to `http://localhost:3000`.

Use the project's default `docker-compose.yml` file:

```yaml
services:
  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_DB: ${DB_NAME:-english_context_coach}
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: ${DB_PASSWORD:-postgres}
    volumes:
      - postgres-data:/var/lib/postgresql/data
    healthcheck:
      test:
        [
          "CMD-SHELL",
          "pg_isready -U postgres -d ${DB_NAME:-english_context_coach}",
        ]
      interval: 5s
      timeout: 5s
      retries: 10

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    volumes:
      - redis-data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 10

  web:
    build: .
    restart: unless-stopped
    command: ["bun", "server.js"]
    env_file: .env
    environment:
      DATABASE_URL: postgres://postgres:${DB_PASSWORD:-postgres}@postgres:5432/${DB_NAME:-english_context_coach}
      REDIS_URL: redis://redis:6379
      AUTH_URL: ${AUTH_URL:-http://localhost:3000}
      HOSTNAME: "0.0.0.0"
    ports:
      - "3000:3000"
    depends_on:
      migrate:
        condition: service_completed_successfully
      redis:
        condition: service_healthy

  migrate:
    build: .
    command: ["bun", "run", "db:migrate"]
    env_file: .env
    environment:
      DATABASE_URL: postgres://postgres:${DB_PASSWORD:-postgres}@postgres:5432/${DB_NAME:-english_context_coach}
    depends_on:
      postgres:
        condition: service_healthy

  worker:
    build: .
    restart: unless-stopped
    command: ["bun", "run", "worker"]
    env_file: .env
    environment:
      DATABASE_URL: postgres://postgres:${DB_PASSWORD:-postgres}@postgres:5432/${DB_NAME:-english_context_coach}
      REDIS_URL: redis://redis:6379
    depends_on:
      migrate:
        condition: service_completed_successfully
      redis:
        condition: service_healthy

volumes:
  postgres-data:
  redis-data:
```

### Option 2: Internal Docker Network Connection (For Nginx Proxy Manager)

If you run Nginx Proxy Manager (NPM) in a Docker container and manage a shared docker network (e.g., `npm_network`), you can connect this project directly to it.
**Benefit:** No need to expose port `3000` to the host. NPM can directly resolve and access the `web` container through the Docker network using its service name.

Modify your `docker-compose.yml` file as follows:

```yaml
services:
  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_DB: ${DB_NAME:-english_context_coach}
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: ${DB_PASSWORD:-postgres}
    volumes:
      - postgres-data:/var/lib/postgresql/data
    networks:
      - default_net
    healthcheck:
      test:
        [
          "CMD-SHELL",
          "pg_isready -U postgres -d ${DB_NAME:-english_context_coach}",
        ]
      interval: 5s
      timeout: 5s
      retries: 10

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    volumes:
      - redis-data:/data
    networks:
      - default_net
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 10

  web:
    build: .
    restart: unless-stopped
    command: ["bun", "server.js"]
    env_file: .env
    environment:
      DATABASE_URL: postgres://postgres:${DB_PASSWORD:-postgres}@postgres:5432/${DB_NAME:-english_context_coach}
      REDIS_URL: redis://redis:6379
      AUTH_URL: ${AUTH_URL:-http://localhost:3000}
      HOSTNAME: "0.0.0.0"
    # Ports are omitted to keep the port unexposed on the host
    networks:
      - default_net
      - npm_network
    depends_on:
      migrate:
        condition: service_completed_successfully
      redis:
        condition: service_healthy

  migrate:
    build: .
    command: ["bun", "run", "db:migrate"]
    env_file: .env
    environment:
      DATABASE_URL: postgres://postgres:${DB_PASSWORD:-postgres}@postgres:5432/${DB_NAME:-english_context_coach}
    networks:
      - default_net
    depends_on:
      postgres:
        condition: service_healthy

  worker:
    build: .
    restart: unless-stopped
    command: ["bun", "run", "worker"]
    env_file: .env
    environment:
      DATABASE_URL: postgres://postgres:${DB_PASSWORD:-postgres}@postgres:5432/${DB_NAME:-english_context_coach}
      REDIS_URL: redis://redis:6379
    networks:
      - default_net
    depends_on:
      migrate:
        condition: service_completed_successfully
      redis:
        condition: service_healthy

networks:
  default_net: # Private internal network for English Context Coach services
  npm_network: # Shared network with Nginx Proxy Manager
    external: true
```

#### Configuring Nginx Proxy Manager UI Dashboard:

1. Log in to your NPM Admin UI.
2. Go to **Hosts** > **Proxy Hosts** > **Add Proxy Host**.
3. In the **Details** tab:
   - **Domain Names**: Enter your domain (e.g., `english.domain.com`).
   - **Scheme**: `http`
   - **Forward Hostname / IP**: Enter the service name of the web container: `web`.
   - **Forward Port**: `3000`
   - Toggle **Block Common Exploits** and **Websockets Support** to ON.
4. In the **SSL** tab:
   - **SSL Certificate**: Choose **Request a new SSL Certificate** (Let's Encrypt).
   - Toggle **Force SSL** and **HTTP/2 Support** to ON.
   - Accept the Let's Encrypt TOS and click **Save**.

---

## 5. Launching the Application

Once the `.env` and `docker-compose.yml` are configured, build and launch the containers:

```bash
docker compose up --build -d
```

This command automatically:

1. Pulls and builds images from the `Dockerfile` using Bun.
2. Starts the Postgres database.
3. Automatically runs the database migrations via the `migrate` service using Drizzle ORM.
4. Starts the `web` container (Next.js server) and `worker` container (background task queue processor) after migrations succeed.

Check container statuses:

```bash
docker compose ps
```

View logs for debugging:

```bash
docker compose logs -f
```

---

## 6. Security and Maintenance

### Security Checklist

- [ ] **Database Password:** Do not use the default `postgres` password. Generate a secure, unique password in both `.env` and `docker-compose.yml`.
- [ ] **AUTH_SECRET:** Make sure this is randomly generated. Run the following command on your machine to generate a new key:
  ```bash
  openssl rand -hex 32
  ```
- [ ] **HTTPS Enforced:** Do not deploy this application using standard HTTP. Auth.js secure cookies (`__Secure-` prefix) require HTTPS to authenticate successfully.

### Database Backups

To prevent any data loss for your registered **Users**, set up a cron job to backup the PostgreSQL database periodically.

**Manual backup command:**

```bash
docker exec -t $(docker compose ps -q postgres) pg_dump -U postgres -d english_context_coach > backup_$(date +%Y%m%d_%H%M%S).sql
```

**Restore command:**

```bash
# Erases current database and restores from backup (Use with caution!)
docker exec -i $(docker compose ps -q postgres) psql -U postgres -d english_context_coach < backup_file.sql
```

---

## 7. Admin Configuration and API Key Management

To access the LLM metrics dashboard (`/admin`) and set up system API key rotation, follow these steps:

### Promoted Admin Setup

1. Define the `ADMIN_EMAIL` environment variable in your `.env` file with the email address of your primary Google account:
   ```env
   ADMIN_EMAIL=your.email@gmail.com
   ```
2. Log in to the application. NextAuth will automatically verify your email, check it against `ADMIN_EMAIL`, and upgrade your user role to `admin` in the database.
3. Once promoted, the **Quản trị** link will appear in the navigation header, allowing you to access the dashboard.
4. Alternatively, you can run the promotion script inside the running container manually:
   ```bash
   docker compose exec web bun src/scratch/promote-admin.ts your.email@gmail.com
   ```

### API Key Rotation Configuration

1. Generate a secure, 32-character encryption secret to protect API keys in the database:
   ```bash
   openssl rand -hex 16
   ```
2. Set this value in your `.env` file:
   ```env
   ENCRYPTION_SECRET=your_32_character_hex_secret
   ```
3. Navigate to **Quản trị** > **Vòng xoay API Keys** (`/admin/keys`).
4. Add your Google AI Studio keys one by one. They will be stored securely using `AES-256-GCM` encryption.
5. The system will automatically cycle through these keys and handle cooldowns if any key hits Google's rate limits.
