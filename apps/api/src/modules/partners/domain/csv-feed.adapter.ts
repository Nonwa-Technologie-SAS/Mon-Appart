import type {
  FeedListingDraft,
  FeedRowError,
  FeedValidationReport,
  PropertyFeedAdapter,
} from "./property-feed"
import {
  LISTING_TYPE_CODES,
  PRICE_PERIOD_CODES,
} from "./property-feed"

const MAX_ROWS = 500
const REQUIRED = [
  "externalListingId",
  "title",
  "listingType",
  "propertyTypeCode",
  "communeCode",
  "amount",
  "pricePeriod",
] as const

function splitCsvLine(line: string): string[] {
  const cells: string[] = []
  let current = ""
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }
    if (ch === "," && !inQuotes) {
      cells.push(current.trim())
      current = ""
      continue
    }
    current += ch
  }
  cells.push(current.trim())
  return cells
}

function parseCsv(text: string): string[][] {
  return text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.length > 0)
    .map(splitCsvLine)
}

/**
 * Adaptateur CSV contrôlé : validation + normalisation, pas d'écriture métier.
 * Un fichier invalide ne touche pas PostgreSQL métier.
 */
export class CsvPropertyFeedAdapter implements PropertyFeedAdapter {
  readonly kind = "CSV_IMPORT" as const

  parse(input: unknown): FeedValidationReport {
    if (typeof input !== "string") {
      return {
        rowCount: 0,
        accepted: [],
        errors: [
          {
            line: 0,
            field: "file",
            code: "INVALID_INPUT",
            message: "Contenu CSV attendu (texte).",
          },
        ],
        duplicateExternalIds: [],
      }
    }

    const rows = parseCsv(input)
    if (rows.length < 2) {
      return {
        rowCount: 0,
        accepted: [],
        errors: [
          {
            line: 0,
            field: "file",
            code: "EMPTY",
            message: "En-tête + au moins une ligne requis.",
          },
        ],
        duplicateExternalIds: [],
      }
    }

    const header = rows[0]!.map((h) => h.trim())
    const errors: FeedRowError[] = []
    for (const col of REQUIRED) {
      if (!header.includes(col)) {
        errors.push({
          line: 1,
          field: col,
          code: "MISSING_COLUMN",
          message: `Colonne obligatoire absente : ${col}`,
        })
      }
    }
    if (errors.length > 0) {
      return {
        rowCount: 0,
        accepted: [],
        errors,
        duplicateExternalIds: [],
      }
    }

    const body = rows.slice(1, MAX_ROWS + 1)
    if (rows.length - 1 > MAX_ROWS) {
      errors.push({
        line: 0,
        field: "file",
        code: "TOO_MANY_ROWS",
        message: `Maximum ${MAX_ROWS} lignes par import.`,
      })
    }

    const accepted: FeedListingDraft[] = []
    const seen = new Set<string>()
    const duplicates = new Set<string>()

    body.forEach((cells, index) => {
      const line = index + 2
      const row: Record<string, string> = {}
      header.forEach((key, i) => {
        row[key] = cells[i] ?? ""
      })

      const externalListingId = row.externalListingId?.trim() ?? ""
      if (!externalListingId || externalListingId.length > 120) {
        errors.push({
          line,
          field: "externalListingId",
          code: "INVALID",
          message: "Identifiant externe requis (≤ 120).",
        })
        return
      }
      if (seen.has(externalListingId)) {
        duplicates.add(externalListingId)
        errors.push({
          line,
          field: "externalListingId",
          code: "DUPLICATE",
          message: "Doublon dans le fichier.",
        })
        return
      }
      seen.add(externalListingId)

      const title = row.title?.trim() ?? ""
      if (title.length < 3 || title.length > 160) {
        errors.push({
          line,
          field: "title",
          code: "INVALID",
          message: "Titre entre 3 et 160 caractères.",
        })
        return
      }

      const listingType = (row.listingType ?? "").toUpperCase()
      if (
        !LISTING_TYPE_CODES.includes(
          listingType as (typeof LISTING_TYPE_CODES)[number],
        )
      ) {
        errors.push({
          line,
          field: "listingType",
          code: "INVALID",
          message: `Types : ${LISTING_TYPE_CODES.join(", ")}`,
        })
        return
      }

      const propertyTypeCode = (row.propertyTypeCode ?? "")
        .trim()
        .toUpperCase()
      if (!/^[A-Z0-9_]{2,40}$/.test(propertyTypeCode)) {
        errors.push({
          line,
          field: "propertyTypeCode",
          code: "INVALID",
          message: "Code type de bien invalide.",
        })
        return
      }

      const communeCode = (row.communeCode ?? "").trim().toUpperCase()
      if (!/^[A-Z0-9_]{2,40}$/.test(communeCode)) {
        errors.push({
          line,
          field: "communeCode",
          code: "INVALID",
          message: "Code commune référentiel requis.",
        })
        return
      }

      const amount = Number(row.amount)
      if (!Number.isFinite(amount) || amount <= 0 || amount > 1e12) {
        errors.push({
          line,
          field: "amount",
          code: "INVALID",
          message: "Montant XOF strictement positif.",
        })
        return
      }

      const pricePeriod = (row.pricePeriod ?? "").toUpperCase()
      if (
        !PRICE_PERIOD_CODES.includes(
          pricePeriod as (typeof PRICE_PERIOD_CODES)[number],
        )
      ) {
        errors.push({
          line,
          field: "pricePeriod",
          code: "INVALID",
          message: `Périodes : ${PRICE_PERIOD_CODES.join(", ")}`,
        })
        return
      }

      // Ne pas mélanger vente (ONCE) et loyer mensuel sans contrôle explicite.
      if (listingType === "SALE" && pricePeriod !== "ONCE") {
        errors.push({
          line,
          field: "pricePeriod",
          code: "INCOMPATIBLE",
          message: "Vente : pricePeriod=ONCE obligatoire.",
        })
        return
      }
      if (
        (listingType === "RENT" || listingType === "SHORT_TERM_RENT") &&
        pricePeriod === "ONCE"
      ) {
        errors.push({
          line,
          field: "pricePeriod",
          code: "INCOMPATIBLE",
          message: "Location : période ONCE interdite.",
        })
        return
      }

      const bedroomsRaw = row.bedrooms?.trim()
      const bedrooms =
        bedroomsRaw === undefined || bedroomsRaw === ""
          ? null
          : Number(bedroomsRaw)
      if (
        bedrooms !== null &&
        (!Number.isInteger(bedrooms) || bedrooms < 0 || bedrooms > 50)
      ) {
        errors.push({
          line,
          field: "bedrooms",
          code: "INVALID",
          message: "Chambres : entier 0–50 ou vide.",
        })
        return
      }

      const surfaceRaw = row.surface?.trim()
      const surface =
        surfaceRaw === undefined || surfaceRaw === ""
          ? null
          : Number(surfaceRaw)
      if (
        surface !== null &&
        (!Number.isFinite(surface) || surface <= 0 || surface > 1_000_000)
      ) {
        errors.push({
          line,
          field: "surface",
          code: "INVALID",
          message: "Surface m² positive ou vide.",
        })
        return
      }

      const description = row.description?.trim() || null
      if (description && description.length > 5_000) {
        errors.push({
          line,
          field: "description",
          code: "INVALID",
          message: "Description trop longue (≤ 5000).",
        })
        return
      }

      accepted.push({
        externalListingId,
        title,
        listingType: listingType as FeedListingDraft["listingType"],
        propertyTypeCode,
        communeCode,
        amount,
        currency: "XOF",
        pricePeriod: pricePeriod as FeedListingDraft["pricePeriod"],
        bedrooms,
        surface,
        description,
      })
    })

    return {
      rowCount: body.length,
      accepted,
      errors,
      duplicateExternalIds: [...duplicates],
    }
  }
}
