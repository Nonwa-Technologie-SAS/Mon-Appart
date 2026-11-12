import '../../../app/config/api_endpoints.dart';
import '../../../core/api/api_client.dart';
import '../domain/inbox_notification.dart';

class InboxPage {
  const InboxPage({required this.items, this.nextCursor, this.unread = 0});

  final List<InboxNotification> items;
  final String? nextCursor;
  final int unread;
}

class InboxNotificationRepository {
  InboxNotificationRepository({required this.client, required this.endpoints});

  final ApiClient client;
  final ApiEndpoints endpoints;

  Future<InboxPage> list({String? cursor, int limit = 20}) async {
    final json = await client.getJson(
      endpoints.notifications(),
      query: {
        'limit': '$limit',
        if (cursor != null && cursor.isNotEmpty) 'cursor': cursor,
      },
    );
    final raw = json['items'];
    final items = raw is List
        ? [for (final item in raw) ?InboxNotification.tryParse(item)]
        : const <InboxNotification>[];
    return InboxPage(
      items: items,
      nextCursor: asCursor(json['nextCursor']),
      unread: _unread(json['unread']),
    );
  }

  Future<void> markRead(String id) async {
    await client.patchJson(endpoints.notificationRead(id));
  }

  Future<int> markAllRead() async {
    final json = await client.postJson(endpoints.notificationsReadAll());
    return _unread(json['updated']);
  }

  Future<int> unreadCount() async {
    final json = await client.getJson(endpoints.notificationsUnreadCount());
    return _unread(json['unread']);
  }

  static String? asCursor(Object? raw) {
    if (raw is String && raw.trim().isNotEmpty) {
      return raw.trim();
    }
    return null;
  }

  static int _unread(Object? raw) {
    if (raw is int) {
      return raw;
    }
    if (raw is num) {
      return raw.toInt();
    }
    return 0;
  }
}
