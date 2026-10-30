import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/providers.dart';
import '../../../core/auth/auth_repository.dart';
import '../../../core/auth/auth_session.dart';
import '../../../core/auth/auth_user.dart';
import '../../../core/errors/app_failure.dart';
import '../../../core/offline/offline_providers.dart';
import '../../../core/offline/sync_rules.dart';
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
  @override
  Future<AuthSession> build() async {
    ref.watch(sessionEpochProvider);
    final store = ref.watch(sessionStoreProvider);
    final token = await store.readAccessToken();
    if (token == null || token.isEmpty) {
      return AuthSession.signedOut();
    }
    try {
      final user = await ref.read(authRepositoryProvider).me();
      return AuthSession.authenticated(user);
    } on HttpFailure catch (error) {
      if (error.isUnauthenticated) {
        await ref.read(offlineCacheProvider).clearSessionProfile();
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
  }) {
    return _run(
      () => ref
          .read(authRepositoryProvider)
          .login(identifier: identifier, password: password)
          .then((issued) => issued.user),
    );
  }

  Future<AuthUser> register({
    required String password,
    String? email,
    String? phone,
    String? firstName,
    String? lastName,
  }) {
    return _run(
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
    final userId = previous.user?.id;
    state = AsyncData(
      previous.copyWith(submitting: true, clearActionError: true),
    );
    await ref.read(pushCoordinatorProvider).unregisterQuietly();
    await ref.read(offlineCoordinatorProvider).clearUser(userId);
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
    await ref.read(offlineCoordinatorProvider).clearUser(previous.user?.id);
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
