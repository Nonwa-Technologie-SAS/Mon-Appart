import '../../../app/config/api_endpoints.dart';
import '../../../core/api/api_client.dart';
import '../../../core/api/cursor_page.dart';
import '../../../core/auth/session_store.dart';
import '../../../core/errors/app_failure.dart';
import '../../../core/listing/public_ids.dart';
import '../domain/managed_listing.dart';

class ProListingsRepository {
  ProListingsRepository({
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

  Future<CursorPage<ManagedListing>> list({
    String? cursor,
    String? status,
    String? listingType,
    int limit = 20,
  }) async {
    await _requireSession();
    final json = await client.getJson(
      endpoints.listings(),
      query: {
        'scope': 'mine',
        'limit': '$limit',
        if (cursor != null && cursor.isNotEmpty) 'cursor': cursor,
        if (status != null && status.isNotEmpty) 'status': status,
        if (listingType != null && listingType.isNotEmpty)
          'listingType': listingType,
      },
    );
    try {
      return CursorPage.fromJson(json, (item) {
        final listing = ManagedListing.tryParse(item);
        if (listing == null) {
          throw const FormatException('Annonce gérée inattendue.');
        }
        return listing;
      });
    } on FormatException {
      throw const ParsingFailure(message: 'Liste d\'annonces inattendue.');
    }
  }

  Future<ManagedListing> publish(String listingId) {
    return _post(listingId, endpoints.listingPublish(listingId), const {});
  }

  Future<ManagedListing> pause(String listingId) {
    return _post(listingId, endpoints.listingPause(listingId), const {});
  }

  Future<ManagedListing> changeStatus(String listingId, String status) {
    return _post(listingId, endpoints.listingStatus(listingId), {
      'status': status,
    });
  }

  Future<ManagedListing> getById(String listingId) async {
    await _requireSession();
    if (!PublicIds.isUuid(listingId)) {
      throw const InvalidListingIdFailure();
    }
    try {
      final json = await client.getJson(endpoints.listing(listingId));
      return _parseListing(json);
    } on HttpFailure catch (error) {
      if (error.isNotFound) {
        throw ListingUnavailableFailure(requestId: error.requestId);
      }
      rethrow;
    }
  }

  Future<ManagedListing> create({
    required String propertyId,
    required String listingType,
    String? title,
    String? description,
    int? amount,
    String? period,
  }) async {
    await _requireSession();
    if (!PublicIds.isUuid(propertyId)) {
      throw const InvalidPropertyIdFailure();
    }
    final body = <String, Object?>{
      'propertyId': propertyId,
      'listingType': listingType,
      if (title != null && title.trim().isNotEmpty) 'title': title.trim(),
      'description': ?description,
    };
    if (amount != null && period != null) {
      body['price'] = {'amount': amount, 'period': period, 'currency': 'XOF'};
    }
    final json = await client.postJson(endpoints.listings(), body: body);
    return _parseListing(json);
  }

  Future<ManagedListing> update({
    required String listingId,
    required String title,
    String? description,
  }) async {
    await _requireSession();
    if (!PublicIds.isUuid(listingId)) {
      throw const InvalidListingIdFailure();
    }
    final json = await client.patchJson(
      endpoints.listing(listingId),
      body: {'title': title.trim(), 'description': description},
    );
    return _parseListing(json);
  }

  Future<ManagedListing> changePrice({
    required String listingId,
    required int amount,
    required String period,
  }) async {
    await _requireSession();
    if (!PublicIds.isUuid(listingId)) {
      throw const InvalidListingIdFailure();
    }
    final json = await client.putJson(
      endpoints.listingPrice(listingId),
      body: {'amount': amount, 'period': period, 'currency': 'XOF'},
    );
    return _parseListing(json);
  }

  Future<List<String>> moderationNotes(String listingId) async {
    await _requireSession();
    if (!PublicIds.isUuid(listingId)) {
      throw const InvalidListingIdFailure();
    }
    final json = await client.getJson(endpoints.listingHistory(listingId));
    final notes = <String>[];
    final statuses = json['statuses'];
    if (statuses is List) {
      for (final raw in statuses) {
        if (raw is! Map) {
          continue;
        }
        final reason = raw['reason'];
        if (reason is String && reason.trim().isNotEmpty) {
          notes.add(reason.trim());
        }
      }
    }
    return notes.reversed.toList();
  }

  Future<ManagedListing> _post(
    String listingId,
    Uri uri,
    Map<String, Object?> body,
  ) async {
    await _requireSession();
    if (!PublicIds.isUuid(listingId)) {
      throw const InvalidListingIdFailure();
    }
    try {
      final json = await client.postJson(uri, body: body);
      return _parseListing(json);
    } on HttpFailure catch (error) {
      if (error.isNotFound) {
        throw ListingUnavailableFailure(requestId: error.requestId);
      }
      rethrow;
    }
  }

  ManagedListing _parseListing(Map<String, Object?> json) {
    final listing = ManagedListing.tryParse(json);
    if (listing == null) {
      throw const ParsingFailure(message: 'Réponse d\'annonce inattendue.');
    }
    return listing;
  }
}
