import { type ConnectionOptions } from "bullmq";

export const redisConnection: ConnectionOptions = {
  // Use connection URL from environment or default to localhost
  // Note: BullMQ connection can accept a full URL string inside the connection options or host/port
  // We can pass the URL directly, but since BullMQ connection options internally accepts connection options,
  // we can parse the URL or use a custom connection configuration.
  // We can just parse host and port if needed, or pass it as ConnectionOptions.
  // Actually, BullMQ connection options accepts: { host, port, username, password, etc. } or ioredis connection options.
  // To support a REDIS_URL string, we can parse it using URL or pass host/port.
  ...parseRedisUrl(process.env.REDIS_URL ?? "redis://localhost:6379"),
  maxRetriesPerRequest: null,
};

function parseRedisUrl(urlStr: string) {
  try {
    const parsed = new URL(urlStr);
    return {
      host: parsed.hostname || "localhost",
      port: parsed.port ? parseInt(parsed.port, 10) : 6379,
      username: parsed.username || undefined,
      password: parsed.password || undefined,
    };
  } catch {
    return {
      host: "localhost",
      port: 6379,
    };
  }
}
