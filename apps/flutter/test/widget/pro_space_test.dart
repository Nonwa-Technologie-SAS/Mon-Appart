import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mon_appart/app/router/app_routes.dart';
import 'package:mon_appart/core/auth/in_memory_session_store.dart';
import 'package:mon_appart/core/auth/session_tokens.dart';
import 'package:mon_appart/core/errors/app_failure.dart';
import 'package:mon_appart/core/listing/listing_status_labels.dart';
import 'package:mon_appart/features/pro/domain/inquiry_labels.dart';

import '../helpers/auth_fixtures.dart';
import '../helpers/fake_api_client.dart';
import '../helpers/listing_fixtures.dart';
import '../helpers/pro_fixtures.dart';
import '../helpers/test_app.dart';

Future<void> pumpFrames(WidgetTester tester, {int times = 14}) async {
  for (var i = 0; i < times; i++) {
    await tester.pump(const Duration(milliseconds: 16));
  }
}

void main() {
  testWidgets('un particulier ne voit pas l\'espace pro ni les tuiles', (
    tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(400, 1400));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    final store = InMemorySessionStore();
    await store.save(const SessionTokens(accessToken: 'a', refreshToken: 'r'));
    final client = FakeApiClient(
      handler: (uri) async {
        if (uri.path.endsWith('/auth/me')) {
          return authUserJson(status: 'ACTIVE', emailVerified: true);
        }
        return catalogHandler(uri);
      },
    );
    await tester.pumpWidget(
      pumpMonAppart(
        config: testConfig(),
        sessionStore: store,
        apiClient: client,
        initialLocation: AppRoutes.account,
      ),
    );
    await pumpFrames(tester);
    expect(find.text('Tableau de bord'), findsNothing);
    expect(find.text('Mes prospects'), findsNothing);

    await tester.pumpWidget(
      pumpMonAppart(
        config: testConfig(),
        sessionStore: store,
        apiClient: client,
        initialLocation: AppRoutes.pro,
      ),
    );
    await pumpFrames(tester);
    expect(find.text('Espace professionnel'), findsOneWidget);
    expect(find.text('Non traitées'), findsNothing);
    expect(
      client.uris.any((uri) => uri.path.endsWith('/inquiries/dashboard')),
      isFalse,
    );
  });

  testWidgets('le tableau de bord OWNER affiche les indicateurs Nest', (
    tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(400, 1600));
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
              return authUserJson(
                status: 'ACTIVE',
                emailVerified: true,
                roles: const ['OWNER'],
              );
            }
            if (uri.path.endsWith('/inquiries/dashboard')) {
              return inquiryDashboardJson();
            }
            if (uri.path.endsWith('/analytics/me/listings')) {
              return listingStatsPageJson();
            }
            return catalogHandler(uri);
          },
        ),
        initialLocation: AppRoutes.pro,
      ),
    );
    await pumpFrames(tester);
    expect(find.text('Espace propriétaire'), findsOneWidget);
    expect(find.text('Non traitées'), findsOneWidget);
    expect(find.text('3'), findsWidgets);
    expect(find.text('—'), findsWidgets);
    expect(find.textContaining('Vues détail'), findsOneWidget);
    expect(
      find.text('Demandes PENDING, pas des rendez-vous confirmés'),
      findsOneWidget,
    );
  });

  testWidgets('liste les annonces gérées et ouvre la fiche', (tester) async {
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
              return authUserJson(
                status: 'ACTIVE',
                emailVerified: true,
                roles: const ['AGENCY'],
              );
            }
            if (uri.path.endsWith('/listings') &&
                uri.queryParameters['scope'] == 'mine') {
              return managedListingPageJson(
                items: [managedListingJson(status: 'DRAFT')],
              );
            }
            return catalogHandler(uri);
          },
        ),
        initialLocation: AppRoutes.proListings,
      ),
    );
    await pumpFrames(tester);
    expect(find.text('Appartement 2 chambres à Cocody'), findsOneWidget);
    expect(find.text(ListingStatusLabels.of('DRAFT')), findsWidgets);
    await tester.tap(find.byTooltip('Actions'));
    await pumpFrames(tester);
    expect(find.text('Demander la publication'), findsOneWidget);
    expect(find.text('Mettre en pause'), findsNothing);
    await tester.tapAt(const Offset(8, 8));
    await pumpFrames(tester);
    await tester.tap(find.text('Appartement 2 chambres à Cocody'));
    await pumpFrames(tester, times: 24);
    expect(
      find.text('Appartement lumineux à Riviera, proche des écoles.'),
      findsOneWidget,
    );
  });

  testWidgets('affiche les prospects et le détail', (tester) async {
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
              return authUserJson(
                status: 'ACTIVE',
                emailVerified: true,
                roles: const ['OWNER'],
              );
            }
            if (uri.path.endsWith('/inquiries') &&
                !uri.path.contains(testInquiryId)) {
              return inquiryPageJson();
            }
            return catalogHandler(uri);
          },
        ),
        initialLocation: AppRoutes.proLeads,
      ),
    );
    await pumpFrames(tester);
    expect(find.text('Koffi Yao'), findsOneWidget);
    expect(find.text(InquiryLabels.stage('NEW')), findsWidgets);
    await tester.tap(find.text('Koffi Yao'));
    await pumpFrames(tester, times: 20);
    expect(find.text('Ouvrir la conversation'), findsOneWidget);
    expect(find.text(InquiryLabels.stage('CONTACTED')), findsOneWidget);
  });

  testWidgets('session expirée sur le tableau de bord', (tester) async {
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
              return authUserJson(
                status: 'ACTIVE',
                emailVerified: true,
                roles: const ['OWNER'],
              );
            }
            if (uri.path.endsWith('/inquiries/dashboard')) {
              throw const HttpFailure(
                statusCode: 401,
                code: 'UNAUTHENTICATED',
                message: 'Session expirée ou absente.',
              );
            }
            return catalogHandler(uri);
          },
        ),
        initialLocation: AppRoutes.pro,
      ),
    );
    await pumpFrames(tester);
    expect(find.text('Session expirée'), findsOneWidget);
  });

  testWidgets('liste d\'annonces vide', (tester) async {
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
              return authUserJson(
                status: 'ACTIVE',
                emailVerified: true,
                roles: const ['OWNER'],
              );
            }
            return catalogHandler(uri);
          },
        ),
        initialLocation: AppRoutes.proListings,
      ),
    );
    await pumpFrames(tester);
    expect(find.text('Aucune annonce'), findsOneWidget);
  });

  testWidgets('un propriétaire voit les tuiles professionnelles', (
    tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(400, 1600));
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
              return authUserJson(
                status: 'ACTIVE',
                emailVerified: true,
                firstName: 'Awa',
                lastName: 'Koné',
                roles: const ['OWNER'],
              );
            }
            return catalogHandler(uri);
          },
        ),
        initialLocation: AppRoutes.account,
      ),
    );
    await pumpFrames(tester);
    expect(find.text('Espace propriétaire'), findsOneWidget);
    expect(find.text('Tableau de bord'), findsOneWidget);
    expect(find.text('Mes prospects'), findsOneWidget);
  });
}
