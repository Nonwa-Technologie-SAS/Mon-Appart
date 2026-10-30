import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mon_appart/app/router/app_routes.dart';
import 'package:mon_appart/core/auth/in_memory_session_store.dart';
import 'package:mon_appart/core/auth/session_tokens.dart';
import 'package:mon_appart/features/explore/presentation/explore_map_pane.dart';
import 'package:mon_appart/features/visits/data/maps_launcher.dart';
import 'package:mon_appart/features/visits/presentation/visit_tour_providers.dart';

import '../helpers/auth_fixtures.dart';
import '../helpers/fake_api_client.dart';
import '../helpers/listing_fixtures.dart';
import '../helpers/test_app.dart';
import '../helpers/visit_fixtures.dart';

const _idB = '33333333-3333-3333-3333-333333333333';
const _visitB = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

Future<void> pumpFrames(WidgetTester tester, {int times = 24}) async {
  for (var i = 0; i < times; i++) {
    await tester.pump(const Duration(milliseconds: 16));
  }
}

void main() {
  testWidgets('refuse d\'ouvrir une tournée sans session', (tester) async {
    await tester.binding.setSurfaceSize(const Size(400, 900));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    await tester.pumpWidget(
      pumpMonAppart(
        config: testConfig(),
        apiClient: FakeApiClient(handler: (uri) async => catalogHandler(uri)),
        initialLocation: AppRoutes.visitTour,
      ),
    );
    await pumpFrames(tester);
    expect(find.text('Connexion requise'), findsOneWidget);
  });

  testWidgets(
    'affiche un conflit d\'horaires et ouvre Maps sans inventer un trajet',
    (tester) async {
      await tester.binding.setSurfaceSize(const Size(400, 2200));
      addTearDown(() => tester.binding.setSurfaceSize(null));
      final store = InMemorySessionStore();
      await store.save(
        const SessionTokens(accessToken: 'a', refreshToken: 'r'),
      );
      final launcher = RecordingMapsLauncher();
      final client = FakeApiClient(
        handler: (uri) async {
          if (uri.path.endsWith('/auth/me')) {
            return authUserJson(status: 'ACTIVE', emailVerified: true);
          }
          if (uri.path.endsWith('/appointments')) {
            return appointmentListJson(
              items: [
                appointmentJson(status: 'CONFIRMED'),
                appointmentJson(
                  id: _visitB,
                  status: 'CONFIRMED',
                  scheduledAt: '2026-11-02T10:30:00.000Z',
                  listingId: _idB,
                  listingTitle: 'Studio Marcory',
                ),
              ],
            );
          }
          if (uri.path.endsWith('/listings/$_idB')) {
            return listingDetailJson(
              id: _idB,
              title: 'Studio Marcory',
              latitude: 5.30,
              longitude: -4.00,
            );
          }
          return catalogHandler(uri, listing: listingDetailJson());
        },
      );
      await tester.pumpWidget(
        pumpMonAppart(
          config: testConfig(),
          apiClient: client,
          sessionStore: store,
          initialLocation:
              '${AppRoutes.visitTour}?ids=$testAppointmentId,$_visitB',
          overrides: [
            mapTilesEnabledProvider.overrideWithValue(false),
            mapsLauncherProvider.overrideWithValue(launcher),
          ],
        ),
      );
      await pumpFrames(tester, times: 40);
      expect(find.textContaining('se chevauchent'), findsOneWidget);
      expect(find.textContaining('vol d\'oiseau'), findsWidgets);
      expect(find.text('En attente de confirmation'), findsNothing);
      await tester.scrollUntilVisible(
        find.text('Ouvrir dans Maps'),
        240,
        scrollable: find.byType(Scrollable).first,
      );
      await tester.tap(find.text('Ouvrir dans Maps'));
      await pumpFrames(tester);
      expect(launcher.opened, isTrue);
      expect(launcher.last?.host, 'www.google.com');
      expect(launcher.last?.queryParameters['origin'], isNotNull);
    },
  );

  testWidgets('une visite PENDING n\'est pas affichée comme confirmée', (
    tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(400, 1400));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    final store = InMemorySessionStore();
    await store.save(const SessionTokens(accessToken: 'a', refreshToken: 'r'));
    await tester.pumpWidget(
      pumpMonAppart(
        config: testConfig(),
        sessionStore: store,
        apiClient: FakeApiClient(
          handler: (uri) async {
            if (uri.path.endsWith('/auth/me')) {
              return authUserJson(status: 'ACTIVE', emailVerified: true);
            }
            if (uri.path.endsWith('/appointments')) {
              return appointmentListJson(items: [appointmentJson()]);
            }
            return catalogHandler(uri);
          },
        ),
        initialLocation: '${AppRoutes.visitTour}?ids=$testAppointmentId',
        overrides: [
          mapTilesEnabledProvider.overrideWithValue(false),
          visitTourSelectionProvider.overrideWith(_PendingSelection.new),
        ],
      ),
    );
    await pumpFrames(tester, times: 40);
    expect(find.text('En attente de confirmation'), findsWidgets);
    expect(find.text('Confirmée'), findsNothing);
  });
}

class _PendingSelection extends VisitTourSelection {
  @override
  Set<String> build() => {testAppointmentId};
}
