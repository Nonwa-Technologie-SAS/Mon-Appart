/**
 * Analyse antivirus d'un document. `NOT_SCANNED` : aucun moteur configuré ;
 * le document reste en quarantaine (privé) et le module Trust en tient compte
 * avant toute décision de vérification.
 */
export type ScanResult = "CLEAN" | "INFECTED" | "NOT_SCANNED"

export interface DocumentScanner {
  readonly name: string
  scan(content: Buffer, mimeType: string): Promise<ScanResult>
}

export const DOCUMENT_SCANNER = Symbol("DOCUMENT_SCANNER")

/** Implémentation par défaut : aucun moteur, rien n'est affirmé. */
export class NoopDocumentScanner implements DocumentScanner {
  readonly name = "none"

  scan(): Promise<ScanResult> {
    return Promise.resolve("NOT_SCANNED")
  }
}
