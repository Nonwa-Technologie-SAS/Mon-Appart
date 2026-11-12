import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/providers.dart';
import '../../../core/auth/auth_repository.dart';
import '../../../core/auth/auth_session.dart';
import '../../../core/auth/auth_user.dart';
import '../../../core/errors/app_failure.dart';
import '../../../core/observability/telemetry_event.dart';
import '../../../core/offline/offline_providers.dart';
import '../../../core/offline/sync_rules.dart';
import '../../../core/security/auth_failure_signal.dart';
import '../../../core/security/private_session_cleaner.dart';
import '../../notifications/presentation/push_providers.dart';
import '../../offline/offline_runtime.dart';

final authRepositoryProvider = Provider<AuthRepository>((ref) {
  return AuthRepository(
    client: ref.watch(apiClientProvider),
    endpoints: ref.watch(apiEndpointsProvider),
    sessionStore: ref.watch(sessionStoreProvider),
    refresher: ref.watch(tokenRefresherProvider),
    cache: ref.watch(offlineCacheProvider),
  );
});

class AuthController extends AsyncNotifier<AuthSession> {
  final _loginFailures = AuthFailureSignal();

  @override
  Future<AuthSession> build() async {
    ref.watch(sessionEpochProvider);
    final store = ref.watch(sessionStoreProvider);
    final token = await store.readAccessToken();
    if (token == null || token.isEmpty) {
      await _forgetPrivate(discardIncidents: false);
      return AuthSession.signedOut();
    }
    try {
      final user = await ref.read(authRepositoryProvider).me();
      return AuthSession.authenticated(user);
    } on HttpFailure catch (error) {
      if (error.isUnauthenticated) {
        await _forgetPrivate(discardIncidents: true);
        return AuthSession.signedOut();
      }
      if (SyncRules.isTransient(error)) {
        return _restoreCached(error);
      }
      return AuthSession(restoreError: error);
    } on AppFailure catch (error) {
      if (SyncRules.isTransient(error)) {
        return _restoreCached(error);
      }
      return AuthSession(restoreError: error);
    }
  }

  Future<AuthUser> login({
    required String identifier,
    required String password,
  }) async {
    final previousId = await _knownUserId();
    try {
      final user = await _run(
        () => ref
            .read(authRepositoryProvider)
            .login(identifier: identifier, password: password)
            .then((issued) => issued.user),
      );
      _loginFailures.success();
      await _dropOtherAccount(previousId, user.id);
      return user;
    } catch (error) {
      if (_loginFailures.failure()) {
        ref
            .read(telemetryProvider)
            .record(
              severity: TelemetrySeverity.high,
              kind: TelemetryKind.auth,
              operation: 'auth.repeated_failure',
              message: 'Plusieurs échecs de connexion sur cet appareil.',
              attributes: {'count': _loginFailures.count},
            );
      }
      rethrow;
    }
  }

  Future<AuthUser> register({
    required String password,
    String? email,
    String? phone,
    String? firstName,
    String? lastName,
  }) async {
    final previousId = await _knownUserId();
    final user = await _run(
      () => ref
          .read(authRepositoryProvider)
          .register(
            password: password,
            email: email,
            phone: phone,
            firstName: firstName,
            lastName: lastName,
          )
          .then((issued) => issued.user),
    );
    await _dropOtherAccount(previousId, user.id);
    return user;
  }

  Future<AuthSession> _restoreCached(AppFailure error) async {
    final envelope = await ref.read(offlineCacheProvider).getProfile();
    if (envelope == null) {
      return AuthSession(restoreError: error);
    }
    try {
      final user = AuthUser.fromJson(envelope.payload);
      return AuthSession.authenticated(user).copyWith(restoreError: error);
    } on FormatException {
      return AuthSession(restoreError: error);
    }
  }

  Future<void> logout() async {
    final previous = state.value ?? AuthSession.signedOut();
    state = AsyncData(
      previous.copyWith(submitting: true, clearActionError: true),
    );
    await ref.read(pushCoordinatorProvider).unregisterQuietly();
    await _forgetPrivate(discardIncidents: true);
    await ref.read(authRepositoryProvider).logout();
    state = AsyncData(AuthSession.signedOut());
  }

  Future<AuthUser> updateProfile({
    required String firstName,
    required String lastName,
  }) {
    return _run(
      () => ref
          .read(authRepositoryProvider)
          .updateProfile(firstName: firstName, lastName: lastName),
    );
  }

  Future<int> changePassword({
    required String currentPassword,
    required String newPassword,
  }) {
    return ref
        .read(authRepositoryProvider)
        .changePassword(
          currentPassword: currentPassword,
          newPassword: newPassword,
        );
  }

  Future<void> logoutAll() async {
    final previous = state.value ?? AuthSession.signedOut();
    state = AsyncData(
      previous.copyWith(submitting: true, clearActionError: true),
    );
    await ref.read(pushCoordinatorProvider).unregisterQuietly();
    await _forgetPrivate(discardIncidents: true);
    await ref.read(authRepositoryProvider).logoutAll();
    state = AsyncData(AuthSession.signedOut());
  }

  Future<AuthUser> confirmEmail({required String code, String? challengeId}) {
    return _run(
      () => ref
          .read(authRepositoryProvider)
          .confirmEmail(code: code, challengeId: challengeId),
    );
  }

  Future<AuthUser> confirmPhone({required String code, String? challengeId}) {
    return _run(
      () => ref
          .read(authRepositoryProvider)
          .confirmPhone(code: code, challengeId: challengeId),
    );
  }

  Future<String?> _knownUserId() async {
    final current = state.value?.user?.id;
    if (current != null && current.isNotEmpty) {
      return current;
    }
    return ref.read(offlineCacheProvider).cachedUserId();
  }

  Future<void> _dropOtherAccount(String? previousId, String nextId) async {
    if (previousId == null || previousId == nextId) {
      return;
    }
    await ref.read(offlineCoordinatorProvider).clearUser(previousId);
    await ref.read(telemetryProvider).discardIncidents();
  }

  Future<void> _forgetPrivate({required bool discardIncidents}) async {
    await PrivateSessionCleaner().forget(
      cache: ref.read(offlineCacheProvider),
      queue: ref.read(pendingQueueProvider),
      telemetry: discardIncidents ? ref.read(telemetryProvider) : null,
    );
    ref.read(connectivityMonitorProvider).setPendingCount(0);
  }

  Future<AuthUser> _run(Future<AuthUser> Function() action) async {
    final previous = state.value ?? AuthSession.signedOut();
    state = AsyncData(
      previous.copyWith(submitting: true, clearActionError: true),
    );
    try {
      final user = await action();
      state = AsyncData(AuthSession.authenticated(user));
      return user;
    } catch (error) {
      final failure = error is AppFailure
          ? error
          : UnexpectedFailure(message: error.toString());
      state = AsyncData(
        previous.copyWith(submitting: false, actionError: failure),
      );
      Error.throwWithStackTrace(failure, StackTrace.current);
    }
  }
}

final authControllerProvider =
    AsyncNotifierProvider<AuthController, AuthSession>(AuthController.new);
