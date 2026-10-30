import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/providers.dart';
import '../../../core/errors/app_failure.dart';
import '../data/assistant_repository.dart';
import '../data/assistant_session.dart';
import '../domain/assistant_models.dart';

final assistantSessionProvider = Provider<AssistantSession>((ref) {
  return AssistantSession();
});

final assistantRepositoryProvider = Provider<AssistantRepository>((ref) {
  return AssistantApiRepository(
    client: ref.watch(apiClientProvider),
    endpoints: ref.watch(apiEndpointsProvider),
    session: ref.watch(assistantSessionProvider),
  );
});

class AssistantController extends Notifier<AssistantThread> {
  @override
  AssistantThread build() => const AssistantThread();

  Future<void> send(String message, {bool forceSearch = false}) async {
    final trimmed = message.trim();
    if (trimmed.isEmpty || state.pending) {
      return;
    }
    if (trimmed.length > assistantMaxMessageLength) {
      state = state.copyWith(
        error: const HttpFailure(
          statusCode: 400,
          code: 'ASSISTANT_MESSAGE_TOO_LONG',
          message:
              'Message trop long (max $assistantMaxMessageLength caractères)',
        ),
      );
      return;
    }
    final generation = state.generation + 1;
    state = state.copyWith(
      pending: true,
      error: null,
      generation: generation,
      retryMessage: trimmed,
      retryForceSearch: forceSearch,
      rows: [...state.rows, AssistantChatRow.user(trimmed)],
      compareIds: const {},
    );
    await _request(
      generation: generation,
      message: trimmed,
      forceSearch: forceSearch,
    );
  }

  Future<void> retry() async {
    final message = state.retryMessage;
    if (message == null || state.pending) {
      return;
    }
    final generation = state.generation + 1;
    state = state.copyWith(pending: true, error: null, generation: generation);
    await _request(
      generation: generation,
      message: message,
      forceSearch: state.retryForceSearch,
    );
  }

  Future<void> forceSearchFromLastTurn() {
    final turn = state.lastTurn;
    final prompt = turn?.mode == AssistantMode.empty
        ? 'Élargir la recherche'
        : 'Lancer la recherche';
    return send(prompt, forceSearch: true);
  }

  void toggleCompare(String listingId) {
    final next = {...state.compareIds};
    if (!next.add(listingId)) {
      next.remove(listingId);
    }
    if (next.length > 4) {
      return;
    }
    state = state.copyWith(compareIds: next);
  }

  Future<void> compareSelected() async {
    final conversationId = state.conversationId;
    if (conversationId == null ||
        state.compareIds.length < 2 ||
        state.pending) {
      return;
    }
    final generation = state.generation + 1;
    state = state.copyWith(pending: true, error: null, generation: generation);
    try {
      final turn = await ref
          .read(assistantRepositoryProvider)
          .compare(
            conversationId: conversationId,
            listingIds: state.compareIds.toList(),
          );
      if (state.generation != generation) {
        return;
      }
      state = state.copyWith(
        pending: false,
        conversationId: turn.conversationId,
        rows: [...state.rows, AssistantChatRow.assistant(turn)],
      );
    } catch (error) {
      if (state.generation != generation) {
        return;
      }
      state = state.copyWith(pending: false, error: _asFailure(error));
    }
  }

  Future<void> sendFeedback(AssistantFeedbackRating rating) {
    return ref.read(assistantRepositoryProvider).sendFeedback(rating);
  }

  Future<void> reset() async {
    final conversationId = state.conversationId;
    state = const AssistantThread();
    if (conversationId == null) {
      return;
    }
    try {
      await ref
          .read(assistantRepositoryProvider)
          .deleteConversation(conversationId);
    } catch (_) {
      // La mémoire locale est déjà vidée.
    }
  }

  Future<void> _request({
    required int generation,
    required String message,
    required bool forceSearch,
  }) async {
    try {
      final turn = await ref
          .read(assistantRepositoryProvider)
          .send(
            message: message,
            conversationId: state.conversationId,
            forceSearch: forceSearch,
          );
      if (state.generation != generation) {
        return;
      }
      state = state.copyWith(
        pending: false,
        conversationId: turn.conversationId,
        rows: [...state.rows, AssistantChatRow.assistant(turn)],
        retryMessage: null,
        retryForceSearch: false,
      );
    } catch (error) {
      if (state.generation != generation) {
        return;
      }
      state = state.copyWith(pending: false, error: _asFailure(error));
    }
  }
}

AppFailure _asFailure(Object error) {
  if (error is AppFailure) {
    return error;
  }
  return UnexpectedFailure(message: error.toString());
}

final assistantControllerProvider =
    NotifierProvider<AssistantController, AssistantThread>(
      AssistantController.new,
    );
