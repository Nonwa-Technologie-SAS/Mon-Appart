import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mon_appart/app/config/app_environment.dart';
import 'package:mon_appart/core/logging/app_logger.dart';
import 'package:mon_appart/core/observability/telemetry_client.dart';
import 'package:mon_appart/core/observability/telemetry_event.dart';
import 'package:mon_appart/core/offline/memory_key_value_store.dart';
import 'package:mon_appart/core/offline/offline_cache.dart';
import 'package:mon_appart/core/offline/pending_operation.dart';
import 'package:mon_appart/core/offline/pending_queue.dart';
import 'package:mon_appart/core/security/auth_failure_signal.dart';
import 'package:mon_appart/core/security/private_session_cleaner.dart';
import 'package:mon_appart/core/security/profile_cache_projection.dart';
import 'package:mon_appart/core/security/screen_privacy.dart';

void main() {
  test('le cache disque retire e-mail, téléphone et secrets', () {
    final stored = profileForDisk({
      'id': 'user-1',
      'firstName': 'Awa',
      'email': 'awa@example.ci',
      'phone': '+2250102030405',
      'password': 'secret',
      'accessToken': 'jeton',
    });
    expect(stored['id'], 'user-1');
    expect(stored['firstName'], 'Awa');
    expect(stored.containsKey('email'), isFalse);
    expect(stored.containsKey('phone'), isFalse);
    expect(stored.containsKey('password'), isFalse);
    expect(stored.containsKey('accessToken'), isFalse);
  });

  test(
    'la déconnexion efface le privé et garde les annonces publiques',
    () async {
      final store = MemoryKeyValueStore();
      final cache = OfflineCache(store: store);
      final queue = PendingQueue(store: store);
      await cache.putProfile({
        'id': 'user-1',
        'email': 'awa@example.ci',
        'phone': '+2250102030405',
        'firstName': 'Awa',
      });
      await cache.putFavorites('user-1', {
        'ids': <String>['listing-1'],
      });
      await cache.putListing('listing-1', {
        'id': 'listing-1',
        'title': 'Studio',
      });
      await queue.enqueue(
        PendingOperation.create(
          userId: 'user-1',
          type: PendingOpType.favoriteAdd,
          entityId: 'listing-1',
          now: DateTime.utc(2026, 11, 5),
          idFactory: () => 'op-1',
        ),
      );
      final telemetry = TelemetryClient(
        environment: AppEnvironment.local,
        logs: const AppLogger(enabled: false),
        sessionId: 'session-1',
        store: store,
        roll: () => 0,
      );
      telemetry.record(
        severity: TelemetrySeverity.high,
        kind: TelemetryKind.auth,
        operation: 'auth.repeated_failure',
        message: 'Plusieurs échecs.',
      );
      await telemetry.pendingWrites;

      await PrivateSessionCleaner().forget(
        cache: cache,
        queue: queue,
        telemetry: telemetry,
      );

      expect(await cache.getProfile(), isNull);
      expect(await cache.getFavorites('user-1'), isNull);
      expect((await cache.getListing('listing-1'))?.payload['title'], 'Studio');
      expect(await queue.list(userId: 'user-1'), isEmpty);
      expect(await store.read('telemetry/incidents'), isNull);
      expect(telemetry.events, isEmpty);
    },
  );

  test(
    'cinq échecs de connexion déclenchent le signal, un succès le remet à zéro',
    () {
      final signal = AuthFailureSignal();
      for (var i = 0; i < 4; i++) {
        expect(signal.failure(), isFalse);
      }
      expect(signal.failure(), isTrue);
      expect(signal.count, 5);
      signal.success();
      expect(signal.count, 0);
    },
  );

  testWidgets('un écran sensible est couvert hors premier plan', (
    tester,
  ) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          screenPrivacySyncProvider.overrideWithValue((_) async {}),
        ],
        child: const MaterialApp(
          builder: _overlay,
          home: SensitiveSurface(child: Text('code secret')),
        ),
      ),
    );
    await tester.pump();
    expect(find.text('code secret'), findsOneWidget);
    expect(find.byKey(screenPrivacyCoverKey), findsNothing);

    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.inactive);
    await tester.pump();
    expect(find.byKey(screenPrivacyCoverKey), findsOneWidget);

    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
    await tester.pump();
    expect(find.byKey(screenPrivacyCoverKey), findsNothing);
  });
}

Widget _overlay(BuildContext context, Widget? child) {
  return ScreenPrivacyOverlay(child: child ?? const SizedBox.shrink());
}
