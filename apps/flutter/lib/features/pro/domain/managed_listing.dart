import '../../../core/json/json_map.dart';
import '../../../core/listing/listing_type_label.dart';
import '../../../core/listing/money_format.dart';
import '../../../core/listing/public_ids.dart';

class ManagedListing {
  const ManagedListing({
    required this.id,
    required this.propertyId,
    required this.title,
    required this.listingType,
    required this.status,
    this.description,
    this.propertyType,
    this.price,
    this.surface,
    this.bedrooms,
    this.bathrooms,
    this.communeName,
    this.neighborhoodName,
    this.coverUrl,
    this.publishedAt,
    this.expiresAt,
    this.updatedAt,
  });

  final String id;
  final String propertyId;
  final String title;
  final String listingType;
  final String status;
  final String? description;
  final String? propertyType;
  final ListingPrice? price;
  final int? surface;
  final int? bedrooms;
  final int? bathrooms;
  final String? communeName;
  final String? neighborhoodName;
  final String? coverUrl;
  final DateTime? publishedAt;
  final DateTime? expiresAt;
  final DateTime? updatedAt;

  String get listingTypeLabel => ListingTypeLabel.of(listingType);

  String get priceLabel => MoneyFormat.formatPrice(price);

  String get locationLabel {
    final parts = <String>[?neighborhoodName, ?communeName];
    if (parts.isEmpty) {
      return 'Localisation non renseignée';
    }
    return parts.join(' · ');
  }

  static ManagedListing? tryParse(Object? raw) {
    final json = asJsonMapOrNull(raw);
    if (json == null) {
      return null;
    }
    final id = asNonEmptyString(json['id']);
    final title = asNonEmptyString(json['title']);
    final listingType = asNonEmptyString(json['listingType']);
    final property = asJsonMapOrNull(json['property']);
    final propertyId = asNonEmptyString(property?['id']);
    if (id == null ||
        !PublicIds.isUuid(id) ||
        title == null ||
        listingType == null ||
        propertyId == null ||
        !PublicIds.isUuid(propertyId)) {
      return null;
    }
    final location = asJsonMapOrNull(json['location']);
    final commune = asJsonMapOrNull(location?['commune']);
    final neighborhood = asJsonMapOrNull(location?['neighborhood']);
    final media = asJsonMapOrNull(json['media']);
    final rawType = property?['propertyType'];
    String? propertyType;
    if (rawType is String) {
      propertyType = asNonEmptyString(rawType);
    } else {
      final typeMap = asJsonMapOrNull(rawType);
      propertyType =
          asNonEmptyString(typeMap?['name']) ??
          asNonEmptyString(typeMap?['code']);
    }
    return ManagedListing(
      id: id,
      propertyId: propertyId,
      title: title,
      listingType: listingType,
      status: asNonEmptyString(json['status']) ?? 'DRAFT',
      description: asNonEmptyString(json['description']),
      propertyType: propertyType,
      price: ListingPrice.tryParse(json['price']),
      surface:
          asInt(property?['surface']) ?? _asIntString(property?['surface']),
      bedrooms: asInt(property?['bedrooms']),
      bathrooms: asInt(property?['bathrooms']),
      communeName: asNonEmptyString(commune?['name']),
      neighborhoodName: asNonEmptyString(neighborhood?['name']),
      coverUrl:
          asNonEmptyString(json['coverUrl']) ??
          asNonEmptyString(media?['coverUrl']),
      publishedAt: DateTime.tryParse(
        asNonEmptyString(json['publishedAt']) ?? '',
      ),
      expiresAt: DateTime.tryParse(asNonEmptyString(json['expiresAt']) ?? ''),
      updatedAt: DateTime.tryParse(asNonEmptyString(json['updatedAt']) ?? ''),
    );
  }

  static int? _asIntString(Object? value) {
    if (value is String) {
      return num.tryParse(value)?.round();
    }
    return null;
  }
}
