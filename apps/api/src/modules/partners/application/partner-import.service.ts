import { Injectable } from "@nestjs/common"

import { CsvPropertyFeedAdapter } from "../domain/csv-feed.adapter"
import { partnerError } from "../domain/partner-errors"
import { PartnersRepository } from "../infrastructure/partners.repository"

/**
 * Import CSV : validation + journal de lot.
 * N’applique pas automatiquement les annonces (Trust / Listing requis ensuite).
 */
@Injectable()
export class PartnerImportService {
  private readonly adapter = new CsvPropertyFeedAdapter()

  constructor(private readonly repository: PartnersRepository) {}

  async validateCsv(
    partnerPublicId: string,
    input: { filename: string; csv: string; dryRun?: boolean },
  ) {
    const partner = await this.repository.findByPublicId(partnerPublicId)
    if (!partner) throw partnerError("PARTNER_NOT_FOUND")

    const report = this.adapter.parse(input.csv)
    const rejected = report.errors.length
    const accepted = report.accepted.length
    const status =
      accepted === 0
        ? ("REJECTED" as const)
        : rejected > 0
          ? ("PARTIAL" as const)
          : ("VALIDATED" as const)

    const sampleErrors = report.errors.slice(0, 40)
    const batch = await this.repository.createImportBatch({
      partnerId: partner.id,
      status,
      filename: input.filename || "import.csv",
      rowCount: report.rowCount,
      acceptedRows: accepted,
      rejectedRows: report.rowCount - accepted,
      report: {
        dryRun: input.dryRun !== false,
        duplicateExternalIds: report.duplicateExternalIds,
        errors: sampleErrors,
        acceptedSample: report.accepted.slice(0, 10).map((row) => ({
          externalListingId: row.externalListingId,
          listingType: row.listingType,
          communeCode: row.communeCode,
          amount: row.amount,
          pricePeriod: row.pricePeriod,
        })),
        note: "Dry-run : aucune annonce créée. Application via Listing + contrôles Trust.",
      },
    })

    return {
      importId: batch.publicId,
      status: batch.status,
      rowCount: batch.rowCount,
      acceptedRows: batch.acceptedRows,
      rejectedRows: batch.rejectedRows,
      duplicateExternalIds: report.duplicateExternalIds,
      errors: sampleErrors,
      acceptedPreview: report.accepted.slice(0, 20),
      applied: false,
    }
  }
}
