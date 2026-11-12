import 'package:flutter_test/flutter_test.dart';
import 'package:mon_appart/app/config/api_endpoints.dart';
import 'package:mon_appart/features/notifications/data/inbox_notification_repository.dart';
import 'package:mon_appart/features/notifications/domain/inbox_notification.dart';

import '../../helpers/fake_api_client.dart';
import '../../helpers/listing_fixtures.dart';

void main() {
  final endpoints = ApiEndpoints(Uri.parse('http://10.0.2.2:4000'));

  test(
    'parse listingId unique et relance savedSearchId si digest multiple',
    () {
      final single = InboxNotification.tryParse(
        inboxNotificationJson(
          listingIds: const ['11111111-1111-1111-1111-111111111111'],
        ),
      );
      expect(single?.listingId, '11111111-1111-1111-1111-111111111111');

      final digest = InboxNotification.tryParse(
        inboxNotificationJson(
          listingIds: const [
            '11111111-1111-1111-1111-111111111111',
            '22222222-2222-2222-2222-222222222222',
          ],
          savedSearchId: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
        ),
      );
      expect(digest?.listingId, isNull);
      expect(digest?.savedSearchId, 'cccccccc-cccc-cccc-cccc-cccccccccccc');
      expect(digest?.isRead, isFalse);
    },
  );

  test('list et marquage lu', () async {
    final client = FakeApiClient(
      handler: (uri) async {
        if (uri.path.endsWith('/read')) {
          return const {};
        }
        return {
          'items': [
            inboxNotificationJson(
              listingId: '11111111-1111-1111-1111-111111111111',
            ),
          ],
          'unread': 1,
        };
      },
    );
    final repo = InboxNotificationRepository(
      client: client,
      endpoints: endpoints,
    );
    final page = await repo.list();
    expect(page.unread, 1);
    expect(page.items.single.listingId, '11111111-1111-1111-1111-111111111111');
    await repo.markRead(page.items.single.id);
    expect(client.methods, ['GET', 'PATCH']);
  });

  test('unread-count et champs facultatifs', () async {
    final client = FakeApiClient(
      handler: (uri) async {
        if (uri.path.endsWith('/unread-count')) {
          return const {'unread': 4};
        }
        if (uri.path.endsWith('/read-all')) {
          return const {'updated': 4};
        }
        return {
          'items': [
            {
              'id': 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
              'title': 'Sans corps',
              'createdAt': '2026-10-20T10:00:00.000Z',
            },
          ],
          'unread': 1,
        };
      },
    );
    final repo = InboxNotificationRepository(
      client: client,
      endpoints: endpoints,
    );
    expect(await repo.unreadCount(), 4);
    expect(await repo.markAllRead(), 4);
    final page = await repo.list();
    expect(page.items.single.body, isEmpty);
    expect(page.items.single.type, 'SYSTEM');
  });
}
