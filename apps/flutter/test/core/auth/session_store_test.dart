import 'package:flutter_test/flutter_test.dart';
import 'package:mon_appart/core/auth/in_memory_session_store.dart';
import 'package:mon_appart/core/auth/session_tokens.dart';

void main() {
  test('enregistre et efface les jetons', () async {
    final store = InMemorySessionStore();
    await store.save(
      const SessionTokens(accessToken: 'access', refreshToken: 'refresh'),
    );
    expect(await store.readAccessToken(), 'access');
    expect(await store.readRefreshToken(), 'refresh');

    await store.clear();
    expect(await store.readAccessToken(), isNull);
    expect(await store.readRefreshToken(), isNull);
  });
}
