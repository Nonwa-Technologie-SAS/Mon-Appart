import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mon_appart/core/errors/app_failure.dart';
import 'package:mon_appart/features/assistant/data/assistant_session.dart';
import 'package:mon_appart/features/assistant/presentation/assistant_providers.dart';

import '../helpers/fake_api_client.dart';
import '../helpers/listing_fixtures.dart';
import '../helpers/test_app.dart';

Future<void> pumpFrames(WidgetTester tester, {int times = 12}) async {
  for (var i = 0; i < times; i++) {
    await tester.pump(const Duration(milliseconds: 16));
  }
}

FakeApiClient assistantClient({
  Future<Map<String, Object?>> Function(Uri uri, String method)? onTurn,
}) {
  return FakeApiClient(
    methodAwareHandler: (uri, method) async {
      if (uri.path.contains('/ai-assistant/')) {
        if (onTurn != null) {
          return onTurn(uri, method);
        }
        return assistantTurnJson();
      }
      return catalogHandler(
        uri,
        listing: listingDetailJson(title: 'Maison 3 chambres à Cocody'),
      );
    },
  );
}

void main() {
  testWidgets('accueil ouvre l\'assistant', (tester) async {
    await tester.binding.setSurfaceSize(const Size(400, 1400));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    await tester.pumpWidget(
      pumpMonAppart(
        config: testConfig(),
        apiClient: assistantClient(),
        initialLocation: '/home',
      ),
    );
    await pumpFrames(tester);
    await tester.tap(find.text('Assistant immobilier'));
    await pumpFrames(tester);
    expect(find.text('Décrivez le logement en français'), findsOneWidget);
    expect(find.textContaining('Aucun bien n\'est inventé'), findsOneWidget);
  });

  testWidgets('envoie une demande et affiche des biens Nest', (tester) async {
    await tester.binding.setSurfaceSize(const Size(400, 1600));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    final client = assistantClient();
    await tester.pumpWidget(
      pumpMonAppart(
        config: testConfig(),
        apiClient: client,
        initialLocation: '/assistant',
        overrides: [
          assistantSessionProvider.overrideWithValue(
            AssistantSession('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
          ),
        ],
      ),
    );
    await pumpFrames(tester);
    await tester.enterText(
      find.byType(TextField),
      'Maison 3 chambres à louer à Cocody',
    );
    await tester.tap(find.byTooltip('Envoyer'));
    await pumpFrames(tester, times: 24);
    expect(find.text('Maison 3 chambres à Cocody'), findsWidgets);
    expect(find.text('Dans votre budget maximum'), findsOneWidget);
    expect(find.text('Commune : Cocody'), findsOneWidget);
    expect(client.lastBody?['query'], 'Maison 3 chambres à louer à Cocody');
    expect(
      client.lastHeaders?['x-assistant-session'],
      'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    );
  });

  testWidgets('état de chargement puis affinage multi-tours', (tester) async {
    await tester.binding.setSurfaceSize(const Size(400, 1600));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    final completer = Completer<Map<String, Object?>>();
    var turns = 0;
    final client = assistantClient(
      onTurn: (uri, method) {
        turns += 1;
        if (turns == 1) {
          return completer.future;
        }
        return Future.value(
          assistantTurnJson(message: 'Critère chambres ajouté.'),
        );
      },
    );
    await tester.pumpWidget(
      pumpMonAppart(
        config: testConfig(),
        apiClient: client,
        initialLocation: '/assistant',
      ),
    );
    await pumpFrames(tester);
    await tester.enterText(find.byType(TextField), 'Maison à Cocody');
    await tester.tap(find.byTooltip('Envoyer'));
    await tester.pump();
    expect(find.text('Analyse et recherche en cours…'), findsOneWidget);
    completer.complete(assistantTurnJson());
    await pumpFrames(tester, times: 24);
    expect(find.text('Maison 3 chambres à Cocody'), findsWidgets);
    await tester.tap(find.text('Affiner le budget'));
    await pumpFrames(tester, times: 24);
    expect(find.text('Critère chambres ajouté.'), findsOneWidget);
    expect(client.uris.any((uri) => uri.path.endsWith('/messages')), isTrue);
  });

  testWidgets('aucun résultat et erreur réseau', (tester) async {
    await tester.binding.setSurfaceSize(const Size(400, 1400));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    var empty = true;
    final client = assistantClient(
      onTurn: (uri, method) async {
        if (empty) {
          return assistantTurnJson(
            mode: 'empty',
            message: 'Aucune annonce pour ces critères',
            listings: const [],
            suggestions: const ['Élargir le budget'],
          );
        }
        throw const NetworkFailure();
      },
    );
    await tester.pumpWidget(
      pumpMonAppart(
        config: testConfig(),
        apiClient: client,
        initialLocation: '/assistant',
      ),
    );
    await pumpFrames(tester);
    await tester.tap(
      find.text(
        'Maison 3 chambres à louer à Cocody, budget 250 000 FCFA par mois',
      ),
    );
    await pumpFrames(tester, times: 24);
    expect(find.text('Aucune annonce pour ces critères'), findsOneWidget);
    expect(find.text('Relancer sans filtre strict'), findsOneWidget);
    empty = false;
    await tester.enterText(find.byType(TextField), 'Moins cher');
    await tester.tap(find.byTooltip('Envoyer'));
    await pumpFrames(tester, times: 24);
    expect(find.text('Connexion impossible'), findsOneWidget);
    expect(find.text('Moins cher'), findsOneWidget);
  });

  testWidgets('ouvre la fiche depuis un résultat', (tester) async {
    await tester.binding.setSurfaceSize(const Size(400, 1600));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    await tester.pumpWidget(
      pumpMonAppart(
        config: testConfig(),
        apiClient: assistantClient(),
        initialLocation: '/assistant',
      ),
    );
    await pumpFrames(tester);
    await tester.enterText(find.byType(TextField), 'Maison à Cocody');
    await tester.tap(find.byTooltip('Envoyer'));
    await pumpFrames(tester, times: 24);
    await tester.tap(find.text('Maison 3 chambres à Cocody').first);
    await pumpFrames(tester, times: 24);
    expect(find.text('Maison 3 chambres à Cocody'), findsWidgets);
  });
}
