import 'package:flutter_test/flutter_test.dart';
import 'package:mon_appart/core/widgets/brand_mark.dart';
import 'package:mon_appart/features/splash/splash_screen.dart';

import '../helpers/fake_api_client.dart';
import '../helpers/listing_fixtures.dart';
import '../helpers/test_app.dart';

void main() {
  testWidgets('affiche l\'écran de lancement puis l\'accueil', (tester) async {
    final client = FakeApiClient(handler: (uri) async => catalogHandler(uri));
    await tester.pumpWidget(
      pumpMonAppart(config: testConfig(), apiClient: client),
    );

    expect(find.byType(BrandMark), findsOneWidget);
    expect(find.bySemanticsLabel('Mon Appart'), findsOneWidget);
    expect(find.text('Mon Appart'), findsNothing);

    await tester.pump(SplashScreen.delay);
    await tester.pump();
    await tester.pump();
    await tester.pump();

    expect(find.text('Catégories'), findsOneWidget);
  });
}
