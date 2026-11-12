import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mon_appart/app/router/app_routes.dart';
import 'package:mon_appart/core/auth/in_memory_session_store.dart';
import 'package:mon_appart/core/auth/session_tokens.dart';
import 'package:mon_appart/features/listing/data/listing_share.dart';
import 'package:mon_appart/features/listing/presentation/listing_providers.dart';

import '../helpers/auth_fixtures.dart';
import '../helpers/fake_api_client.dart';
import '../helpers/listing_fixtures.dart';
import '../helpers/test_app.dart';

class _RecordingShare implements ListingShare {
  String? last;

  @override
  Future<void> shareText(String text) async {
    last = text;
  }
}

Future<void> pumpFrames(WidgetTester tester) async {
  for (var i = 0; i < 8; i++) {
    await tester.pump(const Duration(milliseconds: 16));
  }
}

void main() {
  testWidgets('le Club affiche l\'absence de points et de partenaires', (
    tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(400, 1600));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    final store = InMemorySessionStore();
    await store.save(const SessionTokens(accessToken: 'a', refreshToken: 'r'));
    final share = _RecordingShare();
    await tester.pumpWidget(
      pumpMonAppart(
        config: testConfig(publicWebHost: 'www.example.test'),
        apiClient: FakeApiClient(
          handler: (uri) async {
            if (uri.path.endsWith('/auth/me')) {
              return authUserJson(firstName: 'Awa', lastName: 'Koné');
            }
            return catalogHandler(uri);
          },
        ),
        sessionStore: store,
        initialLocation: AppRoutes.account,
        overrides: [listingShareProvider.overrideWithValue(share)],
      ),
    );
    await pumpFrames(tester);
    await tester.scrollUntilVisible(find.text('Club Mon Appart'), 200);
    await tester.tap(find.text('Club Mon Appart'));
    await pumpFrames(tester);

    expect(find.text('Programme non ouvert'), findsOneWidget);
    expect(find.textContaining('Aucun solde de points'), findsOneWidget);
    expect(find.textContaining('partenaire'), findsWidgets);
    expect(find.textContaining('0 point'), findsNothing);
    expect(find.text('Utiliser'), findsNothing);

    await tester.tap(find.text('Partager l\'adresse du site'));
    await pumpFrames(tester);
    expect(share.last, contains('https://www.example.test'));
    expect(share.last, contains('aucune récompense'));
  });
}
