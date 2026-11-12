import '../../../core/errors/app_failure.dart';
import 'visit.dart';

enum VisitListScope { upcoming, past }

class VisitsSnapshot {
  const VisitsSnapshot({
    required this.items,
    required this.scope,
    this.actionError,
    this.fromCache = false,
    this.cachedAt,
  });

  static const emptyUpcoming = VisitsSnapshot(
    items: [],
    scope: VisitListScope.upcoming,
  );

  final List<Visit> items;
  final VisitListScope scope;
  final AppFailure? actionError;
  final bool fromCache;
  final DateTime? cachedAt;

  VisitsSnapshot copyWith({
    List<Visit>? items,
    VisitListScope? scope,
    AppFailure? actionError,
    bool clearActionError = false,
    bool? fromCache,
    DateTime? cachedAt,
  }) {
    return VisitsSnapshot(
      items: items ?? this.items,
      scope: scope ?? this.scope,
      actionError: clearActionError ? null : (actionError ?? this.actionError),
      fromCache: fromCache ?? this.fromCache,
      cachedAt: cachedAt ?? this.cachedAt,
    );
  }
}

class VisitDetailSnapshot {
  const VisitDetailSnapshot({
    required this.visit,
    this.submitting = false,
    this.actionError,
    this.fromCache = false,
    this.cachedAt,
  });

  final Visit visit;
  final bool submitting;
  final AppFailure? actionError;
  final bool fromCache;
  final DateTime? cachedAt;

  VisitDetailSnapshot copyWith({
    Visit? visit,
    bool? submitting,
    AppFailure? actionError,
    bool clearActionError = false,
    bool? fromCache,
    DateTime? cachedAt,
  }) {
    return VisitDetailSnapshot(
      visit: visit ?? this.visit,
      submitting: submitting ?? this.submitting,
      actionError: clearActionError ? null : (actionError ?? this.actionError),
      fromCache: fromCache ?? this.fromCache,
      cachedAt: cachedAt ?? this.cachedAt,
    );
  }
}
