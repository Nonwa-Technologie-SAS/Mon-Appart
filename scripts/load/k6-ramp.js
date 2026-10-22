/**
 * Montée en charge progressive — staging / lab uniquement.
 *
 *   k6 run -e BASE_URL=http://127.0.0.1:4000 scripts/load/k6-ramp.js
 */
import http from "k6/http"
import { check, sleep } from "k6"

export const options = {
  stages: [
    { duration: "1m", target: 10 },
    { duration: "2m", target: 30 },
    { duration: "1m", target: 0 },
  ],
  thresholds: {
    http_req_failed: ["rate<0.02"],
    http_req_duration: ["p(95)<2000", "p(99)<4000"],
  },
}

const base = (__ENV.BASE_URL || "http://127.0.0.1:4000").replace(/\/+$/, "")

export default function () {
  const responses = http.batch([
    ["GET", `${base}/health/live`],
    ["GET", `${base}/api/v1/search?limit=20`],
  ])
  check(responses[0], { live: (r) => r.status === 200 })
  check(responses[1], {
    search: (r) => r.status >= 200 && r.status < 500,
  })
  sleep(0.5)
}
