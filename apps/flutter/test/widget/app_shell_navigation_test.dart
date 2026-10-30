import 'package:flutter_test/flutter_test.dart';

import '../helpers/fake_api_client.dart';
import '../helpers/listing_fixtures.dart';
import '../helpers/test_app.dart';

void main() {
  testWidgets('la barre principale ouvre les cinq destinations', (
    tester,
  ) async {
    final client = FakeApiClient(handler: (uri) async => catalogHandler(uri));
    await tester.pumpWidget(
      pumpMonAppart(
        config: testConfig(),
        apiClient: client,
        initialLocation: '/home',
      ),
    );
    await tester.pump();
    await tester.pump();

    await tester.tap(find.text('Explorer'));
    await tester.pump();
    await tester.pump();
    expect(find.textContaining('GET /api/v1/search'), findsOneWidget);

    await tester.tap(find.text('Favoris'));
    await tester.pump();
    await tester.pump();
    expect(find.text('Aucun favori enregistré'), findsOneWidget);

    await tester.tap(find.text('Notifs'));
    await tester.pump();
    expect(find.text('Connexion requise'), findsOneWidget);

    await tester.tap(find.text('Compte'));
    await tester.pump();
    await tester.pump();
    expect(find.text('Vous n\'êtes pas connecté'), findsOneWidget);

    await tester.tap(find.text('Accueil'));
    await tester.pump();
    expect(find.text('Catégories'), findsOneWidget);
  });

  testWidgets('une route inconnue affiche un état dédié', (tester) async {
    await tester.pumpWidget(
      pumpMonAppart(
        config: testConfig(),
        apiClient: FakeApiClient(handler: (uri) async => catalogHandler(uri)),
        initialLocation: '/route-inconnue',
      ),
    );
    await tester.pump();
    expect(find.text('Page introuvable'), findsWidgets);
  });
}
