import '../../../core/listing/listing_summary.dart';
import '../../../core/listing/public_ids.dart';
import '../../listing/domain/listing_detail.dart';

/// Élément de la shortlist de comparaison. Session locale uniquement.
class ShortlistEntry {
  const ShortlistEntry({
    required this.listingId,
    required this.title,
    required this.propertyId,
  });

  final String listingId;
  final String title;
  final String propertyId;

  bool get isValid => PublicIds.isUuid(listingId);

  Map<String, Object?> toJson() {
    return {'listingId': listingId, 'title': title, 'propertyId': propertyId};
  }

  static ShortlistEntry? tryParse(Object? raw) {
    if (raw is! Map) {
      return null;
    }
    final listingId = raw['listingId']?.toString();
    final title = raw['title']?.toString();
    final propertyId = raw['propertyId']?.toString();
    if (listingId == null ||
        title == null ||
        propertyId == null ||
        !PublicIds.isUuid(listingId)) {
      return null;
    }
    return ShortlistEntry(
      listingId: listingId,
      title: title,
      propertyId: propertyId,
    );
  }

  factory ShortlistEntry.fromSummary(ListingSummary listing) {
    return ShortlistEntry(
      listingId: listing.listingId,
      title: listing.title,
      propertyId: listing.propertyId,
    );
  }

  factory ShortlistEntry.fromDetail(ListingDetail listing) {
    return ShortlistEntry(
      listingId: listing.listingId,
      title: listing.title,
      propertyId: listing.propertyId,
    );
  }
}

enum ShortlistChange { added, removed, duplicate, full, invalid }

abstract final class ShortlistLimits {
  static const maxItems = 4;
  static const minCompare = 2;
}
