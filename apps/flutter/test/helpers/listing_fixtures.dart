import 'package:mon_appart/core/errors/app_failure.dart';

import 'messaging_fixtures.dart';
import 'pro_fixtures.dart';
import 'visit_fixtures.dart';

Map<String, Object?> listingJson({
  String id = '11111111-1111-1111-1111-111111111111',
  String title = 'Appartement 2 chambres à Cocody',
  String listingType = 'RENT',
  Object? price = const {
    'amount': 250000,
    'currency': 'XOF',
    'period': 'MONTH',
  },
  String? mainImage,
  int? bedrooms = 2,
  int? bathrooms = 1,
  int? surface = 75,
  double? latitude,
  double? longitude,
  String precision = 'NONE',
  Object? distance,
}) {
  return {
    'listingId': id,
    'propertyId': '22222222-2222-2222-2222-222222222222',
    'title': title,
    'listingType': listingType,
    'propertyType': {'code': 'APARTMENT', 'name': 'Appartement'},
    'price': price,
    'surface': surface,
    'landSurface': null,
    'bedrooms': bedrooms,
    'bathrooms': bathrooms,
    'location': {
      'city': {'code': 'ABIDJAN', 'name': 'Abidjan'},
      'commune': {'code': 'COCODY', 'name': 'Cocody'},
      'neighborhood': {'code': 'RIVIERA', 'name': 'Riviera'},
      'latitude': latitude,
      'longitude': longitude,
      'precision': precision,
    },
    'mainImage': mainImage,
    'score': null,
    'distance': distance,
    'publishedAt': '2026-10-20T10:00:00.000Z',
  };
}

Map<String, Object?> searchResponseJson({
  List<Map<String, Object?>>? items,
  String? nextCursor,
  bool hasMore = false,
  Object? total,
}) {
  return {
    'items': items ?? [listingJson()],
    'pagination': {'nextCursor': nextCursor, 'hasMore': hasMore, 'limit': 20},
    'total': total ?? {'value': items?.length ?? 1, 'strategy': 'exact'},
    'meta': {
      'sort': 'NEWEST',
      'engine': 'postgres',
      'degraded': false,
      'fuzzy': false,
    },
  };
}

Map<String, Object?> recommendationResponseJson({
  String level = 'GENERIC',
  List<Map<String, Object?>>? listings,
}) {
  final resolved = listings ?? [listingJson(title: 'Villa à Marcory')];
  return {
    'items': [
      for (final listing in resolved)
        {
          'id': null,
          'context': 'HOME',
          'score': 40,
          'reasons': <Map<String, Object?>>[],
          'listing': listing,
          'generatedAt': '2026-10-20T10:00:00.000Z',
        },
    ],
    'pagination': {'nextCursor': null, 'hasMore': false, 'limit': 8},
    'meta': {
      'context': 'HOME',
      'level': level,
      'algorithmVersion': 'rules-v1',
      'degraded': false,
      'requestId': '33333333-3333-3333-3333-333333333333',
    },
  };
}

Map<String, Object?> listingDetailJson({
  String id = '11111111-1111-1111-1111-111111111111',
  String propertyId = '22222222-2222-2222-2222-222222222222',
  String title = 'Appartement 2 chambres à Cocody',
  String listingType = 'RENT',
  String status = 'PUBLISHED',
  String? description = 'Appartement lumineux à Riviera, proche des écoles.',
  Object? price = const {
    'amount': '250000',
    'currency': 'XOF',
    'period': 'MONTH',
  },
  String? coverUrl = 'https://cdn.example/cover.jpg',
  int mediaCount = 1,
  String propertyTypeCode = 'APARTMENT',
  String propertyTypeName = 'Appartement',
  Object? surface = '75',
  Object? landSurface,
  int? bedrooms = 2,
  int? bathrooms = 1,
  List<Map<String, Object?>>? amenities,
  double? latitude = 5.36,
  double? longitude = -3.98,
  String precision = 'APPROXIMATE',
}) {
  return {
    'id': id,
    'listingType': listingType,
    'status': status,
    'title': title,
    'description': description,
    'price': price,
    'property': {
      'id': propertyId,
      'title': propertyTypeName,
      'propertyType': {
        'code': propertyTypeCode,
        'name': propertyTypeName,
        'category': propertyTypeCode == 'LAND' ? 'LAND' : 'RESIDENTIAL',
      },
      'surface': surface,
      'landSurface': landSurface,
      'bedrooms': bedrooms,
      'bathrooms': bathrooms,
      'rooms': bedrooms == null ? null : (bedrooms + 1),
      'amenities':
          amenities ??
          [
            {'code': 'PARKING', 'name': 'Parking', 'category': 'EXTERIOR'},
          ],
    },
    'location': {
      'commune': {'code': 'COCODY', 'name': 'Cocody'},
      'neighborhood': {'code': 'RIVIERA', 'name': 'Riviera'},
      'latitude': latitude,
      'longitude': longitude,
      'precision': precision,
      'address': null,
    },
    'media': {'count': mediaCount, 'coverUrl': coverUrl},
    'publishedAt': '2026-10-20T10:00:00.000Z',
    'expiresAt': null,
  };
}

Map<String, Object?> listingMediaJson({
  String url = 'https://cdn.example/photo.jpg',
}) {
  return {
    'items': [
      {
        'id': '44444444-4444-4444-4444-444444444444',
        'propertyId': '22222222-2222-2222-2222-222222222222',
        'type': 'IMAGE',
        'status': 'READY',
        'visibility': 'PUBLIC',
        'mimeType': 'image/jpeg',
        'fileSize': 120000,
        'width': 1200,
        'height': 800,
        'durationMs': null,
        'sortOrder': 0,
        'isPrimary': true,
        'url': url,
        'variants': [
          {
            'kind': 'GALLERY',
            'url': 'https://cdn.example/photo-lg.jpg',
            'width': 1600,
            'height': 1000,
          },
        ],
        'createdAt': '2026-10-20T10:00:00.000Z',
        'readyAt': '2026-10-20T10:00:00.000Z',
      },
    ],
  };
}

Map<String, Object?> listingBadgesJson({
  List<Map<String, Object?>> badges = const [],
}) {
  return {
    'listingId': '11111111-1111-1111-1111-111111111111',
    'badges': badges,
    'publisherBadges': <Map<String, Object?>>[],
    'verificationInProgress': false,
    'disclaimer': 'Ces indications résultent d\'un examen des pièces fournies.',
  };
}

Map<String, Object?> emptyHousingPreferencesJson() {
  return {
    'listingTypes': <String>[],
    'propertyTypes': <String>[],
    'communes': <String>[],
    'neighborhoods': <String>[],
    'amenities': <String>[],
    'bedrooms': null,
    'bathrooms': null,
    'budget': {
      'min': null,
      'max': null,
      'currency': 'XOF',
      'period': null,
      'tolerancePct': 0,
    },
    'surface': {'min': null, 'max': null},
    'point': null,
    'updatedAt': null,
  };
}

Map<String, Object?> favoriteItemJson({
  String listingId = '11111111-1111-1111-1111-111111111111',
  String title = 'Appartement 2 chambres à Cocody',
}) {
  return {
    'listingId': listingId,
    'propertyId': '22222222-2222-2222-2222-222222222222',
    'title': title,
    'createdAt': '2026-10-20T10:00:00.000Z',
  };
}

Map<String, Object?> savedSearchJson({
  String id = 'cccccccc-cccc-cccc-cccc-cccccccccccc',
  String name = 'Appartements à louer à Cocody',
  Map<String, String> params = const {
    'listingType': 'RENT',
    'commune': 'COCODY',
    'minPrice': '150000',
  },
  bool alertsEnabled = true,
  String frequency = 'DAILY',
}) {
  return {
    'id': id,
    'name': name,
    'params': params,
    'alertsEnabled': alertsEnabled,
    'frequency': frequency,
    'currency': 'XOF',
    'listingType': params['listingType'],
    'minPrice': int.tryParse(params['minPrice'] ?? ''),
    'maxPrice': int.tryParse(params['maxPrice'] ?? ''),
  };
}

Map<String, Object?> inboxNotificationJson({
  String id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
  String title = 'Nouvelles annonces pour votre recherche',
  String body = '1 annonce(s) pour « Cocody ».',
  String type = 'NEW_PROPERTY',
  String category = 'SAVED_SEARCHES',
  String? listingId,
  List<String>? listingIds,
  String? savedSearchId,
  String? conversationId,
  String? appointmentId,
  String? readAt,
}) {
  return {
    'id': id,
    'type': type,
    'category': category,
    'title': title,
    'body': body,
    'createdAt': '2026-10-20T10:00:00.000Z',
    'readAt': readAt,
    'data': {
      'listingId': ?listingId,
      'listingIds': ?listingIds,
      'savedSearchId': ?savedSearchId,
      'conversationId': ?conversationId,
      'appointmentId': ?appointmentId,
    },
  };
}

Map<String, Object?> assistantTurnJson({
  String mode = 'results',
  String message = 'Voici des annonces correspondant à votre demande.',
  String conversationId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  List<Map<String, Object?>>? listings,
  List<String>? suggestions,
  Map<String, String>? searchParams,
  Map<String, Object?>? criteria,
  String provider = 'rules',
}) {
  return {
    'mode': mode,
    'message': message,
    'conversationId': conversationId,
    'criteria':
        criteria ??
        {
          'listingTypes': ['RENT'],
          'propertyTypes': ['HOUSE'],
          'communes': ['Cocody'],
          'neighborhoods': <String>[],
          'cities': ['Abidjan'],
          'priceMin': null,
          'priceMax': 250000,
          'currency': 'XOF',
          'pricePeriod': 'MONTH',
          'bedroomsMin': 3,
          'bathroomsMin': null,
          'surfaceMin': null,
          'surfaceMax': null,
          'amenities': <String>[],
          'softPreferences': <String>[],
          'unverifiableHints': <String>[],
          'missing': <String>[],
          'clarificationQuestion': null,
          'freeText': null,
          'acceptSearchWithoutBudget': false,
          'acceptCityWide': false,
          'confidence': 0.8,
        },
    'searchParams':
        searchParams ??
        {
          'listingType': 'RENT',
          'propertyType': 'HOUSE',
          'commune': 'Cocody',
          'maxPrice': '250000',
          'bedrooms': '3',
          'limit': '12',
          'sort': 'NEWEST',
        },
    'listings':
        listings ??
        [
          {
            'listingId': '11111111-1111-1111-1111-111111111111',
            'propertyId': '22222222-2222-2222-2222-222222222222',
            'title': 'Maison 3 chambres à Cocody',
            'listingType': 'RENT',
            'propertyType': {'code': 'HOUSE', 'name': 'Maison'},
            'price': {'amount': 250000, 'currency': 'XOF', 'period': 'MONTH'},
            'surface': 120,
            'bedrooms': 3,
            'bathrooms': 2,
            'locationLabel': 'Riviera, Cocody, Abidjan',
            'mainImage': null,
            'matchReasons': ['Dans votre budget maximum', 'Commune : Cocody'],
          },
        ],
    'suggestions':
        suggestions ??
        [
          'Affiner le budget',
          'Changer de commune',
          'Ouvrir la recherche classique',
        ],
    'provider': provider,
    'promptVersion': 'assistant-reply-v1',
  };
}

Map<String, Object?> catalogHandler(
  Uri uri, {
  Map<String, Object?>? search,
  Map<String, Object?>? recommendations,
  Map<String, Object?>? listing,
  Map<String, Object?>? media,
  Map<String, Object?>? badges,
}) {
  if (uri.path.contains('/ai-assistant/')) {
    throw const HttpFailure(
      statusCode: 503,
      code: 'ASSISTANT_DISABLED',
      message: 'Assistant non simulé dans ce test.',
    );
  }
  if (uri.path.contains('/recommendations/similar/')) {
    return recommendations ??
        recommendationResponseJson(listings: <Map<String, Object?>>[]);
  }
  if (uri.path.endsWith('/recommendations/preferences')) {
    return emptyHousingPreferencesJson();
  }
  if (uri.path.endsWith('/recommendations')) {
    return recommendations ??
        recommendationResponseJson(listings: <Map<String, Object?>>[]);
  }
  if (uri.path.endsWith('/search')) {
    return search ?? searchResponseJson(items: <Map<String, Object?>>[]);
  }
  if (uri.path.endsWith('/health/live')) {
    return {'status': 'ok', 'service': 'api'};
  }
  if (uri.path.contains('/trust/listings/') && uri.path.endsWith('/badges')) {
    return badges ?? listingBadgesJson();
  }
  if (uri.path.contains('/properties/') && uri.path.endsWith('/media')) {
    return media ?? listingMediaJson();
  }
  if (uri.path.contains('/interactions/views')) {
    return const {};
  }
  if (uri.path.endsWith('/interactions/favorites')) {
    return const {'items': <Map<String, Object?>>[]};
  }
  if (uri.path.contains('/interactions/favorites/')) {
    return const {'favorited': false};
  }
  if (uri.path.endsWith('/saved-searches')) {
    return const {'items': <Map<String, Object?>>[]};
  }
  if (uri.path.contains('/saved-searches/') && uri.path.endsWith('/resume')) {
    return const {'params': <String, String>{}, 'resumePath': '/search'};
  }
  if (uri.path.contains('/saved-searches/')) {
    final id = uri.pathSegments.isEmpty
        ? 'cccccccc-cccc-cccc-cccc-cccccccccccc'
        : uri.pathSegments.last;
    return {
      'id': id,
      'name': 'Recherche enregistrée',
      'params': const <String, String>{},
      'alertsEnabled': false,
      'frequency': 'DAILY',
      'currency': 'XOF',
    };
  }
  if (uri.path.endsWith('/notifications/unread-count')) {
    return const {'unread': 0};
  }
  if (uri.path.endsWith('/notifications/read-all')) {
    return const {'updated': 0};
  }
  if (uri.path.contains('/notifications/') && uri.path.endsWith('/read')) {
    return const {};
  }
  if (uri.path.endsWith('/notifications')) {
    return const {'items': <Map<String, Object?>>[], 'unread': 0};
  }
  if (uri.path.contains('/push-devices')) {
    return {
      'id': 'dddddddd-dddd-dddd-dddd-dddddddddddd',
      'platform': 'ANDROID',
      'lastSeenAt': '2026-10-20T10:00:00.000Z',
      'createdAt': '2026-10-20T10:00:00.000Z',
    };
  }
  if (uri.path.endsWith('/notification-preferences')) {
    return const {'items': <Map<String, Object?>>[]};
  }
  if (uri.path.contains('/auth/')) {
    throw const HttpFailure(
      statusCode: 401,
      code: 'UNAUTHENTICATED',
      message: 'Session expirée ou absente.',
    );
  }
  if (uri.path.endsWith('/conversations/unread-count')) {
    return const {'unread': 0};
  }
  if (uri.path.contains('/conversations/') && uri.path.endsWith('/messages')) {
    return messagePageJson();
  }
  if (uri.path.contains('/conversations/') && uri.path.endsWith('/read')) {
    return const {'lastReadSeq': 1, 'unread': 0};
  }
  if (uri.path.contains('/conversations/') && uri.path.endsWith('/report')) {
    return conversationReportJson();
  }
  if (uri.path.contains('/conversations/') &&
      (uri.path.endsWith('/archive') || uri.path.endsWith('/mute'))) {
    return conversationJson();
  }
  if (RegExp(r'/conversations/[0-9a-fA-F-]{36}$').hasMatch(uri.path)) {
    final id = uri.pathSegments.isEmpty
        ? testConversationId
        : uri.pathSegments.last;
    return conversationJson(id: id);
  }
  if (uri.path.endsWith('/conversations')) {
    return conversationPageJson(items: const []);
  }
  if (uri.path.endsWith('/inquiries/dashboard')) {
    return inquiryDashboardJson();
  }
  if (uri.path.contains('/inquiries/') && uri.path.endsWith('/notes')) {
    return inquiryJson();
  }
  if (RegExp(r'/inquiries/[0-9a-fA-F-]{36}$').hasMatch(uri.path)) {
    final id = uri.pathSegments.isEmpty ? testInquiryId : uri.pathSegments.last;
    return inquiryJson(id: id);
  }
  if (uri.path.endsWith('/inquiries')) {
    return inquiryPageJson(items: const []);
  }
  if (uri.path.endsWith('/analytics/me/listings')) {
    return listingStatsPageJson();
  }
  if (uri.path.contains('/listings/') &&
      (uri.path.endsWith('/publish') ||
          uri.path.endsWith('/pause') ||
          uri.path.endsWith('/status'))) {
    return managedListingJson(status: 'PUBLISHED');
  }
  if (uri.path.endsWith('/listings')) {
    return managedListingPageJson(items: const []);
  }
  if (uri.path.contains('/appointments/')) {
    if (RegExp(r'/(confirm|reschedule|cancel|complete|no-show|feedback)$')
        .hasMatch(uri.path)) {
      return appointmentJson();
    }
    final id = uri.pathSegments.isEmpty
        ? testAppointmentId
        : uri.pathSegments.last;
    return appointmentJson(id: id);
  }
  if (uri.path.endsWith('/appointments')) {
    if (uri.queryParameters.containsKey('scope')) {
      return appointmentListJson();
    }
    return appointmentJson();
  }
  if (RegExp(r'/listings/[0-9a-fA-F-]{36}$').hasMatch(uri.path)) {
    return listing ?? listingDetailJson();
  }
  throw StateError('URI de test inattendue : $uri');
}
