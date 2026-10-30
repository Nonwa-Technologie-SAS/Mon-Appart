import 'package:flutter_test/flutter_test.dart';
import 'package:mon_appart/app/config/api_endpoints.dart';
import 'package:mon_appart/core/errors/app_failure.dart';
import 'package:mon_appart/features/assistant/data/assistant_repository.dart';
import 'package:mon_appart/features/assistant/data/assistant_session.dart';
import 'package:mon_appart/features/assistant/domain/assistant_models.dart';

import '../../helpers/fake_api_client.dart';
import '../../helpers/listing_fixtures.dart';

const _sessionId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const _conversationId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

AssistantApiRepository repo(FakeApiClient client) {
  return AssistantApiRepository(
    client: client,
    endpoints: ApiEndpoints(Uri.parse('http://10.0.2.2:4000')),
    session: AssistantSession(_sessionId),
  );
}

void main() {
  test('le premier tour passe par POST /ai-assistant/search', () async {
    final client = FakeApiClient(
      handler: (uri) async {
        expect(uri.path, endsWith('/ai-assistant/search'));
        return assistantTurnJson();
      },
    );
    final turn = await repo(client).send(message: 'Maison à Cocody');
    expect(client.lastBody?['query'], 'Maison à Cocody');
    expect(client.lastHeaders?['x-assistant-session'], _sessionId);
    expect(turn.listings, isNotEmpty);
    expect(turn.conversationId, _conversationId);
  });

  test('un tour suivant réutilise la conversation', () async {
    final client = FakeApiClient(
      handler: (uri) async {
        expect(
          uri.path,
          endsWith('/ai-assistant/conversations/$_conversationId/messages'),
        );
        return assistantTurnJson(message: 'Ajout de 3 chambres.');
      },
    );
    final turn = await repo(client)
        .send(message: 'Avec 3 chambres', conversationId: _conversationId);
    expect(client.lastBody?['message'], 'Avec 3 chambres');
    expect(client.lastBody?['forceSearch'], isFalse);
    expect(turn.message, 'Ajout de 3 chambres.');
  });

  test('conversation expirée : repli sur une nouvelle recherche', () async {
    var calls = 0;
    final client = FakeApiClient(
      handler: (uri) async {
        calls += 1;
        if (uri.path.endsWith('/messages')) {
          throw const HttpFailure(
            statusCode: 404,
            code: 'ASSISTANT_CONVERSATION_NOT_FOUND',
            message: 'Conversation introuvable',
          );
        }
        expect(uri.path, endsWith('/ai-assistant/search'));
        return assistantTurnJson(
          conversationId: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
        );
      },
    );
    final turn = await repo(client)
        .send(message: 'Studio à Marcory', conversationId: _conversationId);
    expect(calls, 2);
    expect(turn.conversationId, 'cccccccc-cccc-cccc-cccc-cccccccccccc');
  });

  test('réponse invalide → ParsingFailure, pas de faux biens', () async {
    final client = FakeApiClient(handler: (uri) async => {'ok': true});
    expect(
      () => repo(client).send(message: 'Maison'),
      throwsA(isA<ParsingFailure>()),
    );
  });

  test('feedback et comparaison utilisent les contrats Nest', () async {
    final client = FakeApiClient(
      handler: (uri) async {
        if (uri.path.endsWith('/feedback')) {
          return {
            'accepted': true,
            'feedbackId': 'dddddddd-dddd-dddd-dddd-dddddddddddd',
            'rating': 'helpful',
          };
        }
        return assistantTurnJson(listings: <Map<String, Object?>>[]);
      },
    );
    final api = repo(client);
    await api.sendFeedback(AssistantFeedbackRating.helpful);
    expect(client.lastBody?['rating'], 'helpful');
    await api.compare(
      conversationId: _conversationId,
      listingIds: const [
        '11111111-1111-1111-1111-111111111111',
        '33333333-3333-3333-3333-333333333333',
      ],
    );
    expect(client.uris.last.path, endsWith('/compare'));
  });
}
