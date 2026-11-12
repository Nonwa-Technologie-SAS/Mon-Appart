import '../../../app/config/api_endpoints.dart';
import '../../../core/api/api_client.dart';
import '../../../core/errors/app_failure.dart';
import '../../../core/json/json_map.dart';
import '../domain/assistant_models.dart';
import 'assistant_session.dart';

abstract class AssistantRepository {
  Future<AssistantTurn> send({
    required String message,
    String? conversationId,
    bool forceSearch = false,
  });

  Future<AssistantTurn> compare({
    required String conversationId,
    required List<String> listingIds,
  });

  Future<void> deleteConversation(String conversationId);

  Future<void> sendFeedback(AssistantFeedbackRating rating);
}

class AssistantApiRepository implements AssistantRepository {
  AssistantApiRepository({
    required this.client,
    required this.endpoints,
    required this.session,
  });

  final ApiClient client;
  final ApiEndpoints endpoints;
  final AssistantSession session;

  Map<String, String> get _headers => {'x-assistant-session': session.id};

  @override
  Future<AssistantTurn> send({
    required String message,
    String? conversationId,
    bool forceSearch = false,
  }) async {
    final trimmed = message.trim();
    if (trimmed.isEmpty) {
      throw const HttpFailure(
        statusCode: 400,
        code: 'ASSISTANT_EMPTY_MESSAGE',
        message: 'Message vide',
      );
    }
    if (conversationId != null && conversationId.isNotEmpty) {
      try {
        return await _postTurn(
          endpoints.assistantConversationMessages(conversationId),
          {'message': trimmed, 'forceSearch': forceSearch},
        );
      } on HttpFailure catch (error) {
        if (!error.isNotFound) {
          rethrow;
        }
      }
    }
    return _postTurn(endpoints.assistantSearch(), {
      'query': trimmed,
      'forceSearch': forceSearch,
    });
  }

  @override
  Future<AssistantTurn> compare({
    required String conversationId,
    required List<String> listingIds,
  }) {
    return _postTurn(endpoints.assistantCompare(conversationId), {
      'listingIds': listingIds,
    });
  }

  @override
  Future<void> deleteConversation(String conversationId) async {
    try {
      await client.deleteJson(
        endpoints.assistantConversation(conversationId),
        headers: _headers,
      );
    } on HttpFailure catch (error) {
      if (error.isNotFound) {
        return;
      }
      rethrow;
    }
  }

  @override
  Future<void> sendFeedback(AssistantFeedbackRating rating) async {
    await client.postJson(
      endpoints.assistantFeedback(),
      body: {
        'rating': switch (rating) {
          AssistantFeedbackRating.helpful => 'helpful',
          AssistantFeedbackRating.notHelpful => 'not_helpful',
          AssistantFeedbackRating.wrongResults => 'wrong_results',
        },
      },
      headers: _headers,
    );
  }

  Future<AssistantTurn> _postTurn(Uri uri, Map<String, Object?> body) async {
    final json = await client.postJson(uri, body: body, headers: _headers);
    try {
      return AssistantTurn.fromJson(asJsonMap(json));
    } on FormatException {
      throw const ParsingFailure(
        message: 'Réponse de l\'assistant inattendue.',
      );
    }
  }
}
