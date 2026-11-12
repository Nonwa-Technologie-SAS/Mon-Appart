import 'session_store.dart';
import 'session_tokens.dart';

/// Stockage volatile pour les tests. Ne pas utiliser en production.
class InMemorySessionStore implements SessionStore {
  String? _accessToken;
  String? _refreshToken;

  @override
  Future<String?> readAccessToken() async => _accessToken;

  @override
  Future<String?> readRefreshToken() async => _refreshToken;

  @override
  Future<void> save(SessionTokens tokens) async {
    _accessToken = tokens.accessToken;
    _refreshToken = tokens.refreshToken;
  }

  @override
  Future<void> clear() async {
    _accessToken = null;
    _refreshToken = null;
  }
}
