import 'package:flutter_test/flutter_test.dart';
import 'package:mon_appart/app/config/app_environment.dart';
import 'package:mon_appart/core/logging/app_logger.dart';
import 'package:mon_appart/core/observability/frame_window.dart';
import 'package:mon_appart/core/observability/telemetry_client.dart';
import 'package:mon_appart/core/observability/telemetry_event.dart';
import 'package:mon_appart/core/observability/telemetry_policy.dart';
import 'package:mon_appart/core/observability/telemetry_redactor.dart';
import 'package:mon_appart/core/offline/memory_key_value_store.dart';
import 'package:mon_appart/core/offline/sync_engine.dart';

TelemetryClient client({
  AppEnvironment environment = AppEnvironment.local,
  double roll = 0,
  bool enabled = true,
  MemoryKeyValueStore? store,
}) {
  return TelemetryClient(
    environment: environment,
    logs: const AppLogger(enabled: false),
    sessionId: 'session-1',
    store: store,
    clock: () => DateTime.utc(2026, 11, 5, 10),
    roll: () => roll,
    enabled: enabled,
    policy: TelemetryPolicy.forEnvironment(environment),
  );
}

void main() {
  test('masque e-mail, bearer et secrets dans le message', () {
    final text = redactText(
      'contact a@b.ci Bearer abc.def password=secret /Users/Awa/app',
    );
    expect(text.contains('a@b.ci'), isFalse);
    expect(text.contains('abc.def'), isFalse);
    expect(text.contains('secret'), isFalse);
    expect(text.contains('Awa'), isFalse);
    expect(text, contains('Bearer ***'));
    expect(text, contains('password=***'));
  });

  test('retire la query et les UUID du chemin', () {
    expect(
      redactPath(
        '/api/v1/listings/11111111-1111-4111-8111-111111111111?token=abc',
      ),
      '/api/v1/listings/:id',
    );
  });

  test(
    'une erreur haute est conservée en production, une erreur basse non',
    () {
      final production = client(
        environment: AppEnvironment.production,
        roll: 0.5,
      );
      production.record(
        severity: TelemetrySeverity.critical,
        kind: TelemetryKind.crash,
        operation: 'flutter.async',
        message: 'boom',
      );
      production.record(
        severity: TelemetrySeverity.low,
        kind: TelemetryKind.navigation,
        operation: 'navigation.open',
        message: 'écran',
        attributes: {'path': '/home'},
      );
      expect(production.events, hasLength(1));
      expect(production.events.single.severity, TelemetrySeverity.critical);
    },
  );

  test('désactivée, la collecte ne garde rien', () {
    final silent = client(enabled: false);
    silent.record(
      severity: TelemetrySeverity.critical,
      kind: TelemetryKind.crash,
      operation: 'flutter.async',
      message: 'boom',
    );
    expect(silent.events, isEmpty);
  });

  test('déduplique la même empreinte dans la fenêtre', () {
    final local = client();
    local.record(
      severity: TelemetrySeverity.high,
      kind: TelemetryKind.network,
      operation: 'http.GET',
      message: 'Appel API',
      attributes: {'path': '/api/v1/listings/:id', 'status': 503},
    );
    local.record(
      severity: TelemetrySeverity.high,
      kind: TelemetryKind.network,
      operation: 'http.GET',
      message: 'Appel API',
      attributes: {'path': '/api/v1/listings/:id', 'status': 503},
    );
    expect(local.events, hasLength(1));
    expect(local.events.single.count, 2);
  });

  test(
    'n\'écrit pas le mot de passe et persiste seulement le niveau haut',
    () async {
      final store = MemoryKeyValueStore();
      final local = client(store: store);
      local.record(
        severity: TelemetrySeverity.high,
        kind: TelemetryKind.error,
        operation: 'media.upload',
        message: 'échec password=secret pour a@b.ci',
        attributes: {'password': 'secret', 'status': 500},
      );
      local.record(
        severity: TelemetrySeverity.low,
        kind: TelemetryKind.performance,
        operation: 'startup.firstFrame',
        message: 'frame',
      );
      await local.pendingWrites;
      expect(local.events.first.message.contains('secret'), isFalse);
      expect(local.events.first.attributes.containsKey('password'), isFalse);
      final raw = await store.read('telemetry/incidents');
      expect(raw, isNotNull);
      expect(raw!.contains('secret'), isFalse);
      expect(raw.contains('startup.firstFrame'), isFalse);
    },
  );

  test('la synchro hors ligne distingue l\'absence de réseau', () {
    final local = client();
    local.recordSync(
      report: const SyncReport(failedTemporary: 1),
      elapsed: const Duration(milliseconds: 40),
      pending: 2,
      connectivity: 'unreachable',
    );
    final event = local.events.single;
    expect(event.kind, TelemetryKind.sync);
    expect(event.attributes['connectivity'], 'unreachable');
    expect(event.attributes['failedTemporary'], 1);
    expect(event.attributes['pending'], 2);
  });

  test('la déconnexion retire le rôle', () {
    final local = client();
    local.setRole('OWNER');
    local.record(
      severity: TelemetrySeverity.low,
      kind: TelemetryKind.navigation,
      operation: 'navigation.open',
      message: 'écran',
    );
    expect(local.events.single.role, 'OWNER');
    local.clearRole();
    local.record(
      severity: TelemetrySeverity.low,
      kind: TelemetryKind.navigation,
      operation: 'navigation.other',
      message: 'autre',
      attributes: {'path': '/account'},
    );
    expect(local.events.last.role, isNull);
  });

  test('le résumé de frames ne compte pas chaque image', () {
    final window = FrameWindow();
    window.add(const Duration(milliseconds: 10));
    window.add(const Duration(milliseconds: 40));
    expect(window.total, 2);
    expect(window.slow, 1);
    expect(window.shouldFlush, isFalse);
  });
}
