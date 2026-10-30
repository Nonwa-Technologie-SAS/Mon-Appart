import 'package:flutter_test/flutter_test.dart';
import 'package:mon_appart/core/errors/app_failure.dart';
import 'package:mon_appart/core/offline/connectivity_monitor.dart';
import 'package:mon_appart/core/offline/connectivity_status.dart';

void main() {
  test('un succès API passe en ligne, un NetworkFailure en hors ligne', () {
    final monitor = ConnectivityMonitor(
      clock: () => DateTime.utc(2026, 10, 30),
    );
    expect(monitor.snapshot.kind, ConnectivityKind.unknown);
    monitor.recordSuccess();
    expect(monitor.snapshot.isOnline, isTrue);
    monitor.recordFailure(const NetworkFailure());
    expect(monitor.snapshot.kind, ConnectivityKind.offline);
  });

  test('timeout ≠ simple hors ligne : serveur injoignable', () {
    final monitor = ConnectivityMonitor(
      clock: () => DateTime.utc(2026, 10, 30),
    );
    monitor.recordFailure(const TimeoutFailure());
    expect(monitor.snapshot.kind, ConnectivityKind.unreachable);
  });

  test('sonde health : réseau présent mais backend KO', () async {
    final monitor = ConnectivityMonitor(
      clock: () => DateTime.utc(2026, 10, 30),
      probe: () async => false,
    );
    final ok = await monitor.checkBackend();
    expect(ok, isFalse);
    expect(monitor.snapshot.kind, ConnectivityKind.unreachable);
  });

  test('401 ne bascule pas la connectivité', () {
    final monitor = ConnectivityMonitor(
      clock: () => DateTime.utc(2026, 10, 30),
    );
    monitor.recordSuccess();
    monitor.recordFailure(
      const HttpFailure(statusCode: 401, message: 'expiré'),
    );
    expect(monitor.snapshot.isOnline, isTrue);
  });
}
