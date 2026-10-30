import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/providers.dart';
import '../../../core/errors/app_failure.dart';
import '../../../core/ids/uuid_v4.dart';
import '../../../core/listing/public_ids.dart';
import '../../auth/presentation/auth_providers.dart';
import '../../listing/data/listing_inquiry_repository.dart';
import '../data/messaging_realtime.dart';
import '../data/messaging_repository.dart';
import '../data/socket_io_realtime.dart';
import '../domain/chat_message.dart';
import '../domain/conversation.dart';
import '../domain/conversations_snapshot.dart';
import '../domain/thread_snapshot.dart';

final messagingRepositoryProvider = Provider<MessagingRepository>((ref) {
  return MessagingRepository(
    client: ref.watch(apiClientProvider),
    endpoints: ref.watch(apiEndpointsProvider),
    sessionStore: ref.watch(sessionStoreProvider),
  );
});

final messagingRealtimeProvider = Provider<MessagingRealtime>((ref) {
  final baseUrl = ref.watch(appConfigProvider).apiBaseUrl;
  if (baseUrl == null) {
    return const NullMessagingRealtime();
  }
  final client = SocketIoMessagingRealtime(
    origin: baseUrl,
    sessionStore: ref.watch(sessionStoreProvider),
    logger: ref.watch(appLoggerProvider),
  );
  ref.onDispose(client.dispose);
  return client;
});

final messagingRealtimeLifecycleProvider = Provider<void>((ref) {
  ref.listen(authControllerProvider, (previous, next) {
    final was = previous?.asData?.value.isAuthenticated == true;
    final now = next.asData?.value.isAuthenticated == true;
    final realtime = ref.read(messagingRealtimeProvider);
    if (!was && now) {
      unawaited(realtime.connect());
    } else if (was && !now) {
      realtime.disconnect();
    }
  });
  final session = ref.read(authControllerProvider).value;
  if (session?.isAuthenticated == true) {
    unawaited(ref.read(messagingRealtimeProvider).connect());
  }
});

class ConversationsController extends AsyncNotifier<ConversationsSnapshot> {
  StreamSubscription<MessagingRealtimeEvent>? _realtime;

  @override
  Future<ConversationsSnapshot> build() async {
    unawaited(_realtime?.cancel());
    ref.onDispose(() => unawaited(_realtime?.cancel()));
    final session = await ref.watch(authControllerProvider.future);
    if (!session.isAuthenticated) {
      return ConversationsSnapshot.empty;
    }
    _realtime = ref.read(messagingRealtimeProvider).events.listen(_onRealtime);
    return _fetchFirst();
  }

  Future<void> refresh() async {
    final session = ref.read(authControllerProvider).value;
    if (session?.isAuthenticated != true) {
      state = const AsyncData(ConversationsSnapshot.empty);
      return;
    }
    try {
      state = AsyncData(await _fetchFirst());
    } catch (error, stack) {
      final previous = state.value;
      if (previous != null) {
        state = AsyncData(previous.copyWith(actionError: _failure(error)));
      } else {
        state = AsyncError(error, stack);
      }
    }
  }

  Future<void> loadMore() async {
    final current = state.value;
    if (current == null ||
        !current.hasMore ||
        current.loadingMore ||
        state.isLoading) {
      return;
    }
    state = AsyncData(
      current.copyWith(loadingMore: true, clearActionError: true),
    );
    try {
      final page = await ref
          .read(messagingRepositoryProvider)
          .list(cursor: current.nextCursor);
      state = AsyncData(
        current.copyWith(
          items: _mergeList(current.items, page.items),
          nextCursor: page.nextCursor,
          loadingMore: false,
          clearCursor: page.nextCursor == null || page.nextCursor!.isEmpty,
        ),
      );
    } catch (error) {
      state = AsyncData(
        current.copyWith(loadingMore: false, actionError: _failure(error)),
      );
    }
  }

  Future<void> upsert(Conversation conversation) async {
    final current = state.value;
    if (current == null) {
      return;
    }
    state = AsyncData(
      current.copyWith(items: _upsert(current.items, conversation)),
    );
  }

  Future<void> applyUnread(int unread) async {
    final current = state.value;
    if (current == null) {
      return;
    }
    state = AsyncData(current.copyWith(unread: unread));
  }

  Future<ConversationsSnapshot> _fetchFirst() async {
    final repo = ref.read(messagingRepositoryProvider);
    final page = await repo.list();
    var unread = page.items.fold<int>(0, (sum, item) => sum + item.unread);
    try {
      unread = await repo.unreadCount();
    } catch (_) {}
    return ConversationsSnapshot(
      items: page.items,
      nextCursor: page.nextCursor,
      unread: unread,
    );
  }

  void _onRealtime(MessagingRealtimeEvent event) {
    switch (event) {
      case RealtimeUnreadHint(:final unread):
        if (unread != null) {
          unawaited(applyUnread(unread));
        } else {
          unawaited(_refreshUnread());
        }
      case RealtimeMessageHint(:final conversationId):
      case RealtimeConversationHint(:final conversationId):
        unawaited(_refreshOne(conversationId));
        unawaited(_refreshUnread());
      case RealtimeAppointmentHint():
        break;
    }
  }

  Future<void> _refreshOne(String conversationId) async {
    try {
      final conversation = await ref
          .read(messagingRepositoryProvider)
          .getById(conversationId);
      await upsert(conversation);
    } catch (_) {}
  }

  Future<void> _refreshUnread() async {
    try {
      final unread = await ref.read(messagingRepositoryProvider).unreadCount();
      await applyUnread(unread);
    } catch (_) {}
  }

  static List<Conversation> _mergeList(
    List<Conversation> current,
    List<Conversation> incoming,
  ) {
    final seen = {for (final item in current) item.id};
    return [
      ...current,
      for (final item in incoming)
        if (!seen.contains(item.id)) item,
    ];
  }

  static List<Conversation> _upsert(
    List<Conversation> current,
    Conversation incoming,
  ) {
    final without = [
      for (final item in current)
        if (item.id != incoming.id) item,
    ];
    return [incoming, ...without];
  }
}

final conversationsControllerProvider =
    AsyncNotifierProvider<ConversationsController, ConversationsSnapshot>(
      ConversationsController.new,
    );

class ThreadController extends AsyncNotifier<ThreadSnapshot> {
  ThreadController(this.conversationId);

  final String conversationId;
  StreamSubscription<MessagingRealtimeEvent>? _realtime;
  var _markedRead = false;

  @override
  Future<ThreadSnapshot> build() async {
    unawaited(_realtime?.cancel());
    ref.onDispose(() => unawaited(_realtime?.cancel()));
    if (!PublicIds.isUuid(conversationId)) {
      throw const InvalidConversationIdFailure();
    }
    final session = await ref.watch(authControllerProvider.future);
    if (!session.isAuthenticated) {
      throw const NeedsAuthFailure();
    }
    _realtime = ref.read(messagingRealtimeProvider).events.listen(_onRealtime);
    return _loadInitial();
  }

  Future<void> retry() async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(_loadInitial);
  }

  Future<void> loadOlder() async {
    final current = state.value;
    if (current == null ||
        !current.hasMoreOlder ||
        current.loadingOlder ||
        current.messages.isEmpty) {
      return;
    }
    state = AsyncData(
      current.copyWith(loadingOlder: true, clearActionError: true),
    );
    try {
      final oldest = current.messages.first.seq;
      final page = await ref
          .read(messagingRepositoryProvider)
          .messages(conversationId, before: oldest);
      state = AsyncData(
        current.copyWith(
          messages: _mergeMessages(page.items, current.messages),
          hasMoreOlder: page.hasMore,
          loadingOlder: false,
        ),
      );
    } catch (error) {
      state = AsyncData(
        current.copyWith(loadingOlder: false, actionError: _failure(error)),
      );
    }
  }

  Future<void> catchUp() async {
    final current = state.value;
    if (current == null || current.catchingUp) {
      return;
    }
    state = AsyncData(current.copyWith(catchingUp: true));
    try {
      final lastSeq = current.messages.isEmpty
          ? current.conversation.lastSeq
          : current.messages.last.seq;
      final page = await ref
          .read(messagingRepositoryProvider)
          .messages(conversationId, after: lastSeq);
      var conversation = current.conversation.copyWith(
        lastSeq: page.lastSeq,
        lastReadSeq: page.lastReadSeq,
      );
      final merged = _mergeMessages(current.messages, page.items);
      if (merged.isNotEmpty) {
        conversation = conversation.copyWith(
          lastMessage: merged.last,
          lastActivityAt: merged.last.createdAt,
        );
      }
      state = AsyncData(
        current.copyWith(
          conversation: conversation,
          messages: merged,
          catchingUp: false,
        ),
      );
      await _markReadIfNeeded();
      await ref
          .read(conversationsControllerProvider.notifier)
          .upsert(conversation);
    } catch (error) {
      state = AsyncData(
        current.copyWith(catchingUp: false, actionError: _failure(error)),
      );
    }
  }

  Future<void> send(String raw) async {
    final current = state.value;
    if (current == null || !current.canSend) {
      return;
    }
    final error = InquiryRules.messageError(raw);
    if (error != null) {
      state = AsyncData(
        current.copyWith(sendError: InquiryValidationFailure(error)),
      );
      return;
    }
    final reuseId =
        current.pendingBody == raw.trim() &&
            current.pendingClientMessageId != null
        ? current.pendingClientMessageId!
        : UuidV4.generate();
    state = AsyncData(
      current.copyWith(
        sending: true,
        pendingClientMessageId: reuseId,
        pendingBody: raw.trim(),
        clearSendError: true,
        clearActionError: true,
      ),
    );
    try {
      final result = await ref
          .read(messagingRepositoryProvider)
          .send(
            conversationId: conversationId,
            body: raw,
            clientMessageId: reuseId,
          );
      final latest = state.value ?? current;
      final merged = _mergeMessages(latest.messages, [result.message]);
      final conversation = latest.conversation.copyWith(
        lastMessage: result.message,
        lastSeq: result.message.seq,
        lastActivityAt: result.message.createdAt,
      );
      state = AsyncData(
        latest.copyWith(
          conversation: conversation,
          messages: merged,
          sending: false,
          clearPending: true,
        ),
      );
      await ref
          .read(conversationsControllerProvider.notifier)
          .upsert(conversation);
    } catch (error) {
      final latest = state.value ?? current;
      state = AsyncData(
        latest.copyWith(sending: false, sendError: _failure(error)),
      );
      rethrow;
    }
  }

  Future<void> archive(bool archived) async {
    final current = state.value;
    if (current == null) {
      return;
    }
    try {
      final conversation = await ref
          .read(messagingRepositoryProvider)
          .setArchived(conversationId, archived);
      state = AsyncData(current.copyWith(conversation: conversation));
      await ref
          .read(conversationsControllerProvider.notifier)
          .upsert(conversation);
    } catch (error) {
      Error.throwWithStackTrace(_failure(error), StackTrace.current);
    }
  }

  Future<void> mute(bool muted) async {
    final current = state.value;
    if (current == null) {
      return;
    }
    try {
      final conversation = await ref
          .read(messagingRepositoryProvider)
          .setMuted(conversationId, muted);
      state = AsyncData(current.copyWith(conversation: conversation));
    } catch (error) {
      Error.throwWithStackTrace(_failure(error), StackTrace.current);
    }
  }

  Future<void> report({
    required String reason,
    String? description,
    String? messageId,
  }) async {
    await ref
        .read(messagingRepositoryProvider)
        .report(
          conversationId: conversationId,
          reason: reason,
          description: description,
          messageId: messageId,
        );
  }

  Future<ThreadSnapshot> _loadInitial() async {
    final repo = ref.read(messagingRepositoryProvider);
    final conversation = await repo.getById(conversationId);
    final page = await repo.messages(conversationId);
    _markedRead = false;
    final snapshot = ThreadSnapshot(
      conversation: conversation.copyWith(
        lastSeq: page.lastSeq,
        lastReadSeq: page.lastReadSeq,
      ),
      messages: _mergeMessages(const [], page.items),
      hasMoreOlder: page.hasMore,
    );
    unawaited(_markReadIfNeeded(snapshot));
    return snapshot;
  }

  Future<void> _markReadIfNeeded([ThreadSnapshot? snapshot]) async {
    final current = snapshot ?? state.value;
    if (current == null || _markedRead) {
      return;
    }
    if (current.conversation.lastSeq <= current.conversation.lastReadSeq &&
        current.conversation.unread == 0) {
      return;
    }
    _markedRead = true;
    try {
      final result = await ref
          .read(messagingRepositoryProvider)
          .markRead(conversationId, upToSeq: current.conversation.lastSeq);
      final latest = state.value ?? current;
      final updated = latest.conversation.copyWith(
        lastReadSeq: result.lastReadSeq,
        unread: result.unread,
      );
      if (state.hasValue) {
        state = AsyncData(latest.copyWith(conversation: updated));
      }
      await ref.read(conversationsControllerProvider.notifier).upsert(updated);
      unawaited(_syncUnreadFromServer());
    } catch (_) {
      _markedRead = false;
    }
  }

  Future<void> _syncUnreadFromServer() async {
    try {
      final unread = await ref.read(messagingRepositoryProvider).unreadCount();
      await ref
          .read(conversationsControllerProvider.notifier)
          .applyUnread(unread);
    } catch (_) {}
  }

  void _onRealtime(MessagingRealtimeEvent event) {
    switch (event) {
      case RealtimeMessageHint(:final conversationId, :final message):
        if (conversationId != this.conversationId) {
          return;
        }
        if (message != null && state.value != null) {
          final current = state.value!;
          state = AsyncData(
            current.copyWith(
              messages: _mergeMessages(current.messages, [message]),
            ),
          );
        }
        unawaited(catchUp());
      case RealtimeConversationHint(:final conversationId):
        if (conversationId == this.conversationId) {
          unawaited(catchUp());
        }
      case RealtimeUnreadHint():
      case RealtimeAppointmentHint():
        break;
    }
  }

  static List<ChatMessage> _mergeMessages(
    List<ChatMessage> current,
    List<ChatMessage> incoming,
  ) {
    final byId = <String, ChatMessage>{
      for (final item in current) item.id: item,
    };
    for (final item in incoming) {
      byId[item.id] = item;
    }
    final values = byId.values.toList()
      ..sort((a, b) {
        final seq = a.seq.compareTo(b.seq);
        if (seq != 0) {
          return seq;
        }
        return a.createdAt.compareTo(b.createdAt);
      });
    return values;
  }
}

final threadControllerProvider =
    AsyncNotifierProvider.family<ThreadController, ThreadSnapshot, String>(
      ThreadController.new,
      retry: (_, _) => null,
    );

AppFailure _failure(Object error) {
  if (error is AppFailure) {
    return error;
  }
  return UnexpectedFailure(message: error.toString());
}
