#!/usr/bin/env node
/**
 * Smoke post-déploiement : vérifie les healthchecks publics.
 * Usage :
 *   SMOKE_API_URL=https://api.exemple.ci node scripts/smoke-health.mjs
 *   SMOKE_WEB_URL=https://www.exemple.ci node scripts/smoke-health.mjs
 */

const apiBase = (process.env.SMOKE_API_URL ?? "http://127.0.0.1:4000").replace(
  /\/+$/,
  "",
)
const webBase = process.env.SMOKE_WEB_URL?.replace(/\/+$/, "") ?? null
const timeoutMs = Number(process.env.SMOKE_TIMEOUT_MS ?? 10_000)

async function check(name, url, expectOk = true) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    })
    const body = await res.text()
    const ok = expectOk ? res.ok : true
    if (!ok) {
      throw new Error(`${name} → HTTP ${res.status} ${body.slice(0, 200)}`)
    }
    console.log(`OK  ${name} (${res.status}) ${url}`)
    return body
  } finally {
    clearTimeout(timer)
  }
}

const failures = []

try {
  await check("live", `${apiBase}/health/live`)
} catch (error) {
  failures.push(error)
}

try {
  const readyBody = await check("ready", `${apiBase}/health/ready`, false)
  const parsed = JSON.parse(readyBody)
  if (parsed.status !== "ok") {
    console.warn(`WARN ready degraded: ${readyBody.slice(0, 300)}`)
  } else {
    console.log("OK  ready status=ok")
  }
} catch (error) {
  failures.push(error)
}

if (webBase) {
  try {
    await check("web", `${webBase}/`, false)
  } catch (error) {
    failures.push(error)
  }
}

if (failures.length > 0) {
  for (const error of failures) {
    console.error(String(error?.message ?? error))
  }
  process.exit(1)
}

console.log("Smoke health: succès")
