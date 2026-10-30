import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mon_appart/core/errors/app_failure.dart';
import 'package:mon_appart/core/offline/connectivity_monitor.dart';
import 'package:mon_appart/core/offline/offline_providers.dart';

import '../helpers/fake_api_client.dart';
import '../helpers/listing_fixtures.dart';
import '../helpers/test_app.dart';

Future<void> pumpFrames(WidgetTester tester, {int times = 8}) async {
  for (var i = 0; i < times; i++) {
    await tester.pump(const Duration(milliseconds: 16));
  }
}

void main() {
  testWidgets('affiche un bandeau hors ligne et des annonces en cache', (
    tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(400, 1600));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    final monitor = ConnectivityMonitor(
      clock: () => DateTime.utc(2026, 10, 30, 12),
      probe: () async => false,
    );
    monitor.recordFailure(const NetworkFailure());
    var firstSearch = true;
    final client = FakeApiClient(
      serveHealthLive: false,
      handler: (uri) async {
        if (uri.path.endsWith('/search') ||
            uri.path.endsWith('/recommendations')) {
          if (firstSearch) {
            firstSearch = false;
            return catalogHandler(
              uri,
              search: searchResponseJson(),
              recommendations: recommendationResponseJson(),
            );
          }
          throw const NetworkFailure();
        }
        return catalogHandler(uri);
      },
    );
    await tester.pumpWidget(
      pumpMonAppart(
        config: testConfig(),
        apiClient: client,
        initialLocation: '/home',
        overrides: [connectivityMonitorProvider.overrideWithValue(monitor)],
      ),
    );
    await pumpFrames(tester);
    expect(find.text('Appartement 2 chambres à Cocody'), findsWidgets);

    monitor.recordFailure(const NetworkFailure());
    await tester.pump();
    expect(find.textContaining('Hors ligne'), findsWidgets);
  });
}
