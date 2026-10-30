import '../../app/config/api_endpoints.dart';
import '../api/api_client.dart';
import '../errors/app_failure.dart';
import '../json/json_map.dart';
import '../offline/offline_cache.dart';
import 'auth_user.dart';
import 'issued_auth.dart';
import 'session_store.dart';
import 'session_tokens.dart';
import 'token_refresher.dart';

class AuthRepository {
  AuthRepository({
    required this.client,
    required this.endpoints,
    required this.sessionStore,
    this.refresher,
    this.cache,
  });

  final ApiClient client;
  final ApiEndpoints endpoints;
  final SessionStore sessionStore;
  final TokenRefresher? refresher;
  final OfflineCache? cache;

  Future<IssuedAuth> register({
    required String password,
    String? email,
    String? phone,
    String? firstName,
    String? lastName,
  }) async {
    final json = await client.postJson(
      endpoints.authRegister(),
      body: {
        if (email != null && email.isNotEmpty) 'email': email,
        if (phone != null && phone.isNotEmpty) 'phone': phone,
        'password': password,
        if (firstName != null && firstName.isNotEmpty) 'firstName': firstName,
        if (lastName != null && lastName.isNotEmpty) 'lastName': lastName,
        'accountType': 'CUSTOMER',
      },
    );
    return _persist(IssuedAuth.fromJson(json));
  }

  Future<IssuedAuth> login({
    required String identifier,
    required String password,
  }) async {
    final json = await client.postJson(
      endpoints.authLogin(),
      body: {'identifier': identifier, 'password': password},
    );
    return _persist(IssuedAuth.fromJson(json));
  }

  Future<AuthUser> me() async {
    final json = await client.getJson(endpoints.authMe());
    await cache?.putProfile(json);
    return AuthUser.fromJson(json);
  }

  Future<AuthUser> updateProfile({
    required String firstName,
    required String lastName,
  }) async {
    final json = await client.patchJson(
      endpoints.authMe(),
      body: {'firstName': firstName, 'lastName': lastName},
    );
    await cache?.putProfile(json);
    return AuthUser.fromJson(json);
  }

  Future<int> changePassword({
    required String currentPassword,
    required String newPassword,
  }) async {
    final json = await client.postJson(
      endpoints.authChangePassword(),
      body: {'currentPassword': currentPassword, 'newPassword': newPassword},
    );
    return asInt(json['revokedSessions']) ?? 0;
  }

  Future<void> logoutAll() async {
    try {
      await client.postJson(endpoints.authLogoutAll());
    } on AppFailure {
      // La session locale est effacée même si Nest n'a pas répondu.
    } finally {
      await sessionStore.clear();
    }
  }

  Future<SessionTokens?> refresh() async {
    return refresher?.refresh();
  }

  Future<void> logout() async {
    try {
      await client.postJson(endpoints.authLogout());
    } on AppFailure {
      // La session locale est effacée même si Nest n'a pas répondu.
    } finally {
      await sessionStore.clear();
    }
  }

  Future<String> forgotPassword(String identifier) async {
    final json = await client.postJson(
      endpoints.authForgotPassword(),
      body: {'identifier': identifier},
    );
    return asNonEmptyString(json['message']) ??
        'Si un compte correspond, un lien de réinitialisation vient d\'être envoyé.';
  }

  Future<String> resetPassword({
    required String token,
    required String newPassword,
  }) async {
    final json = await client.postJson(
      endpoints.authResetPassword(),
      body: {'token': token, 'newPassword': newPassword},
    );
    return asNonEmptyString(json['message']) ??
        'Mot de passe mis à jour. Reconnectez-vous.';
  }

  Future<OtpChallenge> requestEmailVerification() async {
    final json = await client.postJson(endpoints.authEmailVerifyRequest());
    return OtpChallenge.fromJson(json);
  }

  Future<AuthUser> confirmEmail({
    required String code,
    String? challengeId,
  }) async {
    await client.postJson(
      endpoints.authEmailVerifyConfirm(),
      body: {'code': code, 'challengeId': ?challengeId},
    );
    return me();
  }

  Future<OtpChallenge> requestPhoneVerification() async {
    final json = await client.postJson(endpoints.authPhoneVerifyRequest());
    return OtpChallenge.fromJson(json);
  }

  Future<AuthUser> confirmPhone({
    required String code,
    String? challengeId,
  }) async {
    await client.postJson(
      endpoints.authPhoneVerifyConfirm(),
      body: {'code': code, 'challengeId': ?challengeId},
    );
    return me();
  }

  Future<IssuedAuth> _persist(IssuedAuth issued) async {
    if (!issued.tokens.hasRefreshToken) {
      await sessionStore.clear();
      throw const ParsingFailure(
        message:
            'Le serveur n\'a pas renvoyé de jeton de renouvellement. '
            'Le transport cookie n\'est pas utilisé par l\'application mobile.',
      );
    }
    await sessionStore.save(issued.tokens);
    await cache?.putProfile(issued.user.toJson());
    return issued;
  }
}

class OtpChallenge {
  const OtpChallenge({
    required this.challengeId,
    required this.expiresAt,
    required this.resendAvailableAt,
  });

  final String challengeId;
  final DateTime expiresAt;
  final DateTime resendAvailableAt;

  static OtpChallenge fromJson(Map<String, Object?> json) {
    final id = asNonEmptyString(json['challengeId']);
    final expires = DateTime.tryParse(
      asNonEmptyString(json['expiresAt']) ?? '',
    );
    final resend = DateTime.tryParse(
      asNonEmptyString(json['resendAvailableAt']) ?? '',
    );
    if (id == null || expires == null || resend == null) {
      throw const FormatException('Défi de vérification incomplet.');
    }
    return OtpChallenge(
      challengeId: id,
      expiresAt: expires,
      resendAvailableAt: resend,
    );
  }
}
