import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mon_appart/app/router/app_routes.dart';
import 'package:mon_appart/core/auth/in_memory_session_store.dart';
import 'package:mon_appart/core/auth/session_tokens.dart';
import 'package:mon_appart/core/errors/app_failure.dart';
import 'package:mon_appart/features/visits/domain/visit_labels.dart';

import '../helpers/auth_fixtures.dart';
import '../helpers/fake_api_client.dart';
import '../helpers/listing_fixtures.dart';
import '../helpers/test_app.dart';
import '../helpers/visit_fixtures.dart';

Future<void> pumpFrames(WidgetTester tester, {int times = 12}) async {
  for (var i = 0; i < times; i++) {
    await tester.pump(const Duration(milliseconds: 16));
  }
}

void main() {
  testWidgets('liste vide propose la découverte des biens', (tester) async {
    await tester.binding.setSurfaceSize(const Size(400, 1200));
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
            return catalogHandler(uri);
          },
        ),
        initialLocation: AppRoutes.visits,
      ),
    );
    await pumpFrames(tester);
    expect(find.text('Aucune visite prévue'), findsOneWidget);
    expect(find.text('Découvrir les biens'), findsOneWidget);
  });

  testWidgets('affiche une demande PENDING sans la confirmer', (tester) async {
    await tester.binding.setSurfaceSize(const Size(400, 1200));
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
            if (uri.path.endsWith('/appointments') &&
                uri.queryParameters['scope'] == 'upcoming') {
              return appointmentListJson(items: [appointmentJson()]);
            }
            return catalogHandler(uri);
          },
        ),
        initialLocation: AppRoutes.visits,
      ),
    );
    await pumpFrames(tester);
    expect(find.text('En attente de confirmation'), findsOneWidget);
    expect(find.text('Confirmée'), findsNothing);
    await tester.tap(find.text('Appartement 2 chambres à Cocody'));
    await pumpFrames(tester, times: 20);
    expect(
      find.text('Cette demande n\'est pas un rendez-vous confirmé.'),
      findsOneWidget,
    );
    expect(find.text(VisitLabels.action('CANCEL')), findsOneWidget);
    expect(find.text(VisitLabels.action('CONFIRM')), findsNothing);
  });

  testWidgets('erreur réseau et visite inaccessible', (tester) async {
    await tester.binding.setSurfaceSize(const Size(400, 1200));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    final store = InMemorySessionStore();
    await store.save(const SessionTokens(accessToken: 'a', refreshToken: 'r'));
    var fail = true;
    await tester.pumpWidget(
      pumpMonAppart(
        config: testConfig(),
        sessionStore: store,
        apiClient: FakeApiClient(
          handler: (uri) async {
            if (uri.path.endsWith('/auth/me')) {
              return authUserJson(status: 'ACTIVE', emailVerified: true);
            }
            if (uri.path.endsWith('/appointments') && fail) {
              throw const NetworkFailure();
            }
            return catalogHandler(uri);
          },
        ),
        initialLocation: AppRoutes.visits,
      ),
    );
    await pumpFrames(tester);
    expect(find.textContaining('Impossible de joindre'), findsOneWidget);
    fail = false;
    await tester.tap(find.text('Réessayer'));
    await pumpFrames(tester);
    expect(find.text('Aucune visite prévue'), findsOneWidget);
  });

  testWidgets('visite 404 et connexion requise conservent next', (
    tester,
  ) async {
    await tester.pumpWidget(
      pumpMonAppart(
        config: testConfig(),
        apiClient: FakeApiClient(handler: (uri) async => catalogHandler(uri)),
        initialLocation: AppRoutes.appointment(testAppointmentId),
      ),
    );
    await pumpFrames(tester);
    expect(find.text('Connexion requise'), findsOneWidget);
    await tester.tap(find.text('Se connecter'));
    await pumpFrames(tester);
    expect(find.text('Connexion'), findsWidgets);

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
            if (uri.path.contains('/appointments/')) {
              throw const HttpFailure(
                statusCode: 404,
                code: 'APPOINTMENT_NOT_FOUND',
                message: 'Introuvable',
              );
            }
            return catalogHandler(uri);
          },
        ),
        initialLocation: AppRoutes.appointment(testAppointmentId),
      ),
    );
    await pumpFrames(tester, times: 20);
    expect(find.text('Visite inaccessible'), findsOneWidget);
  });

  testWidgets('côté annonce confirme uniquement si Nest le permet', (
    tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(400, 1400));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    final store = InMemorySessionStore();
    await store.save(const SessionTokens(accessToken: 'a', refreshToken: 'r'));
    var status = 'PENDING';
    await tester.pumpWidget(
      pumpMonAppart(
        config: testConfig(),
        sessionStore: store,
        apiClient: FakeApiClient(
          methodAwareHandler: (uri, method) async {
            if (uri.path.endsWith('/auth/me')) {
              return authUserJson(status: 'ACTIVE', emailVerified: true);
            }
            if (uri.path.endsWith('/confirm')) {
              status = 'CONFIRMED';
              return appointmentJson(
                status: status,
                side: 'LISTING_SIDE',
                actions: const ['CANCEL'],
              );
            }
            if (uri.path.contains('/appointments/')) {
              return appointmentJson(
                status: status,
                side: 'LISTING_SIDE',
                actions: status == 'PENDING'
                    ? const ['CONFIRM', 'RESCHEDULE', 'CANCEL']
                    : const ['CANCEL'],
              );
            }
            return catalogHandler(uri);
          },
        ),
        initialLocation: AppRoutes.appointment(testAppointmentId),
      ),
    );
    await pumpFrames(tester, times: 20);
    expect(find.text('Confirmer'), findsOneWidget);
    await tester.tap(find.text('Confirmer'));
    await pumpFrames(tester, times: 24);
    expect(find.text('Confirmée'), findsWidgets);
    expect(find.text('Confirmer'), findsNothing);
  });
}
