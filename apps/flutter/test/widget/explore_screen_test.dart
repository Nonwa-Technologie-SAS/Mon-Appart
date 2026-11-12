import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mon_appart/core/errors/app_failure.dart';

import '../helpers/fake_api_client.dart';
import '../helpers/listing_fixtures.dart';
import '../helpers/test_app.dart';

Future<void> pumpFrames(WidgetTester tester, {int times = 5}) async {
  for (var i = 0; i < times; i++) {
    await tester.pump(const Duration(milliseconds: 16));
  }
}

void main() {
  testWidgets('affiche la recherche, le tri et ouvre les filtres', (
    tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(800, 2000));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    final client = FakeApiClient(
      handler: (uri) async => catalogHandler(uri, search: searchResponseJson()),
    );
    await tester.pumpWidget(
      pumpMonAppart(
        config: testConfig(),
        apiClient: client,
        initialLocation: '/explore',
      ),
    );
    await pumpFrames(tester);

    expect(find.byType(TextField), findsWidgets);
    expect(find.text('Plus récentes'), findsOneWidget);
    expect(find.text('Appartement 2 chambres à Cocody'), findsOneWidget);
    expect(find.text('1 annonce'), findsOneWidget);

    await tester.tap(find.byTooltip('Filtres'));
    await pumpFrames(tester);
    expect(find.text('Type de transaction'), findsOneWidget);
    expect(find.text('Appliquer les filtres'), findsOneWidget);
  });

  testWidgets('applique un type de transaction depuis les filtres', (
    tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(800, 2000));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    final client = FakeApiClient(
      handler: (uri) async => catalogHandler(uri, search: searchResponseJson()),
    );
    await tester.pumpWidget(
      pumpMonAppart(
        config: testConfig(),
        apiClient: client,
        initialLocation: '/explore',
      ),
    );
    await pumpFrames(tester);

    await tester.tap(find.byTooltip('Filtres'));
    await pumpFrames(tester);
    await tester.tap(find.widgetWithText(FilterChip, 'À louer'));
    await tester.tap(find.text('Appliquer les filtres'));
    await pumpFrames(tester);

    expect(find.byTooltip('Filtres (1 actifs)'), findsOneWidget);
    expect(
      client.uris.any(
        (uri) =>
            uri.path.endsWith('/search') &&
            uri.queryParameters['listingType'] == 'RENT',
      ),
      isTrue,
    );
  });

  testWidgets('affiche un état vide avec action vers les filtres', (
    tester,
  ) async {
    final client = FakeApiClient(handler: (uri) async => catalogHandler(uri));
    await tester.pumpWidget(
      pumpMonAppart(
        config: testConfig(),
        apiClient: client,
        initialLocation: '/explore',
      ),
    );
    await pumpFrames(tester);
    expect(find.text('Aucune annonce pour cette recherche'), findsOneWidget);
    expect(find.text('Modifier les filtres'), findsOneWidget);
  });

  testWidgets('affiche une erreur et réessaie', (tester) async {
    var fail = true;
    final client = FakeApiClient(
      handler: (uri) async {
        if (uri.path.endsWith('/search') && fail) {
          throw const NetworkFailure();
        }
        return catalogHandler(uri, search: searchResponseJson());
      },
    );
    await tester.pumpWidget(
      pumpMonAppart(
        config: testConfig(),
        apiClient: client,
        initialLocation: '/explore',
      ),
    );
    await pumpFrames(tester);
    expect(find.text('Recherche impossible'), findsOneWidget);

    fail = false;
    await tester.tap(find.text('Réessayer'));
    await pumpFrames(tester);
    expect(find.text('Appartement 2 chambres à Cocody'), findsOneWidget);
  });

  testWidgets('change le tri sans perdre les autres critères', (tester) async {
    final client = FakeApiClient(
      handler: (uri) async => catalogHandler(uri, search: searchResponseJson()),
    );
    await tester.pumpWidget(
      pumpMonAppart(
        config: testConfig(),
        apiClient: client,
        initialLocation: '/explore?listingType=RENT',
      ),
    );
    await pumpFrames(tester);

    await tester.tap(find.byKey(const ValueKey<String>('explore-sort')));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 300));
    await tester.tap(
      find.widgetWithText(PopupMenuItem<String>, 'Prix croissant'),
    );
    await pumpFrames(tester);

    expect(
      client.uris.any(
        (uri) =>
            uri.path.endsWith('/search') &&
            uri.queryParameters['sort'] == 'PRICE_ASC' &&
            uri.queryParameters['listingType'] == 'RENT',
      ),
      isTrue,
    );
  });

  testWidgets('ouvre la fiche sans perdre les critères', (tester) async {
    await tester.binding.setSurfaceSize(const Size(800, 2000));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    final client = FakeApiClient(
      handler: (uri) async => catalogHandler(uri, search: searchResponseJson()),
    );
    await tester.pumpWidget(
      pumpMonAppart(
        config: testConfig(),
        apiClient: client,
        initialLocation: '/explore?listingType=RENT',
      ),
    );
    await pumpFrames(tester);

    await tester.tap(find.text('Appartement 2 chambres à Cocody'));
    await pumpFrames(tester, times: 24);
    expect(find.text('Contacter'), findsOneWidget);
    expect(find.text('Visite'), findsOneWidget);

    await tester.tap(find.byTooltip('Back'));
    await pumpFrames(tester);
    expect(find.byTooltip('Filtres (1 actifs)'), findsOneWidget);
  });

  testWidgets('refuse un budget min supérieur au max', (tester) async {
    await tester.binding.setSurfaceSize(const Size(800, 2000));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    final client = FakeApiClient(
      handler: (uri) async => catalogHandler(uri, search: searchResponseJson()),
    );
    await tester.pumpWidget(
      pumpMonAppart(
        config: testConfig(),
        apiClient: client,
        initialLocation: '/explore',
      ),
    );
    await pumpFrames(tester);

    await tester.tap(find.byTooltip('Filtres'));
    await pumpFrames(tester);
    await tester.enterText(find.widgetWithText(TextField, 'Minimum'), '400000');
    await tester.enterText(find.widgetWithText(TextField, 'Maximum'), '200000');
    await tester.tap(find.text('Appliquer les filtres'));
    await pumpFrames(tester);

    expect(
      find.text('Le prix minimum ne peut pas dépasser le prix maximum.'),
      findsOneWidget,
    );
  });
}
