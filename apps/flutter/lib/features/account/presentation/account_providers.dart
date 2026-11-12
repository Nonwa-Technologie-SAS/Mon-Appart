import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/providers.dart';
import '../../../core/errors/app_failure.dart';
import '../../../core/offline/offline_providers.dart';
import '../../../core/offline/pending_operation.dart';
import '../../../core/offline/sync_rules.dart';
import '../../auth/presentation/auth_providers.dart';
import '../../home/presentation/home_feed_providers.dart';
import '../../offline/offline_runtime.dart';
import '../data/account_session_repository.dart';
import '../data/housing_preference_repository.dart';
import '../data/notification_preference_repository.dart';
import '../data/saved_search_repository.dart';
import '../domain/account_session.dart';
import '../domain/housing_preferences.dart';
import '../domain/notification_pref.dart';
import '../domain/saved_search_item.dart';

final housingPreferenceRepositoryProvider =
    Provider<HousingPreferenceRepository>((ref) {
      return HousingPreferenceRepository(
        client: ref.watch(apiClientProvider),
        endpoints: ref.watch(apiEndpointsProvider),
        cache: ref.watch(offlineCacheProvider),
      );
    });

final savedSearchRepositoryProvider = Provider<SavedSearchRepository>((ref) {
  return SavedSearchRepository(
    client: ref.watch(apiClientProvider),
    endpoints: ref.watch(apiEndpointsProvider),
    cache: ref.watch(offlineCacheProvider),
  );
});

final notificationPreferenceRepositoryProvider =
    Provider<NotificationPreferenceRepository>((ref) {
      return NotificationPreferenceRepository(
        client: ref.watch(apiClientProvider),
        endpoints: ref.watch(apiEndpointsProvider),
      );
    });

final accountSessionRepositoryProvider = Provider<AccountSessionRepository>((
  ref,
) {
  return AccountSessionRepository(
    client: ref.watch(apiClientProvider),
    endpoints: ref.watch(apiEndpointsProvider),
  );
});

class HousingPreferencesController extends AsyncNotifier<HousingPreferences> {
  @override
  Future<HousingPreferences> build() {
    ref.watch(syncEpochProvider);
    return ref.read(housingPreferenceRepositoryProvider).get();
  }

  Future<HousingPreferences> save(HousingPreferences draft) async {
    try {
      final saved = await ref
          .read(housingPreferenceRepositoryProvider)
          .replace(draft);
      state = AsyncData(saved);
      ref.invalidate(recommendationFeedProvider);
      return saved;
    } on AppFailure catch (error) {
      if (!SyncRules.isTransient(error)) {
        rethrow;
      }
      final userId = ref.read(authControllerProvider).value?.user?.id;
      if (userId == null) {
        rethrow;
      }
      await ref
          .read(pendingQueueProvider)
          .enqueue(
            PendingOperation.create(
              userId: userId,
              type: PendingOpType.preferencesPut,
              entityId: 'preferences',
              payload: draft.toPutBody(),
              now: DateTime.now().toUtc(),
            ),
          );
      await ref
          .read(offlineCacheProvider)
          .putPreferences(userId, draft.toCacheJson());
      state = AsyncData(draft);
      await ref.read(offlineCoordinatorProvider).drain();
      return draft;
    }
  }
}

final housingPreferencesControllerProvider =
    AsyncNotifierProvider<HousingPreferencesController, HousingPreferences>(
      HousingPreferencesController.new,
    );

class SavedSearchesController extends AsyncNotifier<List<SavedSearchItem>> {
  @override
  Future<List<SavedSearchItem>> build() {
    return ref.read(savedSearchRepositoryProvider).list();
  }

  Future<SavedSearchItem> create({
    required String name,
    required Map<String, String> params,
    required bool alertsEnabled,
    required String frequency,
  }) async {
    final created = await ref
        .read(savedSearchRepositoryProvider)
        .create(
          name: name,
          params: params,
          alertsEnabled: alertsEnabled,
          frequency: frequency,
        );
    final current = state.value ?? const <SavedSearchItem>[];
    state = AsyncData([created, ...current]);
    return created;
  }

  Future<SavedSearchItem> patch(
    String id, {
    String? name,
    Map<String, String>? params,
    bool? alertsEnabled,
    String? frequency,
  }) async {
    final updated = await ref
        .read(savedSearchRepositoryProvider)
        .update(
          id,
          name: name,
          params: params,
          alertsEnabled: alertsEnabled,
          frequency: frequency,
        );
    final current = state.value ?? const <SavedSearchItem>[];
    state = AsyncData([
      for (final item in current)
        if (item.id == id) updated else item,
    ]);
    return updated;
  }

  Future<void> remove(String id) async {
    await ref.read(savedSearchRepositoryProvider).remove(id);
    final current = state.value ?? const <SavedSearchItem>[];
    state = AsyncData([
      for (final item in current)
        if (item.id != id) item,
    ]);
  }
}

final savedSearchesControllerProvider =
    AsyncNotifierProvider<SavedSearchesController, List<SavedSearchItem>>(
      SavedSearchesController.new,
    );

class NotificationPreferencesController
    extends AsyncNotifier<List<NotificationPrefCell>> {
  @override
  Future<List<NotificationPrefCell>> build() {
    return ref.read(notificationPreferenceRepositoryProvider).list();
  }

  Future<void> setEnabled(NotificationPrefCell cell, bool enabled) async {
    final items = await ref
        .read(notificationPreferenceRepositoryProvider)
        .update([cell.toChange(enabled: enabled)]);
    state = AsyncData(items);
  }
}

final notificationPreferencesControllerProvider =
    AsyncNotifierProvider<
      NotificationPreferencesController,
      List<NotificationPrefCell>
    >(NotificationPreferencesController.new);

class AccountSessionsController
    extends AsyncNotifier<List<AccountDeviceSession>> {
  @override
  Future<List<AccountDeviceSession>> build() {
    return ref.read(accountSessionRepositoryProvider).list();
  }

  Future<void> revoke(String sessionId) async {
    await ref.read(accountSessionRepositoryProvider).revoke(sessionId);
    final current = state.value ?? const <AccountDeviceSession>[];
    state = AsyncData([
      for (final item in current)
        if (item.id != sessionId) item,
    ]);
  }
}

final accountSessionsControllerProvider =
    AsyncNotifierProvider<
      AccountSessionsController,
      List<AccountDeviceSession>
    >(AccountSessionsController.new);
