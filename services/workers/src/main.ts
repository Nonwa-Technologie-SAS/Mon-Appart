import { createServer, type Server } from "node:http"
import { resolve } from "node:path"
import { JOB_QUEUES } from "@mon-appart/types"
import { Queue, Worker } from "bullmq"
import { config as loadEnv } from "dotenv"

loadEnv({ path: resolve(process.cwd(), ".env") })
loadEnv({ path: resolve(process.cwd(), "../../.env") })

import { redisConnectionFromUrl } from "./connection"

const redisUrl = process.env.REDIS_URL
const port = Number(process.env.WORKER_PORT ?? 4001)

if (!redisUrl) {
  console.error("REDIS_URL est absent")
  process.exit(1)
}

const connection = redisConnectionFromUrl(redisUrl)
let redisReady = false

const worker = new Worker(JOB_QUEUES.systemPing, async () => ({ ok: true }), {
  connection,
})

worker.on("ready", () => {
  redisReady = true
})

worker.on("error", (error: Error) => {
  redisReady = false
  console.error(error.name)
})

const queue = new Queue(JOB_QUEUES.systemPing, { connection })

const server: Server = createServer((request, response) => {
  if (request.url === "/health/live") {
    response.writeHead(200, { "content-type": "application/json" })
    response.end(JSON.stringify({ status: "ok", service: "workers" }))
    return
  }
  if (request.url === "/health/ready") {
    const status = redisReady ? 200 : 503
    response.writeHead(status, { "content-type": "application/json" })
    response.end(
      JSON.stringify({
        status: redisReady ? "ok" : "degraded",
        service: "workers",
      }),
    )
    return
  }
  response.writeHead(404)
  response.end()
})

server.listen(port, "0.0.0.0")

async function shutdown(): Promise<void> {
  server.close()
  await worker.close()
  await queue.close()
  process.exit(0)
}

process.on("SIGINT", () => {
  void shutdown()
})
process.on("SIGTERM", () => {
  void shutdown()
})
