import 'package:flutter_test/flutter_test.dart';
import 'package:mon_appart/app/config/api_endpoints.dart';
import 'package:mon_appart/core/errors/app_failure.dart';
import 'package:mon_appart/core/search/explore_query.dart';
import 'package:mon_appart/features/account/data/account_session_repository.dart';
import 'package:mon_appart/features/account/data/notification_preference_repository.dart';
import 'package:mon_appart/features/account/data/saved_search_repository.dart';
import 'package:mon_appart/features/account/domain/account_session.dart';
import 'package:mon_appart/features/account/domain/notification_pref.dart';
import 'package:mon_appart/features/account/domain/saved_search_item.dart';

import '../../helpers/fake_api_client.dart';
import '../../helpers/listing_fixtures.dart';

void main() {
  final endpoints = ApiEndpoints(Uri.parse('http://10.0.2.2:4000'));

  test('parse une recherche sauvegardée et relance via params Nest', () {
    final item = SavedSearchItem.tryParse({
      'id': 'cccccccc-cccc-cccc-cccc-cccccccccccc',
      'name': 'Cocody 2 chambres',
      'params': {
        'listingType': 'RENT',
        'commune': 'COCODY',
        'minPrice': '150000',
      },
      'alertsEnabled': true,
      'frequency': 'DAILY',
      'currency': 'XOF',
      'listingType': 'RENT',
      'minPrice': 150000,
    });
    expect(item, isNotNull);
    expect(item!.summary, contains('Cocody'));
    expect(item.query.commune, 'COCODY');
    expect(item.query.minPrice, 150000);
  });

  test('saved-search list/resume/delete', () async {
    final client = FakeApiClient(
      handler: (uri) async {
        if (uri.path.endsWith('/resume')) {
          return {
            'params': {'commune': 'COCODY'},
            'resumePath': '/search?commune=COCODY',
          };
        }
        if (uri.path.endsWith('/saved-searches')) {
          return {
            'items': [
              {
                'id': 'cccccccc-cccc-cccc-cccc-cccccccccccc',
                'name': 'Cocody',
                'params': {'commune': 'COCODY'},
                'alertsEnabled': false,
                'frequency': 'DAILY',
                'currency': 'XOF',
              },
            ],
          };
        }
        return const {};
      },
    );
    final repo = SavedSearchRepository(client: client, endpoints: endpoints);
    final items = await repo.list();
    expect(items.single.name, 'Cocody');
    final query = await repo.resume(items.single.id);
    expect(query.commune, 'COCODY');
    await repo.remove(items.single.id);
    expect(client.methods, ['GET', 'POST', 'DELETE']);
  });

  test(
    'create et update conservent les paramètres et la fréquence Nest',
    () async {
      late final FakeApiClient client;
      client = FakeApiClient(
        handler: (uri) async {
          return savedSearchJson(
            name: (client.lastBody?['name'] as String?) ?? 'Cocody',
            alertsEnabled: client.lastBody?['alertsEnabled'] == true,
            frequency: (client.lastBody?['frequency'] as String?) ?? 'DAILY',
            params: Map<String, String>.from(
              (client.lastBody?['params'] as Map?)?.map(
                    (key, value) => MapEntry('$key', '$value'),
                  ) ??
                  const {'commune': 'COCODY'},
            ),
          );
        },
      );
      final repo = SavedSearchRepository(client: client, endpoints: endpoints);
      final created = await repo.create(
        name: 'Appartements à louer à Cocody',
        params: const {
          'listingType': 'RENT',
          'commune': 'COCODY',
          'minPrice': '150000',
        },
        alertsEnabled: true,
        frequency: 'WEEKLY',
      );
      expect(created.query.minPrice, 150000);
      expect(created.frequency, 'WEEKLY');
      expect(client.methods, ['POST']);
      final updated = await repo.update(
        created.id,
        alertsEnabled: false,
        frequency: 'PAUSED',
      );
      expect(updated.alertsActive, isFalse);
      expect(client.methods, ['POST', 'PATCH']);
    },
  );

  test('nom par défaut et q seul n\'est pas alertable', () {
    expect(
      SavedSearchItem.defaultName(
        const ExploreQuery(
          listingType: 'RENT',
          propertyType: 'APARTMENT',
          commune: 'COCODY',
        ),
      ),
      'Appartement à louer à Cocody',
    );
    expect(const ExploreQuery(q: 'cocody').hasAlertableCriteria, isFalse);
    expect(SavedSearchItem.nameError('A'), isNotNull);
  });

  test('notification prefs n\'envoie que les cellules disponibles', () async {
    final cell = NotificationPrefCell.tryParse({
      'category': 'MESSAGES',
      'channel': 'EMAIL',
      'enabled': true,
      'locked': false,
      'available': true,
    });
    expect(cell?.canToggle, isTrue);
    expect(cell?.categoryLabel, 'Messages');
    final locked = NotificationPrefCell.tryParse({
      'category': 'ACCOUNT',
      'channel': 'EMAIL',
      'enabled': true,
      'locked': true,
      'available': true,
    });
    expect(locked?.canToggle, isFalse);

    final client = FakeApiClient(
      handler: (uri) async => {
        'items': [
          {
            'category': 'MESSAGES',
            'channel': 'EMAIL',
            'enabled': false,
            'locked': false,
            'available': true,
          },
        ],
      },
    );
    final repo = NotificationPreferenceRepository(
      client: client,
      endpoints: endpoints,
    );
    await repo.update([cell!.toChange(enabled: false)]);
    expect(client.methods, ['PUT']);
    expect(client.lastBody?['items'], isA<List<Object?>>());
  });

  test('sessions GET tableau JSON et révocation', () async {
    final client = FakeApiClient(
      handler: (uri) async => const {},
      listHandler: (uri) async => [
        {
          'id': 'dddddddd-dddd-dddd-dddd-dddddddddddd',
          'current': true,
          'deviceName': 'Pixel 8',
          'userAgent': 'Dart',
          'lastActiveAt': '2026-10-20T10:00:00.000Z',
          'expiresAt': '2026-11-19T10:00:00.000Z',
        },
      ],
    );
    final repo = AccountSessionRepository(client: client, endpoints: endpoints);
    final sessions = await repo.list();
    expect(sessions.single.label, 'Pixel 8');
    expect(sessions.single.current, isTrue);
    await repo.revoke(sessions.single.id);
    expect(client.methods, ['GET', 'DELETE']);
  });

  test('session incomplète ignorée', () {
    expect(AccountDeviceSession.tryParse({'id': ''}), isNull);
    expect(AccountDeviceSession.tryParse('nope'), isNull);
  });

  test('erreur réseau des sessions n\'est pas une liste vide', () async {
    final client = FakeApiClient(
      listHandler: (uri) async => throw const NetworkFailure(),
    );
    final repo = AccountSessionRepository(client: client, endpoints: endpoints);
    await expectLater(repo.list(), throwsA(isA<NetworkFailure>()));
  });
}
