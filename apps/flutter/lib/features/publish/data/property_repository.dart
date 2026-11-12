import '../../../app/config/api_endpoints.dart';
import '../../../core/api/api_client.dart';
import '../../../core/auth/session_store.dart';
import '../../../core/errors/app_failure.dart';
import '../../../core/listing/public_ids.dart';
import '../domain/managed_property.dart';
import '../domain/publish_draft.dart';

class PropertyRepository {
  PropertyRepository({
    required this.client,
    required this.endpoints,
    required this.sessionStore,
  });

  final ApiClient client;
  final ApiEndpoints endpoints;
  final SessionStore sessionStore;

  Future<void> _requireSession() async {
    final token = await sessionStore.readAccessToken();
    if (token == null || token.isEmpty) {
      throw const NeedsAuthFailure();
    }
  }

  Future<ManagedProperty> create(PublishDraft draft) async {
    await _requireSession();
    final json = await client.postJson(
      endpoints.properties(),
      body: _propertyBody(draft, creating: true),
    );
    return _parse(json);
  }

  Future<ManagedProperty> getById(String propertyId) async {
    await _requireSession();
    if (!PublicIds.isUuid(propertyId)) {
      throw const InvalidPropertyIdFailure();
    }
    try {
      final json = await client.getJson(endpoints.property(propertyId));
      return _parse(json);
    } on HttpFailure catch (error) {
      if (error.isNotFound) {
        throw ListingUnavailableFailure(requestId: error.requestId);
      }
      rethrow;
    }
  }

  Future<ManagedProperty> update(PublishDraft draft) async {
    await _requireSession();
    final id = draft.propertyId;
    if (id == null || !PublicIds.isUuid(id)) {
      throw const InvalidPropertyIdFailure();
    }
    final json = await client.patchJson(
      endpoints.property(id),
      body: _propertyBody(draft, creating: false),
    );
    return _parse(json);
  }

  Future<ManagedProperty> setStatus(String propertyId, String status) async {
    await _requireSession();
    if (!PublicIds.isUuid(propertyId)) {
      throw const InvalidPropertyIdFailure();
    }
    final json = await client.patchJson(
      endpoints.property(propertyId),
      body: {'status': status},
    );
    return _parse(json);
  }

  Future<void> replaceAmenities(
    String propertyId,
    List<String> amenityCodes,
  ) async {
    await _requireSession();
    if (!PublicIds.isUuid(propertyId)) {
      throw const InvalidPropertyIdFailure();
    }
    await client.putJson(
      endpoints.propertyAmenities(propertyId),
      body: {'amenities': amenityCodes},
    );
  }

  Map<String, Object?> _propertyBody(
    PublishDraft draft, {
    required bool creating,
  }) {
    final body = <String, Object?>{
      'propertyType': draft.propertyType,
      'commune': draft.communeCode,
      'neighborhood': draft.neighborhoodCode,
      'title': draft.title.trim(),
      'locationVisibility': draft.locationVisibility,
      'attributes': draft.attributes,
    };
    if (creating && draft.amenityCodes.isNotEmpty) {
      body['amenities'] = draft.amenityCodes;
    }
    final description = draft.description.trim();
    body['description'] = description.isEmpty ? null : description;
    final address = draft.address.trim();
    body['address'] = address.isEmpty ? null : address;
    body['latitude'] = draft.latitude;
    body['longitude'] = draft.longitude;
    if (draft.isLand) {
      body['landSurface'] = draft.landSurface;
      body['surface'] = null;
      body['bedrooms'] = null;
      body['bathrooms'] = null;
      body['rooms'] = null;
      body['floor'] = null;
      body['totalFloors'] = null;
    } else {
      body['surface'] = draft.surface;
      body['landSurface'] = draft.landSurface;
      body['bedrooms'] = draft.bedrooms;
      body['bathrooms'] = draft.bathrooms;
      body['rooms'] = draft.rooms;
      body['floor'] = draft.floor;
      body['totalFloors'] = draft.totalFloors;
    }
    body['yearBuilt'] = draft.yearBuilt;
    return body;
  }

  ManagedProperty _parse(Map<String, Object?> json) {
    final property = ManagedProperty.tryParse(json);
    if (property == null) {
      throw const ParsingFailure(message: 'Réponse de bien inattendue.');
    }
    return property;
  }
}
