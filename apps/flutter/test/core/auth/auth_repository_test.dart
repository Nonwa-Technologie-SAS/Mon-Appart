import 'package:flutter_test/flutter_test.dart';
import 'package:mon_appart/app/config/api_endpoints.dart';
import 'package:mon_appart/core/auth/auth_repository.dart';
import 'package:mon_appart/core/auth/in_memory_session_store.dart';
import 'package:mon_appart/core/auth/session_tokens.dart';
import 'package:mon_appart/core/errors/app_failure.dart';

import '../../helpers/auth_fixtures.dart';
import '../../helpers/fake_api_client.dart';

void main() {
  final endpoints = ApiEndpoints(Uri.parse('http://10.0.2.2:4000'));

  AuthRepository repo(FakeApiClient client, InMemorySessionStore store) {
    return AuthRepository(
      client: client,
      endpoints: endpoints,
      sessionStore: store,
    );
  }

  test('login persiste les jetons Bearer', () async {
    final store = InMemorySessionStore();
    final client = FakeApiClient(handler: (uri) async => issuedAuthJson());
    final issued = await repo(
      client,
      store,
    ).login(identifier: 'user@example.com', password: 'phrase-solide-42');
    expect(issued.user.email, 'user@example.com');
    expect(await store.readAccessToken(), 'access-token');
    expect(await store.readRefreshToken(), 'refresh-token');
    expect(client.lastBody?['identifier'], 'user@example.com');
  });

  test('register envoie uniquement CUSTOMER', () async {
    final store = InMemorySessionStore();
    final client = FakeApiClient(handler: (uri) async => issuedAuthJson());
    await repo(
      client,
      store,
    ).register(password: 'phrase-solide-42', email: 'user@example.com');
    expect(client.lastBody?['accountType'], 'CUSTOMER');
    expect(client.lastBody?['email'], 'user@example.com');
  });

  test('refuse de persister un transport cookie (sans refreshToken)', () async {
    final store = InMemorySessionStore();
    final client = FakeApiClient(
      handler: (uri) async => issuedAuthJson(refreshToken: null),
    );
    await expectLater(
      repo(
        client,
        store,
      ).login(identifier: 'user@example.com', password: 'phrase-solide-42'),
      throwsA(isA<ParsingFailure>()),
    );
    expect(await store.readAccessToken(), isNull);
  });

  test('logout efface la session même si Nest échoue', () async {
    final store = InMemorySessionStore();
    await store.save(const SessionTokens(accessToken: 'a', refreshToken: 'r'));
    final client = FakeApiClient(
      handler: (uri) async => throw const NetworkFailure(),
    );
    await repo(client, store).logout();
    expect(await store.readAccessToken(), isNull);
    expect(await store.readRefreshToken(), isNull);
  });

  test('forgot-password renvoie le message générique Nest', () async {
    final client = FakeApiClient(
      handler: (uri) async => {
        'message': 'Si un compte correspond, un lien de réinitialisation vient d\'être envoyé.',
      },
    );
    final message = await repo(
      client,
      InMemorySessionStore(),
    ).forgotPassword('user@example.com');
    expect(message, contains('Si un compte correspond'));
    expect(client.lastBody?['identifier'], 'user@example.com');
  });

  test('updateProfile envoie uniquement prénom et nom', () async {
    final client = FakeApiClient(
      handler: (uri) async => authUserJson(firstName: 'Koffi', lastName: 'Yao'),
    );
    final user = await repo(
      client,
      InMemorySessionStore(),
    ).updateProfile(firstName: 'Koffi', lastName: 'Yao');
    expect(user.firstName, 'Koffi');
    expect(user.lastName, 'Yao');
    expect(client.methods, ['PATCH']);
    expect(client.lastBody, {'firstName': 'Koffi', 'lastName': 'Yao'});
  });

  test('changePassword renvoie le nombre de sessions révoquées', () async {
    final client = FakeApiClient(
      handler: (uri) async => {'revokedSessions': 2},
    );
    final revoked = await repo(client, InMemorySessionStore()).changePassword(
      currentPassword: 'phrase-solide-42',
      newPassword: 'autre-phrase-solide-99',
    );
    expect(revoked, 2);
    expect(client.methods, ['POST']);
    expect(client.lastBody?['currentPassword'], 'phrase-solide-42');
  });

  test('logoutAll efface la session locale même si Nest échoue', () async {
    final store = InMemorySessionStore();
    await store.save(const SessionTokens(accessToken: 'a', refreshToken: 'r'));
    final client = FakeApiClient(
      handler: (uri) async => throw const NetworkFailure(),
    );
    await repo(client, store).logoutAll();
    expect(await store.readAccessToken(), isNull);
    expect(client.uris.single.path, endsWith('/auth/logout-all'));
  });

  test('reset-password envoie token et newPassword', () async {
    final client = FakeApiClient(
      handler: (uri) async => {
        'message': 'Mot de passe mis à jour. Reconnectez-vous.',
      },
    );
    final message = await repo(
      client,
      InMemorySessionStore(),
    ).resetPassword(token: 't' * 32, newPassword: 'phrase-solide-42');
    expect(message, contains('Reconnectez-vous'));
    expect(client.lastBody?['token'], 't' * 32);
    expect(client.lastBody?['newPassword'], 'phrase-solide-42');
  });
}
