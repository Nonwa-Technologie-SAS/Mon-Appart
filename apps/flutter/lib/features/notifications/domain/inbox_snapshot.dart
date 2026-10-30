import 'inbox_notification.dart';

class InboxSnapshot {
  const InboxSnapshot({
    required this.items,
    this.unread = 0,
    this.nextCursor,
    this.loadingMore = false,
    this.markingAll = false,
    this.pendingReadIds = const {},
    this.actionError,
  });

  static const empty = InboxSnapshot(items: []);

  final List<InboxNotification> items;
  final int unread;
  final String? nextCursor;
  final bool loadingMore;
  final bool markingAll;
  final Set<String> pendingReadIds;
  final Object? actionError;

  bool get hasMore => nextCursor != null && nextCursor!.isNotEmpty;

  bool isPending(String id) => pendingReadIds.contains(id);

  InboxSnapshot copyWith({
    List<InboxNotification>? items,
    int? unread,
    String? nextCursor,
    bool? loadingMore,
    bool? markingAll,
    Set<String>? pendingReadIds,
    Object? actionError,
    bool clearCursor = false,
    bool clearActionError = false,
  }) {
    return InboxSnapshot(
      items: items ?? this.items,
      unread: unread ?? this.unread,
      nextCursor: clearCursor ? null : (nextCursor ?? this.nextCursor),
      loadingMore: loadingMore ?? this.loadingMore,
      markingAll: markingAll ?? this.markingAll,
      pendingReadIds: pendingReadIds ?? this.pendingReadIds,
      actionError: clearActionError ? null : (actionError ?? this.actionError),
    );
  }
}
