import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mon_appart/app/router/app_routes.dart';
import 'package:mon_appart/core/errors/app_failure.dart';
import 'package:mon_appart/features/compare/domain/shortlist_entry.dart';
import 'package:mon_appart/features/compare/presentation/shortlist_providers.dart';

import '../helpers/fake_api_client.dart';
import '../helpers/listing_fixtures.dart';
import '../helpers/test_app.dart';

const _idA = '11111111-1111-1111-1111-111111111111';
const _idB = '33333333-3333-3333-3333-333333333333';
const _idGone = '55555555-5555-5555-5555-555555555555';
const _propA = '22222222-2222-2222-2222-222222222222';
const _propB = '44444444-4444-4444-4444-444444444444';

const _entryA = ShortlistEntry(
  listingId: _idA,
  title: 'Appartement 2 chambres à Cocody',
  propertyId: _propA,
);
const _entryB = ShortlistEntry(
  listingId: _idB,
  title: 'Studio à Marcory',
  propertyId: _propB,
);
const _entryGone = ShortlistEntry(
  listingId: _idGone,
  title: 'Villa retirée',
  propertyId: '66666666-6666-6666-6666-666666666666',
);

Future<void> pumpFrames(WidgetTester tester, {int times = 24}) async {
  for (var i = 0; i < times; i++) {
    await tester.pump(const Duration(milliseconds: 16));
  }
}

class _SeededShortlist extends ShortlistController {
  _SeededShortlist(this.seed);

  final List<ShortlistEntry> seed;

  @override
  List<ShortlistEntry> build() => List.of(seed);
}

FakeApiClient _client({bool failB = false, bool missingB = false}) {
  return FakeApiClient(
    handler: (uri) async {
      if (uri.path.endsWith('/listings/$_idGone')) {
        throw const HttpFailure(
          statusCode: 404,
          code: 'LISTING_NOT_FOUND',
          message: 'Annonce introuvable',
        );
      }
      if (uri.path.endsWith('/listings/$_idB')) {
        if (failB) {
          throw const NetworkFailure();
        }
        if (missingB) {
          return listingDetailJson(
            id: _idB,
            propertyId: _propB,
            title: 'Studio à Marcory',
            bedrooms: 1,
            surface: '40',
            price: null,
            amenities: const [],
          );
        }
        return listingDetailJson(
          id: _idB,
          propertyId: _propB,
          title: 'Studio à Marcory',
          bedrooms: 1,
          surface: '40',
          price: const {
            'amount': '180000',
            'currency': 'XOF',
            'period': 'MONTH',
          },
        );
      }
      return catalogHandler(uri, listing: listingDetailJson());
    },
  );
}

Widget _app({
  required FakeApiClient client,
  List<ShortlistEntry> entries = const [],
}) {
  return pumpMonAppart(
    config: testConfig(),
    apiClient: client,
    initialLocation: AppRoutes.compare,
    overrides: [
      shortlistControllerProvider.overrideWith(() => _SeededShortlist(entries)),
    ],
  );
}

void main() {
  testWidgets('état vide explique le caractère local de la shortlist', (
    tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(360, 800));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    await tester.pumpWidget(_app(client: _client()));
    await pumpFrames(tester);
    expect(find.text('Aucune annonce à comparer'), findsOneWidget);
    expect(find.textContaining('liste synchronisée'), findsOneWidget);
  });

  testWidgets('compare deux annonces et retire la seconde', (tester) async {
    await tester.binding.setSurfaceSize(const Size(400, 1400));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    await tester.pumpWidget(
      _app(client: _client(), entries: const [_entryA, _entryB]),
    );
    await pumpFrames(tester);
    expect(find.text('Appartement 2 chambres à Cocody'), findsWidgets);
    expect(find.text('Studio à Marcory'), findsWidgets);
    expect(find.text('Critères'), findsOneWidget);
    expect(find.text('Prix'), findsWidgets);
    expect(find.textContaining('moins cher'), findsOneWidget);

    await tester.tap(find.byTooltip('Retirer de la comparaison').last);
    await pumpFrames(tester);
    expect(find.text('Studio à Marcory'), findsNothing);
    expect(find.textContaining('Ajoutez encore 1 annonce'), findsOneWidget);
  });

  testWidgets('signale une information manquante et une annonce indisponible', (
    tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(400, 1400));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    await tester.pumpWidget(
      _app(
        client: _client(missingB: true),
        entries: const [_entryA, _entryB, _entryGone],
      ),
    );
    await pumpFrames(tester);
    expect(find.text('Annonce plus disponible'), findsOneWidget);
    expect(find.textContaining('Villa retirée'), findsWidgets);
    expect(find.text('Prix sur demande'), findsWidgets);
    expect(find.text('Information non renseignée'), findsWidgets);
  });

  testWidgets('ouvre la fiche depuis la comparaison', (tester) async {
    await tester.binding.setSurfaceSize(const Size(400, 1400));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    await tester.pumpWidget(
      _app(client: _client(), entries: const [_entryA, _entryB]),
    );
    await pumpFrames(tester);
    await tester.tap(find.text('Appartement 2 chambres à Cocody').first);
    await pumpFrames(tester, times: 40);
    expect(find.text('Contacter'), findsOneWidget);
    expect(find.text('Visite'), findsOneWidget);
  });

  testWidgets('reste lisible sur un écran étroit', (tester) async {
    await tester.binding.setSurfaceSize(const Size(320, 900));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    await tester.pumpWidget(
      _app(client: _client(), entries: const [_entryA, _entryB]),
    );
    await pumpFrames(tester);
    expect(tester.takeException(), isNull);
    expect(find.text('Critères'), findsOneWidget);
    expect(find.byType(SingleChildScrollView), findsWidgets);
  });

  testWidgets(
    'affiche une erreur réseau partielle sans masquer les autres biens',
    (tester) async {
      await tester.binding.setSurfaceSize(const Size(400, 1200));
      addTearDown(() => tester.binding.setSurfaceSize(null));
      await tester.pumpWidget(
        _app(client: _client(failB: true), entries: const [_entryA, _entryB]),
      );
      await pumpFrames(tester);
      expect(find.text('Appartement 2 chambres à Cocody'), findsWidgets);
      expect(
        find.textContaining('Impossible de joindre le serveur'),
        findsOneWidget,
      );
    },
  );
}
