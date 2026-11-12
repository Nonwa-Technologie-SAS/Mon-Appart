import '../../../core/json/json_map.dart';

class ListingMediaItem {
  const ListingMediaItem({
    required this.id,
    required this.type,
    required this.sortOrder,
    this.cardUrl,
    this.fullUrl,
    this.isPrimary = false,
  });

  final String id;
  final String type;
  final int sortOrder;
  final String? cardUrl;
  final String? fullUrl;
  final bool isPrimary;

  bool get isImage => type == 'IMAGE';

  String? get previewUrl => cardUrl ?? fullUrl;

  String? get viewerUrl => fullUrl ?? cardUrl;

  static ListingMediaItem? tryParse(Object? raw) {
    final json = asJsonMapOrNull(raw);
    if (json == null) {
      return null;
    }
    final id = asNonEmptyString(json['id']);
    if (id == null) {
      return null;
    }
    String? galleryUrl;
    final variants = json['variants'];
    if (variants is List) {
      for (final variant in variants) {
        final map = asJsonMapOrNull(variant);
        if (map != null && asNonEmptyString(map['kind']) == 'GALLERY') {
          galleryUrl = asNonEmptyString(map['url']);
        }
      }
    }
    return ListingMediaItem(
      id: id,
      type: asNonEmptyString(json['type']) ?? 'IMAGE',
      sortOrder: asInt(json['sortOrder']) ?? 0,
      cardUrl: asNonEmptyString(json['url']),
      fullUrl: galleryUrl ?? asNonEmptyString(json['url']),
      isPrimary: json['isPrimary'] == true,
    );
  }
}

class ListingMediaPage {
  const ListingMediaPage({required this.items});

  final List<ListingMediaItem> items;

  List<ListingMediaItem> get images {
    final photos = [
      for (final item in items)
        if (item.isImage && item.previewUrl != null) item,
    ];
    photos.sort((a, b) => a.sortOrder.compareTo(b.sortOrder));
    return photos;
  }

  static ListingMediaPage fromJson(Map<String, Object?> json) {
    final rawItems = json['items'];
    final items = <ListingMediaItem>[];
    if (rawItems is List) {
      for (final raw in rawItems) {
        final item = ListingMediaItem.tryParse(raw);
        if (item != null) {
          items.add(item);
        }
      }
    }
    return ListingMediaPage(items: items);
  }
}
