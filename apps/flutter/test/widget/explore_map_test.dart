import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mon_appart/core/location/device_location.dart';
import 'package:mon_appart/features/explore/presentation/explore_map_pane.dart';

import '../helpers/fake_api_client.dart';
import '../helpers/listing_fixtures.dart';
import '../helpers/test_app.dart';

Future<void> pumpFrames(WidgetTester tester, {int times = 16}) async {
  for (var i = 0; i < times; i++) {
    await tester.pump(const Duration(milliseconds: 16));
  }
}

void main() {
  testWidgets('passe de la liste à la carte en conservant les filtres', (
    tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(400, 1200));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    final client = FakeApiClient(
      handler: (uri) async => catalogHandler(
        uri,
        search: searchResponseJson(
          items: [
            listingJson(
              latitude: 5.36,
              longitude: -3.96,
              precision: 'APPROXIMATE',
            ),
          ],
        ),
      ),
    );
    await tester.pumpWidget(
      pumpMonAppart(
        config: testConfig(),
        apiClient: client,
        initialLocation: '/explore?listingType=RENT',
        overrides: [
          mapTilesEnabledProvider.overrideWithValue(false),
          deviceLocationProvider.overrideWithValue(
            FakeDeviceLocation(permission: LocationPermissionUi.denied),
          ),
        ],
      ),
    );
    await pumpFrames(tester);
    expect(find.text('Appartement 2 chambres à Cocody'), findsOneWidget);

    await tester.tap(find.byTooltip('Vue carte'));
    await pumpFrames(tester, times: 24);
    expect(find.byTooltip('Vue liste'), findsOneWidget);
    expect(find.byTooltip('Autour de moi'), findsOneWidget);
    expect(
      client.uris.any(
        (uri) =>
            uri.path.endsWith('/search') &&
            uri.queryParameters['listingType'] == 'RENT',
      ),
      isTrue,
    );
  });

  testWidgets('ouvre l\'aperçu puis la fiche depuis un marqueur', (
    tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(400, 1200));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    final client = FakeApiClient(
      handler: (uri) async => catalogHandler(
        uri,
        search: searchResponseJson(
          items: [
            listingJson(
              latitude: 5.36,
              longitude: -3.96,
              precision: 'APPROXIMATE',
            ),
          ],
        ),
      ),
    );
    await tester.pumpWidget(
      pumpMonAppart(
        config: testConfig(),
        apiClient: client,
        initialLocation: '/explore?view=map&listingType=RENT',
        overrides: [
          mapTilesEnabledProvider.overrideWithValue(false),
          deviceLocationProvider.overrideWithValue(FakeDeviceLocation()),
        ],
      ),
    );
    await pumpFrames(tester, times: 24);
    await tester.tap(find.textContaining('F CFA').first);
    await pumpFrames(tester);
    expect(find.text('Appartement 2 chambres à Cocody'), findsWidgets);

    await tester.tap(find.text('Appartement 2 chambres à Cocody').last);
    await pumpFrames(tester, times: 24);
    expect(find.text('Contacter'), findsOneWidget);
  });

  testWidgets('Autour de moi refuse sans bloquer la carte', (tester) async {
    await tester.binding.setSurfaceSize(const Size(400, 1200));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    final location = FakeDeviceLocation(
      permission: LocationPermissionUi.denied,
    );
    await tester.pumpWidget(
      pumpMonAppart(
        config: testConfig(),
        apiClient: FakeApiClient(
          handler: (uri) async =>
              catalogHandler(uri, search: searchResponseJson()),
        ),
        initialLocation: '/explore?view=map',
        overrides: [
          mapTilesEnabledProvider.overrideWithValue(false),
          deviceLocationProvider.overrideWithValue(location),
        ],
      ),
    );
    await pumpFrames(tester, times: 24);
    await tester.tap(find.byTooltip('Autour de moi'));
    await pumpFrames(tester);
    expect(find.text('Autour de moi'), findsWidgets);
    await tester.tap(find.text('Autoriser'));
    await pumpFrames(tester);
    expect(
      find.textContaining('Recherche manuelle toujours disponible'),
      findsOneWidget,
    );
    expect(find.byTooltip('Vue liste'), findsOneWidget);
  });
}
