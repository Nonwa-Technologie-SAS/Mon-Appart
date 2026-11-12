import '../../../core/errors/app_failure.dart';
import 'conversation.dart';

class ConversationsSnapshot {
  const ConversationsSnapshot({
    required this.items,
    this.nextCursor,
    this.unread = 0,
    this.loadingMore = false,
    this.actionError,
  });

  static const empty = ConversationsSnapshot(items: []);

  final List<Conversation> items;
  final String? nextCursor;
  final int unread;
  final bool loadingMore;
  final AppFailure? actionError;

  bool get hasMore => nextCursor != null && nextCursor!.isNotEmpty;

  ConversationsSnapshot copyWith({
    List<Conversation>? items,
    String? nextCursor,
    int? unread,
    bool? loadingMore,
    AppFailure? actionError,
    bool clearCursor = false,
    bool clearActionError = false,
  }) {
    return ConversationsSnapshot(
      items: items ?? this.items,
      nextCursor: clearCursor ? null : (nextCursor ?? this.nextCursor),
      unread: unread ?? this.unread,
      loadingMore: loadingMore ?? this.loadingMore,
      actionError: clearActionError ? null : (actionError ?? this.actionError),
    );
  }
}
