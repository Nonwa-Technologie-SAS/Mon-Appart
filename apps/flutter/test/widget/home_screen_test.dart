import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mon_appart/core/errors/app_failure.dart';
import 'package:mon_appart/core/widgets/property_card_skeleton.dart';

import '../helpers/fake_api_client.dart';
import '../helpers/listing_fixtures.dart';
import '../helpers/test_app.dart';

Future<void> pumpFrames(WidgetTester tester, {int times = 5}) async {
  for (var i = 0; i < times; i++) {
    await tester.pump(const Duration(milliseconds: 16));
  }
}

void main() {
  testWidgets('affiche l\'accueil, les catégories et les communes', (
    tester,
  ) async {
    final client = FakeApiClient(
      handler: (uri) async => catalogHandler(
        uri,
        search: searchResponseJson(),
        recommendations: recommendationResponseJson(),
      ),
    );
    await tester.pumpWidget(
      pumpMonAppart(
        config: testConfig(),
        apiClient: client,
        initialLocation: '/home',
      ),
    );
    await pumpFrames(tester);

    expect(
      find.text('Trouvez votre chez-vous en Côte d\'Ivoire.'),
      findsOneWidget,
    );
    expect(find.text('Annonces récentes'), findsOneWidget);
    expect(find.text('À louer'), findsWidgets);
    expect(find.text('Cocody'), findsWidgets);
    expect(find.text('Appartement 2 chambres à Cocody'), findsOneWidget);
    expect(
      find.textContaining('pas de recommandation personnalisée'),
      findsOneWidget,
    );
  });

  testWidgets('affiche un skeleton pendant le chargement des annonces', (
    tester,
  ) async {
    final completer = Completer<Map<String, Object?>>();
    final client = FakeApiClient(
      handler: (uri) {
        if (uri.path.endsWith('/search')) {
          return completer.future;
        }
        return Future.value(
          catalogHandler(
            uri,
            recommendations: recommendationResponseJson(
              listings: <Map<String, Object?>>[],
            ),
          ),
        );
      },
    );
    await tester.pumpWidget(
      pumpMonAppart(
        config: testConfig(),
        apiClient: client,
        initialLocation: '/home',
      ),
    );
    await tester.pump();
    await tester.pump();

    expect(find.byType(PropertyCardSkeleton), findsWidgets);

    completer.complete(searchResponseJson());
    await pumpFrames(tester);
    expect(find.text('Appartement 2 chambres à Cocody'), findsOneWidget);
  });

  testWidgets('une erreur de catalogue n\'empêche pas les suggestions', (
    tester,
  ) async {
    var failSearch = true;
    final client = FakeApiClient(
      handler: (uri) async {
        if (uri.path.endsWith('/search') && failSearch) {
          throw const NetworkFailure();
        }
        return catalogHandler(
          uri,
          search: searchResponseJson(),
          recommendations: recommendationResponseJson(),
        );
      },
    );
    await tester.binding.setSurfaceSize(const Size(800, 2000));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    await tester.pumpWidget(
      pumpMonAppart(
        config: testConfig(),
        apiClient: client,
        initialLocation: '/home',
      ),
    );
    await pumpFrames(tester);

    expect(find.text('Chargement impossible'), findsOneWidget);
    expect(find.textContaining('Villa à Marcory'), findsOneWidget);

    failSearch = false;
    await tester.tap(find.text('Réessayer'));
    await pumpFrames(tester);
    expect(find.text('Appartement 2 chambres à Cocody'), findsOneWidget);
  });

  testWidgets('affiche un état vide distinct d\'une erreur', (tester) async {
    final client = FakeApiClient(handler: (uri) async => catalogHandler(uri));
    await tester.pumpWidget(
      pumpMonAppart(
        config: testConfig(),
        apiClient: client,
        initialLocation: '/home',
      ),
    );
    await pumpFrames(tester);

    expect(find.text('Aucune annonce récente'), findsOneWidget);
    expect(find.text('Chargement impossible'), findsNothing);
  });

  testWidgets('la recherche transmet le texte à Explorer', (tester) async {
    final client = FakeApiClient(
      handler: (uri) async => catalogHandler(uri, search: searchResponseJson()),
    );
    await tester.pumpWidget(
      pumpMonAppart(
        config: testConfig(),
        apiClient: client,
        initialLocation: '/home',
      ),
    );
    await tester.pump();
    await tester.pump();

    await tester.enterText(find.byType(TextField).first, 'villa cocody');
    await tester.testTextInput.receiveAction(TextInputAction.search);
    await tester.pump();
    await tester.pump();

    expect(find.text('Explorer'), findsWidgets);
    expect(find.textContaining('sans interprétation IA'), findsOneWidget);
    expect(
      client.uris.any(
        (uri) =>
            uri.path.endsWith('/search') &&
            uri.queryParameters['q'] == 'villa cocody',
      ),
      isTrue,
    );
  });

  testWidgets('une catégorie transmet le filtre Nest listingType', (
    tester,
  ) async {
    final client = FakeApiClient(
      handler: (uri) async => catalogHandler(uri, search: searchResponseJson()),
    );
    await tester.pumpWidget(
      pumpMonAppart(
        config: testConfig(),
        apiClient: client,
        initialLocation: '/home',
      ),
    );
    await tester.pump();
    await tester.pump();

    await tester.tap(find.text('À louer').first);
    await tester.pump();
    await tester.pump();

    expect(find.byTooltip('Filtres (1 actifs)'), findsOneWidget);
  });

  testWidgets('le bouton favori n\'invente pas un enregistrement', (
    tester,
  ) async {
    final client = FakeApiClient(
      handler: (uri) async => catalogHandler(uri, search: searchResponseJson()),
    );
    await tester.binding.setSurfaceSize(const Size(800, 2000));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    await tester.pumpWidget(
      pumpMonAppart(
        config: testConfig(),
        apiClient: client,
        initialLocation: '/home',
      ),
    );
    await pumpFrames(tester);

    await tester.tap(find.byTooltip('Ajouter aux favoris').first);
    await tester.pump();
    await tester.pump();

    expect(
      find.textContaining('Connectez-vous pour enregistrer un favori'),
      findsOneWidget,
    );
    expect(find.text('Connexion'), findsWidgets);
  });

  testWidgets('reste lisible sur un écran étroit', (tester) async {
    final client = FakeApiClient(
      handler: (uri) async => catalogHandler(uri, search: searchResponseJson()),
    );
    await tester.binding.setSurfaceSize(const Size(360, 640));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    await tester.pumpWidget(
      pumpMonAppart(
        config: testConfig(),
        apiClient: client,
        initialLocation: '/home',
      ),
    );
    await tester.pump();
    await tester.pump();

    expect(find.text('Accueil'), findsOneWidget);
    expect(find.text('Explorer'), findsOneWidget);
    expect(find.text('À louer'), findsWidgets);
  });
}
