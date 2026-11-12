import 'listing_detail.dart';

/// Texte de partage : titre, prix, localisation publique.
/// L'URL n'est ajoutée que si [publicUrl] est fournie (hôte `PUBLIC_WEB_HOST`).
abstract final class ListingShareText {
  static String of(ListingDetail listing, {String? publicUrl}) {
    return [
      listing.title,
      listing.priceLabel,
      listing.location.label,
      listing.listingTypeLabel,
      if (publicUrl != null && publicUrl.isNotEmpty) publicUrl,
    ].join('\n');
  }
}
