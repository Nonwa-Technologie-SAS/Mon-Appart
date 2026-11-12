import 'favorite_item.dart';

class FavoritesSnapshot {
  const FavoritesSnapshot({
    this.items = const [],
    this.pending = const {},
    this.queued = const {},
    this.fromCache = false,
    this.cachedAt,
  });

  final List<FavoriteItem> items;
  final Set<String> pending;
  final Set<String> queued;
  final bool fromCache;
  final DateTime? cachedAt;

  static const empty = FavoritesSnapshot();

  Set<String> get ids => {for (final item in items) item.listingId};

  bool contains(String listingId) => ids.contains(listingId);

  bool isBusy(String listingId) => pending.contains(listingId);

  bool isQueued(String listingId) => queued.contains(listingId);

  FavoritesSnapshot copyWith({
    List<FavoriteItem>? items,
    Set<String>? pending,
    Set<String>? queued,
    bool? fromCache,
    DateTime? cachedAt,
  }) {
    return FavoritesSnapshot(
      items: items ?? this.items,
      pending: pending ?? this.pending,
      queued: queued ?? this.queued,
      fromCache: fromCache ?? this.fromCache,
      cachedAt: cachedAt ?? this.cachedAt,
    );
  }
}
