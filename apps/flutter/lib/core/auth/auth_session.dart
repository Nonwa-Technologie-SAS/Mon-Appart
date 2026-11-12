import '../errors/app_failure.dart';
import 'auth_user.dart';

/// Source de vérité unique de la session mobile.
class AuthSession {
  const AuthSession({
    this.user,
    this.submitting = false,
    this.actionError,
    this.restoreError,
  });

  factory AuthSession.signedOut() => const AuthSession();

  factory AuthSession.authenticated(AuthUser user) => AuthSession(user: user);

  final AuthUser? user;
  final bool submitting;
  final AppFailure? actionError;
  final AppFailure? restoreError;

  bool get isAuthenticated => user != null;

  AuthSession copyWith({
    AuthUser? user,
    bool? submitting,
    AppFailure? actionError,
    AppFailure? restoreError,
    bool clearUser = false,
    bool clearActionError = false,
    bool clearRestoreError = false,
  }) {
    return AuthSession(
      user: clearUser ? null : (user ?? this.user),
      submitting: submitting ?? this.submitting,
      actionError: clearActionError ? null : (actionError ?? this.actionError),
      restoreError: clearRestoreError
          ? null
          : (restoreError ?? this.restoreError),
    );
  }
}
