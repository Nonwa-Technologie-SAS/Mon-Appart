import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mon_appart/core/auth/in_memory_session_store.dart';
import 'package:mon_appart/core/auth/session_tokens.dart';
import 'package:mon_appart/core/errors/app_failure.dart';
import 'package:mon_appart/features/listing/data/listing_share.dart';
import 'package:mon_appart/features/listing/presentation/listing_providers.dart';

import '../helpers/auth_fixtures.dart';
import '../helpers/fake_api_client.dart';
import '../helpers/listing_fixtures.dart';
import '../helpers/messaging_fixtures.dart';
import '../helpers/test_app.dart';

class _RecordingShare implements ListingShare {
  String? last;

  @override
  Future<void> shareText(String text) async {
    last = text;
  }
}

Future<void> pumpFrames(WidgetTester tester, {int times = 24}) async {
  for (var i = 0; i < times; i++) {
    await tester.pump(const Duration(milliseconds: 16));
  }
}

const _id = '11111111-1111-1111-1111-111111111111';

void main() {
  testWidgets('affiche la fiche, le prix et la galerie', (tester) async {
    await tester.binding.setSurfaceSize(const Size(800, 2000));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    final share = _RecordingShare();
    final client = FakeApiClient(
      handler: (uri) async => catalogHandler(
        uri,
        badges: listingBadgesJson(
          badges: [
            {
              'code': 'LISTING_CHECKED',
              'label': 'Annonce contrôlée',
              'verifiedAt': '2026-10-01T00:00:00.000Z',
              'expiresAt': null,
            },
          ],
        ),
      ),
    );
    await tester.pumpWidget(
      pumpMonAppart(
        config: testConfig(),
        apiClient: client,
        initialLocation: '/listings/$_id',
        overrides: [listingShareProvider.overrideWithValue(share)],
      ),
    );
    await pumpFrames(tester);

    expect(find.text('Appartement 2 chambres à Cocody'), findsOneWidget);
    expect(find.textContaining('F CFA'), findsWidgets);
    expect(find.textContaining('Riviera'), findsWidgets);
    expect(find.text('Annonce contrôlée'), findsOneWidget);
    expect(find.text('Parking'), findsOneWidget);
    expect(find.text('Contacter'), findsOneWidget);
    expect(find.text('Visite'), findsOneWidget);
    expect(find.byTooltip('Ajouter à la comparaison'), findsOneWidget);

    await tester.tap(find.byTooltip('Ajouter à la comparaison'));
    await pumpFrames(tester);
    expect(find.textContaining('Ajouté à la comparaison'), findsOneWidget);
    expect(find.byTooltip('Retirer de la comparaison'), findsOneWidget);

    await tester.tap(find.byTooltip('Partager'));
    await pumpFrames(tester);
    expect(share.last, contains('Appartement 2 chambres à Cocody'));
    expect(share.last, isNot(contains('http')));
  });

  testWidgets('affiche un état d\'erreur récupérable', (tester) async {
    await tester.binding.setSurfaceSize(const Size(800, 2000));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    var fail = true;
    final client = FakeApiClient(
      handler: (uri) async {
        if (RegExp(r'/listings/[0-9a-fA-F-]{36}$').hasMatch(uri.path) && fail) {
          throw const NetworkFailure();
        }
        return catalogHandler(uri);
      },
    );
    await tester.pumpWidget(
      pumpMonAppart(
        config: testConfig(),
        apiClient: client,
        initialLocation: '/listings/$_id',
      ),
    );
    await pumpFrames(tester);
    expect(find.text('Fiche impossible à charger'), findsOneWidget);

    fail = false;
    await tester.ensureVisible(find.text('Réessayer'));
    await tester.tap(find.text('Réessayer'));
    await tester.pump();
    await pumpFrames(tester);
    expect(find.text('Appartement 2 chambres à Cocody'), findsOneWidget);
  });

  testWidgets(
    'signale une annonce introuvable sans nouvel essai réseau trompeur',
    (tester) async {
      await tester.pumpWidget(
        pumpMonAppart(
          config: testConfig(),
          apiClient: FakeApiClient(handler: (uri) async => catalogHandler(uri)),
          initialLocation: '/listings/pas-un-uuid',
        ),
      );
      await pumpFrames(tester);
      expect(find.text('Annonce indisponible'), findsOneWidget);
      expect(find.text('Réessayer'), findsNothing);
    },
  );

  testWidgets('le favori sans session n\'appelle pas Nest', (tester) async {
    final client = FakeApiClient(handler: (uri) async => catalogHandler(uri));
    await tester.pumpWidget(
      pumpMonAppart(
        config: testConfig(),
        apiClient: client,
        initialLocation: '/listings/$_id',
      ),
    );
    await pumpFrames(tester);
    await tester.tap(find.byTooltip('Ajouter aux favoris'));
    await pumpFrames(tester);
    expect(
      find.textContaining('Connectez-vous pour enregistrer un favori'),
      findsOneWidget,
    );
    expect(
      client.uris.any((uri) => uri.path.contains('/interactions/favorites/')),
      isFalse,
    );
  });

  testWidgets('ouvre le formulaire de contact', (tester) async {
    await tester.binding.setSurfaceSize(const Size(400, 800));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    await tester.pumpWidget(
      pumpMonAppart(
        config: testConfig(),
        apiClient: FakeApiClient(handler: (uri) async => catalogHandler(uri)),
        initialLocation: '/listings/$_id',
      ),
    );
    await pumpFrames(tester);
    await tester.tap(find.text('Contacter'));
    await pumpFrames(tester);
    expect(find.text('Contacter l\'annonceur'), findsOneWidget);
    await tester.tap(find.text('Envoyer la demande'));
    await pumpFrames(tester);
    expect(
      find.text('Saisissez un message pour l\'annonceur.'),
      findsOneWidget,
    );
  });

  testWidgets('ouvre le formulaire de visite sans confirmer un rendez-vous', (
    tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(400, 800));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    await tester.pumpWidget(
      pumpMonAppart(
        config: testConfig(),
        apiClient: FakeApiClient(handler: (uri) async => catalogHandler(uri)),
        initialLocation: '/listings/$_id',
      ),
    );
    await pumpFrames(tester);
    await tester.tap(find.text('Visite'));
    await pumpFrames(tester);
    expect(find.text('Demander une visite'), findsOneWidget);
    expect(find.textContaining('n\'est pas un rendez-vous'), findsOneWidget);
    await tester.tap(find.text('Envoyer la demande'));
    await pumpFrames(tester);
    expect(find.text('Choisissez une date et une heure.'), findsOneWidget);
  });

  testWidgets('distingue une galerie vide d\'une erreur média', (tester) async {
    await tester.binding.setSurfaceSize(const Size(800, 2000));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    final client = FakeApiClient(
      handler: (uri) async {
        if (uri.path.endsWith('/media')) {
          throw const NetworkFailure();
        }
        return catalogHandler(uri, listing: listingDetailJson(coverUrl: null));
      },
    );
    await tester.pumpWidget(
      pumpMonAppart(
        config: testConfig(),
        apiClient: client,
        initialLocation: '/listings/$_id',
      ),
    );
    await pumpFrames(tester);
    expect(
      find.text('Les photos n\'ont pas pu être chargées.'),
      findsOneWidget,
    );
  });

  testWidgets(
    'affiche l\'absence de photos sans la présenter comme une erreur',
    (tester) async {
      await tester.binding.setSurfaceSize(const Size(800, 2000));
      addTearDown(() => tester.binding.setSurfaceSize(null));
      await tester.pumpWidget(
        pumpMonAppart(
          config: testConfig(),
          apiClient: FakeApiClient(
            handler: (uri) async => catalogHandler(
              uri,
              listing: listingDetailJson(coverUrl: null),
              media: const {'items': <Object?>[]},
            ),
          ),
          initialLocation: '/listings/$_id',
        ),
      );
      await pumpFrames(tester);
      expect(find.text('Aucune photo pour cette annonce.'), findsOneWidget);
    },
  );

  testWidgets('le contact connecté ouvre la conversation renvoyée par Nest', (
    tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(400, 1200));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    final store = InMemorySessionStore();
    await store.save(const SessionTokens(accessToken: 'a', refreshToken: 'r'));
    await tester.pumpWidget(
      pumpMonAppart(
        config: testConfig(),
        sessionStore: store,
        apiClient: FakeApiClient(
          methodAwareHandler: (uri, method) async {
            if (uri.path.endsWith('/auth/me')) {
              return authUserJson();
            }
            if (uri.path.endsWith('/conversations') && method == 'POST') {
              return startConversationJson();
            }
            return catalogHandler(uri);
          },
        ),
        initialLocation: '/listings/$_id',
      ),
    );
    await pumpFrames(tester);
    await tester.tap(find.text('Contacter'));
    await pumpFrames(tester);
    await tester.enterText(
      find.byType(TextField),
      'Bonjour, le bien est-il encore disponible ?',
    );
    await tester.tap(find.text('Envoyer la demande'));
    await pumpFrames(tester, times: 24);
    expect(find.text('Awa K.'), findsWidgets);
    expect(
      find.text('Bonjour, le bien est-il encore disponible ?'),
      findsWidgets,
    );
  });
}
