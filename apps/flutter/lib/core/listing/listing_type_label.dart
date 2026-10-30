/// Libellés des types d'offre Nest `LISTING_TYPES`.
abstract final class ListingTypeLabel {
  static String of(String? code) {
    return switch (code) {
      'RENT' => 'À louer',
      'SALE' => 'À vendre',
      'SHORT_TERM_RENT' => 'Meublé',
      'LEASE_TO_OWN' => 'Location-vente',
      _ => code ?? 'Annonce',
    };
  }
}
