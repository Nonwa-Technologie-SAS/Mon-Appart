#!/usr/bin/env node
/**
 * Affiche des secrets locaux à coller dans `.env`. N'écrit aucun fichier.
 */
import { randomBytes } from "node:crypto"

function secret() {
  return randomBytes(32).toString("base64url")
}

console.log("# Coller dans .env local — ne pas committer, ne pas réutiliser en prod.")
console.log(`JWT_SECRET=${secret()}`)
console.log(`JWT_REFRESH_SECRET=${secret()}`)
console.log(`PAYMENT_MOCK_WEBHOOK_SECRET=${secret()}`)
console.log(`METRICS_SCRAPE_TOKEN=${secret()}`)
