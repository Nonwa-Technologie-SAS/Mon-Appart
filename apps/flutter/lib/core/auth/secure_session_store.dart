import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import 'session_store.dart';
import 'session_tokens.dart';

/// Trousseau / Keystore. Les jetons ne passent jamais par SharedPreferences.
class SecureSessionStore implements SessionStore {
  SecureSessionStore({FlutterSecureStorage? storage})
    : _storage =
          storage ??
          const FlutterSecureStorage(
            aOptions: AndroidOptions(),
            iOptions: IOSOptions(
              accessibility: KeychainAccessibility.first_unlock_this_device,
            ),
          );

  static const _accessKey = 'ma.identity.access_token';
  static const _refreshKey = 'ma.identity.refresh_token';

  final FlutterSecureStorage _storage;

  @override
  Future<String?> readAccessToken() => _storage.read(key: _accessKey);

  @override
  Future<String?> readRefreshToken() => _storage.read(key: _refreshKey);

  @override
  Future<void> save(SessionTokens tokens) async {
    await _storage.write(key: _accessKey, value: tokens.accessToken);
    if (tokens.hasRefreshToken) {
      await _storage.write(key: _refreshKey, value: tokens.refreshToken);
    } else {
      await _storage.delete(key: _refreshKey);
    }
  }

  @override
  Future<void> clear() async {
    await _storage.delete(key: _accessKey);
    await _storage.delete(key: _refreshKey);
  }
}
