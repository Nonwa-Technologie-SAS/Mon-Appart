import '../../../core/json/json_map.dart';
import '../../../core/listing/listing_type_label.dart';
import '../../../core/listing/public_ids.dart';
import 'chat_message.dart';

class ConversationListing {
  const ConversationListing({
    required this.id,
    required this.title,
    required this.listingType,
    required this.status,
  });

  final String id;
  final String title;
  final String listingType;
  final String status;

  bool get isPublished => status == 'PUBLISHED';

  String get typeLabel => ListingTypeLabel.of(listingType);

  String? get statusLabel {
    return switch (status) {
      'PUBLISHED' => null,
      'PAUSED' => 'Annonce en pause',
      'SUSPENDED' => 'Annonce suspendue',
      'EXPIRED' => 'Annonce expirée',
      'RENTED' => 'Déjà loué',
      'SOLD' => 'Déjà vendu',
      'ARCHIVED' => 'Annonce archivée',
      'DRAFT' => 'Annonce non publiée',
      'PENDING_REVIEW' => 'Annonce en revue',
      _ => 'Annonce indisponible',
    };
  }

  static ConversationListing? tryParse(Object? raw) {
    final json = asJsonMapOrNull(raw);
    if (json == null) {
      return null;
    }
    final id = asNonEmptyString(json['id']);
    final title = asNonEmptyString(json['title']);
    if (id == null || !PublicIds.isUuid(id) || title == null) {
      return null;
    }
    return ConversationListing(
      id: id,
      title: title,
      listingType: asNonEmptyString(json['listingType']) ?? 'RENT',
      status: asNonEmptyString(json['status']) ?? 'PUBLISHED',
    );
  }
}

class Conversation {
  const Conversation({
    required this.id,
    required this.type,
    required this.status,
    required this.side,
    required this.listing,
    required this.participants,
    required this.unread,
    required this.lastReadSeq,
    required this.lastSeq,
    required this.archived,
    required this.muted,
    required this.lastActivityAt,
    required this.createdAt,
    this.lastMessage,
    this.closedAt,
  });

  final String id;
  final String type;
  final String status;
  final String side;
  final ConversationListing listing;
  final List<ConversationPerson> participants;
  final ChatMessage? lastMessage;
  final int unread;
  final int lastReadSeq;
  final int lastSeq;
  final bool archived;
  final bool muted;
  final DateTime lastActivityAt;
  final DateTime? closedAt;
  final DateTime createdAt;

  bool get isClosed => status == 'CLOSED';

  bool get isRequester => side == 'REQUESTER';

  ConversationPerson? get counterpart {
    final wanted = isRequester ? 'LISTING_SIDE' : 'REQUESTER';
    for (final person in participants) {
      if (person.role == wanted) {
        return person;
      }
    }
    return participants.isEmpty ? null : participants.first;
  }

  String get counterpartName => counterpart?.displayName ?? 'Annonceur';

  Conversation copyWith({
    ChatMessage? lastMessage,
    int? unread,
    int? lastReadSeq,
    int? lastSeq,
    bool? archived,
    bool? muted,
    DateTime? lastActivityAt,
    String? status,
    DateTime? closedAt,
    bool clearLastMessage = false,
  }) {
    return Conversation(
      id: id,
      type: type,
      status: status ?? this.status,
      side: side,
      listing: listing,
      participants: participants,
      lastMessage: clearLastMessage ? null : (lastMessage ?? this.lastMessage),
      unread: unread ?? this.unread,
      lastReadSeq: lastReadSeq ?? this.lastReadSeq,
      lastSeq: lastSeq ?? this.lastSeq,
      archived: archived ?? this.archived,
      muted: muted ?? this.muted,
      lastActivityAt: lastActivityAt ?? this.lastActivityAt,
      closedAt: closedAt ?? this.closedAt,
      createdAt: createdAt,
    );
  }

  static Conversation? tryParse(Object? raw) {
    final json = asJsonMapOrNull(raw);
    if (json == null) {
      return null;
    }
    final id = asNonEmptyString(json['id']);
    final listing = ConversationListing.tryParse(json['listing']);
    final activity = DateTime.tryParse(
      asNonEmptyString(json['lastActivityAt']) ?? '',
    );
    if (id == null ||
        !PublicIds.isUuid(id) ||
        listing == null ||
        activity == null) {
      return null;
    }
    final people = json['participants'];
    return Conversation(
      id: id,
      type: asNonEmptyString(json['type']) ?? 'LISTING',
      status: asNonEmptyString(json['status']) ?? 'OPEN',
      side: asNonEmptyString(json['side']) ?? 'REQUESTER',
      listing: listing,
      participants: people is List
          ? [for (final item in people) ?ConversationPerson.tryParse(item)]
          : const [],
      lastMessage: ChatMessage.tryParse(json['lastMessage']),
      unread: asInt(json['unread']) ?? 0,
      lastReadSeq: asInt(json['lastReadSeq']) ?? 0,
      lastSeq: asInt(json['lastSeq']) ?? 0,
      archived: json['archived'] == true,
      muted: json['muted'] == true,
      lastActivityAt: activity,
      closedAt: DateTime.tryParse(asNonEmptyString(json['closedAt']) ?? ''),
      createdAt:
          DateTime.tryParse(asNonEmptyString(json['createdAt']) ?? '') ??
          activity,
    );
  }
}

class ConversationsPage {
  const ConversationsPage({required this.items, this.nextCursor});

  final List<Conversation> items;
  final String? nextCursor;

  static ConversationsPage parse(Map<String, Object?> json) {
    final raw = json['items'];
    return ConversationsPage(
      items: raw is List
          ? [for (final item in raw) ?Conversation.tryParse(item)]
          : const [],
      nextCursor: asNonEmptyString(json['nextCursor']),
    );
  }
}

class StartConversationResult {
  const StartConversationResult({
    required this.conversation,
    required this.created,
    this.message,
  });

  final Conversation conversation;
  final ChatMessage? message;
  final bool created;

  static StartConversationResult parse(Map<String, Object?> json) {
    final conversation = Conversation.tryParse(json['conversation']);
    if (conversation == null) {
      throw const FormatException('Réponse de conversation inattendue.');
    }
    return StartConversationResult(
      conversation: conversation,
      created: json['created'] == true,
      message: ChatMessage.tryParse(json['message']),
    );
  }
}
