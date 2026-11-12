import '../../../core/json/json_map.dart';
import '../../../core/listing/public_ids.dart';

class ManagedProperty {
  const ManagedProperty({
    required this.id,
    required this.title,
    required this.propertyTypeCode,
    this.propertyTypeName,
    this.propertyCategory,
    this.description,
    this.status,
    this.communeCode,
    this.neighborhoodCode,
    this.address,
    this.latitude,
    this.longitude,
    this.locationVisibility,
    this.surface,
    this.landSurface,
    this.bedrooms,
    this.bathrooms,
    this.rooms,
    this.floor,
    this.totalFloors,
    this.yearBuilt,
    this.attributes = const {},
    this.amenityCodes = const [],
    this.missingCompleteness = const [],
  });

  final String id;
  final String title;
  final String propertyTypeCode;
  final String? propertyTypeName;
  final String? propertyCategory;
  final String? description;
  final String? status;
  final String? communeCode;
  final String? neighborhoodCode;
  final String? address;
  final double? latitude;
  final double? longitude;
  final String? locationVisibility;
  final num? surface;
  final num? landSurface;
  final int? bedrooms;
  final int? bathrooms;
  final int? rooms;
  final int? floor;
  final int? totalFloors;
  final int? yearBuilt;
  final Map<String, Object?> attributes;
  final List<String> amenityCodes;
  final List<String> missingCompleteness;

  static ManagedProperty? tryParse(Object? raw) {
    final json = asJsonMapOrNull(raw);
    if (json == null) {
      return null;
    }
    final id = asNonEmptyString(json['id']);
    final title = asNonEmptyString(json['title']);
    if (id == null || !PublicIds.isUuid(id) || title == null) {
      return null;
    }
    final type = asJsonMapOrNull(json['propertyType']);
    final typeCode =
        asNonEmptyString(type?['code']) ??
        asNonEmptyString(json['propertyType']);
    if (typeCode == null) {
      return null;
    }
    final location = asJsonMapOrNull(json['location']);
    final commune = asJsonMapOrNull(location?['commune']);
    final neighborhood = asJsonMapOrNull(location?['neighborhood']);
    final completeness = asJsonMapOrNull(json['completeness']);
    final missing = <String>[];
    final rawMissing = completeness?['missing'];
    if (rawMissing is List) {
      for (final item in rawMissing) {
        if (item is String && item.isNotEmpty) {
          missing.add(item);
        }
      }
    }
    final amenities = <String>[];
    final rawAmenities = json['amenities'];
    if (rawAmenities is List) {
      for (final raw in rawAmenities) {
        if (raw is String && raw.isNotEmpty) {
          amenities.add(raw);
        } else {
          final map = asJsonMapOrNull(raw);
          final code = asNonEmptyString(map?['code']);
          if (code != null) {
            amenities.add(code);
          }
        }
      }
    }
    final attributesRaw = asJsonMapOrNull(json['attributes']) ?? const {};
    return ManagedProperty(
      id: id,
      title: title,
      propertyTypeCode: typeCode,
      propertyTypeName: asNonEmptyString(type?['name']),
      propertyCategory: asNonEmptyString(type?['category']),
      description: asNonEmptyString(json['description']),
      status: asNonEmptyString(json['status']),
      communeCode: asNonEmptyString(commune?['code']),
      neighborhoodCode: asNonEmptyString(neighborhood?['code']),
      address: asNonEmptyString(location?['address']),
      latitude: asDouble(location?['latitude']),
      longitude: asDouble(location?['longitude']),
      locationVisibility: asNonEmptyString(json['locationVisibility']),
      surface: asNum(json['surface']),
      landSurface: asNum(json['landSurface']),
      bedrooms: asInt(json['bedrooms']),
      bathrooms: asInt(json['bathrooms']),
      rooms: asInt(json['rooms']),
      floor: asInt(json['floor']),
      totalFloors: asInt(json['totalFloors']),
      yearBuilt: asInt(json['yearBuilt']),
      attributes: attributesRaw,
      amenityCodes: amenities,
      missingCompleteness: missing,
    );
  }
}

class ListingHistoryNote {
  const ListingHistoryNote({required this.status, this.reason, this.at});

  final String status;
  final String? reason;
  final DateTime? at;

  static List<ListingHistoryNote> parse(Map<String, Object?> json) {
    final raw = json['statuses'];
    if (raw is! List) {
      return const [];
    }
    final notes = <ListingHistoryNote>[];
    for (final item in raw) {
      final map = asJsonMapOrNull(item);
      if (map == null) {
        continue;
      }
      final status = asNonEmptyString(map['newStatus']);
      if (status == null) {
        continue;
      }
      notes.add(
        ListingHistoryNote(
          status: status,
          reason: asNonEmptyString(map['reason']),
          at: DateTime.tryParse(asNonEmptyString(map['createdAt']) ?? ''),
        ),
      );
    }
    return notes;
  }
}
