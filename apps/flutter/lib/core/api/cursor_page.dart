/// Pagination curseur opaque, alignée sur Nest `{ items, nextCursor }`.
class CursorPage<T> {
  const CursorPage({required this.items, this.nextCursor});

  final List<T> items;
  final String? nextCursor;

  bool get hasMore => nextCursor != null && nextCursor!.isNotEmpty;

  static CursorPage<T> fromJson<T>(
    Map<String, Object?> json,
    T Function(Map<String, Object?> item) parseItem,
  ) {
    final rawItems = json['items'];
    if (rawItems is! List) {
      throw const FormatException('Pagination : champ "items" manquant.');
    }

    final items = <T>[];
    for (final raw in rawItems) {
      if (raw is! Map) {
        throw const FormatException('Pagination : élément non objet.');
      }
      items.add(parseItem(Map<String, Object?>.from(raw)));
    }

    final cursor = json['nextCursor'];
    return CursorPage<T>(
      items: items,
      nextCursor: cursor is String && cursor.isNotEmpty ? cursor : null,
    );
  }
}
