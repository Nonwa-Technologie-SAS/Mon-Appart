import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mon_appart/app/providers.dart';
import 'package:mon_appart/core/auth/in_memory_session_store.dart';
import 'package:mon_appart/core/auth/session_tokens.dart';
import 'package:mon_appart/core/errors/app_failure.dart';
import 'package:mon_appart/core/offline/offline_providers.dart';
import 'package:mon_appart/features/auth/presentation/auth_providers.dart';
import 'package:mon_appart/features/notifications/data/push_device_store.dart';
import 'package:mon_appart/features/notifications/presentation/push_providers.dart';

import '../../helpers/auth_fixtures.dart';
import '../../helpers/fake_api_client.dart';
import '../../helpers/test_app.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  ProviderContainer containerOf({
    required FakeApiClient client,
    required InMemorySessionStore store,
  }) {
    return ProviderContainer(
      overrides: [
        appConfigProvider.overrideWithValue(testConfig()),
        sessionStoreProvider.overrideWithValue(store),
        apiClientProvider.overrideWithValue(client),
        tokenRefresherProvider.overrideWithValue(null),
        pushDeviceStoreProvider.overrideWithValue(InMemoryPushDeviceStore()),
      ],
    );
  }

  test('sans jeton local, session déconnectée', () async {
    final container = containerOf(
      client: FakeApiClient(
        handler: (uri) async => throw StateError(uri.toString()),
      ),
      store: InMemorySessionStore(),
    );
    addTearDown(container.dispose);
    final session = await container.read(authControllerProvider.future);
    expect(session.isAuthenticated, isFalse);
    expect(session.restoreError, isNull);
  });

  test('restaure le profil via GET /auth/me', () async {
    final store = InMemorySessionStore();
    await store.save(const SessionTokens(accessToken: 'a', refreshToken: 'r'));
    final container = containerOf(
      client: FakeApiClient(handler: (uri) async => authUserJson()),
      store: store,
    );
    addTearDown(container.dispose);
    final session = await container.read(authControllerProvider.future);
    expect(session.user?.email, 'user@example.com');
  });

  test('401 au démarrage : session expirée, pas de profil fictif', () async {
    final store = InMemorySessionStore();
    await store.save(const SessionTokens(accessToken: 'a', refreshToken: 'r'));
    final container = containerOf(
      client: FakeApiClient(
        handler: (uri) async => throw const HttpFailure(
          statusCode: 401,
          code: 'UNAUTHENTICATED',
          message: 'Session expirée ou absente.',
        ),
      ),
      store: store,
    );
    addTearDown(container.dispose);
    final session = await container.read(authControllerProvider.future);
    expect(session.isAuthenticated, isFalse);
    expect(session.restoreError, isNull);
  });

  test(
    'erreur réseau au démarrage : restoreError, pas de session valide',
    () async {
      final store = InMemorySessionStore();
      await store.save(
        const SessionTokens(accessToken: 'a', refreshToken: 'r'),
      );
      final container = containerOf(
        client: FakeApiClient(
          handler: (uri) async => throw const NetworkFailure(),
        ),
        store: store,
      );
      addTearDown(container.dispose);
      final session = await container.read(authControllerProvider.future);
      expect(session.user, isNull);
      expect(session.restoreError, isA<NetworkFailure>());
    },
  );

  test(
    'erreur réseau avec profil en cache : session locale, pas une invention',
    () async {
      final store = InMemorySessionStore();
      await store.save(
        const SessionTokens(accessToken: 'a', refreshToken: 'r'),
      );
      final container = containerOf(
        client: FakeApiClient(
          handler: (uri) async => throw const NetworkFailure(),
        ),
        store: store,
      );
      addTearDown(container.dispose);
      await container.read(offlineCacheProvider).putProfile(authUserJson());
      final session = await container.read(authControllerProvider.future);
      expect(session.isAuthenticated, isTrue);
      expect(session.user?.email, 'user@example.com');
      expect(session.restoreError, isA<NetworkFailure>());
    },
  );

  test('login puis logout nettoie la session', () async {
    final store = InMemorySessionStore();
    final client = FakeApiClient(
      handler: (uri) async {
        if (uri.path.endsWith('/auth/login')) {
          return issuedAuthJson();
        }
        if (uri.path.endsWith('/auth/logout')) {
          return const {};
        }
        throw StateError(uri.toString());
      },
    );
    final container = containerOf(client: client, store: store);
    addTearDown(container.dispose);
    await container.read(authControllerProvider.future);
    final user = await container
        .read(authControllerProvider.notifier)
        .login(identifier: 'user@example.com', password: 'phrase-solide-42');
    expect(user.email, 'user@example.com');
    expect(await store.readRefreshToken(), 'refresh-token');

    await container.read(authControllerProvider.notifier).logout();
    expect(
      container.read(authControllerProvider).value?.isAuthenticated,
      isFalse,
    );
    expect(await store.readAccessToken(), isNull);
  });

  test('updateProfile met à jour l\'utilisateur authentifié', () async {
    final store = InMemorySessionStore();
    await store.save(const SessionTokens(accessToken: 'a', refreshToken: 'r'));
    late final FakeApiClient client;
    client = FakeApiClient(
      handler: (uri) async {
        if (uri.path.endsWith('/auth/me') && client.methods.last == 'PATCH') {
          return authUserJson(firstName: 'Koffi', lastName: 'Yao');
        }
        return authUserJson();
      },
    );
    final container = containerOf(client: client, store: store);
    addTearDown(container.dispose);
    await container.read(authControllerProvider.future);
    final user = await container
        .read(authControllerProvider.notifier)
        .updateProfile(firstName: 'Koffi', lastName: 'Yao');
    expect(user.firstName, 'Koffi');
    expect(
      container.read(authControllerProvider).value?.user?.firstName,
      'Koffi',
    );
  });
}
