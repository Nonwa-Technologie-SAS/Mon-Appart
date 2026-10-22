/**
 * Contrôle heuristique d'un PDF : refuse le contenu actif (JavaScript,
 * lancement d'application, fichiers embarqués). Ne remplace pas un antivirus :
 * un objet compressé peut masquer ces mots-clés. Un `DocumentScanner` réel
 * (ClamAV, service managé) se branche derrière la même interface.
 */
const ACTIVE_CONTENT = [
  "/JavaScript",
  "/JS",
  "/Launch",
  "/EmbeddedFile",
  "/RichMedia",
] as const

export interface PdfInspection {
  valid: boolean
  activeContent: string[]
}

export function inspectPdf(bytes: Buffer): PdfInspection {
  const text = bytes.toString("latin1")
  if (!text.startsWith("%PDF-") || !text.slice(-1_024).includes("%%EOF")) {
    return { valid: false, activeContent: [] }
  }
  // Les noms PDF acceptent l'échappement hexadécimal (/J#61vaScript).
  const names = text.replace(/#([0-9a-fA-F]{2})/g, (_, hex: string) =>
    String.fromCharCode(Number.parseInt(hex, 16)),
  )
  const activeContent = ACTIVE_CONTENT.filter((name) =>
    new RegExp(`${name.replace("/", "\\/")}(?![A-Za-z0-9])`).test(names),
  )
  return { valid: true, activeContent }
}
