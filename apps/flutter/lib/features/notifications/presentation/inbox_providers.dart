import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/providers.dart';
import '../../../core/errors/app_failure.dart';
import '../../auth/presentation/auth_providers.dart';
import '../data/inbox_notification_repository.dart';
import '../domain/inbox_notification.dart';
import '../domain/inbox_snapshot.dart';

final inboxNotificationRepositoryProvider =
    Provider<InboxNotificationRepository>((ref) {
      return InboxNotificationRepository(
        client: ref.watch(apiClientProvider),
        endpoints: ref.watch(apiEndpointsProvider),
      );
    });

class InboxController extends AsyncNotifier<InboxSnapshot> {
  @override
  Future<InboxSnapshot> build() async {
    final session = await ref.watch(authControllerProvider.future);
    if (!session.isAuthenticated) {
      return InboxSnapshot.empty;
    }
    return _fetchFirst();
  }

  Future<void> refresh() async {
    final session = ref.read(authControllerProvider).value;
    if (session?.isAuthenticated != true) {
      state = const AsyncData(InboxSnapshot.empty);
      return;
    }
    try {
      final page = await _fetchFirst();
      state = AsyncData(page);
    } catch (error, stack) {
      final previous = state.value;
      if (previous != null) {
        state = AsyncData(
          previous.copyWith(
            actionError: error is AppFailure
                ? error
                : UnexpectedFailure(message: error.toString()),
          ),
        );
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
          .read(inboxNotificationRepositoryProvider)
          .list(cursor: current.nextCursor);
      state = AsyncData(
        current.copyWith(
          items: _merge(current.items, page.items),
          unread: page.unread,
          nextCursor: page.nextCursor,
          loadingMore: false,
          clearCursor: page.nextCursor == null || page.nextCursor!.isEmpty,
        ),
      );
    } catch (error) {
      state = AsyncData(
        current.copyWith(
          loadingMore: false,
          actionError: error is AppFailure
              ? error
              : UnexpectedFailure(message: error.toString()),
        ),
      );
    }
  }

  Future<void> markRead(String id) async {
    final current = state.value;
    if (current == null || current.isPending(id)) {
      return;
    }
    final index = current.items.indexWhere((item) => item.id == id);
    if (index < 0) {
      return;
    }
    final item = current.items[index];
    if (item.isRead) {
      return;
    }
    final optimistic = [
      for (var i = 0; i < current.items.length; i++)
        i == index
            ? item.copyWith(readAt: DateTime.now().toUtc())
            : current.items[i],
    ];
    final unread = current.unread > 0 ? current.unread - 1 : 0;
    state = AsyncData(
      current.copyWith(
        items: optimistic,
        unread: unread,
        pendingReadIds: {...current.pendingReadIds, id},
        clearActionError: true,
      ),
    );
    try {
      await ref.read(inboxNotificationRepositoryProvider).markRead(id);
      final latest = state.value ?? current;
      state = AsyncData(
        latest.copyWith(pendingReadIds: {...latest.pendingReadIds}..remove(id)),
      );
    } catch (error) {
      state = AsyncData(
        current.copyWith(
          actionError: error is AppFailure
              ? error
              : UnexpectedFailure(message: error.toString()),
        ),
      );
      Error.throwWithStackTrace(
        error is AppFailure
            ? error
            : UnexpectedFailure(message: error.toString()),
        StackTrace.current,
      );
    }
  }

  Future<void> markAllRead() async {
    final current = state.value;
    if (current == null ||
        current.markingAll ||
        current.unread == 0 ||
        current.items.every((item) => item.isRead)) {
      return;
    }
    final now = DateTime.now().toUtc();
    final optimistic = [
      for (final item in current.items)
        item.isRead ? item : item.copyWith(readAt: now),
    ];
    state = AsyncData(
      current.copyWith(
        items: optimistic,
        unread: 0,
        markingAll: true,
        clearActionError: true,
      ),
    );
    try {
      await ref.read(inboxNotificationRepositoryProvider).markAllRead();
      final latest = state.value ?? current;
      state = AsyncData(latest.copyWith(markingAll: false, unread: 0));
    } catch (error) {
      state = AsyncData(
        current.copyWith(
          markingAll: false,
          actionError: error is AppFailure
              ? error
              : UnexpectedFailure(message: error.toString()),
        ),
      );
      Error.throwWithStackTrace(
        error is AppFailure
            ? error
            : UnexpectedFailure(message: error.toString()),
        StackTrace.current,
      );
    }
  }

  Future<InboxSnapshot> _fetchFirst() async {
    final page = await ref.read(inboxNotificationRepositoryProvider).list();
    return InboxSnapshot(
      items: _merge(const [], page.items),
      unread: page.unread,
      nextCursor: page.nextCursor,
    );
  }

  static List<InboxNotification> _merge(
    List<InboxNotification> current,
    List<InboxNotification> incoming,
  ) {
    final seen = {for (final item in current) item.id};
    return [
      ...current,
      for (final item in incoming)
        if (!seen.contains(item.id)) item,
    ];
  }
}

final inboxControllerProvider =
    AsyncNotifierProvider<InboxController, InboxSnapshot>(InboxController.new);
