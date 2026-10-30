/// Jetons Identity Nest destinés au stockage sécurisé.
class SessionTokens {
  const SessionTokens({required this.accessToken, this.refreshToken});

  final String accessToken;
  final String? refreshToken;

  bool get hasRefreshToken => refreshToken != null && refreshToken!.isNotEmpty;
}
