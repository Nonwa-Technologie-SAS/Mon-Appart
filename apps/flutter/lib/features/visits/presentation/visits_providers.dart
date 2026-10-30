import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/providers.dart';
import '../../../core/errors/app_failure.dart';
import '../../../core/offline/offline_providers.dart';
import '../../../core/listing/public_ids.dart';
import '../../auth/presentation/auth_providers.dart';
import '../../messaging/data/messaging_realtime.dart';
import '../../messaging/presentation/messaging_providers.dart';
import '../data/visit_repository.dart';
import '../domain/visit.dart';
import '../domain/visits_snapshot.dart';

final visitRepositoryProvider = Provider<VisitRepository>((ref) {
  return VisitRepository(
    client: ref.watch(apiClientProvider),
    endpoints: ref.watch(apiEndpointsProvider),
    sessionStore: ref.watch(sessionStoreProvider),
    cache: ref.watch(offlineCacheProvider),
  );
});

class VisitsController extends AsyncNotifier<VisitsSnapshot> {
  StreamSubscription<MessagingRealtimeEvent>? _realtime;

  @override
  Future<VisitsSnapshot> build() async {
    unawaited(_realtime?.cancel());
    ref.onDispose(() => unawaited(_realtime?.cancel()));
    final session = await ref.watch(authControllerProvider.future);
    if (!session.isAuthenticated) {
      return VisitsSnapshot.emptyUpcoming;
    }
    _realtime = ref.read(messagingRealtimeProvider).events.listen(_onRealtime);
    return _fetch(VisitListScope.upcoming);
  }

  Future<void> refresh() async {
    final current = state.value;
    final session = ref.read(authControllerProvider).value;
    if (session?.isAuthenticated != true) {
      state = const AsyncData(VisitsSnapshot.emptyUpcoming);
      return;
    }
    try {
      state = AsyncData(
        await _fetch(current?.scope ?? VisitListScope.upcoming),
      );
    } catch (error, stack) {
      state = AsyncError(_failure(error), stack);
    }
  }

  Future<void> setScope(VisitListScope scope) async {
    final current = state.value;
    if (current != null && current.scope == scope) {
      return;
    }
    if (current != null) {
      state = AsyncData(current.copyWith(scope: scope, items: const []));
    }
    try {
      state = AsyncData(await _fetch(scope));
    } catch (error, stack) {
      state = AsyncError(_failure(error), stack);
    }
  }

  void upsert(Visit visit) {
    final current = state.value;
    if (current == null) {
      return;
    }
    state = AsyncData(
      current.copyWith(
        items: _merge(current.items, visit),
        clearActionError: true,
      ),
    );
  }

  Future<VisitsSnapshot> _fetch(VisitListScope scope) async {
    final read = await ref.read(visitRepositoryProvider).readList(scope: scope);
    final sorted = [...read.value]
      ..sort((a, b) {
        final compared = a.scheduledAt.compareTo(b.scheduledAt);
        return scope == VisitListScope.past ? -compared : compared;
      });
    return VisitsSnapshot(
      items: sorted,
      scope: scope,
      fromCache: read.fromCache,
      cachedAt: read.fetchedAt,
    );
  }

  void _onRealtime(MessagingRealtimeEvent event) {
    switch (event) {
      case RealtimeAppointmentHint():
        unawaited(refresh());
      case RealtimeMessageHint():
      case RealtimeConversationHint():
      case RealtimeUnreadHint():
        break;
    }
  }

  static List<Visit> _merge(List<Visit> items, Visit incoming) {
    final next = [
      for (final item in items)
        if (item.id != incoming.id) item,
      incoming,
    ];
    next.sort((a, b) => a.scheduledAt.compareTo(b.scheduledAt));
    return next;
  }
}

class VisitController extends AsyncNotifier<VisitDetailSnapshot> {
  VisitController(this.appointmentId);

  final String appointmentId;
  StreamSubscription<MessagingRealtimeEvent>? _realtime;

  @override
  Future<VisitDetailSnapshot> build() async {
    unawaited(_realtime?.cancel());
    ref.onDispose(() => unawaited(_realtime?.cancel()));
    final session = await ref.watch(authControllerProvider.future);
    if (!session.isAuthenticated) {
      throw const NeedsAuthFailure();
    }
    if (!PublicIds.isUuid(appointmentId)) {
      throw const InvalidAppointmentIdFailure();
    }
    _realtime = ref.read(messagingRealtimeProvider).events.listen(_onRealtime);
    final read = await ref
        .read(visitRepositoryProvider)
        .readById(appointmentId);
    return VisitDetailSnapshot(
      visit: read.value,
      fromCache: read.fromCache,
      cachedAt: read.fetchedAt,
    );
  }

  Future<void> retry() async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(build);
  }

  Future<void> confirm() => _run((repo) => repo.confirm(appointmentId));

  Future<void> reschedule(DateTime scheduledAt) {
    return _run((repo) => repo.reschedule(appointmentId, scheduledAt));
  }

  Future<void> cancel(String reason) {
    return _run((repo) => repo.cancel(appointmentId, reason));
  }

  Future<void> complete() => _run((repo) => repo.complete(appointmentId));

  Future<void> noShow() => _run((repo) => repo.noShow(appointmentId));

  Future<void> submitFeedback({
    required String outcome,
    bool shareOutcomeWithOwner = false,
  }) {
    return _run(
      (repo) => repo.submitFeedback(
        appointmentId: appointmentId,
        outcome: outcome,
        shareOutcomeWithOwner: shareOutcomeWithOwner,
      ),
    );
  }

  Future<void> _run(Future<Visit> Function(VisitRepository repo) action) async {
    final current = state.value;
    if (current == null || current.submitting) {
      return;
    }
    state = AsyncData(
      current.copyWith(submitting: true, clearActionError: true),
    );
    try {
      final visit = await action(ref.read(visitRepositoryProvider));
      state = AsyncData(VisitDetailSnapshot(visit: visit));
      ref.read(visitsControllerProvider.notifier).upsert(visit);
    } catch (error) {
      final latest = state.value ?? current;
      final failure = _failure(error);
      state = AsyncData(
        latest.copyWith(submitting: false, actionError: failure),
      );
      Error.throwWithStackTrace(failure, StackTrace.current);
    }
  }

  void _onRealtime(MessagingRealtimeEvent event) {
    switch (event) {
      case RealtimeAppointmentHint(:final appointmentId)
          when appointmentId == this.appointmentId:
        unawaited(_reloadQuiet());
      case RealtimeAppointmentHint():
      case RealtimeMessageHint():
      case RealtimeConversationHint():
      case RealtimeUnreadHint():
        break;
    }
  }

  Future<void> _reloadQuiet() async {
    try {
      final visit = await ref
          .read(visitRepositoryProvider)
          .getById(appointmentId);
      final current = state.value;
      state = AsyncData(
        VisitDetailSnapshot(
          visit: visit,
          submitting: current?.submitting ?? false,
        ),
      );
      ref.read(visitsControllerProvider.notifier).upsert(visit);
    } catch (_) {}
  }
}

final visitsControllerProvider =
    AsyncNotifierProvider<VisitsController, VisitsSnapshot>(
      VisitsController.new,
      retry: (_, _) => null,
    );

final visitControllerProvider =
    AsyncNotifierProvider.family<VisitController, VisitDetailSnapshot, String>(
      VisitController.new,
      retry: (_, _) => null,
    );

AppFailure _failure(Object error) {
  if (error is AppFailure) {
    return error;
  }
  return UnexpectedFailure(message: error.toString());
}
