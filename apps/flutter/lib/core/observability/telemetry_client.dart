import 'dart:async';
import 'dart:convert';
import 'dart:math';

import '../../app/config/app_environment.dart';
import '../logging/app_logger.dart';
import '../offline/key_value_store.dart';
import '../offline/sync_engine.dart';
import 'app_build.dart';
import 'telemetry_buffer.dart';
import 'telemetry_event.dart';
import 'telemetry_policy.dart';
import 'telemetry_redactor.dart';

/// Collecte locale. Aucun envoi réseau : aucun fournisseur n'est configuré.
class TelemetryClient {
  TelemetryClient({
    required AppEnvironment environment,
    required this._logs,
    required this.sessionId,
    this._store,
    DateTime Function()? clock,
    double Function()? roll,
    this.enabled = true,
    TelemetryPolicy? policy,
  }) : _environment = environment,
       _clock = clock ?? DateTime.now,
       _roll = roll ?? _defaultRoll,
       _policy = policy ?? TelemetryPolicy.forEnvironment(environment);

  static const _incidentKey = 'telemetry/incidents';

  final AppEnvironment _environment;
  final AppLogger _logs;
  final KeyValueStore? _store;
  final DateTime Function() _clock;
  final double Function() _roll;
  final TelemetryPolicy _policy;
  final TelemetryBuffer _buffer = TelemetryBuffer();
  final bool enabled;
  final String sessionId;

  String? _role;
  String? _platform;
  var _startupRecorded = false;
  Future<void> _writes = Future<void>.value();

  List<TelemetryEvent> get events => _buffer.items;

  /// Attend les écritures d'incidents. Utile aux tests.
  Future<void> get pendingWrites => _writes;

  void setRole(String? role) {
    final trimmed = role?.trim();
    _role = (trimmed == null || trimmed.isEmpty) ? null : trimmed;
  }

  void clearRole() {
    _role = null;
  }

  /// Oublie les incidents de la session. Aucun jeton n'est concerné.
  Future<void> discardIncidents() {
    _buffer.clear();
    final store = _store;
    if (store == null) {
      return Future<void>.value();
    }
    final done = _writes.then((_) => store.delete(_incidentKey));
    _writes = done.then((_) {}, onError: (_) {});
    return done;
  }

  void setPlatform(String platform) {
    _platform = platform;
  }

  void record({
    required TelemetrySeverity severity,
    required TelemetryKind kind,
    required String operation,
    required String message,
    String? correlationId,
    Map<String, Object?> attributes = const {},
  }) {
    if (!enabled) {
      return;
    }
    try {
      final now = _clock().toUtc();
      final safeAttributes = redactAttributes(attributes);
      final fingerprint = [
        kind.name,
        operation,
        safeAttributes['status']?.toString() ?? '',
        safeAttributes['path']?.toString() ?? '',
        safeAttributes['code']?.toString() ?? '',
      ].join('|');
      final event = redactEvent(
        TelemetryEvent(
          at: now,
          severity: severity,
          kind: kind,
          operation: operation,
          message: message,
          fingerprint: fingerprint,
          sessionId: sessionId,
          environment: _environment.name,
          appVersion: AppBuild.label,
          correlationId: correlationId,
          role: _role,
          platform: _platform,
          attributes: safeAttributes,
        ),
      );
      if (!_policy.keep(event.severity, _roll())) {
        return;
      }
      final stored = _buffer.add(event, now: now);
      _logs.debug(
        'telemetry ${stored.severity.name} ${stored.kind.name} '
        '${stored.operation} x${stored.count}',
      );
      if (stored.severity == TelemetrySeverity.high ||
          stored.severity == TelemetrySeverity.critical) {
        _remember(stored);
      }
    } catch (_) {
      // La télémétrie ne doit jamais casser l'application.
    }
  }

  void recordStartup(Duration elapsed) {
    if (_startupRecorded) {
      return;
    }
    _startupRecorded = true;
    record(
      severity: TelemetrySeverity.low,
      kind: TelemetryKind.performance,
      operation: 'startup.firstFrame',
      message: 'Premier frame Flutter après le démarrage du socle.',
      attributes: {
        'elapsedMs': elapsed.inMilliseconds,
        'budgetMs': TelemetryBudgets.startupToFirstFrame.inMilliseconds,
        'overBudget': elapsed > TelemetryBudgets.startupToFirstFrame,
      },
    );
  }

  void recordSync({
    required SyncReport report,
    required Duration elapsed,
    required int pending,
    required String connectivity,
  }) {
    final failed = report.failedPermanent > 0 || report.stoppedForAuth;
    record(
      severity: report.stoppedForAuth
          ? TelemetrySeverity.high
          : failed
          ? TelemetrySeverity.medium
          : TelemetrySeverity.low,
      kind: TelemetryKind.sync,
      operation: 'offline.drain',
      message: 'Synchronisation des opérations en attente.',
      attributes: {
        'synced': report.synced,
        'failedTemporary': report.failedTemporary,
        'failedPermanent': report.failedPermanent,
        'conflicts': report.conflicts,
        'skipped': report.skipped,
        'pending': pending,
        'elapsedMs': elapsed.inMilliseconds,
        'connectivity': connectivity,
        'authStopped': report.stoppedForAuth,
      },
    );
  }

  void _remember(TelemetryEvent event) {
    final store = _store;
    if (store == null) {
      return;
    }
    _writes = _writes
        .then((_) async {
          final current = await _readIncidents(store);
          final next = [...current, event.toJson()];
          final kept = next.length > TelemetryBudgets.maxIncidents
              ? next.sublist(next.length - TelemetryBudgets.maxIncidents)
              : next;
          await store.write(_incidentKey, jsonEncode(kept));
        })
        .catchError((_) {});
  }

  Future<List<Object?>> _readIncidents(KeyValueStore store) async {
    final raw = await store.read(_incidentKey);
    if (raw == null || raw.isEmpty) {
      return const [];
    }
    try {
      final decoded = jsonDecode(raw);
      if (decoded is List) {
        return decoded;
      }
    } on FormatException {
      return const [];
    }
    return const [];
  }
}

final _random = Random();

double _defaultRoll() => _random.nextDouble();
