export interface RedisConnectionOptions {
  host: string
  port: number
  username?: string
  password?: string
  maxRetriesPerRequest: null
}

export function redisConnectionFromUrl(
  redisUrl: string,
): RedisConnectionOptions {
  const url = new URL(redisUrl)
  const port = url.port ? Number(url.port) : 6379
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error("REDIS_URL invalide")
  }
  return {
    host: url.hostname,
    port,
    ...(url.username ? { username: decodeURIComponent(url.username) } : {}),
    ...(url.password ? { password: decodeURIComponent(url.password) } : {}),
    maxRetriesPerRequest: null,
  }
}
