import 'session_tokens.dart';

/// Persistance des jetons. Implémentation OS : [SecureSessionStore].
abstract class SessionStore {
  Future<String?> readAccessToken();

  Future<String?> readRefreshToken();

  Future<void> save(SessionTokens tokens);

  Future<void> clear();
}
