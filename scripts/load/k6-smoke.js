/**
 * Smoke de charge léger — environnement isolé uniquement.
 * Prérequis : k6 installé (https://k6.io), API joignable.
 *
 *   k6 run -e BASE_URL=http://127.0.0.1:4000 scripts/load/k6-smoke.js
 *
 * Ne pas lancer contre la production sans autorisation explicite.
 */
import http from "k6/http"
import { check, sleep } from "k6"

export const options = {
  vus: 5,
  duration: "30s",
  thresholds: {
    http_req_failed: ["rate<0.05"],
    http_req_duration: ["p(95)<1500"],
  },
}

const base = (__ENV.BASE_URL || "http://127.0.0.1:4000").replace(/\/+$/, "")

export default function () {
  const live = http.get(`${base}/health/live`)
  check(live, {
    "live 200": (r) => r.status === 200,
  })

  const meta = http.get(`${base}/api/v1/meta`)
  check(meta, {
    "meta 200": (r) => r.status === 200,
  })

  const search = http.get(`${base}/api/v1/search?limit=10`)
  check(search, {
    "search 2xx": (r) => r.status >= 200 && r.status < 300,
  })

  sleep(1)
}
