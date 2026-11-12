import '../json/json_map.dart';
import 'auth_user.dart';
import 'session_tokens.dart';

/// Réponse `POST /auth/login|register|refresh` (transport Bearer mobile).
class IssuedAuth {
  const IssuedAuth({
    required this.tokens,
    required this.user,
    required this.sessionId,
    required this.accessTokenExpiresAt,
    required this.refreshTokenExpiresAt,
  });

  final SessionTokens tokens;
  final AuthUser user;
  final String sessionId;
  final DateTime? accessTokenExpiresAt;
  final DateTime? refreshTokenExpiresAt;

  static IssuedAuth fromJson(Map<String, Object?> json) {
    final accessToken = asNonEmptyString(json['accessToken']);
    final sessionId = asNonEmptyString(json['sessionId']);
    final userJson = asJsonMapOrNull(json['user']);
    if (accessToken == null || sessionId == null || userJson == null) {
      throw const FormatException('Réponse d\'authentification incomplète.');
    }
    return IssuedAuth(
      tokens: SessionTokens(
        accessToken: accessToken,
        refreshToken: asNonEmptyString(json['refreshToken']),
      ),
      user: AuthUser.fromJson(userJson),
      sessionId: sessionId,
      accessTokenExpiresAt: DateTime.tryParse(
        asNonEmptyString(json['accessTokenExpiresAt']) ?? '',
      ),
      refreshTokenExpiresAt: DateTime.tryParse(
        asNonEmptyString(json['refreshTokenExpiresAt']) ?? '',
      ),
    );
  }
}
