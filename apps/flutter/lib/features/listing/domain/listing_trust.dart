import '../../../core/json/json_map.dart';

class ListingBadge {
  const ListingBadge({
    required this.code,
    required this.label,
    this.verifiedAt,
  });

  final String code;
  final String label;
  final DateTime? verifiedAt;

  static ListingBadge? tryParse(Object? raw) {
    final json = asJsonMapOrNull(raw);
    if (json == null) {
      return null;
    }
    final code = asNonEmptyString(json['code']);
    final label = asNonEmptyString(json['label']);
    if (code == null || label == null) {
      return null;
    }
    return ListingBadge(
      code: code,
      label: label,
      verifiedAt: DateTime.tryParse(asNonEmptyString(json['verifiedAt']) ?? ''),
    );
  }
}

/// `GET /api/v1/trust/listings/:id/badges` — faits examinés, pas une garantie.
class ListingTrust {
  const ListingTrust({
    this.listingBadges = const [],
    this.publisherBadges = const [],
    this.verificationInProgress = false,
    this.disclaimer,
  });

  final List<ListingBadge> listingBadges;
  final List<ListingBadge> publisherBadges;
  final bool verificationInProgress;
  final String? disclaimer;

  bool get hasContent =>
      listingBadges.isNotEmpty ||
      publisherBadges.isNotEmpty ||
      verificationInProgress;

  static List<ListingBadge> _parseList(Object? raw) {
    if (raw is! List) {
      return const [];
    }
    return [for (final item in raw) ?ListingBadge.tryParse(item)];
  }

  static ListingTrust fromJson(Map<String, Object?> json) {
    return ListingTrust(
      listingBadges: _parseList(json['badges']),
      publisherBadges: _parseList(json['publisherBadges']),
      verificationInProgress: json['verificationInProgress'] == true,
      disclaimer: asNonEmptyString(json['disclaimer']),
    );
  }
}
