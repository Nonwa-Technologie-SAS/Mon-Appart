import '../../../app/config/api_endpoints.dart';
import '../../../core/api/api_client.dart';
import '../../../core/auth/session_store.dart';
import '../../../core/errors/app_failure.dart';
import '../../../core/ids/uuid_v4.dart';
import '../../../core/json/json_map.dart';
import '../../../core/listing/public_ids.dart';
import '../../listing/data/listing_inquiry_repository.dart';
import '../domain/chat_message.dart';
import '../domain/conversation.dart';

class MessagingRepository {
  MessagingRepository({
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

  void _requireConversationId(String conversationId) {
    if (!PublicIds.isUuid(conversationId)) {
      throw const InvalidConversationIdFailure();
    }
  }

  Future<StartConversationResult> start({
    required String listingId,
    required String message,
    String? clientMessageId,
  }) async {
    await _requireSession();
    final error = InquiryRules.messageError(message);
    if (error != null) {
      throw InquiryValidationFailure(error);
    }
    if (!PublicIds.isUuid(listingId)) {
      throw const InvalidListingIdFailure();
    }
    final json = await client.postJson(
      endpoints.conversations(),
      body: {
        'listingId': listingId,
        'message': message.trim(),
        'clientMessageId': clientMessageId ?? UuidV4.generate(),
      },
    );
    try {
      return StartConversationResult.parse(json);
    } on FormatException {
      throw const ParsingFailure(
        message: 'Réponse de création de conversation inattendue.',
      );
    }
  }

  Future<ConversationsPage> list({
    String? cursor,
    bool archived = false,
    int limit = 20,
  }) async {
    await _requireSession();
    final json = await client.getJson(
      endpoints.conversations(),
      query: {
        'archived': archived ? 'true' : 'false',
        'limit': '$limit',
        if (cursor != null && cursor.isNotEmpty) 'cursor': cursor,
      },
    );
    return ConversationsPage.parse(json);
  }

  Future<int> unreadCount() async {
    await _requireSession();
    final json = await client.getJson(endpoints.conversationsUnreadCount());
    return asInt(json['unread']) ?? 0;
  }

  Future<Conversation> getById(String conversationId) async {
    await _requireSession();
    _requireConversationId(conversationId);
    try {
      final json = await client.getJson(endpoints.conversation(conversationId));
      final conversation = Conversation.tryParse(json);
      if (conversation == null) {
        throw const ParsingFailure(
          message: 'Réponse de conversation inattendue.',
        );
      }
      return conversation;
    } on HttpFailure catch (error) {
      if (error.isNotFound) {
        throw ConversationUnavailableFailure(requestId: error.requestId);
      }
      rethrow;
    }
  }

  Future<MessagesPage> messages(
    String conversationId, {
    int? before,
    int? after,
    int limit = 30,
  }) async {
    await _requireSession();
    _requireConversationId(conversationId);
    try {
      final json = await client.getJson(
        endpoints.conversationMessages(conversationId),
        query: {
          'limit': '$limit',
          if (before != null) 'before': '$before',
          if (after != null) 'after': '$after',
        },
      );
      return MessagesPage.parse(json);
    } on HttpFailure catch (error) {
      if (error.isNotFound) {
        throw ConversationUnavailableFailure(requestId: error.requestId);
      }
      rethrow;
    }
  }

  Future<SendMessageResult> send({
    required String conversationId,
    required String body,
    required String clientMessageId,
  }) async {
    await _requireSession();
    _requireConversationId(conversationId);
    final error = InquiryRules.messageError(body);
    if (error != null) {
      throw InquiryValidationFailure(error);
    }
    if (!UuidV4.isV4(clientMessageId)) {
      throw const InquiryValidationFailure('Identifiant d\'envoi invalide.');
    }
    try {
      final json = await client.postJson(
        endpoints.conversationMessages(conversationId),
        body: {'body': body.trim(), 'clientMessageId': clientMessageId},
      );
      return SendMessageResult.parse(json);
    } on FormatException {
      throw const ParsingFailure(message: 'Réponse d\'envoi inattendue.');
    } on HttpFailure catch (error) {
      if (error.isNotFound) {
        throw ConversationUnavailableFailure(requestId: error.requestId);
      }
      rethrow;
    }
  }

  Future<MarkReadResult> markRead(String conversationId, {int? upToSeq}) async {
    await _requireSession();
    _requireConversationId(conversationId);
    try {
      final json = await client.postJson(
        endpoints.conversationRead(conversationId),
        body: {'upToSeq': ?upToSeq},
      );
      return MarkReadResult.parse(json);
    } on HttpFailure catch (error) {
      if (error.isNotFound) {
        throw ConversationUnavailableFailure(requestId: error.requestId);
      }
      rethrow;
    }
  }

  Future<Conversation> setArchived(String conversationId, bool archived) async {
    await _requireSession();
    _requireConversationId(conversationId);
    final json = await client.patchJson(
      endpoints.conversationArchive(conversationId),
      body: {'archived': archived},
    );
    final conversation = Conversation.tryParse(json);
    if (conversation == null) {
      throw const ParsingFailure();
    }
    return conversation;
  }

  Future<Conversation> setMuted(String conversationId, bool muted) async {
    await _requireSession();
    _requireConversationId(conversationId);
    final json = await client.patchJson(
      endpoints.conversationMute(conversationId),
      body: {'muted': muted},
    );
    final conversation = Conversation.tryParse(json);
    if (conversation == null) {
      throw const ParsingFailure();
    }
    return conversation;
  }

  Future<void> report({
    required String conversationId,
    required String reason,
    String? description,
    String? messageId,
  }) async {
    await _requireSession();
    _requireConversationId(conversationId);
    await client.postJson(
      endpoints.conversationReport(conversationId),
      body: {
        'reason': reason,
        if (description != null && description.trim().isNotEmpty)
          'description': description.trim(),
        if (messageId != null && PublicIds.isUuid(messageId))
          'messageId': messageId,
      },
    );
  }
}
