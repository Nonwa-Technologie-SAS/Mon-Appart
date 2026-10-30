import 'package:flutter_test/flutter_test.dart';
import 'package:mon_appart/app/config/api_endpoints.dart';
import 'package:mon_appart/core/errors/app_failure.dart';
import 'package:mon_appart/features/notifications/data/push_device_repository.dart';
import 'package:mon_appart/features/notifications/data/push_device_store.dart';
import 'package:mon_appart/features/notifications/presentation/push_providers.dart';
import 'package:mon_appart/core/auth/in_memory_session_store.dart';
import 'package:mon_appart/core/auth/session_tokens.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mon_appart/app/providers.dart';

import '../../helpers/fake_api_client.dart';
import '../../helpers/test_app.dart';

void main() {
  final endpoints = ApiEndpoints(Uri.parse('http://10.0.2.2:4000'));
  const token = 'fcm-token-16chars';

  test('enregistre un appareil sans renvoyer le jeton', () async {
    Map<String, Object?>? body;
    late final FakeApiClient client;
    client = FakeApiClient(
      handler: (uri) async {
        body = client.lastBody;
        return {
          'id': 'dddddddd-dddd-dddd-dddd-dddddddddddd',
          'platform': 'ANDROID',
          'lastSeenAt': '2026-10-20T10:00:00.000Z',
          'createdAt': '2026-10-20T10:00:00.000Z',
        };
      },
    );
    final repo = PushDeviceRepository(client: client, endpoints: endpoints);
    final device = await repo.register(token: token, platform: 'ANDROID');
    expect(device.id, 'dddddddd-dddd-dddd-dddd-dddddddddddd');
    expect(body?['token'], token);
    expect(body?['platform'], 'ANDROID');
    expect(device.toString(), isNot(contains(token)));
  });

  test('refuse un jeton trop court sans appeler le réseau', () async {
    final client = FakeApiClient(
      handler: (_) async => throw StateError('ne doit pas être appelé'),
    );
    final repo = PushDeviceRepository(client: client, endpoints: endpoints);
    expect(
      () => repo.register(token: 'short', platform: 'ANDROID'),
      throwsA(isA<HttpFailure>()),
    );
    expect(client.calls, 0);
  });

  test('sync ne poste rien sans jeton natif', () async {
    final client = FakeApiClient(
      handler: (_) async => throw StateError('ne doit pas être appelé'),
    );
    final store = InMemorySessionStore();
    await store.save(const SessionTokens(accessToken: 'a', refreshToken: 'r'));
    final container = ProviderContainer(
      overrides: [
        appConfigProvider.overrideWithValue(testConfig()),
        apiClientProvider.overrideWithValue(client),
        sessionStoreProvider.overrideWithValue(store),
        tokenRefresherProvider.overrideWithValue(null),
        pushDeviceStoreProvider.overrideWithValue(InMemoryPushDeviceStore()),
      ],
    );
    addTearDown(container.dispose);
    await container.read(pushCoordinatorProvider).sync();
    expect(client.calls, 0);
  });
}
