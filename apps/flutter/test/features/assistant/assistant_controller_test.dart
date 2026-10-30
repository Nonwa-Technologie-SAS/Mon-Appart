import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mon_appart/core/errors/app_failure.dart';
import 'package:mon_appart/features/assistant/data/assistant_repository.dart';
import 'package:mon_appart/features/assistant/domain/assistant_models.dart';
import 'package:mon_appart/features/assistant/presentation/assistant_providers.dart';

import '../../helpers/listing_fixtures.dart';

class _FakeAssistantRepository implements AssistantRepository {
  final sends =
      <({String message, String? conversationId, bool forceSearch})>[];
  final responses = <Future<AssistantTurn> Function()>[];

  @override
  Future<AssistantTurn> send({
    required String message,
    String? conversationId,
    bool forceSearch = false,
  }) {
    sends.add((
      message: message,
      conversationId: conversationId,
      forceSearch: forceSearch,
    ));
    if (responses.isEmpty) {
      return Future.value(AssistantTurn.fromJson(assistantTurnJson()));
    }
    return responses.removeAt(0)();
  }

  @override
  Future<AssistantTurn> compare({
    required String conversationId,
    required List<String> listingIds,
  }) {
    throw UnimplementedError();
  }

  @override
  Future<void> deleteConversation(String conversationId) async {}

  @override
  Future<void> sendFeedback(AssistantFeedbackRating rating) async {}
}

ProviderContainer _containerWith(_FakeAssistantRepository repository) {
  final container = ProviderContainer(
    overrides: [assistantRepositoryProvider.overrideWithValue(repository)],
  );
  addTearDown(container.dispose);
  return container;
}

void main() {
  test('conserve le contexte multi-tours via conversationId Nest', () async {
    final repository = _FakeAssistantRepository();
    final container = _containerWith(repository);
    final controller = container.read(assistantControllerProvider.notifier);
    await controller.send('Maison à Cocody, 250 000');
    expect(container.read(assistantControllerProvider).rows, hasLength(2));
    expect(
      container.read(assistantControllerProvider).conversationId,
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    );
    await controller.send('Avec 3 chambres');
    expect(repository.sends, hasLength(2));
    expect(
      repository.sends.last.conversationId,
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    );
    expect(repository.sends.last.message, 'Avec 3 chambres');
  });

  test('ignore une réponse arrivée après réinitialisation', () async {
    final repository = _FakeAssistantRepository();
    final first = Completer<AssistantTurn>();
    repository.responses.add(() => first.future);
    final container = _containerWith(repository);
    final controller = container.read(assistantControllerProvider.notifier);
    final slow = controller.send('Ancienne demande');
    await Future<void>.delayed(Duration.zero);
    await controller.reset();
    first.complete(
      AssistantTurn.fromJson(assistantTurnJson(message: 'Trop tard')),
    );
    await slow;
    final thread = container.read(assistantControllerProvider);
    expect(thread.rows, isEmpty);
    expect(thread.pending, isFalse);
  });

  test('une erreur réseau conserve le message utilisateur', () async {
    final repository = _FakeAssistantRepository();
    repository.responses.add(() async => throw const NetworkFailure());
    final container = _containerWith(repository);
    final controller = container.read(assistantControllerProvider.notifier);
    await controller.send('Studio à Yopougon');
    final thread = container.read(assistantControllerProvider);
    expect(thread.rows.single.text, 'Studio à Yopougon');
    expect(thread.error, isA<NetworkFailure>());
    expect(thread.retryMessage, 'Studio à Yopougon');
  });
}
