#!/usr/bin/env node
/**
 * Échoue si un fichier .env (hors *.example) est suivi par Git.
 * Ne lit pas le contenu des fichiers.
 */
import { execFileSync } from "node:child_process"

const listed = execFileSync("git", ["ls-files"], { encoding: "utf8" })
const tracked = listed.split("\n").filter(Boolean)
const forbidden = tracked.filter((file) => {
  const base = file.split("/").pop() ?? file
  if (base === ".env.example") return false
  return base === ".env" || /^\.env\./.test(base)
})

if (forbidden.length > 0) {
  console.error(
    "Fichiers d'environnement suivis par Git (à retirer de l'index) :",
  )
  for (const file of forbidden) console.error(`  ${file}`)
  process.exit(1)
}

console.log("Aucun fichier .env suivi (hors .env.example).")
