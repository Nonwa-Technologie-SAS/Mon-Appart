const testManagedListingId = '11111111-1111-1111-1111-111111111111';
const testManagedPropertyId = '22222222-2222-2222-2222-222222222222';
const testInquiryId = '12121212-1212-1212-1212-121212121212';
const testProspectId = '13131313-1313-1313-1313-131313131313';
const testInquiryConversationId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const testInquiryAppointmentId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

Map<String, Object?> managedListingJson({
  String id = testManagedListingId,
  String title = 'Appartement 2 chambres à Cocody',
  String listingType = 'RENT',
  String status = 'DRAFT',
  String? coverUrl = 'https://cdn.example/cover.jpg',
}) {
  return {
    'id': id,
    'listingType': listingType,
    'title': title,
    'status': status,
    'price': {'amount': '250000', 'currency': 'XOF', 'period': 'MONTH'},
    'property': {
      'id': testManagedPropertyId,
      'propertyType': 'APARTMENT',
      'surface': '75',
      'bedrooms': 2,
      'bathrooms': 1,
    },
    'location': {
      'commune': {'code': 'COCODY', 'name': 'Cocody'},
      'neighborhood': {'code': 'RIVIERA', 'name': 'Riviera'},
    },
    'coverUrl': coverUrl,
    'publishedAt': null,
    'expiresAt': null,
    'createdAt': '2026-10-20T10:00:00.000Z',
    'updatedAt': '2026-10-28T10:00:00.000Z',
  };
}

Map<String, Object?> managedPropertyJson({
  String id = testManagedPropertyId,
  String title = 'Appartement 2 chambres à Cocody',
  String status = 'DRAFT',
  String typeCode = 'APARTMENT',
  String category = 'RESIDENTIAL',
  List<String> missing = const ['coordinates'],
  double? latitude = 5.359,
  double? longitude = -3.958,
}) {
  return {
    'id': id,
    'title': title,
    'description': 'Appartement lumineux à Riviera, proche des écoles.',
    'propertyType': {
      'code': typeCode,
      'name': typeCode == 'LAND' ? 'Terrain' : 'Appartement',
      'category': category,
    },
    'location': {
      'commune': {'code': 'COCODY', 'name': 'Cocody'},
      'neighborhood': {'code': 'RIVIERA', 'name': 'Riviera'},
      'latitude': latitude,
      'longitude': longitude,
      'precision': latitude == null ? 'NONE' : 'EXACT',
      'address': null,
    },
    'surface': typeCode == 'LAND' ? null : '75',
    'landSurface': typeCode == 'LAND' ? '600' : null,
    'bedrooms': typeCode == 'LAND' ? null : 2,
    'bathrooms': typeCode == 'LAND' ? null : 1,
    'rooms': typeCode == 'LAND' ? null : 3,
    'floor': null,
    'totalFloors': null,
    'yearBuilt': null,
    'attributes': <String, Object?>{},
    'amenities': [
      {'code': 'PARKING', 'name': 'Parking', 'category': 'OUTDOOR'},
    ],
    'media': {'count': 0, 'coverUrl': null},
    'listings': <Map<String, Object?>>[],
    'createdAt': '2026-10-20T10:00:00.000Z',
    'updatedAt': '2026-10-28T10:00:00.000Z',
    'status': status,
    'locationVisibility': 'APPROXIMATE',
    'completeness': {'complete': missing.isEmpty, 'missing': missing},
  };
}

Map<String, Object?> managedListingPageJson({
  List<Map<String, Object?>>? items,
  String? nextCursor,
}) {
  return {
    'items': items ?? [managedListingJson()],
    'nextCursor': nextCursor,
  };
}

Map<String, Object?> inquiryJson({
  String id = testInquiryId,
  String stage = 'NEW',
  String status = 'OPEN',
  String type = 'CONTACT',
  String listingTitle = 'Appartement 2 chambres à Cocody',
  String? conversationId = testInquiryConversationId,
  String? message = 'Bonjour, le bien est-il toujours disponible ?',
  List<Map<String, Object?>> appointments = const [],
  List<Map<String, Object?>> notes = const [],
}) {
  return {
    'id': id,
    'type': type,
    'status': status,
    'stage': stage,
    'createdAt': '2026-10-27T08:00:00.000Z',
    'updatedAt': '2026-10-28T09:00:00.000Z',
    'lastActivityAt': '2026-10-28T09:00:00.000Z',
    'nextAction': null,
    'nextActionAt': null,
    'budgetAmount': 250000,
    'prospect': {'id': testProspectId, 'displayName': 'Koffi Yao'},
    'listing': {
      'id': testManagedListingId,
      'title': listingTitle,
      'listingType': 'RENT',
      'status': 'PUBLISHED',
    },
    'conversationId': conversationId,
    'appointments': appointments,
    'priority': 'HIGH',
    'suggestedAction': 'Répondre',
    'message': message,
    'notes': notes,
    'stageHistory': <Map<String, Object?>>[],
  };
}

Map<String, Object?> inquiryPageJson({
  List<Map<String, Object?>>? items,
  String? nextCursor,
}) {
  return {
    'items': items ?? [inquiryJson()],
    'nextCursor': nextCursor,
  };
}

Map<String, Object?> inquiryDashboardJson({
  int unhandled = 3,
  int newContacts = 2,
  double? responseRate,
  double? contactToVisitRate,
}) {
  return {
    'windowDays': 7,
    'newContacts': newContacts,
    'unhandled': unhandled,
    'overdueActions': 1,
    'pendingVisits': 2,
    'confirmedUpcomingVisits': 1,
    'completedVisits': 0,
    'responseRate': responseRate,
    'medianFirstResponseHours': 4.5,
    'contactToVisitRate': contactToVisitRate,
    'totals': {'inquiries': 5, 'responded': 2},
    'topListings': [
      {
        'id': testManagedListingId,
        'title': 'Appartement 2 chambres à Cocody',
        'contacts': 4,
      },
    ],
    'computedAt': '2026-10-29T10:00:00.000Z',
  };
}

Map<String, Object?> listingStatsPageJson({
  int detailViews = 12,
  int contactsSubmitted = 3,
  double? contactRate = 0.25,
}) {
  return {
    'range': {'from': '2026-09-29', 'to': '2026-10-29', 'days': 30},
    'items': [
      {
        'listing': {
          'id': testManagedListingId,
          'title': 'Appartement 2 chambres à Cocody',
          'status': 'PUBLISHED',
        },
        'totals': {
          'detailViews': detailViews,
          'contactsSubmitted': contactsSubmitted,
          'appointmentsRequested': 1,
        },
        'rates': {'contactRate': contactRate, 'appointmentRate': null},
      },
    ],
    'pagination': {'page': 1, 'limit': 20, 'total': 1},
    'meta': {'computedAt': '2026-10-29T10:00:00.000Z'},
  };
}
