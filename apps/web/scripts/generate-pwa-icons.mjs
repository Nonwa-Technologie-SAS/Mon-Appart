import { createRequire } from "node:module"
import { mkdirSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const repoRoot = join(root, "..", "..")
const require = createRequire(join(repoRoot, "apps/api/package.json"))
const sharp = require("sharp")

const iconsDir = join(root, "public", "icons")
const src = join(root, "public", "logo.png")
const bg = { r: 21, g: 101, b: 192, alpha: 1 }

mkdirSync(iconsDir, { recursive: true })

for (const size of [192, 512]) {
  await sharp(src)
    .resize(size, size, { fit: "contain", background: bg })
    .png()
    .toFile(join(iconsDir, `icon-${size}.png`))
}

await sharp(src)
  .resize(180, 180, { fit: "contain", background: bg })
  .png()
  .toFile(join(iconsDir, "apple-touch-icon.png"))

console.log("Icônes PWA générées dans public/icons/")
