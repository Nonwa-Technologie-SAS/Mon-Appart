import '../../../core/json/json_map.dart';

/// Élément de `GET /api/v1/interactions/favorites`.
/// Nest n'envoie que listingId, propertyId, title, createdAt.
class FavoriteItem {
  const FavoriteItem({
    required this.listingId,
    required this.propertyId,
    required this.title,
    this.createdAt,
  });

  final String listingId;
  final String propertyId;
  final String title;
  final DateTime? createdAt;

  Map<String, Object?> toJson() {
    return {
      'listingId': listingId,
      'propertyId': propertyId,
      'title': title,
      'createdAt': createdAt?.toUtc().toIso8601String(),
    };
  }

  static FavoriteItem? tryParse(Object? raw) {
    if (raw is! Map) {
      return null;
    }
    final json = asJsonMap(raw);
    final listingId = asNonEmptyString(json['listingId']);
    if (listingId == null) {
      return null;
    }
    return FavoriteItem(
      listingId: listingId,
      propertyId: asNonEmptyString(json['propertyId']) ?? listingId,
      title: asNonEmptyString(json['title']) ?? 'Annonce',
      createdAt: DateTime.tryParse(asNonEmptyString(json['createdAt']) ?? ''),
    );
  }
}
