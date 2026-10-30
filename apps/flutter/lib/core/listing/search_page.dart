import '../json/json_map.dart';
import 'listing_summary.dart';

/// Page `GET /search` : items + pagination curseur + total optionnel.
class SearchPage {
  const SearchPage({
    required this.items,
    this.nextCursor,
    this.hasMore = false,
    this.totalValue,
    this.totalStrategy,
  });

  final List<ListingSummary> items;
  final String? nextCursor;
  final bool hasMore;

  /// Présent seulement si `strategy` est `exact` ou `estimated`.
  final int? totalValue;
  final String? totalStrategy;

  /// Libellé public. Null si le backend n'a pas calculé le total.
  String? get totalLabel {
    final value = totalValue;
    if (value == null) {
      return null;
    }
    return switch (totalStrategy) {
      'exact' => value <= 1 ? '$value annonce' : '$value annonces',
      'estimated' => 'Au moins $value annonces',
      _ => null,
    };
  }

  static SearchPage fromJson(Map<String, Object?> json) {
    final rawItems = json['items'];
    final items = <ListingSummary>[];
    if (rawItems is List) {
      for (final raw in rawItems) {
        final listing = ListingSummary.tryFromJson(raw);
        if (listing != null) {
          items.add(listing);
        }
      }
    }
    final pagination = asJsonMapOrNull(json['pagination']);
    final cursor = asNonEmptyString(pagination?['nextCursor']);
    final total = asJsonMapOrNull(json['total']);
    final strategy = asNonEmptyString(total?['strategy']);
    final totalValue = asInt(total?['value']);
    return SearchPage(
      items: items,
      nextCursor: cursor,
      hasMore: pagination?['hasMore'] == true,
      totalValue: strategy == 'not_available' ? null : totalValue,
      totalStrategy: strategy,
    );
  }
}
