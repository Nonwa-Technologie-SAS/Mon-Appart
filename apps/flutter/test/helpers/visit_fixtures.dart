const testAppointmentId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const testVisitListingId = '11111111-1111-1111-1111-111111111111';
const testVisitConversationId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

Map<String, Object?> appointmentJson({
  String id = testAppointmentId,
  String status = 'PENDING',
  String side = 'REQUESTER',
  String scheduledAt = '2026-11-02T10:00:00.000Z',
  String listingId = testVisitListingId,
  String listingTitle = 'Appartement 2 chambres à Cocody',
  String? conversationId = testVisitConversationId,
  List<String> actions = const ['RESCHEDULE', 'CANCEL'],
  bool feedbackSubmitted = false,
  String? feedbackOutcome,
  String? notes = 'Disponible le matin',
  String? proposedAt,
  String? proposedBy,
}) {
  return {
    'id': id,
    'status': status,
    'side': side,
    'scheduledAt': scheduledAt,
    'timezone': 'Africa/Abidjan',
    'durationMinutes': 60,
    'notes': notes,
    'proposedAt': proposedAt,
    'proposedBy': proposedBy,
    'listing': {'id': listingId, 'title': listingTitle},
    'conversationId': conversationId,
    'requester': {
      'id': '88888888-8888-4888-8888-888888888888',
      'role': 'REQUESTER',
      'displayName': 'Koffi D.',
    },
    'confirmedAt': status == 'CONFIRMED' || status == 'COMPLETED'
        ? '2026-10-29T10:00:00.000Z'
        : null,
    'cancelledAt': status == 'CANCELLED' ? '2026-10-29T11:00:00.000Z' : null,
    'cancelledBy': status == 'CANCELLED' ? side : null,
    'cancellationReason': status == 'CANCELLED' ? 'SCHEDULE_CONFLICT' : null,
    'completedAt': status == 'COMPLETED' ? '2026-11-02T11:00:00.000Z' : null,
    'createdAt': '2026-10-28T09:00:00.000Z',
    'actions': actions,
    'feedback': {'submitted': feedbackSubmitted, 'outcome': feedbackOutcome},
  };
}

Map<String, Object?> appointmentListJson({
  List<Map<String, Object?>> items = const [],
}) {
  return {'items': items};
}
