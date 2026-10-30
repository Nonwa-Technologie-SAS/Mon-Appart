const testConversationId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const testMessageId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const testListingId = '11111111-1111-1111-1111-111111111111';

Map<String, Object?> conversationPersonJson({
  String id = '99999999-9999-4999-8999-999999999999',
  String role = 'LISTING_SIDE',
  String displayName = 'Awa K.',
}) {
  return {'id': id, 'role': role, 'displayName': displayName};
}

Map<String, Object?> conversationListingJson({
  String id = testListingId,
  String title = 'Appartement 2 chambres à Cocody',
  String listingType = 'RENT',
  String status = 'PUBLISHED',
}) {
  return {
    'id': id,
    'title': title,
    'listingType': listingType,
    'status': status,
  };
}

Map<String, Object?> chatMessageJson({
  String id = testMessageId,
  String conversationId = testConversationId,
  int seq = 1,
  String type = 'TEXT',
  String? body = 'Bonjour, le bien est-il encore disponible ?',
  String? systemCode,
  bool mine = true,
  String? status = 'SENT',
  bool deleted = false,
  List<Map<String, Object?>> attachments = const [],
  List<Map<String, Object?>> safetyHints = const [],
  Map<String, Object?>? author,
}) {
  return {
    'id': id,
    'conversationId': conversationId,
    'seq': seq,
    'type': type,
    'body': body,
    'systemCode': systemCode,
    'data': const <String, Object?>{},
    'author':
        author ??
        conversationPersonJson(
          id: '88888888-8888-4888-8888-888888888888',
          role: 'REQUESTER',
          displayName: 'Koffi D.',
        ),
    'mine': mine,
    'status': status,
    'attachments': attachments,
    'deleted': deleted,
    'createdAt': '2026-10-20T10:00:00.000Z',
    'safetyHints': safetyHints,
  };
}

Map<String, Object?> conversationJson({
  String id = testConversationId,
  int unread = 0,
  int lastSeq = 1,
  int lastReadSeq = 1,
  bool archived = false,
  bool muted = false,
  String status = 'OPEN',
  Map<String, Object?>? lastMessage,
  String listingStatus = 'PUBLISHED',
}) {
  return {
    'id': id,
    'type': 'LISTING',
    'status': status,
    'side': 'REQUESTER',
    'listing': conversationListingJson(status: listingStatus),
    'participants': [
      conversationPersonJson(
        id: '88888888-8888-4888-8888-888888888888',
        role: 'REQUESTER',
        displayName: 'Koffi D.',
      ),
      conversationPersonJson(),
    ],
    'lastMessage': lastMessage ?? chatMessageJson(conversationId: id),
    'unread': unread,
    'lastReadSeq': lastReadSeq,
    'lastSeq': lastSeq,
    'archived': archived,
    'muted': muted,
    'lastActivityAt': '2026-10-20T10:00:00.000Z',
    'closedAt': status == 'CLOSED' ? '2026-10-21T10:00:00.000Z' : null,
    'createdAt': '2026-10-19T10:00:00.000Z',
  };
}

Map<String, Object?> conversationPageJson({
  List<Map<String, Object?>>? items,
  String? nextCursor,
}) {
  return {
    'items': items ?? [conversationJson()],
    'nextCursor': nextCursor,
  };
}

Map<String, Object?> messagePageJson({
  List<Map<String, Object?>>? items,
  bool hasMore = false,
  int lastReadSeq = 1,
  int lastSeq = 1,
}) {
  return {
    'items': items ?? [chatMessageJson()],
    'hasMore': hasMore,
    'lastReadSeq': lastReadSeq,
    'lastSeq': lastSeq,
  };
}

Map<String, Object?> startConversationJson({
  bool created = true,
  String conversationId = testConversationId,
}) {
  return {
    'conversation': conversationJson(id: conversationId),
    'message': chatMessageJson(conversationId: conversationId),
    'created': created,
  };
}

Map<String, Object?> sendMessageJson({
  Map<String, Object?>? message,
  bool duplicate = false,
}) {
  return {
    'message': message ?? chatMessageJson(seq: 2, body: 'Merci'),
    'duplicate': duplicate,
  };
}

Map<String, Object?> conversationReportJson() {
  return {
    'id': 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    'targetType': 'CONVERSATION',
    'targetId': testConversationId,
    'reason': 'SUSPECTED_SCAM',
    'status': 'OPEN',
    'createdAt': '2026-10-20T10:00:00.000Z',
    'resolvedAt': null,
  };
}
