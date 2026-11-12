import '../../../core/json/json_map.dart';
import '../../../core/listing/listing_type_label.dart';
import '../../../core/listing/money_format.dart';

class ListingAmenity {
  const ListingAmenity({required this.code, required this.name});

  final String code;
  final String name;

  static ListingAmenity? tryParse(Object? raw) {
    final json = asJsonMapOrNull(raw);
    if (json == null) {
      return null;
    }
    final code = asNonEmptyString(json['code']);
    final name = asNonEmptyString(json['name']);
    if (code == null) {
      return null;
    }
    return ListingAmenity(code: code, name: name ?? code);
  }
}

class ListingLocation {
  const ListingLocation({
    this.communeName,
    this.neighborhoodName,
    this.address,
    this.precision,
    this.latitude,
    this.longitude,
  });

  final String? communeName;
  final String? neighborhoodName;
  final String? address;
  final String? precision;
  final double? latitude;
  final double? longitude;

  String get label {
    final parts = <String>[?neighborhoodName, ?communeName];
    if (parts.isEmpty) {
      return 'Localisation non renseignée';
    }
    return parts.join(' · ');
  }

  bool get isApproximate => precision == 'APPROXIMATE';

  bool get isExact => precision == 'EXACT';

  /// Marqueur public : coords valides et `precision` ≠ `NONE` (contrat Nest).
  bool get hasPublicMapPoint {
    if (precision == 'NONE') {
      return false;
    }
    final lat = latitude;
    final lng = longitude;
    if (lat == null || lng == null) {
      return false;
    }
    if (lat.isNaN || lng.isNaN) {
      return false;
    }
    if (lat.abs() > 90 || lng.abs() > 180) {
      return false;
    }
    return true;
  }

  bool get hasPublicAddress => address != null && address!.isNotEmpty;

  static ListingLocation fromJson(Map<String, Object?>? json) {
    if (json == null) {
      return const ListingLocation();
    }
    final commune = asJsonMapOrNull(json['commune']);
    final neighborhood = asJsonMapOrNull(json['neighborhood']);
    return ListingLocation(
      communeName: asNonEmptyString(commune?['name']),
      neighborhoodName: asNonEmptyString(neighborhood?['name']),
      address: asNonEmptyString(json['address']),
      precision: asNonEmptyString(json['precision']),
      latitude: asDouble(json['latitude']),
      longitude: asDouble(json['longitude']),
    );
  }
}

/// Fiche `GET /api/v1/listings/:id` (vue publique).
class ListingDetail {
  const ListingDetail({
    required this.listingId,
    required this.propertyId,
    required this.title,
    required this.listingType,
    required this.status,
    required this.propertyTypeName,
    this.propertyTypeCode,
    this.propertyTitle,
    this.description,
    this.price,
    this.surface,
    this.landSurface,
    this.bedrooms,
    this.bathrooms,
    this.rooms,
    this.amenities = const [],
    this.location = const ListingLocation(),
    this.coverUrl,
    this.mediaCount = 0,
    this.publishedAt,
  });

  final String listingId;
  final String propertyId;
  final String title;
  final String listingType;
  final String status;
  final String propertyTypeName;
  final String? propertyTypeCode;
  final String? propertyTitle;
  final String? description;
  final ListingPrice? price;
  final String? surface;
  final String? landSurface;
  final int? bedrooms;
  final int? bathrooms;
  final int? rooms;
  final List<ListingAmenity> amenities;
  final ListingLocation location;
  final String? coverUrl;
  final int mediaCount;
  final DateTime? publishedAt;

  String get listingTypeLabel => ListingTypeLabel.of(listingType);

  String get priceLabel => MoneyFormat.formatPrice(price);

  bool get isLand => propertyTypeCode == 'LAND';

  bool get isPublished => status == 'PUBLISHED';

  static ListingDetail fromJson(Map<String, Object?> json) {
    final listingId = asNonEmptyString(json['id']);
    final title = asNonEmptyString(json['title']);
    final listingType = asNonEmptyString(json['listingType']);
    final property = asJsonMapOrNull(json['property']);
    final propertyId = asNonEmptyString(property?['id']);
    if (listingId == null ||
        title == null ||
        listingType == null ||
        propertyId == null) {
      throw const FormatException('Fiche annonce incomplète.');
    }
    final propertyType = asJsonMapOrNull(property?['propertyType']);
    final media = asJsonMapOrNull(json['media']);
    final amenities = <ListingAmenity>[];
    final rawAmenities = property?['amenities'];
    if (rawAmenities is List) {
      for (final raw in rawAmenities) {
        final amenity = ListingAmenity.tryParse(raw);
        if (amenity != null) {
          amenities.add(amenity);
        }
      }
    }
    return ListingDetail(
      listingId: listingId,
      propertyId: propertyId,
      title: title,
      listingType: listingType,
      status: asNonEmptyString(json['status']) ?? 'UNKNOWN',
      propertyTypeName:
          asNonEmptyString(propertyType?['name']) ??
          asNonEmptyString(propertyType?['code']) ??
          'Bien',
      propertyTypeCode: asNonEmptyString(propertyType?['code']),
      propertyTitle: asNonEmptyString(property?['title']),
      description: asNonEmptyString(json['description']),
      price: ListingPrice.tryParse(json['price']),
      surface: asNonEmptyString(property?['surface']),
      landSurface: asNonEmptyString(property?['landSurface']),
      bedrooms: asInt(property?['bedrooms']),
      bathrooms: asInt(property?['bathrooms']),
      rooms: asInt(property?['rooms']),
      amenities: amenities,
      location: ListingLocation.fromJson(asJsonMapOrNull(json['location'])),
      coverUrl: asNonEmptyString(media?['coverUrl']),
      mediaCount: asInt(media?['count']) ?? 0,
      publishedAt: DateTime.tryParse(
        asNonEmptyString(json['publishedAt']) ?? '',
      ),
    );
  }
}
