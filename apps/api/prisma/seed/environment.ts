const PRODUCTION_LIKE_APP_ENVS = new Set(["production", "staging"])

export function isProductionLike(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return (
    env.NODE_ENV === "production" ||
    PRODUCTION_LIKE_APP_ENVS.has(env.APP_ENV ?? "")
  )
}

export function databaseName(connectionString: string): string {
  const name = new URL(connectionString).pathname.replace(/^\//, "")
  if (!name) {
    throw new Error("Nom de base absent de l'URL de connexion")
  }
  return decodeURIComponent(name)
}

export function isTestDatabase(connectionString: string): boolean {
  return databaseName(connectionString).endsWith("_test")
}
