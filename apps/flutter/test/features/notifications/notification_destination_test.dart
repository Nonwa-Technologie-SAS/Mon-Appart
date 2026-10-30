import 'package:flutter_test/flutter_test.dart';
import 'package:mon_appart/features/notifications/domain/inbox_notification.dart';
import 'package:mon_appart/features/notifications/domain/notification_destination.dart';
import 'package:mon_appart/features/notifications/domain/relative_time.dart';

import '../../helpers/listing_fixtures.dart';

void main() {
  const listingId = '11111111-1111-1111-1111-111111111111';
  const savedId = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
  const conversationId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const appointmentId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

  test('MESSAGE privilégie la conversation', () {
    final item = InboxNotification.tryParse(
      inboxNotificationJson(
        type: 'MESSAGE',
        category: 'MESSAGES',
        listingId: listingId,
        conversationId: conversationId,
      ),
    );
    final destination = NotificationDestination.fromInbox(item!);
    expect(destination.kind, NotificationKind.conversation);
    expect(destination.id, conversationId);
    expect(destination.requiresAuth, isTrue);
  });

  test('APPOINTMENT privilégie la visite sans la confirmer', () {
    final destination = NotificationDestination.fromPayload(
      type: 'APPOINTMENT',
      listingId: listingId,
      appointmentId: appointmentId,
    );
    expect(destination.kind, NotificationKind.appointment);
    expect(destination.requiresAuth, isTrue);
  });

  test('payload push minimal ouvre l\'inbox', () {
    final destination = NotificationDestination.fromDataMap({
      'notificationId': 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
      'type': 'NEW_PROPERTY',
    });
    expect(destination.kind, NotificationKind.notifications);
  });

  test('type inconnu sans identifiant reste neutre', () {
    final item = InboxNotification.tryParse({
      'id': 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
      'type': 'SOMETHING_NEW',
      'category': 'NOT_A_CATEGORY',
      'title': 'Info',
      'body': null,
      'createdAt': '2026-10-20T10:00:00.000Z',
      'data': {'foo': 'bar'},
    });
    expect(item, isNotNull);
    expect(NotificationCatalog.typeLabel(item!.type), 'Notification');
    expect(NotificationCatalog.categoryLabel(item.category), 'Notification');
    expect(
      NotificationDestination.fromInbox(item).kind,
      NotificationKind.notifications,
    );
    expect(
      NotificationDestination.fromPayload().kind,
      NotificationKind.unknown,
    );
  });

  test('payload invalide est ignoré', () {
    expect(InboxNotification.tryParse({'title': 'sans id'}), isNull);
    expect(InboxNotification.tryParse(null), isNull);
    expect(InboxNotification.tryParse('x'), isNull);
  });

  test('identifiants non UUID sont ignorés', () {
    final item = InboxNotification.tryParse(
      inboxNotificationJson(listingId: 'pas-un-uuid', savedSearchId: savedId),
    );
    expect(item?.listingId, isNull);
    expect(item?.savedSearchId, savedId);
    expect(
      NotificationDestination.fromInbox(item!).kind,
      NotificationKind.savedSearch,
    );
  });

  test('libellé relatif des dates', () {
    final now = DateTime(2026, 10, 20, 12);
    expect(
      RelativeTime.format(now.subtract(const Duration(seconds: 10)), now: now),
      'À l\'instant',
    );
    expect(
      RelativeTime.format(now.subtract(const Duration(minutes: 5)), now: now),
      'Il y a 5 min',
    );
    expect(
      RelativeTime.format(DateTime(2026, 9, 30, 12), now: now),
      '30/09/2026',
    );
  });
}
