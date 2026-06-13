# LLM API Key Rotation and Metrics

To prevent API rate-limiting issues when sharing the application and to understand our LLM operating costs, we decided to implement a dual-mode API Key management system (combining an encrypted database-backed System API Key Rotation Pool with User-Provided API Keys) alongside automated token usage and latency metrics tracking logged directly into the database.

System API keys are encrypted with AES-256-GCM in the database using a secret key from environment variables, and rotated on every request with an automated cooldown mechanism when encountering rate limits (HTTP 429) or invalidations (HTTP 400/403). User-provided keys are configured via a dedicated `/settings` page and override the system pool to protect shared system resource limits.
