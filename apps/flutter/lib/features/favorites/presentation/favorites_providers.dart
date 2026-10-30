import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/providers.dart';
import '../../../core/errors/app_failure.dart';
import '../../../core/offline/offline_providers.dart';
import '../../../core/offline/pending_operation.dart';
import '../../../core/offline/sync_rules.dart';
import '../../auth/presentation/auth_providers.dart';
import '../../listing/data/favorite_repository.dart';
import '../../offline/offline_runtime.dart';
import '../domain/favorite_item.dart';
import '../domain/favorites_snapshot.dart';

final favoriteRepositoryProvider = Provider<FavoriteRepository>((ref) {
  return FavoriteRepository(
    client: ref.watch(apiClientProvider),
    endpoints: ref.watch(apiEndpointsProvider),
    sessionStore: ref.watch(sessionStoreProvider),
    cache: ref.watch(offlineCacheProvider),
  );
});

class FavoritesController extends AsyncNotifier<FavoritesSnapshot> {
  @override
  Future<FavoritesSnapshot> build() async {
    ref.watch(syncEpochProvider);
    final session = await ref.watch(authControllerProvider.future);
    if (!session.isAuthenticated) {
      return FavoritesSnapshot.empty;
    }
    final read = await ref.read(favoriteRepositoryProvider).readList();
    final queued = await _queuedIds(ref, session.user?.id);
    return FavoritesSnapshot(
      items: read.value,
      queued: queued,
      fromCache: read.fromCache,
      cachedAt: read.fetchedAt,
    );
  }

  Future<bool> toggle(
    String listingId, {
    required bool currentlyFavorite,
    String? title,
    String? propertyId,
  }) async {
    final repo = ref.read(favoriteRepositoryProvider);
    if (!await repo.hasSession) {
      throw const FavoriteNeedsAuthFailure();
    }
    final current = state.value ?? FavoritesSnapshot.empty;
    if (current.isBusy(listingId)) {
      return currentlyFavorite;
    }
    final target = !currentlyFavorite;
    state = AsyncData(
      _withFavorite(
        current.copyWith(pending: {...current.pending, listingId}),
        listingId,
        favorited: target,
        title: title,
        propertyId: propertyId,
      ),
    );
    try {
      if (target) {
        await repo.add(listingId);
      } else {
        await repo.remove(listingId);
      }
      await _persistSnapshot(
        listingId,
        favorited: target,
        title: title,
        propertyId: propertyId,
      );
      _settle(
        listingId,
        favorited: target,
        title: title,
        propertyId: propertyId,
      );
      return target;
    } on AppFailure catch (error) {
      if (SyncRules.isTransient(error)) {
        await _enqueue(
          listingId,
          add: target,
          title: title,
          propertyId: propertyId,
        );
        return target;
      }
      _settle(
        listingId,
        favorited: currentlyFavorite,
        title: title,
        propertyId: propertyId,
      );
      Error.throwWithStackTrace(error, StackTrace.current);
    } catch (error) {
      _settle(
        listingId,
        favorited: currentlyFavorite,
        title: title,
        propertyId: propertyId,
      );
      Error.throwWithStackTrace(
        UnexpectedFailure(message: error.toString()),
        StackTrace.current,
      );
    }
  }

  Future<void> _enqueue(
    String listingId, {
    required bool add,
    String? title,
    String? propertyId,
  }) async {
    final userId = ref.read(authControllerProvider).value?.user?.id;
    if (userId == null) {
      throw const FavoriteNeedsAuthFailure();
    }
    await ref
        .read(pendingQueueProvider)
        .enqueue(
          PendingOperation.create(
            userId: userId,
            type: add
                ? PendingOpType.favoriteAdd
                : PendingOpType.favoriteRemove,
            entityId: listingId,
            now: DateTime.now().toUtc(),
          ),
        );
    final latest = state.value ?? FavoritesSnapshot.empty;
    final next = _withFavorite(
      latest.copyWith(
        pending: {
          for (final id in latest.pending)
            if (id != listingId) id,
        },
        queued: {...latest.queued, listingId},
      ),
      listingId,
      favorited: add,
      title: title,
      propertyId: propertyId,
    );
    state = AsyncData(next);
    await _writeCache(userId, next.items);
    await ref.read(offlineCoordinatorProvider).drain();
  }

  Future<void> _persistSnapshot(
    String listingId, {
    required bool favorited,
    String? title,
    String? propertyId,
  }) async {
    final userId = ref.read(authControllerProvider).value?.user?.id;
    if (userId == null) {
      return;
    }
    final latest = state.value ?? FavoritesSnapshot.empty;
    final items = _withFavorite(
      latest,
      listingId,
      favorited: favorited,
      title: title,
      propertyId: propertyId,
    ).items;
    await _writeCache(userId, items);
  }

  Future<void> _writeCache(String userId, List<FavoriteItem> items) {
    return ref.read(offlineCacheProvider).putFavorites(userId, {
      'items': [for (final item in items) item.toJson()],
    });
  }

  FavoritesSnapshot _withFavorite(
    FavoritesSnapshot snapshot,
    String listingId, {
    required bool favorited,
    String? title,
    String? propertyId,
  }) {
    final without = [
      for (final item in snapshot.items)
        if (item.listingId != listingId) item,
    ];
    return snapshot.copyWith(
      items: favorited
          ? [
              ...without,
              FavoriteItem(
                listingId: listingId,
                propertyId: propertyId ?? listingId,
                title: title ?? 'Annonce',
              ),
            ]
          : without,
    );
  }

  void _settle(
    String listingId, {
    required bool favorited,
    String? title,
    String? propertyId,
  }) {
    final latest = state.value ?? FavoritesSnapshot.empty;
    state = AsyncData(
      _withFavorite(
        latest.copyWith(
          pending: {
            for (final id in latest.pending)
              if (id != listingId) id,
          },
        ),
        listingId,
        favorited: favorited,
        title: title,
        propertyId: propertyId,
      ),
    );
  }
}

final favoritesControllerProvider =
    AsyncNotifierProvider<FavoritesController, FavoritesSnapshot>(
      FavoritesController.new,
    );

Future<Set<String>> _queuedIds(Ref ref, String? userId) async {
  if (userId == null) {
    return const {};
  }
  final open = await ref.read(pendingQueueProvider).openFor(userId);
  return {
    for (final op in open)
      if (op.type == PendingOpType.favoriteAdd ||
          op.type == PendingOpType.favoriteRemove)
        op.entityId,
  };
}
