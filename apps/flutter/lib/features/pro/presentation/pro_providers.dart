import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/providers.dart';
import '../../../core/errors/app_failure.dart';
import '../../../core/listing/public_ids.dart';
import '../../auth/presentation/auth_providers.dart';
import '../data/inquiry_repository.dart';
import '../data/pro_listings_repository.dart';
import '../data/publisher_analytics_repository.dart';
import '../domain/inquiry.dart';
import '../domain/inquiry_dashboard.dart';
import '../domain/listing_stats.dart';
import '../domain/managed_listing.dart';
import '../domain/pro_snapshots.dart';

final inquiryRepositoryProvider = Provider<InquiryRepository>((ref) {
  return InquiryRepository(
    client: ref.watch(apiClientProvider),
    endpoints: ref.watch(apiEndpointsProvider),
    sessionStore: ref.watch(sessionStoreProvider),
  );
});

final proListingsRepositoryProvider = Provider<ProListingsRepository>((ref) {
  return ProListingsRepository(
    client: ref.watch(apiClientProvider),
    endpoints: ref.watch(apiEndpointsProvider),
    sessionStore: ref.watch(sessionStoreProvider),
  );
});

final publisherAnalyticsRepositoryProvider =
    Provider<PublisherAnalyticsRepository>((ref) {
      return PublisherAnalyticsRepository(
        client: ref.watch(apiClientProvider),
        endpoints: ref.watch(apiEndpointsProvider),
        sessionStore: ref.watch(sessionStoreProvider),
      );
    });

class ProDashboardController extends AsyncNotifier<ProDashboardSnapshot> {
  @override
  Future<ProDashboardSnapshot> build() {
    return _load(AnalyticsWindow.days30);
  }

  Future<void> refresh() async {
    final window = state.value?.window ?? AnalyticsWindow.days30;
    state = await AsyncValue.guard(() => _load(window));
  }

  Future<void> setWindow(AnalyticsWindow window) async {
    state = await AsyncValue.guard(() => _load(window));
  }

  Future<ProDashboardSnapshot> _load(AnalyticsWindow window) async {
    final session = await ref.watch(authControllerProvider.future);
    if (!session.isAuthenticated) {
      throw const NeedsAuthFailure();
    }
    if (session.user?.isPublisher != true) {
      throw const HttpFailure(
        statusCode: 403,
        code: 'FORBIDDEN',
        message:
            'Cet espace est réservé aux propriétaires, agences et agents. '
            'L\'accès aux données reste contrôlé par le serveur.',
      );
    }
    final now = DateTime.now().toUtc();
    final days = switch (window) {
      AnalyticsWindow.days7 => 7,
      AnalyticsWindow.days30 => 30,
      AnalyticsWindow.days90 => 90,
    };
    final from = now.subtract(Duration(days: days));
    AppFailure? analyticsError;
    final loaded = await Future.wait<Object?>([
      ref.read(inquiryRepositoryProvider).dashboard(),
      () async {
        try {
          return await ref
              .read(publisherAnalyticsRepositoryProvider)
              .myListings(from: from, to: now);
        } catch (error) {
          analyticsError = _failure(error);
          return null;
        }
      }(),
    ]);
    return ProDashboardSnapshot(
      dashboard: loaded[0] as InquiryDashboard,
      analytics: loaded[1] as ListingStatsPage?,
      analyticsError: analyticsError,
      window: window,
    );
  }
}

class ProListingsController extends AsyncNotifier<ProListingsSnapshot> {
  var _loadingMore = false;
  var _mutating = false;

  @override
  Future<ProListingsSnapshot> build() async {
    final session = await ref.watch(authControllerProvider.future);
    if (!session.isAuthenticated) {
      throw const NeedsAuthFailure();
    }
    if (session.user?.isPublisher != true) {
      throw const HttpFailure(
        statusCode: 403,
        code: 'FORBIDDEN',
        message: 'Cet espace est réservé aux propriétaires, agences et agents.',
      );
    }
    return _fetch();
  }

  Future<void> refresh() async {
    final current = state.value;
    try {
      state = AsyncData(
        await _fetch(
          status: current?.status,
          listingType: current?.listingType,
        ),
      );
    } catch (error, stack) {
      state = AsyncError(_failure(error), stack);
    }
  }

  Future<void> setStatus(String? status) async {
    try {
      state = AsyncData(
        await _fetch(status: status, listingType: state.value?.listingType),
      );
    } catch (error, stack) {
      state = AsyncError(_failure(error), stack);
    }
  }

  Future<void> setListingType(String? listingType) async {
    try {
      state = AsyncData(
        await _fetch(status: state.value?.status, listingType: listingType),
      );
    } catch (error, stack) {
      state = AsyncError(_failure(error), stack);
    }
  }

  Future<void> loadMore() async {
    final current = state.value;
    if (current == null || !current.hasMore || _loadingMore) {
      return;
    }
    _loadingMore = true;
    state = AsyncData(current.copyWith(loadingMore: true));
    try {
      final page = await ref
          .read(proListingsRepositoryProvider)
          .list(
            cursor: current.nextCursor,
            status: current.status,
            listingType: current.listingType,
          );
      state = AsyncData(
        current.copyWith(
          items: [...current.items, ...page.items],
          nextCursor: page.nextCursor,
          loadingMore: false,
          clearCursor: page.nextCursor == null,
        ),
      );
    } catch (_) {
      state = AsyncData(current.copyWith(loadingMore: false));
    } finally {
      _loadingMore = false;
    }
  }

  Future<void> publish(String listingId) {
    return _mutate((repo) => repo.publish(listingId));
  }

  Future<void> pause(String listingId) {
    return _mutate((repo) => repo.pause(listingId));
  }

  Future<void> changeStatus(String listingId, String status) {
    return _mutate((repo) => repo.changeStatus(listingId, status));
  }

  Future<void> _mutate(
    Future<ManagedListing> Function(ProListingsRepository repo) action,
  ) async {
    final current = state.value;
    if (current == null || _mutating) {
      return;
    }
    _mutating = true;
    try {
      final listing = await action(ref.read(proListingsRepositoryProvider));
      state = AsyncData(
        current.copyWith(
          items: [
            for (final item in current.items)
              if (item.id == listing.id) listing else item,
          ],
          clearActionError: true,
        ),
      );
    } catch (error) {
      final failure = _failure(error);
      state = AsyncData(current.copyWith(actionError: failure));
      Error.throwWithStackTrace(failure, StackTrace.current);
    } finally {
      _mutating = false;
    }
  }

  Future<ProListingsSnapshot> _fetch({
    String? status,
    String? listingType,
  }) async {
    final page = await ref
        .read(proListingsRepositoryProvider)
        .list(status: status, listingType: listingType);
    return ProListingsSnapshot(
      items: page.items,
      nextCursor: page.nextCursor,
      status: status,
      listingType: listingType,
    );
  }
}

class ProLeadsController extends AsyncNotifier<ProLeadsSnapshot> {
  var _loadingMore = false;

  @override
  Future<ProLeadsSnapshot> build() async {
    final session = await ref.watch(authControllerProvider.future);
    if (!session.isAuthenticated) {
      throw const NeedsAuthFailure();
    }
    if (session.user?.isPublisher != true) {
      throw const HttpFailure(
        statusCode: 403,
        code: 'FORBIDDEN',
        message: 'Cet espace est réservé aux propriétaires, agences et agents.',
      );
    }
    return _fetch();
  }

  Future<void> refresh() async {
    final current = state.value;
    try {
      state = AsyncData(
        await _fetch(stage: current?.stage, query: current?.query),
      );
    } catch (error, stack) {
      state = AsyncError(_failure(error), stack);
    }
  }

  Future<void> setStage(String? stage) async {
    try {
      state = AsyncData(await _fetch(stage: stage, query: state.value?.query));
    } catch (error, stack) {
      state = AsyncError(_failure(error), stack);
    }
  }

  Future<void> setQuery(String? query) async {
    try {
      state = AsyncData(await _fetch(stage: state.value?.stage, query: query));
    } catch (error, stack) {
      state = AsyncError(_failure(error), stack);
    }
  }

  Future<void> loadMore() async {
    final current = state.value;
    if (current == null || !current.hasMore || _loadingMore) {
      return;
    }
    _loadingMore = true;
    state = AsyncData(
      ProLeadsSnapshot(
        items: current.items,
        nextCursor: current.nextCursor,
        stage: current.stage,
        query: current.query,
        loadingMore: true,
      ),
    );
    try {
      final page = await ref
          .read(inquiryRepositoryProvider)
          .list(
            cursor: current.nextCursor,
            stage: current.stage,
            q: current.query,
          );
      state = AsyncData(
        ProLeadsSnapshot(
          items: [...current.items, ...page.items],
          nextCursor: page.nextCursor,
          stage: current.stage,
          query: current.query,
        ),
      );
    } catch (_) {
      state = AsyncData(
        ProLeadsSnapshot(
          items: current.items,
          nextCursor: current.nextCursor,
          stage: current.stage,
          query: current.query,
        ),
      );
    } finally {
      _loadingMore = false;
    }
  }

  Future<ProLeadsSnapshot> _fetch({String? stage, String? query}) async {
    final page = await ref
        .read(inquiryRepositoryProvider)
        .list(stage: stage, q: query);
    return ProLeadsSnapshot(
      items: page.items,
      nextCursor: page.nextCursor,
      stage: stage,
      query: query,
    );
  }
}

class LeadController extends AsyncNotifier<Inquiry> {
  LeadController(this.inquiryId);

  final String inquiryId;

  @override
  Future<Inquiry> build() async {
    final session = await ref.watch(authControllerProvider.future);
    if (!session.isAuthenticated) {
      throw const NeedsAuthFailure();
    }
    if (session.user?.isPublisher != true) {
      throw const HttpFailure(
        statusCode: 403,
        code: 'FORBIDDEN',
        message: 'Cet espace est réservé aux propriétaires, agences et agents.',
      );
    }
    if (!PublicIds.isUuid(inquiryId)) {
      throw const InvalidInquiryIdFailure();
    }
    return ref.read(inquiryRepositoryProvider).getById(inquiryId);
  }

  Future<void> retry() async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(build);
  }

  Future<void> updateStage(String stage, {String? lostReason}) async {
    final inquiry = await ref
        .read(inquiryRepositoryProvider)
        .updateStage(
          inquiryId: inquiryId,
          stage: stage,
          lostReason: lostReason,
        );
    state = AsyncData(inquiry);
  }

  Future<void> addNote(String body) async {
    final inquiry = await ref
        .read(inquiryRepositoryProvider)
        .addNote(inquiryId: inquiryId, body: body);
    state = AsyncData(inquiry);
  }
}

final proDashboardControllerProvider =
    AsyncNotifierProvider<ProDashboardController, ProDashboardSnapshot>(
      ProDashboardController.new,
      retry: (_, _) => null,
    );

final proListingsControllerProvider =
    AsyncNotifierProvider<ProListingsController, ProListingsSnapshot>(
      ProListingsController.new,
      retry: (_, _) => null,
    );

final proLeadsControllerProvider =
    AsyncNotifierProvider<ProLeadsController, ProLeadsSnapshot>(
      ProLeadsController.new,
      retry: (_, _) => null,
    );

final leadControllerProvider =
    AsyncNotifierProvider.family<LeadController, Inquiry, String>(
      LeadController.new,
      retry: (_, _) => null,
    );

AppFailure _failure(Object error) {
  if (error is AppFailure) {
    return error;
  }
  return UnexpectedFailure(message: error.toString());
}
